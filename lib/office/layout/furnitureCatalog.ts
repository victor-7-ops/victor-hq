import { FurnitureType } from '../types'
import type { FurnitureCatalogEntry, SpriteData } from '../types'
import {
  DESK_SQUARE_SPRITE,
  BOOKSHELF_SPRITE,
  PLANT_SPRITE,
  COOLER_SPRITE,
  WHITEBOARD_SPRITE,
  CHAIR_SPRITE,
  PC_SPRITE,
  LAMP_SPRITE,
} from '../sprites/spriteData'
import {
  DONARG_DESK_WOOD, DONARG_DESK_GREY,
  DONARG_SWIVEL_FRONT, DONARG_SWIVEL_BACK, DONARG_SWIVEL_LEFT, DONARG_SWIVEL_RIGHT,
  DONARG_CHAIR_FRONT, DONARG_CHAIR_BACK, DONARG_CHAIR_LEFT, DONARG_CHAIR_RIGHT,
  DONARG_MONITOR_FLAT_ON, DONARG_MONITOR_CRT_ON, DONARG_KEYBOARD,
  DONARG_LAPTOP_ON, DONARG_MUG_1, DONARG_MUG_2,
  DONARG_BOOKSHELF_1, DONARG_BOOKSHELF_2, DONARG_BOOKSHELF_3, DONARG_BOOKSHELF_FULL,
  DONARG_FILING_CAB,
  DONARG_PLANT_1, DONARG_PLANT_2, DONARG_PLANT_3,
  DONARG_COOLER, DONARG_COFFEE_MACHINE, DONARG_VENDING, DONARG_FRIDGE,
  DONARG_COUCH_1, DONARG_ARMCHAIR_1, DONARG_SIDE_TABLE,
  DONARG_RUG_1, DONARG_PRINTER, DONARG_SERVER,
  DONARG_WINDOW_DBL_2, DONARG_BOARD_1, DONARG_CHART_1,
  DONARG_PAINTING_1, DONARG_CLOCK_WALL,
  DONARG_CLOCK_WALL_2, DONARG_BOXES_1, DONARG_BOXES_2,
  DONARG_BOOKSHELF_4,
} from '../sprites/donargTileset'

export interface LoadedAssetData {
  catalog: Array<{
    id: string
    label: string
    category: string
    width: number
    height: number
    footprintW: number
    footprintH: number
    isDesk: boolean
    groupId?: string
    orientation?: string  // 'front' | 'back' | 'left' | 'right'
    state?: string        // 'on' | 'off'
    canPlaceOnSurfaces?: boolean
    backgroundTiles?: number
    canPlaceOnWalls?: boolean
  }>
  sprites: Record<string, SpriteData>
}

export type FurnitureCategory = 'desks' | 'chairs' | 'storage' | 'decor' | 'electronics' | 'wall' | 'misc'

export interface CatalogEntryWithCategory extends FurnitureCatalogEntry {
  category: FurnitureCategory
}

/** Solid-color fallback sprite for Donarg items (when tileset not loaded) */
function fb(wTiles: number, hTiles: number, color: string): SpriteData {
  return Array.from({ length: hTiles * 16 }, () => Array(wTiles * 16).fill(color) as string[])
}
const FB_D = '#8B7355', FB_C = '#CD853F', FB_S = '#654321', FB_G = '#228B22', FB_E = '#4A4A4A', FB_W = '#C0C0C0', FB_M = '#808080'

