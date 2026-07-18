// Structured JSON logger for server-side code. Safe on the Cloudflare Worker
// runtime (console.* is captured into Server Logs).
//
// Usage:
//   const log = createLogger("scrape", { requestId });
//   log.info("fetched", { status: 200 });
//   log.error("resend failed", err, { attempt: 2 });
//
// Never log secrets or PII (email addresses, tokens, invite codes).

export type LogLevel = "debug" | "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

function serializeError(err: unknown): LogFields {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { message: String(err) };
}

function emit(level: LogLevel, scope: string, msg: string, base: LogFields, extra?: LogFields, err?: unknown) {
  const line: LogFields = {
    ts: new Date().toISOString(),
    level,
    scope,
    msg,
    ...base,
    ...(extra ?? {}),
    ...(err !== undefined ? { err: serializeError(err) } : {}),
  };
  const payload = JSON.stringify(line);
  if (level === "error") console.error(payload);
  else if (level === "warn") console.warn(payload);
  else console.log(payload);
}

export interface Logger {
  debug(msg: string, extra?: LogFields): void;
  info(msg: string, extra?: LogFields): void;
  warn(msg: string, extra?: LogFields): void;
  error(msg: string, err?: unknown, extra?: LogFields): void;
  child(extra: LogFields): Logger;
}

export function createLogger(scope: string, base: LogFields = {}): Logger {
  return {
    debug: (msg, extra) => emit("debug", scope, msg, base, extra),
    info: (msg, extra) => emit("info", scope, msg, base, extra),
    warn: (msg, extra) => emit("warn", scope, msg, base, extra),
    error: (msg, err, extra) => emit("error", scope, msg, base, extra, err),
    child: (extra) => createLogger(scope, { ...base, ...extra }),
  };
}

export function newRequestId(): string {
  return crypto.randomUUID().slice(0, 8);
}