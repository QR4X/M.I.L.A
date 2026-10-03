import { describe, it, expect } from "vitest";
import { decideToolGate } from "../src/agent/permissions";
import type { ToolDefinition, PermissionLevel } from "../src/agent/types";

// decideToolGate é o "portão" que decide se uma tool roda direto ou abre o modal
// de confirmação. Segurança: bug aqui = ação destrutiva sem perguntar.

const tool = (destructive: boolean, irreversible = false): ToolDefinition =>
  ({
    name: "x",
    description: "",
    parameters: {},
    destructive,
    irreversible,
  } as ToolDefinition);

const gate = (
  t: ToolDefinition,
  level: PermissionLevel,
  approveAll: boolean,
  apagarVaiPraLixeira = false
) => decideToolGate(t, level, { approveAll, apagarVaiPraLixeira });

// v0.1.237 (auditoria P1-04/P1-05): o NÍVEL decide SE confirma (labels
// vault/yolo prometem sem modal e agora cumprem); o toggle de diff só muda o
// PREVIEW da confirmação; "aprovar todas" vale em qualquer configuração.
describe("decideToolGate", () => {
  it("não-destrutivo (read/list) → sempre auto", () => {
    expect(gate(tool(false), "ask", false)).toBe("auto");
    expect(gate(tool(false), "yolo", false)).toBe("auto");
  });

  it("destrutivo em 'ask' → confirm", () => {
    expect(gate(tool(true), "ask", false)).toBe("confirm");
  });

  it("destrutivo em 'yolo'/'vault' → auto (como o label promete)", () => {
    expect(gate(tool(true), "yolo", false)).toBe("auto");
    expect(gate(tool(true), "vault", false)).toBe("auto");
  });

  it("'aprovar todas' vale também no nível ask (P1-04)", () => {
    expect(gate(tool(true), "ask", true)).toBe("auto");
  });

  it("SEGURANÇA: apagar sem lixeira SEMPRE confirma — nem yolo, nem 'aprovar todas'", () => {
    expect(gate(tool(true, true), "yolo", true)).toBe("confirm");
    expect(gate(tool(true, true), "yolo", false)).toBe("confirm");
    expect(gate(tool(true, true), "ask", true)).toBe("confirm");
  });

  it("o que separa vault de yolo: com lixeira, só o yolo apaga sem perguntar", () => {
    expect(gate(tool(true, true), "yolo", false, true)).toBe("auto");
    expect(gate(tool(true, true), "vault", false, true)).toBe("confirm");
    expect(gate(tool(true, true), "ask", false, true)).toBe("confirm");
    // "aprovar todas" continua não valendo pro apagar fora do yolo
    expect(gate(tool(true, true), "vault", true, true)).toBe("confirm");
  });
});