export const FURNITURE_CATALOG: CatalogEntryWithCategory[] = [
  // ── Original hand-drawn sprites (backward compat) ──
  { type: FurnitureType.DESK,       label: 'Desk',       footprintW: 2, footprintH: 2, sprite: DESK_SQUARE_SPRITE,  isDesk: true,  category: 'desks' },
  { type: FurnitureType.BOOKSHELF,  label: 'Bookshelf',  footprintW: 1, footprintH: 2, sprite: BOOKSHELF_SPRITE,    isDesk: false, category: 'storage' },
  { type: FurnitureType.PLANT,      label: 'Plant',      footprintW: 1, footprintH: 1, sprite: PLANT_SPRITE,        isDesk: false, category: 'decor' },
  { type: FurnitureType.COOLER,     label: 'Cooler',     footprintW: 1, footprintH: 1, sprite: COOLER_SPRITE,       isDesk: false, category: 'misc' },
  { type: FurnitureType.WHITEBOARD, label: 'Whiteboard', footprintW: 2, footprintH: 1, sprite: WHITEBOARD_SPRITE,   isDesk: false, category: 'decor' },
  { type: FurnitureType.CHAIR,      label: 'Chair',      footprintW: 1, footprintH: 1, sprite: CHAIR_SPRITE,        isDesk: false, category: 'chairs' },
  { type: FurnitureType.PC,         label: 'PC',         footprintW: 1, footprintH: 1, sprite: PC_SPRITE,           isDesk: false, category: 'electronics' },
  { type: FurnitureType.LAMP,       label: 'Lamp',       footprintW: 1, footprintH: 1, sprite: LAMP_SPRITE,         isDesk: false, category: 'decor' },

  // ── Donarg tileset furniture ──────────────────────────────────
  // Desks
  { type: 'd_desk_wood',    label: 'Wood Desk',       footprintW: 3, footprintH: 2, sprite: fb(3,2,FB_D), isDesk: true,  category: 'desks', tilesetRef: DONARG_DESK_WOOD },
  { type: 'd_desk_grey',    label: 'Grey Desk',       footprintW: 3, footprintH: 2, sprite: fb(3,2,FB_D), isDesk: true,  category: 'desks', tilesetRef: DONARG_DESK_GREY },

  // Swivel chairs (office workstation)
  { type: 'd_swivel_front', label: 'Swivel Chair',    footprintW: 1, footprintH: 1, sprite: fb(1,1,FB_C), isDesk: false, category: 'chairs', orientation: 'front', tilesetRef: DONARG_SWIVEL_FRONT },
  { type: 'd_swivel_back',  label: 'Swivel Chair',    footprintW: 1, footprintH: 1, sprite: fb(1,1,FB_C), isDesk: false, category: 'chairs', orientation: 'back',  tilesetRef: DONARG_SWIVEL_BACK },
  { type: 'd_swivel_left',  label: 'Swivel Chair',    footprintW: 1, footprintH: 1, sprite: fb(1,1,FB_C), isDesk: false, category: 'chairs', orientation: 'left',  tilesetRef: DONARG_SWIVEL_LEFT },
  { type: 'd_swivel_right', label: 'Swivel Chair',    footprintW: 1, footprintH: 1, sprite: fb(1,1,FB_C), isDesk: false, category: 'chairs', orientation: 'right', tilesetRef: DONARG_SWIVEL_RIGHT },

  // Regular chairs (conference / meeting)
  { type: 'd_chair_front',  label: 'Chair',           footprintW: 1, footprintH: 1, sprite: fb(1,1,FB_C), isDesk: false, category: 'chairs', orientation: 'front', tilesetRef: DONARG_CHAIR_FRONT },
  { type: 'd_chair_back',   label: 'Chair',           footprintW: 1, footprintH: 1, sprite: fb(1,1,FB_C), isDesk: false, category: 'chairs', orientation: 'back',  tilesetRef: DONARG_CHAIR_BACK },
  { type: 'd_chair_left',   label: 'Chair',           footprintW: 1, footprintH: 1, sprite: fb(1,1,FB_C), isDesk: false, category: 'chairs', orientation: 'left',  tilesetRef: DONARG_CHAIR_LEFT },
  { type: 'd_chair_right',  label: 'Chair',           footprintW: 1, footprintH: 1, sprite: fb(1,1,FB_C), isDesk: false, category: 'chairs', orientation: 'right', tilesetRef: DONARG_CHAIR_RIGHT },

  // Surface items (placed on desks)
  { type: 'd_monitor_on',   label: 'Monitor',         footprintW: 1, footprintH: 1, sprite: fb(1,1,FB_E), isDesk: false, category: 'electronics', canPlaceOnSurfaces: true, tilesetRef: DONARG_MONITOR_FLAT_ON },
  { type: 'd_keyboard',     label: 'Keyboard',        footprintW: 1, footprintH: 1, sprite: fb(1,1,FB_E), isDesk: false, category: 'electronics', canPlaceOnSurfaces: true, tilesetRef: DONARG_KEYBOARD },
  { type: 'd_laptop_on',    label: 'Laptop',          footprintW: 1, footprintH: 1, sprite: fb(1,1,FB_E), isDesk: false, category: 'electronics', canPlaceOnSurfaces: true, tilesetRef: DONARG_LAPTOP_ON },
  { type: 'd_mug_1',        label: 'Mug',             footprintW: 1, footprintH: 1, sprite: fb(1,1,FB_W), isDesk: false, category: 'decor', canPlaceOnSurfaces: true, tilesetRef: DONARG_MUG_1 },
  { type: 'd_mug_2',        label: 'Mug',             footprintW: 1, footprintH: 1, sprite: fb(1,1,FB_W), isDesk: false, category: 'decor', canPlaceOnSurfaces: true, tilesetRef: DONARG_MUG_2 },

  // Storage / Bookshelves
  { type: 'd_bookshelf_1',  label: 'Bookshelf',       footprintW: 2, footprintH: 2, sprite: fb(2,2,FB_S), isDesk: false, category: 'storage', backgroundTiles: 1, tilesetRef: DONARG_BOOKSHELF_1 },
  { type: 'd_bookshelf_2',  label: 'Bookshelf',       footprintW: 2, footprintH: 2, sprite: fb(2,2,FB_S), isDesk: false, category: 'storage', backgroundTiles: 1, tilesetRef: DONARG_BOOKSHELF_2 },
  { type: 'd_bookshelf_3',  label: 'Bookshelf',       footprintW: 2, footprintH: 2, sprite: fb(2,2,FB_S), isDesk: false, category: 'storage', backgroundTiles: 1, tilesetRef: DONARG_BOOKSHELF_3 },
  { type: 'd_bookshelf_full', label: 'Tall Bookshelf', footprintW: 1, footprintH: 2, sprite: fb(1,2,FB_S), isDesk: false, category: 'storage', backgroundTiles: 1, tilesetRef: DONARG_BOOKSHELF_FULL },
  { type: 'd_filing_cab',   label: 'Filing Cabinet',  footprintW: 1, footprintH: 2, sprite: fb(1,2,FB_S), isDesk: false, category: 'storage', tilesetRef: DONARG_FILING_CAB },

  // Plants
  { type: 'd_plant_1',      label: 'Plant',           footprintW: 1, footprintH: 2, sprite: fb(1,2,FB_G), isDesk: false, category: 'decor', backgroundTiles: 1, tilesetRef: DONARG_PLANT_1 },
  { type: 'd_plant_2',      label: 'Plant',           footprintW: 1, footprintH: 2, sprite: fb(1,2,FB_G), isDesk: false, category: 'decor', backgroundTiles: 1, tilesetRef: DONARG_PLANT_2 },
  { type: 'd_plant_3',      label: 'Plant',           footprintW: 1, footprintH: 2, sprite: fb(1,2,FB_G), isDesk: false, category: 'decor', backgroundTiles: 1, tilesetRef: DONARG_PLANT_3 },

  // Rug (walkable — all rows are background)
  { type: 'd_rug_1',        label: 'Rug',             footprintW: 2, footprintH: 2, sprite: fb(2,2,FB_M), isDesk: false, category: 'decor', backgroundTiles: 2, tilesetRef: DONARG_RUG_1 },

  // Break room amenities
  { type: 'd_cooler',       label: 'Water Cooler',    footprintW: 1, footprintH: 2, sprite: fb(1,2,FB_M), isDesk: false, category: 'misc', tilesetRef: DONARG_COOLER },
  { type: 'd_coffee',       label: 'Coffee Machine',  footprintW: 1, footprintH: 2, sprite: fb(1,2,FB_M), isDesk: false, category: 'misc', tilesetRef: DONARG_COFFEE_MACHINE },

  // Seating (break room)
  { type: 'd_couch_1',      label: 'Couch',           footprintW: 2, footprintH: 1, sprite: fb(2,1,FB_C), isDesk: false, category: 'chairs', tilesetRef: DONARG_COUCH_1 },
  { type: 'd_armchair_1',   label: 'Armchair',        footprintW: 1, footprintH: 1, sprite: fb(1,1,FB_C), isDesk: false, category: 'chairs', tilesetRef: DONARG_ARMCHAIR_1 },
  { type: 'd_side_table',   label: 'Side Table',      footprintW: 1, footprintH: 1, sprite: fb(1,1,FB_M), isDesk: false, category: 'misc', tilesetRef: DONARG_SIDE_TABLE },

  // Electronics
  { type: 'd_printer',      label: 'Printer',         footprintW: 2, footprintH: 2, sprite: fb(2,2,FB_E), isDesk: false, category: 'electronics', tilesetRef: DONARG_PRINTER },
  { type: 'd_vending',      label: 'Vending Machine', footprintW: 2, footprintH: 2, sprite: fb(2,2,FB_E), isDesk: false, category: 'misc', tilesetRef: DONARG_VENDING },
  { type: 'd_fridge',       label: 'Fridge',          footprintW: 1, footprintH: 2, sprite: fb(1,2,FB_W), isDesk: false, category: 'misc', tilesetRef: DONARG_FRIDGE },
  { type: 'd_server',       label: 'Server Tower',    footprintW: 1, footprintH: 2, sprite: fb(1,2,FB_E), isDesk: false, category: 'electronics', tilesetRef: DONARG_SERVER },
  { type: 'd_boxes_1',      label: 'Boxes',           footprintW: 1, footprintH: 2, sprite: fb(1,2,FB_S), isDesk: false, category: 'misc', tilesetRef: DONARG_BOXES_1 },
  { type: 'd_boxes_2',      label: 'Boxes',           footprintW: 2, footprintH: 2, sprite: fb(2,2,FB_S), isDesk: false, category: 'misc', tilesetRef: DONARG_BOXES_2 },
  { type: 'd_bookshelf_4',  label: 'Bookshelf',       footprintW: 2, footprintH: 2, sprite: fb(2,2,FB_S), isDesk: false, category: 'storage', backgroundTiles: 1, tilesetRef: DONARG_BOOKSHELF_4 },

  // Wall items (canPlaceOnWalls, fully non-blocking)
  { type: 'd_window',       label: 'Window',          footprintW: 2, footprintH: 1, sprite: fb(2,1,FB_W), isDesk: false, category: 'wall', canPlaceOnWalls: true, backgroundTiles: 1, tilesetRef: DONARG_WINDOW_DBL_2 },
  { type: 'd_board',        label: 'Whiteboard',      footprintW: 2, footprintH: 2, sprite: fb(2,2,FB_W), isDesk: false, category: 'wall', canPlaceOnWalls: true, backgroundTiles: 2, tilesetRef: DONARG_BOARD_1 },
  { type: 'd_chart',        label: 'Chart',           footprintW: 2, footprintH: 2, sprite: fb(2,2,FB_W), isDesk: false, category: 'wall', canPlaceOnWalls: true, backgroundTiles: 2, tilesetRef: DONARG_CHART_1 },
  { type: 'd_painting',     label: 'Painting',        footprintW: 2, footprintH: 2, sprite: fb(2,2,FB_W), isDesk: false, category: 'wall', canPlaceOnWalls: true, backgroundTiles: 2, tilesetRef: DONARG_PAINTING_1 },
  { type: 'd_clock_wall',   label: 'Wall Clock',      footprintW: 1, footprintH: 1, sprite: fb(1,1,FB_W), isDesk: false, category: 'wall', canPlaceOnWalls: true, backgroundTiles: 1, tilesetRef: DONARG_CLOCK_WALL },
  { type: 'd_clock_wall_2', label: 'Wall Clock',      footprintW: 1, footprintH: 1, sprite: fb(1,1,FB_W), isDesk: false, category: 'wall', canPlaceOnWalls: true, backgroundTiles: 1, tilesetRef: DONARG_CLOCK_WALL_2 },
  { type: 'd_tv_wall',      label: 'Wall TV',         footprintW: 1, footprintH: 1, sprite: fb(1,1,FB_E), isDesk: false, category: 'wall', canPlaceOnWalls: true, backgroundTiles: 1, tilesetRef: DONARG_MONITOR_CRT_ON },

]

