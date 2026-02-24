package com.adamgoodwin.highlow

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.adamgoodwin.highlow.audio.SoundPlayer
import com.adamgoodwin.highlow.auth.SupabaseAuthClient
import com.adamgoodwin.highlow.auth.SupabaseGameProfileClient
import com.adamgoodwin.highlow.data.GamePrefs
import com.adamgoodwin.highlow.game.Card
import com.adamgoodwin.highlow.game.GameEngine
import com.adamgoodwin.highlow.game.GameMode
import com.adamgoodwin.highlow.game.GamePhase
import com.adamgoodwin.highlow.game.PersistedGameState
import com.adamgoodwin.highlow.game.PlayerChoice
import com.adamgoodwin.highlow.game.RoundRecord
import com.adamgoodwin.highlow.game.ToastKind
import com.adamgoodwin.highlow.game.UiToast
import kotlinx.coroutines.delay
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.launch
import kotlin.math.max

class HighLowViewModel(app: Application) : AndroidViewModel(app) {
    private data class SessionGoal(
        val label: String,
        val targetLabel: String,
        val target: Int,
        val progressOf: (roundsPlayed: Int, wins: Int, streak: Int) -> Int
    )

    private val sessionGoals = listOf(
        SessionGoal("Play 10 rounds", "10 rounds", 10) { roundsPlayed, _, _ -> roundsPlayed },
        SessionGoal("Win 3 hands", "3 wins", 3) { _, wins, _ -> wins },
        SessionGoal("Reach a 3-win streak", "3 streak", 3) { _, _, currentStreak -> currentStreak }
    )

    private val prefs = GamePrefs(app)
    private val soundPlayer = SoundPlayer()
    private val authClient = SupabaseAuthClient()
    private val cloudClient = SupabaseGameProfileClient()
    private var cloudSaveJob: Job? = null

    private var deck: List<Card> = emptyList()

    var balance by mutableStateOf(10_000)
        private set
    var mode by mutableStateOf(GameMode.FAIR)
        private set
    var fairDeckCount by mutableStateOf(1)
        private set
    var soundEnabled by mutableStateOf(false)
        private set
    var zenMode by mutableStateOf(false)
        private set
    var reducedMotion by mutableStateOf(false)
        private set
    var streak by mutableStateOf(0)
        private set
    var bet by mutableStateOf(100)
        private set
    var borrowUsed by mutableStateOf(false)
        private set
    var authEmail by mutableStateOf<String?>(null)
        private set
    var authAccessToken by mutableStateOf<String?>(null)
        private set
    var authBusy by mutableStateOf(false)
        private set
    var welcomeSeen by mutableStateOf(false)
        private set
    var debugOpen by mutableStateOf(false)
        private set
    var sessionRoundsPlayed by mutableStateOf(0)
        private set
    var sessionWins by mutableStateOf(0)
        private set
    var sessionGoalIndex by mutableStateOf(0)
        private set
    private var lastGoalCompletionRound by mutableStateOf(-1)

    var currentCard by mutableStateOf<Card?>(null)
        private set
    var revealCard by mutableStateOf<Card?>(null)
        private set
    var phase by mutableStateOf(GamePhase.IDLE)
        private set
    var lastRound by mutableStateOf<RoundRecord?>(null)
        private set
    var pendingChoice by mutableStateOf<PlayerChoice?>(null)
        private set

    val roundHistory = mutableStateListOf<RoundRecord>()

    private val _toasts = MutableSharedFlow<UiToast>(extraBufferCapacity = 12)
    val toasts = _toasts.asSharedFlow()

    init {
        val saved = prefs.load()
        applyPersisted(saved)
        val start = GameEngine.drawCurrentCard(GameEngine.shuffleDeck(GameEngine.createDeck(fairDeckCount)), mode)
        deck = start.deck
        currentCard = start.current
        phase = if (bet >= GameEngine.minBet) GamePhase.READY else GamePhase.IDLE
        if (isSignedIn && isSupabaseConfigured) {
            restoreCloudProgressOnLaunch()
        }

        if (!welcomeSeen) {
            emitToast("Welcome. Start with 10,000 chips and take your time.", ToastKind.INFO)
            welcomeSeen = true
            persist()
        }
    }

    val canPlay: Boolean
        get() = currentCard != null && balance > 0 && bet in GameEngine.minBet..balance && phase != GamePhase.REVEALING

