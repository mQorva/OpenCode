import { createSignal } from "solid-js"

// mQorva: Markdown-Dateien im Seitenpanel wahlweise gerendert oder als Quelltext anzeigen.
// OpenCode kennt nur die Betriebsarten "text" und "diff", eine Vorschau gibt es dort nicht.

const STORAGE_KEY = "opencode.mqorva.markdown-preview"
const EXTENSIONS = [".md", ".markdown", ".mdx"]

export function isMarkdownPath(path: string | undefined | null) {
  if (!path) return false
  const lower = path.toLowerCase()
  return EXTENSIONS.some((ext) => lower.endsWith(ext))
}

function initial() {
  if (typeof localStorage === "undefined") return true
  try {
    return localStorage.getItem(STORAGE_KEY) !== "0"
  } catch {
    return true
  }
}

const [enabled, setEnabled] = createSignal(initial())

export const markdownPreview = {
  enabled,
  set(value: boolean) {
    setEnabled(value)
    if (typeof localStorage === "undefined") return
    try {
      localStorage.setItem(STORAGE_KEY, value ? "1" : "0")
    } catch {
      // Speicher nicht verfügbar: Auswahl gilt dann nur für diese Sitzung.
    }
  },
  toggle() {
    markdownPreview.set(!enabled())
  },
}
