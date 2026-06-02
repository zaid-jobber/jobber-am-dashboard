import { GripVertical, Minus, Plus, X, SlidersHorizontal, RotateCcw } from "lucide-react";
import { actions } from "../store/store.js";

// Per-tile controls — only visible in customize (body.editing) mode.
export function TileControls({ tkey }) {
  if (!tkey) return null;
  return (
    <div className="tctl">
      <span className="grip" title="Drag to move"><GripVertical size={15} /></span>
      <button onClick={() => actions.resizeTile(tkey, -1)} title="Smaller"><Minus size={14} /></button>
      <button onClick={() => actions.resizeTile(tkey, 1)} title="Bigger"><Plus size={14} /></button>
      <button className="rm" onClick={() => actions.removeTile(tkey)} title="Remove"><X size={15} /></button>
    </div>
  );
}

// Customize panel — lists hidden tiles to add back + reset. Styled like the old editbar.
export function CustomizePanel({ hidden = [] }) {
  return (
    <div className="editbar">
      <span className="et"><SlidersHorizontal size={16} /> Customize</span>
      <span className="hint">Use the tile buttons to move, resize (− / +) or remove. Add hidden tiles below.</span>
      <span className="tiles">
        {hidden.length === 0 && <span className="hint">All tiles are showing.</span>}
        {hidden.map((t) => (
          <button className="tlchip" key={t.key} onClick={() => (t.add ? t.add() : actions.addTile(t.key))}><Plus size={14} /> {t.label}</button>
        ))}
      </span>
      <button className="reset" onClick={() => actions.resetLayout()} title="Reset to default"><RotateCcw size={14} /> Reset</button>
      <button className="done" onClick={() => actions.setEditing(false)}>Done</button>
    </div>
  );
}

// --- legacy stubs (other pages still use these; refactored page-by-page) ---
export function AddTile({ className = "c4" }) {
  return (<div className={`addtilecard ${className}`}><Plus size={26} /><span>Add a tile</span></div>);
}
export function EditBar({ tiles = [] }) {
  return (
    <div className="editbar">
      <span className="et"><SlidersHorizontal size={16} /> Customize</span>
      <span className="hint">Drag to rearrange, remove or add tiles</span>
      <span className="tiles">{tiles.map((t) => (<span className="tlchip" key={t}><Plus size={14} /> {t}</span>))}</span>
      <button className="done" onClick={() => document.body.classList.remove("editing")}>Done</button>
    </div>
  );
}
