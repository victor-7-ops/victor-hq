#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const LAYOUT_FILE = path.join(ROOT, 'lib/office/layout/layoutSerializer.ts');
const CATALOG_FILE = path.join(ROOT, 'lib/office/layout/furnitureCatalog.ts');
const OFFICE_CANVAS_FILE = path.join(ROOT, 'components/office/OfficeCanvas.tsx');

const TILE = {
  WALL: 0,
  FLOOR_1: 1,
  FLOOR_2: 2,
  FLOOR_3: 3,
  FLOOR_4: 4,
  FLOOR_5: 5,
  FLOOR_6: 6,
  FLOOR_7: 7,
  VOID: 8,
};

function failFast(message) {
  console.error(`Validator setup failed: ${message}`);
  process.exit(2);
}

function findMatching(source, startIndex, openChar, closeChar) {
  if (source[startIndex] !== openChar) {
    throw new Error(`Expected ${openChar} at index ${startIndex}`);
  }

  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escaped = false;

  for (let i = startIndex; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      if (ch === '\n') inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      if (ch === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inSingle) {
      if (ch === "'" && !escaped) inSingle = false;
      escaped = ch === '\\' && !escaped;
      continue;
    }

    if (inDouble) {
      if (ch === '"' && !escaped) inDouble = false;
      escaped = ch === '\\' && !escaped;
      continue;
    }

    if (inTemplate) {
      if (ch === '`' && !escaped) {
        inTemplate = false;
      }
      escaped = ch === '\\' && !escaped;
      continue;
    }

    if (ch === '/' && next === '/') {
      inLineComment = true;
      i++;
      continue;
    }

    if (ch === '/' && next === '*') {
      inBlockComment = true;
      i++;
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      escaped = false;
      continue;
    }

    if (ch === '"') {
      inDouble = true;
      escaped = false;
      continue;
    }

    if (ch === '`') {
      inTemplate = true;
      escaped = false;
      continue;
    }

    if (ch === openChar) {
      depth++;
      continue;
    }

    if (ch === closeChar) {
      depth--;
      if (depth === 0) return i;
      continue;
    }
  }

  throw new Error(`No matching ${closeChar} found for ${openChar} at ${startIndex}`);
}

function extractFunctionBody(source, functionName) {
  const fnIdx = source.indexOf(`export function ${functionName}`);
  if (fnIdx === -1) throw new Error(`Function not found: ${functionName}`);

  const braceStart = source.indexOf('{', fnIdx);
  const braceEnd = findMatching(source, braceStart, '{', '}');
  return source.slice(braceStart + 1, braceEnd);
}

function extractArrayLiteral(fnBody, declarationPrefix) {
  const declIdx = fnBody.indexOf(declarationPrefix);
  if (declIdx === -1) throw new Error(`Declaration not found: ${declarationPrefix}`);

  const assignIdx = fnBody.indexOf('=', declIdx);
  if (assignIdx === -1) throw new Error(`Assignment not found for: ${declarationPrefix}`);

  const arrayStart = fnBody.indexOf('[', assignIdx);
  if (arrayStart === -1) throw new Error(`Array start not found for: ${declarationPrefix}`);

  const arrayEnd = findMatching(fnBody, arrayStart, '[', ']');
  return fnBody.slice(arrayStart, arrayEnd + 1);
}

function parseCatalogEntries(source) {
  const marker = 'export const FURNITURE_CATALOG';
  const markerIdx = source.indexOf(marker);
  if (markerIdx === -1) throw new Error('FURNITURE_CATALOG not found');

  const assignIdx = source.indexOf('=', markerIdx);
  if (assignIdx === -1) throw new Error('Could not find assignment for FURNITURE_CATALOG');

  const arrStart = source.indexOf('[', assignIdx);
  const arrEnd = findMatching(source, arrStart, '[', ']');
  const arrText = source.slice(arrStart + 1, arrEnd);

  const entries = new Map();
  let i = 0;
  while (i < arrText.length) {
    const start = arrText.indexOf('{', i);
    if (start === -1) break;
    const end = findMatching(arrText, start, '{', '}');
    const obj = arrText.slice(start, end + 1);

    const typeMatch = obj.match(/type:\s*'([^']+)'/);
    if (typeMatch) {
      const type = typeMatch[1];
      const footprintW = Number((obj.match(/footprintW:\s*(\d+)/) || [])[1] || 1);
      const footprintH = Number((obj.match(/footprintH:\s*(\d+)/) || [])[1] || 1);
      const category = (obj.match(/category:\s*'([^']+)'/) || [])[1] || '';
      const orientation = (obj.match(/orientation:\s*'([^']+)'/) || [])[1] || null;
      const isDesk = /isDesk:\s*true/.test(obj);
      const canPlaceOnSurfaces = /canPlaceOnSurfaces:\s*true/.test(obj);
      const canPlaceOnWalls = /canPlaceOnWalls:\s*true/.test(obj);
      const backgroundTiles = Number((obj.match(/backgroundTiles:\s*(\d+)/) || [])[1] || 0);

      entries.set(type, {
        type,
        footprintW,
        footprintH,
        category,
        orientation,
        isDesk,
        canPlaceOnSurfaces,
        canPlaceOnWalls,
        backgroundTiles,
      });
    }

    i = end + 1;
  }

  return entries;
}

