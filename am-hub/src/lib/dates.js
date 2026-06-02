// Live date helpers (no more hardcoded "7 days left").
export function todayLabel() {
  return new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

// --- Month key + time-off helpers --------------------------------------------
const pad = (n) => String(n).padStart(2, "0");
export const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const monthKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}`;
export const monthLabel = (d = new Date()) => d.toLocaleDateString(undefined, { month: "long" });

// Expand time-off ranges ([{start,end}] as YYYY-MM-DD) into a Set of off days.
export function offDaySet(timeOff = []) {
  const set = new Set();
  for (const t of timeOff || []) {
    if (!t?.start) continue;
    const s = new Date(t.start + "T00:00:00");
    const e = new Date((t.end || t.start) + "T00:00:00");
    if (isNaN(s) || isNaN(e)) continue;
    for (let day = new Date(s); day <= e; day.setDate(day.getDate() + 1)) set.add(dateKey(day));
  }
  return set;
}

const isWeekday = (d) => { const wd = d.getDay(); return wd >= 1 && wd <= 5; };

// Weekdays (Mon–Fri) remaining this month from `d`, counting today, minus time off.
export function sellingDaysLeft(d = new Date(), timeOff = []) {
  const off = offDaySet(timeOff);
  const y = d.getFullYear(), m = d.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  let n = 0;
  for (let day = d.getDate(); day <= lastDay; day++) {
    const dd = new Date(y, m, day);
    if (isWeekday(dd) && !off.has(dateKey(dd))) n++;
  }
  return n;
}

// Total weekdays (Mon–Fri) in the month, minus time off — used to measure pace.
export function sellingDaysInMonth(d = new Date(), timeOff = []) {
  const off = offDaySet(timeOff);
  const y = d.getFullYear(), m = d.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  let n = 0;
  for (let day = 1; day <= lastDay; day++) {
    const dd = new Date(y, m, day);
    if (isWeekday(dd) && !off.has(dateKey(dd))) n++;
  }
  return n;
}

// Weekday time-off days that fall inside the current month (for display).
export function daysOffThisMonth(d = new Date(), timeOff = []) {
  const off = offDaySet(timeOff);
  const y = d.getFullYear(), m = d.getMonth();
  let n = 0;
  for (const key of off) {
    const dd = new Date(key + "T00:00:00");
    if (dd.getFullYear() === y && dd.getMonth() === m && isWeekday(dd)) n++;
  }
  return n;
}

// First Mon–Fri working day of the month that isn't time off.
export function firstWorkingDay(d = new Date(), timeOff = []) {
  const off = offDaySet(timeOff);
  const y = d.getFullYear(), m = d.getMonth();
  const lastDay = new Date(y, m + 1, 0).getDate();
  for (let day = 1; day <= lastDay; day++) {
    const dd = new Date(y, m, day);
    if (isWeekday(dd) && !off.has(dateKey(dd))) return dd;
  }
  return new Date(y, m, 1);
}

export function greeting(name = "", d = new Date()) {
  const h = d.getHours();
  const who = name ? `, ${String(name).trim().split(/\s+/)[0]}` : "";
  return (h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening") + who;
}

// Lightweight "is now a good time to dial" nudge. Connect rates run highest
// early-AM and late-afternoon; midday/lunch is weakest.
export function callWindowNote(d = new Date()) {
  const h = d.getHours();
  if (h < 8) return { good: true, text: "Early — warm up your list before the 8a rush" };
  if (h < 11) return { good: true, text: "Prime dialing window — connect rates peak now" };
  if (h < 13) return { good: false, text: "Lunch lull — batch emails & admin, save dials for 1pm" };
  if (h < 16) return { good: true, text: "Strong afternoon window — push your top accounts" };
  if (h < 18) return { good: true, text: "Last call block — clear scheduled & grace accounts" };
  return { good: false, text: "After hours — wrap up and set tomorrow's focus" };
}
