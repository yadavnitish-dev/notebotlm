export function normalizeTextForSearch(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function looseNormalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildFlexibleSearchRegex(text: string): RegExp {
  const normalized = normalizeTextForSearch(text);
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const flexible = escaped.replace(/\s+/g, "\\s+");
  return new RegExp(flexible, "gi");
}

/** Progressive search phrases — full text first, then shorter prefixes. */
export function buildSearchAttempts(text: string): string[] {
  const normalized = normalizeTextForSearch(text);
  if (!normalized) return [];

  const attempts: string[] = [normalized];

  const colonParts = normalized.split(/:\s*/);
  if (colonParts.length > 1) {
    const afterColon = colonParts.slice(1).join(": ").trim();
    const beforeColon = colonParts[0]?.trim() ?? "";
    if (afterColon.length >= 5) attempts.push(afterColon);
    if (beforeColon.length >= 5) attempts.push(beforeColon);
  }

  const words = normalized.split(" ");

  if (words.length > 8) {
    attempts.push(words.slice(0, 8).join(" "));
  }
  if (words.length > 5) {
    attempts.push(words.slice(0, 5).join(" "));
  }
  if (words.length > 3) {
    attempts.push(words.slice(0, 3).join(" "));
  }

  return [...new Set(attempts.filter((attempt) => attempt.length >= 5))];
}

export function findBestTextMatch(
  haystack: string,
  searchText: string,
): { index: number; length: number; matchedText: string } | null {
  const attempts = buildSearchAttempts(searchText);

  for (const attempt of attempts) {
    const index = haystack.toLowerCase().indexOf(attempt.toLowerCase());
    if (index !== -1) {
      return {
        index,
        length: attempt.length,
        matchedText: haystack.slice(index, index + attempt.length),
      };
    }
  }

  const looseHaystack = looseNormalizeText(haystack);
  for (const attempt of attempts) {
    const looseAttempt = looseNormalizeText(attempt);
    const looseIndex = looseHaystack.indexOf(looseAttempt);
    if (looseIndex === -1) continue;

    const looseRegex = new RegExp(
      looseAttempt
        .split(" ")
        .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        .join("[\\s\\W]+"),
      "i",
    );
    const match = looseRegex.exec(haystack);
    if (match) {
      return {
        index: match.index,
        length: match[0].length,
        matchedText: match[0],
      };
    }
  }

  return null;
}

export function textMatchesSearch(
  haystack: string,
  searchText: string,
): boolean {
  const attempts = buildSearchAttempts(searchText);
  const normalizedHaystack = haystack.toLowerCase();
  const looseHaystack = looseNormalizeText(haystack);

  return attempts.some((attempt) => {
    if (normalizedHaystack.includes(attempt.toLowerCase())) return true;
    return looseHaystack.includes(looseNormalizeText(attempt));
  });
}
