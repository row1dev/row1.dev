export const SCORE_FORBIDDEN_MESSAGE = "Nee, nee geen 8,5 schatjes. Leuk geprobeerd.";

/** Precies één decimaal, met een komma: 0,0 t/m 10,0. */
const SCORE_PATTERN = /^(?:[0-9]|10),[0-9]$/;

/** De naam van de champagne. Meerdere woorden mogen hier wel. */
export function validateName(raw: string): string | null {
  const name = raw.trim();
  if (!name) return "Vul de naam van de champagne in.";
  if (name.length > 120) return "Dat is wel een erg lange naam.";
  return null;
}

/** Het oordeel in één woord. Hier mag maar één woord staan. */
export function validateWord(raw: string): string | null {
  const word = raw.trim();
  if (!word) return "Vul één woord in.";
  if (/\s/.test(word)) return "Precies één woord graag. Geen spaties.";
  if (word.length > 40) return "Dat is wel een erg lang woord.";
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
