/**
 * A display name someone typed (Settings, the table screen; session 27): trimmed, one space between words, no control
 * characters or angle brackets, 24 characters at most. Null: there's no letter in it.
 */
export function cleanName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const name = v
    .replace(/[\u0000-\u001f\u007f<>]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 24)
    .trim();
  return /\p{L}/u.test(name) ? name : null;
}

/** The bots' names, in seat order. Also caps how many bots a local game can have. */
export const BOT_NAMES = ["Lady Morwen", "Baron Krell", "Queen Isolde", "Warlord Rusk", "Duke Varric", "Countess Ylva", "Lord Abern", "the Grey Margrave", "Thane Oskar"];
