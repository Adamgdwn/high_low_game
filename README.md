# Vegas-Style High/Low (Social Casino MVP)

Web MVP built with Next.js App Router + TypeScript + Tailwind.

## Disclaimer

**Chips have no cash value. No cash out. No prizes.**

This app is a fake-chip social casino demo only.

## Rules

- Standard 52-card deck (ranks A=1 to K=13, 4 suits)
- Choose `HIGH` if next rank should be higher, `LOW` if lower
- Tie behavior: **Push** (bet returned, streak unchanged)
- Payout:
  - Win profit = `+bet` (plus streak bonus if triggered)
  - Loss = `-bet`
  - Push = `0`
- Streak bonus (configurable): every 3 wins adds +10% of bet (capped)

## Modes

- `Fair`: random draw from remaining deck
- `Demo: Always Win`: rigged so player's pick is correct
- `Chaos: Always Lose`: rigged so player's pick is incorrect

Rigging is implemented in `lib/game-engine.ts` and isolated from the UI.

## Configurable Values

Change these in `lib/constants.ts`:

- `STARTING_BALANCE`
- `BONUS_CONFIG`
- `MIN_BET`
- `QUICK_BETS`
- `SHUFFLE_THRESHOLD`

## Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`

## Build

```bash
npm run build
npm start
```

## Tests

```bash
npm test
```

## Notes

- localStorage persists balance, mode, sound, reduced motion, streak, and last bet.
- Sound uses Web Audio oscillator tones (no external sound files required, no runtime crash if audio is unavailable).
