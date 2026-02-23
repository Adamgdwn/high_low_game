package com.adamgoodwin.highlow.data

import android.content.Context
import com.adamgoodwin.highlow.game.GameMode
import com.adamgoodwin.highlow.game.PersistedGameState

class GamePrefs(context: Context) {
    private val prefs = context.getSharedPreferences("high_low_native_prefs", Context.MODE_PRIVATE)

    fun load(): PersistedGameState {
        val modeName = prefs.getString(KEY_MODE, GameMode.FAIR.name) ?: GameMode.FAIR.name
        val mode = runCatching { GameMode.valueOf(modeName) }.getOrDefault(GameMode.FAIR)
        return PersistedGameState(
            balance = prefs.getInt(KEY_BALANCE, 10_000),
            mode = mode,
            fairDeckCount = prefs.getInt(KEY_FAIR_DECK_COUNT, 1).coerceIn(1, 3),
            soundEnabled = prefs.getBoolean(KEY_SOUND, true),
            reducedMotion = prefs.getBoolean(KEY_REDUCED_MOTION, false),
            streak = prefs.getInt(KEY_STREAK, 0),
            lastBet = prefs.getInt(KEY_LAST_BET, 100),
            borrowUsed = prefs.getBoolean(KEY_BORROW_USED, false),
            welcomeSeen = prefs.getBoolean(KEY_WELCOME_SEEN, false),
            debugOpen = prefs.getBoolean(KEY_DEBUG_OPEN, false)
        )
    }

    fun save(state: PersistedGameState) {
        prefs.edit()
            .putInt(KEY_BALANCE, state.balance)
            .putString(KEY_MODE, state.mode.name)
            .putInt(KEY_FAIR_DECK_COUNT, state.fairDeckCount.coerceIn(1, 3))
            .putBoolean(KEY_SOUND, state.soundEnabled)
            .putBoolean(KEY_REDUCED_MOTION, state.reducedMotion)
            .putInt(KEY_STREAK, state.streak)
            .putInt(KEY_LAST_BET, state.lastBet)
            .putBoolean(KEY_BORROW_USED, state.borrowUsed)
            .putBoolean(KEY_WELCOME_SEEN, state.welcomeSeen)
            .putBoolean(KEY_DEBUG_OPEN, state.debugOpen)
            .apply()
    }

    private companion object {
        const val KEY_BALANCE = "balance"
        const val KEY_MODE = "mode"
        const val KEY_FAIR_DECK_COUNT = "fairDeckCount"
        const val KEY_SOUND = "soundEnabled"
        const val KEY_REDUCED_MOTION = "reducedMotion"
        const val KEY_STREAK = "streak"
        const val KEY_LAST_BET = "lastBet"
        const val KEY_BORROW_USED = "borrowUsed"
        const val KEY_WELCOME_SEEN = "welcomeSeen"
        const val KEY_DEBUG_OPEN = "debugOpen"
    }
}