    val canChooseHigh: Boolean
        get() = canPlay && currentCard?.rank != 13

    val canChooseLow: Boolean
        get() = canPlay && currentCard?.rank != 1
    val needsRecovery: Boolean
        get() = balance < GameEngine.minBet
    val canBorrow: Boolean
        get() = needsRecovery && !borrowUsed
    val hasSessionActivity: Boolean
        get() = roundHistory.isNotEmpty() || balance != 10_000 || streak > 0 || borrowUsed
    val isSupabaseConfigured: Boolean
        get() = authClient.isConfigured()
    val isSignedIn: Boolean
        get() = !authAccessToken.isNullOrBlank() && !authEmail.isNullOrBlank()
    val audioEnabled: Boolean
        get() = soundEnabled && !zenMode

    val activeSessionGoalLabel: String
        get() = sessionGoals[sessionGoalIndex % sessionGoals.size].label
    val activeSessionGoalTargetLabel: String
        get() = sessionGoals[sessionGoalIndex % sessionGoals.size].targetLabel
    val activeSessionGoalTarget: Int
        get() = sessionGoals[sessionGoalIndex % sessionGoals.size].target
    val activeSessionGoalProgress: Int
        get() {
            val goal = sessionGoals[sessionGoalIndex % sessionGoals.size]
            return goal.progressOf(sessionRoundsPlayed, sessionWins, streak).coerceAtMost(goal.target)
        }
    val activeSessionGoalPercent: Int
        get() = ((activeSessionGoalProgress * 100f) / activeSessionGoalTarget).toInt().coerceIn(0, 100)

    val lastResultText: String
        get() = when (lastRound?.outcome) {
            null -> "Last: —"
            com.adamgoodwin.highlow.game.RoundOutcome.WIN -> "Last: Win"
            com.adamgoodwin.highlow.game.RoundOutcome.LOSS -> "Last: Loss"
            com.adamgoodwin.highlow.game.RoundOutcome.PUSH -> "Last: Push"
        }

    fun updateBet(value: Int) {
        soundPlayer.playClick(audioEnabled)
        bet = value.coerceIn(0, max(0, balance))
        if (phase != GamePhase.REVEALING) {
            phase = if (currentCard != null && bet >= GameEngine.minBet) GamePhase.READY else GamePhase.IDLE
        }
        persist()
    }

    fun addBet(delta: Int) = updateBet(bet + delta)

    fun setMaxBet() = updateBet(balance)
    fun clearBet() = updateBet(0)

    fun changeMode(nextMode: GameMode) {
        mode = nextMode
        emitToast("Mode: ${GameEngine.modeLabel(nextMode)}", ToastKind.INFO)
        val prepared = drawNewCurrent(nextMode, deck)
        deck = prepared.second
        currentCard = prepared.first
        revealCard = null
        phase = if (bet >= GameEngine.minBet) GamePhase.READY else GamePhase.IDLE
        persist()
    }

    fun changeFairDeckCount(count: Int) {
        val nextCount = count.coerceIn(1, 3)
        fairDeckCount = nextCount
        emitToast("Fair mode shoe: $nextCount deck" + if (nextCount > 1) "s" else "", ToastKind.INFO)
        val fresh = GameEngine.shuffleDeck(GameEngine.createDeck(fairDeckCount))
        val start = GameEngine.drawCurrentCard(fresh, mode)
        deck = start.deck
        currentCard = start.current
        revealCard = null
        pendingChoice = null
        phase = if (bet >= GameEngine.minBet) GamePhase.READY else GamePhase.IDLE
        persist()
    }

    fun changeSoundEnabled(value: Boolean) {
        soundEnabled = value
        persist()
    }

    fun changeZenMode(value: Boolean) {
        zenMode = value
        persist()
    }

    fun changeReducedMotion(value: Boolean) {
        reducedMotion = value
        persist()
    }

    fun toggleDebug() {
        debugOpen = !debugOpen
        persist()
    }