function buildKernV2Tiles(cols, rows) {
  const tiles = new Array(rows);
  for (let r = 0; r < rows; r++) {
    tiles[r] = new Array(cols);
    for (let c = 0; c < cols; c++) {
      // Outer walls
      if (r === 0 || r === rows - 1 || c === 0 || c === cols - 1) {
        tiles[r][c] = TILE.WALL;
        continue;
      }
      // Vertical divider
      if (c === 20) {
        tiles[r][c] = r >= 7 && r <= 9 ? TILE.FLOOR_4 : TILE.WALL;
        continue;
      }
      // Horizontal divider in right half
      if (r === 8 && c >= 21 && c <= 30) {
        tiles[r][c] = c >= 25 && c <= 26 ? TILE.FLOOR_4 : TILE.WALL;
        continue;
      }
      // Main room
      if (c >= 1 && c <= 19) {
        tiles[r][c] = TILE.FLOOR_1;
        continue;
      }
      // Kitchen
      if (c >= 21 && c <= 30 && r >= 1 && r <= 7) {
        tiles[r][c] = TILE.FLOOR_2;
        continue;
      }
      // Lounge
      if (c >= 21 && c <= 30 && r >= 9 && r <= 16) {
        tiles[r][c] = TILE.FLOOR_3;
        continue;
      }
      tiles[r][c] = TILE.WALL;
    }
  }
  return tiles;
}

function toKey(col, row) {
  return `${col},${row}`;
}

function inBounds(col, row, cols, rows) {
  return col >= 0 && col < cols && row >= 0 && row < rows;
}

function isFloor(tile) {
  return tile !== TILE.WALL && tile !== TILE.VOID;
}

function computeBlockingTiles(furniture, catalog, cols, rows) {
  const blocked = new Set();
  const outOfBoundsIssues = [];

  for (const item of furniture) {
    const entry = catalog.get(item.type);
    if (!entry) continue;

    for (let dr = 0; dr < entry.footprintH; dr++) {
      for (let dc = 0; dc < entry.footprintW; dc++) {
        const col = item.col + dc;
        const row = item.row + dr;

        if (!inBounds(col, row, cols, rows)) {
          outOfBoundsIssues.push({ uid: item.uid, col, row, reason: 'Footprint out of bounds' });
          continue;
        }

        if (dr >= (entry.backgroundTiles || 0)) {
          blocked.add(toKey(col, row));
        }
      }
    }
  }

  return { blocked, outOfBoundsIssues };
}

function buildDeskData(furniture, catalog) {
  const deskTiles = new Set();
  const desks = [];

  for (const item of furniture) {
    const entry = catalog.get(item.type);
    if (!entry || !entry.isDesk) continue;

    const rect = {
      uid: item.uid,
      col: item.col,
      row: item.row,
      w: entry.footprintW,
      h: entry.footprintH,
    };
    desks.push(rect);

    for (let dr = 0; dr < entry.footprintH; dr++) {
      for (let dc = 0; dc < entry.footprintW; dc++) {
        deskTiles.add(toKey(item.col + dc, item.row + dr));
      }
    }
  }

  return { deskTiles, desks };
}

