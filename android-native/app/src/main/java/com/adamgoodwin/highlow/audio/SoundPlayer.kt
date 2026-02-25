package com.adamgoodwin.highlow.audio

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.ToneGenerator
import android.os.Handler
import android.os.Looper
import com.adamgoodwin.highlow.game.ZenMusicTrack
import java.io.IOException
import kotlin.concurrent.thread

class SoundPlayer(private val context: Context) {
    @Volatile private var zenMusicRunning = false
    @Volatile private var zenMusicTrack = ZenMusicTrack.CALM
    @Volatile private var zenMusicVolume = 35
    @Volatile private var zenMusicThread: Thread? = null

    private val mainHandler = Handler(Looper.getMainLooper())
    private var zenPlayerA: MediaPlayer? = null
    private var zenPlayerB: MediaPlayer? = null
    private var zenPlayerASource: String? = null
    private var zenPlayerBSource: String? = null
    private var zenPlayerAVolume: Float = 0f
    private var zenPlayerBVolume: Float = 0f
    private var zenActiveSlot: Int = 0 // 0 none, 1 A, 2 B
    private var fadeRunnable: Runnable? = null
    private var zenUseFilePlayback = false

    fun playClick(enabled: Boolean) = ifEnabled(enabled) {
        beep(35, ToneGenerator.TONE_PROP_BEEP)
        thread(isDaemon = true) {
            Thread.sleep(18)
            beep(45, ToneGenerator.TONE_PROP_BEEP2)
        }
    }

    fun playFlip(enabled: Boolean) = ifEnabled(enabled) {
        beep(45, ToneGenerator.TONE_SUP_PIP)
        thread(isDaemon = true) {
            Thread.sleep(36)
            beep(60, ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD)
        }
    }

    fun playWin(enabled: Boolean) = ifEnabled(enabled) {
        beep(90, ToneGenerator.TONE_PROP_ACK)
        thread(isDaemon = true) {
            Thread.sleep(70)
            beep(120, ToneGenerator.TONE_PROP_BEEP2)
        }
    }

    fun playLoss(enabled: Boolean) = ifEnabled(enabled) { beep(180, ToneGenerator.TONE_PROP_NACK) }
    fun playPush(enabled: Boolean) = ifEnabled(enabled) { beep(100, ToneGenerator.TONE_SUP_PIP) }

    fun setZenMusic(enabled: Boolean, track: ZenMusicTrack, volume: Int) {
        zenMusicTrack = track
        zenMusicVolume = volume.coerceIn(0, 100)

        if (!enabled || zenMusicVolume <= 0) {
            stopZenMusic()
            return
        }

        // Prefer bundled asset loops if present.
        val targetVolume = normalizedZenVolume(zenMusicVolume)
        if (startOrCrossfadeAsset(track, targetVolume)) {
            stopToneFallback()
            zenUseFilePlayback = true
            return
        }

        // Fall back to placeholder tones if assets are not bundled yet.
        zenUseFilePlayback = false
        startOrUpdateToneFallback()
    }

    fun stopZenMusic() {
        stopToneFallback()
        stopFilePlayback()
    }

    private fun ifEnabled(enabled: Boolean, block: () -> Unit) {
        if (!enabled) return
        runCatching(block)
    }

    private fun beep(durationMs: Int, tone: Int) {
        beep(durationMs, tone, 45)
    }

    private fun beep(durationMs: Int, tone: Int, volume: Int) {
        val tg = ToneGenerator(AudioManager.STREAM_MUSIC, volume.coerceIn(0, 100))
        try {
            tg.startTone(tone, durationMs)
        } finally {
            tg.release()
        }
    }

    private fun startOrUpdateToneFallback() {
        if (zenMusicRunning) return
        zenMusicRunning = true
        val musicThread = thread(start = true, isDaemon = true, name = "zen-music-loop") {
            while (zenMusicRunning) {
                runCatching { playZenMotif(zenMusicTrack, zenMusicVolume) }
                val delayMs = when (zenMusicTrack) {
                    ZenMusicTrack.FOCUS -> 1500L
                    ZenMusicTrack.NIGHT -> 2300L
                    ZenMusicTrack.CALM -> 2000L
                }
                try {
                    Thread.sleep(delayMs)
                } catch (_: InterruptedException) {
                    break
                }
            }
        }
        zenMusicThread = musicThread
    }

    private fun stopToneFallback() {
        zenMusicRunning = false
        zenMusicThread?.interrupt()
        zenMusicThread = null
    }

    private fun playZenMotif(track: ZenMusicTrack, volume: Int) {
        val level = ((volume * 0.35f) + 8f).toInt().coerceIn(8, 45)
        when (track) {
            ZenMusicTrack.CALM -> {
                beep(220, ToneGenerator.TONE_SUP_PIP, level)
                Thread.sleep(180)
                beep(180, ToneGenerator.TONE_CDMA_ALERT_INCALL_LITE, (level * 0.9f).toInt())
                Thread.sleep(320)
                beep(260, ToneGenerator.TONE_PROP_BEEP, (level * 0.75f).toInt())
            }
            ZenMusicTrack.FOCUS -> {
                beep(120, ToneGenerator.TONE_PROP_BEEP, level)
                Thread.sleep(140)
                beep(120, ToneGenerator.TONE_PROP_BEEP2, (level * 0.9f).toInt())
                Thread.sleep(240)
                beep(200, ToneGenerator.TONE_SUP_PIP, (level * 0.7f).toInt())
                Thread.sleep(180)
                beep(120, ToneGenerator.TONE_PROP_BEEP, (level * 0.65f).toInt())
            }
            ZenMusicTrack.NIGHT -> {
                beep(260, ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD, level)
                Thread.sleep(320)
                beep(240, ToneGenerator.TONE_SUP_RADIO_ACK, (level * 0.75f).toInt())
                Thread.sleep(420)
                beep(320, ToneGenerator.TONE_CDMA_LOW_SS, (level * 0.65f).toInt())
            }
        }
    }

