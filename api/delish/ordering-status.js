// FILE: /api/delish/ordering-status.js

import { getDelishOrderingState, DELISH_ORDERING_MODE } from "../_lib/delish-ordering-config.js";

export default async function handler(req, res) {
  try {
    const fallbackState = getDelishOrderingState();

    const redisUrl = process.env.DELISH_UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.DELISH_UPSTASH_REDIS_REST_TOKEN;

    if (!redisUrl || !redisToken) {
      return res.status(200).json({
        ok: true,
        orderingMode: DELISH_ORDERING_MODE,
        message: buildAutoMessage(fallbackState),
        ...fallbackState
      });
    }

    const [modeRes, resumeRes, messageRes] = await Promise.all([
      redisGet(redisUrl, redisToken, "delish:ordering:mode"),
      redisGet(redisUrl, redisToken, "delish:ordering:resume_at"),
      redisGet(redisUrl, redisToken, "delish:ordering:message")
    ]);

    const redisMode = normalizeMode(modeRes);
    const resumeAt = typeof resumeRes === "string" ? resumeRes : "";
    const message = typeof messageRes === "string" ? messageRes : "";

    if (!redisMode) {
      return res.status(200).json({
        ok: true,
        orderingMode: DELISH_ORDERING_MODE,
        message: buildAutoMessage(fallbackState),
        ...fallbackState
      });
    }

    if (redisMode === "open") {
      return res.status(200).json({
        ok: true,
        orderingMode: "open",
        mode: "open",
        today: fallbackState.today,
        now: fallbackState.now,
        openNow: true,
        reason: "manual_open",
        openTime: fallbackState.openTime || "11:00 AM",
        closeTime: fallbackState.closeTime || "3:00 PM",
        resumeAt: "",
        message: ""
      });
    }

    if (redisMode === "closed") {
      return res.status(200).json({
        ok: true,
        orderingMode: "closed",
        mode: "closed",
        today: fallbackState.today,
        now: fallbackState.now,
        openNow: false,
        reason: "manual_closed",
        openTime: fallbackState.openTime || "11:00 AM",
        closeTime: fallbackState.closeTime || "3:00 PM",
        resumeAt: "",
        message: message || "Online ordering is closed for today."
      });
    }

    if (redisMode === "paused") {
      const now = new Date();
      const resumeDate = resumeAt ? new Date(resumeAt) : null;
      const resumeValid = resumeDate && !Number.isNaN(resumeDate.getTime());

      if (resumeValid && now >= resumeDate) {
        return res.status(200).json({
          ok: true,
          orderingMode: "auto",
          message: buildAutoMessage(fallbackState),
          ...fallbackState
        });
      }

      return res.status(200).json({
        ok: true,
        orderingMode: "paused",
        mode: "paused",
        today: fallbackState.today,
        now: fallbackState.now,
        openNow: false,
        reason: "manual_closed",
        openTime: fallbackState.openTime || "11:00 AM",
        closeTime: fallbackState.closeTime || "3:00 PM",
        resumeAt,
        message: message || "We’re serving current orders now. Online ordering will reopen shortly."
      });
    }

    return res.status(200).json({
      ok: true,
      orderingMode: "auto",
      message: buildAutoMessage(fallbackState),
      ...fallbackState
    });
  } catch (error) {
    console.error("DELISH ORDERING STATUS ERROR:", error);
    return res.status(500).json({
      ok: false,
      error: "Failed to load ordering status."
    });
  }
}

function normalizeMode(value) {
  const mode = String(value || "").toLowerCase().trim();
  if (["auto", "open", "paused", "closed"].includes(mode)) return mode;
  return "";
}

function buildAutoMessage(state) {
  if (!state) return "";

  if (state.openNow) {
    return "";
  }

  if (state.reason === "outside_service_window") {
    const nextDay = getNextServiceDayLabel(state.today);
    return `Online ordering is closed for tonight. Ordering resumes ${nextDay} at ${state.openTime || "11:00 AM"}.`;
  }

  if (state.reason === "not_a_service_day") {
    const nextDay = getNextServiceDayLabel(state.today);
    return `Online ordering is closed today. Ordering resumes ${nextDay} at ${state.openTime || "11:00 AM"}.`;
  }

  if (state.reason === "sunday_not_scheduled") {
    return "Sunday ordering is only available on the 1st and 3rd Sundays.";
  }

  return "";
}

function getNextServiceDayLabel(today) {
  const order = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  const serviceDays = new Set(["monday", "tuesday", "wednesday", "thursday", "friday", "sunday"]);
  const labels = {
    monday: "Monday",
    tuesday: "Tuesday",
    wednesday: "Wednesday",
    thursday: "Thursday",
    friday: "Friday",
    saturday: "Saturday",
    sunday: "Sunday"
  };

  const startIndex = Math.max(order.indexOf(String(today || "").toLowerCase()), 0);

  for (let i = 1; i <= 7; i++) {
    const day = order[(startIndex + i) % 7];
    if (serviceDays.has(day)) {
      return labels[day];
    }
  }

  return "Monday";
}

async function redisGet(redisUrl, redisToken, key) {
  const url = `${redisUrl.replace(/\/$/, "")}/get/${encodeURIComponent(key)}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${redisToken}`
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Redis GET failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  return data?.result ?? null;
}
