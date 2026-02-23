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

## Supabase (Magic Link + Cloud Save)

This repo is scaffolded for Supabase magic-link auth and cloud sync (web first).

### 1. Install deps

```bash
npm install
```

(`@supabase/supabase-js` is included in `package.json`.)

### 2. Add env vars

Copy `.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Do **not** use the service role key in the browser app.

### 3. Create DB table + policies

Run the SQL in:

- `supabase/migrations/0001_game_profiles.sql`

You can paste it into the Supabase SQL Editor.

### 4. Enable Magic Link auth

In Supabase Dashboard:

- `Authentication` -> `Providers` -> `Email`
- Enable email sign-in / magic link (OTP)

### 5. Add site URL / redirect URL

In Supabase auth URL settings, allow your local and production URLs:

- `http://localhost:3000`
- `https://highlowgame.vercel.app`

The web app uses magic-link sign-in and syncs persisted game progress (balance/settings/streak/borrow usage).
