import { TileType, FurnitureType, DEFAULT_COLS, DEFAULT_ROWS, TILE_SIZE, Direction } from '../types'
import type { TileType as TileTypeVal, OfficeLayout, PlacedFurniture, Seat, FurnitureInstance, FloorColor } from '../types'
import { getCatalogEntry } from './furnitureCatalog'
import { getColorizedSprite } from '../colorize'

/** Convert flat tile array from layout into 2D grid */
export function layoutToTileMap(layout: OfficeLayout): TileTypeVal[][] {
  const map: TileTypeVal[][] = []
  for (let r = 0; r < layout.rows; r++) {
    const row: TileTypeVal[] = []
    for (let c = 0; c < layout.cols; c++) {
      row.push(layout.tiles[r * layout.cols + c])
    }
    map.push(row)
  }
  return map
}

/** Convert placed furniture into renderable FurnitureInstance[] */
export function layoutToFurnitureInstances(furniture: PlacedFurniture[]): FurnitureInstance[] {
  // Pre-compute desk zY per tile so surface items can sort in front of desks
  const deskZByTile = new Map<string, number>()
  for (const item of furniture) {
    const entry = getCatalogEntry(item.type)
    if (!entry || !entry.isDesk) continue
    const deskZY = item.row * TILE_SIZE + entry.sprite.length
    for (let dr = 0; dr < entry.footprintH; dr++) {
      for (let dc = 0; dc < entry.footprintW; dc++) {
        const key = `${item.col + dc},${item.row + dr}`
        const prev = deskZByTile.get(key)
        if (prev === undefined || deskZY > prev) deskZByTile.set(key, deskZY)
      }
    }
  }

  const instances: FurnitureInstance[] = []
  for (const item of furniture) {
    const entry = getCatalogEntry(item.type)
    if (!entry) continue
    const x = item.col * TILE_SIZE
    const y = item.row * TILE_SIZE
    const spriteH = entry.sprite.length
    let zY = y + spriteH

    // Chair z-sorting: ensure characters sitting on chairs render correctly
    if (entry.category === 'chairs') {
      if (entry.orientation === 'back') {
        // Back-facing chairs render IN FRONT of the seated character
        // (the chair back visually occludes the character behind it)
        zY = (item.row + 1) * TILE_SIZE + 1
      } else {
        // All other chairs: cap zY to first row bottom so characters
        // at any seat tile render in front of the chair
        zY = (item.row + 1) * TILE_SIZE
      }
    }

    // Surface items render in front of the desk they sit on
    if (entry.canPlaceOnSurfaces) {
      for (let dr = 0; dr < entry.footprintH; dr++) {
        for (let dc = 0; dc < entry.footprintW; dc++) {
          const deskZ = deskZByTile.get(`${item.col + dc},${item.row + dr}`)
          if (deskZ !== undefined && deskZ + 0.5 > zY) zY = deskZ + 0.5
        }
      }
    }

    // Colorize sprite if this furniture has a color override
    let sprite = entry.sprite
    if (item.color) {
      const { h, s, b: bv, c: cv } = item.color
      sprite = getColorizedSprite(`furn-${item.type}-${h}-${s}-${bv}-${cv}-${item.color.colorize ? 1 : 0}`, entry.sprite, item.color)
    }

    instances.push({ sprite, x, y, zY, tilesetRef: entry.tilesetRef })
  }
  return instances
}

/** Get all tiles blocked by furniture footprints, optionally excluding a set of tiles.
 *  Skips top backgroundTiles rows so characters can walk through them. */
export function getBlockedTiles(furniture: PlacedFurniture[], excludeTiles?: Set<string>): Set<string> {
  const tiles = new Set<string>()
  for (const item of furniture) {
    const entry = getCatalogEntry(item.type)
    if (!entry) continue
    const bgRows = entry.backgroundTiles || 0
    for (let dr = 0; dr < entry.footprintH; dr++) {
      if (dr < bgRows) continue // skip background rows — characters can walk through
      for (let dc = 0; dc < entry.footprintW; dc++) {
        const key = `${item.col + dc},${item.row + dr}`
        if (excludeTiles && excludeTiles.has(key)) continue
        tiles.add(key)
      }
    }
  }
  return tiles
}

