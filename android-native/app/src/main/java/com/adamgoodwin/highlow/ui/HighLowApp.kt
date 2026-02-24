@file:OptIn(
    androidx.compose.foundation.layout.ExperimentalLayoutApi::class,
    androidx.compose.material3.ExperimentalMaterial3Api::class
)

package com.adamgoodwin.highlow.ui

import android.content.Intent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ElevatedButton
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarDuration
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.draw.rotate
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.adamgoodwin.highlow.HighLowViewModel
import com.adamgoodwin.highlow.game.GameEngine
import com.adamgoodwin.highlow.game.GameMode
import com.adamgoodwin.highlow.game.GamePhase
import com.adamgoodwin.highlow.game.PlayerChoice
import com.adamgoodwin.highlow.game.RoundOutcome
import kotlinx.coroutines.flow.collectLatest

@Composable
fun HighLowApp(viewModel: HighLowViewModel) {
    HighLowTheme {
        val context = LocalContext.current
        val snackbarHostState = remember { SnackbarHostState() }
        var settingsOpen by remember { mutableStateOf(false) }
        var authSheetOpen by remember { mutableStateOf(false) }
        var authEmailInput by remember { mutableStateOf(viewModel.authEmail.orEmpty()) }
        var authPasswordInput by remember { mutableStateOf("") }

        LaunchedEffect(viewModel) {
            viewModel.toasts.collectLatest { toast ->
                val prefix = when (toast.kind) {
                    com.adamgoodwin.highlow.game.ToastKind.SUCCESS -> "WIN"
                    com.adamgoodwin.highlow.game.ToastKind.ERROR -> "OUCH"
                    com.adamgoodwin.highlow.game.ToastKind.WARNING -> "PUSH"
                    else -> "INFO"
                }
                snackbarHostState.showSnackbar(
                    message = "$prefix: ${toast.message}",
                    withDismissAction = false,
                    duration = SnackbarDuration.Short
                )
            }
        }

        LaunchedEffect(viewModel.isSignedIn) {
            if (viewModel.isSignedIn) {
                authSheetOpen = false
                authPasswordInput = ""
            }
        }

        if (settingsOpen) {
            ModalBottomSheet(
                onDismissRequest = { settingsOpen = false },
                containerColor = MaterialTheme.colorScheme.surface
            ) {
                SettingsSheet(
                    mode = viewModel.mode,
                    fairDeckCount = viewModel.fairDeckCount,
                    soundEnabled = viewModel.soundEnabled,
                    zenMode = viewModel.zenMode,
                    reducedMotion = viewModel.reducedMotion,
                    onModeChange = viewModel::changeMode,
                    onFairDeckCountChange = viewModel::changeFairDeckCount,
                    onSoundChange = viewModel::changeSoundEnabled,
                    onZenModeChange = viewModel::changeZenMode,
                    onReducedMotionChange = viewModel::changeReducedMotion,
                    onClose = { settingsOpen = false }
                )
            }
        }

        if (authSheetOpen && viewModel.isSupabaseConfigured && !viewModel.isSignedIn) {
            ModalBottomSheet(
                onDismissRequest = { if (!viewModel.authBusy) authSheetOpen = false },
                containerColor = MaterialTheme.colorScheme.surface
            ) {
                AuthSheet(
                    authBusy = viewModel.authBusy,
                    email = authEmailInput,
                    password = authPasswordInput,
                    onEmailChange = { authEmailInput = it },
                    onPasswordChange = { authPasswordInput = it },
                    onSignIn = { viewModel.signInWithEmailPassword(authEmailInput, authPasswordInput) },
                    onCreateAccount = { viewModel.createAccountWithEmailPassword(authEmailInput, authPasswordInput) },
                    onSendMagicLink = { viewModel.sendMagicLink(authEmailInput) },
                    onClose = { if (!viewModel.authBusy) authSheetOpen = false }
                )
            }
        }

        Scaffold(
            modifier = Modifier.fillMaxSize(),
            topBar = {
                TopAppBar(
                    colors = TopAppBarDefaults.topAppBarColors(
                        containerColor = Color.Transparent,
                        titleContentColor = MaterialTheme.colorScheme.onBackground
                    ),
                    title = {
                        Column {
                            Text("Vegas-Style High / Low", fontWeight = FontWeight.Black)
                            Text(
                                "Chips have no cash value. No cash out. No prizes.",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f)
                            )
                        }
                    },
                    actions = {
                        TextButton(onClick = viewModel::toggleDebug) {
                            Text(if (viewModel.debugOpen) "Hide Debug" else "Debug")
                        }
                        IconButtonLike(onClick = { settingsOpen = true }) {
                            Icon(Icons.Default.Settings, contentDescription = "Settings")
                        }
                    }
                )
            },
            snackbarHost = { SnackbarHost(snackbarHostState) },
            containerColor = Color(0xFF05070F)
        ) { padding ->
            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .background(
                        Brush.verticalGradient(
                            listOf(Color(0xFF101329), Color(0xFF05070F), Color(0xFF06060D))
                        )
                    )
                    .padding(padding)
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                ModeAndStatusChips(
                    modeLabel = GameEngine.modeLabel(viewModel.mode),
                    streak = viewModel.streak,
                    lastResultText = viewModel.lastResultText
                )

                BalanceCard(balance = viewModel.balance)

                AuthCard(
                    isConfigured = viewModel.isSupabaseConfigured,
                    isSignedIn = viewModel.isSignedIn,
                    signedInEmail = viewModel.authEmail,
                    authBusy = viewModel.authBusy,
                    onOpenAuth = { authSheetOpen = true },
                    onSignOut = viewModel::signOutAccount,
                    onShare = {
                        val intent = Intent(Intent.ACTION_SEND).apply {
                            type = "text/plain"
                            putExtra(Intent.EXTRA_SUBJECT, "Try this High / Low game")
                            putExtra(Intent.EXTRA_TEXT, "Play this Vegas-style High / Low game: https://highlowgame.vercel.app")
                        }
                        context.startActivity(Intent.createChooser(intent, "Share app"))
                    }
                )

                MiniGoalCard(
                    label = viewModel.activeSessionGoalLabel,
                    targetLabel = viewModel.activeSessionGoalTargetLabel,
                    progress = viewModel.activeSessionGoalProgress,
                    target = viewModel.activeSessionGoalTarget,
                    percent = viewModel.activeSessionGoalPercent
                )

                GameCardsArea(
                    currentCard = viewModel.currentCard,
                    revealCard = viewModel.revealCard,
                    phase = viewModel.phase,
                    reducedMotion = viewModel.reducedMotion || viewModel.zenMode,
                    lastOutcome = viewModel.lastRound?.outcome
                )

                HighLowButtons(
                    canChooseHigh = viewModel.canChooseHigh,
                    canChooseLow = viewModel.canChooseLow,
                    onChooseHigh = { viewModel.choose(PlayerChoice.HIGH) },
                    onChooseLow = { viewModel.choose(PlayerChoice.LOW) }
                )

                if (!viewModel.canPlay) {
                    Text(
                        "Take your time. Place a valid bet (minimum 10 chips) to enable HIGH/LOW.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f)
                    )
                }
                if (viewModel.canPlay && viewModel.currentCard?.rank == 1) {
                    EdgeHandNotice("Ace is low (A=1), so LOW is unavailable on this hand.")
                }
                if (viewModel.canPlay && viewModel.currentCard?.rank == 13) {
                    EdgeHandNotice("King is highest (K=13), so HIGH is unavailable on this hand.")
                }

                ResultBanner(viewModel.lastRound)

                BetControls(
                    balance = viewModel.balance,
                    bet = viewModel.bet,
                    onQuickBet = viewModel::updateBet,
                    onAddBet = viewModel::addBet,
                    onSetBetText = { raw -> viewModel.updateBet(raw.toIntOrNull() ?: 0) },
                    onMax = viewModel::setMaxBet,
                    onClear = viewModel::clearBet
                )

                if (viewModel.needsRecovery) {
                    RecoveryCard(
                        minBet = GameEngine.minBet,
                        canBorrow = viewModel.canBorrow,
                        onBorrow = viewModel::borrowChipsOnce,
                        onNewGame = viewModel::resetTable
                    )
                }

                QuickHelpCard()

                AnimatedVisibility(visible = viewModel.debugOpen) {
                    DebugCard(viewModel = viewModel)
                }

                DisclaimerFooter()
            }
        }
    }
}

