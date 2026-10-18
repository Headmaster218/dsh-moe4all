/** Offline content previews rendered in an opaque-origin sandbox, never in the Agent DOM. */
import { unzipSync } from 'fflate/browser'
import { pptxToHtml } from '@jvmr/pptx-to-html'
import type { WorkspaceFileReply } from '@deepseek-ai/dsh-api-remotes/client'

/** Preview-ready file payload. */
export type PreviewFile = Extract<WorkspaceFileReply, { kind: 'file' }>

/** Decode the wire's canonical base64 into browser bytes.
 * @param encoded - Validated file bytes.
 * @returns Independent byte array.
 */
export function previewBytes(encoded: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(encoded), character => character.charCodeAt(0))
}

/** Network and host access stay disabled even for interactive HTML slides. */
export const PREVIEW_CSP = "default-src 'none'; img-src data: blob:; media-src data: blob:; style-src 'unsafe-inline' data:; font-src data:; script-src 'unsafe-inline' data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"

/** Wrap untrusted HTML with a policy applied before any content is parsed.
 * @param html - Local document or converted PPTX slide.
 * @returns The iframe's srcdoc, used only with sandbox without allow-same-origin.
 */
export function sandboxDocument(html: string): string {
  return `<!doctype html><meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}"><meta name="referrer" content="no-referrer">${html}`
}

/** Resolve only relative workspace assets; never fetch an external URL.
 * @param owner - Workspace-relative document path.
 * @param source - A relative URL in the document.
 * @returns Workspace-relative path, or null for remote/unsupported URLs.
 */
export function previewAssetPath(owner: string, source: string): string | null {
  if (source === '' || source.startsWith('#') || /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/|\\)/i.test(source)) return null
  const base = owner.replaceAll('\\', '/').split('/').slice(0, -1)
  let decoded: string
  try { decoded = decodeURIComponent(source.split(/[?#]/)[0]!) } catch { return null }
  for (const segment of decoded.replaceAll('\\', '/').split('/')) {
    if (segment === '..') { if (base.length === 0) return null; base.pop() }
    else if (segment !== '' && segment !== '.') base.push(segment)
  }
  return base.join('/')
}

/** Inline bounded local image/style/script assets before applying the sandbox.
 * @param file - HTML file payload.
 * @param load - Same-session workspace-contained file reader.
 * @param signal - Preview lifetime.
 * @returns HTML for a self-contained offline iframe.
 */
export async function htmlPreview(file: PreviewFile, load: (path: string) => Promise<PreviewFile>, signal: AbortSignal): Promise<string> {
  const document = new DOMParser().parseFromString(sandboxDocument(new TextDecoder().decode(previewBytes(file.dataBase64))), 'text/html')
  for (const element of document.querySelectorAll('base, meta[http-equiv="refresh"]')) element.remove()
  const resources = [...document.querySelectorAll('img[src], script[src], link[rel="stylesheet"][href]')]
  if (resources.length > 64) throw new Error('Preview contains too many local assets')
  let total = 0
  for (const element of resources) {
    signal.throwIfAborted()
    const attribute = element.tagName === 'LINK' ? 'href' : 'src'
    const source = element.getAttribute(attribute) ?? ''
    if (/^data:/i.test(source)) continue
    const path = previewAssetPath(file.path, source)
    if (path === null) { element.removeAttribute(attribute); continue }
    const asset = await load(path)
    total += asset.size
    if (total > 32 * 1024 * 1024) throw new Error('Preview assets exceed the size limit')
    const mime = element.tagName === 'SCRIPT' ? 'text/javascript' : element.tagName === 'LINK' ? 'text/css' : asset.mime
    element.setAttribute(attribute, `data:${mime};base64,${asset.dataBase64}`)
  }
  signal.throwIfAborted()
  return sandboxDocument(document.documentElement.outerHTML)
}

/** Convert a bounded PPTX package with the MIT-licensed renderer, not a custom OOXML parser.
 * @param file - PPTX file bytes.
 * @param signal - Preview lifetime, checked before and after conversion.
 * @returns One offline HTML document per slide. Complex Office features are not pixel-authoritative.
 */
export async function presentationPreview(file: PreviewFile, signal: AbortSignal): Promise<string[]> {
  signal.throwIfAborted()
  const bytes = previewBytes(file.dataBase64)
  let total = 0; let count = 0; let slideCount = 0
  unzipSync(bytes, { filter: entry => {
    total += entry.originalSize; count++
    if (total > 64 * 1024 * 1024 || count > 4096) throw new Error('Presentation expands beyond the preview limit')
    if (/^ppt\/slides\/slide\d+\.xml$/i.test(entry.name) && ++slideCount > 200) throw new Error('Presentation exceeds the slide limit')
    return false
  } })
  signal.throwIfAborted()
  const slides = await pptxToHtml(bytes.buffer, { width: 960, height: 540, scaleToFit: true, letterbox: true })
  signal.throwIfAborted()
  if (slides.length === 0 || slides.length > 200) throw new Error('Presentation has no slides or exceeds the slide limit')
  return slides.map(slide => sandboxDocument(`<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#fff}#slide{width:960px;height:540px;transform-origin:0 0}</style><div id="slide">${slide}</div><script>function fit(){var e=document.getElementById('slide');e.style.transform='scale('+Math.min(innerWidth/960,innerHeight/540)+')'}addEventListener('resize',fit);fit()</script>`))
}
