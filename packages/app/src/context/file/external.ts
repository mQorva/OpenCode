import type { FileContent } from "@opencode-ai/sdk/v2"

// Der Server liefert für Dateien im Workspace `{ type, content, mimeType? }`. Außerhalb
// des Workspace liest der Desktop die Bytes selbst; hier entsteht dieselbe Struktur,
// damit das Datei-Panel unverändert rendern kann.
export function fileContentFromBytes(path: string, bytes: Uint8Array): FileContent {
  const text = decodeText(bytes)
  if (text !== undefined) return { type: "text", content: text.trim() }
  return {
    type: "binary",
    content: base64FromBytes(bytes),
    encoding: "base64",
    mimeType: mimeTypeForPath(path),
  }
}

function decodeText(bytes: Uint8Array): string | undefined {
  if (bytes.includes(0)) return undefined
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    return undefined
  }
}

function base64FromBytes(bytes: Uint8Array) {
  let binary = ""
  const chunk = 0x8000
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk))
  }
  return btoa(binary)
}

// `File` leitet den MIME-Typ aus der Endung ab, ohne dass hier eine eigene Tabelle nötig ist.
function mimeTypeForPath(path: string) {
  const name = path.split(/[\\/]/).pop() ?? path
  return new File([], name).type || "application/octet-stream"
}
