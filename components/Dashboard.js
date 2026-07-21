"use client";
import React, { useState, useEffect, useMemo, useRef } from "react";
import { getWorkout } from "@/lib/workouts";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from "recharts";
import {
  Timer, Dumbbell, Activity, Waves, Coffee, Moon, Beer, Sparkles,
  Check, ChevronLeft, ChevronRight, CalendarDays, TrendingUp, Settings, Flame, Home,
} from "lucide-react";

/* ---------------------------------------------------------------- tokens */
const C = {
  paper: "#F3F4EF",
  card: "#FBFBF8",
  ink: "#17191E",
  slate: "#5B6270",
  faint: "#8A8F98",
  line: "#DFE0D8",
  brass: "#A9803B",
  brassSoft: "#EFE3CB",
  green: "#245844",
  greenSoft: "#DCE7DF",
  berry: "#8E3B54",
  berrySoft: "#F0DEE4",
};
const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600;9..144,700&family=Instrument+Sans:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap');
`;
const serif = "'Fraunces', Georgia, serif";
const sans = "'Instrument Sans', system-ui, sans-serif";
const mono = "'Space Mono', ui-monospace, monospace";

/* ---------------------------------------------------------------- dates */
const pad = (n) => String(n).padStart(2, "0");
const toStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromStr = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = fromStr(s); d.setDate(d.getDate() + n); return toStr(d); };
const diffDays = (a, b) => Math.round((fromStr(b) - fromStr(a)) / 86400000);
const mondayOf = (s) => { const d = fromStr(s); const off = (d.getDay() + 6) % 7; return addDays(s, -off); };
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const pretty = (s) => { const d = fromStr(s); return `${DOW[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`; };
const prettyShort = (s) => { const d = fromStr(s); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };

/* ---------------------------------------------------------------- program */
const WARMUP_START = "2026-07-20";
const PROGRAM_START = "2026-07-27";
const PROGRAM_END = "2026-11-13";
const WEEKOFF_START = "2026-11-16";
const WEDDING = "2026-11-21";
const BUCKS_FRI = "2026-10-09";
const BUCKS_SAT = "2026-10-10";

const WEEKS = [
  { mon: "2026-07-20", kind: "warmup", block: "Warm-up week", num: 0 },
  { mon: "2026-07-27", kind: "build", block: "Block 1 · Foundation", num: 1 },
  { mon: "2026-08-03", kind: "build", block: "Block 1 · Foundation", num: 2 },
  { mon: "2026-08-10", kind: "build", block: "Block 1 · Foundation", num: 3 },
  { mon: "2026-08-17", kind: "deload", block: "Block 1 · Foundation", num: 4, refeed: true },
  { mon: "2026-08-24", kind: "build", block: "Block 2 · Build", num: 5 },
  { mon: "2026-08-31", kind: "build", block: "Block 2 · Build", num: 6 },
  { mon: "2026-09-07", kind: "build", block: "Block 2 · Build", num: 7 },
  { mon: "2026-09-14", kind: "deload", block: "Block 2 · Build", num: 8, refeed: true },
  { mon: "2026-09-21", kind: "build", block: "Block 3 · Push", num: 9 },
  { mon: "2026-09-28", kind: "build", block: "Block 3 · Push", num: 10 },
  { mon: "2026-10-05", kind: "bucks", block: "Block 3 · Push", num: 11 },
  { mon: "2026-10-12", kind: "deload", block: "Block 3 · Push", num: 12, refeed: true, recovery: true },
  { mon: "2026-10-19", kind: "peak", block: "Block 4 · Peak", num: 13 },
  { mon: "2026-10-26", kind: "peak", block: "Block 4 · Peak", num: 14 },
  { mon: "2026-11-02", kind: "peak", block: "Block 4 · Peak", num: 15 },
  { mon: "2026-11-09", kind: "peak", block: "Block 4 · Peak", num: 16, endsFri: true },
  { mon: "2026-11-16", kind: "weekoff", block: "Wedding week", num: 0 },
];
const weekByMon = (m) => WEEKS.find((w) => w.mon === m) || null;

const ROT = [
  { 1: "run", 3: "push", 4: "beach" },
  { 1: "beach", 3: "run", 4: "push" },
  { 1: "push", 3: "beach", 4: "run" },
];

// Race week (JPM Corporate Challenge, Wed 21 Oct eve): push Mon, race Wed, shakeout Fri
const OVERRIDES = { "2026-10-19": "push", "2026-10-21": "race", "2026-10-23": "shakeout" };

function stepGoal(dateStr) {
  const d = fromStr(dateStr), y = d.getFullYear(), m = d.getMonth();
  if (y !== 2026) return 0;
  if (m === 8) return 10000;                              // September — Steptember
  if (m === 7 || m === 9) return 5000;                    // August, October
  if (m === 10 && dateStr <= PROGRAM_END) return 5000;    // 1–13 Nov
  return 0;
}

const SESS = {
  run: { title: "Treadmill 5K", icon: Timer, tint: C.brass },
  push: { title: "Push-up build", icon: Activity, tint: C.brass },
  beach: { title: "Beach muscles", icon: Dumbbell, tint: C.brass },
  pilates: { title: "Pilates", icon: Waves, tint: C.green },
  outdoor: { title: "Outdoor run", icon: Timer, tint: C.green },
  cheat: { title: "Cheat day", icon: Coffee, tint: C.berry },
  bucks: { title: "Bucks — off", icon: Beer, tint: C.berry },
  off: { title: "Rest", icon: Moon, tint: C.faint },
  light: { title: "Light session", icon: Sparkles, tint: C.green },
  taper: { title: "Taper — off", icon: Sparkles, tint: C.green },
  race: { title: "JPM Corporate Challenge", icon: Timer, tint: C.berry },
  shakeout: { title: "Shakeout jog", icon: Timer, tint: C.green },
};

function sessionDetail(type, kind) {
  const deload = kind === "deload";
  const peak = kind === "peak";
  switch (type) {
    case "run":
      if (deload) return "Easy 3–4km, conversational pace. No hard efforts — let the legs recover.";
      if (peak) return "5K time-trial or race-pace reps. Empty the tank and chase a PB.";
      return "Quality 5K: rotate weekly between 5×3min hard / 90s easy, a 20-min tempo, or a full time-trial. Chip below 27:30.";
    case "push":
      if (deload) return "2–3 easy sets, ~50 total. Keep the shoulders happy.";
      if (peak) return "Test day: go for max unbroken, then top up to 100 total. Log the big set.";
      return "Accumulate 100 across sets (ladders or 10×10). Log your best unbroken set each time.";
    case "beach":
      if (deload) return "Back / chest / arms — 2 light sets each, ~60%. Pump, not grind.";
      if (peak) return "Back / chest / arms — heavy top sets of 6–8, then a burnout finisher.";
      return "Back / chest / arms — 4–5 moves, 3–4 sets of 8–12. Add a rep or a plate each week.";
    case "outdoor":
      if (deload) return "Easy 20–25 min jog or a brisk walk. Fresh air, no watch-watching.";
      return "Easy/steady 30–40 min at a chatty pace. This builds the engine behind your 5K.";
    case "race":
      return "JPM Corporate Challenge — ~5.6km fun run this evening. Run it as a hard tempo: settle early, push the back half. A cracking fitness check mid-peak.";
    case "shakeout":
      return "Easy 15–20 min shakeout to flush the legs after last night's race. Keep it gentle.";
    case "pilates":
      return "Your weekly class — core, mobility, and a bit of recovery. Same slot each week.";
    case "cheat":
      return "Enjoy it — no macro tracking today. Still get your creatine in.";
    case "bucks":
      return "Off the leash. Back to it Monday, no guilt.";
    case "light":
      return "Ease back into movement — light effort only. Knock out a baseline test while you're at it.";
    case "taper":
      return "Rest and feel good. A gentle walk if you fancy it, nothing more.";
    default:
      return "Rest day. Creatine still, then put your feet up.";
  }
}

function nutritionNote(week, dow, isBucksDay) {
  if (!week) return "Log your baseline weigh-in when you're ready.";
  if (isBucksDay) return "🍻 Bucks — off the leash. Back on it Monday.";
  if (dow === 6) return week.refeed ? "Re-feed Saturday — enjoy the bigger meals guilt-free." : "Cheat day — enjoy it, no tracking needed. Creatine still.";
  if (week.kind === "warmup") return "Eat normally (~2500). Just rebuild the habit this week.";
  if (week.kind === "weekoff") return "Taper — eat around maintenance. Rested and sharp for Saturday.";
  if (week.refeed) return "Re-feed week — bump carbs, ease off the deficit. Recovery is the job.";
  if (week.kind === "peak") return "Strict phase — tighter deficit (~2000), clean & high protein. Leanness shows here.";
  if (week.kind === "bucks") return "Lock it in Mon–Thu before the weekend — protein + creatine on point.";
  if (week.num <= 2) return "Settle-in: ~2500 (maintenance). Nail protein, don't chase the deficit yet.";
  return "Modest deficit (~2100–2300). Consistent, not strict. Protein + creatine daily.";
}

function getDayPlan(dateStr) {
  const mon = mondayOf(dateStr);
  const week = weekByMon(mon);
  const d = fromStr(dateStr);
  const dow = d.getDay();
  const isBucksDay = dateStr === BUCKS_FRI || dateStr === BUCKS_SAT;

  if (!week) {
    if (dateStr < WARMUP_START) return { pre: true, week: null, dow, type: "off", title: "Not started", detail: "Program kicks off with warm-up week on Mon 20 Jul.", active: false, nut: "Log your baseline weigh-in below whenever you're ready." };
    return { post: true, week: null, dow, type: "off", title: "All done", detail: "You made it. Go enjoy the wedding.", active: false, nut: "" };
  }

  let type = "off";
  if (isBucksDay) type = "bucks";
  else if (week.kind === "weekoff") type = dow === 0 || dow === 6 ? "off" : "taper";
  else if (dow === 0) type = "off";
  else if (dow === 6) type = "cheat";
  else if (dow === 2) type = week.kind === "warmup" ? "pilates" : "pilates";
  else if (dow === 5) type = week.kind === "bucks" ? "off" : "outdoor";
  else {
    // Mon / Wed / Thu
    if (week.kind === "warmup") type = "light";
    else {
      const idx = ((week.num - 1) % 3 + 3) % 3;
      type = ROT[idx][dow];
    }
  }

  if (OVERRIDES[dateStr]) type = OVERRIDES[dateStr];
  const meta = SESS[type] || SESS.off;
  const active = ["run", "push", "beach", "pilates", "outdoor", "light", "race", "shakeout"].includes(type);
  return {
    week, dow, type,
    title: meta.title,
    icon: meta.icon,
    tint: meta.tint,
    detail: sessionDetail(type, week.kind),
    active,
    isBucksDay,
    nut: nutritionNote(week, dow, isBucksDay),
  };
}

/* ---------------------------------------------------------------- storage */
const DEFAULT_PROFILE = {
  name: "Harry",
  currentWeight: 95,
  goalWeight: 89,
  proteinPerKg: 1.8,
  creatine: 10,
  calBaseline: 2500,
  fivekBase: 27.5,
  pushupBase: 30,
};
// Load profile + all day logs from Supabase (via our API routes).
async function loadState() {
  try {
    const [pRes, lRes] = await Promise.all([
      fetch("/api/profile", { cache: "no-store" }),
      fetch("/api/log", { cache: "no-store" }),
    ]);
    const pJson = await pRes.json();
    const lJson = await lRes.json();
    return {
      profile: pJson.profile || DEFAULT_PROFILE,
      days: lJson.logs || {},
    };
  } catch (e) {
    console.error("load failed", e);
    return null;
  }
}
// Persist a single day's log (debounced by the caller).
async function persistDay(date, dayObj) {
  try {
    await fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ log_date: date, data: dayObj }),
    });
  } catch (e) { console.error("save day failed", e); }
}
// Persist the profile.
async function persistProfile(profileObj) {
  try {
    await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: profileObj }),
    });
  } catch (e) { console.error("save profile failed", e); }
}

/* ---------------------------------------------------------------- ui bits */
const Chip = ({ children, bg, fg }) => (
  <span style={{ background: bg, color: fg, fontFamily: mono, fontSize: 10, letterSpacing: 0.5, padding: "3px 8px", borderRadius: 999, textTransform: "uppercase", fontWeight: 700 }}>{children}</span>
);

function kindChip(week) {
  if (!week) return null;
  if (week.kind === "deload") return <Chip bg={C.berrySoft} fg={C.berry}>{week.recovery ? "Recovery + re-feed" : "Deload + re-feed"}</Chip>;
  if (week.kind === "bucks") return <Chip bg={C.berrySoft} fg={C.berry}>Bucks week</Chip>;
  if (week.kind === "peak") return <Chip bg={C.brassSoft} fg={C.brass}>Peak · strict</Chip>;
  if (week.kind === "warmup") return <Chip bg={C.greenSoft} fg={C.green}>Warm-up</Chip>;
  if (week.kind === "weekoff") return <Chip bg={C.greenSoft} fg={C.green}>Week off</Chip>;
  return <Chip bg={C.brassSoft} fg={C.brass}>Build</Chip>;
}

/* ---------------------------------------------------------------- app */
export default function App() {
  const todayStr = toStr(new Date());
  const [state, setState] = useState(null);
  const [tab, setTab] = useState("today");
  const [selDate, setSelDate] = useState(todayStr);
  const firstProgramMon = todayStr < WARMUP_START ? WARMUP_START : (weekByMon(mondayOf(todayStr)) ? mondayOf(todayStr) : WARMUP_START);
  const [weekAnchor, setWeekAnchor] = useState(firstProgramMon);

  const saveTimers = useRef({});
  useEffect(() => {
    (async () => {
      const loaded = await loadState();
      setState(loaded || { profile: DEFAULT_PROFILE, days: {} });
    })();
  }, []);
  // Debounced persistence helpers (avoid a write on every keystroke).
  const scheduleDaySave = (date, dayObj) => {
    clearTimeout(saveTimers.current["day:" + date]);
    saveTimers.current["day:" + date] = setTimeout(() => persistDay(date, dayObj), 500);
  };
  const scheduleProfileSave = (profileObj) => {
    clearTimeout(saveTimers.current["profile"]);
    saveTimers.current["profile"] = setTimeout(() => persistProfile(profileObj), 500);
  };

  if (!state) {
    return <div style={{ background: C.paper, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: sans, color: C.slate }}>Loading your program…</div>;
  }

  const P = state.profile;
  const proteinTarget = Math.round(P.currentWeight * P.proteinPerKg);
  const daysToWedding = Math.max(0, diffDays(todayStr, WEDDING));
  const toGo = Math.max(0, +(P.currentWeight - P.goalWeight).toFixed(1));

  const progressPct = (() => {
    if (todayStr <= PROGRAM_START) return 0;
    if (todayStr >= PROGRAM_END) return 100;
    return Math.round((diffDays(PROGRAM_START, todayStr) / diffDays(PROGRAM_START, PROGRAM_END)) * 100);
  })();
  const curWeek = weekByMon(mondayOf(todayStr));
  const phaseLabel = todayStr < WARMUP_START ? `Starts in ${diffDays(todayStr, WARMUP_START)} days`
    : curWeek ? (curWeek.num ? `${curWeek.block} · Week ${curWeek.num} of 16` : curWeek.block)
      : "Program complete";

  const setDay = (date, patch) => setState((s) => {
    const nextDay = { ...(s.days[date] || {}), ...patch };
    scheduleDaySave(date, nextDay);
    return { ...s, days: { ...s.days, [date]: nextDay } };
  });
  const setProfile = (patch) => setState((s) => {
    const nextProfile = { ...s.profile, ...patch };
    scheduleProfileSave(nextProfile);
    return { ...s, profile: nextProfile };
  });
  const resetAll = async () => {
    try {
      await fetch("/api/log", { method: "DELETE" });
      await persistProfile(DEFAULT_PROFILE);
    } catch (e) { console.error("reset failed", e); }
    setState({ profile: DEFAULT_PROFILE, days: {} });
  };

  return (
    <div style={{ background: C.paper, minHeight: "100vh", fontFamily: sans, color: C.ink }}>
      <style>{FONTS}</style>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 0 96px" }}>

        {/* header / countdown */}
        <header style={{ padding: "26px 20px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: 2, color: C.brass, textTransform: "uppercase" }}>The build to 21 Nov</div>
              <h1 style={{ fontFamily: serif, fontWeight: 600, fontSize: 26, lineHeight: 1.05, margin: "6px 0 0" }}>{P.name}'s wedding-prep tracker</h1>
            </div>
            <Sparkles size={22} color={C.brass} style={{ marginTop: 4, flexShrink: 0 }} />
          </div>

          <div style={{ display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
            <div style={{ background: C.ink, color: C.paper, borderRadius: 16, padding: "16px 20px", flex: "1 1 160px" }}>
              <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: 1.5, opacity: 0.6, textTransform: "uppercase" }}>Days to the wedding</div>
              <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 44, lineHeight: 1, marginTop: 4 }}>{daysToWedding}</div>
              <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>Sat 21 Nov 2026</div>
            </div>
            <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: "16px 20px", flex: "1 1 160px" }}>
              <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: 1.5, color: C.faint, textTransform: "uppercase" }}>Weight to goal</div>
              <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 44, lineHeight: 1, marginTop: 4, color: C.brass }}>{toGo}<span style={{ fontSize: 18 }}>kg</span></div>
              <div style={{ fontSize: 12, color: C.slate, marginTop: 4 }}>{P.currentWeight} → {P.goalWeight}kg target</div>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: C.slate, marginBottom: 6 }}>
              <span>{phaseLabel}</span><span>{progressPct}% through</span>
            </div>
            <div style={{ height: 6, background: C.line, borderRadius: 999, overflow: "hidden" }}>
              <div style={{ width: `${progressPct}%`, height: "100%", background: C.brass, borderRadius: 999 }} />
            </div>
          </div>
        </header>

        <main style={{ padding: "0 20px" }}>
          {tab === "today" && <TodayView todayStr={todayStr} selDate={selDate} setSelDate={setSelDate} state={state} setDay={setDay} proteinTarget={proteinTarget} P={P} />}
          {tab === "week" && <WeekView weekAnchor={weekAnchor} setWeekAnchor={setWeekAnchor} todayStr={todayStr} setSelDate={setSelDate} setTab={setTab} />}
          {tab === "progress" && <ProgressView state={state} P={P} todayStr={todayStr} proteinTarget={proteinTarget} />}
          {tab === "plan" && <PlanView todayStr={todayStr} />}
          {tab === "setup" && <SetupView P={P} setProfile={setProfile} proteinTarget={proteinTarget} resetAll={resetAll} />}
        </main>
      </div>

      {/* bottom nav */}
      <nav style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: C.card, borderTop: `1px solid ${C.line}`, display: "flex", justifyContent: "space-around", padding: "8px 0 10px" }}>
        {[
          ["today", "Today", Home],
          ["week", "Week", CalendarDays],
          ["progress", "Progress", TrendingUp],
          ["plan", "Plan", Flame],
          ["setup", "Setup", Settings],
        ].map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)} style={{ background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: tab === id ? C.ink : C.faint, padding: "2px 10px" }}>
            <Icon size={20} color={tab === id ? C.brass : C.faint} />
            <span style={{ fontSize: 10, fontWeight: tab === id ? 700 : 500 }}>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

/* ---------------------------------------------------------------- TODAY */
function TodayView({ todayStr, selDate, setSelDate, state, setDay, proteinTarget, P }) {
  const plan = getDayPlan(selDate);
  const rec = state.days[selDate] || {};
  const Icon = plan.icon || Moon;
  const isToday = selDate === todayStr;

  const Toggle = ({ label, field, hint }) => {
    const on = !!rec[field];
    return (
      <button onClick={() => setDay(selDate, { [field]: !on })} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: on ? C.greenSoft : C.card, border: `1px solid ${on ? C.green : C.line}`, borderRadius: 12, padding: "12px 14px", cursor: "pointer" }}>
        <span style={{ width: 22, height: 22, borderRadius: 6, background: on ? C.green : "transparent", border: `1.5px solid ${on ? C.green : C.faint}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{on && <Check size={15} color="#fff" />}</span>
        <span><div style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{label}</div>{hint && <div style={{ fontSize: 11.5, color: C.slate }}>{hint}</div>}</span>
      </button>
    );
  };
  const NumField = ({ label, field, unit, ph }) => (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "10px 14px" }}>
      <div style={{ fontSize: 11.5, color: C.slate, marginBottom: 2 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <input type="number" value={rec[field] ?? ""} placeholder={ph} onChange={(e) => setDay(selDate, { [field]: e.target.value === "" ? undefined : Number(e.target.value) })} style={{ width: "100%", border: "none", outline: "none", background: "transparent", fontFamily: mono, fontSize: 20, fontWeight: 700, color: C.ink }} />
        <span style={{ fontSize: 12, color: C.faint }}>{unit}</span>
      </div>
    </div>
  );

  return (
    <div>
      {/* date nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "4px 0 14px" }}>
        <button onClick={() => setSelDate(addDays(selDate, -1))} style={navBtn}><ChevronLeft size={18} /></button>
        <button onClick={() => setSelDate(todayStr)} style={{ background: "none", border: "none", cursor: "pointer", textAlign: "center" }}>
          <div style={{ fontFamily: serif, fontSize: 18, fontWeight: 600 }}>{isToday ? "Today" : pretty(selDate)}</div>
          <div style={{ fontSize: 11, color: C.faint }}>{isToday ? pretty(selDate) : "tap for today"}</div>
        </button>
        <button onClick={() => setSelDate(addDays(selDate, 1))} style={navBtn}><ChevronRight size={18} /></button>
      </div>

      {/* session card */}
      <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 18, padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          {kindChip(plan.week)}
          {plan.week && plan.week.num > 0 && <span style={{ fontFamily: mono, fontSize: 11, color: C.faint }}>Wk {plan.week.num}</span>}
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: C.paper, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon size={24} color={plan.tint} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: serif, fontSize: 21, fontWeight: 600, lineHeight: 1.1 }}>{plan.title}</div>
            <div style={{ fontSize: 13.5, color: C.slate, marginTop: 5, lineHeight: 1.5 }}>{plan.detail}</div>
          </div>
        </div>
        <div style={{ marginTop: 14, background: C.paper, borderRadius: 12, padding: "10px 14px", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <Flame size={16} color={C.berry} style={{ marginTop: 2, flexShrink: 0 }} />
          <div style={{ fontSize: 13, color: C.ink, lineHeight: 1.45 }}>{plan.nut}</div>
        </div>

        {plan.type === "beach" && (() => {
          const w = plan.week ? getWorkout(plan.week.num) : null;
          if (!w) return null;
          return (
            <div style={{ marginTop: 14 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <div style={{ fontFamily: serif, fontSize: 15, fontWeight: 600 }}>Today's workout</div>
                <span style={{ fontFamily: mono, fontSize: 10.5, color: C.faint }}>{w.title}</span>
              </div>
              {w.warmup && <div style={{ fontSize: 11.5, color: C.slate, marginBottom: 8, lineHeight: 1.4 }}><b style={{ color: C.ink }}>Warm-up:</b> {w.warmup}</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {w.exercises.map((e, i) => (
                  <div key={i} style={{ background: C.paper, borderRadius: 10, padding: "9px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: C.ink }}>{e.name}</span>
                      <span style={{ fontFamily: mono, fontSize: 12.5, color: C.brass, fontWeight: 700, whiteSpace: "nowrap" }}>{e.sets} × {e.reps}</span>
                    </div>
                    <div style={{ fontSize: 11.5, color: C.slate, marginTop: 2 }}>RPE {e.rpe} · rest {e.rest}{e.note ? ` · ${e.note}` : ""}</div>
                  </div>
                ))}
              </div>
              {w.note && <div style={{ fontSize: 11.5, color: C.faint, marginTop: 8, lineHeight: 1.4 }}>{w.note}</div>}
            </div>
          );
        })()}
      </div>

      {/* daily log */}
      <div style={{ marginTop: 18 }}>
        <SectionLabel>Daily log</SectionLabel>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {plan.active && <Toggle label="Workout done" field="done" hint={plan.title} />}
          {plan.active && plan.type !== "pilates" && plan.type !== "light" && <Toggle label="Protein hit" field="protein" hint={`Target ${proteinTarget}g (${P.proteinPerKg}g/kg)`} />}
          <Toggle label="Creatine taken" field="creatine" hint={`${P.creatine}g daily`} />
          {plan.active && plan.type !== "pilates" && plan.type !== "light" && <Toggle label="Macros logged" field="macros" hint="Protein / carbs / fat" />}
        </div>

        {(() => {
          const showPush = plan.type === "push";
          const showRun = ["run", "outdoor", "race", "shakeout"].includes(plan.type);
          if (showPush || showRun || plan.pre) {
            return (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
                {showPush && <NumField label="Best push-up set" field="pushups" unit="reps" ph={String(P.pushupBase)} />}
                {showRun && <NumField label={plan.type === "race" ? "Race time" : "5K time"} field="runMin" unit="min" ph={String(P.fivekBase)} />}
                <NumField label="Weigh-in" field="weight" unit="kg" ph={String(P.currentWeight)} />
              </div>
            );
          }
          return <div style={{ marginTop: 8 }}><NumField label="Weigh-in (optional)" field="weight" unit="kg" ph={String(P.currentWeight)} /></div>;
        })()}

        <StepRow selDate={selDate} rec={rec} setDay={setDay} />

        <div style={{ marginTop: 8 }}>
          <textarea value={rec.notes ?? ""} onChange={(e) => setDay(selDate, { notes: e.target.value })} placeholder="Notes — how it felt, what you ate, energy…" style={{ width: "100%", minHeight: 60, resize: "vertical", border: `1px solid ${C.line}`, borderRadius: 12, padding: "10px 14px", fontFamily: sans, fontSize: 13.5, color: C.ink, background: C.card, outline: "none", boxSizing: "border-box" }} />
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- WEEK */
function WeekView({ weekAnchor, setWeekAnchor, todayStr, setSelDate, setTab }) {
  const week = weekByMon(weekAnchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekAnchor, i));
  const canPrev = weekAnchor > WARMUP_START;
  const canNext = weekAnchor < WEEKOFF_START;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "4px 0 12px" }}>
        <button disabled={!canPrev} onClick={() => setWeekAnchor(addDays(weekAnchor, -7))} style={{ ...navBtn, opacity: canPrev ? 1 : 0.3 }}><ChevronLeft size={18} /></button>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: serif, fontSize: 18, fontWeight: 600 }}>{week ? week.block : "—"}</div>
          <div style={{ fontSize: 12, color: C.faint }}>{prettyShort(weekAnchor)} – {prettyShort(addDays(weekAnchor, 6))}{week && week.num > 0 ? ` · Week ${week.num}` : ""}</div>
        </div>
        <button disabled={!canNext} onClick={() => setWeekAnchor(addDays(weekAnchor, 7))} style={{ ...navBtn, opacity: canNext ? 1 : 0.3 }}><ChevronRight size={18} /></button>
      </div>

      {week && (week.refeed || week.kind === "bucks" || week.kind === "weekoff") && (
        <div style={{ background: week.kind === "weekoff" ? C.greenSoft : C.berrySoft, borderRadius: 12, padding: "10px 14px", marginBottom: 12, fontSize: 13, color: week.kind === "weekoff" ? C.green : C.berry, fontWeight: 500 }}>
          {week.kind === "weekoff" ? "Full week off before the wedding — taper, rest, look sharp." : week.kind === "bucks" ? "Bucks weekend (Fri 9 / Sat 10). Train Mon–Thu, then send it." : week.recovery ? "Recovery & re-feed week — the reset after the bucks." : "Deload & re-feed week — pull back, bump the carbs, recover."}
        </div>
      )}

      {(() => { const sg = stepGoal(addDays(weekAnchor, 3)); if (!sg) return null; const big = sg === 10000; return (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, background: big ? C.berrySoft : C.paper, border: `1px solid ${big ? "transparent" : C.line}`, borderRadius: 12, padding: "9px 14px", fontSize: 12.5, color: big ? C.berry : C.slate, fontWeight: 500 }}>
          <Activity size={15} /> <span>Daily step goal: <b>{sg.toLocaleString()}</b>{big ? " — Steptember 🚶" : ""}</span>
        </div>
      ); })()}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {days.map((dstr) => {
          const p = getDayPlan(dstr);
          const Icon = p.icon || Moon;
          const isToday = dstr === todayStr;
          return (
            <button key={dstr} onClick={() => { setSelDate(dstr); setTab("today"); }} style={{ display: "flex", alignItems: "center", gap: 12, background: C.card, border: `1px solid ${isToday ? C.brass : C.line}`, borderRadius: 12, padding: "11px 14px", cursor: "pointer", textAlign: "left" }}>
              <div style={{ width: 40, flexShrink: 0, textAlign: "center" }}>
                <div style={{ fontFamily: mono, fontSize: 11, color: C.faint }}>{DOW[fromStr(dstr).getDay()]}</div>
                <div style={{ fontFamily: mono, fontSize: 17, fontWeight: 700 }}>{fromStr(dstr).getDate()}</div>
              </div>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: C.paper, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon size={18} color={p.tint} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600 }}>{p.title}</div>
                <div style={{ fontSize: 11.5, color: C.slate }}>{p.active ? "Session" : p.type === "cheat" ? "Cheat day" : p.type === "bucks" ? "Bucks" : "Rest"}</div>
              </div>
              {isToday && <Chip bg={C.brassSoft} fg={C.brass}>Today</Chip>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- PROGRESS */
function ProgressView({ state, P, todayStr, proteinTarget }) {
  const days = state.days;
  const entries = Object.keys(days).sort();

  const series = (field) => entries.filter((d) => days[d][field] != null && days[d][field] !== "").map((d) => ({ date: prettyShort(d), v: Number(days[d][field]) }));
  const weight = series("weight");
  const fivek = series("runMin");
  const push = series("pushups");

  const bestPush = push.length ? Math.max(...push.map((x) => x.v)) : P.pushupBase;
  const bestRun = fivek.length ? Math.min(...fivek.map((x) => x.v)) : P.fivekBase;
  const latestW = weight.length ? weight[weight.length - 1].v : P.currentWeight;

  // adherence over active days up to today
  let aDays = 0, prot = 0, crea = 0, work = 0, stepDays = 0, stepHit = 0;
  entries.forEach((d) => {
    if (d > todayStr) return;
    const p = getDayPlan(d);
    if (p.active) { aDays++; if (days[d].protein) prot++; if (days[d].done) work++; }
    if (days[d].creatine) crea++;
    const sg = stepGoal(d);
    if (sg > 0) { stepDays++; if (Number(days[d].steps) >= sg) stepHit++; }
  });
  const pct = (n, dd) => (dd ? Math.round((n / dd) * 100) : 0);

  const Stat = ({ label, val, unit, tint }) => (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "14px 16px", flex: "1 1 90px" }}>
      <div style={{ fontSize: 11, color: C.slate, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: mono, fontWeight: 700, fontSize: 24, color: tint || C.ink }}>{val}<span style={{ fontSize: 12, color: C.faint }}> {unit}</span></div>
    </div>
  );

  const Chart = ({ title, data, unit, tint, goal, invert }) => (
    <div style={{ marginTop: 18 }}>
      <SectionLabel>{title}</SectionLabel>
      {data.length < 2 ? (
        <div style={{ background: C.card, border: `1px dashed ${C.line}`, borderRadius: 14, padding: "26px 16px", textAlign: "center", color: C.faint, fontSize: 13 }}>
          Log at least two entries to see the trend.
        </div>
      ) : (
        <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "14px 8px 8px", height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 6, right: 12, left: -12, bottom: 4 }}>
              <CartesianGrid stroke={C.line} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: C.faint, fontFamily: mono }} tickLine={false} axisLine={{ stroke: C.line }} />
              <YAxis domain={invert ? ["auto", "auto"] : ["auto", "auto"]} tick={{ fontSize: 10, fill: C.faint, fontFamily: mono }} tickLine={false} axisLine={false} width={38} />
              <Tooltip contentStyle={{ fontFamily: mono, fontSize: 12, borderRadius: 8, border: `1px solid ${C.line}` }} formatter={(v) => [`${v} ${unit}`, ""]} />
              {goal != null && <ReferenceLine y={goal} stroke={C.green} strokeDasharray="4 4" label={{ value: `goal ${goal}`, fontSize: 10, fill: C.green, position: "insideTopRight" }} />}
              <Line type="monotone" dataKey="v" stroke={tint} strokeWidth={2.5} dot={{ r: 3, fill: tint }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );

  return (
    <div>
      <SectionLabel>Where you're at</SectionLabel>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Stat label="Weight" val={latestW} unit="kg" tint={C.brass} />
        <Stat label="Best 5K" val={bestRun} unit="min" tint={C.green} />
        <Stat label="Best push set" val={bestPush} unit="reps" tint={C.green} />
      </div>

      <SectionLabel style={{ marginTop: 20 }}>Adherence so far</SectionLabel>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <Stat label="Workouts done" val={pct(work, aDays)} unit="%" />
        <Stat label="Protein hit" val={pct(prot, aDays)} unit="%" />
        <Stat label="Step goal hit" val={pct(stepHit, stepDays)} unit="%" />
        <Stat label="Creatine days" val={crea} unit="days" />
      </div>

      <Chart title="Weight" data={weight} unit="kg" tint={C.brass} goal={P.goalWeight} />
      <Chart title="5K time (lower is better)" data={fivek} unit="min" tint={C.green} invert />
      <Chart title="Push-ups — best set" data={push} unit="reps" tint={C.green} goal={100} />
      <Chart title="Daily steps" data={series("steps")} unit="steps" tint={C.berry} />
    </div>
  );
}

/* ---------------------------------------------------------------- PLAN */
function PlanView({ todayStr }) {
  const blocks = [];
  let cur = null;
  WEEKS.forEach((w) => {
    if (!cur || cur.name !== w.block) { cur = { name: w.block, weeks: [] }; blocks.push(cur); }
    cur.weeks.push(w);
  });
  const curMon = mondayOf(todayStr);

  const dot = (w) => w.kind === "deload" || w.kind === "bucks" ? C.berry : w.kind === "peak" ? C.brass : w.kind === "weekoff" ? C.green : w.kind === "warmup" ? C.green : C.brass;

  return (
    <div>
      <div style={{ background: C.ink, color: C.paper, borderRadius: 16, padding: "16px 18px", marginBottom: 16 }}>
        <div style={{ fontFamily: serif, fontSize: 18, fontWeight: 600 }}>The 16-week build</div>
        <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4, lineHeight: 1.5 }}>Warm-up 20 Jul · program 27 Jul → Fri 13 Nov · full week off · wedding 21 Nov. Four blocks, each landing on a deload + re-feed week. Steptember brings 10k steps/day in September; 5k/day through Aug, Oct & 1–13 Nov; JPM Corporate Challenge fun run Wed 21 Oct.</div>
      </div>

      {blocks.map((b) => (
        <div key={b.name} style={{ marginBottom: 18 }}>
          <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: 1, color: C.brass, textTransform: "uppercase", marginBottom: 8 }}>{b.name}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {b.weeks.map((w) => {
              const isNow = w.mon === curMon;
              const tag = w.kind === "deload" ? (w.recovery ? "Recovery + re-feed" : "Deload + re-feed") : w.kind === "bucks" ? "Bucks weekend" : w.kind === "peak" ? (w.num === 13 ? "Peak · JPM run Wed 21" : "Peak · strict diet") : w.kind === "warmup" ? "Ease back in" : w.kind === "weekoff" ? "Full week off" : w.num <= 2 ? "Settle-in · maintenance" : "Build · modest deficit";
              const sg = stepGoal(addDays(w.mon, 3));
              return (
                <div key={w.mon} style={{ display: "flex", alignItems: "center", gap: 12, background: isNow ? C.brassSoft : C.card, border: `1px solid ${isNow ? C.brass : C.line}`, borderRadius: 11, padding: "10px 14px" }}>
                  <span style={{ width: 9, height: 9, borderRadius: 999, background: dot(w), flexShrink: 0 }} />
                  <div style={{ width: 58, flexShrink: 0 }}>
                    <div style={{ fontFamily: mono, fontSize: 12, fontWeight: 700 }}>{w.num ? `Wk ${w.num}` : "—"}</div>
                    <div style={{ fontSize: 10.5, color: C.faint }}>{prettyShort(w.mon)}</div>
                  </div>
                  <div style={{ flex: 1, fontSize: 13, color: C.ink }}>{tag}</div>
                  {sg > 0 && <Chip bg={sg === 10000 ? C.berrySoft : C.paper} fg={sg === 10000 ? C.berry : C.slate}>{sg / 1000}k steps</Chip>}
                  {isNow && <Chip bg={C.brass} fg="#fff">Now</Chip>}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div style={{ display: "flex", alignItems: "center", gap: 12, background: C.greenSoft, borderRadius: 12, padding: "14px 16px" }}>
        <Sparkles size={20} color={C.green} />
        <div><div style={{ fontFamily: serif, fontSize: 16, fontWeight: 600, color: C.green }}>Wedding day</div><div style={{ fontSize: 12, color: C.slate }}>Sat 21 Nov — lean, rested, ready.</div></div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- SETUP */
function SetupView({ P, setProfile, proteinTarget, resetAll }) {
  const Field = ({ label, field, unit, step }) => (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "11px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 13.5, color: C.ink }}>{label}</span>
      <span style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
        <input type="number" step={step || 1} value={P[field]} onChange={(e) => setProfile({ [field]: e.target.value === "" ? 0 : Number(e.target.value) })} style={{ width: 64, textAlign: "right", border: "none", outline: "none", background: "transparent", fontFamily: mono, fontSize: 17, fontWeight: 700, color: C.brass }} />
        <span style={{ fontSize: 12, color: C.faint, width: 30 }}>{unit}</span>
      </span>
    </div>
  );

  return (
    <div>
      <div style={{ background: C.brassSoft, borderRadius: 12, padding: "12px 14px", marginBottom: 16, fontSize: 13, color: C.brass, lineHeight: 1.5 }}>
        These are placeholder baselines. After your weigh-in, drop in the real numbers — protein target and progress goals update automatically.
      </div>

      <SectionLabel>Baselines</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Field label="Current weight" field="currentWeight" unit="kg" step={0.1} />
        <Field label="Goal weight" field="goalWeight" unit="kg" step={0.1} />
        <Field label="Baseline 5K" field="fivekBase" unit="min" step={0.1} />
        <Field label="Baseline push-ups" field="pushupBase" unit="reps" />
      </div>

      <SectionLabel style={{ marginTop: 20 }}>Daily targets</SectionLabel>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Field label="Protein per kg (active days)" field="proteinPerKg" unit="g/kg" step={0.1} />
        <Field label="Creatine" field="creatine" unit="g" />
        <Field label="Maintenance calories" field="calBaseline" unit="cal" step={50} />
      </div>
      <div style={{ marginTop: 10, background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 14px", fontSize: 13, color: C.slate }}>
        Protein target on active days: <b style={{ color: C.brass, fontFamily: mono }}>{proteinTarget}g</b> ({P.proteinPerKg}g/kg × {P.currentWeight}kg)
      </div>

      <button
        onClick={() => { if (confirm("Clear all logged data and reset to placeholder baselines? This can't be undone.")) resetAll(); }}
        style={{ marginTop: 22, width: "100%", background: "none", border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px", color: C.berry, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
        Reset all data
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- shared */
const navBtn = { background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.ink };

function StepRow({ selDate, rec, setDay }) {
  const goal = stepGoal(selDate);
  const val = rec.steps;
  const hit = goal > 0 && Number(val) >= goal;
  const pct = goal > 0 && val ? Math.min(100, Math.round((Number(val) / goal) * 100)) : 0;
  const big = goal === 10000;
  return (
    <div style={{ marginTop: 8, background: hit ? C.greenSoft : C.card, border: `1px solid ${hit ? C.green : C.line}`, borderRadius: 12, padding: "11px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 13.5, color: C.ink }}>Steps {goal > 0 && <span style={{ color: big ? C.berry : C.faint, fontSize: 11.5, fontWeight: 600 }}>· goal {goal.toLocaleString()}{big ? " · Steptember" : ""}</span>}</div>
        <span style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
          <input type="number" value={val ?? ""} placeholder="0" onChange={(e) => setDay(selDate, { steps: e.target.value === "" ? undefined : Number(e.target.value) })} style={{ width: 78, textAlign: "right", border: "none", outline: "none", background: "transparent", fontFamily: mono, fontSize: 18, fontWeight: 700, color: hit ? C.green : C.ink }} />
          {hit && <Check size={16} color={C.green} />}
        </span>
      </div>
      {goal > 0 && (
        <div style={{ height: 5, background: C.line, borderRadius: 999, overflow: "hidden", marginTop: 8 }}>
          <div style={{ width: `${pct}%`, height: "100%", background: big ? C.berry : C.green, borderRadius: 999 }} />
        </div>
      )}
    </div>
  );
}
function SectionLabel({ children, style }) {
  return <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: 1, color: C.faint, textTransform: "uppercase", margin: "0 0 10px", ...style }}>{children}</div>;
}
