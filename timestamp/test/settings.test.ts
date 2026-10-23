import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFormatter, DEFAULTS, loadSettings, saveSettings, validateSettings } from "../settings.ts";

test("full date/seconds/offset, IANA date rollover, DST overlap and midnight", () => {
  const la = createFormatter({ ...DEFAULTS, timeZone: "America/Los_Angeles" });
  assert.equal(la(Date.parse("2026-11-01T08:30Z")), "2026-11-01 01:30:00 UTC-07:00");
  assert.equal(la(Date.parse("2026-11-01T09:30Z")), "2026-11-01 01:30:00 UTC-08:00");
  assert.equal(createFormatter({ ...DEFAULTS, timeZone: "Asia/Shanghai" })(Date.parse("2026-10-22T18:32:05Z")), "2026-10-23 02:32:05 UTC+08:00");
  assert.equal(createFormatter({ ...DEFAULTS, timeZone: "UTC" })(Date.parse("2026-10-22T00:00Z")), "2026-10-22 00:00:00 UTC+00:00");
  const local = createFormatter(DEFAULTS)(Date.parse("2026-10-22T18:32:05Z"));
  assert.equal(local, createFormatter({ ...DEFAULTS, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })(Date.parse("2026-10-22T18:32:05Z")));
});

test("named formats, fractional offsets and unknown timestamps", () => {
  const time = Date.parse("2026-10-22T00:00Z");
  assert.equal(createFormatter({ ...DEFAULTS, timeZone: "UTC", format: "time24" })(time), "00:00:00 UTC+00:00");
  assert.equal(createFormatter({ ...DEFAULTS, timeZone: "UTC", format: "datetime12" })(time), "2026-10-22 12:00:00 AM UTC+00:00");
  assert.equal(createFormatter({ ...DEFAULTS, timeZone: "Asia/Kathmandu" })(time), "2026-10-22 05:45:00 UTC+05:45");
  for (const bad of [undefined, null, "2026-10-22", NaN, Infinity, 9e20]) assert.equal(createFormatter(DEFAULTS)(bad), "Time unknown");
});

test("invalid config rejected before saving; corrupted file falls back without overwriting", () => {
  const dir = mkdtempSync(join(tmpdir(), "pi-timestamp-test-"));
  const path = join(dir, "timestamp.json");
  try {
    assert.deepEqual(loadSettings(path), { settings: DEFAULTS });
    saveSettings(path, { ...DEFAULTS, timeZone: "UTC" });
    assert.equal(statSync(path).mode & 0o777, 0o600);
    const previous = readFileSync(path, "utf8");
    for (const bad of [{ timeZone: "Mars/Olympus" }, { format: "invented" }, { enabled: "yes" }, null, []]) {
      assert.throws(() => validateSettings(bad));
    }
    assert.throws(() => saveSettings(path, { ...DEFAULTS, timeZone: "Mars/Olympus" }));
    assert.equal(readFileSync(path, "utf8"), previous);
    writeFileSync(path, "broken JSON");
    assert.deepEqual(loadSettings(path).settings, DEFAULTS);
    assert.ok(loadSettings(path).error);
    assert.equal(readFileSync(path, "utf8"), "broken JSON");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
