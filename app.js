const canvas = document.getElementById("mapCanvas");
const ctx = canvas.getContext("2d");

const zoomLabelEl = document.getElementById("zoomLabel");
const selectedToolLabelEl = document.getElementById("selectedToolLabel");

// JSON panel
const toggleJsonPanelBtn = document.getElementById("toggleJsonPanel");
const jsonPanelEl = document.getElementById("jsonPanel");
const jsonTextEl = document.getElementById("jsonText");
const jsonMsgEl = document.getElementById("jsonMsg");
const copyJsonBtn = document.getElementById("copyJson");
const pasteImportJsonBtn = document.getElementById("pasteImportJson");
const formatJsonBtn = document.getElementById("formatJson");

// Mode buttons
const modeButtons = Array.from(document.querySelectorAll(".mode-btn"));
const terrainToolsEl = document.getElementById("terrainTools");
const unitToolsEl = document.getElementById("unitTools");
const fortToolsEl = document.getElementById("fortTools");

// Unit controls
const unitTeamEl = document.getElementById("unitTeam");
const unitClassEl = document.getElementById("unitClass");
const unitLvlEl = document.getElementById("unitLvl");
const deleteSelectedUnitBtn = document.getElementById("deleteSelectedUnit");

// Fort controls
const fortOwnerEl = document.getElementById("fortOwner");
const deleteSelectedFortBtn = document.getElementById("deleteSelectedFort");

let map = {};

// Rendering base
const baseTileSize = 32;

// View transform
let viewScale = 1;
let viewOffsetX = 0;
let viewOffsetY = 0;

// Editor state
let mode = "terrain";
let currentTile = "floor";
let selectedUnitId = null;
let selectedFortId = null;

// Interaction state
let painting = false;
const pointers = new Map(); // pointerId -> {x,y}
let longPressTimer = null;

// Gesture state (2 fingers pan/zoom)
let gesture = {
  active: false,
  startDist: 0,
  startScale: 1,
  lastCenter: { x: 0, y: 0 }
};

// --- Setup UI for classes ---
function initClassDropdown() {
  unitClassEl.innerHTML = "";
  for (const c of UNIT_CLASSES) {
    const opt = document.createElement("option");
    opt.value = c.key;
    opt.textContent = c.label;
    unitClassEl.appendChild(opt);
  }
  unitClassEl.value = "sword";
}

// --- Map creation ---
function createMap(w, h) {
  map = {
    version: 2,
    name: "map_001",
    w, h,
    tiles: Array.from({ length: h }, () =>
      Array.from({ length: w }, () => ({ t: "floor", v: 0 }))
    ),
    units: [],
    forts: [],
    reinforcements: []
  };

  selectedUnitId = null;
  selectedFortId = null;

  resetViewToFit();
  draw();
  refreshSelectionUI();
  syncJsonTextareaFromMap(false);
  toastJson("Map créée.", "ok");
}

function worldSizePx() {
  return { w: map.w * baseTileSize, h: map.h * baseTileSize };
}