function buildSeats(furniture, catalog) {
  const seats = new Map();
  const chairs = [];

  const facingForOrientation = {
    front: { dc: 0, dr: 1, name: 'down' },
    back: { dc: 0, dr: -1, name: 'up' },
    left: { dc: -1, dr: 0, name: 'left' },
    right: { dc: 1, dr: 0, name: 'right' },
  };

  for (const item of furniture) {
    const entry = catalog.get(item.type);
    if (!entry || entry.category !== 'chairs') continue;

    const orientation = entry.orientation || 'front';
    const facing = facingForOrientation[orientation] || facingForOrientation.front;
    chairs.push({ item, entry, orientation });

    let seatCount = 0;
    for (let dr = 0; dr < entry.footprintH; dr++) {
      for (let dc = 0; dc < entry.footprintW; dc++) {
        const seatUid = seatCount === 0 ? item.uid : `${item.uid}:${seatCount}`;
        seats.set(seatUid, {
          uid: seatUid,
          chairUid: item.uid,
          col: item.col + dc,
          row: item.row + dr,
          facing,
          orientation,
        });
        seatCount++;
      }
    }
  }

  return { seats, chairs };
}

function hasAdjacentWall(item, entry, tiles, cols, rows) {
  const dirs = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ];

  for (let dr = 0; dr < entry.footprintH; dr++) {
    for (let dc = 0; dc < entry.footprintW; dc++) {
      const c = item.col + dc;
      const r = item.row + dr;
      for (const [dx, dy] of dirs) {
        const nc = c + dx;
        const nr = r + dy;
        if (!inBounds(nc, nr, cols, rows)) continue;
        if (tiles[nr][nc] === TILE.WALL) return true;
      }
    }
  }

  return false;
}

function rectsOverlap(a, b) {
  const aRight = a.col + a.w - 1;
  const aBottom = a.row + a.h - 1;
  const bRight = b.col + b.w - 1;
  const bBottom = b.row + b.h - 1;
  return !(aRight < b.col || bRight < a.col || aBottom < b.row || bBottom < a.row);
}

function chairNearDesk(chairItem, chairEntry, deskRect) {
  const chairRect = {
    col: chairItem.col,
    row: chairItem.row,
    w: chairEntry.footprintW,
    h: chairEntry.footprintH,
  };
  const expanded = {
    col: deskRect.col - 1,
    row: deskRect.row - 1,
    w: deskRect.w + 2,
    h: deskRect.h + 2,
  };
  return rectsOverlap(chairRect, expanded);
}

function bfsReachable(start, target, walkableSet, cols, rows) {
  const q = [start];
  const seen = new Set([toKey(start.col, start.row)]);
  const dirs = [
    [0, -1],
    [0, 1],
    [-1, 0],
    [1, 0],
  ];

  while (q.length > 0) {
    const cur = q.shift();
    if (cur.col === target.col && cur.row === target.row) return true;

    for (const [dx, dy] of dirs) {
      const nc = cur.col + dx;
      const nr = cur.row + dy;
      if (!inBounds(nc, nr, cols, rows)) continue;
      const key = toKey(nc, nr);
      if (seen.has(key)) continue;
      if (!walkableSet.has(key)) continue;
      seen.add(key);
      q.push({ col: nc, row: nr });
    }
  }

  return false;
}

function coord(item) {
  return `(${item.col},${item.row})`;
}

