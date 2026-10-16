package il.benyehuda.family

import android.app.KeyguardManager
import android.content.Context
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.VibrationEffect
import android.os.Vibrator
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject

/** Full-screen reminder: lights up the screen, rings (looping) and shows the done / snooze buttons. */
class AlarmActivity : AppCompatActivity() {
    private var player: MediaPlayer? = null
    private val handler = Handler(Looper.getMainLooper())
    private lateinit var root: LinearLayout

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(true); setTurnScreenOn(true) }
        @Suppress("DEPRECATION")
        window.addFlags(
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
        )
        if (Build.VERSION.SDK_INT >= 26) getSystemService(KeyguardManager::class.java).requestDismissKeyguard(this, null)
        root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(48, 48, 48, 48)
            layoutDirection = View.LAYOUT_DIRECTION_RTL
            background = GradientDrawable(GradientDrawable.Orientation.TL_BR, intArrayOf(Color.parseColor("#ff6a3d"), Color.parseColor("#e0357a"), Color.parseColor("#6d4aff")))
        }
        setContentView(root)
        render(intent)
    }

    override fun onNewIntent(intent: android.content.Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        render(intent)
    }

    private fun render(intent: android.content.Intent) {
        stopRinging()
        root.removeAllViews()
        val title = intent.getStringExtra(Alarm.X_TITLE) ?: "תזכורת"
        val body = intent.getStringExtra(Alarm.X_BODY) ?: ""
        val actions = intent.getStringArrayListExtra(Alarm.X_ACTIONS) ?: arrayListOf()

        root.addView(TextView(this).apply { text = "🔔"; textSize = 84f; gravity = Gravity.CENTER })
        root.addView(TextView(this).apply {
            text = title; textSize = 28f; setTextColor(Color.WHITE); typeface = Typeface.DEFAULT_BOLD; gravity = Gravity.CENTER
            setPadding(0, 16, 0, 8)
        })
        root.addView(TextView(this).apply {
            text = body; textSize = 18f; setTextColor(Color.WHITE); gravity = Gravity.CENTER
            setPadding(0, 0, 0, 32)
        })
        for (a in actions) {
            val p = a.split("\u0001")
            if (p.size < 4) continue
            root.addView(button(p[0], true) { post(p[1], p.getOrElse(2) { "POST" }, p[3], p.getOrElse(4) { "{}" }); cancelNote(); finish() })
        }
        root.addView(button("סגור", false) { cancelNote(); finish() })
        startRinging()
        handler.postDelayed({ stopRinging() }, 3 * 60 * 1000L)
    }

    private fun button(label: String, primary: Boolean, onClick: () -> Unit): Button = Button(this).apply {
        text = label
        textSize = 19f
        isAllCaps = false
        setTextColor(if (primary) Color.parseColor("#c0245f") else Color.WHITE)
        background = GradientDrawable().apply {
            cornerRadius = 60f
            setColor(if (primary) Color.WHITE else Color.argb(70, 255, 255, 255))
        }
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 170).apply { setMargins(0, 12, 0, 12) }
        setOnClickListener { onClick() }
    }

    private fun post(url: String, method: String, body: String, headersJson: String) {
        Thread {
            try {
                val c = URL(url).openConnection() as HttpURLConnection
                c.requestMethod = method
                c.connectTimeout = 15000
                c.readTimeout = 15000
                val h = JSONObject(headersJson)
                for (k in h.keys()) c.setRequestProperty(k, h.getString(k))
                if (body.isNotEmpty()) { c.doOutput = true; c.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) } }
                c.responseCode
                c.disconnect()
            } catch (e: Exception) { }
        }.start()
    }

    private fun startRinging() {
        try {
            val am = getSystemService(Context.AUDIO_SERVICE) as AudioManager
            am.setStreamVolume(AudioManager.STREAM_ALARM, am.getStreamMaxVolume(AudioManager.STREAM_ALARM), 0)
            val sound = Prefs.sound(this)
            val res = resources.getIdentifier("tone_$sound", "raw", packageName)
            if (sound != "silent") {
                val mp = MediaPlayer()
                mp.setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build())
                if (res != 0) {
                    resources.openRawResourceFd(res).use { mp.setDataSource(it.fileDescriptor, it.startOffset, it.length) }
                } else {
                    mp.setDataSource(this, RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION))
                }
                mp.isLooping = true
                mp.setVolume(1f, 1f)
                mp.prepare()
                mp.start()
                player = mp
            }
        } catch (e: Exception) { }
        try {
            val v = getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(longArrayOf(0, 600, 300, 600, 300, 600, 1500), 0))
            else @Suppress("DEPRECATION") v.vibrate(longArrayOf(0, 600, 300, 600, 300, 600, 1500), 0)
        } catch (e: Exception) { }
    }

    private fun stopRinging() {
        handler.removeCallbacksAndMessages(null)
        try { player?.stop(); player?.release() } catch (e: Exception) { }
        player = null
        try { (getSystemService(Context.VIBRATOR_SERVICE) as Vibrator).cancel() } catch (e: Exception) { }
    }

    override fun onDestroy() {
        stopRinging()
        super.onDestroy()
    }

    private fun cancelNote() {
        val n = intent.getIntExtra(Alarm.X_NID, -1)
        if (n >= 0) try { getSystemService(android.app.NotificationManager::class.java).cancel(n) } catch (e: Exception) { }
    }
}
