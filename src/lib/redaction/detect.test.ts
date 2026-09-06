import { describe, expect, it } from "vitest";
import { analyze, applyRedaction, isValidIban, isValidLuhn } from "./detect";
import { DEFAULT_TOGGLES } from "./types";

const run = (text: string, terms: string[] = []) => {
  const matches = analyze(text, DEFAULT_TOGGLES, terms);
  return { matches, output: applyRedaction(text, matches, new Set()) };
};

describe("validators", () => {
  it("accepts a valid IBAN and rejects a broken one", () => {
    expect(isValidIban("CH93 0076 2011 6238 5295 7")).toBe(true);
    expect(isValidIban("CH93 0076 2011 6238 5295 8")).toBe(false);
  });

  it("checks card numbers with Luhn", () => {
    expect(isValidLuhn("4111 1111 1111 1111")).toBe(true);
    expect(isValidLuhn("4111 1111 1111 1112")).toBe(false);
  });
});

describe("analyze", () => {
  it("redacts names, IBANs, addresses, email and phone", () => {
    const text =
      "Herr Thomas Meier, Bahnhofstrasse 12, 8001 Zürich, thomas.meier@example.com, +41 44 123 45 67, IBAN CH93 0076 2011 6238 5295 7";
    const { output } = run(text);
    expect(output).not.toContain("Thomas Meier");
    expect(output).not.toContain("example.com");
    expect(output).not.toContain("Bahnhofstrasse 12");
    expect(output).not.toContain("5295 7");
    expect(output).toContain("[NAME 1]");
  });

  it("keeps the same placeholder for repeated values", () => {
    const { output } = run("Anna Muster schreibt. Später antwortet Anna Muster erneut.");
    expect(output.match(/\[NAME 1\]/g)?.length).toBe(2);
  });

  it("replaces custom terms case-insensitively", () => {
    const { output } = run("Die ACME AG zahlt. acme ag ist Kunde.", ["ACME AG"]);
    expect(output.toLowerCase()).not.toContain("acme");
  });

  it("leaves untouched text alone", () => {
    const text = "Die Rechnung wurde geprüft und freigegeben.";
    expect(run(text).output).toBe(text);
  });

  it("redacts companies with legal forms, clubs and institutions", () => {
    const { output } = run(
      "Die Muster GmbH arbeitet mit der Beispiel Holding AG zusammen. Gegründet wurde der FC Musterort, heute ein eingetragener Sportverein. Kunde ist auch die Aargauische Kantonalbank sowie Müller & Co. KG.",
    );
    expect(output).not.toContain("Muster GmbH");
    expect(output).not.toContain("Beispiel Holding AG");
    expect(output).not.toContain("FC Musterort");
    expect(output).not.toContain("Aargauische Kantonalbank");
    expect(output).not.toContain("Müller & Co. KG");
    expect(output).toContain("[FIRMA 1]");
  });
});
