import { join } from "node:path";
import { getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { createFormatter, FORMATS, loadSettings, saveSettings, validateSettings } from "./settings.ts";

const ENTRY_TYPE = "pi-message-timestamp";
type TimestampData = { role: "user" | "assistant"; timestamp: number };

export default function timestampExtension(pi: ExtensionAPI) {
  const path = join(getAgentDir(), "timestamp.json");
  const loaded = loadSettings(path);
  const settings = loaded.settings;
  const format = createFormatter(settings);

  pi.on("session_start", (_event, ctx) => {
    if (loaded.error && ctx.mode === "tui") ctx.ui.notify(loaded.error + "; using defaults", "warning");
  });

  pi.on("message_start", (event, ctx) => {
    if (ctx.mode !== "tui" || !settings.enabled) return;
    const message = event.message;
    if (message.role === "user" || message.role === "assistant") {
      pi.appendEntry<TimestampData>(ENTRY_TYPE, { role: message.role, timestamp: message.timestamp });
    }
  });

  pi.registerEntryRenderer<TimestampData>(ENTRY_TYPE, (entry, _options, theme) => {
    if (!settings.enabled) return undefined;
    return new Text(theme.fg("dim", format(entry.data?.timestamp)), 1, 0);
  });

  pi.registerCommand("timestamp", {
    description: "Message timestamps: on/off, timezone <local|IANA>, format <datetime24|time24|datetime12>",
    handler: async (args, ctx) => {
      if (ctx.mode !== "tui") return;
      if (!ctx.isIdle()) {
        ctx.ui.notify("Wait for the current response to finish before changing timestamps", "warning");
        return;
      }
      const tokens = args.trim().split(/\s+/);
      let command = tokens.shift() ?? "";
      let value: string | undefined = tokens.shift();
      const extra = tokens;
      if (!command) {
        const choice = await ctx.ui.select("Timestamp", [settings.enabled ? "Disable" : "Enable", "Time zone", "Format"]);
        if (!choice) return;
        command = choice === "Time zone" ? "timezone" : choice === "Format" ? "format" : settings.enabled ? "off" : "on";
        if (command === "timezone") value = await ctx.ui.input("Time zone: local, UTC or IANA", settings.timeZone);
        if (command === "format") value = await ctx.ui.select("Timestamp format", [...FORMATS]);
        if ((command === "timezone" || command === "format") && !value) return;
      }
      const next = { ...settings };
      if (extra.length || ((command === "on" || command === "off") && value)) {
        ctx.ui.notify("Usage: /timestamp on|off|timezone <local|IANA>|format <datetime24|time24|datetime12>", "error");
        return;
      }
      if (command === "on" || command === "off") next.enabled = command === "on";
      else if (command === "timezone") next.timeZone = value ?? "";
      else if (command === "format") next.format = value as typeof next.format;
      else {
        ctx.ui.notify("Usage: /timestamp on|off|timezone <local|IANA>|format <datetime24|time24|datetime12>", "error");
        return;
      }
      try { saveSettings(path, validateSettings(next)); }
      catch (error) { ctx.ui.notify(`Timestamp settings unchanged: ${String(error)}`, "error"); return; }
      // Reload through Pi's supported command API to redraw stored entries as well.
      await ctx.reload();
    },
  });
}
