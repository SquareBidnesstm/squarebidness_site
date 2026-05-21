import { Redis } from "@upstash/redis";
import { writeLedgerEvent } from "../_lib/supabase-ledger.js";

export const config = {
  runtime: "nodejs"
};

const REDIS_URL = process.env.DELISH_UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.DELISH_UPSTASH_REDIS_REST_TOKEN;
const redisClient = REDIS_URL && REDIS_TOKEN
  ? new Redis({ url: REDIS_URL, token: REDIS_TOKEN })
  : null;

const TZ = "America/Chicago";
const MANAGER_PIN =
  process.env.DELISH_TIMECLOCK_MANAGER_PIN ||
  process.env.DELISH_OPERATOR_TOKEN ||
  "";

const ACTIVE_KEY = "delish:timeclock:active";
const PUNCHES_KEY = "delish:timeclock:punches";
const SHIFTS_KEY = "delish:timeclock:shifts";
const EMP_KEY = "delish:timeclock:employees";
const PAYROLL_TURN_INS_KEY = "delish:timeclock:payroll_turn_ins";

const MAX_RECENT = 25;
const MAX_SHIFTS = 1000;

function send(res, status, data) {
  res.status(status).json(data);
}

async function logTimeclockEvent(eventType, entityId, payload = {}) {
  return writeLedgerEvent({
    brand: "delish",
    system: "timeclock",
    eventType,
    entityId,
    payload,
    source: "api/delish/timeclock",
  });
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

function getCentralDateParts(iso) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long"
  }).formatToParts(new Date(iso));

  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }

  return {
    dateKey: `${map.year}-${map.month}-${map.day}`,
    weekday: String(map.weekday || "").toLowerCase()
  };
}

function addDaysToDateKey(dateKey, days) {
  const [year, month, day] = String(dateKey || "").split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + Number(days || 0)));
  return date.toISOString().slice(0, 10);
}

function normalizeEmployeeName(name) {
  return String(name || "").trim().replace(/\s+/g, " ");
}

function normalizeDevice(device) {
  return String(device || "device").trim().replace(/\s+/g, " ").slice(0, 80) || "device";
}

function parseJson(value, fallback) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function parseList(values) {
  return (Array.isArray(values) ? values : [])
    .map(value => parseJson(value, null))
    .filter(Boolean);
}

function ensureRedisConfig() {
  if (!REDIS_URL || !REDIS_TOKEN) {
    const err = new Error("Time clock storage is not configured.");
    err.status = 500;
    throw err;
  }
}

async function redis(command, ...args) {
  ensureRedisConfig();
  const op = String(command || "").toUpperCase();

  if (!redisClient) {
    throw new Error("Time clock storage is not configured.");
  }

  if (op === "GET") return redisClient.get(args[0]);
  if (op === "SET") return redisClient.set(args[0], args[1]);
  if (op === "DEL") return redisClient.del(args[0]);
  if (op === "LRANGE") return redisClient.lrange(args[0], args[1], args[2]);
  if (op === "LPUSH") return redisClient.lpush(args[0], ...args.slice(1));
  if (op === "RPUSH") return redisClient.rpush(args[0], ...args.slice(1));
  if (op === "LTRIM") return redisClient.ltrim(args[0], args[1], args[2]);

  const err = new Error(`Unsupported Redis command: ${op}`);
  err.status = 500;
  throw err;
}

function publicError(err) {
  const status = Number(err.status || 500);

  if (status >= 500) {
    return "Time clock is temporarily unavailable.";
  }

  return err.message || "Error";
}

async function getEmployees() {
  const raw = await redis("GET", EMP_KEY);

  if (!raw) {
    await redis("SET", EMP_KEY, JSON.stringify([]));
    return [];
  }

  const parsed = parseJson(raw, []);
  return Array.isArray(parsed) ? parsed : [];
}

async function setEmployees(list) {
  await redis("SET", EMP_KEY, JSON.stringify(list));
}

