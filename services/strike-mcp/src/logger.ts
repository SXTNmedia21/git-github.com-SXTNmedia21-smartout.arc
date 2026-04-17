type Level = "info" | "warn" | "error";

type Fields = Record<string, string | number | boolean | null | undefined>;

export interface Logger {
  info(message: string, fields?: Fields): void;
  warn(message: string, fields?: Fields): void;
  error(message: string, fields?: Fields): void;
}

function formatFields(fields?: Fields): string {
  if (!fields) return "";
  const parts: string[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string") {
      parts.push(`${key}="${value.replace(/"/g, '\\"')}"`);
    } else {
      parts.push(`${key}=${value}`);
    }
  }
  return parts.length ? " " + parts.join(" ") : "";
}

function write(level: Level, scope: string, message: string, fields?: Fields): void {
  const timestamp = new Date().toISOString();
  const line = `${timestamp} ${level.toUpperCase()} [${scope}] ${message}${formatFields(fields)}\n`;
  process.stderr.write(line);
}

export function createLogger(scope: string): Logger {
  return {
    info: (message, fields) => write("info", scope, message, fields),
    warn: (message, fields) => write("warn", scope, message, fields),
    error: (message, fields) => write("error", scope, message, fields),
  };
}
