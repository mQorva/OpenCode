import type { Part, TextPart } from "@opencode-ai/sdk/v2"

/** Longest non-synthetic text part — the one a message actually said. */
export function longestText(parts: Part[]) {
  return parts
    .filter((part): part is TextPart => part.type === "text" && !part.synthetic && !part.ignored)
    .reduce((best, part) => (part.text.length > best.length ? part.text : best), "")
}

/** All text an assistant turn produced, in order. */
export function joinedText(parts: Part[]) {
  return parts
    .filter((part): part is TextPart => part.type === "text" && !part.synthetic && !part.ignored)
    .map((part) => part.text)
    .join("\n")
}

/**
 * Markdown reads badly in a three-line preview — asterisks and fences become noise. Strip the
 * syntax and keep the words, so the box shows what was said rather than how it was marked up.
 */
export function plainPreview(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/~~~[\s\S]*?~~~/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, "")
    .replace(/^[ \t]{0,3}>[ \t]?/gm, "")
    .replace(/^[ \t]{0,3}(?:[-*+]|\d+\.)[ \t]+/gm, "")
    .replace(/^[ \t]{0,3}(?:[-*_][ \t]*){3,}$/gm, " ")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,;:!?]|$)/g, "$1$2")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
}

/** First line of a prompt, used as the preview's headline. */
export function firstLine(value: string) {
  return (
    value
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean) ?? ""
  )
}