    private fun startOrCrossfadeAsset(track: ZenMusicTrack, targetVolume: Float): Boolean {
        val path = when (track) {
            ZenMusicTrack.CALM -> "zen/calm.mp3"
            ZenMusicTrack.FOCUS -> "zen/focus.mp3"
            ZenMusicTrack.NIGHT -> "zen/night.mp3"
        }
        val nextSlot = if (zenActiveSlot == 1) 2 else 1
        val nextPlayer = preparePlayerForPath(nextSlot, path) ?: return false
        val currentPlayer = when (zenActiveSlot) {
            1 -> zenPlayerA
            2 -> zenPlayerB
            else -> null
        }

        return try {
            nextPlayer.isLooping = true
            nextPlayer.setVolume(0f, 0f)
            nextPlayer.start()
            crossfadePlayers(currentPlayer, nextPlayer, targetVolume)
            zenActiveSlot = nextSlot
            true
        } catch (_: IllegalStateException) {
            false
        }
    }

    private fun preparePlayerForPath(slot: Int, assetPath: String): MediaPlayer? {
        val existing = if (slot == 1) zenPlayerA else zenPlayerB
        val currentSourceTag = if (slot == 1) zenPlayerASource else zenPlayerBSource
        if (existing != null && currentSourceTag == assetPath) {
            runCatching { existing.seekTo(0) }
            return existing
        }

        val player = createPlayerFromAsset(assetPath) ?: return null
        if (slot == 1) {
            zenPlayerA?.releaseSafely()
            zenPlayerA = player
            zenPlayerASource = assetPath
            zenPlayerAVolume = 0f
        } else {
            zenPlayerB?.releaseSafely()
            zenPlayerB = player
            zenPlayerBSource = assetPath
            zenPlayerBVolume = 0f
        }
        return player
    }

    private fun createPlayerFromAsset(assetPath: String): MediaPlayer? {
        return try {
            val afd = context.assets.openFd(assetPath)
            MediaPlayer().apply {
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .build()
                )
                setDataSource(afd.fileDescriptor, afd.startOffset, afd.length)
                afd.close()
                isLooping = true
                prepare()
            }
        } catch (_: IOException) {
            null
        } catch (_: IllegalArgumentException) {
            null
        }
    }

    private fun crossfadePlayers(from: MediaPlayer?, to: MediaPlayer, targetVolume: Float) {
        fadeRunnable?.let(mainHandler::removeCallbacks)
        val steps = 18
        val stepDelayMs = 50L
        var step = 0
        val fromStart = from.safeVolume()

        val runnable = object : Runnable {
            override fun run() {
                step += 1
                val t = (step / steps.toFloat()).coerceIn(0f, 1f)
                val eased = t * t * (3f - 2f * t)
                from?.setVolumeSafe(fromStart * (1f - eased))
                to.setVolumeSafe(targetVolume * eased)

                if (t < 1f) {
                    mainHandler.postDelayed(this, stepDelayMs)
                } else {
                    from?.pauseSafely()
                    from?.seekToSafe(0)
                    to.setVolumeSafe(targetVolume)
                    fadeRunnable = null
                }
            }
        }
        fadeRunnable = runnable
        mainHandler.post(runnable)
    }

    private fun stopFilePlayback() {
        zenUseFilePlayback = false
        fadeRunnable?.let(mainHandler::removeCallbacks)
        fadeRunnable = null
        zenActiveSlot = 0
        zenPlayerA?.releaseSafely()
        zenPlayerA = null
        zenPlayerASource = null
        zenPlayerAVolume = 0f
        zenPlayerB?.releaseSafely()
        zenPlayerB = null
        zenPlayerBSource = null
        zenPlayerBVolume = 0f
    }

    private fun normalizedZenVolume(volume: Int): Float {
        return (volume.coerceIn(0, 100) / 220f).coerceIn(0f, 0.45f)
    }

    private fun MediaPlayer?.safeVolume(): Float {
        return when (this) {
            zenPlayerA -> zenPlayerAVolume
            zenPlayerB -> zenPlayerBVolume
            else -> 0f
        }
    }

    private fun MediaPlayer.setVolumeSafe(value: Float) = runCatching {
        setVolume(value, value)
        when (this) {
            zenPlayerA -> zenPlayerAVolume = value
            zenPlayerB -> zenPlayerBVolume = value
        }
    }
    private fun MediaPlayer.pauseSafely() = runCatching { if (isPlaying) pause() }
    private fun MediaPlayer.seekToSafe(ms: Int) = runCatching { seekTo(ms) }
    private fun MediaPlayer.releaseSafely() = runCatching { release() }
}