// ── Rotation groups ──────────────────────────────────────────────
// Flexible rotation: supports 2+ orientations (not just all 4)
interface RotationGroup {
  /** Ordered list of orientations available for this group */
  orientations: string[]
  /** Maps orientation → asset ID (for the default/off state) */
  members: Record<string, string>
}

// Maps any member asset ID → its rotation group
const rotationGroups = new Map<string, RotationGroup>()

// ── State groups ────────────────────────────────────────────────
// Maps asset ID → its on/off counterpart (symmetric for toggle)
const stateGroups = new Map<string, string>()
// Directional maps for getOnStateType / getOffStateType
const offToOn = new Map<string, string>()  // off asset → on asset
const onToOff = new Map<string, string>()  // on asset → off asset

// Internal catalog (includes all variants for getCatalogEntry lookups)
let internalCatalog: CatalogEntryWithCategory[] | null = null

// Dynamic catalog built from loaded assets (when available)
// Only includes "front" variants for grouped items (shown in editor palette)
let dynamicCatalog: CatalogEntryWithCategory[] | null = null
let dynamicCategories: FurnitureCategory[] | null = null

/**
 * Build catalog from loaded assets. Returns true if successful.
 * Once built, all getCatalog* functions use the dynamic catalog.
 * Uses ONLY custom assets (excludes hardcoded furniture when assets are loaded).
 */