/** Get tiles blocked for placement purposes — skips top backgroundTiles rows per item */
export function getPlacementBlockedTiles(furniture: PlacedFurniture[], excludeUid?: string): Set<string> {
  const tiles = new Set<string>()
  for (const item of furniture) {
    if (item.uid === excludeUid) continue
    const entry = getCatalogEntry(item.type)
    if (!entry) continue
    const bgRows = entry.backgroundTiles || 0
    for (let dr = 0; dr < entry.footprintH; dr++) {
      if (dr < bgRows) continue // skip background rows
      for (let dc = 0; dc < entry.footprintW; dc++) {
        tiles.add(`${item.col + dc},${item.row + dr}`)
      }
    }
  }
  return tiles
}

/** Map chair orientation to character facing direction */
function orientationToFacing(orientation: string): Direction {
  switch (orientation) {
    case 'front': return Direction.DOWN
    case 'back': return Direction.UP
    case 'left': return Direction.LEFT
    case 'right': return Direction.RIGHT
    default: return Direction.DOWN
  }
}

/** Generate seats from chair furniture.
 *  Facing priority: 1) chair orientation, 2) adjacent desk, 3) forward (DOWN). */
export function layoutToSeats(furniture: PlacedFurniture[]): Map<string, Seat> {
  const seats = new Map<string, Seat>()

  // Build set of all desk tiles
  const deskTiles = new Set<string>()
  for (const item of furniture) {
    const entry = getCatalogEntry(item.type)
    if (!entry || !entry.isDesk) continue
    for (let dr = 0; dr < entry.footprintH; dr++) {
      for (let dc = 0; dc < entry.footprintW; dc++) {
        deskTiles.add(`${item.col + dc},${item.row + dr}`)
      }
    }
  }

  const dirs: Array<{ dc: number; dr: number; facing: Direction }> = [
    { dc: 0, dr: -1, facing: Direction.UP },    // desk is above chair → face UP
    { dc: 0, dr: 1, facing: Direction.DOWN },   // desk is below chair → face DOWN
    { dc: -1, dr: 0, facing: Direction.LEFT },   // desk is left of chair → face LEFT
    { dc: 1, dr: 0, facing: Direction.RIGHT },   // desk is right of chair → face RIGHT
  ]

  // For each chair, every footprint tile becomes a seat.
  // Multi-tile chairs (e.g. 2-tile couches) produce multiple seats.
  for (const item of furniture) {
    const entry = getCatalogEntry(item.type)
    if (!entry || entry.category !== 'chairs') continue

    let seatCount = 0
    for (let dr = 0; dr < entry.footprintH; dr++) {
      for (let dc = 0; dc < entry.footprintW; dc++) {
        const tileCol = item.col + dc
        const tileRow = item.row + dr

        // Determine facing direction:
        // 1) Chair orientation takes priority
        // 2) Adjacent desk direction
        // 3) Default forward (DOWN)
        let facingDir: Direction = Direction.DOWN
        if (entry.orientation) {
          facingDir = orientationToFacing(entry.orientation)
        } else {
          for (const d of dirs) {
            if (deskTiles.has(`${tileCol + d.dc},${tileRow + d.dr}`)) {
              facingDir = d.facing
              break
            }
          }
        }

        // First seat uses chair uid (backward compat), subsequent use uid:N
        const seatUid = seatCount === 0 ? item.uid : `${item.uid}:${seatCount}`
        seats.set(seatUid, {
          uid: seatUid,
          seatCol: tileCol,
          seatRow: tileRow,
          facingDir,
          assigned: false,
        })
        seatCount++
      }
    }
  }

  return seats
}

/** Get the set of tiles occupied by seats (so they can be excluded from blocked tiles) */
export function getSeatTiles(seats: Map<string, Seat>): Set<string> {
  const tiles = new Set<string>()
  for (const seat of seats.values()) {
    tiles.add(`${seat.seatCol},${seat.seatRow}`)
  }
  return tiles
}

/** Default floor colors for the two rooms */
const DEFAULT_LEFT_ROOM_COLOR: FloorColor = { h: 35, s: 30, b: 15, c: 0 }  // warm beige
const DEFAULT_RIGHT_ROOM_COLOR: FloorColor = { h: 25, s: 45, b: 5, c: 10 }  // warm brown
const DEFAULT_CARPET_COLOR: FloorColor = { h: 280, s: 40, b: -5, c: 0 }     // purple
const DEFAULT_DOORWAY_COLOR: FloorColor = { h: 35, s: 25, b: 10, c: 0 }     // tan

