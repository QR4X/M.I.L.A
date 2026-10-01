// src/providers/ollama.ts
// Provider Ollama — LLMs locais via servidor HTTP.
// Endpoint: settings.ollamaEndpoint — vazio de fábrica desde a 0.9.20 (o
// Ollama começa desligado; ver core/ollamaPadrao.ts). Sem auth (local).
//
// Diferenças do OpenAI:
//   - Body: { model, messages, stream, tools?, options? }
//   - Resposta streaming: JSON delimitado por NEWLINE (não SSE com "data:")
//   - Cada linha: {"message": {"role":"assistant","content":"..."}, "done":false}
//   - Última linha: {"done":true, "prompt_eval_count":..., "eval_count":...}
//
// Tool calling (v0.1.33):
//   - Body envia `tools[]` mesmo formato OpenAI (sem `tool_choice` — Ollama ignora)
//   - Resposta: `message.tool_calls[]` no formato `{function: {name, arguments}}`
//   - Pegadinha: `arguments` no Ollama vem como OBJETO (não JSON string como OpenAI)
//   - Pegadinha: tool_calls do Ollama frequentemente vêm SEM `id` — geramos um
//   - Modelos com tool calling: llama3.1, llama3.2, qwen2.5, mistral-large, etc.
//   - Modelos antigos / pequenos ignoram silenciosamente o campo `tools`
//
// Como a key não é necessária, passamos vazia mesmo.

import { requestUrl } from "obsidian";
import {
  Provider,
  ProviderError,
  ProviderRequest,
  ProviderResponse,
  ProviderToolCall,
  TokenHandler,
  UsageHandler,
  ReasoningHandler,
} from "./base";
import { resolveTemperature, resolveMaxTokens } from "./paramPolicy";
import {
  toOpenAIMessages,
  ensureOkRequest,
  ensureOkStream,
  fetchStream,
} from "./_shared";

// ---- O que o Ollama devolve (ver a nota em _shared.ts) -------------------
// Ollama não fala OpenAI-compatible aqui: tool call vem sem `id`, e os
// arguments chegam ora como objeto, ora como string JSON (depende do modelo).

interface ToolCallOllama {
  id?: string;
  function?: { name?: string; arguments?: unknown };
}

interface MensagemOllama {
  content?: unknown;
  tool_calls?: unknown;
}

interface RespostaOllama {
  message?: MensagemOllama;
  done?: boolean;
  error?: unknown;
  prompt_eval_count?: number;
  eval_count?: number;
}

interface CatalogoOllama {
  models?: Array<{ name?: unknown }>;
}

/**
 * Tool calls do Ollama → ProviderToolCall[]. Era o MESMO bloco escrito duas
 * vezes (non-stream e stream); qualquer correção tinha que ser feita em dois
 * lugares. Sem name não há o que chamar, então a entrada é descartada.
 */
function toolCallsDoOllama(brutas: unknown): ProviderToolCall[] {
  if (!Array.isArray(brutas)) return [];
  const saida: ProviderToolCall[] = [];
  for (const [idx, tc] of (brutas as ToolCallOllama[]).entries()) {
    const fn = tc?.function;
    if (!fn?.name) continue;
    const raw = fn.arguments;
    let parsedArgs: Record<string, unknown> = {};
    if (raw && typeof raw === "object") {
      // Caminho Ollama: já vem como objeto.
      parsedArgs = raw as Record<string, unknown>;
    } else if (typeof raw === "string") {
      // Caminho compat: alguns modelos devolvem string JSON.
      try {
        parsedArgs = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        parsedArgs = { _raw: raw };
      }
    }
    saida.push({
      id: tc.id ?? `ollama_call_${Date.now()}_${idx}`,
      name: fn.name,
      arguments: parsedArgs,
    });
  }
  return saida;
}

export class OllamaProvider implements Provider {
  id = "ollama";
  name = "Ollama";
  // Ollama ≥0.3 suporta tool calling em modelos compatíveis (llama3.1+,
  // qwen2.5+, mistral-large, etc). Modelos antigos ignoram silenciosamente.
  // O usuário precisa escolher um modelo que tenha tools no card do Ollama.
  supportsTools = true;