export function buildDynamicCatalog(assets: LoadedAssetData): boolean {
  if (!assets?.catalog || !assets?.sprites) return false

  // Build all entries (including non-front variants)
  const allEntries = assets.catalog.map((asset) => {
    const sprite = assets.sprites[asset.id]
    if (!sprite) {
      console.warn(`No sprite data for asset ${asset.id}`)
      return null
    }
    return {
      type: asset.id,
      label: asset.label,
      footprintW: asset.footprintW,
      footprintH: asset.footprintH,
      sprite,
      isDesk: asset.isDesk,
      category: asset.category as FurnitureCategory,
      ...(asset.orientation ? { orientation: asset.orientation } : {}),
      ...(asset.canPlaceOnSurfaces ? { canPlaceOnSurfaces: true } : {}),
      ...(asset.backgroundTiles ? { backgroundTiles: asset.backgroundTiles } : {}),
      ...(asset.canPlaceOnWalls ? { canPlaceOnWalls: true } : {}),
    }
  }).filter((e): e is CatalogEntryWithCategory => e !== null)

  if (allEntries.length === 0) return false

  // Build rotation groups from groupId + orientation metadata
  rotationGroups.clear()
  stateGroups.clear()
  offToOn.clear()
  onToOff.clear()

  // Phase 1: Collect orientations per group (only "off" or stateless variants for rotation)
  const groupMap = new Map<string, Map<string, string>>() // groupId → (orientation → assetId)
  for (const asset of assets.catalog) {
    if (asset.groupId && asset.orientation) {
      // For rotation groups, only use the "off" or stateless variant
      if (asset.state && asset.state !== 'off') continue
      let orientMap = groupMap.get(asset.groupId)
      if (!orientMap) {
        orientMap = new Map()
        groupMap.set(asset.groupId, orientMap)
      }
      orientMap.set(asset.orientation, asset.id)
    }
  }

  // Phase 2: Register rotation groups with 2+ orientations
  const nonFrontIds = new Set<string>()
  const orientationOrder = ['front', 'right', 'back', 'left']
  for (const orientMap of groupMap.values()) {
    if (orientMap.size < 2) continue
    // Build ordered list of available orientations
    const orderedOrients = orientationOrder.filter((o) => orientMap.has(o))
    if (orderedOrients.length < 2) continue
    const members: Record<string, string> = {}
    for (const o of orderedOrients) {
      members[o] = orientMap.get(o)!
    }
    const rg: RotationGroup = { orientations: orderedOrients, members }
    for (const id of Object.values(members)) {
      rotationGroups.set(id, rg)
    }
    // Track non-front IDs to exclude from visible catalog
    for (const [orient, id] of Object.entries(members)) {
      if (orient !== 'front') nonFrontIds.add(id)
    }
  }

  // Phase 3: Build state groups (on ↔ off pairs within same groupId + orientation)
  const stateMap = new Map<string, Map<string, string>>() // "groupId|orientation" → (state → assetId)
  for (const asset of assets.catalog) {
    if (asset.groupId && asset.state) {
      const key = `${asset.groupId}|${asset.orientation || ''}`
      let sm = stateMap.get(key)
      if (!sm) {
        sm = new Map()
        stateMap.set(key, sm)
      }
      sm.set(asset.state, asset.id)
    }
  }
  for (const sm of stateMap.values()) {
    const onId = sm.get('on')
    const offId = sm.get('off')
    if (onId && offId) {
      stateGroups.set(onId, offId)
      stateGroups.set(offId, onId)
      offToOn.set(offId, onId)
      onToOff.set(onId, offId)
    }
  }

  // Also register rotation groups for "on" state variants (so rotation works on on-state items too)
  for (const asset of assets.catalog) {
    if (asset.groupId && asset.orientation && asset.state === 'on') {
      // Find the off-variant's rotation group
      const offCounterpart = stateGroups.get(asset.id)
      if (offCounterpart) {
        const offGroup = rotationGroups.get(offCounterpart)
        if (offGroup) {
          // Build an equivalent group for the "on" state
          const onMembers: Record<string, string> = {}
          for (const orient of offGroup.orientations) {
            const offId = offGroup.members[orient]
            const onId = stateGroups.get(offId)
            // Use on-state variant if available, otherwise fall back to off-state
            onMembers[orient] = onId ?? offId
          }
          const onGroup: RotationGroup = { orientations: offGroup.orientations, members: onMembers }
          for (const id of Object.values(onMembers)) {
            if (!rotationGroups.has(id)) {
              rotationGroups.set(id, onGroup)
            }
          }
        }
      }
    }
  }

  // Track "on" variant IDs to exclude from visible catalog
  const onStateIds = new Set<string>()
  for (const asset of assets.catalog) {
    if (asset.state === 'on') onStateIds.add(asset.id)
  }

  // Store full internal catalog (all variants — for getCatalogEntry lookups)
  internalCatalog = allEntries

  // Visible catalog: exclude non-front variants and "on" state variants
  const visibleEntries = allEntries.filter((e) => !nonFrontIds.has(e.type) && !onStateIds.has(e.type))

  // Strip orientation/state suffix from labels for grouped variants
  for (const entry of visibleEntries) {
    if (rotationGroups.has(entry.type) || stateGroups.has(entry.type)) {
      entry.label = entry.label
        .replace(/ - Front - Off$/, '')
        .replace(/ - Front$/, '')
        .replace(/ - Off$/, '')
    }
  }

  dynamicCatalog = visibleEntries
  dynamicCategories = Array.from(new Set(visibleEntries.map((e) => e.category)))
    .filter((c): c is FurnitureCategory => !!c)
    .sort()

  const rotGroupCount = new Set(Array.from(rotationGroups.values())).size
  console.log(`✓ Built dynamic catalog with ${allEntries.length} assets (${visibleEntries.length} visible, ${rotGroupCount} rotation groups, ${stateGroups.size / 2} state pairs)`)
  return true
}