    fun resetTable() {
        balance = 10_000
        streak = 0
        bet = 100
        borrowUsed = false
        sessionRoundsPlayed = 0
        sessionWins = 0
        sessionGoalIndex = 0
        lastGoalCompletionRound = -1
        lastRound = null
        revealCard = null
        pendingChoice = null
        roundHistory.clear()
        val start = GameEngine.drawCurrentCard(GameEngine.shuffleDeck(GameEngine.createDeck(fairDeckCount)), mode)
        deck = start.deck
        currentCard = start.current
        phase = GamePhase.READY
        emitToast("Table reset", ToastKind.INFO)
        persist()
    }

    fun borrowChipsOnce() {
        if (!canBorrow) return
        balance += 5_000
        borrowUsed = true
        if (bet < GameEngine.minBet) bet = 100
        phase = GamePhase.READY
        emitToast("House credit added: +5,000 chips (one-time borrow)", ToastKind.INFO)
        persist()
    }

    fun signInWithEmailPassword(email: String, password: String) {
        if (authBusy) return
        val cleanEmail = email.trim()
        if (cleanEmail.isBlank() || password.isBlank()) {
            emitToast("Enter email and password", ToastKind.WARNING)
            return
        }
        authBusy = true
        viewModelScope.launch {
            val result = authClient.signIn(cleanEmail, password)
            if (result.success) {
                authEmail = result.email ?: cleanEmail
                authAccessToken = result.accessToken
                persist(pushCloud = false)
                syncCloudAfterAuth(result.message)
            } else {
                authBusy = false
                emitToast(result.message, ToastKind.ERROR)
            }
        }
    }

    fun createAccountWithEmailPassword(email: String, password: String) {
        if (authBusy) return
        val cleanEmail = email.trim()
        if (cleanEmail.isBlank() || password.isBlank()) {
            emitToast("Enter email and password", ToastKind.WARNING)
            return
        }
        authBusy = true
        viewModelScope.launch {
            val result = authClient.signUp(cleanEmail, password)
            if (result.success) {
                if (!result.email.isNullOrBlank()) authEmail = result.email
                if (!result.accessToken.isNullOrBlank()) authAccessToken = result.accessToken
                if (!result.accessToken.isNullOrBlank()) {
                    persist(pushCloud = false)
                    syncCloudAfterAuth(result.message)
                } else {
                    authBusy = false
                    emitToast(result.message, ToastKind.INFO)
                    persist(pushCloud = false)
                }
            } else {
                authBusy = false
                emitToast(result.message, ToastKind.ERROR)
            }
        }
    }

    fun sendMagicLink(email: String) {
        if (authBusy) return
        val cleanEmail = email.trim()
        if (cleanEmail.isBlank()) {
            emitToast("Enter your email first", ToastKind.WARNING)
            return
        }
        authBusy = true
        viewModelScope.launch {
            val result = authClient.sendMagicLink(cleanEmail)
            authBusy = false
            emitToast(result.message, if (result.success) ToastKind.INFO else ToastKind.ERROR)
        }
    }

    fun signOutAccount() {
        val token = authAccessToken
        cloudSaveJob?.cancel()
        if (authBusy || token.isNullOrBlank()) {
            authAccessToken = null
            authEmail = null
            persist()
            return
        }
        authBusy = true
        viewModelScope.launch {
            val result = authClient.signOut(token)
            authBusy = false
            authAccessToken = null
            authEmail = null
            persist()
            emitToast(
                if (result.success) "Signed out" else "Signed out locally",
                ToastKind.INFO
            )
        }
    }