/** Create the default office layout matching the current hardcoded office */
export function createDefaultLayout(): OfficeLayout {
  const W = TileType.WALL
  const F1 = TileType.FLOOR_1
  const F2 = TileType.FLOOR_2
  const F3 = TileType.FLOOR_3
  const F4 = TileType.FLOOR_4

  const tiles: TileTypeVal[] = []
  const tileColors: Array<FloorColor | null> = []

  for (let r = 0; r < DEFAULT_ROWS; r++) {
    for (let c = 0; c < DEFAULT_COLS; c++) {
      if (r === 0 || r === DEFAULT_ROWS - 1) { tiles.push(W); tileColors.push(null); continue }
      if (c === 0 || c === DEFAULT_COLS - 1) { tiles.push(W); tileColors.push(null); continue }
      if (c === 10) {
        if (r >= 4 && r <= 6) {
          tiles.push(F4); tileColors.push(DEFAULT_DOORWAY_COLOR)
        } else {
          tiles.push(W); tileColors.push(null)
        }
        continue
      }
      if (c >= 15 && c <= 18 && r >= 7 && r <= 9) {
        tiles.push(F3); tileColors.push(DEFAULT_CARPET_COLOR); continue
      }
      if (c < 10) {
        tiles.push(F1); tileColors.push(DEFAULT_LEFT_ROOM_COLOR)
      } else {
        tiles.push(F2); tileColors.push(DEFAULT_RIGHT_ROOM_COLOR)
      }
    }
  }

  const furniture: PlacedFurniture[] = [
    { uid: 'desk-left', type: FurnitureType.DESK, col: 4, row: 3 },
    { uid: 'desk-right', type: FurnitureType.DESK, col: 13, row: 3 },
    { uid: 'bookshelf-1', type: FurnitureType.BOOKSHELF, col: 1, row: 5 },
    { uid: 'plant-left', type: FurnitureType.PLANT, col: 1, row: 1 },
    { uid: 'cooler-1', type: FurnitureType.COOLER, col: 17, row: 7 },
    { uid: 'plant-right', type: FurnitureType.PLANT, col: 18, row: 1 },
    { uid: 'whiteboard-1', type: FurnitureType.WHITEBOARD, col: 15, row: 0 },
    // Left desk chairs
    { uid: 'chair-l-top', type: FurnitureType.CHAIR, col: 4, row: 2 },
    { uid: 'chair-l-bottom', type: FurnitureType.CHAIR, col: 5, row: 5 },
    { uid: 'chair-l-left', type: FurnitureType.CHAIR, col: 3, row: 4 },
    { uid: 'chair-l-right', type: FurnitureType.CHAIR, col: 6, row: 3 },
    // Right desk chairs
    { uid: 'chair-r-top', type: FurnitureType.CHAIR, col: 13, row: 2 },
    { uid: 'chair-r-bottom', type: FurnitureType.CHAIR, col: 14, row: 5 },
    { uid: 'chair-r-left', type: FurnitureType.CHAIR, col: 12, row: 4 },
    { uid: 'chair-r-right', type: FurnitureType.CHAIR, col: 15, row: 3 },
  ]

  return { version: 1, cols: DEFAULT_COLS, rows: DEFAULT_ROWS, tiles, tileColors, furniture }
}

/** Kern Office floor colors */
const KERN_MAIN_ROOM_COLOR: FloorColor = { h: 35, s: 30, b: 15, c: 0 }     // warm beige
const KERN_COUNCIL_ROOM_COLOR: FloorColor = { h: 210, s: 20, b: 10, c: 0 }  // cool blue-gray
const KERN_DOORWAY_COLOR: FloorColor = { h: 35, s: 25, b: 10, c: 0 }        // tan

/** Create the Kern office layout with a main room (left) and council room (right).
 *  28 cols × 13 rows. Dividing wall at col 17 with doorway at rows 5-7. */
