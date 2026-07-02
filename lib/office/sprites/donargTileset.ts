/**
 * Donarg Office Tileset — loader, sprite region definitions, and zoom-level cache.
 *
 * The tileset is a 768×1536 PNG containing 16×32 tiles of 48×48 pixels each.
 * Sprite regions are defined as pixel rects within the atlas.
 * At render time, the renderer checks isDonargLoaded() and draws from the
 * tileset via getCachedTilesetSprite() — a pre-rendered canvas at the current zoom,
 * scaled from atlas resolution (48px/tile) down to game resolution (TILE_SIZE=16px/tile).
 */

import { TILE_SIZE } from '../types'
import type { TilesetRef } from '../types'
export type { TilesetRef }

// ── Image loading ────────────────────────────────────────────────

let tilesetImage: HTMLImageElement | null = null
let tilesetLoaded = false
let loadingPromise: Promise<void> | null = null

/** Load the Donarg tileset image. Safe to call multiple times. */
export async function loadDonargTileset(): Promise<void> {
  if (tilesetLoaded) return
  if (loadingPromise) return loadingPromise
  loadingPromise = new Promise<void>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      tilesetImage = img
      tilesetLoaded = true
      resolve()
    }
    img.onerror = () => reject(new Error('Failed to load Donarg tileset'))
    img.src = '/sprites/donarg/office-tileset.png'
  })
  return loadingPromise
}

export function isDonargLoaded(): boolean {
  return tilesetLoaded
}

export function getDonargImage(): HTMLImageElement | null {
  return tilesetImage
}

// ── Tile coordinate helpers ─────────────────────────────────────

/** Pixels per tile in the atlas image (48×48 no-shadow variant) */
export const ATLAS_TILE_PX = 48

/** Create a TilesetRef from tile coordinates (col, row) and size in tiles */
function t(col: number, row: number, w = 1, h = 1): TilesetRef {
  return { sx: col * ATLAS_TILE_PX, sy: row * ATLAS_TILE_PX, sw: w * ATLAS_TILE_PX, sh: h * ATLAS_TILE_PX }
}

// ── Sprite region definitions ───────────────────────────────────
// All coordinates are tile-based (col, row) in the 16×32 grid.
// Multi-tile sprites span (w×h) tiles.

// ── Desks (rows 0-3) ──
export const DONARG_DESK_WOOD   = t(0, 0, 3, 2)   // Wooden desk 3×2
export const DONARG_DESK_WOOD_S = t(4, 0, 2, 2)   // Wooden desk 2×2 (small)
export const DONARG_DESK_GREY   = t(8, 0, 3, 2)   // Grey/dark desk 3×2
export const DONARG_DESK_GREY_S = t(12, 0, 2, 2)  // Grey desk 2×2

// Blue/white desks (row 2-3)
export const DONARG_DESK_BLUE   = t(0, 2, 3, 2)
export const DONARG_DESK_BLUE_S = t(4, 2, 2, 2)

// ── Storage / Cabinets (rows 4-5) ──
export const DONARG_DRAWER_1      = t(0, 4, 1, 2)  // Small drawer
export const DONARG_DRAWER_2      = t(1, 4, 1, 2)
export const DONARG_CABINET_WOOD  = t(2, 4, 2, 2)
export const DONARG_CABINET_GREY  = t(4, 4, 2, 2)
export const DONARG_FILING_CAB    = t(6, 4, 1, 2)
export const DONARG_FILING_CAB_2  = t(7, 4, 1, 2)

// ── Shelving (rows 6-7) ──
export const DONARG_CLOSET_1  = t(0, 6, 2, 2)
export const DONARG_CLOSET_2  = t(2, 6, 2, 2)
export const DONARG_CLOSET_3  = t(4, 6, 2, 2)

// ── Bookshelves (rows 8-9) ──
export const DONARG_BOOKSHELF_1    = t(0, 8, 2, 2)   // Bookshelf with books
export const DONARG_BOOKSHELF_2    = t(2, 8, 2, 2)
export const DONARG_BOOKSHELF_3    = t(4, 8, 2, 2)
export const DONARG_BOOKSHELF_4    = t(6, 8, 2, 2)

