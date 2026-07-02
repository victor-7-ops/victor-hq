/**
 * MetroCity Sprite Sheet Loader & Compositor
 *
 * Loads MetroCity pixel-art sprite sheets (body, hair, outfits) and
 * composites them into per-agent sprite frames for the office engine.
 *
 * Sprite sheets layout (all 32×32 px frames, 24 frames per row):
 *   Character Model: 768×192 → 24 cols × 6 rows (6 skin tones)
 *   Hairs.png:       768×256 → 24 cols × 8 rows (8 hair styles)
 *   Outfit1-6.png:   768×32  → 24 cols × 1 row  (one outfit per file)
 *   Suit.png:        768×128 → 24 cols × 4 rows  (4 suit variants)
 *   Shadow.png:      32×32   → single shadow sprite
 *
 * Frame layout per row (24 frames = 4 directions × 6 frames):
 *   Frames  0-5:  Walk Down  (south)
 *   Frames  6-11: Walk Left  (west)
 *   Frames 12-17: Walk Right (east)
 *   Frames 18-23: Walk Up    (north)
 */

import { Direction } from '../types'

// ── Constants ────────────────────────────────────────────────────

export const MC_FRAME_W = 32
export const MC_FRAME_H = 32
export const MC_COLS = 24 // frames per row (768 / 32)
export const MC_FRAMES_PER_DIR = 6
export const MC_SKIN_TONES = 6
export const MC_HAIR_STYLES = 8
export const MC_OUTFIT_COUNT = 6
export const MC_SUIT_ROWS = 4

/** Direction → first frame index in the 24-frame row */
export const MC_DIR_OFFSET: Record<number, number> = {
  [Direction.DOWN]: 0,
  [Direction.LEFT]: 6,
  [Direction.RIGHT]: 12,
  [Direction.UP]: 18,
}

// ── Appearance Type ─────────────────────────────────────────────

export interface MetroCityAppearance {
  skinTone: number   // 0-5 (row in Character Model)
  hairStyle: number  // 0-7 (row in Hairs.png)
  outfitType: 'outfit' | 'suit'
  outfitIndex: number // 0-5 for outfits, 0-3 for suits
}

// ── Sheets ──────────────────────────────────────────────────────

let bodySheet: HTMLImageElement | null = null
let hairSheet: HTMLImageElement | null = null
let shadowImg: HTMLImageElement | null = null
let suitSheet: HTMLImageElement | null = null
const outfitSheets: (HTMLImageElement | null)[] = new Array(MC_OUTFIT_COUNT).fill(null)

