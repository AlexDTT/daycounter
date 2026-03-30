import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Animated,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import {
  canMarkToday,
  formatDateShort,
  getStreakStatus,
  loadCounters,
  markTodayComplete,
  setDateCompleted,
  saveCounters,
  todayKey,
  toDateKey,
} from "../lib/counters";
import { disableHabitReminder, enableHabitReminder } from "../lib/reminders";

function startOfMonth(dt) {
  return new Date(dt.getFullYear(), dt.getMonth(), 1);
}

function isFutureDateKey(dateKey) {
  const [y, m, d] = String(dateKey)
    .split("-")
    .map((v) => Number(v));
  const a = new Date(y, m - 1, d);
  const now = new Date();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return a.getTime() > b.getTime();
}

function formatMonthTitle(dt) {
  return dt.toLocaleString(undefined, { month: "long", year: "numeric" });
}

function buildMonthGrid(monthStart) {
  const first = startOfMonth(monthStart);
  const year = first.getFullYear();
  const month = first.getMonth();
  const firstDow = first.getDay(); // 0..6, Sunday..Saturday

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  const totalCells = 42;

  for (let i = 0; i < totalCells; i += 1) {
    const dayNum = i - firstDow + 1;
    if (dayNum < 1 || dayNum > daysInMonth) {
      cells.push({ key: `empty-${i}`, empty: true });
      continue;
    }

    const dt = new Date(year, month, dayNum);
    const key = toDateKey(dt);
    cells.push({ key, empty: false, day: dayNum, dateKey: key });
  }

  return cells;
}

