// FILE: /api/delish/ordering-status.js

import { getDelishOrderingState, DELISH_ORDERING_MODE } from "../_lib/delish-ordering-config.js";

export default async function handler(req, res) {
  try {
    const state = getDelishOrderingState();

    return res.status(200).json({
      ok: true,
      orderingMode: DELISH_ORDERING_MODE,
      ...state
    });
  } catch (error) {
    console.error("DELISH ORDERING STATUS ERROR:", error);
    return res.status(500).json({
      ok: false,
      error: "Failed to load ordering status."
    });
  }
}
