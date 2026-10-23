"""Real Pi PTY smoke test. Usage: python3 terminal-smoke.py /absolute/proof-dir

Requires an existing `pi` on PATH. Writes only synthetic sessions under proof-dir.
"""
import codecs
import fcntl
import json
import os
from pathlib import Path
import pty
import re
import select
import struct
import subprocess
import sys
import termios
import time
import unicodedata

ROOT = Path(__file__).resolve().parents[1]
PROOF = Path(sys.argv[1]).resolve()
PROOF.mkdir(parents=True, exist_ok=True)
assert not (PROOF / "audit.jsonl").exists(), "Use a fresh proof directory"
AGENT = PROOF / "agent"
AGENT.mkdir(exist_ok=True)
(AGENT / "settings.json").write_text(json.dumps({"quietStartup": True, "showCacheMissNotices": False,
    "showTerminalProgress": False, "retry": {"enabled": False}}))
SESSION = PROOF / "session.jsonl"
AUDIT = PROOF / "audit.jsonl"
STAMP = re.compile(r"\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC[+-]\d{2}:\d{2}")


class Screen:
    """Small VT screen reader for assertions, not a product renderer."""
    def __init__(self, columns=100, rows=40):
        self.columns, self.rows = columns, rows
        self.cells = [[" "] * columns for _ in range(rows)]
        self.x = self.y = 0
        self.pending = ""
        self.saved = (0, 0)

    def newline(self):
        self.y += 1
        if self.y >= self.rows:
            self.cells.pop(0)
            self.cells.append([" "] * self.columns)
            self.y = self.rows - 1

    def feed(self, value):
        self.pending += value
        while self.pending:
            c = self.pending[0]
            if c == "\x1b":
                if len(self.pending) < 2:
                    return
                if self.pending[1] == "]":
                    match = re.match(r"\x1b\][\s\S]*?(?:\x07|\x1b\\)", self.pending)
                    if not match:
                        return
                elif self.pending[1] == "[":
                    match = re.match(r"\x1b\[([0-?]*)([ -/]*)([@-~])", self.pending)
                    if not match:
                        return
                    self.csi(match[1], match[3])
                else:
                    match = re.match(r"\x1b.", self.pending)
                    if self.pending[1] == "7": self.saved = (self.x, self.y)
                    if self.pending[1] == "8": self.x, self.y = self.saved
                self.pending = self.pending[len(match[0]):]
                continue
            self.pending = self.pending[1:]
            if c == "\r": self.x = 0
            elif c == "\n": self.newline()
            elif c == "\b": self.x = max(0, self.x - 1)
            elif c == "\t": self.x = min(self.columns - 1, (self.x // 8 + 1) * 8)
            elif c >= " " and not unicodedata.combining(c):
                if self.x >= self.columns:
                    self.x = 0
                    self.newline()
                self.cells[self.y][self.x] = c
                self.x += 1
                if unicodedata.east_asian_width(c) in ("W", "F") and self.x < self.columns:
                    self.cells[self.y][self.x] = " "
                    self.x += 1

    def csi(self, raw, command):
        if any(c in raw for c in "?<>="):
            return
        values = [int(x or 0) for x in raw.split(";")]
        n = values[0] or 1
        if command in "Hf":
            self.y = min(self.rows - 1, max(0, n - 1))
            self.x = min(self.columns - 1, max(0, (values[1] or 1) - 1)) if len(values) > 1 else 0
        elif command == "A": self.y = max(0, self.y - n)
        elif command in "Be": self.y = min(self.rows - 1, self.y + n)
        elif command in "Ca": self.x = min(self.columns - 1, self.x + n)
        elif command == "D": self.x = max(0, self.x - n)
        elif command in "G`": self.x = min(self.columns - 1, n - 1)
        elif command == "d": self.y = min(self.rows - 1, n - 1)
        elif command == "J":
            if values[0] in (2, 3): self.cells = [[" "] * self.columns for _ in range(self.rows)]
            elif values[0] == 0:
                self.cells[self.y][self.x:] = [" "] * (self.columns - self.x)
                for y in range(self.y + 1, self.rows): self.cells[y] = [" "] * self.columns
        elif command == "K":
            if values[0] == 2: self.cells[self.y] = [" "] * self.columns
            elif values[0] == 1: self.cells[self.y][:self.x + 1] = [" "] * (self.x + 1)
            else: self.cells[self.y][self.x:] = [" "] * (self.columns - self.x)
        elif command == "s": self.saved = (self.x, self.y)
        elif command == "u": self.x, self.y = self.saved

    def text(self):
        return "\n".join("".join(row).rstrip() for row in self.cells)


class Terminal:
    def __init__(self, name):
        self.name = name
        self.master, slave = pty.openpty()
        fcntl.ioctl(slave, termios.TIOCSWINSZ, struct.pack("HHHH", 40, 100, 0, 0))
        environment = {k: os.environ[k] for k in ("PATH", "HOME", "LANG", "TZ") if k in os.environ}
        environment.update(TERM="xterm-256color", COLORTERM="truecolor", PI_OFFLINE="1", PI_TELEMETRY="0",
            PI_CODING_AGENT_DIR=str(AGENT), TIMESTAMP_TEST_AUDIT=str(AUDIT), JITI_FS_CACHE="false")
        self.process = subprocess.Popen(["pi", "--offline", "--no-extensions", "--no-mcp", "--no-skills",
            "--no-prompt-templates", "--no-themes", "--no-context-files", "--no-tools", "--approve",
            "--tui-mode", "regular", "--provider", "timestamp-fixture", "--model", "demo",
            "--session", str(SESSION), "-e", str(ROOT / "index.ts"),
            "-e", str(ROOT / "test/synthetic-provider.ts")], cwd=PROOF, env=environment,
            stdin=slave, stdout=slave, stderr=slave, start_new_session=True)
        os.close(slave)
        self.screen = Screen()
        self.decoder = codecs.getincrementaldecoder("utf-8")("replace")
        self.recording = open(PROOF / (name + ".ansi"), "wb")

    def pump(self, seconds=0.2):
        deadline = time.monotonic() + seconds
        while time.monotonic() < deadline:
            if select.select([self.master], [], [], min(0.1, max(0, deadline - time.monotonic())))[0]:
                try: data = os.read(self.master, 65536)
                except OSError: return
                if not data: return
                self.recording.write(data)
                self.recording.flush()
                text = self.decoder.decode(data)
                self.screen.feed(text)
                if "\x1b[6n" in text:
                    os.write(self.master, f"\x1b[{self.screen.y + 1};{self.screen.x + 1}R".encode())

    def wait(self, condition, label, timeout=20):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            self.pump()
            if condition():
                self.pump(0.2)
                return
            if self.process.poll() is not None:
                break
        self.snapshot("failure")
        raise AssertionError(f"Timeout/process exit waiting for {label}:\n{self.screen.text()}")

    def send(self, command):
        os.write(self.master, (command + "\r").encode())

    def snapshot(self, label):
        path = PROOF / f"{self.name}-{label}.txt"
        path.write_text(self.screen.text() + "\n")
        return self.screen.text()

    def close(self):
        self.send("/quit")
        for _ in range(20):
            self.pump(0.1)
            if self.process.poll() is not None: break
        if self.process.poll() is None:
            self.process.terminate()
        self.process.wait(timeout=5)
        self.recording.close()
        os.close(self.master)


def events():
    return [json.loads(line) for line in AUDIT.read_text().splitlines()] if AUDIT.exists() else []


def entries():
    return [json.loads(line) for line in SESSION.read_text().splitlines()] if SESSION.exists() else []


def header_count():
    return sum(e.get("type") == "custom" and e.get("customType") == "pi-message-timestamp" for e in entries())


def check_positions(text, expected=2):
    times = list(STAMP.finditer(text))
    assert len(times) == expected, (len(times), text)
    assert times[0].start() < text.index("Synthetic timestamp question")
    assert times[1].start() < text.index("Synthetic streaming")


terminal = Terminal("live")
try:
    terminal.wait(lambda: any(e["type"] == "session_start" for e in events()), "TUI initialization")
    terminal.send("Synthetic timestamp question")
    terminal.wait(lambda: any(e["type"] == "delta" for e in events()), "streaming first delta")
    text = terminal.snapshot("streaming")
    check_positions(text)
    assert "complete." not in text
    terminal.wait(lambda: any(e["type"] == "message_end" and e["role"] == "assistant" for e in events()), "reply complete")
    text = terminal.snapshot("complete")
    check_positions(text)
    assert "Synthetic streaming reply complete." in text
    assert header_count() == 2
    initial = entries()
    starts = sum(e["type"] == "session_start" for e in events())
    terminal.send("/reload")
    terminal.wait(lambda: sum(e["type"] == "session_start" for e in events()) > starts, "actual reload")
    terminal.pump(0.5)
    check_positions(terminal.snapshot("reload"))
    assert header_count() == 2
    terminal.send("/timestamp timezone Asia/Shanghai")
    terminal.wait(lambda: (AGENT / "timestamp.json").exists(), "zone save")
    terminal.wait(lambda: "2026-10-23 02:32:09 UTC+08:00" in terminal.screen.text(), "zone redraw")
    check_positions(terminal.snapshot("shanghai"))
    assert header_count() == 2
    terminal.send("/timestamp timezone Mars/Olympus")
    terminal.wait(lambda: "Timestamp settings unchanged" in terminal.screen.text(), "invalid timezone rejection")
    assert json.loads((AGENT / "timestamp.json").read_text())["timeZone"] == "Asia/Shanghai"
    terminal.snapshot("invalid-zone")
finally:
    terminal.close()

resumed = Terminal("resume")
try:
    resumed.wait(lambda: "Synthetic streaming reply complete." in resumed.screen.text(), "disk session resume")
    text = resumed.snapshot("complete")
    check_positions(text)
    assert "2026-10-23 02:32:09 UTC+08:00" in text
    assert [e for e in entries() if e["type"] in ("custom", "message")] == [e for e in initial if e["type"] in ("custom", "message")]
    resumed.send("/timestamp format time24")
    resumed.wait(lambda: "02:32:09 UTC+08:00" in resumed.screen.text() and "2026-10-23 02:32:09" not in resumed.screen.text(), "compact format redraw")
    resumed.snapshot("time24")
    resumed.send("/timestamp off")
    resumed.wait(lambda: "02:32:09 UTC+08:00" not in resumed.screen.text(), "off hides stored headers")
    resumed.snapshot("off")
    resumed.send("/timestamp on")
    resumed.wait(lambda: "02:32:09 UTC+08:00" in resumed.screen.text(), "on restores stored headers")
    resumed.snapshot("on")
    assert header_count() == 2
finally:
    resumed.close()

all_entries = entries()
messages = [e["message"] for e in all_entries if e["type"] == "message" and e["message"]["role"] in ("user", "assistant")]
times = [e["data"]["timestamp"] for e in all_entries if e.get("customType") == "pi-message-timestamp"]
assert [m["timestamp"] for m in messages] == times
assert len(messages) == 2 and len(times) == 2
contexts = [e for e in events() if e["type"] == "context"]
assert len(contexts) == 1
assert all(m.get("role") in ("system", "user") for m in contexts[0]["messages"])
assert all("pi-message-timestamp" not in json.dumps(m) for m in contexts[0]["messages"])
result = {"result": "PASS", "scope": "Actual pi regular TUI in PTY, in-process synthetic provider, isolated config and disk session",
    "streamingAboveBoth": True, "reloadNoDuplicates": True, "diskResume": True, "zoneRedraw": True,
    "formatRedraw": True, "toggleRedraw": True, "invalidZoneRejected": True, "originalEpochsPreserved": True,
    "providerContextNoTimestamps": True, "metadataEntries": len(times), "messages": len(messages)}
(PROOF / "results.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result))