@Composable
private fun IconButtonLike(onClick: () -> Unit, content: @Composable RowScope.() -> Unit) {
    TextButton(onClick = onClick, content = content)
}

@Composable
private fun ModeAndStatusChips(modeLabel: String, streak: Int, lastResultText: String) {
    FlowRow(
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        StatusChip(modeLabel, accent = Color(0xFF62F3FF))
        StatusChip("Streak $streak", accent = Color(0xFFB7FF4A))
        StatusChip(lastResultText, accent = Color(0xFFFFD666))
        StatusChip("Aces are low (A = 1)", accent = Color(0xFFFFD666))
    }
}

@Composable
private fun StatusChip(text: String, accent: Color) {
    Surface(
        shape = RoundedCornerShape(999.dp),
        color = accent.copy(alpha = 0.12f),
        tonalElevation = 0.dp,
        border = androidx.compose.foundation.BorderStroke(1.dp, accent.copy(alpha = 0.24f))
    ) {
        Text(
            text = text,
            modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurface
        )
    }
}

@Composable
private fun BalanceCard(balance: Int) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0x24FFD666)),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x66FFD666))
    ) {
        Column(Modifier.fillMaxWidth().padding(16.dp)) {
            Text("Chip Balance", color = Color(0xFFFFE8A8), style = MaterialTheme.typography.labelSmall)
            Text(
                chips(balance),
                fontWeight = FontWeight.Black,
                fontSize = 34.sp,
                color = Color(0xFFFFF3CF)
            )
        }
    }
}