// --- Canvas sizing ---
function resizeCanvasToCSS() {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(rect.height * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function resetViewToFit() {
  resizeCanvasToCSS();
  const rect = canvas.getBoundingClientRect();
  const canvasW = rect.width;
  const canvasH = rect.height;

  const ws = worldSizePx();
  const fitScale = Math.min((canvasW - 16) / ws.w, (canvasH - 16) / ws.h);
  viewScale = clamp(fitScale, 0.2, 2);

  const worldW = ws.w * viewScale;
  const worldH = ws.h * viewScale;
  viewOffsetX = (canvasW - worldW) / 2;
  viewOffsetY = (canvasH - worldH) / 2;

  updateZoomLabel();
}

function clampView() {
  const rect = canvas.getBoundingClientRect();
  const canvasW = rect.width;
  const canvasH = rect.height;

  const ws = worldSizePx();
  const worldW = ws.w * viewScale;
  const worldH = ws.h * viewScale;

  if (worldW <= canvasW) viewOffsetX = (canvasW - worldW) / 2;
  else viewOffsetX = clamp(viewOffsetX, canvasW - worldW, 0);

  if (worldH <= canvasH) viewOffsetY = (canvasH - worldH) / 2;
  else viewOffsetY = clamp(viewOffsetY, canvasH - worldH, 0);
}

// --- Coordinate helpers ---
function screenToWorld(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const sx = clientX - rect.left;
  const sy = clientY - rect.top;
  const wx = (sx - viewOffsetX) / viewScale;
  const wy = (sy - viewOffsetY) / viewScale;
  return { wx, wy };
}

function worldToCell(wx, wy) {
  return { x: Math.floor(wx / baseTileSize), y: Math.floor(wy / baseTileSize) };
}

function getCellFromClient(clientX, clientY) {
  const { wx, wy } = screenToWorld(clientX, clientY);
  return worldToCell(wx, wy);
}

function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < map.w && y < map.h;
}

// --- Data queries ---
function findUnitAt(x, y) {
  return map.units.find(u => u.x === x && u.y === y) || null;
}

function findFortAt(x, y) {
  return map.forts.find(f => f.x === x && f.y === y) || null;
}

function getSelectedUnit() {
  return map.units.find(u => u.id === selectedUnitId) || null;
}

function getSelectedFort() {
  return map.forts.find(f => f.id === selectedFortId) || null;
}

function nextId(prefix) {
  let n = 1;
  while (true) {
    const id = `${prefix}${n}`;
    const exists =
      map.units.some(u => u.id === id) ||
      map.forts.some(f => f.id === id) ||
      map.reinforcements.some(r => r.id === id);
    if (!exists) return id;
    n++;
  }
}

// --- Drawing ---
function draw() {
  resizeCanvasToCSS();
  const rect = canvas.getBoundingClientRect();
  const canvasW = rect.width;
  const canvasH = rect.height;

  ctx.clearRect(0, 0, canvasW, canvasH);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(viewOffsetX, viewOffsetY);
  ctx.scale(viewScale, viewScale);

  // Culling
  const invScale = 1 / viewScale;
  const left = (-viewOffsetX) * invScale;
  const top = (-viewOffsetY) * invScale;
  const right = left + canvasW * invScale;
  const bottom = top + canvasH * invScale;

  const startX = clamp(Math.floor(left / baseTileSize) - 1, 0, map.w - 1);
  const startY = clamp(Math.floor(top / baseTileSize) - 1, 0, map.h - 1);
  const endX = clamp(Math.ceil(right / baseTileSize) + 1, 0, map.w);
  const endY = clamp(Math.ceil(bottom / baseTileSize) + 1, 0, map.h);

  // Tiles
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const tile = map.tiles[y][x];
      ctx.fillStyle = TILESET[tile.t].color;
      ctx.fillRect(x * baseTileSize, y * baseTileSize, baseTileSize, baseTileSize);
      ctx.strokeStyle = "#111";
      ctx.strokeRect(x * baseTileSize, y * baseTileSize, baseTileSize, baseTileSize);
    }
  }

  // Forts overlay
  for (const f of map.forts) {
    if (f.x < startX || f.x >= endX || f.y < startY || f.y >= endY) continue;

    const cx = f.x * baseTileSize + baseTileSize / 2;
    const cy = f.y * baseTileSize + baseTileSize / 2;

    ctx.save();
    ctx.translate(cx, cy);

    ctx.fillStyle = (f.owner === "player") ? "rgba(120,180,255,0.85)" : "rgba(255,120,120,0.85)";
    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(-baseTileSize * 0.26, -baseTileSize * 0.26, baseTileSize * 0.52, baseTileSize * 0.52);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "rgba(0,0,0,0.8)";
    ctx.font = `bold ${Math.max(12, baseTileSize * 0.28)}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("F", 0, 0);

    if (f.id === selectedFortId) {
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.rect(-baseTileSize * 0.33, -baseTileSize * 0.33, baseTileSize * 0.66, baseTileSize * 0.66);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Units overlay
  for (const u of map.units) {
    if (u.x < startX || u.x >= endX || u.y < startY || u.y >= endY) continue;

    const cx = u.x * baseTileSize + baseTileSize / 2;
    const cy = u.y * baseTileSize + baseTileSize / 2;
    const radius = baseTileSize * 0.28;

    ctx.beginPath();
    ctx.fillStyle = (u.team === "player") ? "rgba(120,180,255,0.95)" : "rgba(255,120,120,0.95)";
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(0,0,0,0.55)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.font = `bold ${Math.max(12, baseTileSize * 0.30)}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(classShort(u.class), cx, cy);

    if (u.id === selectedUnitId) {
      ctx.strokeStyle = "rgba(255,255,255,0.95)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.restore();
}

// --- Palette (Terrain only) ---
function buildPalette() {
  const p = document.getElementById("palette");
  p.innerHTML = "";

  TILE_KEYS.forEach(key => {
    const b = document.createElement("button");
    b.className = "tile-btn";
    b.style.background = TILESET[key].color;
    b.dataset.key = key;
    b.dataset.name = key;
    b.title = key;

    b.onclick = () => {
      currentTile = key;
      updatePalette();
      updateStatusLabel();
    };

    p.appendChild(b);
  });

  updatePalette();
}

function updatePalette() {
  document.querySelectorAll(".tile-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.key === currentTile);
  });
  document.getElementById("palette").style.display = (mode === "terrain") ? "flex" : "none";
}

