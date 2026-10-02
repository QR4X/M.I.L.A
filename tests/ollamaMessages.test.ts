import { describe, it, expect, vi, afterEach } from "vitest";
import { ollamaProvider, toOllamaMessages } from "../src/providers/ollama";
import type { ProviderMessage } from "../src/providers/base";
import { fakeStreamResponse } from "./helpers/streamMock";

// O agente com Ollama morria na SEGUNDA volta do loop de ferramentas: o
// histórico ia no formato OpenAI (`arguments` como string JSON) e o
// `/api/chat` do Ollama devolvia 400 — "Value looks like object, but can't
// find closing '}' symbol". Achado ao vivo, com qwen3.5:9b, no Obsidian 1.13.7.

const historico: ProviderMessage[] = [
  { role: "user", content: "Move my Lisbon trip note into a Personal folder." },
  {
    role: "assistant",
    content: "",
    toolCalls: [{ id: "call_1", name: "vault_list", arguments: { folder: "Personal" } }],
  },
  { role: "tool", toolCallId: "call_1", content: "Folder does not exist: Personal" },
];

describe("toOllamaMessages — o histórico no formato do Ollama", () => {
  it("arguments vai como OBJETO, não string JSON", () => {
    const [, assistente] = toOllamaMessages(historico) as Array<Record<string, unknown>>;
    const chamadas = assistente.tool_calls as Array<{ function: { name: string; arguments: unknown } }>;
    expect(chamadas[0].function).toEqual({ name: "vault_list", arguments: { folder: "Personal" } });
    expect(typeof chamadas[0].function.arguments).toBe("object");
  });

  it("content do assistente nunca vai null", () => {
    const semTexto: ProviderMessage[] = [
      { role: "assistant", content: "", toolCalls: [{ id: "c", name: "vault_read", arguments: { path: "a.md" } }] },
    ];
    const [assistente] = toOllamaMessages(semTexto) as Array<Record<string, unknown>>;
    expect(assistente.content).toBe("");
  });

  it("a resposta da ferramenta leva o tool_name da chamada", () => {
    const [, , ferramenta] = toOllamaMessages(historico) as Array<Record<string, unknown>>;
    expect(ferramenta).toEqual({ role: "tool", content: "Folder does not exist: Personal", tool_name: "vault_list" });
  });

  it("mensagens comuns passam como estão", () => {
    const [usuario] = toOllamaMessages(historico) as Array<Record<string, unknown>>;
    expect(usuario).toEqual({ role: "user", content: "Move my Lisbon trip note into a Personal folder." });
  });
});

describe("o corpo que sai pro /api/chat na segunda volta", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("streamChat manda arguments como objeto", async () => {
    let corpo = "";
    const fake = vi.fn(async (_url: string, init: { body: string }) => {
      corpo = init.body;
      return fakeStreamResponse([
        JSON.stringify({ message: { content: "Done." }, done: true, prompt_eval_count: 1, eval_count: 1 }) + "\n",
      ]);
    });
    vi.stubGlobal("fetch", fake);
    vi.stubGlobal("window", { fetch: fake });

    await ollamaProvider.streamChat({ model: "qwen3.5:9b", messages: historico }, "http://localhost:11434", () => {});

    const enviado = JSON.parse(corpo) as { messages: Array<{ tool_calls?: Array<{ function: { arguments: unknown } }> }> };
    expect(enviado.messages[1].tool_calls?.[0].function.arguments).toEqual({ folder: "Personal" });
    expect(corpo).not.toContain('"arguments":"');
  });
});