export function createKernOfficeLayout(): OfficeLayout {
  const W = TileType.WALL
  const F1 = TileType.FLOOR_1
  const F2 = TileType.FLOOR_2
  const F4 = TileType.FLOOR_4

  const COLS = 28
  const ROWS = 13

  const tiles: TileTypeVal[] = []
  const tileColors: Array<FloorColor | null> = []

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      // Outer boundary walls
      if (r === 0 || r === ROWS - 1) { tiles.push(W); tileColors.push(null); continue }
      if (c === 0 || c === COLS - 1) { tiles.push(W); tileColors.push(null); continue }

      // Dividing wall at column 17
      if (c === 17) {
        if (r >= 5 && r <= 7) {
          // Doorway
          tiles.push(F4); tileColors.push(KERN_DOORWAY_COLOR)
        } else {
          tiles.push(W); tileColors.push(null)
        }
        continue
      }

      // Main room: cols 1-16
      if (c >= 1 && c <= 16) {
        tiles.push(F1); tileColors.push(KERN_MAIN_ROOM_COLOR)
        continue
      }

      // Council room: cols 18-26
      if (c >= 18 && c <= 26) {
        tiles.push(F2); tileColors.push(KERN_COUNCIL_ROOM_COLOR)
        continue
      }

      // Fallback (shouldn't happen)
      tiles.push(W); tileColors.push(null)
    }
  }

  const furniture: PlacedFurniture[] = [
    // === Main room furniture ===
    // Desk cluster 1 (left side)
    { uid: 'main-desk-1', type: FurnitureType.DESK, col: 3, row: 3 },
    { uid: 'main-chair-1-top', type: FurnitureType.CHAIR, col: 3, row: 2 },
    { uid: 'main-chair-1-bottom', type: FurnitureType.CHAIR, col: 4, row: 5 },
    { uid: 'main-chair-1-left', type: FurnitureType.CHAIR, col: 2, row: 4 },
    { uid: 'main-chair-1-right', type: FurnitureType.CHAIR, col: 5, row: 3 },

    // Desk cluster 2 (left side, lower)
    { uid: 'main-desk-2', type: FurnitureType.DESK, col: 3, row: 7 },
    { uid: 'main-chair-2-top', type: FurnitureType.CHAIR, col: 3, row: 6 },
    { uid: 'main-chair-2-bottom', type: FurnitureType.CHAIR, col: 4, row: 9 },
    { uid: 'main-chair-2-left', type: FurnitureType.CHAIR, col: 2, row: 8 },
    { uid: 'main-chair-2-right', type: FurnitureType.CHAIR, col: 5, row: 7 },

    // Desk cluster 3 (right side of main room)
    { uid: 'main-desk-3', type: FurnitureType.DESK, col: 9, row: 3 },
    { uid: 'main-chair-3-top', type: FurnitureType.CHAIR, col: 9, row: 2 },
    { uid: 'main-chair-3-bottom', type: FurnitureType.CHAIR, col: 10, row: 5 },
    { uid: 'main-chair-3-left', type: FurnitureType.CHAIR, col: 8, row: 4 },
    { uid: 'main-chair-3-right', type: FurnitureType.CHAIR, col: 11, row: 3 },

    // Bookshelves against left wall
    { uid: 'main-bookshelf-1', type: FurnitureType.BOOKSHELF, col: 1, row: 5 },
    { uid: 'main-bookshelf-2', type: FurnitureType.BOOKSHELF, col: 1, row: 9 },

    // Plants — corners and accents
    { uid: 'main-plant-1', type: FurnitureType.PLANT, col: 1, row: 1 },
    { uid: 'main-plant-2', type: FurnitureType.PLANT, col: 16, row: 1 },
    { uid: 'main-plant-3', type: FurnitureType.PLANT, col: 1, row: 11 },
    { uid: 'main-plant-4', type: FurnitureType.PLANT, col: 7, row: 1 },

    // PCs on desk surfaces
    { uid: 'main-pc-1', type: FurnitureType.PC, col: 10, row: 3 },
    { uid: 'main-pc-2', type: FurnitureType.PC, col: 3, row: 3 },

    // Cooler — break area bottom-right of main room
    { uid: 'main-cooler-1', type: FurnitureType.COOLER, col: 15, row: 10 },

    // Lamps — top wall accents
    { uid: 'main-lamp-1', type: FurnitureType.LAMP, col: 14, row: 1 },
    { uid: 'main-lamp-2', type: FurnitureType.LAMP, col: 12, row: 11 },

    // Extra desk cluster 4 (right side, lower)
    { uid: 'main-desk-4', type: FurnitureType.DESK, col: 9, row: 7 },
    { uid: 'main-chair-4-top', type: FurnitureType.CHAIR, col: 9, row: 6 },
    { uid: 'main-chair-4-bottom', type: FurnitureType.CHAIR, col: 10, row: 9 },
    { uid: 'main-chair-4-left', type: FurnitureType.CHAIR, col: 8, row: 8 },
    { uid: 'main-chair-4-right', type: FurnitureType.CHAIR, col: 11, row: 7 },

    // Whiteboard in main room
    { uid: 'main-whiteboard-1', type: FurnitureType.WHITEBOARD, col: 13, row: 4 },

    // Extra bookshelf near bottom
    { uid: 'main-bookshelf-3', type: FurnitureType.BOOKSHELF, col: 1, row: 2 },

    // === Council room furniture ===
    // Council desk (center of council room)
    { uid: 'council-desk-1', type: FurnitureType.DESK, col: 21, row: 4 },
    { uid: 'council-chair-1-top', type: FurnitureType.CHAIR, col: 21, row: 3 },
    { uid: 'council-chair-1-bottom', type: FurnitureType.CHAIR, col: 22, row: 6 },
    { uid: 'council-chair-1-left', type: FurnitureType.CHAIR, col: 20, row: 5 },

    // Second council desk (lower area)
    { uid: 'council-desk-2', type: FurnitureType.DESK, col: 21, row: 8 },
    { uid: 'council-chair-2-top', type: FurnitureType.CHAIR, col: 21, row: 7 },
    { uid: 'council-chair-2-right', type: FurnitureType.CHAIR, col: 23, row: 9 },

    // Whiteboard on top wall
    { uid: 'council-whiteboard-1', type: FurnitureType.WHITEBOARD, col: 22, row: 0 },

    // Plants in council room — all corners
    { uid: 'council-plant-1', type: FurnitureType.PLANT, col: 18, row: 1 },
    { uid: 'council-plant-2', type: FurnitureType.PLANT, col: 26, row: 1 },
    { uid: 'council-plant-3', type: FurnitureType.PLANT, col: 18, row: 11 },
    { uid: 'council-plant-4', type: FurnitureType.PLANT, col: 26, row: 11 },

    // Lamps in council room
    { uid: 'council-lamp-1', type: FurnitureType.LAMP, col: 25, row: 1 },
    { uid: 'council-lamp-2', type: FurnitureType.LAMP, col: 19, row: 10 },

    // Bookshelf in council room
    { uid: 'council-bookshelf-1', type: FurnitureType.BOOKSHELF, col: 18, row: 4 },

    // PC on council desk surface
    { uid: 'council-pc-1', type: FurnitureType.PC, col: 22, row: 4 },
    { uid: 'council-pc-2', type: FurnitureType.PC, col: 21, row: 8 },

    // Cooler in council room
    { uid: 'council-cooler-1', type: FurnitureType.COOLER, col: 26, row: 6 },
  ]

  return { version: 1, cols: COLS, rows: ROWS, tiles, tileColors, furniture }
}

