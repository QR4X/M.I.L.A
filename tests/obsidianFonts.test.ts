import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { isControlKey } from "../src/ui/settings/values";

const read = (path: string) =>
  readFileSync(resolve(__dirname, "..", path), "utf8");
const css = read("styles/main.css").replace(/\/\*[\s\S]*?\*\//g, "");
const roots = [
  ".axxa-root",
  ".axxa-settings-root",
  ".axxa-pop-layer",
  ".axxa-modal-container",
  ".axxa-effort-modal",
  ".axxa-native-confirm-modal",
  ".axxa-language-modal",
];

describe("Obsidian Appearance is the only source of plugin typography", () => {
  it("binds every independent UI root to the native font and size", () => {
    const selector = roots.join(",\\s*").replace(/\./g, "\\.");
    const rule = new RegExp(`${selector}\\s*\\{([^}]+)\\}`).exec(css)?.[1];
    expect(rule).toBeDefined();
    expect(rule).toContain("font-family: var(--font-interface)");
    expect(rule).toContain("font-size: var(--font-text-size)");
    expect(rule).toContain("--font-ui-medium: var(--font-text-size)");
    for (const [token, scale] of [
      ["smaller", "0.8"],
      ["small", "0.875"],
      ["large", "1.25"],
    ]) {
      expect(rule).toContain(
        `--font-ui-${token}: calc(var(--font-text-size) * ${scale})`
      );
    }
  });

  it("does not hard-code fonts or text sizes anywhere in the plugin CSS", () => {
    const families = [...css.matchAll(/font-family:\s*([^;]+);/g)];
    expect(families.length).toBeGreaterThan(10);
    for (const [, value] of families) {
      expect(["inherit", "var(--font-interface)"]).toContain(value);
    }
    expect(css).not.toMatch(/font-size:\s*[\d.]+(?:px|rem)\b/);
    expect(css).not.toMatch(/--axxa-(?:read-font|font-family|font-size)/);
    for (const selector of [".axxa-markdown", ".axxa-msg-user"]) {
      const escaped = selector.replace(/\./g, "\\.");
      expect(css).toMatch(
        new RegExp(`${escaped}\\s*\\{[^}]*font-size:\\s*var\\(--font-ui-medium\\)`)
      );
    }
    expect(css).toMatch(
      /\.axxa-input textarea:active\s*\{[^}]*font-size:\s*var\(--font-ui-medium\)/
    );
  });

  it("covers native controls, rendered markdown and modal headings", () => {
    expect(css).toContain(
      ":is(button, input, textarea, select, code, pre, .markdown-rendered,"
    );
    expect(read("src/ui/modals.ts")).toContain(
      'this.modalEl.addClass("axxa-native-confirm-modal")'
    );
    expect(read("src/editor/inline.ts")).toContain(
      'this.modalEl.addClass("axxa-language-modal")'
    );
  });

  it("removes plugin-specific controls and inline overrides", () => {
    for (const key of ["uiFontFamily", "uiFontSize"]) {
      expect(isControlKey(key)).toBe(false);
      for (const file of ["src/main.ts", "src/ui/settings/tree.ts"]) {
        expect(read(file)).not.toContain(key);
      }
    }
    expect(read("src/ui/App.tsx")).not.toContain("fontVars");
    expect(read("src/ui/SettingsTab.ts")).not.toContain("fontVars");
    expect(existsSync(resolve(__dirname, "../src/ui/fontVars.ts"))).toBe(false);
  });
});
