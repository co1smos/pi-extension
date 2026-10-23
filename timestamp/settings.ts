import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const FORMATS = ["datetime24", "time24", "datetime12"] as const;
export type TimestampSettings = {
  enabled: boolean;
  timeZone: string;
  format: (typeof FORMATS)[number];
};
export const DEFAULTS: TimestampSettings = { enabled: true, timeZone: "local", format: "datetime24" };

export function validateSettings(value: unknown): TimestampSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected a settings object");
  const settings = { ...DEFAULTS, ...value } as TimestampSettings;
  if (typeof settings.enabled !== "boolean") throw new Error("enabled must be true or false");
  if (!FORMATS.includes(settings.format)) throw new Error(`format must be ${FORMATS.join(", ")}`);
  if (typeof settings.timeZone !== "string" || !settings.timeZone.trim()) throw new Error("Expected local or an IANA time zone");
  new Intl.DateTimeFormat("en-US", { timeZone: settings.timeZone === "local" ? undefined : settings.timeZone });
  return { enabled: settings.enabled, timeZone: settings.timeZone, format: settings.format };
}

export function loadSettings(path: string): { settings: TimestampSettings; error?: string } {
  try {
    return { settings: validateSettings(JSON.parse(readFileSync(path, "utf8"))) };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { settings: { ...DEFAULTS } };
    return { settings: { ...DEFAULTS }, error: `Cannot read timestamp settings: ${String(error)}` };
  }
}

export function saveSettings(path: string, value: TimestampSettings): void {
  const settings = validateSettings(value);
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = `${path}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, JSON.stringify(settings, null, 2) + "\n", { mode: 0o600, flag: "wx" });
    renameSync(temporary, path);
  } finally {
    try { unlinkSync(temporary); } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
}

export function createFormatter(settings: TimestampSettings): (timestamp: unknown) => string {
  const formatter = new Intl.DateTimeFormat("en-US-u-nu-latn", {
    timeZone: settings.timeZone === "local" ? undefined : settings.timeZone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    ...(settings.format === "datetime12" ? { hour12: true } : { hourCycle: "h23" as const }),
    timeZoneName: "longOffset",
  });
  return timestamp => {
    if (typeof timestamp !== "number" || !Number.isFinite(timestamp) || !Number.isFinite(new Date(timestamp).getTime()))
      return "Time unknown";
    const parts = Object.fromEntries(formatter.formatToParts(timestamp).map(part => [part.type, part.value]));
    const date = settings.format === "time24" ? "" : `${parts.year}-${parts.month}-${parts.day} `;
    const period = parts.dayPeriod ? ` ${parts.dayPeriod}` : "";
    const offset = parts.timeZoneName === "GMT" ? "UTC+00:00" : parts.timeZoneName.replace("GMT", "UTC");
    return `${date}${parts.hour}:${parts.minute}:${parts.second}${period} ${offset}`;
  };
}
