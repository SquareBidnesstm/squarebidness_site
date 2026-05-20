function getHeaderValue(value) {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

export function getDelishOperatorToken(req) {
  return String(
    getHeaderValue(req.headers["x-operator-token"]) ||
      getHeaderValue(req.headers["x-delish-operator-token"]) ||
      ""
  ).trim();
}

export function requireDelishOperatorAuth(req, res) {
  const expectedToken = String(process.env.DELISH_OPERATOR_TOKEN || "").trim();

  if (!expectedToken) {
    res.status(503).json({
      ok: false,
      error: "DELISH_OPERATOR_TOKEN is not configured.",
    });
    return false;
  }

  if (getDelishOperatorToken(req) !== expectedToken) {
    res.status(401).json({
      ok: false,
      error: "Unauthorized.",
    });
    return false;
  }

  return true;
}
