package com.adamgoodwin.highlow.game

import kotlin.math.floor
import kotlin.math.min
import kotlin.random.Random

object GameEngine {
    private val suits = listOf("♠", "♥", "♦", "♣")
    val bonusConfig = BonusConfig()
    const val minBet = 10
    const val betStep = 10
    val quickBets = listOf(10, 50, 100, 500)
    const val shuffleThreshold = 10

    fun createDeck(deckCount: Int = 1): List<Card> =
        buildList {
            repeat(deckCount) { d ->
                suits.forEach { suit ->
                    (1..13).forEach { rank ->
                        add(Card(id = "$d-$suit-$rank-${size}", suit = suit, rank = rank))
                    }
                }
            }
        }

    fun shuffleDeck(deck: List<Card>, random: Random = Random.Default): List<Card> =
        deck.shuffled(random)

    private fun randomItem(cards: List<Card>, random: Random): Card = cards[random.nextInt(cards.size)]

    fun removeCard(deck: List<Card>, cardId: String): List<Card> = deck.filterNot { it.id == cardId }

    fun compareCards(current: Card, next: Card): Int = when {
        next.rank > current.rank -> 1
        next.rank < current.rank -> -1
        else -> 0
    }

    fun determineOutcome(choice: PlayerChoice, current: Card, next: Card): RoundOutcome {
        val cmp = compareCards(current, next)
        if (cmp == 0) return RoundOutcome.PUSH // Explicit tie behavior for MVP
        return when (choice) {
            PlayerChoice.HIGH -> if (cmp > 0) RoundOutcome.WIN else RoundOutcome.LOSS
            PlayerChoice.LOW -> if (cmp < 0) RoundOutcome.WIN else RoundOutcome.LOSS
        }
    }

    data class PayoutResult(val streak: Int, val bonus: Int, val profit: Int)

    fun resolvePayout(bet: Int, outcome: RoundOutcome, previousStreak: Int, config: BonusConfig = bonusConfig): PayoutResult {
        return when (outcome) {
            RoundOutcome.PUSH -> PayoutResult(previousStreak, 0, 0)
            RoundOutcome.LOSS -> PayoutResult(0, 0, -bet)
            RoundOutcome.WIN -> {
                val streak = previousStreak + 1
                val bonus = if (streak % config.streakEvery == 0) {
                    min(floor(bet * config.bonusPct).toInt(), config.bonusCap)
                } else 0
                PayoutResult(streak, bonus, bet + bonus)
            }
        }
    }

    data class DrawCurrentResult(val current: Card, val deck: List<Card>)

    fun drawCurrentCard(deck: List<Card>, mode: GameMode, random: Random = Random.Default): DrawCurrentResult {
        // Rigged modes avoid A/K as current card so HIGH/LOW can both be forceable.
        val eligible = if (mode == GameMode.FAIR) deck else deck.filter { it.rank in 2..12 }
        val source = if (eligible.isNotEmpty()) eligible else deck
        val card = randomItem(source, random)
        return DrawCurrentResult(card, removeCard(deck, card.id))
    }

    data class PickNextResult(
        val next: Card,
        val deck: List<Card>,
        val didReshuffle: Boolean,
        val riggedFallbackUsed: Boolean
    )

    fun pickNextCard(
        deck: List<Card>,
        current: Card,
        mode: GameMode,
        choice: PlayerChoice,
        deckCount: Int = 1,
        random: Random = Random.Default
    ): PickNextResult {
        if (mode == GameMode.FAIR) {
            val next = randomItem(deck, random)
            return PickNextResult(next, removeCard(deck, next.id), didReshuffle = false, riggedFallbackUsed = false)
        }

        val wantsHigher = (mode == GameMode.ALWAYS_WIN && choice == PlayerChoice.HIGH) ||
            (mode == GameMode.ALWAYS_LOSE && choice == PlayerChoice.LOW)
        val candidates = deck.filter { if (wantsHigher) it.rank > current.rank else it.rank < current.rank }
        if (candidates.isNotEmpty()) {
            val next = randomItem(candidates, random)
            return PickNextResult(next, removeCard(deck, next.id), didReshuffle = false, riggedFallbackUsed = false)
        }

        // Explicit fallback path for impossible deck states in rigged modes: reshuffle and try to force again.
        val reshuffled = shuffleDeck(removeCard(createDeck(deckCount), current.id), random)
        val forced = reshuffled.filter { if (wantsHigher) it.rank > current.rank else it.rank < current.rank }
        if (forced.isNotEmpty()) {
            val next = randomItem(forced, random)
            return PickNextResult(next, removeCard(reshuffled, next.id), didReshuffle = true, riggedFallbackUsed = false)
        }

        // Final fallback (should be unreachable with non-edge current-card guard). Avoid ties if possible.
        val nonTie = reshuffled.filter { it.rank != current.rank }
        val next = randomItem(if (nonTie.isNotEmpty()) nonTie else reshuffled, random)
        return PickNextResult(next, removeCard(reshuffled, next.id), didReshuffle = true, riggedFallbackUsed = true)
    }

    fun modeLabel(mode: GameMode): String = when (mode) {
        GameMode.FAIR -> "Fair"
        GameMode.ALWAYS_WIN -> "Demo: Always Win"
        GameMode.ALWAYS_LOSE -> "Chaos: Always Lose"
    }

    fun rankLabel(rank: Int): String = when (rank) {
        1 -> "A"
        11 -> "J"
        12 -> "Q"
        13 -> "K"
        else -> rank.toString()
    }
}
