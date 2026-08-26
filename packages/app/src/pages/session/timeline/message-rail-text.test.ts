import { describe, expect, test } from "bun:test"
import { firstLine, joinedText, longestText, plainPreview } from "./message-rail-text"
import type { Part } from "@opencode-ai/sdk/v2"

const text = (value: string, extra: Record<string, unknown> = {}) =>
  ({ type: "text", text: value, ...extra }) as unknown as Part

describe("message rail text", () => {
  test("longestText skips synthetic and ignored parts", () => {
    const parts = [text("kurz"), text("viel laenger", { synthetic: true }), text("mittellang")]
    expect(longestText(parts)).toBe("mittellang")
  })

  test("joinedText keeps every part in order", () => {
    expect(joinedText([text("eins"), text("zwei")])).toBe("eins\nzwei")
  })

  test("firstLine takes the first non-empty line", () => {
    expect(firstLine("\n\n  Titel  \nRest")).toBe("Titel")
    expect(firstLine("")).toBe("")
  })

  test("plainPreview strips markdown down to the words", () => {
    expect(plainPreview("## Ueberschrift\n\n- **fett** und *kursiv*")).toBe("Ueberschrift fett und kursiv")
    expect(plainPreview("Siehe `code` und [Link](https://example.com)")).toBe("Siehe code und Link")
    expect(plainPreview("Text\n\n```ts\nconst a = 1\n```\n\nDanach")).toBe("Text Danach")
    expect(plainPreview("> Zitat\n1. eins\n2. zwei")).toBe("Zitat eins zwei")
  })

  test("plainPreview leaves a lone asterisk alone", () => {
    expect(plainPreview("2 * 3 = 6")).toBe("2 * 3 = 6")
  })
})
