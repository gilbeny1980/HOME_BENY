package il.benyehuda.family

import android.Manifest
import android.annotation.SuppressLint
import android.app.AlertDialog
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

/** The family site inside the app + one-time setup of the permissions that let reminders pop on screen. */
class MainActivity : AppCompatActivity() {
    private lateinit var web: WebView
    private var fileCb: ValueCallback<Array<Uri>>? = null
    private val picker = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        val data = r.data
        val uris: Array<Uri>? = if (r.resultCode == RESULT_OK && data != null) {
            data.data?.let { arrayOf(it) } ?: data.clipData?.let { c -> Array(c.itemCount) { i -> c.getItemAt(i).uri } }
        } else null
        fileCb?.onReceiveValue(uris)
        fileCb = null
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        web = WebView(this)
        web.setBackgroundColor(android.graphics.Color.TRANSPARENT) // no white flash in dark mode
        web.layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        setContentView(web)
        with(web.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            userAgentString = userAgentString + " BenYehudaApp/1.0"
        }
        web.addJavascriptInterface(Bridge(), "AndroidBridge")
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, req: WebResourceRequest): Boolean {
                val u = req.url
                if (u.host == Uri.parse(Prefs.SITE).host) return false
                try { startActivity(Intent(Intent.ACTION_VIEW, u)) } catch (e: Exception) { }
                return true
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(w: WebView, cb: ValueCallback<Array<Uri>>, p: FileChooserParams): Boolean {
                fileCb?.onReceiveValue(null)
                fileCb = cb
                return try { picker.launch(p.createIntent()); true } catch (e: Exception) { fileCb = null; false }
            }
        }
        web.loadUrl(Prefs.SITE)
    }

    override fun onResume() {
        super.onResume()
        if (Prefs.topic(this).isNotEmpty()) { ListenerService.start(this); ensurePermissions() }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (web.canGoBack()) web.goBack() else @Suppress("DEPRECATION") super.onBackPressed()
    }

    /** One missing permission at a time (each asked at most twice, so we never nag forever). */
    private fun ensurePermissions() {
        val sp = getSharedPreferences("by", Context.MODE_PRIVATE)
        fun asked(k: String): Boolean { val n = sp.getInt(k, 0); if (n >= 2) return true; sp.edit().putInt(k, n + 1).apply(); return false }
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
            if (!asked("a_notif")) ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
            return
        }
        if (Build.VERSION.SDK_INT >= 23 && !Settings.canDrawOverlays(this)) {
            if (!asked("a_overlay")) explain("הצגה מעל אפליקציות אחרות", "כדי שההתראה תקפוץ על המסך גם כשאתה באפליקציה אחרת, אשר \"הצגה מעל אפליקציות אחרות\" לאפליקציית בן יהודה.") {
                startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")))
            }
            return
        }
        if (Build.VERSION.SDK_INT >= 34 && !getSystemService(NotificationManager::class.java).canUseFullScreenIntent()) {
            if (!asked("a_fsi")) explain("מסך מלא במסך נעול", "כדי שההתראה תפתח מסך מלא כשהטלפון נעול, אפשר \"הודעות במסך מלא\" לאפליקציה.") {
                startActivity(Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:$packageName")))
            }
            return
        }
        val pm = getSystemService(PowerManager::class.java)
        if (Build.VERSION.SDK_INT >= 23 && !pm.isIgnoringBatteryOptimizations(packageName)) {
            if (!asked("a_batt")) explain("סוללה", "כדי שההתראות יגיעו גם כשהטלפון במצב שינה, אשר \"ללא הגבלה\" לסוללה.") {
                startActivity(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName")))
            }
        }
    }

    private fun explain(title: String, msg: String, go: () -> Unit) {
        AlertDialog.Builder(this).setTitle(title).setMessage(msg).setCancelable(false)
            .setPositiveButton("המשך") { _, _ -> go() }
            .setNegativeButton("לא עכשיו", null).show()
    }

    inner class Bridge {
        @JavascriptInterface fun hasApp(): Boolean = true

        /** true when the phone is in dark mode (the WebView does not always report it to the page by itself) */
        @JavascriptInterface fun isDark(): Boolean =
            (resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK) == android.content.res.Configuration.UI_MODE_NIGHT_YES

        @JavascriptInterface fun setTopic(t: String) {
            if (t.isBlank()) return
            val changed = Prefs.topic(this@MainActivity) != t
            if (changed) { Prefs.setTopic(this@MainActivity, t); Prefs.setSince(this@MainActivity, "") }
            runOnUiThread { ListenerService.start(this@MainActivity); ensurePermissions() }
        }

        @JavascriptInterface fun clear() {
            Prefs.setTopic(this@MainActivity, "")
            runOnUiThread { ListenerService.stop(this@MainActivity) }
        }

        @JavascriptInterface fun testAlarm() {
            Alarm.show(this@MainActivity, "בדיקת התראה ✔", "אם המסך הזה קפץ – האפליקציה מוגדרת נכון", arrayListOf())
        }

        @JavascriptInterface fun status(): String {
            val c = this@MainActivity
            val notif = Build.VERSION.SDK_INT < 33 || ContextCompat.checkSelfPermission(c, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
            val overlay = Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(c)
            val fsi = Build.VERSION.SDK_INT < 34 || c.getSystemService(NotificationManager::class.java).canUseFullScreenIntent()
            val batt = Build.VERSION.SDK_INT < 23 || c.getSystemService(PowerManager::class.java).isIgnoringBatteryOptimizations(c.packageName)
            return "{\"topic\":${Prefs.topic(c).isNotEmpty()},\"notif\":$notif,\"overlay\":$overlay,\"fsi\":$fsi,\"battery\":$batt}"
        }
    }
}
