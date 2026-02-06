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
      validateMap(json);
      callback(json);
    } catch (e) {
      alert("Invalid map file");
    }
  };
  reader.readAsText(file);
}

function validateMap(map) {
  if (!map.w || !map.h || !Array.isArray(map.tiles)) throw "Invalid";
  if (map.tiles.length !== map.h) throw "Invalid";
  map.tiles.forEach(row => {
    if (row.length !== map.w) throw "Invalid";
    row.forEach(cell => {
      if (!cell.t || !(cell.t in TILESET)) throw "Invalid tile";
    });
  });
}
