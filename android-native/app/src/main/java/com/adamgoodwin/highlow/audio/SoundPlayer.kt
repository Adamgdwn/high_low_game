package com.adamgoodwin.highlow.audio

import android.media.AudioManager
import android.media.ToneGenerator
import kotlin.concurrent.thread

class SoundPlayer {
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

    private fun ifEnabled(enabled: Boolean, block: () -> Unit) {
        if (!enabled) return
        runCatching(block)
    }

    private fun beep(durationMs: Int, tone: Int) {
        val tg = ToneGenerator(AudioManager.STREAM_MUSIC, 45)
        try {
            tg.startTone(tone, durationMs)
        } finally {
            tg.release()
        }
    }
}