// --- Status label ---
function updateStatusLabel() {
  if (mode === "terrain") {
    selectedToolLabelEl.textContent = `Mode: terrain • Tool: ${currentTile}`;
    return;
  }
  if (mode === "units") {
    const team = unitTeamEl.value === "player" ? "Allié" : "Ennemi";
    selectedToolLabelEl.textContent = `Mode: units • ${team} • ${classLabel(unitClassEl.value)} • Lvl ${unitLvlEl.value}`;
    return;
  }
  if (mode === "forts") {
    const owner = fortOwnerEl.value === "player" ? "Allié" : "Ennemi";
    selectedToolLabelEl.textContent = `Mode: forts • Owner: ${owner}`;
  }
}

function refreshSelectionUI() {
  deleteSelectedUnitBtn.disabled = !getSelectedUnit();
  deleteSelectedFortBtn.disabled = !getSelectedFort();
}

// --- Zoom controls ---
function updateZoomLabel() {
  zoomLabelEl.textContent = `${Math.round(viewScale * 100)}%`;
}

function zoomAt(clientX, clientY, factor) {
  const rect = canvas.getBoundingClientRect();
  const sx = clientX - rect.left;
  const sy = clientY - rect.top;

  const wx = (sx - viewOffsetX) / viewScale;
  const wy = (sy - viewOffsetY) / viewScale;

  const newScale = clamp(viewScale * factor, 0.2, 6);
  if (newScale === viewScale) return;

  viewScale = newScale;

  viewOffsetX = sx - wx * viewScale;
  viewOffsetY = sy - wy * viewScale;

  clampView();
  updateZoomLabel();
  draw();
}

canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const delta = -e.deltaY;
  const factor = delta > 0 ? 1.08 : 1 / 1.08;
  zoomAt(e.clientX, e.clientY, factor);
}, { passive: false });

// Zoom buttons
document.getElementById("zoomIn").onclick = () => {
  const r = canvas.getBoundingClientRect();
  zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.15);
};
document.getElementById("zoomOut").onclick = () => {
  const r = canvas.getBoundingClientRect();
  zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.15);
};
document.getElementById("zoomReset").onclick = () => {
  resetViewToFit();
  draw();
};

// --- Mode switching ---
function setMode(next) {
  mode = next;
  selectedUnitId = null;
  selectedFortId = null;
  refreshSelectionUI();

  terrainToolsEl.classList.toggle("hidden", mode !== "terrain");
  unitToolsEl.classList.toggle("hidden", mode !== "units");
  fortToolsEl.classList.toggle("hidden", mode !== "forts");

  for (const b of modeButtons) b.classList.toggle("active", b.dataset.mode === mode);

  updatePalette();
  updateStatusLabel();
  draw();
}

modeButtons.forEach(b => b.onclick = () => setMode(b.dataset.mode));

// --- Pointer interactions ---
canvas.addEventListener("pointerdown", (e) => {
  canvas.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  // long press quick pick
  if (pointers.size === 1) {
    clearTimeout(longPressTimer);
    longPressTimer = setTimeout(() => {
      const { x, y } = getCellFromClient(e.clientX, e.clientY);
      if (!inBounds(x, y)) return;

      if (mode === "terrain") {
        currentTile = map.tiles[y][x].t;
        updatePalette();
        updateStatusLabel();
        toastJson(`Pipette: ${currentTile}`, "ok");
      } else if (mode === "units") {
        const u = findUnitAt(x, y);
        selectedUnitId = u ? u.id : null;
        refreshSelectionUI();
        draw();
      } else if (mode === "forts") {
        const f = findFortAt(x, y);
        selectedFortId = f ? f.id : null;
        refreshSelectionUI();
        draw();
      }
    }, 450);
  } else {
    clearTimeout(longPressTimer);
  }

  // 2 pointers => gesture
  if (pointers.size === 2) {
    painting = false;
    startTwoFingerGesture();
    return;
  }

  handlePrimaryAction(e.clientX, e.clientY, true);
});

