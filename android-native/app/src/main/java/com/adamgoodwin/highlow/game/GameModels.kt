package com.adamgoodwin.highlow.game

enum class GameMode { FAIR, ALWAYS_WIN, ALWAYS_LOSE }
enum class GamePhase { IDLE, READY, CHOICE, REVEALING, RESULT }
enum class PlayerChoice { HIGH, LOW }
enum class RoundOutcome { WIN, LOSS, PUSH }

data class Card(
    val id: String,
    val suit: String,
    val rank: Int // A=1 ... K=13
)

data class RoundRecord(
    val current: Card,
    val next: Card,
    val choice: PlayerChoice,
    val outcome: RoundOutcome,
    val bet: Int,
    val profit: Int,
    val bonus: Int,
    val mode: GameMode,
    val timestampMs: Long = System.currentTimeMillis()
)

data class BonusConfig(
    val streakEvery: Int = 3,
    val bonusPct: Double = 0.10,
    val bonusCap: Int = 250
)

data class PersistedGameState(
    val balance: Int = 10_000,
    val mode: GameMode = GameMode.FAIR,
    val fairDeckCount: Int = 1,
    val soundEnabled: Boolean = false,
    val zenMode: Boolean = false,
    val reducedMotion: Boolean = false,
    val streak: Int = 0,
    val lastBet: Int = 100,
    val borrowUsed: Boolean = false,
    val authEmail: String? = null,
    val authAccessToken: String? = null,
    val welcomeSeen: Boolean = false,
    val debugOpen: Boolean = false
)

data class UiToast(
    val message: String,
    val kind: ToastKind = ToastKind.INFO
)

enum class ToastKind { INFO, SUCCESS, ERROR, WARNING }