@Composable
private fun MiniGoalCard(
    label: String,
    targetLabel: String,
    progress: Int,
    target: Int,
    percent: Int
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.04f)),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.12f))
    ) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Mini Goal (Optional)", style = MaterialTheme.typography.labelMedium, color = Color.White.copy(alpha = 0.75f))
                Text("$progress/$target", style = MaterialTheme.typography.labelMedium, color = Color.White.copy(alpha = 0.75f))
            }
            Text(label, fontWeight = FontWeight.SemiBold)
            Text("A small focus target for a quick mental break.", style = MaterialTheme.typography.bodySmall, color = Color.White.copy(alpha = 0.7f))
            LinearProgressIndicator(
                progress = { percent / 100f },
                modifier = Modifier.fillMaxWidth().height(8.dp).clip(RoundedCornerShape(999.dp)),
                color = Color(0xFF62F3FF),
                trackColor = Color.White.copy(alpha = 0.08f)
            )
            Text("Target: $targetLabel", style = MaterialTheme.typography.labelSmall, color = Color.White.copy(alpha = 0.65f))
        }
    }
}

@Composable
private fun GameCardsArea(
    currentCard: com.adamgoodwin.highlow.game.Card?,
    revealCard: com.adamgoodwin.highlow.game.Card?,
    phase: GamePhase,
    reducedMotion: Boolean,
    lastOutcome: RoundOutcome?
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
            Box(modifier = Modifier.weight(1f)) {
                Column {
                    Text("CURRENT", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                    Spacer(Modifier.height(6.dp))
                    CardFace(card = currentCard, hidden = false, outcome = null, reducedMotion = reducedMotion)
                }
            }
            Box(modifier = Modifier.weight(1f)) {
                Column {
                    Text("NEXT", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.7f))
                    Spacer(Modifier.height(6.dp))
                    CardFace(
                        card = if (phase == GamePhase.REVEALING || phase == GamePhase.RESULT) revealCard else null,
                        hidden = phase != GamePhase.REVEALING && phase != GamePhase.RESULT,
                        outcome = if (phase == GamePhase.RESULT) lastOutcome else null,
                        reducedMotion = reducedMotion
                    )
                }
            }
        }
    }
}

