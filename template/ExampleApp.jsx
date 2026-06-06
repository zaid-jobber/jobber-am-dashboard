// ============================================================================
// EXAMPLE — assembles the kit into a typical dashboard so you can see the look.
// Replace the placeholder content with whatever your project needs.
//   import "./theme.css";  (do this once in your app entry)
// ============================================================================
import { useState } from "react";
import { Settings, Bell, LayoutGrid, TrendingUp, Briefcase, Trophy, Target, Check } from "lucide-react";
import { Shell, PageHead, Grid, Card, Button, Toggle, Stat, StatGrid, Badge, Tag, Bar, Banner, RowItem, Field, Modal, Empty, Spark } from "./ui.jsx";

export default function ExampleApp() {
  const [tab, setTab] = useState("Overview");
  const [section, setSection] = useState("Summary");
  const [toggle, setToggle] = useState(true);
  const [modal, setModal] = useState(false);
  const [banner, setBanner] = useState(true);

  return (
    <Shell
      brand="Acme" tag="Console" avatar="AC"
      tabs={["Overview", "Records", "Insights", "Library", "Settings"].map((l) => ({ label: l, active: tab === l, onClick: () => setTab(l) }))}
      icons={<><div className="ic-btn"><LayoutGrid size={18} /></div><div className="ic-btn"><Settings size={18} /></div><div className="ic-btn"><Bell size={18} /><span className="nub" /></div></>}
    >
      <PageHead
        title="Good afternoon"
        subtitle={<>Tuesday, June 2 · <b>16 items</b> need attention</>}
        tabs={["Summary", "Detail"].map((l) => ({ label: l, active: section === l, onClick: () => setSection(l) }))}
      />

      {banner && (
        <Banner icon={<Target size={18} />} title="Set this month's goal"
          text="Enter your target and the rest is projected. Until then we run on estimates."
          actionLabel="Set goal" onAction={() => setModal(true)} onDismiss={() => setBanner(false)} />
      )}

      <Grid>
        <Card span={4} title="Details" icon={<Briefcase size={16} />}>
          <Field label="Name"><input className="input" placeholder="First Last" /></Field>
          <Field label="Email"><input className="input" placeholder="you@company.com" /></Field>
          <div className="row-item"><span style={{ color: "var(--muted)", fontSize: 13, fontWeight: 600 }}>Notifications</span><span style={{ marginLeft: "auto" }}><Toggle on={toggle} onChange={setToggle} /></span></div>
        </Card>

        <Card span={8} title="This month" icon={<TrendingUp size={16} />} right={<span className="src">live</span>}>
          <StatGrid>
            <Stat value="65%" label="To goal" />
            <Stat value="$5.3k" label="Revenue" />
            <Stat value="27" label="Open items" />
          </StatGrid>
          <div style={{ marginTop: 16 }}><Bar pct={65} /></div>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <Badge tone="green"><Check size={13} /> On pace</Badge><Tag>Seasonal</Tag><Tag>Priority</Tag>
          </div>
        </Card>

        <Card span={8} title="Trend" icon={<TrendingUp size={16} />} right={<span className="src">last 6 months</span>}>
          <Spark points={[34, 42, 38, 55, 49, 61]} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--muted)", fontWeight: 600, marginTop: 6 }}>
            {["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((m) => <span key={m}>{m}</span>)}
          </div>
        </Card>

        <Card span={4} title="Recent" icon={<Trophy size={16} />}>
          {[["Northwind", "Closed · $1.2k"], ["Globex", "In review"], ["Initech", "New"]].map(([n, s], i) =>
            <RowItem key={i} icon={<Trophy size={16} />} title={n} sub={s} />)}
          {false && <Empty>Nothing yet.</Empty>}
        </Card>

        <Card span={12} title="Actions">
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Button onClick={() => setModal(true)}>Primary</Button>
            <Button variant="navy">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="pill">+ Pill action</Button>
          </div>
        </Card>
      </Grid>

      {modal && (
        <Modal title="Set this month's goal" onClose={() => setModal(false)}
          actions={<><button className="btn ghost" onClick={() => setModal(false)}>Cancel</button><button className="btn" onClick={() => setModal(false)}><Check size={15} /> Save</button></>}>
          <p style={{ color: "var(--muted)", fontSize: 13.5, marginTop: 0 }}>A centered modal with the standard backdrop, header and actions footer.</p>
          <Field label="Target ($)"><input className="input" defaultValue="8000" /></Field>
          <Field label="Stretch (%)"><input className="input" defaultValue="100" /></Field>
        </Modal>
      )}
    </Shell>
  );
}
