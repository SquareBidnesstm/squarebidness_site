import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.DELISH_UPSTASH_REDIS_REST_URL,
  token: process.env.DELISH_UPSTASH_REDIS_REST_TOKEN,
});

export const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "sunday"];

export const DEFAULT_WEEKLY_MENU = {
  monday: [],
  tuesday: [],
  wednesday: [],
  thursday: [],
  friday: [],
  sunday: [],
  updatedAt: "",
};

export async function getDelishWeeklyMenu() {
  const saved = await redis.get("delish:menu:weekly");
  if (!saved || typeof saved !== "object") {
    return { ...DEFAULT_WEEKLY_MENU };
  }

  const result = { ...DEFAULT_WEEKLY_MENU };

  for (const day of DAYS) {
    const items = Array.isArray(saved[day]) ? saved[day] : [];
    result[day] = items
      .filter(item => item && item.name && Number(item.price) > 0)
      .map((item, i) => ({
        id: `weekly_${day}_${i}`,
        name: String(item.name || "").trim(),
        price: Number(item.price),
        desc: String(item.desc || "").trim(),
        sideSelectionRequired: item.sideSelectionRequired === true,
        baseOptions: [],
      }));
  }

  result.updatedAt = saved.updatedAt || "";
  return result;
}

export async function saveDelishWeeklyMenu(weeklyMenu) {
  const data = { ...DEFAULT_WEEKLY_MENU };

  for (const day of DAYS) {
    const items = Array.isArray(weeklyMenu[day]) ? weeklyMenu[day] : [];
    data[day] = items
      .map(item => {
        const price = Number(item?.price);
        return {
          name: String(item?.name || "").trim().slice(0, 80),
          price: Number.isFinite(price) && price >= 0 ? Math.round(price * 100) / 100 : 0,
          desc: String(item?.desc || "").trim().slice(0, 180),
          sideSelectionRequired: item?.sideSelectionRequired === true,
        };
      })
      .filter(item => item.name && item.price > 0);
  }

  data.updatedAt = new Date().toISOString();
  await redis.set("delish:menu:weekly", data);
  return data;
}
