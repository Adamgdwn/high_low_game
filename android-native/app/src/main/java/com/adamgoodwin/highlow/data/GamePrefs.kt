package com.adamgoodwin.highlow.data

import android.content.Context
import com.adamgoodwin.highlow.game.GameMode
import com.adamgoodwin.highlow.game.PersistedGameState
import com.adamgoodwin.highlow.game.ZenMusicTrack

class GamePrefs(context: Context) {
    private val prefs = context.getSharedPreferences("high_low_native_prefs", Context.MODE_PRIVATE)

    fun load(): PersistedGameState {
        val modeName = prefs.getString(KEY_MODE, GameMode.FAIR.name) ?: GameMode.FAIR.name
        val mode = runCatching { GameMode.valueOf(modeName) }.getOrDefault(GameMode.FAIR)
        val zenTrackName = prefs.getString(KEY_ZEN_MUSIC_TRACK, ZenMusicTrack.CALM.name) ?: ZenMusicTrack.CALM.name
        val zenTrack = runCatching { ZenMusicTrack.valueOf(zenTrackName) }.getOrDefault(ZenMusicTrack.CALM)
        return PersistedGameState(
            balance = prefs.getInt(KEY_BALANCE, 10_000),
            mode = mode,
            fairDeckCount = prefs.getInt(KEY_FAIR_DECK_COUNT, 1).coerceIn(1, 3),
            soundEnabled = prefs.getBoolean(KEY_SOUND, false),
            zenMode = prefs.getBoolean(KEY_ZEN_MODE, false),
            zenMusicEnabled = prefs.getBoolean(KEY_ZEN_MUSIC_ENABLED, false),
            zenMusicTrack = zenTrack,
            zenMusicVolume = prefs.getInt(KEY_ZEN_MUSIC_VOLUME, 35).coerceIn(0, 100),
            reducedMotion = prefs.getBoolean(KEY_REDUCED_MOTION, false),
            streak = prefs.getInt(KEY_STREAK, 0),
            lastBet = prefs.getInt(KEY_LAST_BET, 100),
            borrowUsed = prefs.getBoolean(KEY_BORROW_USED, false),
            authEmail = prefs.getString(KEY_AUTH_EMAIL, null),
            authAccessToken = prefs.getString(KEY_AUTH_ACCESS_TOKEN, null),
            authRefreshToken = prefs.getString(KEY_AUTH_REFRESH_TOKEN, null),
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
            .putBoolean(KEY_ZEN_MODE, state.zenMode)
            .putBoolean(KEY_ZEN_MUSIC_ENABLED, state.zenMusicEnabled)
            .putString(KEY_ZEN_MUSIC_TRACK, state.zenMusicTrack.name)
            .putInt(KEY_ZEN_MUSIC_VOLUME, state.zenMusicVolume.coerceIn(0, 100))
            .putBoolean(KEY_REDUCED_MOTION, state.reducedMotion)
            .putInt(KEY_STREAK, state.streak)
            .putInt(KEY_LAST_BET, state.lastBet)
            .putBoolean(KEY_BORROW_USED, state.borrowUsed)
            .putString(KEY_AUTH_EMAIL, state.authEmail)
            .putString(KEY_AUTH_ACCESS_TOKEN, state.authAccessToken)
            .putString(KEY_AUTH_REFRESH_TOKEN, state.authRefreshToken)
            .putBoolean(KEY_WELCOME_SEEN, state.welcomeSeen)
            .putBoolean(KEY_DEBUG_OPEN, state.debugOpen)
            .apply()
    }

    private companion object {
        const val KEY_BALANCE = "balance"
        const val KEY_MODE = "mode"
        const val KEY_FAIR_DECK_COUNT = "fairDeckCount"
        const val KEY_SOUND = "soundEnabled"
        const val KEY_ZEN_MODE = "zenMode"
        const val KEY_ZEN_MUSIC_ENABLED = "zenMusicEnabled"
        const val KEY_ZEN_MUSIC_TRACK = "zenMusicTrack"
        const val KEY_ZEN_MUSIC_VOLUME = "zenMusicVolume"
        const val KEY_REDUCED_MOTION = "reducedMotion"
        const val KEY_STREAK = "streak"
        const val KEY_LAST_BET = "lastBet"
        const val KEY_BORROW_USED = "borrowUsed"
        const val KEY_AUTH_EMAIL = "authEmail"
        const val KEY_AUTH_ACCESS_TOKEN = "authAccessToken"
        const val KEY_AUTH_REFRESH_TOKEN = "authRefreshToken"
        const val KEY_WELCOME_SEEN = "welcomeSeen"
        const val KEY_DEBUG_OPEN = "debugOpen"
    }
}
