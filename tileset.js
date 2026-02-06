// Tiles (terrain)
const TILESET = {
  floor:    { color: "#5b8c5a", walkable: true },
  wall:     { color: "#444",    walkable: false },
  forest:   { color: "#2f6b3c", walkable: true },
  water:    { color: "#2a5f9e", walkable: false },
  mountain: { color: "#7a7a7a", walkable: false },
  throne:   { color: "#c9a24d", walkable: true }
};
const TILE_KEYS = Object.keys(TILESET);

// Unit classes (6)
const UNIT_CLASSES = [
  { key: "sword",  label: "Épéiste", short: "S" },
  { key: "archer", label: "Archer",  short: "A" },
  { key: "mage",   label: "Mage",    short: "M" },
  { key: "priest", label: "Prêtre",  short: "P" },
  { key: "lance",  label: "Lancier", short: "L" },
  { key: "axe",    label: "Hache",   short: "H" }
];

function classLabel(key) {
  return UNIT_CLASSES.find(c => c.key === key)?.label ?? key;
}

function classShort(key) {
  return UNIT_CLASSES.find(c => c.key === key)?.short ?? "?";
}
