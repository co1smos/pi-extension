# Timestamp research evidence — archived Phase 1

**Current implementation status:** The demonstrated layout was accepted for implementation. Actual product code and real regular-TUI streaming/reload/disk-resume checks are now complete; see [validation.md](validation.md). The following is the retained pre-implementation research record. Its NOT RUN statements describe that earlier point, not the current tested scope.

Research dated 2026-10-22. **Extension-only above-message display is feasible with the reference custom-entry mechanism.** The earlier native-header/history blocker is withdrawn. A small actual extension and the unchanged reference were loaded only in an isolated synthetic harness. No installed files, active sessions, settings, credentials or providers were changed or used.

## Versions and primary sources

- Installed `pi --version`: **1.3.0**. Executable resolves to `<pi-package>/dist/bundle/cli.js`.
- Installed package directory (abbreviated **P** below): `<pi-package>`.
- Upstream release `v1.3.0` resolves via `gh-axi api repos/earendil-works/pi/git/ref/tags/v1.3.0` to commit **71023aec1546d6d677a65669c5665c0927ce0dd0**. Installed distribution inspected directly; this tag pin supplies stable source links, not a claim that installed files were independently rebuilt from it.
- Reference timestamp-pi 0.3.0, selected path's latest commit **4db7ab6ca6ca7214c72c26fbca6bec64211bd379**. [README](https://github.com/luongnv89/pi-extensions/blob/4db7ab6ca6ca7214c72c26fbca6bec64211bd379/extensions/timestamp-pi/README.md), [implementation](https://github.com/luongnv89/pi-extensions/blob/4db7ab6ca6ca7214c72c26fbca6bec64211bd379/extensions/timestamp-pi/src/index.ts), [preferences](https://github.com/luongnv89/pi-extensions/blob/4db7ab6ca6ca7214c72c26fbca6bec64211bd379/extensions/timestamp-pi/src/preferences.ts), [manifest](https://github.com/luongnv89/pi-extensions/blob/4db7ab6ca6ca7214c72c26fbca6bec64211bd379/extensions/timestamp-pi/package.json), [MIT license](https://github.com/luongnv89/pi-extensions/blob/4db7ab6ca6ca7214c72c26fbca6bec64211bd379/LICENSE).


The reference package is 0.3.0 and declares host/TUI peers `^0.84.2`, which excludes installed 1.3.0. We did not install it or claim complete compatibility; its actual factory and message handlers were exercised on 1.3.0 below. MIT, Copyright (c) 2024 luongnv89; source is retained only in the disposable research directory. No reference source/screenshot is exported into product assets.

## Documents read in full

Under P/docs: `extensions.md` (277 lines), `packages.md` (129), `tui.md` (125), `sessions.md` (66), `session-format.md` (293), `message-types.md`, `settings.md` (172), `configuration.md`, `themes.md` (138), `sdk.md`. Followed relevant cross-references to actual exported types and renderer/session/provider source. Unrelated provider/OAuth/tool-concurrency cross-references were outside this feature's scope.

Supported examples inspected: `examples/extensions/entry-renderer.ts`, `message-renderer.ts`, `send-user-message.ts`, plus `examples/sdk/06-extensions.ts` and `02-custom-model.ts`. These were read, not loaded.

## Minimal mechanism and source evidence

| Claim | Installed/reference evidence |
|---|---|
| Reference already has the required extension mechanism | Reference `src/index.ts:152–181`: on message_end, appendEntry for user/assistant; registerEntryRenderer returns Text. |
| Earlier insertion is supported | P/dist/core/agent-session.js:753 emits extension event before public UI listener; :911 constructs message_start extension event. |
| Appending metadata causes a UI entry event | P/dist/core/agent-session.js:2754 appends custom entry and emits entry_appended. |
| Native UI shows that custom entry | P/dist/modes/interactive/interactive-mode.js:2781 dispatches entry_appended; :3134 addCustomEntryToChat uses native CustomEntryComponent. |
| Native user/assistant rendering remains intact | Same interactive-mode.js:2827 handles message_start, :3190 native user, :3219 assistant; :3320 renderSessionEntries replays custom entries and messages. |
| Stream insertion explains reference behavior | interactive-mode.js:3144 puts an appended entry before active streamingComponent. This does not require a native header API. |
| Host owns spacing | P/dist/modes/interactive/components/custom-entry.js:64 adds Spacer; renderer returns plain Text. |
| Message metadata stays out of model context | P/dist/core/session-manager.js:282 buildSessionContext; custom entries are excluded; actual equality assertion passed. |
| Queue timestamp precedes visible delivery | P/dist/core/agent-session.js:1766–1789 creates steering/follow-up timestamp at enqueue. Source verified, queue command not run. |
| Assistant timestamp is a record time | P/node_modules/@earendil-works/pi-ai/dist/api/openai-responses.js:110–130 initializes a pending response; pi-agent-core/dist/agent-loop.js:260–335 emits start/update/end. Not completion time. |
| No documented built-in setting | Full P/docs/settings.md, display table around :94. |

MarkdownTransformer lacks message ID/time and is called per assistant block, but **that is not an extension feasibility blocker**: this design uses the same custom-entry API as the reference, not a Markdown transformer.

## Actual isolated extension demonstration

Command: `node research/extension-demo.mjs` (exit 0). The exploratory harness is retained privately by the maintainer; it is not part of this package. The product has its own reproducible terminal test.

The factory at lines 27–33 registers `message_start`, appends role/original timestamp for user/assistant, and renders dim `Text`. It uses **loadExtensionFromFactory + createExtensionRuntime + ExtensionRunner** from installed Pi. The unchanged downloaded reference is separately loaded through **loadExtensions**. No session_start timer, config command or preference write is invoked for the reference; its preference directory is isolated via process-local `PI_CODING_AGENT_DIR` inside the worktree. Jiti filesystem cache is disabled for the probe.