export default function DetailScreen() {
  const [counter, setCounter] = useState(null);
  const [allCounters, setAllCounters] = useState([]);
  const [toast, setToast] = useState(null);
  const toastAnim = React.useRef(new Animated.Value(0)).current;
  const [monthCursor, setMonthCursor] = useState(startOfMonth(new Date()));
  const [reminderTimeOpen, setReminderTimeOpen] = useState(false);
  const [reminderHourDraft, setReminderHourDraft] = useState("20");
  const [reminderMinuteDraft, setReminderMinuteDraft] = useState("00");
  const route = useRoute();
  const navigation = useNavigation();

  useEffect(() => {
    refresh();
  }, [route.params.id]);

  useEffect(() => {
    // Reset calendar to current month when switching counters.
    setMonthCursor(startOfMonth(new Date()));
  }, [route.params.id]);

  useEffect(() => {
    if (!counter) return;
    const hh = String(counter.reminderHour ?? 20);
    const mm = String(counter.reminderMinute ?? 0).padStart(2, "0");
    setReminderHourDraft(hh);
    setReminderMinuteDraft(mm);
  }, [counter?.id]);

  const refresh = async () => {
    try {
      const loaded = await loadCounters();
      setAllCounters(loaded);
      const found = loaded.find((c) => c.id === route.params.id) || null;
      setCounter(found);
    } catch (e) {
      console.error(e);
    }
  };

  const showToast = (nextToast) => {
    setToast(nextToast);
    toastAnim.stopAnimation();
    toastAnim.setValue(0);
    Animated.sequence([
      Animated.timing(toastAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.delay(1400),
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setToast(null);
    });
  };

  const markComplete = async () => {
    if (!counter) return;

    if (!canMarkToday(counter)) {
      Alert.alert("Already done", "You can only mark once per day.");
      return;
    }

    const before = counter;
    const updated = markTodayComplete(counter);
    const nextAll = allCounters.map((c) => (c.id === updated.id ? updated : c));

    setAllCounters(nextAll);
    setCounter(updated);
    await saveCounters(nextAll);

    const delta = (updated.streak || 0) - (before.streak || 0);
    const status = getStreakStatus(updated);
    showToast({
      title:
        delta <= 0
          ? "🔥 Streak saved"
          : updated.streak === 1 && (before.streak || 0) === 0
            ? "🔥 Streak started"
            : "🔥 Streak +1",
      subtitle: `${status.streak}-day streak`,
    });
  };

  const deleteCounter = () => {
    if (!counter) return;
    const counterId = counter.id;
    const counterTitle = counter.title;

    if (Platform.OS === "web") {
      const confirmed = globalThis?.confirm
        ? globalThis.confirm(`Delete “${counterTitle}”?`)
        : false;
      if (!confirmed) return;

      void (async () => {
        try {
          const loaded = await loadCounters();
          const nextAll = loaded.filter((c) => c.id !== counterId);
          setAllCounters(nextAll);
          setCounter(null);
          await disableHabitReminder(counterId);
          await saveCounters(nextAll);
          navigation.goBack();
        } catch (e) {
          console.error(e);
        }
      })();
      return;
    }

    Alert.alert("Delete", `Delete “${counterTitle}”?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        onPress: () => {
          void (async () => {
            try {
              const loaded = await loadCounters();
              const nextAll = loaded.filter((c) => c.id !== counterId);
              setAllCounters(nextAll);
              setCounter(null);
              await disableHabitReminder(counterId);
              await saveCounters(nextAll);
              navigation.goBack();
            } catch (e) {
              console.error(e);
            }
          })();
        },
        style: "destructive",
      },
    ]);
  };

  const done = counter ? !canMarkToday(counter) : false;
  const status = counter ? getStreakStatus(counter) : null;

  const monthCells = useMemo(() => {
    return buildMonthGrid(monthCursor);
  }, [monthCursor]);

  const badges = useMemo(() => {
    if (!counter) return [];
    const milestones = [7, 30, 100];
    return milestones.map((n) => ({
      n,
      earned: (counter.longestStreak || 0) >= n,
    }));
  }, [counter]);

  if (!counter) {
    return <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-950" />;
  }

  const formatTime = (hour, minute) => {
    const hh = String(hour ?? 20).padStart(2, "0");
    const mm = String(minute ?? 0).padStart(2, "0");
    return `${hh}:${mm}`;
  };

  const goalPct = counter.goal
    ? Math.min(1, (counter.streak || 0) / counter.goal)
    : 0;

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-950">
      <Modal visible={reminderTimeOpen} transparent animationType="slide">
        <Pressable
          className="flex-1 bg-black/50 px-5"
          onPress={() => setReminderTimeOpen(false)}
        >
          <Pressable
            className="mt-auto rounded-3xl bg-white p-5 dark:bg-slate-900"
            onPress={() => {}}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-bold text-slate-900 dark:text-slate-100">
                Reminder time
              </Text>
              <Pressable
                onPress={() => setReminderTimeOpen(false)}
                hitSlop={10}
              >
                <Text className="text-base font-semibold text-slate-500">
                  ✕
                </Text>
              </Pressable>
            </View>

            <Text className="mt-4 text-xs font-medium text-slate-500 dark:text-slate-400">
              Time (24h)
            </Text>

            <View className="mt-2 flex-row items-center">
              <TextInput
                value={reminderHourDraft}
                onChangeText={setReminderHourDraft}
                placeholder="20"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                className="w-20 rounded-2xl bg-slate-100 px-4 py-3 text-center text-slate-900 dark:bg-slate-800 dark:text-slate-100"
              />
              <Text className="mx-2 text-lg font-bold text-slate-500">:</Text>
              <TextInput
                value={reminderMinuteDraft}
                onChangeText={setReminderMinuteDraft}
                placeholder="00"
                placeholderTextColor="#94a3b8"
                keyboardType="numeric"
                className="w-20 rounded-2xl bg-slate-100 px-4 py-3 text-center text-slate-900 dark:bg-slate-800 dark:text-slate-100"
              />
            </View>

            <Pressable
              onPress={async () => {
                const hour = Number(reminderHourDraft);
                const minute = Number(reminderMinuteDraft);
                if (
                  !Number.isFinite(hour) ||
                  !Number.isFinite(minute) ||
                  hour < 0 ||
                  hour > 23 ||
                  minute < 0 ||
                  minute > 59
                ) {
                  Alert.alert(
                    "Invalid time",
                    "Use a 24h time like 20:00 (hour 0–23, minute 0–59).",
                  );
                  return;
                }

                const next = {
                  ...counter,
                  reminderHour: Math.floor(hour),
                  reminderMinute: Math.floor(minute),
                };
                const nextAll = allCounters.map((c) =>
                  c.id === next.id ? next : c,
                );

                setAllCounters(nextAll);
                setCounter(next);
                await saveCounters(nextAll);
                setReminderTimeOpen(false);

                if (next.reminderEnabled) {
                  const result = await enableHabitReminder(counter.id, {
                    title: counter.title,
                    hour: next.reminderHour,
                    minute: next.reminderMinute,
                  });
                  if (!result.ok) {
                    Alert.alert(
                      "Reminders unavailable",
                      result.reason === "web"
                        ? "Reminders don’t work on web. Try on a device via Expo Go."
                        : "Please allow notifications to enable reminders.",
                    );
                  }
                }
              }}
              className="mt-5 items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 dark:bg-slate-100"
            >
              <Text className="text-sm font-semibold text-white dark:text-slate-900">
                Save
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {toast ? (
        <Animated.View
          pointerEvents="none"
          style={{
            opacity: toastAnim,
            transform: [
              {
                translateY: toastAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-12, 0],
                }),
              },
            ],
          }}
          className="absolute left-0 right-0 top-2 z-50 px-5"
        >
          <View className="rounded-2xl bg-slate-900 px-4 py-3 dark:bg-slate-100">
            <Text className="text-sm font-semibold text-white dark:text-slate-900">
              {toast.title}
            </Text>
            {toast.subtitle ? (
              <Text className="mt-1 text-xs text-slate-200 dark:text-slate-700">
                {toast.subtitle}
              </Text>
            ) : null}
          </View>
        </Animated.View>
      ) : null}

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 28,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => navigation.goBack()}
            className="rounded-full bg-slate-100 px-3 py-2 dark:bg-slate-900"
          >
            <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              Back
            </Text>
          </Pressable>

          <Pressable
            onPress={deleteCounter}
            hitSlop={10}
            className="rounded-full bg-red-50 px-3 py-2 dark:bg-red-950/40"
          >
            <Text className="text-xs font-semibold text-red-600">Delete</Text>
          </Pressable>
        </View>

        <Text className="mt-5 text-2xl font-bold text-slate-900 dark:text-slate-100">
          {counter.title}
        </Text>
        <Text className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Started {formatDateShort(counter.createdAt)}
        </Text>

        {status ? (
          <View
            className={`mt-3 rounded-2xl px-4 py-3 ${
              status.variant === "risk"
                ? "bg-orange-100 dark:bg-orange-950/40"
                : "bg-slate-100 dark:bg-slate-900"
            }`}
          >
            <Text
              className={`text-sm font-semibold ${
                status.variant === "risk"
                  ? "text-orange-800 dark:text-orange-200"
                  : "text-slate-900 dark:text-slate-100"
              }`}
            >
              {status.variant === "risk" ? "⚠︎ " : ""}
              {status.title}
            </Text>
            <Text
              className={`mt-1 text-xs ${
                status.variant === "risk"
                  ? "text-orange-700 dark:text-orange-300"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              {status.subtitle}
            </Text>
          </View>
        ) : null}

        <View className="mt-5 flex-row justify-between rounded-3xl bg-white/90 p-4 dark:bg-slate-900">
          <View className="items-center">
            <Text className="text-xl font-bold text-orange-500">
              🔥 {counter.streak}
            </Text>
            <Text className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              current
            </Text>
          </View>
          <View className="items-center">
            <Text className="text-xl font-bold text-slate-900 dark:text-slate-100">
              🏆 {counter.longestStreak}
            </Text>
            <Text className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              best
            </Text>
          </View>
          <View className="items-center">
            <Text className="text-xl font-bold text-slate-900 dark:text-slate-100">
              📅 {counter.totalDays}
            </Text>
            <Text className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              total
            </Text>
          </View>
        </View>

        {counter.goal ? (
          <View className="mt-4 rounded-3xl bg-white/90 p-4 dark:bg-slate-900">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Goal: {counter.goal} days
              </Text>
              <Text className="text-xs text-slate-500 dark:text-slate-400">
                {Math.round(goalPct * 100)}%
              </Text>
            </View>
            <View className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <View
                className="h-2 rounded-full bg-orange-500"
                style={{ width: `${Math.round(goalPct * 100)}%` }}
              />
            </View>
          </View>
        ) : null}

        <Pressable
          onPress={markComplete}
          disabled={done}
          className={`mt-4 items-center justify-center rounded-2xl px-4 py-4 ${
            done
              ? "bg-slate-100 dark:bg-slate-900"
              : "bg-slate-900 dark:bg-slate-100"
          }`}
        >
          <Text
            className={`text-base font-semibold ${
              done
                ? "text-slate-500 dark:text-slate-400"
                : "text-white dark:text-slate-900"
            }`}
          >
            {done ? "Done for today ✓" : "Mark today complete"}
          </Text>
          {!done ? (
            <Text className="mt-1 text-xs text-slate-300 dark:text-slate-600">
              {status?.variant === "risk"
                ? "Don’t lose it today"
                : "Keep it going"}
            </Text>
          ) : null}
        </Pressable>

        <View className="mt-5 rounded-3xl bg-white/90 p-4 dark:bg-slate-900">
          <Text className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Reminder
          </Text>
          <Text className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Daily at {formatTime(counter.reminderHour, counter.reminderMinute)}
          </Text>

          <Pressable
            onPress={() => setReminderTimeOpen(true)}
            className="mt-3 rounded-2xl bg-slate-100 px-4 py-3 dark:bg-slate-800"
          >
            <Text className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Change time
            </Text>
          </Pressable>

          <Pressable
            onPress={async () => {
              if (!counter) return;

              const nextEnabled = !counter.reminderEnabled;
              const next = { ...counter, reminderEnabled: nextEnabled };
              const nextAll = allCounters.map((c) =>
                c.id === next.id ? next : c,
              );

              setAllCounters(nextAll);
              setCounter(next);
              await saveCounters(nextAll);

              if (nextEnabled) {
                const result = await enableHabitReminder(counter.id, {
                  title: counter.title,
                  hour: counter.reminderHour ?? 20,
                  minute: counter.reminderMinute ?? 0,
                });
                if (!result.ok) {
                  Alert.alert(
                    "Reminders unavailable",
                    result.reason === "web"
                      ? "Reminders don’t work on web. Try on a device via Expo Go."
                      : "Please allow notifications to enable reminders.",
                  );

                  const rolledBack = { ...next, reminderEnabled: false };
                  const rolledBackAll = allCounters.map((c) =>
                    c.id === rolledBack.id ? rolledBack : c,
                  );
                  setAllCounters(rolledBackAll);
                  setCounter(rolledBack);
                  await saveCounters(rolledBackAll);
                  return;
                }
                return;
              }

              await disableHabitReminder(counter.id);
            }}
            className="mt-3 flex-row items-center justify-between rounded-2xl bg-slate-100 px-4 py-4 dark:bg-slate-800"
          >
            <Text className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Enabled
            </Text>
            <View
              className={`h-6 w-12 rounded-full p-1 ${
                counter.reminderEnabled
                  ? "bg-slate-900 dark:bg-slate-100"
                  : "bg-slate-200 dark:bg-slate-700"
              }`}
            >
              <View
                className={`h-4 w-4 rounded-full ${
                  counter.reminderEnabled
                    ? "ml-auto bg-white dark:bg-slate-900"
                    : "bg-white dark:bg-slate-500"
                }`}
              />
            </View>
          </Pressable>
        </View>

        <View className="mt-5 rounded-3xl bg-white/90 p-4 dark:bg-slate-900">
          <Text className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Calendar
          </Text>
          <View className="mt-3 flex-row items-center justify-between">
            <Pressable
              onPress={() =>
                setMonthCursor(
                  (m) => new Date(m.getFullYear(), m.getMonth() - 1, 1),
                )
              }
              className="rounded-full bg-slate-100 px-3 py-2 dark:bg-slate-800"
            >
              <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Prev
              </Text>
            </Pressable>
            <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              {formatMonthTitle(monthCursor)}
            </Text>
            <Pressable
              onPress={() =>
                setMonthCursor(
                  (m) => new Date(m.getFullYear(), m.getMonth() + 1, 1),
                )
              }
              className="rounded-full bg-slate-100 px-3 py-2 dark:bg-slate-800"
            >
              <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                Next
              </Text>
            </Pressable>
          </View>

          <View className="mt-3 flex-row justify-between">
            {["S", "M", "T", "W", "T", "F", "S"].map((d) => (
              <View key={d} style={{ width: "14%" }} className="items-center">
                <Text className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                  {d}
                </Text>
              </View>
            ))}
          </View>

          <View className="mt-2 flex-row flex-wrap justify-between">
            {monthCells.map((cell) => {
              if (cell.empty) {
                return (
                  <View
                    key={cell.key}
                    style={{ width: "14%" }}
                    className="mb-2"
                  />
                );
              }

              const doneCell = (counter.history || []).includes(cell.dateKey);
              const disabled = isFutureDateKey(cell.dateKey);
              const isToday = cell.dateKey === todayKey();

              const bg = doneCell
                ? "bg-orange-500"
                : "bg-slate-100 dark:bg-slate-800";
              const ring = isToday
                ? "border border-slate-300 dark:border-slate-600"
                : "";

              return (
                <Pressable
                  key={cell.key}
                  disabled={disabled}
                  onPress={async () => {
                    const updated = setDateCompleted(
                      counter,
                      cell.dateKey,
                      !doneCell,
                    );
                    const nextAll = allCounters.map((c) =>
                      c.id === updated.id ? updated : c,
                    );
                    setAllCounters(nextAll);
                    setCounter(updated);
                    await saveCounters(nextAll);
                  }}
                  style={{ width: "14%" }}
                  className={`mb-2 items-center justify-center rounded-2xl px-1 py-3 ${bg} ${ring} ${
                    disabled ? "opacity-40" : ""
                  }`}
                >
                  <Text
                    className={`text-[11px] font-semibold ${
                      doneCell
                        ? "text-white"
                        : "text-slate-700 dark:text-slate-200"
                    }`}
                  >
                    {cell.day}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="mt-5 rounded-3xl bg-white/90 p-4 dark:bg-slate-900">
          <Text className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Badges
          </Text>
          <View className="mt-3 flex-row">
            {badges.map((b, idx) => (
              <View
                key={b.n}
                className={`flex-1 items-center rounded-2xl px-3 py-3 ${
                  b.earned
                    ? "bg-slate-900 dark:bg-slate-100"
                    : "bg-slate-100 dark:bg-slate-800"
                } ${idx === 1 ? "mx-2" : ""}`}
              >
                <Text
                  className={`text-lg font-bold ${
                    b.earned
                      ? "text-white dark:text-slate-900"
                      : "text-slate-700 dark:text-slate-200"
                  }`}
                >
                  {b.n}
                </Text>
                <Text
                  className={`mt-1 text-[10px] font-semibold ${
                    b.earned
                      ? "text-slate-200 dark:text-slate-700"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  day streak
                </Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