function employeeNames(employees) {
  return (employees || [])
    .map(emp => normalizeEmployeeName(emp?.name || emp))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

function findEmployeeByName(employees, name) {
  const target = normalizeEmployeeName(name).toLowerCase();
  return employees.find(emp =>
    String(emp?.name || emp || "").trim().toLowerCase() === target
  );
}

function findEmployeeByPin(employees, pin) {
  const target = String(pin || "").trim();
  if (!target) return null;
  return employees.find(emp => String(emp?.pin || "").trim() === target) || null;
}

async function getActiveMap() {
  const raw = await redis("GET", ACTIVE_KEY);
  return parseJson(raw, {});
}

async function setActiveMap(map) {
  await redis("SET", ACTIVE_KEY, JSON.stringify(map || {}));
}

async function getRecentPunches() {
  return parseList(await redis("LRANGE", PUNCHES_KEY, 0, MAX_RECENT - 1));
}

async function getShifts() {
  return parseList(await redis("LRANGE", SHIFTS_KEY, 0, MAX_SHIFTS - 1));
}

async function getPayrollTurnIns() {
  const saved = await redis("GET", PAYROLL_TURN_INS_KEY);
  const parsed = parseJson(saved, {});
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
}

async function setPayrollTurnIns(turnIns) {
  await redis("SET", PAYROLL_TURN_INS_KEY, JSON.stringify(turnIns || {}));
}

async function setShifts(shifts) {
  await redis("DEL", SHIFTS_KEY);
  const rows = (shifts || []).map(shift => JSON.stringify(shift));
  if (rows.length) {
    await redis("RPUSH", SHIFTS_KEY, ...rows.slice(0, MAX_SHIFTS));
  }
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

function filterShiftsByDate(shifts, date) {
  if (!date) return shifts || [];
  return (shifts || []).filter(shift => shift.dateCentral === date);
}

function filterShiftsByDateRange(shifts, startDate, endDate) {
  return (shifts || []).filter(shift => {
    const date = String(shift.dateCentral || "");
    return date >= startDate && date <= endDate;
  });
}

function summarizeShifts(shifts) {
  const byEmployee = new Map();

  for (const shift of shifts || []) {
    const name = normalizeEmployeeName(shift.name);
    if (!name) continue;

    const current = byEmployee.get(name) || { name, shifts: 0, minutes: 0 };
    current.shifts += 1;
    current.minutes += Number(shift.durationMinutes || 0);
    byEmployee.set(name, current);
  }

  const employees = Array.from(byEmployee.values())
    .map(item => ({
      ...item,
      hours: minutesToHours(item.minutes)
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const totalMinutes = employees.reduce((sum, item) => sum + item.minutes, 0);

  return {
    employees,
    totalMinutes,
    totalHours: minutesToHours(totalMinutes),
    totalShifts: (shifts || []).length
  };
}

function summarizeLabor(shifts, active, timestamp = nowIso()) {
  const activeRows = (active || []).map(shift => {
    const clockInAt = shift.clockInAt;
    return {
      ...shift,
      durationMinutes: diffMinutes(clockInAt, timestamp),
      durationHours: minutesToHours(diffMinutes(clockInAt, timestamp)),
      dateCentral: getCentralDateKey(clockInAt)
    };
  });

  return summarizeShifts([...(shifts || []), ...activeRows]);
}

function buildShiftUpdate(shift, clockInAt, clockOutAt) {
  const minutes = diffMinutes(clockInAt, clockOutAt);

  return {
    ...shift,
    clockInAt,
    clockOutAt,
    durationMinutes: minutes,
    durationHours: minutesToHours(minutes),
    dateCentral: getCentralDateKey(clockInAt)
  };
}

async function maybeTurnInPayroll(timestamp, activeMap) {
  if (Object.keys(activeMap || {}).length > 0) return null;

  const { dateKey, weekday } = getCentralDateParts(timestamp);
  if (weekday !== "monday") return null;

  const periodEnd = dateKey;
  const periodStart = addDaysToDateKey(periodEnd, -6);
  const turnIns = await getPayrollTurnIns();

  if (turnIns[periodEnd]) return turnIns[periodEnd];

  const shifts = filterShiftsByDateRange(await getShifts(), periodStart, periodEnd);
  if (!shifts.length) return null;

  const summary = summarizeShifts(shifts);
  const turnIn = {
    id: `payroll_${periodEnd}`,
    status: "turned_in",
    payDate: addDaysToDateKey(periodEnd, 1),
    periodStart,
    periodEnd,
    turnedInAt: timestamp,
    trigger: "last_monday_clock_out",
    totalHours: summary.totalHours,
    totalMinutes: summary.totalMinutes,
    totalShifts: summary.totalShifts,
    employees: summary.employees
  };

  turnIns[periodEnd] = turnIn;
  await setPayrollTurnIns(turnIns);

  return turnIn;
}

async function buildState(date) {
  const [employees, activeMap, recent, shifts] = await Promise.all([
    getEmployees(),
    getActiveMap(),
    getRecentPunches(),
    getShifts()
  ]);
  const payrollTurnIns = await getPayrollTurnIns();

  const active = activeArrayFromMap(activeMap);
  const filteredShifts = filterShiftsByDate(shifts, date);
  const activeForDate = date
    ? active.filter(shift => getCentralDateKey(shift.clockInAt) === date)
    : active;

  return {
    ok: true,
    employees: employeeNames(employees),
    active,
    recent,
    shifts: filteredShifts,
    summary: summarizeShifts(filteredShifts),
    laborSummary: summarizeLabor(filteredShifts, activeForDate),
    payrollTurnIns: Object.values(payrollTurnIns)
      .sort((a, b) => String(b.periodEnd || "").localeCompare(String(a.periodEnd || "")))
      .slice(0, 12)
  };
}

async function buildPublicState() {
  const [employees, activeMap, recent] = await Promise.all([
    getEmployees(),
    getActiveMap(),
    getRecentPunches()
  ]);

  return {
    ok: true,
    employees: employeeNames(employees),
    active: activeArrayFromMap(activeMap),
    recent
  };
}

function requireManager(pin) {
  if (!MANAGER_PIN) {
    const err = new Error("Time clock manager PIN is not configured.");
    err.status = 503;
    throw err;
  }

  if (String(pin || "").trim() !== MANAGER_PIN) {
    const err = new Error("Manager PIN required.");
    err.status = 401;
    throw err;
  }
}

function getManagerPinFromRequest(req, body = {}) {
  return (
    req.headers?.["x-delish-manager-pin"] ||
    req.headers?.["x-manager-pin"] ||
    body.managerPin ||
    ""
  );
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function shiftsToCsv(shifts) {
  const header = [
    "Employee",
    "Date",
    "Clock In",
    "Clock Out",
    "Minutes",
    "Hours",
    "Clock In Device",
    "Clock Out Device"
  ];

  const rows = (shifts || []).map(shift => [
    shift.name,
    shift.dateCentral,
    shift.clockInAt,
    shift.clockOutAt,
    shift.durationMinutes,
    shift.durationHours,
    shift.clockInDevice,
    shift.clockOutDevice
  ]);

  return [header, ...rows].map(row => row.map(csvCell).join(",")).join("\n");
}

async function sendCsv(req, res, body = {}) {
  requireManager(getManagerPinFromRequest(req, body));

  const date = String(body.date || req.query?.date || "").trim();
  const shifts = filterShiftsByDate(await getShifts(), date);
  const csv = shiftsToCsv(shifts);
  const suffix = date || "all";

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="delish-timeclock-${suffix}.csv"`);
  return res.status(200).send(csv);
}

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      if (String(req.query?.mode || "") === "csv") {
        return sendCsv(req, res);
      }

      if (String(req.query?.mode || "") === "admin") {
        requireManager(getManagerPinFromRequest(req));
        return send(res, 200, await buildState(String(req.query?.date || "").trim()));
      }

      return send(res, 200, await buildPublicState());
    }

    if (req.method !== "POST") {
      res.setHeader("Allow", "GET,POST");
      return send(res, 405, { ok: false, error: "Method not allowed." });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const action = String(body.action || "").trim();

    if (action === "export_csv") {
      return sendCsv(req, res, body);
    }

    if (action === "clock_in") {
      const pin = String(body.pin || "").trim();
      const device = normalizeDevice(body.device);

      if (!pin) {
        return send(res, 400, { ok: false, error: "Employee number required." });
      }

      const employees = await getEmployees();
      const employee = body.name
        ? findEmployeeByName(employees, body.name)
        : findEmployeeByPin(employees, pin);
      const name = normalizeEmployeeName(employee?.name || body.name);

      if (!employee || String(employee.pin || "") !== pin) {
        return send(res, 401, { ok: false, error: "Employee number not found." });
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
        clockInAt: timestamp,
        clockInDevice: device
      };

      activeMap[name] = shift;
      await setActiveMap(activeMap);
      await pushPunch({ name, action: "clock_in", timestamp, device });
      await logTimeclockEvent("clock_in", shift.id, {
        shift,
        employeeName: name,
        timestamp,
        device,
      });

      return send(res, 200, {
        ...(await buildPublicState()),
        message: `${name} clocked in.`
      });
    }

    if (action === "clock_out") {
      const pin = String(body.pin || "").trim();
      const device = normalizeDevice(body.device);

      if (!pin) {
        return send(res, 400, { ok: false, error: "Employee number required." });
      }

      const employees = await getEmployees();
      const employee = body.name
        ? findEmployeeByName(employees, body.name)
        : findEmployeeByPin(employees, pin);
      const name = normalizeEmployeeName(employee?.name || body.name);

      if (!employee || String(employee.pin || "") !== pin) {
        return send(res, 401, { ok: false, error: "Employee number not found." });
      }

      const activeMap = await getActiveMap();
      const current = activeMap[name];

      if (!current) {
        return send(res, 409, { ok: false, error: "Not clocked in." });
      }

      const timestamp = nowIso();
      const completed = {
        ...buildShiftUpdate(current, current.clockInAt, timestamp),
        clockOutDevice: device
      };

      delete activeMap[name];

      await setActiveMap(activeMap);
      await pushPunch({ name, action: "clock_out", timestamp, device });
      await pushCompletedShift(completed);
      const payrollTurnIn = await maybeTurnInPayroll(timestamp, activeMap);
      await logTimeclockEvent("clock_out", completed.id, {
        shift: completed,
        employeeName: name,
        timestamp,
        device,
      });

      if (payrollTurnIn) {
        await logTimeclockEvent("payroll_turned_in", payrollTurnIn.id, {
          payrollTurnIn,
        });
      }

      return send(res, 200, {
        ...(await buildPublicState()),
        message: `${name} clocked out.`,
        shift: completed,
        payrollTurnIn
      });
    }

    if (action === "lookup_employee") {
      const pin = String(body.pin || "").trim();
      if (!pin) {
        return send(res, 400, { ok: false, error: "Employee number required." });
      }

      const employees = await getEmployees();
      const employee = findEmployeeByPin(employees, pin);

      if (!employee) {
        return send(res, 404, { ok: false, error: "Employee number not found." });
      }

      const name = normalizeEmployeeName(employee.name);
      const activeMap = await getActiveMap();

      return send(res, 200, {
        ok: true,
        employee: {
          name,
          clockedIn: !!activeMap[name]
        }
      });
    }

    if (action === "add_employee") {
      requireManager(body.managerPin);

      const name = normalizeEmployeeName(body.name);
      const pin = String(body.pin || "").trim();

      if (!name) {
        return send(res, 400, { ok: false, error: "Employee name required." });
      }

      if (!/^\d{4,8}$/.test(pin)) {
        return send(res, 400, { ok: false, error: "PIN must be 4-8 digits." });
      }

      const employees = await getEmployees();

      if (findEmployeeByName(employees, name)) {
        return send(res, 409, { ok: false, error: "Employee exists." });
      }

      if (employees.some(e => String(e.pin || "") === pin)) {
        return send(res, 409, { ok: false, error: "PIN in use." });
      }

      await setEmployees([...employees, { name, pin }]);
      await logTimeclockEvent("employee_added", name, {
        employeeName: name,
      });

      return send(res, 200, await buildState());
    }

    if (action === "delete_employee") {
      requireManager(body.managerPin);

      const name = normalizeEmployeeName(body.name);
      const employees = await getEmployees();
      const activeMap = await getActiveMap();

      if (activeMap[name]) {
        return send(res, 409, { ok: false, error: "Employee is currently clocked in." });
      }

      await setEmployees(employees.filter(e =>
        normalizeEmployeeName(e?.name || e).toLowerCase() !== name.toLowerCase()
      ));
      await logTimeclockEvent("employee_removed", name, {
        employeeName: name,
      });

      return send(res, 200, await buildState());
    }

    if (action === "edit_shift") {
      requireManager(body.managerPin);

      const id = String(body.id || "").trim();
      const clockInAt = String(body.clockInAt || "").trim();
      const clockOutAt = String(body.clockOutAt || "").trim();

      if (!id || !clockInAt || !clockOutAt) {
        return send(res, 400, { ok: false, error: "Shift, clock in, and clock out are required." });
      }

      if (new Date(clockOutAt).getTime() < new Date(clockInAt).getTime()) {
        return send(res, 400, { ok: false, error: "Clock out must be after clock in." });
      }

      const shifts = await getShifts();
      const index = shifts.findIndex(shift => shift.id === id);

      if (index === -1) {
        return send(res, 404, { ok: false, error: "Shift not found." });
      }

      const previousShift = shifts[index];
      shifts[index] = buildShiftUpdate(previousShift, clockInAt, clockOutAt);
      await setShifts(shifts);
      await logTimeclockEvent("shift_edited", id, {
        previousShift,
        updatedShift: shifts[index],
      });

      return send(res, 200, await buildState(String(body.date || "").trim()));
    }

    if (action === "delete_shift") {
      requireManager(body.managerPin);

      const id = String(body.id || "").trim();
      const shifts = await getShifts();
      const updated = shifts.filter(shift => shift.id !== id);

      if (updated.length === shifts.length) {
        return send(res, 404, { ok: false, error: "Shift not found." });
      }

      await setShifts(updated);
      await logTimeclockEvent("shift_deleted", id, {
        shift: shifts.find(shift => shift.id === id) || null,
      });

      return send(res, 200, await buildState(String(body.date || "").trim()));
    }

    return send(res, 400, { ok: false, error: "Invalid action." });
  } catch (err) {
    console.error("DELISH TIMECLOCK ERROR:", err);
    return send(res, err.status || 500, {
      ok: false,
      error: publicError(err)
    });
  }
}
