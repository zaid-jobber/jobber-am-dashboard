// ============================================================================
// UI KIT — content-agnostic components for the airy dashboard theme.
// Pairs with theme.css. Uses lucide-react for icons (npm i lucide-react).
// Copy what you need; everything is plain props, no app logic.
// ============================================================================
import { useEffect } from "react";
import { X } from "lucide-react";

const cx = (...c) => c.filter(Boolean).join(" ");

/* App shell: top bar (brand + centered pill nav + right icons) and a max-width
   page wrapper. `tabs` = [{label, active, onClick}]. `icons` = right-side nodes. */
export function Shell({ brand = "Brand", tag = "Dashboard", tabs = [], icons = null, avatar = "AM", onAvatar, children }) {
  return (
    <div className="wrap">
      <div className="topbar">
        <div className="brand">{brand}{tag && <span className="tag">{tag}</span>}</div>
        <nav className="pillnav">
          {tabs.map((t) => (
            <a key={t.label} className={cx(t.active && "active")} onClick={t.onClick}>{t.label}</a>
          ))}
        </nav>
        <div className="navicons">
          {icons}
          <div className="ava" onClick={onAvatar}>{avatar}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

/* Page header with title + optional right-aligned section tabs. */
export function PageHead({ title, subtitle, tabs }) {
  return (
    <div className="pagehead">
      <div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>
      {tabs && (
        <div className="ptabs">
          {tabs.map((t) => <button key={t.label} className={cx("ptab", t.active && "on")} onClick={t.onClick}>{t.label}</button>)}
        </div>
      )}
    </div>
  );
}

export function Grid({ children }) { return <div className="grid">{children}</div>; }

/* Card with optional header (icon + title + right slot). `span` = 3..12. */
export function Card({ title, icon, right, span = 12, tint, children, className }) {
  return (
    <div className={cx("card", tint && "tint", span && `c${span}`, className)}>
      {(title || right) && (
        <div className="ch">
          <div className="htitle">{icon && <span className="hic">{icon}</span>}{title && <h3>{title}</h3>}</div>
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

export function Button({ variant = "green", children, ...rest }) {
  const cls = variant === "navy" ? "btn navy" : variant === "ghost" ? "btn ghost" : variant === "pill" ? "pill-btn" : "btn";
  return <button className={cls} {...rest}>{children}</button>;
}

export function Toggle({ on, onChange }) {
  return <span className={cx("sw", on && "on")} onClick={() => onChange?.(!on)} />;
}

export function Stat({ value, label }) {
  return <div className="stat"><div className="v num">{value}</div><div className="k">{label}</div></div>;
}
export function StatGrid({ children }) { return <div className="stat-grid">{children}</div>; }

export function Badge({ tone, children }) { return <span className={cx("badge", tone)}>{children}</span>; }
export function Tag({ children }) { return <span className="tag">{children}</span>; }

export function Bar({ pct = 0 }) { return <div className="bar"><i style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>; }

/* CTA banner. `icon` node, title, text, action button label + onAction. */
export function Banner({ icon, title, text, actionLabel, onAction, onDismiss }) {
  return (
    <div className="banner">
      <div className="bl">{icon && <span className="bic">{icon}</span>}<div><b>{title}</b><span>{text}</span></div></div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {actionLabel && <button className="btn" onClick={onAction}>{actionLabel}</button>}
        {onDismiss && <button className="modal-x" onClick={onDismiss}><X size={15} /></button>}
      </div>
    </div>
  );
}

export function RowItem({ icon, title, sub, end }) {
  return (
    <div className="row-item">
      {icon && <span className="ri-ic">{icon}</span>}
      <div><b>{title}</b>{sub && <span>{sub}</span>}</div>
      {end && <span className="ri-end">{end}</span>}
    </div>
  );
}

export function Field({ label, children }) {
  return <label className="field"><span style={{ fontSize: 12.5, fontWeight: 700 }}>{label}</span>{children}</label>;
}

/* Centered modal with backdrop, close button, and an actions footer slot. */
export function Modal({ title, onClose, children, actions }) {
  useEffect(() => {
    const h = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal">
        <button className="modal-x" onClick={onClose}><X size={16} /></button>
        {title && <h2 style={{ fontSize: 21, fontWeight: 800, color: "var(--navy)", margin: "2px 0 14px", letterSpacing: "-.5px" }}>{title}</h2>}
        {children}
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
}

export function Empty({ children }) { return <div className="empty">{children}</div>; }

/* Sparkline — crisp at any width; last point gets a clean dot. */
export function Spark({ points = [] }) {
  if (!points.length) return null;
  const max = Math.max(...points), min = Math.min(...points), span = (max - min) || 1;
  const W = 100, H = 34, pad = 3;
  const x = (i) => pad + (i / (points.length - 1 || 1)) * (W - pad * 2);
  const y = (v) => pad + (1 - (v - min) / span) * (H - pad * 2);
  const line = points.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const last = points.length - 1;
  return (
    <div className="spark-wrap">
      <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        <defs><linearGradient id="spk" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--green)" stopOpacity="0.18" /><stop offset="100%" stopColor="var(--green)" stopOpacity="0" /></linearGradient></defs>
        <polygon points={`${pad},${H - pad} ${line} ${W - pad},${H - pad}`} fill="url(#spk)" />
        <polyline points={line} fill="none" stroke="var(--green)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <span className="spark-dot" style={{ left: `${(x(last) / W) * 100}%`, top: `${(y(points[last]) / H) * 100}%` }} />
    </div>
  );
}