let loaded = false
let loadingPromise: Promise<void> | null = null

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load: ${src}`))
    img.src = src
  })
}

/** Load all MetroCity sprite sheets. Safe to call multiple times. */
export async function loadMetroCitySheets(): Promise<void> {
  if (loaded) return
  if (loadingPromise) return loadingPromise

  loadingPromise = (async () => {
    const results = await Promise.all([
      loadImage('/sprites/metrocity/CharacterModel/CharacterModel.png'),
      loadImage('/sprites/metrocity/Hair/Hairs.png'),
      loadImage('/sprites/metrocity/CharacterModel/Shadow.png'),
      loadImage('/sprites/metrocity/Suit.png'),
      ...Array.from({ length: MC_OUTFIT_COUNT }, (_, i) =>
        loadImage(`/sprites/metrocity/Outfits/Outfit${i + 1}.png`)
      ),
    ])

    bodySheet = results[0]
    hairSheet = results[1]
    shadowImg = results[2]
    suitSheet = results[3]
    for (let i = 0; i < MC_OUTFIT_COUNT; i++) {
      outfitSheets[i] = results[4 + i]
    }
    loaded = true
  })()

  return loadingPromise
}

export function isMetroCityLoaded(): boolean {
  return loaded
}

export function getShadowImage(): HTMLImageElement | null {
  return shadowImg
}

// ── Frame Compositing ───────────────────────────────────────────

/** Cache: appearance key → array of 24 HTMLCanvasElement frames */
const frameCache = new Map<string, HTMLCanvasElement[]>()

function appearanceKey(app: MetroCityAppearance): string {
  return `${app.skinTone}-${app.hairStyle}-${app.outfitType}-${app.outfitIndex}`
}

/** Composite all 24 frames for a given appearance. Cached. */
export function getCompositeFrames(app: MetroCityAppearance): HTMLCanvasElement[] {
  const key = appearanceKey(app)
  const cached = frameCache.get(key)
  if (cached) return cached

  if (!bodySheet || !hairSheet) return []

  const frames: HTMLCanvasElement[] = []
  for (let i = 0; i < MC_COLS; i++) {
    const canvas = document.createElement('canvas')
    canvas.width = MC_FRAME_W
    canvas.height = MC_FRAME_H
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false

    // Layer 1: Body (skin tone)
    ctx.drawImage(
      bodySheet,
      i * MC_FRAME_W, app.skinTone * MC_FRAME_H,
      MC_FRAME_W, MC_FRAME_H,
      0, 0, MC_FRAME_W, MC_FRAME_H,
    )

    // Layer 2: Outfit
    if (app.outfitType === 'outfit') {
      const sheet = outfitSheets[app.outfitIndex]
      if (sheet) {
        ctx.drawImage(
          sheet,
          i * MC_FRAME_W, 0,
          MC_FRAME_W, MC_FRAME_H,
          0, 0, MC_FRAME_W, MC_FRAME_H,
        )
      }
    } else if (suitSheet) {
      ctx.drawImage(
        suitSheet,
        i * MC_FRAME_W, app.outfitIndex * MC_FRAME_H,
        MC_FRAME_W, MC_FRAME_H,
        0, 0, MC_FRAME_W, MC_FRAME_H,
      )
    }

    // Layer 3: Hair
    ctx.drawImage(
      hairSheet,
      i * MC_FRAME_W, app.hairStyle * MC_FRAME_H,
      MC_FRAME_W, MC_FRAME_H,
      0, 0, MC_FRAME_W, MC_FRAME_H,
    )

    frames.push(canvas)
  }

  frameCache.set(key, frames)
  return frames
}

// ── Per-frame zoom cache ────────────────────────────────────────

const zoomCacheMap = new WeakMap<HTMLCanvasElement, Map<number, HTMLCanvasElement>>()

/** Get a zoomed version of a composited frame. Cached per zoom level. */
export function getZoomedMetroCityFrame(
  frame: HTMLCanvasElement,
  zoom: number,
): HTMLCanvasElement {
  let zoomMap = zoomCacheMap.get(frame)
  if (!zoomMap) {
    zoomMap = new Map()
    zoomCacheMap.set(frame, zoomMap)
  }
  let cached = zoomMap.get(zoom)
  if (!cached) {
    const w = MC_FRAME_W * zoom
    const h = MC_FRAME_H * zoom
    cached = document.createElement('canvas')
    cached.width = w
    cached.height = h
    const ctx = cached.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(frame, 0, 0, w, h)
    zoomMap.set(zoom, cached)
  }
  return cached
}

// ── Convenience: Get a specific direction + frame ───────────────

/**
 * Get the composited, zoomed canvas for a specific pose.
 * Returns null if sheets aren't loaded yet.
 */
export function getMetroCityCharacterFrame(
  appearance: MetroCityAppearance,
  direction: number,
  frameIndex: number,
  zoom: number,
): HTMLCanvasElement | null {
  if (!loaded) return null
  const frames = getCompositeFrames(appearance)
  if (frames.length === 0) return null

  const dirOffset = MC_DIR_OFFSET[direction] ?? 0
  const idx = dirOffset + (frameIndex % MC_FRAMES_PER_DIR)
  return getZoomedMetroCityFrame(frames[idx], zoom)
}

// ── Shadow zoom cache ───────────────────────────────────────────

const shadowZoomCache = new Map<number, HTMLCanvasElement>()

export function getZoomedShadow(zoom: number): HTMLCanvasElement | null {
  if (!shadowImg) return null
  let cached = shadowZoomCache.get(zoom)
  if (cached) return cached

  const w = shadowImg.width * zoom
  const h = shadowImg.height * zoom
  cached = document.createElement('canvas')
  cached.width = w
  cached.height = h
  const ctx = cached.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(shadowImg, 0, 0, w, h)
  shadowZoomCache.set(zoom, cached)
  return cached
}

// ── Appearance Assignment ───────────────────────────────────────

/**
 * Deterministically pick a unique MetroCity appearance for an agent
 * based on their numeric ID. Ensures visual diversity.
 */
export function pickAppearance(agentId: number): MetroCityAppearance {
  // Use simple hashing to distribute appearances
  const hash = Math.abs(agentId * 2654435761) >>> 0 // Knuth multiplicative hash
  const skinTone = hash % MC_SKIN_TONES
  const hairStyle = (hash >>> 4) % MC_HAIR_STYLES

  // Mix of outfits and suits (70% outfits, 30% suits)
  const outfitRoll = (hash >>> 8) % 10
  if (outfitRoll < 7) {
    return {
      skinTone,
      hairStyle,
      outfitType: 'outfit',
      outfitIndex: (hash >>> 12) % MC_OUTFIT_COUNT,
    }
  } else {
    return {
      skinTone,
      hairStyle,
      outfitType: 'suit',
      outfitIndex: (hash >>> 12) % MC_SUIT_ROWS,
    }
  }
}

// ── Outline generation for MetroCity frames ─────────────────────

const mcOutlineCache = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>()

/**
 * Generate a 1px white outline canvas for a MetroCity frame.
 * The outline is 2px wider/taller than the source.
 */
export function getMetroCityOutline(frame: HTMLCanvasElement): HTMLCanvasElement {
  const cached = mcOutlineCache.get(frame)
  if (cached) return cached

  const w = frame.width
  const h = frame.height
  const ctx = frame.getContext('2d')!
  const imageData = ctx.getImageData(0, 0, w, h)
  const { data } = imageData

  // Create outline canvas (2px larger in each dimension)
  const outCanvas = document.createElement('canvas')
  outCanvas.width = w + 2
  outCanvas.height = h + 2
  const outCtx = outCanvas.getContext('2d')!
  const outData = outCtx.createImageData(w + 2, h + 2)
  const out = outData.data

  // For each opaque pixel, mark 4 cardinal neighbors as white
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const alpha = data[(y * w + x) * 4 + 3]
      if (alpha < 128) continue

      // Mark neighbors in outline buffer (offset by 1)
      const neighbors = [
        [(x + 1) - 1, (y + 1)],
        [(x + 1) + 1, (y + 1)],
        [(x + 1), (y + 1) - 1],
        [(x + 1), (y + 1) + 1],
      ]
      for (const [nx, ny] of neighbors) {
        if (nx < 0 || nx >= w + 2 || ny < 0 || ny >= h + 2) continue
        const oi = (ny * (w + 2) + nx) * 4
        // Don't overwrite already set pixels
        if (out[oi + 3] > 0) continue
        out[oi] = 255     // R
        out[oi + 1] = 255 // G
        out[oi + 2] = 255 // B
        out[oi + 3] = 255 // A
      }
    }
  }

  // Clear pixels that overlap with original opaque pixels
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const alpha = data[(y * w + x) * 4 + 3]
      if (alpha < 128) continue
      const oi = ((y + 1) * (w + 2) + (x + 1)) * 4
      out[oi] = 0
      out[oi + 1] = 0
      out[oi + 2] = 0
      out[oi + 3] = 0
    }
  }

  outCtx.putImageData(outData, 0, 0)
  mcOutlineCache.set(frame, outCanvas)
  return outCanvas
}

const mcOutlineZoomCache = new WeakMap<HTMLCanvasElement, Map<number, HTMLCanvasElement>>()

export function getZoomedMetroCityOutline(
  frame: HTMLCanvasElement,
  zoom: number,
): HTMLCanvasElement {
  const outline = getMetroCityOutline(frame)
  let zoomMap = mcOutlineZoomCache.get(outline)
  if (!zoomMap) {
    zoomMap = new Map()
    mcOutlineZoomCache.set(outline, zoomMap)
  }
  let cached = zoomMap.get(zoom)
  if (!cached) {
    const w = outline.width * zoom
    const h = outline.height * zoom
    cached = document.createElement('canvas')
    cached.width = w
    cached.height = h
    const ctx = cached.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(outline, 0, 0, w, h)
    zoomMap.set(zoom, cached)
  }
  return cached
}
