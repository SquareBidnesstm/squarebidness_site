export const config = {
  runtime: "nodejs"
};

const REDIS_URL = process.env.DELISH_UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.DELISH_UPSTASH_REDIS_REST_TOKEN;

const EMPLOYEES = [
  { name: "Qwnetta", pin: "1111" },
  { name: "Employee 2", pin: "2222" },
  { name: "Employee 3", pin: "3333" }
];

const TZ = "America/Chicago";
const ACTIVE_KEY = "delish:timeclock:active";
const PUNCHES_KEY = "delish:timeclock:punches";
const SHIFTS_KEY = "delish:timeclock:shifts";
const MAX_RECENT = 25;
const MAX_SHIFTS = 500;

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

function getEmployee(name) {
  return EMPLOYEES.find(emp => emp.name.toLowerCase() === String(name || "").trim().toLowerCase()) || null;
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

async function getRecentPunches() {
  const list = await redis("LRANGE", PUNCHES_KEY, 0, MAX_RECENT - 1);
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

async function getCompletedShifts(limit = 200) {
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

async function pushCompletedShift(entry) {
  await redis("LPUSH", SHIFTS_KEY, JSON.stringify(entry));
  await redis("LTRIM", SHIFTS_KEY, 0, MAX_SHIFTS - 1);
}

function activeArrayFromMap(map) {
  return Object.values(map || {}).sort((a, b) => {
    return new Date(b.clockInAt).getTime() - new Date(a.clockInAt).getTime();
  });
}

function employeeNames() {
  return EMPLOYEES.map(emp => emp.name);
}

function diffMinutes(startIso, endIso) {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  return Math.max(0, Math.round(ms / 60000));
}

function minutesToHours(minutes) {
  return Math.round((minutes / 60) * 100) / 100;
}

function pad2(value) {
  return String(value).padStart(2, "0");
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

function getCentralTimeLabel(iso) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(iso));
}

function buildSummary(shifts = [], targetDate = "") {
  const filtered = targetDate
    ? shifts.filter(shift => getCentralDateKey(shift.clockInAt) === targetDate)
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

function toCsvValue(value) {
  const str = String(value ?? "");
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
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
      toCsvValue(getCentralDateKey(shift.clockInAt))
    ].join(","));
  }

  return lines.join("\n");
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const mode = String(req.query.mode || "").trim();
      const date = String(req.query.date || "").trim();
      const limit = Math.min(Number(req.query.limit || 200), 500);

      const activeMap = await getActiveMap();
      const recent = await getRecentPunches();
      const shifts = await getCompletedShifts(limit);

      if (mode === "csv") {
        const filtered = date
          ? shifts.filter(shift => getCentralDateKey(shift.clockInAt) === date)
          : shifts;

        const csv = shiftsToCsv(filtered);
        const filename = date
          ? `delish-timeclock-${date}.csv`
          : `delish-timeclock-export.csv`;

        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        return res.status(200).send(csv);
      }

      const summary = buildSummary(shifts, date);

      return send(res, 200, {
        ok: true,
        timezone: TZ,
        employees: employeeNames(),
        active: activeArrayFromMap(activeMap),
        recent,
        shifts,
        summary
      });
    } catch (err) {
      return send(res, 500, {
        ok: false,
        error: err.message || "Unable to load time clock."
      });
    }
  }

  if (req.method !== "POST") {
    return send(res, 405, {
      ok: false,
      error: "Method not allowed."
    });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const action = String(body.action || "").trim();
    const name = String(body.name || "").trim();
    const pin = String(body.pin || "").trim();
    const device = String(body.device || "kitchen-ipad").trim();

    if (!name) {
      return send(res, 400, { ok: false, error: "Employee name is required." });
    }

    if (!pin) {
      return send(res, 400, { ok: false, error: "PIN is required." });
    }

    if (!["clock_in", "clock_out"].includes(action)) {
      return send(res, 400, { ok: false, error: "Invalid action." });
    }

    const employee = getEmployee(name);

    if (!employee) {
      return send(res, 401, { ok: false, error: "Employee not recognized." });
    }

    if (employee.pin !== pin) {
      return send(res, 401, { ok: false, error: "Incorrect PIN." });
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

      const updatedRecent = [punch, ...recent].slice(0, MAX_RECENT);

      return send(res, 200, {
        ok: true,
        message: `${employee.name} clocked in successfully.`,
        active: activeArrayFromMap(activeMap),
        recent: updatedRecent
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

    const updatedRecent = [punch, ...recent].slice(0, MAX_RECENT);

    return send(res, 200, {
      ok: true,
      message: `${employee.name} clocked out successfully. Shift recorded: ${durationHours} hrs.`,
      active: activeArrayFromMap(activeMap),
      recent: updatedRecent,
      shift: completedShift
    });
  } catch (err) {
    return send(res, 500, {
      ok: false,
      error: err.message || "Unable to save time punch."
    });
  }
}