canvas.addEventListener("pointermove", (e) => {
  if (!pointers.has(e.pointerId)) return;
  pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

  if (pointers.size === 2) {
    clearTimeout(longPressTimer);
    handleTwoFingerGesture();
    return;
  }

  if (mode === "terrain" && painting) {
    clearTimeout(longPressTimer);
    handlePrimaryAction(e.clientX, e.clientY, false);
  }
});

function endPointer(e) {
  pointers.delete(e.pointerId);
  clearTimeout(longPressTimer);

  if (pointers.size < 2) gesture.active = false;
  if (pointers.size === 0) painting = false;
}

canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointercancel", endPointer);
canvas.addEventListener("pointerleave", endPointer);
canvas.addEventListener("contextmenu", e => e.preventDefault());

function handlePrimaryAction(clientX, clientY, isDown) {
  const { x, y } = getCellFromClient(clientX, clientY);
  if (!inBounds(x, y)) return;

  if (mode === "terrain") {
    if (isDown) painting = true;
    map.tiles[y][x] = { t: currentTile, v: 0 };
    draw();
    return;
  }

  if (mode === "units") {
    if (!isDown) return;

    const hit = findUnitAt(x, y);
    if (hit) {
      selectedUnitId = hit.id;
      selectedFortId = null;
      refreshSelectionUI();
      draw();
      return;
    }

    const selected = getSelectedUnit();
    if (selected) {
      if (!findUnitAt(x, y)) {
        selected.x = x; selected.y = y;
        draw();
      }
      return;
    }

    if (findUnitAt(x, y)) return;

    const team = unitTeamEl.value;
    const cls = unitClassEl.value;
    const lvl = clamp(parseInt(unitLvlEl.value || "1", 10) || 1, 1, 50);

    const prefix = (team === "player") ? "P" : "E";
    const id = nextId(prefix);

    map.units.push({ id, team, class: cls, x, y, lvl });
    selectedUnitId = id;
    refreshSelectionUI();
    draw();
    return;
  }

  if (mode === "forts") {
    if (!isDown) return;

    const hit = findFortAt(x, y);
    if (hit) {
      selectedFortId = hit.id;
      selectedUnitId = null;
      refreshSelectionUI();
      draw();
      return;
    }

    const selected = getSelectedFort();
    if (selected) {
      if (!findFortAt(x, y)) {
        selected.x = x; selected.y = y;
        draw();
      }
      return;
    }

    if (findFortAt(x, y)) return;

    const owner = fortOwnerEl.value;
    const id = nextId("F");
    map.forts.push({ id, x, y, owner });

    selectedFortId = id;
    refreshSelectionUI();
    draw();
  }
}

// --- 2-finger gestures ---
function startTwoFingerGesture() {
  const pts = Array.from(pointers.values());
  const a = pts[0], b = pts[1];
  const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const dist = Math.hypot(a.x - b.x, a.y - b.y);

  gesture.active = true;
  gesture.startDist = dist;
  gesture.startScale = viewScale;
  gesture.lastCenter = center;
}

function handleTwoFingerGesture() {
  if (!gesture.active) startTwoFingerGesture();

  const pts = Array.from(pointers.values());
  const a = pts[0], b = pts[1];
  const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const dist = Math.hypot(a.x - b.x, a.y - b.y);

  // Pan
  const dx = center.x - gesture.lastCenter.x;
  const dy = center.y - gesture.lastCenter.y;
  viewOffsetX += dx;
  viewOffsetY += dy;

  // Pinch zoom around center
  const scaleFactor = dist / (gesture.startDist || dist);
  const newScale = clamp(gesture.startScale * scaleFactor, 0.2, 6);

  const rect = canvas.getBoundingClientRect();
  const sx = center.x - rect.left;
  const sy = center.y - rect.top;

  const wx = (sx - viewOffsetX) / viewScale;
  const wy = (sy - viewOffsetY) / viewScale;

  viewScale = newScale;
  viewOffsetX = sx - wx * viewScale;
  viewOffsetY = sy - wy * viewScale;

  gesture.lastCenter = center;

  clampView();
  updateZoomLabel();
  draw();
}

// --- File IO ---
document.getElementById("newMap").onclick = () => {
  const w = clamp(+mapW.value, 5, 64);
  const h = clamp(+mapH.value, 5, 64);
  createMap(w, h);
};

