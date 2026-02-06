* {
  box-sizing: border-box;
  touch-action: none;
  font-family: system-ui, sans-serif;
}

body {
  margin: 0;
  background: #0e0e11;
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
}

header {
  padding: 8px;
}

#controls, #io, #zoomBar {
  display: flex;
  gap: 8px;
  padding: 8px;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
}

label {
  display: flex;
  align-items: center;
  gap: 4px;
}

input {
  width: 60px;
}

button {
  background: #2a2a35;
  color: #fff;
  border: none;
  padding: 6px 10px;
  border-radius: 6px;
}

button:active {
  background: #444;
}

#selectedTileLabel {
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  font-size: 14px;
}

#zoomLabel {
  min-width: 64px;
  text-align: center;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255,255,255,0.08);
  border: 1px solid rgba(255,255,255,0.12);
  font-size: 14px;
}

canvas {
  background: #111;
  margin: 8px 0;
  border: 1px solid #333;
  width: min(96vw, 920px);
  height: min(68vh, 720px);
  touch-action: none;
}

#palette {
  display: flex;
  gap: 8px;
  padding: 8px;
  flex-wrap: wrap;
  justify-content: center;
}

.tile-btn {
  width: 44px;
  height: 44px;
  border-radius: 6px;
  border: 2px solid transparent;
  position: relative;
}

.tile-btn.active {
  border-color: #fff;
}

.tile-btn::after {
  content: attr(data-name);
  position: absolute;
  left: 50%;
  top: 110%;
  transform: translateX(-50%);
  font-size: 11px;
  opacity: 0.85;
  white-space: nowrap;
  pointer-events: none;
}

.import input {
  display: none;
}
