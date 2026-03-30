import React, { useEffect, useMemo, useState } from "react";
import {
  Animated,
  Alert,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import {
  canMarkToday,
  createCounter,
  formatDateShort,
  getStreakStatus,
  loadCounters,
  markTodayComplete,
  saveCounters,
  todayKey,
} from "../lib/counters";
import { disableHabitReminder } from "../lib/reminders";

export default function HomeScreen() {
  const [counters, setCounters] = useState([]);
  const [showArchived, setShowArchived] = useState(false);

  const [toast, setToast] = useState(null);
  const toastAnim = React.useRef(new Animated.Value(0)).current;

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [formCounterId, setFormCounterId] = useState(null);
  const [formTitle, setFormTitle] = useState("");
  const [formGoal, setFormGoal] = useState("");

  const [actionsOpen, setActionsOpen] = useState(false);
  const [actionsCounterId, setActionsCounterId] = useState(null);

  const navigation = useNavigation();
  const isFocused = useIsFocused();

  useEffect(() => {
    if (isFocused) refresh();
  }, [isFocused]);

  const refresh = async () => {
    try {
      const loaded = await loadCounters();
      setCounters(loaded);
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
      Animated.delay(1200),
      Animated.timing(toastAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) setToast(null);
    });
  };

  const filteredCounters = useMemo(() => {
    return counters
      .filter((c) => (showArchived ? true : !c.archived))
      .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }, [counters, showArchived]);

  const stats = useMemo(() => {
    const active = counters.filter((c) => !c.archived);
    const today = todayKey();
    const completedToday = active.filter((c) =>
      (c.history || []).includes(today),
    );
    const best = active.reduce(
      (acc, c) => Math.max(acc, c.longestStreak || 0),
      0,
    );
    return {
      activeCount: active.length,
      completedTodayCount: completedToday.length,
      bestStreak: best,
    };
  }, [counters]);

  const openCreate = () => {
    setFormMode("create");
    setFormCounterId(null);
    setFormTitle("");
    setFormGoal("");
    setFormOpen(true);
  };

  const openEdit = (counter) => {
    setFormMode("edit");
    setFormCounterId(counter.id);
    setFormTitle(counter.title);
    setFormGoal(counter.goal == null ? "" : String(counter.goal));
    setFormOpen(true);
  };

  const submitForm = async () => {
    const trimmed = formTitle.trim();
    if (!trimmed) return;

    const goalNumber = formGoal.trim() === "" ? null : Number(formGoal);
    if (
      goalNumber != null &&
      (!Number.isFinite(goalNumber) || goalNumber <= 0)
    ) {
      Alert.alert("Invalid goal", "Goal must be a positive number.");
      return;
    }

    let updated = counters;
    if (formMode === "create") {
      updated = [
        ...counters,
        createCounter({ title: trimmed, goal: goalNumber }),
      ];
    } else {
      updated = counters.map((c) => {
        if (c.id !== formCounterId) return c;
        return { ...c, title: trimmed, goal: goalNumber };
      });
    }

    setCounters(updated);
    await saveCounters(updated);
    setFormOpen(false);
  };

  const openActions = (counter) => {
    setActionsCounterId(counter.id);
    setActionsOpen(true);
  };

  const stopPress = (e) => {
    if (e?.stopPropagation) e.stopPropagation();
  };

  const selectedCounter = useMemo(() => {
    if (!actionsCounterId) return null;
    return counters.find((c) => c.id === actionsCounterId) || null;
  }, [actionsCounterId, counters]);

  const markToday = async (counter) => {
    if (!canMarkToday(counter)) return;

    const before = counters.find((c) => c.id === counter.id) || counter;
    const after = markTodayComplete(before);
    const next = counters.map((c) => (c.id === counter.id ? after : c));

    setCounters(next);
    await saveCounters(next);

    const delta = (after.streak || 0) - (before.streak || 0);
    const status = getStreakStatus(after);
    showToast({
      title:
        delta <= 0
          ? "🔥 Streak saved"
          : after.streak === 1 && (before.streak || 0) === 0
            ? "🔥 Streak started"
            : "🔥 Streak +1",
      subtitle: `${status.streak}-day streak`,
    });
  };

  const renderItem = ({ item }) => {
    const done = !canMarkToday(item);
    const goalPct = item.goal ? Math.min(1, (item.streak || 0) / item.goal) : 0;
    const status = getStreakStatus(item);

    const pill =
      status.variant === "safe"
        ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
        : status.variant === "risk"
          ? "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200"
          : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200";

    return (
      <Pressable
        onPress={() => navigation.navigate("Detail", { id: item.id })}
        onLongPress={() => openActions(item)}
        className="mb-3 rounded-3xl bg-white/90 p-4 shadow-sm dark:bg-slate-900"
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-1 flex-row pr-3">
            <View className="mr-3 items-start">
              <Text className="text-2xl font-bold text-orange-500">
                🔥 {item.streak}
              </Text>
              <Text className="mt-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                streak
              </Text>
            </View>

            <View className="flex-1">
              <Text
                numberOfLines={1}
                className="text-base font-semibold text-slate-900 dark:text-slate-100"
              >
                {item.title}
              </Text>
              <Text className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Started {formatDateShort(item.createdAt)}
              </Text>
              <View className="mt-2 self-start rounded-full px-3 py-1">
                <View className={`rounded-full px-3 py-1 ${pill}`}>
                  <Text className="text-[11px] font-semibold">
                    {status.variant === "risk" ? "⚠︎" : ""} {status.title}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <Pressable
            onPress={(e) => {
              stopPress(e);
              openActions(item);
            }}
            hitSlop={10}
            className="h-9 w-9 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800"
          >
            <Text className="text-lg text-slate-700 dark:text-slate-200">
              ⋯
            </Text>
          </Pressable>
        </View>

        <View className="mt-4 flex-row items-center justify-between">
          <Text className="text-xs text-slate-500 dark:text-slate-400">
            best {item.longestStreak}
          </Text>
          <Text className="text-xs text-slate-500 dark:text-slate-400">
            {item.totalDays} total
          </Text>
        </View>

        {!done ? (
          <Text className="mt-2 text-xs font-medium text-slate-700 dark:text-slate-200">
            {status.subtitle}
          </Text>
        ) : (
          <Text className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {status.subtitle}
          </Text>
        )}

        {item.goal ? (
          <View className="mt-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs text-slate-500 dark:text-slate-400">
                Goal {item.goal} days
              </Text>
              <Text className="text-xs text-slate-500 dark:text-slate-400">
                {Math.round(goalPct * 100)}%
              </Text>
            </View>
            <View className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <View
                className="h-2 rounded-full bg-orange-500"
                style={{ width: `${Math.round(goalPct * 100)}%` }}
              />
            </View>
          </View>
        ) : null}

        <Pressable
          onPress={() => markToday(item)}
          disabled={done}
          className={`mt-4 items-center justify-center rounded-2xl px-4 py-3 ${
            done
              ? "bg-slate-100 dark:bg-slate-800"
              : "bg-slate-900 dark:bg-slate-100"
          }`}
        >
          <Text
            className={`text-sm font-semibold ${
              done
                ? "text-slate-500 dark:text-slate-400"
                : "text-white dark:text-slate-900"
            }`}
          >
            {done ? "Done for today ✓" : "Mark today complete"}
          </Text>
        </Pressable>
      </Pressable>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-950">
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

      <View className="px-5 pt-4">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Today
            </Text>
            <Text className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
              DayCounter
            </Text>
          </View>

          <View className="flex-row items-center">
            <Pressable
              onPress={() => setShowArchived((v) => !v)}
              className="mr-2 rounded-full bg-slate-100 px-3 py-2 dark:bg-slate-900"
            >
              <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                {showArchived ? "All" : "Active"}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => navigation.navigate("Settings")}
              className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-900"
            >
              <Text className="text-lg text-slate-700 dark:text-slate-200">
                ⚙︎
              </Text>
            </Pressable>
          </View>
        </View>

        <View className="mt-4 flex-row justify-between rounded-3xl bg-white/90 p-4 dark:bg-slate-900">
          <View className="items-center">
            <Text className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {stats.activeCount}
            </Text>
            <Text className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              active
            </Text>
          </View>
          <View className="items-center">
            <Text className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {stats.completedTodayCount}
            </Text>
            <Text className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              done today
            </Text>
          </View>
          <View className="items-center">
            <Text className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {stats.bestStreak}
            </Text>
            <Text className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              best
            </Text>
          </View>
        </View>

        {filteredCounters.length === 0 ? (
          <View className="mt-6 rounded-3xl bg-white/90 p-5 dark:bg-slate-900">
            <Text className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Create your first counter
            </Text>
            <Text className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Try “Gym streak”, “Days without sugar”, or “No vaping”.
            </Text>
            <Pressable
              onPress={openCreate}
              className="mt-4 items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 dark:bg-slate-100"
            >
              <Text className="text-sm font-semibold text-white dark:text-slate-900">
                Add a counter
              </Text>
            </Pressable>
          </View>
        ) : null}
      </View>

      <FlatList
        data={filteredCounters}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 120,
        }}
        showsVerticalScrollIndicator={false}
      />

      <View className="absolute bottom-6 right-6">
        <Pressable
          onPress={openCreate}
          className="h-14 w-14 items-center justify-center rounded-full bg-slate-900 shadow-sm dark:bg-slate-100"
        >
          <Text className="text-2xl font-bold text-white dark:text-slate-900">
            +
          </Text>
        </Pressable>
      </View>

      <Modal visible={formOpen} transparent animationType="slide">
        <Pressable
          className="flex-1 bg-black/50 px-5"
          onPress={() => setFormOpen(false)}
        >
          <Pressable
            className="mt-auto rounded-3xl bg-white p-5 dark:bg-slate-900"
            onPress={() => {}}
          >
            <View className="flex-row items-center justify-between">
              <Text className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {formMode === "create" ? "New counter" : "Edit counter"}
              </Text>
              <Pressable onPress={() => setFormOpen(false)} hitSlop={10}>
                <Text className="text-base font-semibold text-slate-500">
                  ✕
                </Text>
              </Pressable>
            </View>

            <Text className="mt-4 text-xs font-medium text-slate-500 dark:text-slate-400">
              Name
            </Text>
            <TextInput
              value={formTitle}
              onChangeText={setFormTitle}
              placeholder="Gym streak"
              placeholderTextColor="#94a3b8"
              className="mt-2 rounded-2xl bg-slate-100 px-4 py-3 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
            />

            <Text className="mt-4 text-xs font-medium text-slate-500 dark:text-slate-400">
              Goal (optional)
            </Text>
            <TextInput
              value={formGoal}
              onChangeText={setFormGoal}
              placeholder="30"
              placeholderTextColor="#94a3b8"
              keyboardType="numeric"
              className="mt-2 rounded-2xl bg-slate-100 px-4 py-3 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
            />

            <Pressable
              onPress={submitForm}
              className="mt-5 items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 dark:bg-slate-100"
            >
              <Text className="text-sm font-semibold text-white dark:text-slate-900">
                {formMode === "create" ? "Create" : "Save changes"}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={actionsOpen} transparent animationType="fade">
        <Pressable
          className="flex-1 bg-black/40 px-5"
          onPress={() => setActionsOpen(false)}
        >
          <Pressable
            className="mt-auto rounded-3xl bg-white p-3 dark:bg-slate-900"
            onPress={stopPress}
          >
            <View className="px-3 py-2">
              <Text className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {selectedCounter?.title || "Counter"}
              </Text>
            </View>

            <Pressable
              onPress={(e) => {
                stopPress(e);
                if (selectedCounter) openEdit(selectedCounter);
                setActionsOpen(false);
              }}
              className="rounded-2xl px-3 py-3"
            >
              <Text className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Edit
              </Text>
            </Pressable>

            <Pressable
              onPress={async (e) => {
                stopPress(e);
                if (!selectedCounter) return;
                const nextArchived = !selectedCounter.archived;
                if (nextArchived) {
                  await disableHabitReminder(selectedCounter.id);
                }
                const next = counters.map((c) => {
                  if (c.id !== selectedCounter.id) return c;
                  return {
                    ...c,
                    archived: nextArchived,
                    reminderEnabled: nextArchived ? false : c.reminderEnabled,
                  };
                });
                setCounters(next);
                await saveCounters(next);
                setActionsOpen(false);
              }}
              className="rounded-2xl px-3 py-3"
            >
              <Text className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {selectedCounter?.archived ? "Unarchive" : "Archive"}
              </Text>
            </Pressable>

            <Pressable
              onPress={(e) => {
                stopPress(e);
                if (!selectedCounter) return;
                const counterId = selectedCounter.id;
                const counterTitle = selectedCounter.title;
                // Close the sheet first; Alert from inside a Modal can be unreliable on some devices.
                setActionsOpen(false);
                setTimeout(() => {
                  Alert.alert(
                    "Delete",
                    `Delete “${counterTitle}”? This cannot be undone.`,
                    [
                      { text: "Cancel", style: "cancel" },
                      {
                        text: "Delete",
                        style: "destructive",
                        onPress: () => {
                          void (async () => {
                            try {
                              await disableHabitReminder(counterId);
                              const loaded = await loadCounters();
                              const next = loaded.filter(
                                (c) => c.id !== counterId,
                              );
                              setCounters(next);
                              await saveCounters(next);
                            } catch (err) {
                              console.error(err);
                            }
                          })();
                        },
                      },
                    ],
                  );
                }, 0);
              }}
              className="rounded-2xl px-3 py-3"
            >
              <Text className="text-sm font-semibold text-red-600">Delete</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