// ── Display cases (rows 10-11) ──
export const DONARG_DISPLAY_1      = t(0, 10, 2, 2)
export const DONARG_DISPLAY_2      = t(2, 10, 2, 2)
export const DONARG_BOOKSHELF_TALL = t(8, 10, 1, 2)   // Tall narrow bookshelf
export const DONARG_BOOKSHELF_FULL = t(9, 10, 1, 2)   // Full bookshelf
export const DONARG_CABINET_TALL   = t(10, 10, 1, 2)
export const DONARG_BOOKSHELF_WIDE = t(12, 10, 2, 2)  // Wide bookshelf
export const DONARG_BOOKSHELF_W2   = t(14, 10, 2, 2)

// ── Chairs / Seating (rows 16-17) ──
// NOTE: Rows 12-15 contain additional closets/wardrobes in the tileset,
// so all items originally estimated at row 12+ are shifted down by 4.
export const DONARG_CHAIR_FRONT  = t(0, 16, 1, 1)
export const DONARG_CHAIR_BACK   = t(1, 16, 1, 1)
export const DONARG_CHAIR_RIGHT  = t(2, 16, 1, 1)
export const DONARG_CHAIR_LEFT   = t(3, 16, 1, 1)
export const DONARG_SWIVEL_FRONT = t(4, 16, 1, 1)
export const DONARG_SWIVEL_BACK  = t(5, 16, 1, 1)
export const DONARG_SWIVEL_RIGHT = t(6, 16, 1, 1)
export const DONARG_SWIVEL_LEFT  = t(7, 16, 1, 1)
export const DONARG_ARMCHAIR_1   = t(8, 16, 1, 1)
export const DONARG_ARMCHAIR_2   = t(9, 16, 1, 1)
export const DONARG_COUCH_1      = t(10, 16, 2, 1)  // 2-wide couch
export const DONARG_COUCH_2      = t(12, 16, 2, 1)

// Row 17: More seating + small items
export const DONARG_STOOL        = t(0, 17, 1, 1)
export const DONARG_MUG_1        = t(8, 17, 1, 1)
export const DONARG_MUG_2        = t(9, 17, 1, 1)
export const DONARG_SIDE_TABLE   = t(4, 17, 1, 1)

// ── Small furniture (rows 18-19) ──
export const DONARG_TABLE_SMALL_1 = t(0, 18, 1, 1)
export const DONARG_TABLE_SMALL_2 = t(1, 18, 1, 1)
export const DONARG_STAND_1       = t(2, 18, 1, 1)

// ── Accessories (rows 20-21) ──
export const DONARG_COOLER       = t(0, 20, 1, 2)   // Water cooler
export const DONARG_VENDING      = t(2, 20, 2, 2)   // Vending machine
export const DONARG_FRIDGE       = t(4, 20, 1, 2)   // Fridge

// ── Monitors & Electronics (rows 22-23) ──
// Row 22: c0-c3 are wall clocks, c4+ are window/monitor components
export const DONARG_MONITOR_CRT     = t(0, 22, 1, 1)
export const DONARG_MONITOR_CRT_ON  = t(1, 22, 1, 1)
export const DONARG_MONITOR_FLAT    = t(2, 22, 1, 1)
export const DONARG_MONITOR_FLAT_ON = t(3, 22, 1, 1)
export const DONARG_LAPTOP          = t(4, 22, 1, 1)
export const DONARG_LAPTOP_ON       = t(5, 22, 1, 1)
export const DONARG_KEYBOARD        = t(6, 22, 1, 1)
export const DONARG_PHONE           = t(8, 22, 1, 1)
export const DONARG_PHONE_2         = t(9, 22, 1, 1)

// Row 23: More peripherals
export const DONARG_CLOCK_SMALL   = t(0, 23, 1, 1)
export const DONARG_CLOCK_SMALL_2 = t(1, 23, 1, 1)

// ── Large electronics (rows 24-25) ──
export const DONARG_PRINTER       = t(0, 24, 2, 2)
export const DONARG_SERVER        = t(2, 24, 1, 2)
export const DONARG_COFFEE_MACHINE = t(4, 24, 1, 2)

// ── Charts / Boards (rows 26-27) ──
export const DONARG_BOARD_1  = t(0, 26, 2, 2)    // Chalkboard (green board, gold frame)
export const DONARG_CHART_1  = t(2, 26, 2, 2)    // Bar chart display
export const DONARG_CHART_2  = t(4, 26, 2, 2)    // Pie chart display
export const DONARG_CHART_3  = t(6, 26, 2, 2)    // Chart variant

