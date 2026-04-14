export const config = {
  runtime: "nodejs"
};

const REDIS_URL = process.env.DELISH_UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.DELISH_UPSTASH_REDIS_REST_TOKEN;
const MANAGER_PIN = process.env.DELISH_TIMECLOCK_MANAGER_PIN || "2468";

const TZ = "America/Chicago";
const ACTIVE_KEY = "delish:timeclock:active";
const PUNCHES_KEY = "delish:timeclock:punches";
const SHIFTS_KEY = "delish:timeclock:shifts";
const EMPLOYEES_KEY = "delish:timeclock:employees";

const MAX_RECENT = 25;
const MAX_SHIFTS = 500;

const DEFAULT_EMPLOYEES = [
  { id: "qwnetta", name: "Qwnetta", pin: "1111", active: true },
  { id: "employee-2", name: "Employee 2", pin: "2222", active: true },
  { id: "employee-3", name: "Employee 3", pin: "3333", active: true }
];

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
    .slice(0, 50) || "item";
}

function shiftId(name, timestamp) {
  return `shift_${slugify(name)}_${Date.parse(timestamp)}`;
}

function employeeId(name) {
  return slugify(name);
}

function pad2(v) {
  return String(v).padStart(2, "0");
}

function minutesToHours(minutes) {
  return Math.round((Number(minutes || 0) / 60) * 100) / 100;
}

function diffMinutes(startIso, endIso) {
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  return Math.max(0, Math.round(ms / 60000));
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

function buildUtcIsoFromCentralLocal(dateStr, timeStr) {
  const [year, month, day] = String(dateStr || "").split("-").map(Number);
  const [hour, minute] = String(timeStr || "").split(":").map(Number);

  if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) {
    throw new Error("Invalid date or time.");
  }

  const guessUtc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(guessUtc);

  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }

  const shownUtcMs = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    0
  );

  const desiredUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  const offsetMs = desiredUtcMs - shownUtcMs;

  return new Date(guessUtc.getTime() + offsetMs).toISOString();
}

function verifyManagerPin(pin) {
  return String(pin || "").trim() === String(MANAGER_PIN);
}

function sanitizeEmployeeName(name) {
  return String(name || "").trim().replace(/\s+/g, " ").slice(0, 60);
}

function sanitizePin(pin) {
  return String(pin || "").trim().replace(/\D/g, "").slice(0, 8);
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
      toCsvValue(shift.dateCentral || getCentralDateKey(shift.clockInAt))
    ].join(","));
  }

  return lines.join("\n");
}

function activeArrayFromMap(map) {
  return Object.values(map || {}).sort((a, b) => {
    return new Date(b.clockInAt).getTime() - new Date(a.clockInAt).getTime();
  });
}