@Composable
private fun CardFace(
    card: com.adamgoodwin.highlow.game.Card?,
    hidden: Boolean,
    outcome: RoundOutcome?,
    reducedMotion: Boolean
) {
    val targetScaleX = if (hidden) 1f else -1f
    val scaleX by animateFloatAsState(
        targetValue = targetScaleX,
        animationSpec = tween(if (reducedMotion) 0 else 650),
        label = "cardFlipScaleX"
    )
    val borderColor = when (outcome) {
        RoundOutcome.WIN -> Color(0xAA8CFF9D)
        RoundOutcome.LOSS -> Color(0xAAFF8C8C)
        else -> Color.White.copy(alpha = 0.15f)
    }

    Surface(
        modifier = Modifier
            .fillMaxWidth()
            .height(180.dp)
            .graphicsLayer {
                this.scaleX = scaleX
            },
        shape = RoundedCornerShape(18.dp),
        color = Color.White.copy(alpha = 0.05f),
        border = androidx.compose.foundation.BorderStroke(1.dp, borderColor)
    ) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            if (hidden) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("Reveal", color = Color(0xFF62F3FF), fontWeight = FontWeight.Bold)
                    Text("Tap HIGH or LOW", color = Color.White.copy(alpha = 0.65f), style = MaterialTheme.typography.bodySmall)
                }
            } else if (card != null) {
                val red = card.suit == "♥" || card.suit == "♦"
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    modifier = Modifier.graphicsLayer {
                        // Counter-flip the face content so it remains readable after the container flip.
                        this.scaleX = -1f
                    }
                ) {
                    Text(
                        GameEngine.rankLabel(card.rank),
                        fontSize = 52.sp,
                        fontWeight = FontWeight.Black,
                        color = if (red) Color(0xFFFFB2C6) else Color.White
                    )
                    Text(card.suit, fontSize = 28.sp, color = if (red) Color(0xFFFF8CAB) else Color.White)
                    Text("Rank ${card.rank}", color = Color.White.copy(alpha = 0.7f), style = MaterialTheme.typography.bodySmall)
                }
            } else {
                Text("Loading…", color = Color.White.copy(alpha = 0.7f))
            }
        }
    }
}

@Composable
private fun HighLowButtons(
    canChooseHigh: Boolean,
    canChooseLow: Boolean,
    onChooseHigh: () -> Unit,
    onChooseLow: () -> Unit
) {
    Row(horizontalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.fillMaxWidth()) {
        ChoiceButton(
            label = "HIGH",
            enabled = canChooseHigh,
            accent = Color(0xFF62F3FF),
            onClick = onChooseHigh,
            modifier = Modifier.weight(1f)
        )
        ChoiceButton(
            label = "LOW",
            enabled = canChooseLow,
            accent = Color(0xFFFF4FD8),
            onClick = onChooseLow,
            modifier = Modifier.weight(1f)
        )
    }
}

