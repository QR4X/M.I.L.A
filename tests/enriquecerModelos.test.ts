import { describe, it, expect, afterEach } from "vitest";
import { __setRequestUrl } from "obsidian";
import { getModelCapabilities } from "../src/providers/modelCapabilities";
import {
  hydrateModelInfoCache,
  enrichModelsFromCatalog,
} from "../src/providers/modelInfoStore";
import { enriquecerCapacidadesOllama } from "../src/providers/ollama";

/**
 * O buraco que estes testes fecham.
 *
 * A camada de capacidades (getModelCapabilities) lê um cache de specs por
 * `provider::model`. Na migração pra `src/ui` o "Fetch info" por card saiu, e
 * com ele o ÚNICO caller que escrevia nesse cache — ou seja, a detecção de
 * visão/geração de imagem dependia só das tabelas por prefixo. Modelo com visão
 * que não estivesse num prefixo (um `gemma3` local, um modelo novo de qualquer
 * provider) aparecia como modelo SEM visão, e o botão de anexar imagem ficava
 * apagado. Ver o overlay no fim de getModelCapabilities.
 */

// Um catálogo só pra este arquivo: o store memoiza o GET por sessão (de
// propósito — é um pedido só pra N modelos), então todos os testes daqui leem
// este mesmo payload.
const CATALOGO = {
  data: [
    {
      id: "lab/modelo-novo-vl",
      architecture: {
        input_modalities: ["text", "image"],
        output_modalities: ["text"],
      },
      supported_parameters: ["tools"],
      pricing: { prompt: "0.000001", completion: "0.000002" },
    },
    {
      id: "lab/gerador-1",
      architecture: {
        input_modalities: ["text"],
        output_modalities: ["text", "image"],
      },
      supported_parameters: [],
      pricing: { prompt: "0.000002", completion: "0" },
    },
  ],
};

describe("catálogo do OpenRouter → capacidades dos modelos", () => {
  afterEach(() => {
    __setRequestUrl(null);
    hydrateModelInfoCache({});
  });

  it("liga visão e imageGen de quem está fora das tabelas curadas", async () => {
    __setRequestUrl(async () => ({
      status: 200,
      json: CATALOGO,
      text: "",
      headers: {},
    }));

    // Antes: nada na tabela do NIM casa com "lab/", então é modelo sem visão.
    expect(getModelCapabilities("nim", "lab/modelo-novo-vl").vision).toBe(false);

    const gravados = await enrichModelsFromCatalog("nim", [
      "lab/modelo-novo-vl",
      "lab/gerador-1",
      "lab/nao-existe-no-catalogo",
    ]);
    expect(gravados).toBe(2);

    expect(getModelCapabilities("nim", "lab/modelo-novo-vl")).toMatchObject({
      vision: true,
      tools: true,
    });
    expect(getModelCapabilities("nim", "lab/gerador-1").imageGen).toBe(true);
    // Sem correspondência no catálogo, nada muda.
    expect(getModelCapabilities("nim", "lab/nao-existe-no-catalogo").vision).toBe(
      false
    );
  });

  it("não sobrescreve o que já está no cache — a busca é uma vez por modelo", async () => {
    __setRequestUrl(async () => ({
      status: 200,
      json: CATALOGO,
      text: "",
      headers: {},
    }));
    // Cache com a resposta de OUTRA fonte (o /api/show do Ollama, por ex.):
    // ela manda, e o catálogo não passa por cima.
    hydrateModelInfoCache({
      "nim::lab/gerador-1": { modalities: ["text"], outputModalities: ["text"] },
    });

    expect(await enrichModelsFromCatalog("nim", ["lab/gerador-1"])).toBe(0);
    expect(getModelCapabilities("nim", "lab/gerador-1").imageGen).toBeUndefined();
  });

  it("catálogo fora do ar não lança e não inventa capacidade", async () => {
    __setRequestUrl(async () => {
      throw new Error("offline");
    });
    expect(await enrichModelsFromCatalog("openai", ["modelo-do-futuro-9000"])).toBe(0);
    expect(getModelCapabilities("openai", "modelo-do-futuro-9000").vision).toBe(
      false
    );
    // A tabela curada continua valendo pro que ela já sabia.
    expect(getModelCapabilities("openai", "gpt-4o").vision).toBe(true);
  });
});

describe("Ollama: o servidor declara as capacidades dele", () => {
  afterEach(() => {
    __setRequestUrl(null);
    hydrateModelInfoCache({});
  });

  it("gemma3 lê imagem — antes o botão de anexar ficava apagado", async () => {
    // O prefixo "gemma" da tabela diz texto-only, e o gemma3 não tem linha
    // própria. O /api/show sabe a verdade deste modelo instalado.
    expect(getModelCapabilities("ollama", "gemma3:4b").vision).toBe(false);

    __setRequestUrl(async () => ({
      status: 200,
      json: { capabilities: ["completion", "vision", "tools"] },
      text: "",
      headers: {},
    }));
    expect(
      await enriquecerCapacidadesOllama("http://localhost:11434", ["gemma3:4b"])
    ).toBe(1);
    expect(getModelCapabilities("ollama", "gemma3:4b")).toMatchObject({
      vision: true,
      tools: true,
    });
  });

  it("servidor antigo (sem `capabilities`) não grava nada: a tabela decide", async () => {
    __setRequestUrl(async () => ({
      status: 200,
      json: { model_info: {} },
      text: "",
      headers: {},
    }));
    expect(
      await enriquecerCapacidadesOllama("http://localhost:11434", ["llava"])
    ).toBe(0);
    expect(getModelCapabilities("ollama", "llava").vision).toBe(true);
  });

  it("servidor fora de alcance não lança e não grava", async () => {
    __setRequestUrl(async () => {
      throw new Error("offline");
    });
    expect(
      await enriquecerCapacidadesOllama("http://localhost:11434", ["gemma4:2b"])
    ).toBe(0);
    expect(getModelCapabilities("ollama", "gemma4:2b").vision).toBe(false);
  });
});
