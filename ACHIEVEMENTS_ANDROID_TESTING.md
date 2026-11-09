# Achievements: Android phone checklist

The feature is local to this app installation. Keep your existing data; do not uninstall, clear storage, change your phone clock, or switch to the notifications branch for this check.

## Open the app

1. Connect your computer and Android phone to the same Wi-Fi.
2. Open a terminal in the MOMENTUM project folder in VS Code.
3. Run `npm.cmd start` in Windows PowerShell (or `npm start` in another terminal).
4. Open the same Expo Go / development-build workflow you already use for MOMENTUM. Expo Go must support SDK 58. Scan Metro's QR code on your phone. If a development build is already your usual workflow, keep using it; this feature adds no native modules.
5. Wait for habits and saved history to finish loading. Do not interpret a loading message as lost data.

## Check the screens

1. On **Today**, find the compact **Achievements** card below daily progress and the optional name prompt. Tap **View achievements**.
2. Verify the dark gallery has **12 badges**, with **All**, **Earned**, and **Locked** filters. The bottom navigation still has five tabs; Achievements is a screen above them.
3. Tap any badge to expand it. Check its criterion and progress. Earned badges must show **Recognized on** and separately **Based on saved history through**. There must be no invented historical unlock date.
4. Use Android Back. You should return to Today. Open **Settings → Achievements**, then Back; you should return to Settings.
5. If saved finished history meets milestones, expect a single summary batch. Tap **Dismiss**, close/reopen the app, and verify the same summary does not reappear. Opening the gallery from a summary card also acknowledges the badges present at that moment.

## Check today's motivation

1. Make progress on a habit scheduled today: tick it, add one Count unit, or check a required Checklist step.
2. If badges remain locked, Today's card should show a small provisional encouragement. Partial Count/Checklist effort can encourage you before a check-in is complete. Optional-only Checklist effort does not trigger it.
3. Today's effort must **not** immediately add a permanent earned badge. Undo the progress; if no genuine effort remains today, the encouragement disappears.
4. Complete a scheduled habit and wait for its save indicator to finish. Keep the app/data installed.
5. After the next real local midnight, reopen/foreground the app. Any eligible finished-day badges should be saved once. A completed habit is one check-in, even if Count exceeds its target.
6. A finished perfect week is recognized on or after Monday, not while Sunday is still in progress. Rest days do not count as perfect days by themselves.

## Check retention and comfort

1. Only if you have a disposable habit you are comfortable editing, change its schedule or delete it. Already earned badges must remain earned. Locked progress can decrease; the gallery explains that historical schedules are not versioned and deleted habits do not generate new awards.
2. Reopen Today, Habits, Goals, Routines, Insights, Profile and Settings. Normal tracking and navigation should still work.
3. Increase Android's font size and reopen the gallery. Cards should switch to one column when needed, and text/actions should remain readable above the bottom system bar.
4. If you use TalkBack, check that badge names, earned/locked state, progress, filters, and expandable details are spoken. Try gesture navigation and three-button navigation if available.
5. If a read/save error appears, keep the data and use **Try again**. An acknowledgement failure leaves the summary visible so you can dismiss again. Never reset storage to hide an error.

Report the phone model, Android version, screen/action, expected result, actual result and a screenshot for any visual issue. Automated tests cover injected corruption, failed writes, concurrent requests and midnight queues; those failure cases cannot safely be forced through production Settings.

No Git commit or push has been made. Phone testing remains required before commit approval.