/** Kern Office V2 floor colors */
const KERN_V2_MAIN_COLOR: FloorColor = { h: 30, s: 40, b: 10, c: 0 }      // warm wood brown
const KERN_V2_KITCHEN_COLOR: FloorColor = { h: 35, s: 15, b: 15, c: 0 }   // light grey tile
const KERN_V2_LOUNGE_COLOR: FloorColor = { h: 220, s: 30, b: -10, c: 0 }  // dark blue
const KERN_V2_DOOR_COLOR: FloorColor = { h: 35, s: 20, b: 10, c: 0 }      // tan

/** Create Kern Office V2 — structured layout matching reference design.
 *  32 cols × 18 rows. Main office (left), kitchen (top-right), lounge (bottom-right). */
export function createKernOfficeLayoutV2(): OfficeLayout {
  const W = TileType.WALL
  const F1 = TileType.FLOOR_1
  const F2 = TileType.FLOOR_2
  const F3 = TileType.FLOOR_3
  const F4 = TileType.FLOOR_4

  const COLS = 32
  const ROWS = 18

  const tiles: TileTypeVal[] = []
  const tileColors: Array<FloorColor | null> = []

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      // Outer walls
      if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1) {
        tiles.push(W); tileColors.push(null); continue
      }
      // Vertical dividing wall at col 20 (doorway at rows 7-9)
      if (c === 20) {
        if (r >= 7 && r <= 9) {
          tiles.push(F4); tileColors.push(KERN_V2_DOOR_COLOR)
        } else {
          tiles.push(W); tileColors.push(null)
        }
        continue
      }
      // Horizontal dividing wall at row 8 in right section (doorway at cols 25-26)
      if (r === 8 && c >= 21 && c <= 30) {
        if (c >= 25 && c <= 26) {
          tiles.push(F4); tileColors.push(KERN_V2_DOOR_COLOR)
        } else {
          tiles.push(W); tileColors.push(null)
        }
        continue
      }
      // Main room: cols 1-19
      if (c >= 1 && c <= 19) {
        tiles.push(F1); tileColors.push(KERN_V2_MAIN_COLOR); continue
      }
      // Kitchen (top-right): cols 21-30, rows 1-7
      if (c >= 21 && c <= 30 && r >= 1 && r <= 7) {
        tiles.push(F2); tileColors.push(KERN_V2_KITCHEN_COLOR); continue
      }
      // Lounge (bottom-right): cols 21-30, rows 9-16
      if (c >= 21 && c <= 30 && r >= 9 && r <= 16) {
        tiles.push(F3); tileColors.push(KERN_V2_LOUNGE_COLOR); continue
      }
      tiles.push(W); tileColors.push(null)
    }
  }

  const furniture: PlacedFurniture[] = [
    // ═══ MAIN ROOM — Top wall storage band (reference-style) ═══════
    { uid: 'shelf-top-1',  type: 'd_bookshelf_1',    col: 2,  row: 1 },
    { uid: 'shelf-top-2',  type: 'd_bookshelf_2',    col: 5,  row: 1 },
    { uid: 'shelf-top-3',  type: 'd_bookshelf_1',    col: 11, row: 1 },
    { uid: 'shelf-top-4',  type: 'd_bookshelf_2',    col: 14, row: 1 },
    { uid: 'shelf-left-1', type: 'd_bookshelf_full', col: 1,  row: 8 },
    { uid: 'shelf-left-2', type: 'd_bookshelf_full', col: 1,  row: 11 },
    { uid: 'shelf-right-1', type: 'd_bookshelf_3',   col: 17, row: 8 },
    { uid: 'filing-1',     type: 'd_filing_cab',     col: 17, row: 13 },
    { uid: 'printer-1',    type: 'd_printer',        col: 2,  row: 14 },
    { uid: 'server-1',     type: 'd_server',         col: 19, row: 13 },
    { uid: 'boxes-1',      type: 'd_boxes_1',        col: 4,  row: 3 },
    { uid: 'boxes-2',      type: 'd_boxes_2',        col: 5,  row: 3 },

    // ═══ MAIN ROOM — Workstations (4-seat grid) ════════════════════
    { uid: 'desk-a',  type: 'd_desk_wood',    col: 4,  row: 5 },
    { uid: 'chair-a', type: 'd_swivel_back',  col: 5,  row: 7 },
    { uid: 'mon-a',   type: 'd_monitor_on',   col: 5,  row: 5 },
    { uid: 'kb-a',    type: 'd_keyboard',     col: 4,  row: 5 },
    { uid: 'lap-a',   type: 'd_laptop_on',    col: 6,  row: 5 },
    { uid: 'mug-a',   type: 'd_mug_1',        col: 6,  row: 6 },

    { uid: 'desk-b',  type: 'd_desk_wood',    col: 11, row: 5 },
    { uid: 'chair-b', type: 'd_swivel_back',  col: 12, row: 7 },
    { uid: 'mon-b',   type: 'd_monitor_on',   col: 12, row: 5 },
    { uid: 'kb-b',    type: 'd_keyboard',     col: 11, row: 5 },
    { uid: 'lap-b',   type: 'd_laptop_on',    col: 13, row: 5 },
    { uid: 'mug-b',   type: 'd_mug_2',        col: 13, row: 6 },

    { uid: 'desk-c',  type: 'd_desk_wood',    col: 4,  row: 11 },
    { uid: 'chair-c', type: 'd_swivel_front', col: 5,  row: 10 },
    { uid: 'mon-c',   type: 'd_monitor_on',   col: 5,  row: 11 },
    { uid: 'kb-c',    type: 'd_keyboard',     col: 4,  row: 11 },
    { uid: 'lap-c',   type: 'd_laptop_on',    col: 6,  row: 11 },
    { uid: 'mug-c',   type: 'd_mug_1',        col: 6,  row: 12 },

    { uid: 'desk-d',  type: 'd_desk_wood',    col: 11, row: 11 },
    { uid: 'chair-d', type: 'd_swivel_front', col: 12, row: 10 },
    { uid: 'mon-d',   type: 'd_monitor_on',   col: 12, row: 11 },
    { uid: 'kb-d',    type: 'd_keyboard',     col: 11, row: 11 },
    { uid: 'lap-d',   type: 'd_laptop_on',    col: 13, row: 11 },
    { uid: 'mug-d',   type: 'd_mug_2',        col: 13, row: 12 },

    // Main-room corners + wall decor
    { uid: 'plant-1', type: 'd_plant_1', col: 1,  row: 1 },
    { uid: 'plant-2', type: 'd_plant_2', col: 19, row: 1 },
    { uid: 'plant-3', type: 'd_plant_3', col: 1,  row: 15 },
    { uid: 'plant-4', type: 'd_plant_1', col: 19, row: 15 },
    { uid: 'main-window-1', type: 'd_window',      col: 7,  row: 0 },
    { uid: 'main-window-2', type: 'd_window',      col: 13, row: 0 },
    { uid: 'main-clock-1',  type: 'd_clock_wall',  col: 18, row: 0 },
    { uid: 'main-clock-2',  type: 'd_clock_wall_2', col: 16, row: 0 },
    { uid: 'main-tv-1',     type: 'd_tv_wall',      col: 5,  row: 0 },
    { uid: 'main-painting', type: 'd_painting',    col: 2,  row: 0 },
    { uid: 'main-chart',    type: 'd_chart',       col: 10, row: 0 },

    // ═══ KITCHEN / BREAK ROOM (top-right) ═════════════════════════
    { uid: 'k-window-1', type: 'd_window',       col: 22, row: 0 },
    { uid: 'k-window-2', type: 'd_window',       col: 28, row: 0 },
    { uid: 'k-clock-1',  type: 'd_clock_wall',   col: 26, row: 0 },
    { uid: 'k-clock-2',  type: 'd_clock_wall_2', col: 30, row: 0 },
    { uid: 'vending-1',  type: 'd_vending',      col: 22, row: 1 },
    { uid: 'cooler-1',   type: 'd_cooler',       col: 24, row: 1 },
    { uid: 'coffee-1',   type: 'd_coffee',       col: 25, row: 1 },
    { uid: 'counter-1',  type: 'd_bookshelf_4',  col: 27, row: 1 },
    { uid: 'fridge-1',   type: 'd_fridge',       col: 30, row: 1 },
    { uid: 'break-bin-1', type: 'd_side_table',  col: 27, row: 4 },
    { uid: 'break-bin-2', type: 'd_side_table',  col: 28, row: 4 },
    { uid: 'server-ops', type: 'd_server',       col: 22, row: 5 },
    { uid: 'break-rug-1', type: 'd_rug_1',       col: 26, row: 5 },
    { uid: 'break-rug-2', type: 'd_rug_1',       col: 28, row: 5 },

    // ═══ MEETING / LOUNGE (bottom-right) ══════════════════════════
    { uid: 'lounge-board-1', type: 'd_board',    col: 21, row: 8 },
    { uid: 'lounge-chart-1', type: 'd_chart',    col: 23, row: 8 },
    { uid: 'lounge-tv-1',    type: 'd_tv_wall',  col: 27, row: 8 },
    { uid: 'lounge-art-1',   type: 'd_painting', col: 28, row: 8 },

    { uid: 'lounge-shelf-1', type: 'd_bookshelf_3', col: 22, row: 10 },
    { uid: 'lounge-shelf-2', type: 'd_bookshelf_1', col: 28, row: 10 },
    { uid: 'lounge-cooler',  type: 'd_cooler',      col: 30, row: 12 },
    { uid: 'lounge-rug-1',   type: 'd_rug_1',       col: 24, row: 11 },
    { uid: 'lounge-rug-2',   type: 'd_rug_1',       col: 26, row: 11 },
    { uid: 'lounge-plant-1', type: 'd_plant_2',     col: 21, row: 15 },
    { uid: 'lounge-plant-2', type: 'd_plant_3',     col: 30, row: 15 },

    // Conference desk + council seats (IDs consumed by OfficeCanvas.tsx)
    { uid: 'conf-desk',       type: 'd_desk_wood',   col: 24, row: 12 },
    { uid: 'conf-chair-top',  type: 'd_chair_front', col: 25, row: 11 },
    { uid: 'conf-chair-bot',  type: 'd_chair_back',  col: 25, row: 14 },
    { uid: 'conf-chair-left', type: 'd_chair_right', col: 23, row: 13 },
    { uid: 'conf-monitor-1',  type: 'd_monitor_on',  col: 25, row: 12 },
    { uid: 'conf-kb-1',       type: 'd_keyboard',    col: 24, row: 12 },
    { uid: 'conf-mug-1',      type: 'd_mug_2',       col: 26, row: 12 },

    // Lounge seating cluster
    { uid: 'lounge-couch-1',    type: 'd_couch_1',    col: 22, row: 13 },
    { uid: 'lounge-couch-2',    type: 'd_couch_1',    col: 27, row: 14 },
    { uid: 'lounge-armchair-1', type: 'd_armchair_1', col: 24, row: 14 },
    { uid: 'lounge-armchair-2', type: 'd_armchair_1', col: 28, row: 13 },
    { uid: 'lounge-table-1',    type: 'd_side_table', col: 26, row: 13 },
    { uid: 'lounge-table-2',    type: 'd_side_table', col: 24, row: 15 },
  ]

  return { version: 1, cols: COLS, rows: ROWS, tiles, tileColors, furniture }
}

