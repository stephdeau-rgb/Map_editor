function exportMap(data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${data.name || "map"}.json`;
  a.click();
}

function importMap(file, callback) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const json = JSON.parse(reader.result);
      const upgraded = migrateIfNeeded(json);
      validateMap(upgraded);
      callback(upgraded);
    } catch (e) {
      console.error(e);
      alert("Invalid map file");
    }
  };
  reader.readAsText(file);
}

function migrateIfNeeded(map) {
  // v1 -> v2 migration (keep tiles)
  const v = Number(map?.version || 1);
  if (v >= 2) {
    // ensure fields exist
    map.units ||= [];
    map.forts ||= [];
    map.reinforcements ||= [];
    return map;
  }

  return {
    version: 2,
    name: map.name || "map_001",
    w: map.w,
    h: map.h,
    tiles: map.tiles,
    units: [],
    forts: [],
    reinforcements: []
  };
}

function validateMap(map) {
  if (!map.w || !map.h || !Array.isArray(map.tiles)) throw new Error("Invalid base map");
  if (!map.version) throw new Error("Missing version");
  if (map.tiles.length !== map.h) throw new Error("Invalid height");

  map.tiles.forEach(row => {
    if (!Array.isArray(row) || row.length !== map.w) throw new Error("Invalid width");
    row.forEach(cell => {
      if (!cell?.t || !(cell.t in TILESET)) throw new Error("Invalid tile");
      if (typeof cell.v !== "number") cell.v = 0;
    });
  });

  map.units ||= [];
  map.forts ||= [];
  map.reinforcements ||= [];

  if (!Array.isArray(map.units) || !Array.isArray(map.forts) || !Array.isArray(map.reinforcements)) {
    throw new Error("Invalid arrays");
  }
}
