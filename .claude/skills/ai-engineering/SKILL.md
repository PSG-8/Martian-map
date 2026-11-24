---
name: ai-engineering
description: Use when building features powered by LLMs - chat assistants, extraction/classification, RAG over documents, tool-using agents, evaluation and prompt design. Covers architecture, safety, cost and testing. For exact Claude model IDs, pricing and SDK details use the claude-api skill or the official docs, never memory.
---

# AI engineering

Treat the model as an unreliable but powerful component: constrain its inputs, validate its outputs, measure it.

## Steps
1. **Define the task and a metric.** What goes in, what must come out, how you judge it (exact match, rubric, human rating). Collect 20–50 real examples before writing the prompt.
2. **Pick the simplest pattern that works:**
   - Single call with a clear prompt → most tasks.
   - Structured output (JSON schema / tool call) → anything code will read.
   - RAG → answers must cite your documents; chunk, embed, retrieve top-k, quote sources.
   - Agent with tools → only when steps are not known in advance; cap the number of steps.
3. **Model choice.** Start with the latest capable Claude model; move high-volume simple steps to a smaller one after evals pass. Get IDs from the `claude-api` skill (Claude Code) or the official model docs, never from memory.
4. **Prompt.** Role + task + constraints + output format + 2–3 examples. Put long documents first, the question last. Use prompt caching for repeated context.
5. **Server side only.** API keys live in server env vars / secret store; the browser calls your endpoint, which adds auth, rate limits and logging.
6. **Validate outputs.** Parse JSON strictly; check ranges/enums; on failure retry once with the error, then fall back safely.
7. **Evaluate.** Run the example set on every prompt/model change; track pass rate, latency, cost per call.

## Safety for health products
- The assistant gives general information and routes to a doctor; it never diagnoses or changes treatment.
- Urgent symptoms → a fixed emergency message with the local emergency number, not model text.
- Do not send personal health data to a model unless the privacy policy and consent cover it; strip names/IDs when not needed.
- Log prompts/outputs for debugging without storing secrets.

## Checklist
- [ ] Eval set exists and passes; numbers recorded.
- [ ] Timeouts, retries, max tokens, and per-user rate limits set.
- [ ] Cost estimate per 1,000 users written down.
- [ ] Prompt injection: tool outputs and user documents are treated as data, never instructions.