/** Serialize layout to JSON string */
export function serializeLayout(layout: OfficeLayout): string {
  return JSON.stringify(layout)
}

/** Deserialize layout from JSON string, migrating old tile types if needed */
export function deserializeLayout(json: string): OfficeLayout | null {
  try {
    const obj = JSON.parse(json)
    if (obj && obj.version === 1 && Array.isArray(obj.tiles) && Array.isArray(obj.furniture)) {
      return migrateLayout(obj as OfficeLayout)
    }
  } catch { /* ignore parse errors */ }
  return null
}

/**
 * Ensure layout has tileColors. If missing, generate defaults based on tile types.
 * Exported for use by message handlers that receive layouts over the wire.
 */
export function migrateLayoutColors(layout: OfficeLayout): OfficeLayout {
  return migrateLayout(layout)
}

/**
 * Migrate old layouts that use legacy tile types (TILE_FLOOR=1, WOOD_FLOOR=2, CARPET=3, DOORWAY=4)
 * to the new pattern-based system. If tileColors is already present, no migration needed.
 */
function migrateLayout(layout: OfficeLayout): OfficeLayout {
  if (layout.tileColors && layout.tileColors.length === layout.tiles.length) {
    return layout // Already migrated
  }

  // Check if any tiles use old values (1-4) — these map directly to FLOOR_1-4
  // but need color assignments
  const tileColors: Array<FloorColor | null> = []
  for (const tile of layout.tiles) {
    switch (tile) {
      case 0: // WALL
        tileColors.push(null)
        break
      case 1: // was TILE_FLOOR → FLOOR_1 beige
        tileColors.push(DEFAULT_LEFT_ROOM_COLOR)
        break
      case 2: // was WOOD_FLOOR → FLOOR_2 brown
        tileColors.push(DEFAULT_RIGHT_ROOM_COLOR)
        break
      case 3: // was CARPET → FLOOR_3 purple
        tileColors.push(DEFAULT_CARPET_COLOR)
        break
      case 4: // was DOORWAY → FLOOR_4 tan
        tileColors.push(DEFAULT_DOORWAY_COLOR)
        break
      default:
        // New tile types (5-7) without colors — use neutral gray
        tileColors.push(tile > 0 ? { h: 0, s: 0, b: 0, c: 0 } : null)
    }
  }

  return { ...layout, tileColors }
}