In-memory SessionManager is real. Dispatch uses the exact installed `_handleAgentEvent` body in a harness adapter (not a full AgentSession instance). UI calls installed `InteractiveMode.handleEvent`, `addCustomEntryToChat`, `addMessageToChat`, `renderSessionEntries`, `renderSessionItems` and native components. Footer, program status, pending-input display, cache/thinking notices and terminal refresh requests are stubbed. No prototype/installed-file mutation. This is **component/event integration evidence, not a full Pi TTY session**.

Synthetic inputs use timestamps `2026-10-22T18:32:05Z` and `18:32:09Z`, and the two text bodies in the image. No real transcript is read.

Observed assertions:

- User header precedes user body; assistant header precedes assistant body.
- Headers already exist at assistant start; two stream updates and message_end leave exactly two total.
- Branch order `custom,message,custom,message`.
- JSON-cloned persisted branch rendered by native replay equals live rows exactly.
- `buildSessionContext().messages` equals the original messages; content and epoch unchanged.
- Two identical user messages 500 ms apart retain two time entries.
- toolResult start does not create a new time entry.

Console result:

```json
{"result":"PASS","loadedCandidate":true,"loadedUnmodifiedReference":true,"branchOrder":["custom","message","custom","message"],"liveReplayEqual":true,"streamingHeaderCount":2,"identicalMessages500msApartHeaders":2,"modelContextUnchanged":true}
```

Full result and native rendered rows: [extension-demo-results.json](extension-demo-results.json). Image [timestamp-extension-demo.svg](images/timestamp-extension-demo.svg) converts captured ANSI rows to SVG and preserves host spacing. It is labelled **OFFLINE · SYNTHETIC · NOT INSTALLED**, not presented as a terminal screenshot.

### Reference comparison on this installed release

| Case | Unchanged reference on 1.3.0 harness | Proposed event change |
|---|---|---|
| user live | message_end appends time after already visible user body | message_start puts it before body. |
| assistant streaming | No timestamp until message_end | Timestamp already shown from start. |
| assistant completion | Host inserts new entry before existing streaming component | Already in place; end adds nothing. |
| replay | Reference user time moves above body because custom entry persisted before message | Live/replay ordering identical. |
| nearby same-role messages | Reference two-second heuristic suppresses second user marker in probe | No time-window dedup; each message event retains its own entry. |
| format | Local HH:mm:ss, relative age/role and cache extras | Approved full date/seconds/numeric offset; configurable IANA/presets. |

These are actual harness observations; full reference installation/TTY compatibility is not asserted. No need to modify Pi to address the requested placement.

## Timezone and earlier helper probes

Node v22.23.1, ICU 78.2, tzdata 2026a; resolved local zone America/Los_Angeles. Local means the Pi host time zone.

Actual formatter examples:

| Zone / instant | Output |
|---|---|
| local | 2026-10-22 11:32:05 UTC-07:00 |
| UTC | 2026-10-22 18:32:05 UTC+00:00 |
| Asia/Shanghai | 2026-10-23 02:32:05 UTC+08:00 |
| LA 2026-11-01T08:30Z | 2026-11-01 01:30:00 UTC-07:00 |
| LA 2026-11-01T09:30Z | 2026-11-01 01:30:00 UTC-08:00 |

`node research/probe.mjs` previously passed helper assertions for h23 midnight 00:00:00, invalid IANA RangeError, per-block transforms and event-before-persistence order. Full earlier output/theme tokens retained in [research-probes.json](research-probes.json). It did not load an extension; the newer demonstration above does.

## Limits, artifact QA and preservation

NOT RUN: full TTY, actual reload command, disk resume, fork/tree/compaction boundaries, config-triggered immediate redraw, light/fullscreen, narrow/wide terminal geometry, error/abort, empty/tool-only assistant behavior and copy/export. A metadata entry exists before content is known, so no claim is made that every empty/tool-only case has already been resolved. These are bounded acceptance items, not an impossibility claim. Pre-install history backfill was not requested.

Static SVG illustrations preserve the synthetic design and native-component demonstration. No browser geometry validation is claimed.

Before revising canonical artifacts, all nine prior file hashes matched their recorded artifact-manifest.json. Final manifest covers the updated named documents/images/proof JSON only. Scratch scripts and downloaded implementation remain isolated, not exported as runtime code.

GitHub reads used pinned `gh-axi api --full`. For package.json, a decoded JSON string was automatically reserialized by the CLI, yielding invalid local package text; corrected by fetching `.content` base64 and decoding bytes locally before successful reference loading. No installation workaround.

## Installed-source hashes

SHA-256, paths relative to P:

```text
83c3bb7619f590c213cc96a24216eb29a819a3ef6dc548607cc037ed276e8dc5  package.json
c5038d9410cfb13f5be391f46f13de338bc46ab4c9a7d064f7b962c0dc4a807c  dist/core/extensions/types.d.ts
d0b4545a5da7fe97aa699269e64e27b37ee2fb5b7985efb1c0a66fc3d1883b52  dist/core/agent-session.js
4679cdd21fb1d3868c3326eba60f3e3679e3847f06f5123f2a9f7d7efb6664e5  dist/modes/interactive/interactive-mode.js
44a356da552c9cf2ea619c61944cfb28f81b45f09b325f152c91a914bfce1bc0  dist/core/extensions/loader.js
0e659fb4338069d91c4d0a3b032b51bf8d179a99e6417bc3e39e59b672aaec76  dist/core/extensions/runner.js
```

Scratch harness SHA-256: `01893359419aad29ea34b1fe0187d2c3b783a0c7b619e542670dc712803518a8`.
