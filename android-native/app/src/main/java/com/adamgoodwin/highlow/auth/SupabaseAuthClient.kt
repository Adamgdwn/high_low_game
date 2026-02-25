package com.adamgoodwin.highlow.auth

import com.adamgoodwin.highlow.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.io.BufferedReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

data class AuthResult(
    val success: Boolean,
    val message: String,
    val email: String? = null,
    val accessToken: String? = null,
    val refreshToken: String? = null
)

class SupabaseAuthClient {
    private val urlBase = BuildConfig.SUPABASE_URL.trim()
    private val anonKey = BuildConfig.SUPABASE_ANON_KEY.trim()

    fun isConfigured(): Boolean = urlBase.isNotEmpty() && anonKey.isNotEmpty()

    suspend fun signUp(email: String, password: String): AuthResult = withContext(Dispatchers.IO) {
        if (!isConfigured()) return@withContext AuthResult(false, "Supabase not configured")
        val body = JSONObject()
            .put("email", email)
            .put("password", password)
        val json = postJson("$urlBase/auth/v1/signup", body.toString())
        if (!json.success) return@withContext json
        val obj = JSONObject(json.message)
        val userEmail = obj.optJSONObject("user")?.optString("email")
        val accessToken = obj.optString("access_token", null)
        val refreshToken = obj.optString("refresh_token", null)
        if (accessToken.isNullOrBlank()) {
            AuthResult(true, "Account created. Check email to confirm, then sign in.", userEmail, null)
        } else {
            AuthResult(true, "Account created and signed in", userEmail, accessToken, refreshToken)
        }
    }

    suspend fun signIn(email: String, password: String): AuthResult = withContext(Dispatchers.IO) {
        if (!isConfigured()) return@withContext AuthResult(false, "Supabase not configured")
        val body = JSONObject()
            .put("email", email)
            .put("password", password)
        val json = postJson("$urlBase/auth/v1/token?grant_type=password", body.toString())
        if (!json.success) return@withContext json
        val obj = JSONObject(json.message)
        val userEmail = obj.optJSONObject("user")?.optString("email") ?: email
        val accessToken = obj.optString("access_token", null)
        val refreshToken = obj.optString("refresh_token", null)
        if (accessToken.isNullOrBlank()) return@withContext AuthResult(false, "Missing access token")
        AuthResult(true, "Signed in", userEmail, accessToken, refreshToken)
    }

    suspend fun refreshSession(refreshToken: String): AuthResult = withContext(Dispatchers.IO) {
        if (!isConfigured()) return@withContext AuthResult(false, "Supabase not configured")
        val body = JSONObject().put("refresh_token", refreshToken)
        val json = postJson("$urlBase/auth/v1/token?grant_type=refresh_token", body.toString())
        if (!json.success) return@withContext json
        val obj = JSONObject(json.message)
        val userEmail = obj.optJSONObject("user")?.optString("email")
        val nextAccessToken = obj.optString("access_token", null)
        val nextRefreshToken = obj.optString("refresh_token", null)
        if (nextAccessToken.isNullOrBlank()) return@withContext AuthResult(false, "Missing access token")
        AuthResult(true, "Session refreshed", userEmail, nextAccessToken, nextRefreshToken)
    }

    suspend fun signOut(accessToken: String): AuthResult = withContext(Dispatchers.IO) {
        if (!isConfigured()) return@withContext AuthResult(false, "Supabase not configured")
        val conn = (URL("$urlBase/auth/v1/logout").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            setRequestProperty("apikey", anonKey)
            setRequestProperty("Authorization", "Bearer $accessToken")
            setRequestProperty("Content-Type", "application/json")
            doOutput = true
            connectTimeout = 15000
            readTimeout = 15000
        }
        return@withContext try {
            conn.outputStream.use { out ->
                OutputStreamWriter(out).use { it.write("{}") }
            }
            val code = conn.responseCode
            if (code in 200..299) AuthResult(true, "Signed out")
            else AuthResult(false, readError(conn) ?: "Sign out failed ($code)")
        } catch (e: Exception) {
            AuthResult(false, e.message ?: "Network error")
        } finally {
            conn.disconnect()
        }
    }

    suspend fun sendMagicLink(email: String): AuthResult = withContext(Dispatchers.IO) {
        if (!isConfigured()) return@withContext AuthResult(false, "Supabase not configured")
        val body = JSONObject()
            .put("email", email)
            .put("create_user", false)
        val result = postJson("$urlBase/auth/v1/otp", body.toString())
        if (!result.success) return@withContext result
        AuthResult(true, "Magic link sent. Check inbox/spam/promotions.", email = email)
    }

    private data class RawJsonResult(val success: Boolean, val message: String)

    private fun postJson(url: String, body: String): AuthResult {
        val conn = (URL(url).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            setRequestProperty("apikey", anonKey)
            setRequestProperty("Content-Type", "application/json")
            doOutput = true
            connectTimeout = 15000
            readTimeout = 15000
        }
        return try {
            conn.outputStream.use { out ->
                OutputStreamWriter(out).use { it.write(body) }
            }
            val code = conn.responseCode
            val text = readBody(conn)
            if (code in 200..299) {
                AuthResult(true, text)
            } else {
                val err = runCatching { JSONObject(text).optString("msg").ifBlank { JSONObject(text).optString("message") } }.getOrNull()
                    ?: "Request failed ($code)"
                AuthResult(false, err)
            }
        } catch (e: Exception) {
            AuthResult(false, e.message ?: "Network error")
        } finally {
            conn.disconnect()
        }
    }

    private fun readBody(conn: HttpURLConnection): String {
        val stream = if (conn.responseCode in 200..299) conn.inputStream else conn.errorStream
        return stream?.bufferedReader()?.use(BufferedReader::readText) ?: ""
    }

    private fun readError(conn: HttpURLConnection): String? = runCatching { readBody(conn) }.getOrNull()
}