@Composable
private fun ChoiceButton(label: String, enabled: Boolean, accent: Color, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Button(
        onClick = onClick,
        enabled = enabled,
        modifier = modifier.height(78.dp),
        shape = RoundedCornerShape(20.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = if (enabled) accent.copy(alpha = 0.15f) else Color.White.copy(alpha = 0.06f),
            contentColor = if (enabled) Color.White else Color.White.copy(alpha = 0.45f),
            disabledContainerColor = Color.White.copy(alpha = 0.06f),
            disabledContentColor = Color.White.copy(alpha = 0.45f)
        ),
        border = androidx.compose.foundation.BorderStroke(1.dp, if (enabled) accent.copy(alpha = 0.35f) else Color.White.copy(alpha = 0.15f))
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(label, fontWeight = FontWeight.Black, fontSize = 22.sp)
                if (!enabled) Icon(Icons.Default.Lock, contentDescription = null, modifier = Modifier.size(16.dp))
            }
            if (!enabled) {
                Text("Unavailable", style = MaterialTheme.typography.labelSmall, color = Color.White.copy(alpha = 0.7f))
            }
        }
    }
}

@Composable
private fun EdgeHandNotice(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.bodySmall,
        color = Color(0xFFFFE8A8),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0x22FFD666))
            .border(1.dp, Color(0x33FFD666), RoundedCornerShape(12.dp))
            .padding(10.dp)
    )
}

@Composable
private fun ResultBanner(lastRound: com.adamgoodwin.highlow.game.RoundRecord?) {
    val outcome = lastRound?.outcome
    val border = when (outcome) {
        RoundOutcome.WIN -> Color(0x338CFF9D)
        RoundOutcome.LOSS -> Color(0x33FF8C8C)
        RoundOutcome.PUSH -> Color(0x33FFE28F)
        null -> Color.White.copy(alpha = 0.12f)
    }
    val container = when (outcome) {
        RoundOutcome.WIN -> Color(0x148CFF9D)
        RoundOutcome.LOSS -> Color(0x14FF8C8C)
        RoundOutcome.PUSH -> Color(0x14FFE28F)
        null -> Color.White.copy(alpha = 0.04f)
    }
    Card(
        colors = CardDefaults.cardColors(containerColor = container),
        border = androidx.compose.foundation.BorderStroke(1.dp, border)
    ) {
        Column(Modifier.fillMaxWidth().padding(14.dp)) {
            if (lastRound == null) {
                Text("Place a bet and choose HIGH or LOW.", color = Color.White.copy(alpha = 0.85f))
            } else {
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(
                        when (lastRound.outcome) {
                            RoundOutcome.WIN -> "Win"
                            RoundOutcome.LOSS -> "Loss"
                            RoundOutcome.PUSH -> "Push"
                        },
                        fontWeight = FontWeight.Bold
                    )
                    Text(
                        "${if (lastRound.profit > 0) "+" else ""}${chips(lastRound.profit)} chips" +
                            if (lastRound.bonus > 0) " (bonus +${chips(lastRound.bonus)})" else "",
                        fontWeight = FontWeight.Bold,
                        color = when {
                            lastRound.profit > 0 -> Color(0xFFBFFFC8)
                            lastRound.profit < 0 -> Color(0xFFFFB9B9)
                            else -> Color(0xFFFFE8A8)
                        }
                    )
                }
                Spacer(Modifier.height(4.dp))
                Text(
                    "${lastRound.choice.name} on ${lastRound.current.rank} -> ${lastRound.next.rank}",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.White.copy(alpha = 0.7f)
                )
            }
        }
    }
}

@Composable
private fun BetControls(
    balance: Int,
    bet: Int,
    onQuickBet: (Int) -> Unit,
    onAddBet: (Int) -> Unit,
    onSetBetText: (String) -> Unit,
    onMax: () -> Unit,
    onClear: () -> Unit
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.04f)),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.12f))
    ) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Bet", fontWeight = FontWeight.Bold)
                Text("Min 10 / Max ${chips(balance)}", style = MaterialTheme.typography.labelSmall, color = Color.White.copy(alpha = 0.7f))
            }

            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                GameEngine.quickBets.forEach { quick ->
                    FilterChip(
                        selected = bet == quick,
                        onClick = { onQuickBet(quick.coerceAtMost(balance)) },
                        label = { Text("$quick") }
                    )
                }
            }

            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SmallActionButton("-", onClick = { onAddBet(-GameEngine.betStep) })
                OutlinedTextField(
                    value = bet.toString(),
                    onValueChange = onSetBetText,
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    label = { Text("Bet (chips)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number)
                )
                SmallActionButton("+", onClick = { onAddBet(GameEngine.betStep) })
            }

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                OutlinedButton(onClick = onMax, modifier = Modifier.weight(1f)) { Text("MAX") }
                OutlinedButton(onClick = onClear, modifier = Modifier.weight(1f)) { Text("CLEAR") }
            }
        }
    }
}

