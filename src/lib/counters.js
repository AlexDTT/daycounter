import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "counters";

function pad2(n) {
  return String(n).padStart(2, "0");
}

export function toDateKey(date) {
  const yyyy = date.getFullYear();
  const mm = pad2(date.getMonth() + 1);
  const dd = pad2(date.getDate());
  return `${yyyy}-${mm}-${dd}`;
}

export function todayKey() {
  return toDateKey(new Date());
}

export function addDaysKey(dateKey, deltaDays) {
  const [y, m, d] = dateKey.split("-").map((v) => Number(v));
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return toDateKey(dt);
}

function normalizeHistory(history) {
  if (!Array.isArray(history)) return [];

  // migrate old ISO timestamps -> date keys
  const keys = history.map((v) => {
    if (typeof v !== "string") return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const parsed = new Date(v);
    if (Number.isNaN(parsed.getTime())) return null;
    return toDateKey(parsed);
  });

  // dedupe + sort ascending
  return Array.from(new Set(keys.filter(Boolean))).sort();
}

export function computeCurrentStreak(history, now = new Date()) {
  const keys = normalizeHistory(history);
  if (keys.length === 0) return 0;

  const today = toDateKey(now);
  const yesterday = toDateKey(
    new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1),
  );
  const last = keys[keys.length - 1];

  if (last !== today && last !== yesterday) return 0;

  let streak = 1;
  let cursor = last;
  const set = new Set(keys);
  while (set.has(addDaysKey(cursor, -1))) {
    cursor = addDaysKey(cursor, -1);
    streak += 1;
  }
  return streak;
}

export function computeLongestStreak(history) {
  const keys = normalizeHistory(history);
  if (keys.length === 0) return 0;

  let longest = 1;
  let current = 1;
  for (let i = 1; i < keys.length; i += 1) {
    const prev = keys[i - 1];
    const cur = keys[i];
    if (cur === addDaysKey(prev, 1)) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }
  return longest;
}

export function hydrateCounter(counter) {
  const history = normalizeHistory(counter?.history);
  const streak = computeCurrentStreak(history);
  const longestStreak = Math.max(
    counter?.longestStreak || 0,
    computeLongestStreak(history),
  );
  const totalDays = history.length;

  const reminderHourRaw = Number(counter?.reminderHour);
  const reminderMinuteRaw = Number(counter?.reminderMinute);
  const reminderHour =
    Number.isFinite(reminderHourRaw) &&
    reminderHourRaw >= 0 &&
    reminderHourRaw <= 23
      ? Math.floor(reminderHourRaw)
      : 20;
  const reminderMinute =
    Number.isFinite(reminderMinuteRaw) &&
    reminderMinuteRaw >= 0 &&
    reminderMinuteRaw <= 59
      ? Math.floor(reminderMinuteRaw)
      : 0;

  return {
    id: String(counter?.id ?? Date.now()),
    title: String(counter?.title ?? "Untitled"),
    goal:
      counter?.goal == null || counter?.goal === ""
        ? null
        : Number(counter.goal),
    createdAt:
      counter?.createdAt || counter?.startDate || new Date().toISOString(),
    archived: Boolean(counter?.archived),
    reminderEnabled: Boolean(counter?.reminderEnabled),
    reminderHour,
    reminderMinute,
    history,
    streak,
    longestStreak,
    totalDays,
  };
}

export async function loadCounters() {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];

  const hydrated = parsed.map(hydrateCounter);

  // Persist migration/derived fields once to keep the store tidy.
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(hydrated));
  return hydrated;
}

export async function saveCounters(counters) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(counters));
}

export function createCounter({ title, goal }) {
  return hydrateCounter({
    id: Date.now().toString(),
    title,
    goal: goal ? Number(goal) : null,
    createdAt: new Date().toISOString(),
    reminderEnabled: false,
    reminderHour: 20,
    reminderMinute: 0,
    history: [],
  });
}

export function canMarkToday(counter, now = new Date()) {
  const history = normalizeHistory(counter?.history);
  return !history.includes(toDateKey(now));
}

export function markTodayComplete(counter, now = new Date()) {
  const base = hydrateCounter(counter);
  const key = toDateKey(now);
  if (base.history.includes(key)) return base;

  const updated = hydrateCounter({
    ...base,
    history: [...base.history, key],
  });

  return updated;
}

export function setDateCompleted(counter, dateKey, completed) {
  const base = hydrateCounter(counter);
  const key = String(dateKey);
  const normalized = normalizeHistory([...base.history, key]);

  const nextHistory = completed
    ? normalized
    : base.history.filter((k) => k !== key);

  return hydrateCounter({
    ...base,
    history: nextHistory,
  });
}

export function toggleDateCompleted(counter, dateKey) {
  const base = hydrateCounter(counter);
  const key = String(dateKey);
  const has = base.history.includes(key);
  return setDateCompleted(base, key, !has);
}

export function formatDateShort(isoOrDateKey) {
  if (!isoOrDateKey) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrDateKey)) {
    const [y, m, d] = isoOrDateKey.split("-");
    return `${m}/${d}/${y}`;
  }
  const dt = new Date(isoOrDateKey);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toLocaleDateString();
}

export function getStreakStatus(counter, now = new Date()) {
  const hydrated = hydrateCounter(counter);
  const doneToday = !canMarkToday(hydrated, now);
  const streak = hydrated.streak || 0;

  if (doneToday) {
    return {
      variant: "safe",
      title: "Streak safe",
      subtitle: "Done for today — come back tomorrow",
      doneToday,
      streak,
    };
  }

  if (streak > 0) {
    return {
      variant: "risk",
      title: "Streak at risk",
      subtitle: "Complete today to keep it alive",
      doneToday,
      streak,
    };
  }

  return {
    variant: "start",
    title: "Start a streak",
    subtitle: "Complete today to begin",
    doneToday,
    streak,
  };
}
