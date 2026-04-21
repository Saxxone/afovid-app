/**
 * Post body URL/mention tokenization (aligned with web `postRichText.ts`).
 */

export const url_pattern =
  /\b(https?:\/\/[a-z0-9.-]+[^\s]*)|\b(www\.[a-z0-9-]+(?:\.[a-z0-9-]+)+[^\s]*)|\b([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9](?:\/[^\s]*)?/gi;

export const mention_pattern = /(?:^|\s)(\.?[@][a-zA-Z0-9_]{1,})(?:\b|$|\s)/g;

export function hrefForUrlToken(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  if (/^www\./i.test(candidate)) {
    candidate = `https://${candidate}`;
  } else if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  try {
    const u = new URL(candidate);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.href;
  } catch {
    return null;
  }
}

export function parseMentionFromToken(word: string): {
  leadingDot: boolean;
  username: string;
} | null {
  mention_pattern.lastIndex = 0;
  if (!word.match(mention_pattern)) return null;

  let username: string;
  let leadingDot = false;
  if (word.startsWith(".")) {
    leadingDot = true;
    username = word.slice(2);
  } else {
    username = word.slice(1);
  }
  if (!username || !/^[a-zA-Z0-9_]+$/.test(username)) return null;
  return { leadingDot, username };
}

export type RichSegment =
  | { type: "text"; text: string }
  | { type: "link"; text: string; href: string }
  | { type: "mention"; text: string; username: string; leadingDot: boolean };

function pushText(acc: RichSegment[], text: string) {
  if (!text) return;
  const last = acc[acc.length - 1];
  if (last?.type === "text") {
    last.text += text;
  } else {
    acc.push({ type: "text", text });
  }
}

/** Space-delimited tokenization (same contract as web HTML formatter). */
export function tokenizePostRichText(text: string): RichSegment[] {
  if (!text) return [];
  const acc: RichSegment[] = [];
  const words = text.split(" ");
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const spacePrefix = i > 0 ? " " : "";
    if (word === "") {
      pushText(acc, spacePrefix);
      continue;
    }

    url_pattern.lastIndex = 0;
    if (word.match(url_pattern)) {
      const href = hrefForUrlToken(word);
      pushText(acc, spacePrefix);
      if (href) {
        acc.push({ type: "link", text: word, href });
      } else {
        pushText(acc, word);
      }
      continue;
    }

    mention_pattern.lastIndex = 0;
    if (word.match(mention_pattern)) {
      const m = parseMentionFromToken(word);
      pushText(acc, spacePrefix);
      if (m) {
        acc.push({
          type: "mention",
          text: `${m.leadingDot ? "." : ""}@${m.username}`,
          username: m.username,
          leadingDot: m.leadingDot,
        });
      } else {
        pushText(acc, word);
      }
      continue;
    }

    pushText(acc, `${spacePrefix}${word}`);
  }
  return acc;
}
