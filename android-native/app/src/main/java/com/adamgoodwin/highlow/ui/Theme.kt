package com.adamgoodwin.highlow.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val HighLowDarkScheme = darkColorScheme(
    primary = Color(0xFF62F3FF),
    secondary = Color(0xFFFF4FD8),
    tertiary = Color(0xFFB7FF4A),
    background = Color(0xFF05070F),
    surface = Color(0xFF0E1223),
    surfaceVariant = Color(0xFF151A31),
    onPrimary = Color.Black,
    onSecondary = Color.Black,
    onTertiary = Color.Black,
    onBackground = Color(0xFFEEF7FF),
    onSurface = Color(0xFFEEF7FF),
    outline = Color(0x33FFFFFF)
)

@Composable
fun HighLowTheme(content: @Composable () -> Unit) {
    val colors = if (isSystemInDarkTheme()) HighLowDarkScheme else HighLowDarkScheme
    MaterialTheme(
        colorScheme = colors,
        content = content
    )
}