// ── Paintings (rows 28-29) ──
export const DONARG_PAINTING_1     = t(0, 28, 2, 2)   // Report/chart painting
export const DONARG_PAINTING_2     = t(2, 28, 2, 2)   // Small plant display
export const DONARG_PAINTING_SM_1  = t(4, 28, 1, 2)   // Small painting
export const DONARG_PAINTING_SM_2  = t(5, 28, 1, 2)
export const DONARG_PAINTING_SM_3  = t(6, 28, 1, 2)
export const DONARG_CERT_FRAME     = t(7, 28, 1, 2)   // Certificate frame

// ── Windows & wall items (row 30 top half only — bottom half is rugs) ──
export const DONARG_WINDOW_DBL_1  = t(0, 30, 2, 1)   // Double window (teal frame)
export const DONARG_WINDOW_DBL_2  = t(2, 30, 2, 1)   // Double window (gold frame)
export const DONARG_WINDOW_DBL_3  = t(4, 30, 2, 1)   // Double window (blue decorative)
export const DONARG_WINDOW_SM_1   = t(6, 30, 1, 1)   // Small window / mirror
export const DONARG_WINDOW_SM_2   = t(7, 30, 1, 1)
export const DONARG_CLOCK_WALL    = t(8, 26, 1, 1)    // Wall clock (row 26 right side)
export const DONARG_CLOCK_WALL_2  = t(9, 26, 1, 1)

// Plants (rows 28-29, cols 4-7 — tall potted plants)
export const DONARG_PLANT_1  = t(4, 28, 1, 2)    // Plant variant 1
export const DONARG_PLANT_2  = t(5, 28, 1, 2)    // Plant variant 2
export const DONARG_PLANT_3  = t(6, 28, 1, 2)    // Plant variant 3

// ── Floor mats / Rugs (rows 30-31, right side or overlapping) ──
// Rugs share the chart/board rows; placed at different columns
export const DONARG_RUG_1     = t(0, 14, 2, 2)   // Using closet-area pattern as rug fallback
export const DONARG_RUG_2     = t(2, 14, 2, 2)
export const DONARG_RUG_3     = t(4, 14, 2, 2)

// ── Counters / Reception ──
export const DONARG_COUNTER_1 = t(8, 14, 3, 2)   // Counter from closet section
export const DONARG_COUNTER_2 = t(12, 14, 2, 2)
export const DONARG_BOXES_1   = t(8, 28, 1, 2)   // Cardboard boxes
export const DONARG_BOXES_2   = t(9, 28, 2, 2)   // More boxes

// ── Zoom-level sprite cache ─────────────────────────────────────

const tilesetCache = new Map<string, HTMLCanvasElement>()

function cacheKey(ref: TilesetRef, zoom: number): string {
  return `${ref.sx},${ref.sy},${ref.sw},${ref.sh},${zoom}`
}

/**
 * Scale factor from atlas pixel size to game pixel size.
 * Atlas uses 48px/tile, game uses TILE_SIZE (16px/tile).
 * Each atlas pixel maps to TILE_SIZE/ATLAS_TILE_PX game pixels.
 */
const ATLAS_TO_GAME = TILE_SIZE / ATLAS_TILE_PX

/**
 * Get a pre-rendered canvas of a tileset region at the given zoom level.
 * Returns null if tileset is not loaded.
 * Scales from atlas resolution (48px/tile) to game resolution (16px/tile).
 * Canvas has imageSmoothingEnabled=false for crisp pixel art.
 */
export function getCachedTilesetSprite(ref: TilesetRef, zoom: number): HTMLCanvasElement | null {
  if (!tilesetImage) return null

  const key = cacheKey(ref, zoom)
  const cached = tilesetCache.get(key)
  if (cached) return cached

  // Destination size: scale from atlas pixels to game pixels, then by zoom
  const dw = Math.round(ref.sw * ATLAS_TO_GAME * zoom)
  const dh = Math.round(ref.sh * ATLAS_TO_GAME * zoom)

  const canvas = document.createElement('canvas')
  canvas.width = dw
  canvas.height = dh
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(
    tilesetImage,
    ref.sx, ref.sy, ref.sw, ref.sh,
    0, 0, dw, dh,
  )
  tilesetCache.set(key, canvas)
  return canvas
}

/** Clear the tileset sprite cache (e.g., on hot reload) */
export function clearTilesetCache(): void {
  tilesetCache.clear()
}
