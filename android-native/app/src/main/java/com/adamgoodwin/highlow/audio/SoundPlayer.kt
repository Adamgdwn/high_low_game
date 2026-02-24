package com.adamgoodwin.highlow.audio

import android.media.AudioManager
import android.media.ToneGenerator
import com.adamgoodwin.highlow.game.ZenMusicTrack
import kotlin.concurrent.thread

class SoundPlayer {
    @Volatile private var zenMusicRunning = false
    @Volatile private var zenMusicTrack = ZenMusicTrack.CALM
    @Volatile private var zenMusicVolume = 35
    @Volatile private var zenMusicThread: Thread? = null

    // Placeholder chip clank for bet actions.
    fun playClick(enabled: Boolean) = ifEnabled(enabled) {
        beep(35, ToneGenerator.TONE_PROP_BEEP)
        thread {
            Thread.sleep(18)
            beep(45, ToneGenerator.TONE_PROP_BEEP2)
        }
    }
    // Placeholder card flip/reveal.
    fun playFlip(enabled: Boolean) = ifEnabled(enabled) {
        beep(45, ToneGenerator.TONE_SUP_PIP)
        thread {
            Thread.sleep(36)
            beep(60, ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD)
        }
    }
    fun playWin(enabled: Boolean) = ifEnabled(enabled) {
        beep(90, ToneGenerator.TONE_PROP_ACK)
        thread {
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
        if (zenMusicRunning) return
        zenMusicRunning = true
        val musicThread = thread(start = true, isDaemon = true, name = "zen-music-loop") {
            while (zenMusicRunning) {
                runCatching {
                    playZenMotif(zenMusicTrack, zenMusicVolume)
                }
                val delayMs = when (zenMusicTrack) {
                    ZenMusicTrack.FOCUS -> 1500L
                    ZenMusicTrack.NIGHT -> 2300L
                    ZenMusicTrack.CALM -> 2000L
                }
                Thread.sleep(delayMs)
            }
        }
        zenMusicThread = musicThread
    }

    fun stopZenMusic() {
        zenMusicRunning = false
        zenMusicThread?.interrupt()
        zenMusicThread = null
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
}