export function getCatalogEntry(type: string): CatalogEntryWithCategory | undefined {
  // Check internal catalog first (includes all variants, e.g., non-front rotations)
  if (internalCatalog) {
    return internalCatalog.find((e) => e.type === type)
  }
  const catalog = dynamicCatalog || FURNITURE_CATALOG
  return catalog.find((e) => e.type === type)
}

export function getCatalogByCategory(category: FurnitureCategory): CatalogEntryWithCategory[] {
  const catalog = dynamicCatalog || FURNITURE_CATALOG
  return catalog.filter((e) => e.category === category)
}

export function getActiveCatalog(): CatalogEntryWithCategory[] {
  return dynamicCatalog || FURNITURE_CATALOG
}

export function getActiveCategories(): Array<{ id: FurnitureCategory; label: string }> {
  const categories = dynamicCategories || (FURNITURE_CATEGORIES.map((c) => c.id) as FurnitureCategory[])
  return FURNITURE_CATEGORIES.filter((c) => categories.includes(c.id))
}

export const FURNITURE_CATEGORIES: Array<{ id: FurnitureCategory; label: string }> = [
  { id: 'desks', label: 'Desks' },
  { id: 'chairs', label: 'Chairs' },
  { id: 'storage', label: 'Storage' },
  { id: 'electronics', label: 'Tech' },
  { id: 'decor', label: 'Decor' },
  { id: 'wall', label: 'Wall' },
  { id: 'misc', label: 'Misc' },
]

// ── Rotation helpers ─────────────────────────────────────────────

/** Returns the next asset ID in the rotation group (cw or ccw), or null if not rotatable. */
export function getRotatedType(currentType: string, direction: 'cw' | 'ccw'): string | null {
  const group = rotationGroups.get(currentType)
  if (!group) return null
  const order = group.orientations.map((o) => group.members[o])
  const idx = order.indexOf(currentType)
  if (idx === -1) return null
  const step = direction === 'cw' ? 1 : -1
  const nextIdx = (idx + step + order.length) % order.length
  return order[nextIdx]
}

/** Returns the toggled state variant (on↔off), or null if no state variant exists. */
export function getToggledType(currentType: string): string | null {
  return stateGroups.get(currentType) ?? null
}

/** Returns the "on" variant if this type has one, otherwise returns the type unchanged. */
export function getOnStateType(currentType: string): string {
  return offToOn.get(currentType) ?? currentType
}

/** Returns the "off" variant if this type has one, otherwise returns the type unchanged. */
export function getOffStateType(currentType: string): string {
  return onToOff.get(currentType) ?? currentType
}

/** Returns true if the given furniture type is part of a rotation group. */
export function isRotatable(type: string): boolean {
  return rotationGroups.has(type)
}
