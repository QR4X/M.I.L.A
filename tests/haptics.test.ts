import { describe, it, expect } from "vitest";
import { ehToque } from "../src/ui/haptics";

// A regra que separa TOCAR de ROLAR. Ela existe porque o tato antes saía no
// `pointerdown`, e em pointerdown ninguém sabe ainda o que o dedo vai fazer:
// encostar numa lista pra rolar começa igual a tocar, e a lista é feita de
// botões — descer a home virava uma sequência de pulsos sem ação nenhuma.
describe("ehToque", () => {
  it("dedo parado e rápido é toque", () => {
    expect(ehToque(0, 0, 90)).toBe(true);
    expect(ehToque(3, -4, 250)).toBe(true);
  });

  it("andou o bastante pra ser rolagem", () => {
    expect(ehToque(0, 20, 200)).toBe(false);
    expect(ehToque(-30, 2, 200)).toBe(false);
  });

  it("a folga é dos DOIS eixos — rolagem lateral também não vibra", () => {
    expect(ehToque(9, 0, 100)).toBe(false);
    expect(ehToque(8, 8, 100)).toBe(true);
  });

  it("segurou demais: não é resposta a nada", () => {
    expect(ehToque(0, 0, 1200)).toBe(false);
  });
});