    fun choose(choice: PlayerChoice) {
        val current = currentCard ?: return
        if (!canPlay) return
        if ((choice == PlayerChoice.HIGH && current.rank == 13) || (choice == PlayerChoice.LOW && current.rank == 1)) {
            emitToast(
                if (choice == PlayerChoice.HIGH) "HIGH unavailable on a King" else "LOW unavailable on an Ace",
                ToastKind.WARNING
            )
            return
        }
        if (deck.isEmpty()) {
            reshuffleDeckToast()
            return
        }

        soundPlayer.playFlip(audioEnabled)
        pendingChoice = choice
        phase = GamePhase.CHOICE

        val pick = GameEngine.pickNextCard(deck, current, mode, choice, deckCount = fairDeckCount)
        if (pick.didReshuffle) emitToast("Shuffling…", ToastKind.INFO)
        val next = pick.next
        val outcome = GameEngine.determineOutcome(choice, current, next)
        val payout = GameEngine.resolvePayout(bet, outcome, streak)
        val nextBalance = (balance + payout.profit).coerceAtLeast(0)

        val round = RoundRecord(
            current = current,
            next = next,
            choice = choice,
            outcome = outcome,
            bet = bet,
            profit = payout.profit,
            bonus = payout.bonus,
            mode = mode
        )

        revealCard = next
        phase = GamePhase.REVEALING

        viewModelScope.launch {
            val revealDelay = when {
                reducedMotion || zenMode -> 500L
                else -> 700L
            }
            val nextRoundDelay = when {
                reducedMotion -> 80L
                zenMode -> 560L
                else -> 750L
            }
            delay(revealDelay)

            phase = GamePhase.RESULT
            lastRound = round
            roundHistory.add(0, round)
            while (roundHistory.size > 12) roundHistory.removeAt(roundHistory.lastIndex)
            balance = nextBalance
            streak = payout.streak
            sessionRoundsPlayed += 1
            if (outcome == com.adamgoodwin.highlow.game.RoundOutcome.WIN) {
                sessionWins += 1
            }
            maybeAdvanceMiniGoal()
            persist()

            when (outcome) {
                com.adamgoodwin.highlow.game.RoundOutcome.WIN -> {
                    soundPlayer.playWin(audioEnabled)
                    emitToast(
                        if (payout.bonus > 0) "Nice hit! +${payout.profit} (bonus)" else "Win! +${payout.profit}",
                        ToastKind.SUCCESS
                    )
                    if (payout.streak in setOf(3, 5, 10)) {
                        emitToast("Nice run: ${payout.streak}-win streak", ToastKind.INFO)
                    }
                }
                com.adamgoodwin.highlow.game.RoundOutcome.LOSS -> {
                    soundPlayer.playLoss(audioEnabled)
                    emitToast("Ouch! -$bet", ToastKind.ERROR)
                }
                com.adamgoodwin.highlow.game.RoundOutcome.PUSH -> {
                    soundPlayer.playPush(audioEnabled)
                    emitToast("Push (tie), bet returned", ToastKind.WARNING)
                }
            }

            delay(nextRoundDelay)
            startNextRound(pick.deck, nextBalance, next)
        }
    }

    private fun startNextRound(workingDeck: List<Card>, nextBalance: Int, nextCurrent: Card) {
        val checkedDeck = ensureDeck(workingDeck, nextCurrent)
        deck = checkedDeck
        currentCard = nextCurrent
        revealCard = null
        pendingChoice = null
        bet = bet.coerceIn(0, max(0, nextBalance))
        phase = if (nextBalance > 0 && bet >= GameEngine.minBet) GamePhase.READY else GamePhase.IDLE
        persist()
    }

    private fun reshuffleDeckToast() {
        val currentId = currentCard?.id
        val shuffled = GameEngine.shuffleDeck(GameEngine.createDeck(fairDeckCount)).let { fresh ->
            if (currentId == null) fresh else fresh.filterNot { it.id == currentId }
        }
        deck = shuffled
        emitToast("Shuffling…", ToastKind.INFO)
    }

    private fun ensureDeck(workingDeck: List<Card>, currentToExclude: Card? = null): List<Card> {
        if (workingDeck.size >= GameEngine.shuffleThreshold) return workingDeck
        emitToast("Shuffling…", ToastKind.INFO)
        var fresh = GameEngine.shuffleDeck(GameEngine.createDeck(fairDeckCount))
        if (currentToExclude != null) {
            fresh = fresh.filterNot { it.id == currentToExclude.id }
        }
        return fresh
    }

    private fun drawNewCurrent(modeToUse: GameMode, workingDeck: List<Card>): Pair<Card, List<Card>> {
        var sourceDeck = workingDeck
        if (sourceDeck.size < GameEngine.shuffleThreshold) {
            sourceDeck = GameEngine.shuffleDeck(GameEngine.createDeck(fairDeckCount))
            emitToast("Shuffling…", ToastKind.INFO)
        }
        val drawn = GameEngine.drawCurrentCard(sourceDeck, modeToUse)
        return drawn.current to drawn.deck
    }

