export const SCORE_FORBIDDEN_MESSAGE = "Nee, nee geen 8,5 schatjes. Leuk geprobeerd.";

/** Precies één decimaal, met een komma: 0,0 t/m 10,0. */
const SCORE_PATTERN = /^(?:[0-9]|10),[0-9]$/;

export function validateName(raw: string): string | null {
  const name = raw.trim();
  if (!name) return "Vul de naam van de champagne in.";
  if (/\s/.test(name)) return "Precies één woord graag. Geen spaties.";
  return null;
}

export function validateScore(raw: string): string | null {
  const score = raw.trim();
  if (!score) return "Vul een cijfer in.";
  if (!SCORE_PATTERN.test(score)) {
    return "Eén decimaal met een komma, bijvoorbeeld 8,4.";
  }
  if (score === "8,5") return SCORE_FORBIDDEN_MESSAGE;
  return null;
}

/** "8,4" -> 8.4. Alleen aanroepen na validateScore(). */
export function parseScore(raw: string): number {
  return Number(raw.trim().replace(",", "."));
}

/** 8.4 -> "8,4" */
export function formatScore(score: number | string): string {
  return Number(score).toFixed(1).replace(".", ",");
}