  /** Endpoint base que vem das settings (apiKey no nosso modelo, mas é URL). */
  private getEndpoint(apiKey: string): string {
    // No nosso modelo, apiKey carrega o endpoint do Ollama (settings.ollamaEndpoint)
    const DEFAULT = "http://localhost:11434";
    // Vazio é DESLIGADO, não "use o localhost": cair no padrão aqui buscaria
    // modelos (e mandaria conversa) num servidor que ninguém configurou. O
    // chat já barra antes (helpers.semCredencial); isto cobre o Fetch.
    if (!apiKey.trim()) {
      throw new ProviderError(
        "Set your Ollama server address first (Settings → Providers → Ollama, usually http://localhost:11434).",
        "unknown"
      );
    }
    const url = apiKey.trim().replace(/\/$/, "");
    // v0.1.228: valida o endpoint configurado — URL malformada ou esquema
    // não-HTTP cai pro default localhost em vez de produzir erros confusos.
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        console.warn(`[Ollama] Endpoint com esquema inválido (${parsed.protocol}), usando ${DEFAULT}.`);
        return DEFAULT;
      }
    } catch {
      console.warn(`[Ollama] Endpoint inválido ("${url}"), usando ${DEFAULT}.`);
      return DEFAULT;
    }
    return url;
  }

  async chat(req: ProviderRequest, apiKey: string): Promise<ProviderResponse> {
    const endpoint = this.getEndpoint(apiKey);

    // Body com OpenAI-compat messages — reusa o converter pra normalizar
    // assistant.tool_calls e tool results.
    const body: Record<string, unknown> = {
      model: req.model,
      messages: toOpenAIMessages(req.messages),
      stream: false,
      options: {
        num_predict: resolveMaxTokens("ollama", req.model, req.maxTokens ?? 2000),
        ...(() => {
          const t = resolveTemperature("ollama", req.model, req.temperature);
          return t !== undefined ? { temperature: t } : {};
        })(),
      },
    };
    if (req.tools && req.tools.length > 0) {
      body.tools = req.tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
      // Ollama NÃO usa tool_choice — qualquer valor é ignorado, então omitimos.
    }

    let res;
    try {
      res = await requestUrl({
        url: `${endpoint}/api/chat`,
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify(body),
        throw: false,
      });
    } catch {
      throw new ProviderError(
        `Connection to Ollama at ${endpoint} failed. Make sure the server is running.`,
        "network"
      );
    }

    ensureOkRequest(res, { label: "Ollama" });

    const corpo = res.json as RespostaOllama | undefined;
    const message = corpo?.message;
    if (!message) {
      throw new ProviderError("Empty response from Ollama.", "unknown");
    }

    // Parseia tool_calls — formato Ollama:
    //   { function: { name: string, arguments: object | string } }
    // Sem `id` na maioria dos casos — geramos um pra fechar o loop.
    const lidas = toolCallsDoOllama(message.tool_calls);
    const toolCalls = lidas.length > 0 ? lidas : undefined;

    const content = typeof message.content === "string" ? message.content : "";
    if (!toolCalls && !content) {
      throw new ProviderError(
        "Empty response from Ollama (no text or tool_calls).",
        "unknown"
      );
    }

    const result: ProviderResponse = { content };
    if (toolCalls) result.toolCalls = toolCalls;
    // Usage tokens (vem no response não-streaming também)
    if (corpo?.prompt_eval_count !== undefined || corpo?.eval_count !== undefined) {
      result.usage = {
        input: corpo.prompt_eval_count ?? 0,
        output: corpo.eval_count ?? 0,
      };
    }
    return result;
  }

  async streamChat(
    req: ProviderRequest,
    apiKey: string,
    onToken: TokenHandler,
    onUsage?: UsageHandler,
    signal?: AbortSignal,
    // o Ollama não emite trilha de raciocínio separada, então o handler entra
    // só pra assinatura bater com os outros providers e fica sem uso.
    _onReasoning?: ReasoningHandler
  ): Promise<ProviderResponse> {
    const endpoint = this.getEndpoint(apiKey);

    const body: Record<string, unknown> = {
      model: req.model,
      messages: toOpenAIMessages(req.messages),
      stream: true,
      options: {
        num_predict: resolveMaxTokens("ollama", req.model, req.maxTokens ?? 2000),
        ...(() => {
          const t = resolveTemperature("ollama", req.model, req.temperature);
          return t !== undefined ? { temperature: t } : {};
        })(),
      },
    };
    if (req.tools && req.tools.length > 0) {
      body.tools = req.tools.map((t) => ({
        type: "function",
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
    }

    let res: Response;
    try {
      res = await fetchStream(`${endpoint}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      throw new ProviderError(
        `Connection to Ollama at ${endpoint} failed. Is the server running?`,
        "network"
      );
    }

    await ensureOkStream(res, { label: "Ollama" });
    if (!res.body) {
      throw new ProviderError("Empty stream from Ollama.", "unknown");
    }

    // Parser NDJSON — cada linha é um JSON completo (não SSE)
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let accumulatedText = "";
    let usage: { input: number; output: number } | undefined;
    // v0.1.228: Ollama emite o bloco INTEIRO de tool_calls (não deltas) e pode
    // reenviar o array em mais de uma linha — guardamos só o último recebido em
    // vez de concatenar, evitando tool calls duplicados.
    let lastToolCalls: ProviderToolCall[] = [];

    // v0.1.228: try/finally garante liberar o reader em erro/abort (o read()
    // já rejeita com AbortError quando o signal aborta, via fetch).
    try {
      while (true) {
        // v0.1.228: aborta cedo se o signal já disparou (read() também rejeita,
        // mas isto encurta o ciclo entre chunks).
        if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let json: RespostaOllama;
          try {
            json = JSON.parse(trimmed) as RespostaOllama;
          } catch {
            // v0.1.228: linha provavelmente truncada — o buffer já guarda o
            // resto (último split vira o novo buffer), então ignoramos.
            continue;
          }
          // v0.1.228: Ollama sinaliza erros de runtime com um campo `error` na
          // própria linha do stream — propaga em vez de engolir silenciosamente.
          if (typeof json.error === "string" && json.error) {
            throw new ProviderError(`Ollama: ${json.error}`, "unknown");
          }
          const message = json?.message;
          const token = message?.content;
          if (typeof token === "string" && token.length > 0) {
            accumulatedText += token;
            onToken(token);
          }
          // Ollama emite tool_calls inteiros (não em deltas) — geralmente
          // numa linha só, próximo do final do stream. Se reenviar, o array
          // novo SUBSTITUI o anterior (não acumula).
          const parsed = toolCallsDoOllama(message?.tool_calls);
          if (parsed.length > 0) lastToolCalls = parsed;
          if (json?.done === true) {
            usage = {
              input: json.prompt_eval_count ?? 0,
              output: json.eval_count ?? 0,
            };
            if (onUsage) onUsage(usage);
            const result: ProviderResponse = { content: accumulatedText };
            if (lastToolCalls.length > 0) result.toolCalls = lastToolCalls;
            if (usage) result.usage = usage;
            return result;
          }
        }
      }
    } finally {
      try { reader.releaseLock(); } catch { /* já liberado */ }
    }
    const result: ProviderResponse = { content: accumulatedText };
    if (lastToolCalls.length > 0) result.toolCalls = lastToolCalls;
    if (usage) result.usage = usage;
    return result;
  }

  /** Lista modelos instalados localmente via /api/tags */
  async listModels(apiKey: string): Promise<string[]> {
    const endpoint = this.getEndpoint(apiKey);
    let res;
    try {
      res = await requestUrl({
        url: `${endpoint}/api/tags`,
        method: "GET",
        throw: false,
      });
    } catch {
      throw new ProviderError(
        `Connection to Ollama at ${endpoint} failed.`,
        "network"
      );
    }
    if (res.status < 200 || res.status >= 300) {
      throw new ProviderError(`Ollama: HTTP ${res.status}`, "unknown");
    }
    const models = (res.json as CatalogoOllama | undefined)?.models ?? [];
    return models
      .map((m) => m?.name)
      .filter((n): n is string => typeof n === "string")
      .sort();
  }
}

export const ollamaProvider = new OllamaProvider();
