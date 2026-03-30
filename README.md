# DayCounter

A modern mobile-first React Native app that helps users track days, habits, and streaks.

## Features

- Create multiple counters
- Track streaks, total days, and goals
- Month calendar per habit (tap days to mark/unmark)
- Per-habit daily reminders
- Delete habits
- Visual streak indicators
- Built with React Native and Expo

## Quick Start

1. Run `npm install`
2. Run `npm start`
3. Scan the QR code with your Expo Go app, or press `i` to open in iOS simulator, `a` for Android emulator.

## Device Settings (per-device)

- Theme preference and daily reminder settings are stored locally on each device (AsyncStorage).
- They are not synced via Firebase.

## Offline Storage

- Counters are stored locally on-device (AsyncStorage) and work fully offline.
