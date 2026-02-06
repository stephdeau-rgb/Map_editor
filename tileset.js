const TILESET = {
  floor:   { color: "#5b8c5a", walkable: true },
  wall:    { color: "#444", walkable: false },
  forest:  { color: "#2f6b3c", walkable: true },
  water:   { color: "#2a5f9e", walkable: false },
  mountain:{ color: "#7a7a7a", walkable: false },
  throne:  { color: "#c9a24d", walkable: true }
};

const TILE_KEYS = Object.keys(TILESET);
