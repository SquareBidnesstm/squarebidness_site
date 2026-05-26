// Re-export checkRateLimit from utils so both import paths work.
// utils.ts has the full Upstash Redis + in-memory fallback implementation.
export { checkRateLimit } from "./utils";
