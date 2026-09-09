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

// Scoped auth for staff who should only reach order lookup + refunds —
// accepts either the full operator token or the narrower refund token.
export function requireDelishRefundAuth(req, res) {
  const operatorToken = String(process.env.DELISH_OPERATOR_TOKEN || "").trim();
  const refundToken = String(process.env.DELISH_REFUND_TOKEN || "").trim();

  if (!operatorToken && !refundToken) {
    res.status(503).json({
      ok: false,
      error: "No operator or refund token is configured.",
    });
    return false;
  }

  const provided = getDelishOperatorToken(req);
  const isValid =
    (operatorToken && provided === operatorToken) ||
    (refundToken && provided === refundToken);

  if (!isValid) {
    res.status(401).json({
      ok: false,
      error: "Unauthorized.",
    });
    return false;
  }

  return true;
}