    private fun applyPersisted(saved: PersistedGameState) {
        balance = saved.balance
        mode = saved.mode
        fairDeckCount = saved.fairDeckCount.coerceIn(1, 3)
        soundEnabled = saved.soundEnabled
        zenMode = saved.zenMode
        reducedMotion = saved.reducedMotion
        streak = saved.streak
        bet = saved.lastBet
        borrowUsed = saved.borrowUsed
        authEmail = saved.authEmail
        authAccessToken = saved.authAccessToken
        welcomeSeen = saved.welcomeSeen
        debugOpen = saved.debugOpen
    }

    private fun currentPersistedState(): PersistedGameState {
        return PersistedGameState(
            balance = balance,
            mode = mode,
            fairDeckCount = fairDeckCount,
            soundEnabled = soundEnabled,
            zenMode = zenMode,
            reducedMotion = reducedMotion,
            streak = streak,
            lastBet = bet,
            borrowUsed = borrowUsed,
            authEmail = authEmail,
            authAccessToken = authAccessToken,
            welcomeSeen = welcomeSeen,
            debugOpen = debugOpen
        )
    }

    private fun persist(pushCloud: Boolean = true) {
        prefs.save(currentPersistedState())
        if (pushCloud) queueCloudSave()
    }

    private fun restoreCloudProgressOnLaunch() {
        viewModelScope.launch {
            loadCloudProgress(seedCloudIfMissing = false, showLoadedToast = true)
        }
    }

    private suspend fun syncCloudAfterAuth(authMessage: String) {
        val hadRemote = loadCloudProgress(seedCloudIfMissing = true, showLoadedToast = false)
        authBusy = false
        emitToast(
            if (hadRemote) "$authMessage. Cloud progress loaded." else "$authMessage. Cloud sync ready.",
            ToastKind.SUCCESS
        )
    }

    private suspend fun loadCloudProgress(seedCloudIfMissing: Boolean, showLoadedToast: Boolean): Boolean {
        val token = authAccessToken
        if (token.isNullOrBlank() || !cloudClient.isConfigured()) return false

        val result = cloudClient.loadGameState(token)
        if (!result.success) {
            emitToast("Cloud sync error: ${result.message}", ToastKind.WARNING)
            return false
        }

        val remote = result.state
        if (remote != null) {
            applyCloudState(remote)
            persist(pushCloud = false)
            if (showLoadedToast) emitToast("Cloud progress loaded", ToastKind.INFO)
            return true
        }

        if (seedCloudIfMissing) {
            val save = cloudClient.saveGameState(token, currentPersistedState())
            if (!save.success) {
                emitToast("Cloud save error: ${save.message}", ToastKind.WARNING)
            }
        }
        return false
    }

    private fun applyCloudState(remote: PersistedGameState) {
        val keepAuthEmail = authEmail
        val keepAuthToken = authAccessToken
        applyPersisted(
            remote.copy(
                authEmail = keepAuthEmail,
                authAccessToken = keepAuthToken
            )
        )

        // Current/reveal cards and deck are local session details. Rebuild a fresh round using the loaded settings.
        revealCard = null
        pendingChoice = null
        lastRound = null
        roundHistory.clear()
        val start = GameEngine.drawCurrentCard(GameEngine.shuffleDeck(GameEngine.createDeck(fairDeckCount)), mode)
        deck = start.deck
        currentCard = start.current
        phase = if (balance > 0 && bet >= GameEngine.minBet) GamePhase.READY else GamePhase.IDLE
    }

    private fun queueCloudSave() {
        val token = authAccessToken
        if (token.isNullOrBlank() || !cloudClient.isConfigured()) return
        val snapshot = currentPersistedState()
        cloudSaveJob?.cancel()
        cloudSaveJob = viewModelScope.launch {
            delay(500)
            cloudClient.saveGameState(token, snapshot)
        }
    }

    private fun emitToast(message: String, kind: ToastKind = ToastKind.INFO) {
        _toasts.tryEmit(UiToast(message, kind))
    }

    private fun maybeAdvanceMiniGoal() {
        val goal = sessionGoals[sessionGoalIndex % sessionGoals.size]
        val progress = goal.progressOf(sessionRoundsPlayed, sessionWins, streak)
        if (progress < goal.target) return
        if (lastGoalCompletionRound == sessionRoundsPlayed) return
        lastGoalCompletionRound = sessionRoundsPlayed
        emitToast("Mini goal complete: ${goal.label}", ToastKind.INFO)
        sessionGoalIndex = (sessionGoalIndex + 1) % sessionGoals.size
    }
}
