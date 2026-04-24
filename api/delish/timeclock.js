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

function getCentralDateKey(iso) {
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

  return `${map.year}-${map.month}-${map.day}`;
}

async function redis(command, ...args) {
  const res = await fetch(REDIS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ command: [command, ...args] })
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
    await redis("SET", EMP_KEY, JSON.stringify([]));
    return [];
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

async function pushPunch(entry) {
  await redis("LPUSH", PUNCHES_KEY, JSON.stringify(entry));
  await redis("LTRIM", PUNCHES_KEY, 0, MAX_RECENT - 1);
}

async function pushCompletedShift(entry) {
  await redis("LPUSH", SHIFTS_KEY, JSON.stringify(entry));
  await redis("LTRIM", SHIFTS_KEY, 0, MAX_SHIFTS - 1);
}

function activeArrayFromMap(map) {
  return Object.values(map || {}).sort((a, b) =>
    new Date(b.clockInAt) - new Date(a.clockInAt)
  );
}

function requireManager(pin) {
  if (String(pin || "").trim() !== MANAGER_PIN) {
    const err = new Error("Manager PIN required.");
    err.status = 401;
    throw err;
  }
}

function normalizeEmployeeName(name) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

function findEmployeeByName(employees, name) {
  const target = normalizeEmployeeName(name).toLowerCase();
  return employees.find(emp =>
    String(emp.name || "").trim().toLowerCase() === target
  );
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return send(res, 405, { ok: false, error: "Method not allowed." });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const action = String(body.action || "").trim();

    if (action === "clock_in") {
      const name = normalizeEmployeeName(body.name);
      const pin = String(body.pin || "").trim();

      if (!name || !pin) {
        return send(res, 400, { ok: false, error: "Name and PIN required." });
      }

      const employees = await getEmployees();
      const employee = findEmployeeByName(employees, name);

      if (!employee || employee.pin !== pin) {
        return send(res, 401, { ok: false, error: "Invalid PIN." });
      }

      const hour = new Date().toLocaleString("en-US", {
        timeZone: TZ,
        hour: "numeric",
        hour12: false
      });

      if (Number(hour) < 8 || Number(hour) > 18) {
        return send(res, 403, { ok: false, error: "Outside clock-in hours." });
      }

      const activeMap = await getActiveMap();
      if (activeMap[name]) {
        return send(res, 409, { ok: false, error: "Already clocked in." });
      }

      const timestamp = nowIso();

      const shift = {
        id: shiftId(name, timestamp),
        name,
        clockInAt: timestamp
      };

      activeMap[name] = shift;
      await setActiveMap(activeMap);
      await pushPunch({ name, action: "clock_in", timestamp });

      return send(res, 200, { ok: true });
    }

    if (action === "clock_out") {
      const name = normalizeEmployeeName(body.name);
      const pin = String(body.pin || "").trim();

      const employees = await getEmployees();
      const employee = findEmployeeByName(employees, name);

      if (!employee || employee.pin !== pin) {
        return send(res, 401, { ok: false, error: "Invalid PIN." });
      }

      const activeMap = await getActiveMap();
      const current = activeMap[name];

      if (!current) {
        return send(res, 409, { ok: false, error: "Not clocked in." });
      }

      const timestamp = nowIso();

      const minutes = diffMinutes(current.clockInAt, timestamp);

      const completed = {
        ...current,
        clockOutAt: timestamp,
        durationMinutes: minutes,
        durationHours: minutesToHours(minutes),
        dateCentral: getCentralDateKey(current.clockInAt)
      };

      delete activeMap[name];

      await setActiveMap(activeMap);
      await pushPunch({ name, action: "clock_out", timestamp });
      await pushCompletedShift(completed);

      return send(res, 200, { ok: true, shift: completed });
    }

    if (action === "add_employee") {
      requireManager(body.managerPin);

      const name = normalizeEmployeeName(body.name);
      const pin = String(body.pin || "").trim();

      if (!/^\d{4,8}$/.test(pin)) {
        return send(res, 400, { ok: false, error: "PIN must be 4–8 digits." });
      }

      const employees = await getEmployees();

      if (findEmployeeByName(employees, name)) {
        return send(res, 409, { ok: false, error: "Employee exists." });
      }

      if (employees.some(e => e.pin === pin)) {
        return send(res, 409, { ok: false, error: "PIN in use." });
      }

      const updated = [...employees, { name, pin }];
      await setEmployees(updated);

      return send(res, 200, { ok: true });
    }

    if (action === "delete_employee") {
      requireManager(body.managerPin);

      const name = normalizeEmployeeName(body.name);
      const employees = await getEmployees();

      const updated = employees.filter(e => e.name !== name);
      await setEmployees(updated);

      return send(res, 200, { ok: true });
    }

    return send(res, 400, { ok: false, error: "Invalid action." });
  } catch (err) {
    return send(res, err.status || 500, {
      ok: false,
      error: err.message || "Error"
    });
  }
}
```
