# HighLowNative (Android, Jetpack Compose)

Native Android MVP for the Vegas-style High/Low social casino game using **fake chips only**.

## Important Disclaimer

**Chips have no cash value. No cash out. No prizes.**

This app is a social casino demo only. No real-money wagering, no payouts, no gift cards.

## What’s Included

- Kotlin + Jetpack Compose single-screen game loop
- Modes:
  - `Fair`
  - `Demo: Always Win`
  - `Chaos: Always Lose`
- Deck simulation (52 cards, A=1, K=13)
- Tie behavior: **Push** (bet returned, streak unchanged)
- Streak bonus (every 3 wins, +10% capped)
- Large HIGH/LOW buttons with edge-card disable behavior:
  - Ace disables `LOW`
  - King disables `HIGH`
- Local persistence via `SharedPreferences`
- Settings bottom sheet (mode / sound / reduced motion / rules / disclaimer)
- Snackbar “toast” messages
- Placeholder sound effects via `ToneGenerator`

## Open In Android Studio

1. Open Android Studio
2. Choose **Open**
3. Select the folder:
   - `c:\Users\adamg\01. Codex Built Apps\high_low_game\android-native`
4. Let Gradle sync finish
5. Run on an emulator or connected device

## If Android Studio Asks To Upgrade

- It may suggest updating Gradle/AGP/Kotlin versions depending on your installed Android Studio version.
- Accept the minimal upgrades needed, then sync again.

## Files (Key)

- `app/src/main/java/com/adamgoodwin/highlow/HighLowViewModel.kt` - state machine + game loop orchestration
- `app/src/main/java/com/adamgoodwin/highlow/game/GameEngine.kt` - fairness + rigging + payout logic
- `app/src/main/java/com/adamgoodwin/highlow/ui/HighLowApp.kt` - Compose UI
- `app/src/main/java/com/adamgoodwin/highlow/data/GamePrefs.kt` - local persistence

## Notes

- This project is intentionally backend-free for MVP.
- To publish to Play Store later, you’ll create a signing key in Android Studio and build a release bundle (`.aab`) locally.
