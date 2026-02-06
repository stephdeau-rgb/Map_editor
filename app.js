const canvas = document.getElementById("mapCanvas");
const ctx = canvas.getContext("2d");

let map = {};
let tileSize = 32;
let currentTile = "floor";
let painting = false;

function createMap(w, h) {
  map = {
    version: 1,
    name: "map_001",
    w, h,
    tiles: Array.from({ length: h }, () =>
      Array.from({ length: w }, () => ({ t: "floor", v: 0 }))
    )
  };
  resizeCanvas();
  draw();
}

function resizeCanvas() {
  tileSize = Math.floor(Math.min(
    window.innerWidth / map.w,
    400 / map.h
  ));
  canvas.width = map.w * tileSize;
  canvas.height = map.h * tileSize;
}

function draw() {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  for (let y=0;y<map.h;y++) {
    for (let x=0;x<map.w;x++) {
      const tile = map.tiles[y][x];
      ctx.fillStyle = TILESET[tile.t].color;
      ctx.fillRect(x*tileSize,y*tileSize,tileSize,tileSize);
      ctx.strokeStyle = "#111";
      ctx.strokeRect(x*tileSize,y*tileSize,tileSize,tileSize);
    }
  }
}

function applyTile(x,y) {
  if (x<0||y<0||x>=map.w||y>=map.h) return;
  map.tiles[y][x] = { t: currentTile, v: 0 };
  draw();
}

canvas.addEventListener("pointerdown", e => {
  painting = true;
  handlePointer(e);
});

canvas.addEventListener("pointermove", e => {
  if (painting) handlePointer(e);
});

canvas.addEventListener("pointerup", () => painting = false);
canvas.addEventListener("pointerleave", () => painting = false);

canvas.addEventListener("contextmenu", e => e.preventDefault());

let longPressTimer = null;
canvas.addEventListener("pointerdown", e => {
  longPressTimer = setTimeout(() => {
    const {x,y} = getCell(e);
    currentTile = map.tiles[y][x].t;
    updatePalette();
  }, 500);
});

canvas.addEventListener("pointerup", () => clearTimeout(longPressTimer));

function handlePointer(e) {
  const {x,y} = getCell(e);
  applyTile(x,y);
}

function getCell(e) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor((e.clientX - rect.left) / tileSize);
  const y = Math.floor((e.clientY - rect.top) / tileSize);
  return {x,y};
}

function buildPalette() {
  const p = document.getElementById("palette");
  p.innerHTML = "";
  TILE_KEYS.forEach(key => {
    const b = document.createElement("button");
    b.className = "tile-btn";
    b.style.background = TILESET[key].color;
    b.onclick = () => {
      currentTile = key;
      updatePalette();
    };
    b.dataset.key = key;
    p.appendChild(b);
  });
  updatePalette();
}

function updatePalette() {
  document.querySelectorAll(".tile-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.key === currentTile);
  });
}

document.getElementById("newMap").onclick = () => {
  createMap(+mapW.value, +mapH.value);
};

document.getElementById("fillMap").onclick = () => {
  map.tiles.forEach(row => row.forEach(c => c.t = currentTile));
  draw();
};

document.getElementById("clearMap").onclick = () => {
  map.tiles.forEach(row => row.forEach(c => c.t = "floor"));
  draw();
};

document.getElementById("exportMap").onclick = () => exportMap(map);

document.getElementById("importMap").onchange = e => {
  importMap(e.target.files[0], imported => {
    map = imported;
    resizeCanvas();
    draw();
  });
};

window.addEventListener("resize", () => {
  resizeCanvas();
  draw();
});

buildPalette();
createMap(10,8);
