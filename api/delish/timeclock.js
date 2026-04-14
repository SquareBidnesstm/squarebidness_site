export const config = {
  runtime: "nodejs"
};

const REDIS_URL = process.env.DELISH_UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.DELISH_UPSTASH_REDIS_REST_TOKEN;

const TZ = "America/Chicago";
const MANAGER_PIN = process.env.DELISH_TIMECLOCK_MANAGER_PIN || "9999";

const ACTIVE_KEY = "delish:timeclock:active";
const PUNCHES_KEY = "delish:timeclock:punches";
const SHIFTS_KEY = "delish:timeclock:shifts";
const EMP_KEY = "delish:timeclock:employees";

const MAX_RECENT = 25;
const MAX_SHIFTS = 1000;

function send(res, status, data) {
  res.status(status).json(data);
}

function nowIso() {
  return new Date().toISOString();
}

function slugify(value = "") {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "employee";
}

function shiftId(name, timestamp) {
  return `shift_${slugify(name)}_${Date.parse(timestamp)}`;
}

function diffMinutes(startIso, endIso) {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  return Math.max(0, Math.round(ms / 60000));
}

function minutesToHours(minutes) {
  return Math.round((Number(minutes || 0) / 60) * 100) / 100;
}

function toCsvValue(value) {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function getCentralDateParts(iso) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(iso));

  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }

  return {
    year: map.year,
    month: map.month,
    day: map.day
  };
}

function getCentralDateKey(iso) {
  const p = getCentralDateParts(iso);
  return `${p.year}-${p.month}-${p.day}`;
}

async function redis(command, ...args) {
  if (!REDIS_URL || !REDIS_TOKEN) {
    throw new Error("Missing Delish Upstash Redis env vars.");
  }

  const res = await fetch(REDIS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      command: [command, ...args]
    })
  });

  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(data.error || `Redis ${command} failed.`);
  }

  return data.result;
}