function buildSummary(shifts = [], targetDate = "") {
  const filtered = targetDate
    ? shifts.filter(shift => (shift.dateCentral || getCentralDateKey(shift.clockInAt)) === targetDate)
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

async function getJsonValue(key, fallback) {
  const raw = await redis("GET", key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function setJsonValue(key, value) {
  await redis("SET", key, JSON.stringify(value));
}

async function getActiveMap() {
  return getJsonValue(ACTIVE_KEY, {});
}

async function setActiveMap(map) {
  await setJsonValue(ACTIVE_KEY, map);
}

async function getEmployees() {
  let employees = await getJsonValue(EMPLOYEES_KEY, null);

  if (!Array.isArray(employees) || !employees.length) {
    employees = DEFAULT_EMPLOYEES;
    await setJsonValue(EMPLOYEES_KEY, employees);
  }

  return employees
    .map(emp => ({
      id: String(emp.id || employeeId(emp.name)),
      name: sanitizeEmployeeName(emp.name),
      pin: sanitizePin(emp.pin),
      active: emp.active !== false
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function setEmployees(employees) {
  await setJsonValue(EMPLOYEES_KEY, employees);
}

async function getRecentPunches() {
  const list = await redis("LRANGE", PUNCHES_KEY, 0, MAX_RECENT - 1);
  if (!Array.isArray(list)) return [];
  return list.map(item => {
    try {
      return JSON.parse(item);
    } catch {
      return null;
    }
  }).filter(Boolean);
}

async function pushPunch(entry) {
  await redis("LPUSH", PUNCHES_KEY, JSON.stringify(entry));
  await redis("LTRIM", PUNCHES_KEY, 0, MAX_RECENT - 1);
}

async function getCompletedShifts(limit = 200) {
  const list = await redis("LRANGE", SHIFTS_KEY, 0, Math.max(0, limit - 1));
  if (!Array.isArray(list)) return [];
  return list.map(item => {
    try {
      return JSON.parse(item);
    } catch {
      return null;
    }
  }).filter(Boolean);
}

async function saveAllShifts(shifts) {
  await redis("DEL", SHIFTS_KEY);

  if (Array.isArray(shifts) && shifts.length) {
    for (const shift of shifts.slice().reverse()) {
      await redis("LPUSH", SHIFTS_KEY, JSON.stringify(shift));
    }
  }

  await redis("LTRIM", SHIFTS_KEY, 0, MAX_SHIFTS - 1);
}

async function pushCompletedShift(entry) {
  await redis("LPUSH", SHIFTS_KEY, JSON.stringify(entry));
  await redis("LTRIM", SHIFTS_KEY, 0, MAX_SHIFTS - 1);
}

function getEmployeeByName(employees, name) {
  return employees.find(emp => emp.name.toLowerCase() === String(name || "").trim().toLowerCase()) || null;
}

function serializeEmployeeForPublic(emp) {
  return {
    id: emp.id,
    name: emp.name,
    active: emp.active !== false
  };
}

function serializeEmployeeForManager(emp) {
  return {
    id: emp.id,
    name: emp.name,
    pin: emp.pin,
    active: emp.active !== false
  };
}

function normalizeShift(shift) {
  const durationMinutes = diffMinutes(shift.clockInAt, shift.clockOutAt);

  return {
    ...shift,
    dateCentral: getCentralDateKey(shift.clockInAt),
    durationMinutes,
    durationHours: minutesToHours(durationMinutes)
  };
}

async function handleGet(req, res) {
  try {
    const mode = String(req.query.mode || "").trim();
    const date = String(req.query.date || "").trim();
    const limit = Math.min(Number(req.query.limit || 200), 500);
    const managerPin = String(req.query.managerPin || "").trim();
    const isManager = verifyManagerPin(managerPin);

    const activeMap = await getActiveMap();
    const recent = await getRecentPunches();
    const shifts = await getCompletedShifts(limit);
    const employees = await getEmployees();

    if (mode === "csv") {
      if (!isManager) {
        return send(res, 401, { ok: false, error: "Manager PIN required." });
      }

      const filtered = date
        ? shifts.filter(shift => (shift.dateCentral || getCentralDateKey(shift.clockInAt)) === date)
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
      employees: employees
        .filter(emp => emp.active !== false)
        .map(emp => emp.name),
      active: activeArrayFromMap(activeMap),
      recent,
      shifts: isManager ? shifts : [],
      summary: isManager ? summary : null,
      manager: isManager ? {
        employees: employees.map(serializeEmployeeForManager)
      } : null
    });
  } catch (err) {
    return send(res, 500, {
      ok: false,
      error: err.message || "Unable to load time clock."
    });
  }
}

async function handleManagerAuth(req, res, body) {
  if (!verifyManagerPin(body.managerPin)) {
    return send(res, 401, { ok: false, error: "Incorrect manager PIN." });
  }

  const employees = await getEmployees();
  return send(res, 200, {
    ok: true,
    message: "Manager authenticated.",
    employees: employees.map(serializeEmployeeForManager)
  });
}

async function handleEmployeeSave(req, res, body) {
  if (!verifyManagerPin(body.managerPin)) {
    return send(res, 401, { ok: false, error: "Incorrect manager PIN." });
  }

  const name = sanitizeEmployeeName(body.name);
  const pin = sanitizePin(body.pin);
  const id = String(body.id || "").trim();
  const active = body.active !== false;

  if (!name) {
    return send(res, 400, { ok: false, error: "Employee name is required." });
  }

  if (!pin || pin.length < 4) {
    return send(res, 400, { ok: false, error: "PIN must be at least 4 digits." });
  }

  const employees = await getEmployees();
  const normalizedId = id || employeeId(name);

  const duplicate = employees.find(emp =>
    emp.id !== normalizedId &&
    emp.name.toLowerCase() === name.toLowerCase()
  );

  if (duplicate) {
    return send(res, 409, { ok: false, error: "Employee name already exists." });
  }

  const existingIndex = employees.findIndex(emp => emp.id === normalizedId);

  if (existingIndex >= 0) {
    employees[existingIndex] = {
      ...employees[existingIndex],
      id: normalizedId,
      name,
      pin,
      active
    };
  } else {
    employees.push({
      id: normalizedId,
      name,
      pin,
      active
    });
  }

  await setEmployees(employees);

  return send(res, 200, {
    ok: true,
    message: existingIndex >= 0 ? "Employee updated." : "Employee added.",
    employees: employees.map(serializeEmployeeForManager)
  });
}

async function handleEmployeeDelete(req, res, body) {
  if (!verifyManagerPin(body.managerPin)) {
    return send(res, 401, { ok: false, error: "Incorrect manager PIN." });
  }

  const id = String(body.id || "").trim();
  if (!id) {
    return send(res, 400, { ok: false, error: "Employee id is required." });
  }

  const employees = await getEmployees();
  const activeMap = await getActiveMap();

  const employee = employees.find(emp => emp.id === id);
  if (!employee) {
    return send(res, 404, { ok: false, error: "Employee not found." });
  }

  if (activeMap[employee.name]) {
    return send(res, 409, { ok: false, error: "Cannot delete an employee while clocked in." });
  }

  const nextEmployees = employees.filter(emp => emp.id !== id);
  await setEmployees(nextEmployees);

  return send(res, 200, {
    ok: true,
    message: "Employee removed.",
    employees: nextEmployees.map(serializeEmployeeForManager)
  });
}

async function handleShiftUpdate(req, res, body) {
  if (!verifyManagerPin(body.managerPin)) {
    return send(res, 401, { ok: false, error: "Incorrect manager PIN." });
  }

  const id = String(body.id || "").trim();
  const name = sanitizeEmployeeName(body.name);
  const dateCentral = String(body.dateCentral || "").trim();
  const clockInTime = String(body.clockInTime || "").trim();
  const clockOutTime = String(body.clockOutTime || "").trim();

  if (!id) {
    return send(res, 400, { ok: false, error: "Shift id is required." });
  }

  if (!name) {
    return send(res, 400, { ok: false, error: "Employee name is required." });
  }

  if (!dateCentral || !clockInTime || !clockOutTime) {
    return send(res, 400, { ok: false, error: "Date, clock-in time, and clock-out time are required." });
  }

  const employees = await getEmployees();
  const employeeExists = employees.some(emp => emp.name.toLowerCase() === name.toLowerCase());
  if (!employeeExists) {
    return send(res, 404, { ok: false, error: "Employee not found." });
  }

  const shifts = await getCompletedShifts(MAX_SHIFTS);
  const idx = shifts.findIndex(shift => shift.id === id);

  if (idx < 0) {
    return send(res, 404, { ok: false, error: "Shift not found." });
  }

  const clockInAt = buildUtcIsoFromCentralLocal(dateCentral, clockInTime);
  const clockOutAt = buildUtcIsoFromCentralLocal(dateCentral, clockOutTime);

  if (new Date(clockOutAt).getTime() <= new Date(clockInAt).getTime()) {
    return send(res, 400, { ok: false, error: "Clock-out must be after clock-in." });
  }

  shifts[idx] = normalizeShift({
    ...shifts[idx],
    name,
    clockInAt,
    clockOutAt
  });

  await saveAllShifts(shifts);

  return send(res, 200, {
    ok: true,
    message: "Shift updated.",
    shift: shifts[idx]
  });
}

async function handleMissedPunch(req, res, body) {
  if (!verifyManagerPin(body.managerPin)) {
    return send(res, 401, { ok: false, error: "Incorrect manager PIN." });
  }

  const name = sanitizeEmployeeName(body.name);
  const dateCentral = String(body.dateCentral || "").trim();
  const clockInTime = String(body.clockInTime || "").trim();
  const clockOutTime = String(body.clockOutTime || "").trim();
  const device = String(body.device || "manager-fix").trim();

  if (!name || !dateCentral || !clockInTime || !clockOutTime) {
    return send(res, 400, { ok: false, error: "Employee, date, clock-in time, and clock-out time are required." });
  }

  const employees = await getEmployees();
  const employeeExists = employees.some(emp => emp.name.toLowerCase() === name.toLowerCase());
  if (!employeeExists) {
    return send(res, 404, { ok: false, error: "Employee not found." });
  }

  const clockInAt = buildUtcIsoFromCentralLocal(dateCentral, clockInTime);
  const clockOutAt = buildUtcIsoFromCentralLocal(dateCentral, clockOutTime);

  if (new Date(clockOutAt).getTime() <= new Date(clockInAt).getTime()) {
    return send(res, 400, { ok: false, error: "Clock-out must be after clock-in." });
  }

  const shift = normalizeShift({
    id: shiftId(name, clockInAt),
    name,
    clockInAt,
    clockOutAt,
    clockInDevice: device,
    clockOutDevice: device,
    dateCentral
  });

  await pushCompletedShift(shift);

  const punchOut = {
    id: shift.id,
    name,
    action: "manager_fix",
    timestamp: nowIso(),
    device,
    clockInAt: shift.clockInAt,
    clockOutAt: shift.clockOutAt
  };

  await pushPunch(punchOut);

  return send(res, 200, {
    ok: true,
    message: "Missed punch shift added.",
    shift
  });
}

async function handleClockIn(req, res, body) {
  const name = sanitizeEmployeeName(body.name);
  const pin = sanitizePin(body.pin);
  const device = String(body.device || "kitchen-ipad").trim();

  if (!name) {
    return send(res, 400, { ok: false, error: "Employee name is required." });
  }

  if (!pin) {
    return send(res, 400, { ok: false, error: "PIN is required." });
  }

  const employees = await getEmployees();
  const employee = getEmployeeByName(employees, name);

  if (!employee || employee.active === false) {
    return send(res, 401, { ok: false, error: "Employee not recognized." });
  }

  if (employee.pin !== pin) {
    return send(res, 401, { ok: false, error: "Incorrect PIN." });
  }

  const activeMap = await getActiveMap();
  const recent = await getRecentPunches();
  const current = activeMap[employee.name];
  const timestamp = nowIso();

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

async function handleClockOut(req, res, body) {
  const name = sanitizeEmployeeName(body.name);
  const pin = sanitizePin(body.pin);
  const device = String(body.device || "kitchen-ipad").trim();

  if (!name) {
    return send(res, 400, { ok: false, error: "Employee name is required." });
  }

  if (!pin) {
    return send(res, 400, { ok: false, error: "PIN is required." });
  }

  const employees = await getEmployees();
  const employee = getEmployeeByName(employees, name);

  if (!employee || employee.active === false) {
    return send(res, 401, { ok: false, error: "Employee not recognized." });
  }

  if (employee.pin !== pin) {
    return send(res, 401, { ok: false, error: "Incorrect PIN." });
  }

  const activeMap = await getActiveMap();
  const recent = await getRecentPunches();
  const current = activeMap[employee.name];
  const timestamp = nowIso();

  if (!current) {
    return send(res, 409, {
      ok: false,
      error: `${employee.name} is not clocked in.`,
      active: activeArrayFromMap(activeMap),
      recent
    });
  }

  const completedShift = normalizeShift({
    id: current.id,
    name: employee.name,
    clockInAt: current.clockInAt,
    clockOutAt: timestamp,
    clockInDevice: current.device || "",
    clockOutDevice: device
  });

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
    message: `${employee.name} clocked out successfully. Shift recorded: ${completedShift.durationHours} hrs.`,
    active: activeArrayFromMap(activeMap),
    recent: updatedRecent,
    shift: completedShift
  });
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return handleGet(req, res);
  }

  if (req.method !== "POST") {
    return send(res, 405, { ok: false, error: "Method not allowed." });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const action = String(body.action || "").trim();

    if (action === "manager_auth") {
      return handleManagerAuth(req, res, body);
    }

    if (action === "employee_save") {
      return handleEmployeeSave(req, res, body);
    }

    if (action === "employee_delete") {
      return handleEmployeeDelete(req, res, body);
    }

    if (action === "shift_update") {
      return handleShiftUpdate(req, res, body);
    }

    if (action === "missed_punch") {
      return handleMissedPunch(req, res, body);
    }

    if (action === "clock_in") {
      return handleClockIn(req, res, body);
    }

    if (action === "clock_out") {
      return handleClockOut(req, res, body);
    }

    return send(res, 400, { ok: false, error: "Invalid action." });
  } catch (err) {
    return send(res, 500, {
      ok: false,
      error: err.message || "Unable to process time clock request."
    });
  }
}