@Composable
private fun SmallActionButton(label: String, onClick: () -> Unit) {
    ElevatedButton(onClick = onClick, modifier = Modifier.widthIn(min = 48.dp)) {
        Text(label, fontSize = 20.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun QuickHelpCard() {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.04f)),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.12f))
    ) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Quick Help", fontWeight = FontWeight.Bold)
            Text("Aces are low (A = 1)", color = Color.White.copy(alpha = 0.85f))
            Text("Ties are Push (bet returned, streak unchanged)", color = Color.White.copy(alpha = 0.85f))
            Text("Win = +bet profit, Loss = -bet", color = Color.White.copy(alpha = 0.85f))
            Text("Modes: Fair / Demo: Always Win / Chaos: Always Lose", color = Color.White.copy(alpha = 0.85f))
        }
    }
}

@Composable
private fun AuthCard(
    isConfigured: Boolean,
    isSignedIn: Boolean,
    signedInEmail: String?,
    authBusy: Boolean,
    onOpenAuth: () -> Unit,
    onSignOut: () -> Unit,
    onShare: () -> Unit
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.04f)),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.12f))
    ) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Account", fontWeight = FontWeight.Bold)
            if (!isConfigured) {
                Text(
                    "Supabase auth is not configured for Android yet. Add SUPABASE_URL and SUPABASE_ANON_KEY to android-native/local.properties.",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.White.copy(alpha = 0.75f)
                )
                return@Column
            }

            if (isSignedIn) {
                Text(
                    "Signed in as ${signedInEmail ?: "player"}",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color.White.copy(alpha = 0.9f)
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                    OutlinedButton(onClick = onShare, modifier = Modifier.weight(1f)) { Text("Share App") }
                    OutlinedButton(onClick = onSignOut, enabled = !authBusy, modifier = Modifier.weight(1f)) {
                        Text(if (authBusy) "Working…" else "Log Out")
                    }
                }
                return@Column
            }

            Text(
                "Sign up or log in to sync your game across devices.",
                style = MaterialTheme.typography.bodySmall,
                color = Color.White.copy(alpha = 0.8f)
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                Button(onClick = onOpenAuth, modifier = Modifier.weight(1f)) { Text("Sign Up / Log In") }
                OutlinedButton(onClick = onShare, modifier = Modifier.weight(1f)) { Text("Share App") }
            }
            Text(
                "One tap opens email/password sign in and account creation.",
                style = MaterialTheme.typography.labelSmall,
                color = Color.White.copy(alpha = 0.65f)
            )
        }
    }
}

