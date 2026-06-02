import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { syncSalesforce, syncActivity } from "./lib/sync.js";
import { pollFeeds, checkTasks, rollupDevEntries, hydrateFromServer, useOnboarding } from "./store/store.js";
import Onboarding from "./components/Onboarding.jsx";
import Tutorial from "./components/Tutorial.jsx";
import Hub from "./pages/Hub.jsx";
import ActivityList from "./pages/ActivityList.jsx";
import Pipeline from "./pages/Pipeline.jsx";
import Performance from "./pages/Performance.jsx";
import Promos from "./pages/Promos.jsx";
import Settings from "./pages/Settings.jsx";
import Profile from "./pages/Profile.jsx";
import Account from "./pages/Account.jsx";
import Cadence from "./pages/Cadence.jsx";

export default function App() {
  const onboarding = useOnboarding();

  // Pull the AM's server-saved state first (cross-device + survives cache clear),
  // then start the normal sync/poll loops.
  useEffect(() => { hydrateFromServer(); }, []);

  // Regular Salesforce sync (every 10 min) — dormant until creds exist.
  useEffect(() => {
    syncSalesforce();
    syncActivity();
    pollFeeds();
    checkTasks();
    rollupDevEntries(); // persist weekly/monthly development entries
    const roll = setInterval(rollupDevEntries, 60 * 60 * 1000); // hourly check for period rollover
    const sf = setInterval(() => { syncSalesforce(); syncActivity(); }, 10 * 60 * 1000);
    const feeds = setInterval(pollFeeds, 2 * 60 * 1000); // live feeds + notifications
    const tasks = setInterval(checkTasks, 30 * 1000); // task-due alerts
    return () => { clearInterval(sf); clearInterval(feeds); clearInterval(tasks); clearInterval(roll); };
  }, []);

  // First run: setup wizard gates the whole app until Salesforce + profile are set.
  if (!onboarding.done) return <Onboarding />;

  return (
    <>
    {!onboarding.tutorialDone && <Tutorial />}
    <Routes>
      <Route path="/" element={<Hub />} />
      <Route path="/activity" element={<ActivityList />} />
      <Route path="/pipeline" element={<Pipeline />} />
      <Route path="/performance" element={<Performance />} />
      <Route path="/promos" element={<Promos />} />
      <Route path="/development" element={<Navigate to="/performance" replace />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="/account/:id" element={<Account />} />
      <Route path="/account" element={<Account />} />
      <Route path="/cadence" element={<Cadence />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
