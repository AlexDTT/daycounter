import React, { useEffect, useState } from "react";
import { Alert, Pressable, SafeAreaView, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Uniwind, useUniwind } from "uniwind";

const THEME_PREF_KEY = "themePreference";

export default function SettingsScreen() {
  const navigation = useNavigation();
  const { theme, hasAdaptiveThemes } = useUniwind();
  const [loadingThemePref, setLoadingThemePref] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const pref = await AsyncStorage.getItem(THEME_PREF_KEY);
        if (pref === "light" || pref === "dark" || pref === "system") {
          Uniwind.setTheme(pref);
        }
      } finally {
        setLoadingThemePref(false);
      }
    })();
  }, []);

  const isDark = theme === "dark";

  const toggleTheme = async () => {
    if (loadingThemePref) return;
    const next = isDark ? "light" : "dark";
    Uniwind.setTheme(next);
    await AsyncStorage.setItem(THEME_PREF_KEY, next);
  };

  const resetThemeToSystem = async () => {
    if (loadingThemePref) return;
    Uniwind.setTheme("system");
    await AsyncStorage.setItem(THEME_PREF_KEY, "system");
  };

  const Row = ({ title, subtitle, value, onPress, onLongPress }) => (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      className="flex-row items-center justify-between rounded-2xl bg-white/90 px-4 py-4 dark:bg-slate-900"
    >
      <View className="flex-1 pr-4">
        <Text className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </Text>
        {subtitle ? (
          <Text className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {typeof value === "boolean" ? (
        <View
          className={`h-6 w-12 rounded-full p-1 ${
            value
              ? "bg-slate-900 dark:bg-slate-100"
              : "bg-slate-200 dark:bg-slate-800"
          }`}
        >
          <View
            className={`h-4 w-4 rounded-full ${
              value
                ? "ml-auto bg-white dark:bg-slate-900"
                : "bg-white dark:bg-slate-500"
            }`}
          />
        </View>
      ) : null}
    </Pressable>
  );

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-950">
      <View className="px-5 pt-4">
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={() => navigation.goBack()}
            className="rounded-full bg-slate-100 px-3 py-2 dark:bg-slate-900"
          >
            <Text className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              Back
            </Text>
          </Pressable>
          <Text className="text-base font-bold text-slate-900 dark:text-slate-100">
            Settings
          </Text>
          <View className="w-16" />
        </View>

        <View className="mt-5">
          <Row
            title="🌓 Dark mode"
            subtitle={
              hasAdaptiveThemes
                ? "Following system (long-press to override)"
                : "Manual (long-press for system)"
            }
            value={isDark}
            onPress={toggleTheme}
            onLongPress={resetThemeToSystem}
          />
          <View className="h-3" />
          <Row
            title="🔔 Habit reminders"
            subtitle="Enable per habit in the habit details"
            value={null}
            onPress={() =>
              Alert.alert(
                "Habit reminders",
                "Open a habit, then toggle Reminder to get a daily nudge.",
              )
            }
          />
        </View>

        <Pressable
          onPress={() =>
            Alert.alert(
              "Tips",
              "Long-press a counter card on Home to edit, archive, or delete.",
            )
          }
          className="mt-6 items-center justify-center rounded-2xl bg-white/90 px-4 py-4 dark:bg-slate-900"
        >
          <Text className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            ℹ️ How to use
          </Text>
          <Text className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Long-press counters for actions
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
