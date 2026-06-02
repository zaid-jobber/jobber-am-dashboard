import { useState, useEffect } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Settings, Bell, LayoutGrid, Sparkles, Check, Trash2 } from "lucide-react";
import Icon from "./Icon.jsx";
import CommandBar from "./CommandBar.jsx";
import { useNotifications, useEditing, useSettings, useProfile, actions } from "../store/store.js";

const initials = (name) => (name || "").trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "AM";

const TABS = [
  { to: "/", label: "Hub", end: true },
  { to: "/activity", label: "Worklist", key: "worklist" },
  { to: "/pipeline", label: "Pipeline" },
  { to: "/performance", label: "Performance" },
  { to: "/promos", label: "Resources" },
];

export default function Shell({ children, showCustomize = false }) {
  const nav = useNavigate();
  const notifications = useNotifications();
  const editing = useEditing();
  const settings = useSettings();
  const profile = useProfile();
  const tabs = TABS.filter((t) => !(t.key === "worklist" && settings.worklistEnabled === false));
  const unread = notifications.filter((n) => !n.read).length;
  const [cmd, setCmd] = useState(false);
  const [bell, setBell] = useState(false);

  // keep the body class in sync so existing CSS (.editing) keeps working
  useEffect(() => { document.body.classList.toggle("editing", editing); return () => document.body.classList.remove("editing"); }, [editing]);

  const openBell = () => { setBell((b) => !b); };

  return (
    <div className="wrap">
      <div className="nav">
        <div className="logo">
          <svg className="jlogo" viewBox="0 0 80 24" role="img" aria-label="Jobber">
            <text x="0" y="19" fontFamily="'Plus Jakarta Sans', sans-serif" fontWeight="800" fontSize="22" letterSpacing="-1" fill="var(--navy)">Jobber</text>
            <circle cx="74" cy="6" r="3.4" fill="var(--lime)" />
          </svg>
          <span className="amh">AM Hub</span>
        </div>
        <nav className="pillnav">
          {tabs.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className={({ isActive }) => (isActive ? "active" : "")}>{t.label}</NavLink>
          ))}
        </nav>
        <div className="navicons">
          <div className="ic-btn cmd" title="Smart command" onClick={() => setCmd(true)}><Sparkles /></div>
          {showCustomize && <div className={`ic-btn${editing ? " on" : ""}`} title="Customize" onClick={() => actions.setEditing((v) => !v)}><LayoutGrid /></div>}
          <div className="ic-btn" title="Settings" onClick={() => nav("/settings")}><Settings /></div>
          <div className="ic-btn bellbtn" title="Notifications" onClick={openBell}>
            <Bell />{unread > 0 && <span className="bellbadge">{unread > 9 ? "9+" : unread}</span>}
          </div>
          <div className="ava" title="Profile" onClick={() => nav("/profile")} style={{ cursor: "pointer" }}>{initials(profile.name)}</div>

          {bell && (
            <div className="notifpanel" onMouseLeave={() => setBell(false)}>
              <div className="np-head"><b>Notifications</b>
                <span className="np-actions">
                  <button onClick={() => actions.markNotificationsRead()} title="Mark all read"><Check size={14} /></button>
                  <button onClick={() => actions.clearNotifications()} title="Clear"><Trash2 size={14} /></button>
                </span>
              </div>
              {notifications.length === 0 && <div className="np-empty">You're all caught up.</div>}
              {notifications.slice(0, 12).map((n) => (
                <div className={`np-item ${n.read ? "" : "unread"}`} key={n.id}>
                  <span className="np-ic"><Icon name={n.icon} size={15} /></span>
                  <div className="np-t"><b>{n.title}</b><span>{n.sub}</span></div>
                  <span className="np-w">{n.when}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      {children}
      <div className="foot" />
      {cmd && <CommandBar onClose={() => setCmd(false)} />}
    </div>
  );
}
