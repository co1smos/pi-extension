// Test fixture only: in-process synthetic stream, no HTTP client or service.
import { appendFileSync } from "node:fs";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";

export default function (pi: ExtensionAPI) {
  const audit = process.env.TIMESTAMP_TEST_AUDIT;
  if (!audit) throw new Error("synthetic-provider requires TIMESTAMP_TEST_AUDIT");
  const record = (event: unknown) => appendFileSync(audit, JSON.stringify(event) + "\n");
  pi.on("session_start", (_event, ctx) => record({ type: "session_start", mode: ctx.mode }));
  pi.on("message_start", event => record({ type: "message_start", role: event.message.role, timestamp: event.message.timestamp }));
  pi.on("message_end", event => record({ type: "message_end", role: event.message.role, timestamp: event.message.timestamp }));
  pi.registerProvider("timestamp-fixture", {
    api: "timestamp-fixture-api",
    baseUrl: "https://unused.invalid",
    apiKey: "synthetic-not-a-secret",
    models: [{ id: "demo", name: "Synthetic timestamp test", reasoning: false, input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 100000, maxTokens: 1000 }],
    streamSimple(model, context) {
      record({ type: "context", messages: context.messages });
      const stream = createAssistantMessageEventStream();
      const output: any = { role: "assistant", api: model.api, provider: model.provider, model: model.id,
        timestamp: Date.parse("2026-10-22T18:32:09Z"), content: [], stopReason: "stop",
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } };
      void (async () => {
        stream.push({ type: "start", partial: output });
        output.content.push({ type: "text", text: "" });
        stream.push({ type: "text_start", contentIndex: 0, partial: output });
        for (const delta of ["Synthetic streaming", " reply", " complete."]) {
          await new Promise(resolve => setTimeout(resolve, 600));
          output.content[0].text += delta;
          stream.push({ type: "text_delta", contentIndex: 0, delta, partial: output });
          record({ type: "delta", text: output.content[0].text });
        }
        stream.push({ type: "text_end", contentIndex: 0, content: output.content[0].text, partial: output });
        stream.push({ type: "done", reason: "stop", message: output });
        stream.end();
      })();
      return stream;
    },
  });
}