document.getElementById("fillMap").onclick = () => {
  if (mode !== "terrain") return;
  map.tiles.forEach(row => row.forEach(c => { c.t = currentTile; c.v = 0; }));
  draw();
};

document.getElementById("clearMap").onclick = () => {
  map.tiles.forEach(row => row.forEach(c => { c.t = "floor"; c.v = 0; }));
  draw();
};

document.getElementById("exportMap").onclick = () => {
  exportMap(map);
  syncJsonTextareaFromMap(false);
  toastJson("Export fichier OK. JSON mis à jour.", "ok");
};

document.getElementById("importMap").onchange = e => {
  const f = e.target.files?.[0];
  if (!f) return;

  importMap(f, imported => {
    map = imported;
    selectedUnitId = null;
    selectedFortId = null;
    resetViewToFit();
    refreshSelectionUI();
    updateStatusLabel();
    draw();
    syncJsonTextareaFromMap(false);
    toastJson("Import fichier OK.", "ok");
  });

  e.target.value = "";
};

deleteSelectedUnitBtn.onclick = () => {
  const u = getSelectedUnit();
  if (!u) return;
  map.units = map.units.filter(x => x.id !== u.id);
  selectedUnitId = null;
  refreshSelectionUI();
  draw();
};

deleteSelectedFortBtn.onclick = () => {
  const f = getSelectedFort();
  if (!f) return;
  map.forts = map.forts.filter(x => x.id !== f.id);
  map.reinforcements = (map.reinforcements || []).filter(r => r.fortId !== f.id);

  selectedFortId = null;
  refreshSelectionUI();
  draw();
};

// --- JSON Copy/Paste panel logic ---
toggleJsonPanelBtn.onclick = () => {
  jsonPanelEl.classList.toggle("hidden");
  if (!jsonPanelEl.classList.contains("hidden")) {
    syncJsonTextareaFromMap(false);
    jsonTextEl.focus();
  }
};

copyJsonBtn.onclick = async () => {
  try {
    syncJsonTextareaFromMap(true);
    await navigator.clipboard.writeText(jsonTextEl.value);
    toastJson("JSON copié dans le presse-papiers.", "ok");
  } catch (e) {
    // fallback: select text
    jsonTextEl.focus();
    jsonTextEl.select();
    toastJson("Copie auto indispo : texte sélectionné (Cmd/Ctrl+C).", "warn");
  }
};

formatJsonBtn.onclick = () => {
  try {
    const raw = jsonTextEl.value.trim();
    const obj = JSON.parse(raw);
    jsonTextEl.value = JSON.stringify(obj, null, 2);
    toastJson("JSON formaté.", "ok");
  } catch (e) {
    toastJson("JSON invalide : impossible de formater.", "err");
  }
};

pasteImportJsonBtn.onclick = () => {
  const raw = jsonTextEl.value.trim();
  if (!raw) {
    toastJson("Colle un JSON dans la zone avant d’importer.", "warn");
    return;
  }

  try {
    const obj = JSON.parse(raw);
    const upgraded = migrateIfNeeded(obj); // from io.js
    validateMap(upgraded);                // from io.js

    map = upgraded;
    selectedUnitId = null;
    selectedFortId = null;
    resetViewToFit();
    refreshSelectionUI();
    updateStatusLabel();
    draw();
    syncJsonTextareaFromMap(false);
    toastJson("Import JSON (copier/coller) OK.", "ok");
  } catch (e) {
    console.error(e);
    toastJson("Import KO : JSON invalide ou map non conforme.", "err");
  }
};

function syncJsonTextareaFromMap(force) {
  // force = overwrite even if user is typing (safe default)
  if (!jsonPanelEl || jsonPanelEl.classList.contains("hidden")) return;
  if (!force && document.activeElement === jsonTextEl) return;
  jsonTextEl.value = JSON.stringify(map, null, 2);
}

function toastJson(msg, kind) {
  jsonMsgEl.textContent = msg;
  // no color requirement, keep subtle
  // kind can be "ok" | "warn" | "err"
}

// Update status label on tool changes
unitTeamEl.onchange = updateStatusLabel;
unitClassEl.onchange = updateStatusLabel;
unitLvlEl.oninput = updateStatusLabel;
fortOwnerEl.onchange = updateStatusLabel;

// Responsive
window.addEventListener("resize", () => {
  clampView();
  draw();
});

// --- Utils ---
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// Init
initClassDropdown();
buildPalette();
createMap(10, 8);
setMode("terrain");
updateStatusLabel();
