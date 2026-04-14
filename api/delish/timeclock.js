export const config = {
  runtime: "nodejs"
};

const REDIS_URL = process.env.DELISH_UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.DELISH_UPSTASH_REDIS_REST_TOKEN;

// Fastest employee setup for v1.
// Replace these with real employee names + PINs.
const EMPLOYEES = [
  { name: "Qwnetta", pin: "1111" },
  { name: "Employee 2", pin: "2222" },
  { name: "Employee 3", pin: "3333" }
];

const TZ = "America/Chicago";
const ACTIVE_KEY = "delish:timeclock:active";
const PUNCHES_KEY = "delish:timeclock:punches";
const MAX_RECENT = 25;

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

function activeArrayFromMap(map) {
  return Object.values(map || {}).sort((a, b) => {
    return new Date(b.clockInAt).getTime() - new Date(a.clockInAt).getTime();
  });
}

function employeeNames() {
  return EMPLOYEES.map(emp => emp.name);
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    try {
      const activeMap = await getActiveMap();
      const recent = await getRecentPunches();

      return send(res, 200, {
        ok: true,
        timezone: TZ,
        employees: employeeNames(),
        active: activeArrayFromMap(activeMap),
        recent
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

    const updatedRecent = [punch, ...recent].slice(0, MAX_RECENT);

    return send(res, 200, {
      ok: true,
      message: `${employee.name} clocked out successfully.`,
      active: activeArrayFromMap(activeMap),
      recent: updatedRecent
    });
  } catch (err) {
    return send(res, 500, {
      ok: false,
      error: err.message || "Unable to save time punch."
    });
  }
}
