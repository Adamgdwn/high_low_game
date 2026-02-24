package com.adamgoodwin.highlow.auth

import android.util.Base64
import com.adamgoodwin.highlow.BuildConfig
import com.adamgoodwin.highlow.game.GameMode
import com.adamgoodwin.highlow.game.PersistedGameState
import com.adamgoodwin.highlow.game.ZenMusicTrack
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URLEncoder
import java.net.URL

data class CloudStateResult(
    val success: Boolean,
    val message: String,
    val state: PersistedGameState? = null
)

class SupabaseGameProfileClient {
    private val urlBase = BuildConfig.SUPABASE_URL.trim()
    private val anonKey = BuildConfig.SUPABASE_ANON_KEY.trim()

    fun isConfigured(): Boolean = urlBase.isNotEmpty() && anonKey.isNotEmpty()

    suspend fun loadGameState(accessToken: String): CloudStateResult = withContext(Dispatchers.IO) {
        if (!isConfigured()) return@withContext CloudStateResult(false, "Supabase not configured")
        val userId = extractUserIdFromAccessToken(accessToken)
            ?: return@withContext CloudStateResult(false, "Unable to read user id from auth token")

        val encodedUserId = URLEncoder.encode("eq.$userId", "UTF-8")
        val url = "$urlBase/rest/v1/game_profiles?select=state&user_id=$encodedUserId"
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            setRequestProperty("apikey", anonKey)
            setRequestProperty("Authorization", "Bearer $accessToken")
            setRequestProperty("Accept", "application/json")
            connectTimeout = 15000
            readTimeout = 15000
        }
        return@withContext try {
            val code = conn.responseCode
            val body = readBody(conn)
            if (code !in 200..299) {
                CloudStateResult(false, parseError(body, code))
            } else {
                val rows = JSONArray(body.ifBlank { "[]" })
                if (rows.length() == 0) {
                    CloudStateResult(true, "No cloud profile yet", null)
                } else {
                    val stateObj = rows.optJSONObject(0)?.optJSONObject("state") ?: JSONObject()
                    CloudStateResult(true, "Cloud state loaded", parsePersistedState(stateObj))
                }
            }
        } catch (e: Exception) {
            CloudStateResult(false, e.message ?: "Network error")
        } finally {
            conn.disconnect()
        }
    }

    suspend fun saveGameState(accessToken: String, state: PersistedGameState): CloudStateResult = withContext(Dispatchers.IO) {
        if (!isConfigured()) return@withContext CloudStateResult(false, "Supabase not configured")
        val userId = extractUserIdFromAccessToken(accessToken)
            ?: return@withContext CloudStateResult(false, "Unable to read user id from auth token")

        val payload = JSONObject()
            .put("user_id", userId)
            .put("state", toCloudJson(state))

        val conn = (URL("$urlBase/rest/v1/game_profiles?on_conflict=user_id").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            setRequestProperty("apikey", anonKey)
            setRequestProperty("Authorization", "Bearer $accessToken")
            setRequestProperty("Content-Type", "application/json")
            setRequestProperty("Prefer", "resolution=merge-duplicates,return=minimal")
            doOutput = true
            connectTimeout = 15000
            readTimeout = 15000
        }
        return@withContext try {
            conn.outputStream.use { out ->
                OutputStreamWriter(out).use { it.write(payload.toString()) }
            }
            val code = conn.responseCode
            val body = readBody(conn)
            if (code in 200..299) CloudStateResult(true, "Cloud state saved")
            else CloudStateResult(false, parseError(body, code))
        } catch (e: Exception) {
            CloudStateResult(false, e.message ?: "Network error")
        } finally {
            conn.disconnect()
        }
    }

    private fun toCloudJson(state: PersistedGameState): JSONObject {
        return JSONObject()
            .put("balance", state.balance.coerceAtLeast(0))
            .put("mode", toWebModeString(state.mode))
            .put("fairDeckCount", state.fairDeckCount.coerceIn(1, 3))
            .put("soundEnabled", state.soundEnabled)
            .put("zenMode", state.zenMode)
            .put("zenMusicEnabled", state.zenMusicEnabled)
            .put("zenMusicTrack", toWebZenTrackString(state.zenMusicTrack))
            .put("zenMusicVolume", state.zenMusicVolume.coerceIn(0, 100))
            .put("reducedMotion", state.reducedMotion)
            .put("streak", state.streak.coerceAtLeast(0))
            .put("lastBet", state.lastBet.coerceAtLeast(0))
            .put("borrowUsed", state.borrowUsed)
            .put("welcomeSeen", state.welcomeSeen)
            .put("debugOpen", state.debugOpen)
    }

    private fun parsePersistedState(obj: JSONObject): PersistedGameState {
        val modeRaw = obj.optString("mode", "fair")
        return PersistedGameState(
            balance = obj.optInt("balance", 10_000).coerceAtLeast(0),
            mode = parseMode(modeRaw),
            fairDeckCount = obj.optInt("fairDeckCount", 1).coerceIn(1, 3),
            soundEnabled = obj.optBoolean("soundEnabled", false),
            zenMode = obj.optBoolean("zenMode", false),
            zenMusicEnabled = obj.optBoolean("zenMusicEnabled", false),
            zenMusicTrack = parseZenTrack(obj.optString("zenMusicTrack", "calm")),
            zenMusicVolume = obj.optInt("zenMusicVolume", 35).coerceIn(0, 100),
            reducedMotion = obj.optBoolean("reducedMotion", false),
            streak = obj.optInt("streak", 0).coerceAtLeast(0),
            lastBet = obj.optInt("lastBet", 100).coerceAtLeast(0),
            borrowUsed = obj.optBoolean("borrowUsed", false),
            authEmail = null,
            authAccessToken = null,
            welcomeSeen = obj.optBoolean("welcomeSeen", false),
            debugOpen = obj.optBoolean("debugOpen", false)
        )
    }

    private fun parseMode(value: String): GameMode {
        return when (value) {
            "fair", "FAIR" -> GameMode.FAIR
            "alwaysWin", "ALWAYS_WIN" -> GameMode.ALWAYS_WIN
            "alwaysLose", "ALWAYS_LOSE" -> GameMode.ALWAYS_LOSE
            else -> GameMode.FAIR
        }
    }

    private fun toWebModeString(mode: GameMode): String {
        return when (mode) {
            GameMode.FAIR -> "fair"
            GameMode.ALWAYS_WIN -> "alwaysWin"
            GameMode.ALWAYS_LOSE -> "alwaysLose"
        }
    }

    private fun parseZenTrack(value: String): ZenMusicTrack {
        return when (value) {
            "calm", "CALM" -> ZenMusicTrack.CALM
            "focus", "FOCUS" -> ZenMusicTrack.FOCUS
            "night", "NIGHT" -> ZenMusicTrack.NIGHT
            else -> ZenMusicTrack.CALM
        }
    }

    private fun toWebZenTrackString(track: ZenMusicTrack): String {
        return when (track) {
            ZenMusicTrack.CALM -> "calm"
            ZenMusicTrack.FOCUS -> "focus"
            ZenMusicTrack.NIGHT -> "night"
        }
    }

    private fun extractUserIdFromAccessToken(accessToken: String): String? {
        return runCatching {
            val parts = accessToken.split(".")
            if (parts.size < 2) {
                null
            } else {
            val payload = parts[1]
            val padded = payload.padEnd(((payload.length + 3) / 4) * 4, '=')
            val decoded = Base64.decode(padded, Base64.URL_SAFE or Base64.NO_WRAP)
                JSONObject(String(decoded, Charsets.UTF_8)).optString("sub").ifBlank { null }
            }
        }.getOrNull()
    }

    private fun parseError(body: String, code: Int): String {
        return runCatching {
            val obj = JSONObject(body)
            obj.optString("message").ifBlank { obj.optString("msg") }.ifBlank { "Request failed ($code)" }
        }.getOrDefault("Request failed ($code)")
    }

    private fun readBody(conn: HttpURLConnection): String {
        val stream = if (conn.responseCode in 200..299) conn.inputStream else conn.errorStream
        return stream?.bufferedReader()?.use { it.readText() } ?: ""
    }
}
