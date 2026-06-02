import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

const pad = (n) => String(n).padStart(2, "0");
const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const WD = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MO = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Styled date picker — matches the app's rounded/green UI instead of the native
// OS date popup. Used for time-off ranges in the Profile.
export default function DateField({ value, onChange, min, placeholder = "Select date" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const seed = value ? new Date(value + "T00:00:00") : new Date();
  const [view, setView] = useState(new Date(seed.getFullYear(), seed.getMonth(), 1));

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const openPop = () => { const b = value ? new Date(value + "T00:00:00") : new Date(); setView(new Date(b.getFullYear(), b.getMonth(), 1)); setOpen(true); };

  const y = view.getFullYear(), m = view.getMonth();
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(new Date(y, m, d));
  const minD = min ? new Date(min + "T00:00:00") : null;
  const today = key(new Date());
  const fmt = value ? new Date(value + "T00:00:00").toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }) : "";

  return (
    <div className="dpick" ref={ref}>
      <button type="button" className={`dpick-btn ${value ? "" : "empty"}`} onClick={() => (open ? setOpen(false) : openPop())}>
        <Calendar size={14} /> {fmt || placeholder}
      </button>
      {open && (
        <div className="dpick-pop">
          <div className="dpick-head">
            <button type="button" onClick={() => setView(new Date(y, m - 1, 1))}><ChevronLeft size={16} /></button>
            <span>{MO[m]} {y}</span>
            <button type="button" onClick={() => setView(new Date(y, m + 1, 1))}><ChevronRight size={16} /></button>
          </div>
          <div className="dpick-wd">{WD.map((w) => <span key={w}>{w}</span>)}</div>
          <div className="dpick-grid">
            {cells.map((d, i) => {
              if (!d) return <span key={i} />;
              const k = key(d);
              const dis = minD && d < minD;
              const sel = k === value;
              const isToday = k === today;
              return (
                <button type="button" key={i} disabled={dis} className={`dpick-day${sel ? " sel" : ""}${isToday && !sel ? " today" : ""}`} onClick={() => { onChange(k); setOpen(false); }}>{d.getDate()}</button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