@Composable
private fun AuthSheet(
    authBusy: Boolean,
    email: String,
    password: String,
    onEmailChange: (String) -> Unit,
    onPasswordChange: (String) -> Unit,
    onSignIn: () -> Unit,
    onCreateAccount: () -> Unit,
    onSendMagicLink: () -> Unit,
    onClose: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column {
                Text("Sign In / Create Account", fontWeight = FontWeight.Bold)
                Text("Sync chips, settings, streak, and borrow usage.", style = MaterialTheme.typography.bodySmall, color = Color.White.copy(alpha = 0.7f))
            }
            TextButton(onClick = onClose, enabled = !authBusy) { Text("Close") }
        }
        OutlinedTextField(
            value = email,
            onValueChange = onEmailChange,
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            label = { Text("Email") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email)
        )
        OutlinedTextField(
            value = password,
            onValueChange = onPasswordChange,
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            label = { Text("Password (6+ chars)") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            visualTransformation = PasswordVisualTransformation()
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
            Button(
                onClick = onSignIn,
                enabled = !authBusy && email.isNotBlank() && password.isNotBlank(),
                modifier = Modifier.weight(1f)
            ) { Text(if (authBusy) "Working…" else "Sign In") }
            OutlinedButton(
                onClick = onCreateAccount,
                enabled = !authBusy && email.isNotBlank() && password.isNotBlank(),
                modifier = Modifier.weight(1f)
            ) { Text(if (authBusy) "Working…" else "Create Account") }
        }
        OutlinedButton(
            onClick = onSendMagicLink,
            enabled = !authBusy && email.isNotBlank(),
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(if (authBusy) "Working…" else "Resend Confirmation / Send Magic Link")
        }
        Text(
            "If account creation doesn't sign you in immediately, check your email (including spam/promotions) for a confirmation link, then sign in.",
            style = MaterialTheme.typography.labelSmall,
            color = Color.White.copy(alpha = 0.65f)
        )
        Spacer(Modifier.height(8.dp))
    }
}

@Composable
private fun RecoveryCard(
    minBet: Int,
    canBorrow: Boolean,
    onBorrow: () -> Unit,
    onNewGame: () -> Unit
) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color(0x22FFD666)),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color(0x33FFD666))
    ) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Out of chips", fontWeight = FontWeight.Bold, color = Color(0xFFFFE8A8))
            Text(
                "You need at least $minBet chips to play. " +
                    if (canBorrow) "You can take a one-time 5,000 chip borrow." else "Your one-time borrow has been used.",
                style = MaterialTheme.typography.bodySmall,
                color = Color(0xFFFFF1C8)
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
                Button(
                    onClick = onBorrow,
                    enabled = canBorrow,
                    modifier = Modifier.weight(1f)
                ) {
                    Text("Borrow 5,000")
                }
                OutlinedButton(onClick = onNewGame, modifier = Modifier.weight(1f)) {
                    Text("New Game")
                }
            }
        }
    }
}

@Composable
private fun DebugCard(viewModel: HighLowViewModel) {
    Card(
        colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.04f)),
        border = androidx.compose.foundation.BorderStroke(1.dp, Color.White.copy(alpha = 0.12f))
    ) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                Text("Debug Panel", fontWeight = FontWeight.Bold)
                OutlinedButton(onClick = viewModel::resetTable) { Text("Reset Table") }
            }
            Text(
                buildString {
                    appendLine("mode=${viewModel.mode}")
                    appendLine("phase=${viewModel.phase}")
                    appendLine("balance=${viewModel.balance}")
                    appendLine("bet=${viewModel.bet}")
                    appendLine("streak=${viewModel.streak}")
                    appendLine("pendingChoice=${viewModel.pendingChoice}")
                    appendLine("currentCard=${viewModel.currentCard}")
                    appendLine("lastRound=${viewModel.lastRound}")
                    appendLine("recentRounds=${viewModel.roundHistory.take(5)}")
                },
                fontSize = 12.sp,
                lineHeight = 16.sp,
                color = Color.White.copy(alpha = 0.8f),
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color.Black.copy(alpha = 0.2f))
                    .padding(10.dp)
            )
        }
    }
}

