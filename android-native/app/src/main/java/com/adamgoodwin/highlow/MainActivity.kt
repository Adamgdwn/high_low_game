package com.adamgoodwin.highlow

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import com.adamgoodwin.highlow.ui.HighLowApp

class MainActivity : ComponentActivity() {
    private val viewModel: HighLowViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            HighLowApp(viewModel = viewModel)
        }
    }
}
