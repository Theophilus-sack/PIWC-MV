import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const filePath = join(dirname(fileURLToPath(import.meta.url)), "LeadershipPage.jsx");
const source = readFileSync(filePath, "utf8");

// Isolates a top-level `function <name>(` block by brace-matching, so
// assertions about PresbyterModal's JSX can't accidentally match
// something in a sibling component (e.g. MinistryLeaderModal) elsewhere
// in the same file.
function functionBody(src, fnName) {
  const start = src.indexOf(`function ${fnName}(`);
  if (start === -1) throw new Error(`function ${fnName} not found`);
  // Skip past the parameter list first — a destructured param like
  // `({ presbyter, onClose })` has its own `{ }` that would otherwise be
  // mistaken for the body's opening brace by a naive indexOf("{").
  const parenStart = src.indexOf("(", start);
  let parenDepth = 0, i = parenStart;
  for (; i < src.length; i++) {
    if (src[i] === "(") parenDepth++;
    else if (src[i] === ")") { parenDepth--; if (parenDepth === 0) break; }
  }
  const braceStart = src.indexOf("{", i);
  let depth = 0;
  for (let j = braceStart; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") {
      depth--;
      if (depth === 0) return src.slice(start, j + 1);
    }
  }
  throw new Error(`unbalanced braces for ${fnName}`);
}

describe("LeadershipPage.jsx (static)", () => {
  it("renames the second section's header to 'Ministry & Department Leadership'", () => {
    expect(source).toContain("Ministry & Department Leadership");
    expect(source).not.toMatch(/>Ministry leadership</);
  });

  describe("PresbyterModal", () => {
    const body = functionBody(source, "PresbyterModal");

    it("offers a Portfolio dropdown with exactly Elder/Deacon/Deaconess", () => {
      expect(body).toMatch(/label>Portfolio</);
      expect(body).toMatch(/<option key=\{p\} value=\{p\}>\{p\}<\/option>/);
    });

    it("no longer offers 'Both'/Departments on the Service dropdown — presbyters are only ever English or Twi", () => {
      expect(body).not.toMatch(/<option value="Both">/);
      expect(body).toMatch(/<option value="English">English Service<\/option>/);
      expect(body).toMatch(/<option value="Twi">Twi Service<\/option>/);
    });
  });

  it("PORTFOLIOS is exactly Elder/Deacon/Deaconess, in that order", () => {
    const match = source.match(/const PORTFOLIOS = \[([^\]]*)\];/);
    expect(match).toBeTruthy();
    const values = match[1].split(",").map((s) => s.trim().replace(/"/g, ""));
    expect(values).toEqual(["Elder", "Deacon", "Deaconess"]);
  });
});
