// Structured error capture for server-side routes.
// Logs JSON to stdout (Vercel picks this up in Log Drain / Functions logs).
// If ERROR_WEBHOOK_URL is set, also POSTs a summary to a Slack-compatible webhook.
// To add Sentry later: npm install @sentry/nextjs, init it, then call
// Sentry.captureException(err) inside this function.

export function captureError(
  err: unknown,
  context: {
    route: string;
    shopSlug?: string;
    userId?: string;
    extra?: Record<string, unknown>;
  }
): void {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;

  const payload = {
    level: "error",
    route: context.route,
    message,
    stack,
    shopSlug: context.shopSlug,
    userId: context.userId,
    extra: context.extra,
    timestamp: new Date().toISOString(),
  };

  console.error(JSON.stringify(payload));

  const webhookUrl = process.env.ERROR_WEBHOOK_URL;
  if (webhookUrl) {
    const text = [
      `*[${context.route}]* ${message}`,
      context.shopSlug ? `Shop: \`${context.shopSlug}\`` : null,
      context.extra ? `\`\`\`${JSON.stringify(context.extra, null, 2)}\`\`\`` : null,
    ].filter(Boolean).join("\n");

    fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }).catch(() => {});
  }
}
