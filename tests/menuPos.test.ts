import { describe, it, expect } from "vitest";
import { posicaoDoBalao, type Caixa } from "../src/ui/menu";

// Esta conta já nasceu errada duas vezes, sempre pelo mesmo motivo: ela mistura
// DOIS retângulos. As coordenadas de saída são da camada, que é `absolute`
// dentro da `.axxa-root`; mas quem decide se o balão CABE é a tela. No celular
// a folha vira `fixed` e vai até o fundo do viewport — mais baixo do que a raiz
// alcança —, então um ⋯ na parte de baixo da folha está numa altura que a raiz
// nem tem. Medindo pela raiz, o balão "cabia" na conta e nascia fora da tela.

const caixa = (
  left: number,
  top: number,
  width: number,
  height: number
): Caixa => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});

/** O caso do celular: raiz de 770 dentro de uma tela de 900. */
const RAIZ = caixa(0, 0, 400, 770);
const TELA = { width: 400, height: 900 };
const BALAO = { width: 160, height: 273 };

describe("posicaoDoBalao", () => {
  it("abre ABAIXO do botão quando cabe", () => {
    const r = posicaoDoBalao({
      ancora: { left: 360, right: 390, top: 100, bottom: 130 },
      raiz: RAIZ,
      tela: TELA,
      balao: BALAO,
    });
    expect(r.y).toBe(136); // 130 + 6 de vão
    expect(r.origem).toBe("top right");
  });

  it("alinha pela DIREITA do botão", () => {
    const r = posicaoDoBalao({
      ancora: { left: 360, right: 390, top: 100, bottom: 130 },
      raiz: RAIZ,
      tela: TELA,
      balao: BALAO,
    });
    expect(r.x).toBe(390 - 160);
  });

  it("sobe quando não cabe embaixo", () => {
    const r = posicaoDoBalao({
      ancora: { left: 360, right: 390, top: 800, bottom: 830 },
      raiz: RAIZ,
      tela: TELA,
      balao: BALAO,
    });
    expect(r.y + BALAO.height).toBeLessThanOrEqual(TELA.height);
    expect(r.origem).toBe("bottom right");
  });

  it("um botão ABAIXO da raiz ainda nasce dentro da tela", () => {
    // É o caso que quebrou: a folha é `fixed` e vai até 900, a raiz para em
    // 770, e o ⋯ está em 860. Pela raiz, a conta dizia que estava tudo bem.
    const r = posicaoDoBalao({
      ancora: { left: 360, right: 390, top: 845, bottom: 873 },
      raiz: RAIZ,
      tela: TELA,
      balao: BALAO,
    });
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.y + BALAO.height).toBeLessThanOrEqual(TELA.height);
  });

  it("nunca passa da borda de baixo da TELA, em qualquer altura do botão", () => {
    for (let t = 0; t <= 880; t += 20) {
      const r = posicaoDoBalao({
        ancora: { left: 360, right: 390, top: t, bottom: t + 28 },
        raiz: RAIZ,
        tela: TELA,
        balao: BALAO,
      });
      expect(r.y, `botão em ${t}`).toBeGreaterThanOrEqual(0);
      expect(r.y + BALAO.height, `botão em ${t}`).toBeLessThanOrEqual(
        TELA.height
      );
    }
  });

  it("balão mais alto que a tela encosta no topo", () => {
    // Não cabe de jeito nenhum; o começo da lista é o que mais importa ver.
    const r = posicaoDoBalao({
      ancora: { left: 360, right: 390, top: 400, bottom: 430 },
      raiz: RAIZ,
      tela: { width: 400, height: 200 },
      balao: { width: 160, height: 500 },
    });
    expect(r.y).toBe(10);
  });

  it("não encosta na borda esquerda quando o botão é estreito e à esquerda", () => {
    const r = posicaoDoBalao({
      ancora: { left: 0, right: 30, top: 100, bottom: 130 },
      raiz: RAIZ,
      tela: TELA,
      balao: BALAO,
    });
    expect(r.x).toBe(10);
  });

  it("raiz que cabe inteira na tela se comporta como antes", () => {
    // A mudança não pode mexer no caso comum (desktop, painel lateral).
    const raiz = caixa(0, 0, 400, 600);
    const r = posicaoDoBalao({
      ancora: { left: 360, right: 390, top: 100, bottom: 130 },
      raiz,
      tela: { width: 400, height: 600 },
      balao: BALAO,
    });
    expect(r).toEqual({ x: 230, y: 136, origem: "top right" });
  });
});