@Composable
private fun DisclaimerFooter() {
    Text(
        "Social casino demo only. Chips have no cash value. No cash out. No prizes or gift cards.",
        textAlign = TextAlign.Center,
        color = Color(0xFFFFE8A8),
        style = MaterialTheme.typography.bodySmall,
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color(0x22FFD666))
            .border(1.dp, Color(0x33FFD666), RoundedCornerShape(12.dp))
            .padding(12.dp)
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SettingsSheet(
    mode: GameMode,
    fairDeckCount: Int,
    soundEnabled: Boolean,
    zenMode: Boolean,
    reducedMotion: Boolean,
    onModeChange: (GameMode) -> Unit,
    onFairDeckCountChange: (Int) -> Unit,
    onSoundChange: (Boolean) -> Unit,
    onZenModeChange: (Boolean) -> Unit,
    onReducedMotionChange: (Boolean) -> Unit,
    onClose: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Text("Settings", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Game Mode", fontWeight = FontWeight.SemiBold)
            ModeOption(GameMode.FAIR, mode, "Fair", onModeChange)
            ModeOption(GameMode.ALWAYS_WIN, mode, "Demo: Always Win", onModeChange)
            ModeOption(GameMode.ALWAYS_LOSE, mode, "Chaos: Always Lose", onModeChange)
            Text(
                "Rigged modes are clearly labeled demos and are not fair gameplay.",
                style = MaterialTheme.typography.bodySmall,
                color = Color.White.copy(alpha = 0.7f)
            )
        }

        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Fair Mode Decks", fontWeight = FontWeight.SemiBold)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(1, 2, 3).forEach { count ->
                    FilterChip(
                        selected = fairDeckCount == count,
                        onClick = { onFairDeckCountChange(count) },
                        label = { Text("$count Deck" + if (count > 1) "s" else "") }
                    )
                }
            }
            Text(
                "Random Fair mode uses a shoe of 1, 2, or 3 decks.",
                style = MaterialTheme.typography.bodySmall,
                color = Color.White.copy(alpha = 0.7f)
            )
        }

        ToggleRow("Sound", soundEnabled, onSoundChange)
        ToggleRow("Zen mode", zenMode, onZenModeChange)
        ToggleRow("Reduced motion", reducedMotion, onReducedMotionChange)

        Card(colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.04f))) {
            Text(
                "Zen mode softens the experience by muting game sounds, reducing motion, and toning down visual intensity.",
                modifier = Modifier.fillMaxWidth().padding(12.dp),
                style = MaterialTheme.typography.bodySmall,
                color = Color.White.copy(alpha = 0.8f)
            )
        }

        Card(colors = CardDefaults.cardColors(containerColor = Color.White.copy(alpha = 0.04f))) {
            Column(Modifier.fillMaxWidth().padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Rules", fontWeight = FontWeight.SemiBold)
                Text("Aces are low (A = 1). Kings are high (K = 13).", style = MaterialTheme.typography.bodySmall)
                Text("Ties are Push (bet returned, streak unchanged).", style = MaterialTheme.typography.bodySmall)
                Text("Win pays +1x bet profit. Loss is -1x bet.", style = MaterialTheme.typography.bodySmall)
                Text("Every 3 wins gives +10% bonus (capped).", style = MaterialTheme.typography.bodySmall)
            }
        }

        Card(colors = CardDefaults.cardColors(containerColor = Color(0x22FFD666))) {
            Text(
                "Chips have no cash value. No cash out. No prizes.",
                modifier = Modifier.fillMaxWidth().padding(12.dp),
                color = Color(0xFFFFE8A8)
            )
        }

        TextButton(onClick = onClose, modifier = Modifier.align(Alignment.End)) {
            Text("Close")
        }
        Spacer(Modifier.height(12.dp))
    }
}

@Composable
private fun ModeOption(value: GameMode, selected: GameMode, label: String, onChange: (GameMode) -> Unit) {
    FilterChip(
        selected = selected == value,
        onClick = { onChange(value) },
        label = { Text(label) }
    )
}

@Composable
private fun ToggleRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .background(Color.White.copy(alpha = 0.04f))
            .border(1.dp, Color.White.copy(alpha = 0.12f), RoundedCornerShape(12.dp))
            .padding(horizontal = 12.dp, vertical = 10.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(label)
        Switch(checked = checked, onCheckedChange = onChange)
    }
}

private fun chips(value: Int): String = "%,d".format(value)