function main() {
  const layoutSource = fs.readFileSync(LAYOUT_FILE, 'utf8');
  const catalogSource = fs.readFileSync(CATALOG_FILE, 'utf8');
  const officeCanvasSource = fs.readFileSync(OFFICE_CANVAS_FILE, 'utf8');

  const fnBody = extractFunctionBody(layoutSource, 'createKernOfficeLayoutV2');
  const cols = Number((fnBody.match(/const\s+COLS\s*=\s*(\d+)/) || [])[1]);
  const rows = Number((fnBody.match(/const\s+ROWS\s*=\s*(\d+)/) || [])[1]);
  if (!cols || !rows) failFast('Could not parse COLS/ROWS from createKernOfficeLayoutV2');

  const furnitureLiteral = extractArrayLiteral(fnBody, 'const furniture');
  let furniture;
  try {
    furniture = vm.runInNewContext(`(${furnitureLiteral})`, {}, { timeout: 1000 });
  } catch (err) {
    failFast(`Could not evaluate furniture array: ${err.message}`);
  }

  if (!Array.isArray(furniture)) failFast('Furniture array did not evaluate to an array');

  const catalog = parseCatalogEntries(catalogSource);
  if (catalog.size === 0) failFast('No catalog entries parsed');

  const tiles = buildKernV2Tiles(cols, rows);
  const { blocked, outOfBoundsIssues } = computeBlockingTiles(furniture, catalog, cols, rows);
  const { deskTiles, desks } = buildDeskData(furniture, catalog);
  const { seats, chairs } = buildSeats(furniture, catalog);

  const floorSet = new Set();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (isFloor(tiles[r][c])) floorSet.add(toKey(c, r));
    }
  }

  const walkableSet = new Set();
  for (const key of floorSet) {
    if (!blocked.has(key)) walkableSet.add(key);
  }

  const councilSeatMatch = officeCanvasSource.match(/const\s+COUNCIL_SEAT_IDS\s*=\s*\[(.*?)\]/s);
  const councilSeatIds = [];
  if (councilSeatMatch) {
    const re = /'([^']+)'/g;
    let m;
    while ((m = re.exec(councilSeatMatch[1])) !== null) {
      councilSeatIds.push(m[1]);
    }
  }

  const rules = [];

  function addRule(name, issues) {
    rules.push({ name, issues, pass: issues.length === 0 });
  }

  // Rule 0: geometry sanity
  addRule('All furniture footprints are in bounds and catalog-backed', [
    ...outOfBoundsIssues,
    ...furniture
      .filter((f) => !catalog.has(f.type))
      .map((f) => ({ uid: f.uid, col: f.col, row: f.row, reason: `Unknown catalog type: ${f.type}` })),
  ]);

  // Rule 1: wall decor anchored on wall tiles
  const wallDecorIssues = [];
  for (const item of furniture) {
    const entry = catalog.get(item.type);
    if (!entry || !entry.canPlaceOnWalls) continue;

    for (let dc = 0; dc < entry.footprintW; dc++) {
      const c = item.col + dc;
      const r = item.row;
      if (!inBounds(c, r, cols, rows) || tiles[r][c] !== TILE.WALL) {
        wallDecorIssues.push({
          uid: item.uid,
          col: item.col,
          row: item.row,
          reason: 'Wall decor must anchor on wall tiles',
        });
        break;
      }
    }
  }
  addRule('Wall decor is placed only on wall anchors', wallDecorIssues);

  // Rule 2: small props are not floating on open walkable floor
  const smallPropIssues = [];
  for (const item of furniture) {
    const entry = catalog.get(item.type);
    if (!entry) continue;

    if (entry.canPlaceOnSurfaces) {
      for (let dr = 0; dr < entry.footprintH; dr++) {
        for (let dc = 0; dc < entry.footprintW; dc++) {
          const key = toKey(item.col + dc, item.row + dr);
          if (!deskTiles.has(key)) {
            smallPropIssues.push({
              uid: item.uid,
              col: item.col,
              row: item.row,
              reason: 'Surface prop is not on a desk/counter surface',
            });
            dr = entry.footprintH;
            break;
          }
        }
      }
      continue;
    }

    if (/^d_plant_/.test(item.type)) {
      let corner = false;
      for (let dr = 0; dr < entry.footprintH; dr++) {
        for (let dc = 0; dc < entry.footprintW; dc++) {
          const c = item.col + dc;
          const r = item.row + dr;
          const up = inBounds(c, r - 1, cols, rows) && tiles[r - 1][c] === TILE.WALL;
          const down = inBounds(c, r + 1, cols, rows) && tiles[r + 1][c] === TILE.WALL;
          const left = inBounds(c - 1, r, cols, rows) && tiles[r][c - 1] === TILE.WALL;
          const right = inBounds(c + 1, r, cols, rows) && tiles[r][c + 1] === TILE.WALL;
          if ((up && left) || (up && right) || (down && left) || (down && right)) {
            corner = true;
            break;
          }
        }
        if (corner) break;
      }
      if (!corner) {
        smallPropIssues.push({ uid: item.uid, col: item.col, row: item.row, reason: 'Floor plant must be in a corner' });
      }
    }
  }
  addRule('Small props are on desks/counters/corners (not floating on open floor)', smallPropIssues);

  // Rule 3: blocking footprint tiles are excluded from walkable nav
  const navOverlapIssues = [];
  for (const item of furniture) {
    const entry = catalog.get(item.type);
    if (!entry) continue;

    for (let dr = 0; dr < entry.footprintH; dr++) {
      if (dr < (entry.backgroundTiles || 0)) continue;
      for (let dc = 0; dc < entry.footprintW; dc++) {
        const c = item.col + dc;
        const r = item.row + dr;
        const key = toKey(c, r);
        if (walkableSet.has(key)) {
          navOverlapIssues.push({
            uid: item.uid,
            col: c,
            row: r,
            reason: 'Blocking object footprint overlaps walkable nav tile',
          });
        }
      }
    }
  }
  addRule('Blocking object tiles do not overlap walkable nav layer', navOverlapIssues);

  // Rule 4: every in-use desk has a computer
  const deskUseIssues = [];
  const computerTypes = new Set(['d_monitor_on', 'pc']);
  const deskByUid = new Map(desks.map((d) => [d.uid, d]));

  const deskInUse = new Set();
  for (const { item, entry } of chairs) {
    if (!/^chair-|^conf-chair-/.test(item.uid)) continue;
    for (const desk of desks) {
      if (chairNearDesk(item, entry, desk)) {
        deskInUse.add(desk.uid);
      }
    }
  }

  for (const deskUid of deskInUse) {
    const desk = deskByUid.get(deskUid);
    if (!desk) continue;

    let hasComputer = false;
    for (const item of furniture) {
      if (!computerTypes.has(item.type)) continue;
      if (item.col >= desk.col && item.col < desk.col + desk.w && item.row >= desk.row && item.row < desk.row + desk.h) {
        hasComputer = true;
        break;
      }
    }

    if (!hasComputer) {
      deskUseIssues.push({ uid: deskUid, col: desk.col, row: desk.row, reason: 'In-use desk missing laptop/computer prop' });
    }
  }
  addRule('Each in-use desk has a computer prop inside desk bounds', deskUseIssues);

  // Rule 5: agent-at-desk anchors + depth ordering
  const seatIssues = [];
  const relevantSeatIds = new Set(councilSeatIds);
  for (const item of furniture) {
    if (/^chair-/.test(item.uid)) relevantSeatIds.add(item.uid);
  }

  function seatHasDeskInFacing(seat) {
    for (let d = 1; d <= 2; d++) {
      const tc = seat.col + seat.facing.dc * d;
      const tr = seat.row + seat.facing.dr * d;
      if (deskTiles.has(toKey(tc, tr))) return true;
    }
    return false;
  }

  for (const seatId of relevantSeatIds) {
    const seat = seats.get(seatId);
    if (!seat) {
      seatIssues.push({ uid: seatId, col: -1, row: -1, reason: 'Seat ID not found in generated seat map' });
      continue;
    }

    if (!seatHasDeskInFacing(seat)) {
      seatIssues.push({ uid: seatId, col: seat.col, row: seat.row, reason: 'Seat interaction anchor does not face a desk' });
    }

    const chairItem = furniture.find((f) => f.uid === seat.chairUid);
    const chairEntry = chairItem ? catalog.get(chairItem.type) : null;
    if (chairItem && chairEntry) {
      const chairZ = chairEntry.orientation === 'back'
        ? (chairItem.row + 1) * 16 + 1
        : (chairItem.row + 1) * 16;
      const characterZ = (seat.row + 1) * 16 + 0.5;

      if (chairEntry.orientation === 'back') {
        if (!(chairZ > characterZ)) {
          seatIssues.push({ uid: seatId, col: seat.col, row: seat.row, reason: 'Back-facing chair should render in front of seated agent' });
        }
      } else if (!(chairZ <= characterZ)) {
        seatIssues.push({ uid: seatId, col: seat.col, row: seat.row, reason: 'Seat depth ordering should keep seated agent in front of chair' });
      }
    }
  }
  addRule('Agent-at-desk anchors are valid and seat depth ordering is consistent', seatIssues);

  // Rule 6: required utilities + corridor accessibility
  const utilityIssues = [];

  const shelfItems = furniture.filter((f) => /^d_bookshelf/.test(f.type));
  const shelfOnWall = shelfItems.some((item) => {
    const entry = catalog.get(item.type);
    return entry ? hasAdjacentWall(item, entry, tiles, cols, rows) : false;
  });
  if (!shelfOnWall) {
    utilityIssues.push({ uid: 'bookshelves', col: -1, row: -1, reason: 'No bookshelf/cabinet anchored to a wall zone' });
  }

  const hasBreakCooler = furniture.some((f) => f.type === 'd_cooler' && f.col >= 21 && f.col <= 30 && f.row >= 1 && f.row <= 7);
  if (!hasBreakCooler) {
    utilityIssues.push({ uid: 'cooler', col: -1, row: -1, reason: 'Missing water cooler in break/utility area' });
  }

  const doors = [
    { uid: 'door-main-top', col: 20, row: 7 },
    { uid: 'door-main-mid', col: 20, row: 8 },
    { uid: 'door-main-bot', col: 20, row: 9 },
    { uid: 'door-cross-top', col: 25, row: 8 },
    { uid: 'door-cross-bot', col: 26, row: 8 },
  ];

  for (const door of doors) {
    const key = toKey(door.col, door.row);
    if (!inBounds(door.col, door.row, cols, rows) || !isFloor(tiles[door.row][door.col])) {
      utilityIssues.push({ uid: door.uid, col: door.col, row: door.row, reason: 'Door tile is not marked as floor' });
      continue;
    }
    if (!walkableSet.has(key)) {
      utilityIssues.push({ uid: door.uid, col: door.col, row: door.row, reason: 'Door tile is blocked; corridor is not at least 1 tile wide' });
    }
  }

  const corridorChecks = [
    { uid: 'door-main-top-left', col: 19, row: 7 },
    { uid: 'door-main-mid-left', col: 19, row: 8 },
    { uid: 'door-main-bot-left', col: 19, row: 9 },
    { uid: 'door-main-top-right', col: 21, row: 7 },
    { uid: 'door-main-bot-right', col: 21, row: 9 },
    { uid: 'door-cross-25-above', col: 25, row: 7 },
    { uid: 'door-cross-25-below', col: 25, row: 9 },
    { uid: 'door-cross-26-above', col: 26, row: 7 },
    { uid: 'door-cross-26-below', col: 26, row: 9 },
  ];

  for (const probe of corridorChecks) {
    if (!walkableSet.has(toKey(probe.col, probe.row))) {
      utilityIssues.push({ uid: probe.uid, col: probe.col, row: probe.row, reason: 'Required approach tile is not walkable' });
    }
  }

  const start = { col: 2, row: 8 };
  if (walkableSet.has(toKey(start.col, start.row))) {
    for (const target of [{ col: 20, row: 7 }, { col: 20, row: 9 }, { col: 25, row: 8 }, { col: 26, row: 8 }]) {
      if (!bfsReachable(start, target, walkableSet, cols, rows)) {
        utilityIssues.push({ uid: 'corridor-path', col: target.col, row: target.row, reason: 'No 1-tile-wide walkable path to corridor/door target' });
      }
    }
  }

  const workstationDesks = ['desk-a', 'desk-b', 'desk-c', 'desk-d']
    .map((uid) => deskByUid.get(uid))
    .filter(Boolean);

  for (let i = 0; i < workstationDesks.length; i++) {
    for (let j = i + 1; j < workstationDesks.length; j++) {
      const a = workstationDesks[i];
      const b = workstationDesks[j];

      const aRight = a.col + a.w - 1;
      const aBottom = a.row + a.h - 1;
      const bRight = b.col + b.w - 1;
      const bBottom = b.row + b.h - 1;

      const yOverlap = !(aBottom < b.row || bBottom < a.row);
      const xOverlap = !(aRight < b.col || bRight < a.col);

      if (yOverlap) {
        const gapX = aRight < b.col ? (b.col - aRight - 1) : bRight < a.col ? (a.col - bRight - 1) : 0;
        if (gapX < 1) {
          utilityIssues.push({ uid: `${a.uid}|${b.uid}`, col: a.col, row: a.row, reason: 'Desk clusters need at least 1 walkable tile between them (horizontal)' });
        }
      }

      if (xOverlap) {
        const gapY = aBottom < b.row ? (b.row - aBottom - 1) : bBottom < a.row ? (a.row - bBottom - 1) : 0;
        if (gapY < 1) {
          utilityIssues.push({ uid: `${a.uid}|${b.uid}`, col: a.col, row: a.row, reason: 'Desk clusters need at least 1 walkable tile between them (vertical)' });
        }
      }
    }
  }

  addRule('Required utilities exist and corridors stay walkable (>=1 tile)', utilityIssues);

  const allPass = rules.every((r) => r.pass);

  console.log('Office Layout Validator');
  console.log(`Layout source: ${path.relative(ROOT, LAYOUT_FILE)}`);
  console.log(`Map: ${cols}x${rows}, furniture items: ${furniture.length}`);
  console.log('');

  for (const rule of rules) {
    console.log(`[${rule.pass ? 'PASS' : 'FAIL'}] ${rule.name}`);
    if (!rule.pass) {
      for (const issue of rule.issues) {
        const loc = issue.col >= 0 && issue.row >= 0 ? ` @ (${issue.col},${issue.row})` : '';
        console.log(`  - ${issue.uid}${loc}: ${issue.reason}`);
      }
    }
  }

  console.log('');
  console.log(`Overall: ${allPass ? 'PASS' : 'FAIL'}`);

  process.exit(allPass ? 0 : 1);
}

main();