async function getEmployees() {
  const raw = await redis("GET", EMP_KEY);

  if (!raw) {
    const seed = [
      { name: "Qwnetta", pin: "1111" }
    ];
    await redis("SET", EMP_KEY, JSON.stringify(seed));
    return seed;
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function setEmployees(list) {
  await redis("SET", EMP_KEY, JSON.stringify(list));
}

async function getActiveMap() {
  const raw = await redis("GET", ACTIVE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function setActiveMap(map) {
  await redis("SET", ACTIVE_KEY, JSON.stringify(map));
}

async function getRecentPunches(limit = MAX_RECENT) {
  const list = await redis("LRANGE", PUNCHES_KEY, 0, Math.max(0, limit - 1));
  if (!Array.isArray(list)) return [];

  return list
    .map(item => {
      try {
        return JSON.parse(item);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function pushPunch(entry) {
  await redis("LPUSH", PUNCHES_KEY, JSON.stringify(entry));
  await redis("LTRIM", PUNCHES_KEY, 0, MAX_RECENT - 1);
}

async function getCompletedShifts(limit = 300) {
  const list = await redis("LRANGE", SHIFTS_KEY, 0, Math.max(0, limit - 1));
  if (!Array.isArray(list)) return [];

  return list
    .map(item => {
      try {
        return JSON.parse(item);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function setCompletedShifts(shifts) {
  await redis("DEL", SHIFTS_KEY);

  if (!Array.isArray(shifts) || !shifts.length) return;

  for (const shift of [...shifts].reverse()) {
    await redis("LPUSH", SHIFTS_KEY, JSON.stringify(shift));
  }

  await redis("LTRIM", SHIFTS_KEY, 0, MAX_SHIFTS - 1);
}

async function pushCompletedShift(entry) {
  await redis("LPUSH", SHIFTS_KEY, JSON.stringify(entry));
  await redis("LTRIM", SHIFTS_KEY, 0, MAX_SHIFTS - 1);
}

function activeArrayFromMap(map) {
  return Object.values(map || {}).sort((a, b) => {
    return new Date(b.clockInAt).getTime() - new Date(a.clockInAt).getTime();
  });
}

function buildSummary(shifts = [], targetDate = "") {
  const filtered = targetDate
    ? shifts.filter(shift => shift.dateCentral === targetDate)
    : shifts;

  const byEmployee = {};

  for (const shift of filtered) {
    const name = shift.name || "Unknown";

    if (!byEmployee[name]) {
      byEmployee[name] = {
        name,
        shifts: 0,
        minutes: 0,
        hours: 0
      };
    }

    byEmployee[name].shifts += 1;
    byEmployee[name].minutes += Number(shift.durationMinutes || 0);
  }

  const employees = Object.values(byEmployee)
    .map(item => ({
      ...item,
      hours: minutesToHours(item.minutes)
    }))
    .sort((a, b) => b.minutes - a.minutes);

  const totalMinutes = employees.reduce((sum, item) => sum + item.minutes, 0);

  return {
    date: targetDate || null,
    totalShifts: filtered.length,
    totalMinutes,
    totalHours: minutesToHours(totalMinutes),
    employees
  };
}

function shiftsToCsv(shifts = []) {
  const header = [
    "Employee",
    "Clock In",
    "Clock Out",
    "Duration Minutes",
    "Duration Hours",
    "Device Clock In",
    "Device Clock Out",
    "Date (Central)"
  ];

  const lines = [header.join(",")];

  for (const shift of shifts) {
    lines.push([
      toCsvValue(shift.name),
      toCsvValue(shift.clockInAt),
      toCsvValue(shift.clockOutAt),
      toCsvValue(shift.durationMinutes),
      toCsvValue(shift.durationHours),
      toCsvValue(shift.clockInDevice || ""),
      toCsvValue(shift.clockOutDevice || ""),
      toCsvValue(shift.dateCentral || getCentralDateKey(shift.clockInAt))
    ].join(","));
  }

  return lines.join("\n");
}

function requireManager(pin) {
  if (String(pin || "").trim() !== MANAGER_PIN) {
    const err = new Error("Manager PIN required.");
    err.status = 401;
    throw err;
  }
}

function normalizeEmployeeName(name) {
  return String(name || "").trim();
}

function findEmployeeByName(employees, name) {
  const target = normalizeEmployeeName(name).toLowerCase();
  return employees.find(emp => String(emp.name || "").trim().toLowerCase() === target) || null;
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const mode = String(req.query.mode || "").trim();
      const date = String(req.query.date || "").trim();
      const limit = Math.min(Number(req.query.limit || 300), MAX_SHIFTS);

      const employees = await getEmployees();
      const activeMap = await getActiveMap();
      const recent = await getRecentPunches();
      const shifts = await getCompletedShifts(limit);

      const summary = buildSummary(shifts, date);

      if (mode === "csv") {
        const filtered = date
          ? shifts.filter(shift => shift.dateCentral === date)
          : shifts;

        const csv = shiftsToCsv(filtered);
        const filename = date
          ? `delish-timeclock-${date}.csv`
          : `delish-timeclock-export.csv`;

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        return res.status(200).send(csv);
      }

      return send(res, 200, {
        ok: true,
        timezone: TZ,
        employees: employees.map(emp => emp.name),
        active: activeArrayFromMap(activeMap),
        recent,
        shifts,
        summary
      });
    }

    if (req.method !== "POST") {
      return send(res, 405, {
        ok: false,
        error: "Method not allowed."
      });
    }

    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : (req.body || {});

    const action = String(body.action || "").trim();

    if (!action) {
      return send(res, 400, {
        ok: false,
        error: "Action is required."
      });
    }

    if (action === "clock_in" || action === "clock_out") {
      const name = normalizeEmployeeName(body.name);
      const pin = String(body.pin || "").trim();
      const device = String(body.device || "kitchen-ipad").trim();

      if (!name) {
        return send(res, 400, { ok: false, error: "Employee name is required." });
      }

      if (!pin) {
        return send(res, 400, { ok: false, error: "PIN is required." });
      }

      const employees = await getEmployees();
      const employee = findEmployeeByName(employees, name);

      if (!employee || String(employee.pin || "") !== pin) {
        return send(res, 401, { ok: false, error: "Invalid PIN." });
      }

      const activeMap = await getActiveMap();
      const recent = await getRecentPunches();
      const current = activeMap[employee.name];
      const timestamp = nowIso();

      if (action === "clock_in") {
        if (current) {
          return send(res, 409, {
            ok: false,
            error: `${employee.name} is already clocked in.`,
            active: activeArrayFromMap(activeMap),
            recent
          });
        }

        const activeShift = {
          id: shiftId(employee.name, timestamp),
          name: employee.name,
          clockInAt: timestamp,
          device
        };

        activeMap[employee.name] = activeShift;

        const punch = {
          id: activeShift.id,
          name: employee.name,
          action: "clock_in",
          timestamp,
          device
        };

        await setActiveMap(activeMap);
        await pushPunch(punch);

        return send(res, 200, {
          ok: true,
          message: `${employee.name} clocked in successfully.`,
          active: activeArrayFromMap(activeMap),
          recent: [punch, ...recent].slice(0, MAX_RECENT)
        });
      }

      if (!current) {
        return send(res, 409, {
          ok: false,
          error: `${employee.name} is not clocked in.`,
          active: activeArrayFromMap(activeMap),
          recent
        });
      }

      const durationMinutes = diffMinutes(current.clockInAt, timestamp);
      const durationHours = minutesToHours(durationMinutes);

      const completedShift = {
        id: current.id,
        name: employee.name,
        clockInAt: current.clockInAt,
        clockOutAt: timestamp,
        clockInDevice: current.device || "",
        clockOutDevice: device,
        durationMinutes,
        durationHours,
        dateCentral: getCentralDateKey(current.clockInAt)
      };

      const punch = {
        id: current.id,
        name: employee.name,
        action: "clock_out",
        timestamp,
        device,
        clockInAt: current.clockInAt
      };

      delete activeMap[employee.name];

      await setActiveMap(activeMap);
      await pushPunch(punch);
      await pushCompletedShift(completedShift);

      return send(res, 200, {
        ok: true,
        message: `${employee.name} clocked out successfully.`,
        active: activeArrayFromMap(activeMap),
        recent: [punch, ...recent].slice(0, MAX_RECENT),
        shift: completedShift
      });
    }

    if (action === "add_employee") {
      requireManager(body.managerPin);

      const name = normalizeEmployeeName(body.name);
      const pin = String(body.pin || "").trim();

      if (!name) {
        return send(res, 400, { ok: false, error: "Employee name is required." });
      }

      if (!pin) {
        return send(res, 400, { ok: false, error: "Employee PIN is required." });
      }

      const employees = await getEmployees();

      if (findEmployeeByName(employees, name)) {
        return send(res, 409, { ok: false, error: "Employee already exists." });
      }

      const updated = [...employees, { name, pin }];
      await setEmployees(updated);

      return send(res, 200, {
        ok: true,
        employees: updated.map(emp => emp.name)
      });
    }

    if (action === "delete_employee") {
      requireManager(body.managerPin);

      const name = normalizeEmployeeName(body.name);
      if (!name) {
        return send(res, 400, { ok: false, error: "Employee name is required." });
      }

      const employees = await getEmployees();
      const employee = findEmployeeByName(employees, name);

      if (!employee) {
        return send(res, 404, { ok: false, error: "Employee not found." });
      }

      const activeMap = await getActiveMap();
      if (activeMap[employee.name]) {
        return send(res, 409, {
          ok: false,
          error: "Employee is currently clocked in. Clock them out first."
        });
      }

      const updated = employees.filter(emp => String(emp.name || "").trim().toLowerCase() !== employee.name.toLowerCase());
      await setEmployees(updated);

      return send(res, 200, {
        ok: true,
        employees: updated.map(emp => emp.name)
      });
    }

    if (action === "edit_shift") {
      requireManager(body.managerPin);

      const id = String(body.id || "").trim();
      const clockInAt = String(body.clockInAt || "").trim();
      const clockOutAt = String(body.clockOutAt || "").trim();

      if (!id) {
        return send(res, 400, { ok: false, error: "Shift id is required." });
      }

      if (!clockInAt || !clockOutAt) {
        return send(res, 400, { ok: false, error: "Clock in and clock out are required." });
      }

      const start = new Date(clockInAt).getTime();
      const end = new Date(clockOutAt).getTime();

      if (!Number.isFinite(start) || !Number.isFinite(end)) {
        return send(res, 400, { ok: false, error: "Invalid shift time." });
      }

      if (end <= start) {
        return send(res, 400, { ok: false, error: "Clock out must be after clock in." });
      }

      const shifts = await getCompletedShifts(MAX_SHIFTS);
      let found = false;

      const updated = shifts.map(shift => {
        if (shift.id !== id) return shift;
        found = true;

        const durationMinutes = diffMinutes(clockInAt, clockOutAt);
        return {
          ...shift,
          clockInAt,
          clockOutAt,
          durationMinutes,
          durationHours: minutesToHours(durationMinutes),
          dateCentral: getCentralDateKey(clockInAt)
        };
      });

      if (!found) {
        return send(res, 404, { ok: false, error: "Shift not found." });
      }

      await setCompletedShifts(updated);

      return send(res, 200, {
        ok: true,
        message: "Shift updated."
      });
    }

    if (action === "delete_shift") {
      requireManager(body.managerPin);

      const id = String(body.id || "").trim();
      if (!id) {
        return send(res, 400, { ok: false, error: "Shift id is required." });
      }

      const shifts = await getCompletedShifts(MAX_SHIFTS);
      const updated = shifts.filter(shift => shift.id !== id);

      if (updated.length === shifts.length) {
        return send(res, 404, { ok: false, error: "Shift not found." });
      }

      await setCompletedShifts(updated);

      return send(res, 200, {
        ok: true,
        message: "Shift deleted."
      });
    }

    return send(res, 400, {
      ok: false,
      error: "Invalid action."
    });
  } catch (err) {
    const status = err.status || 500;
    return send(res, status, {
      ok: false,
      error: err.message || "Time clock request failed."
    });
  }
}
