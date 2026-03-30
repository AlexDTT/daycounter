import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const STORAGE_ENABLED = "reminder.enabled";
const STORAGE_ID = "reminder.notificationId";

const HABIT_ID_PREFIX = "reminder.habit.notificationId.";

// Keep notifications lightweight and friendly.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function getReminderState() {
  const [enabledRaw, id] = await Promise.all([
    AsyncStorage.getItem(STORAGE_ENABLED),
    AsyncStorage.getItem(STORAGE_ID),
  ]);
  return {
    enabled: enabledRaw === "true",
    notificationId: id || null,
  };
}

async function ensurePermissions() {
  if (Platform.OS === "web") return { granted: false, reason: "web" };

  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return { granted: true };

  const requested = await Notifications.requestPermissionsAsync();
  return { granted: requested.granted };
}

export async function enableDailyReminder({ hour = 20, minute = 0 } = {}) {
  const perm = await ensurePermissions();
  if (!perm.granted) {
    await AsyncStorage.setItem(STORAGE_ENABLED, "false");
    return { ok: false, reason: perm.reason || "permission" };
  }

  if (Platform.OS === "android") {
    // Required for notifications to show consistently on Android.
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  // Clear any previous reminder before scheduling a new one.
  const previousId = await AsyncStorage.getItem(STORAGE_ID);
  if (previousId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(previousId);
    } catch {
      // ignore
    }
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Don’t break your streak",
      body: "Quick check-in: mark today complete.",
    },
    trigger: { hour, minute, repeats: true },
  });

  await Promise.all([
    AsyncStorage.setItem(STORAGE_ENABLED, "true"),
    AsyncStorage.setItem(STORAGE_ID, id),
  ]);

  return { ok: true, notificationId: id };
}

export async function disableDailyReminder() {
  const id = await AsyncStorage.getItem(STORAGE_ID);
  if (id) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      // ignore
    }
  }

  await Promise.all([
    AsyncStorage.setItem(STORAGE_ENABLED, "false"),
    AsyncStorage.removeItem(STORAGE_ID),
  ]);

  return { ok: true };
}

function habitStorageKey(counterId) {
  return `${HABIT_ID_PREFIX}${String(counterId)}`;
}

export async function getHabitReminderState(counterId) {
  const id = await AsyncStorage.getItem(habitStorageKey(counterId));
  return {
    enabled: Boolean(id),
    notificationId: id || null,
  };
}

export async function enableHabitReminder(
  counterId,
  { title = "Your habit", hour = 20, minute = 0 } = {},
) {
  const perm = await ensurePermissions();
  if (!perm.granted) {
    return { ok: false, reason: perm.reason || "permission" };
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const key = habitStorageKey(counterId);
  const previousId = await AsyncStorage.getItem(key);
  if (previousId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(previousId);
    } catch {
      // ignore
    }
  }

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: "Don’t break your streak",
      body: `Quick check-in: mark “${title}” complete.`,
    },
    trigger: { hour, minute, repeats: true },
  });

  await AsyncStorage.setItem(key, id);
  return { ok: true, notificationId: id };
}

export async function disableHabitReminder(counterId) {
  const key = habitStorageKey(counterId);
  const id = await AsyncStorage.getItem(key);
  if (id) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      // ignore
    }
  }

  await AsyncStorage.removeItem(key);
  return { ok: true };
}
