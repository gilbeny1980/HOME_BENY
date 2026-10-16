package il.benyehuda.family

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

/** Keeps a connection to the family's private ntfy topic and raises a full-screen alarm for every reminder. */
class ListenerService : Service() {
    @Volatile private var running = false
    private var worker: Thread? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForegroundCompat()
        if (!running) {
            running = true
            worker = Thread { loop() }.also { it.isDaemon = true; it.start() }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        running = false
        worker?.interrupt()
        super.onDestroy()
    }

    private fun startForegroundCompat() {
        val nm = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 26) {
            nm.createNotificationChannel(NotificationChannel("listen", "מאזין להתראות", NotificationManager.IMPORTANCE_MIN))
        }
        val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE)
        val n: Notification = NotificationCompat.Builder(this, "listen")
            .setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle("בן יהודה – מאזין להתראות")
            .setContentIntent(open)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .build()
        if (Build.VERSION.SDK_INT >= 29) startForeground(1, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
        else startForeground(1, n)
    }

    private fun loop() {
        var backoff = 3000L
        while (running) {
            val topic = Prefs.topic(this)
            if (topic.isEmpty()) { stopSelf(); return }
            try {
                var since = Prefs.since(this)
                Prefs.installedAt(this)
                since = Prefs.since(this)
                if (since.isEmpty()) { since = (System.currentTimeMillis() / 1000).toString(); Prefs.setSince(this, since) }
                val conn = URL("https://ntfy.sh/$topic/json?since=$since").openConnection() as HttpURLConnection
                conn.connectTimeout = 15000
                conn.readTimeout = 150000
                BufferedReader(InputStreamReader(conn.inputStream, Charsets.UTF_8)).use { r ->
                    connectedAt = System.currentTimeMillis()
                    backoff = 3000L
                    while (running) {
                        val line = r.readLine() ?: break
                        connectedAt = System.currentTimeMillis()
                        if (line.isBlank()) continue
                        handle(line)
                    }
                }
            } catch (e: Exception) {
                // connection dropped – retry below
            }
            if (!running) break
            try { Thread.sleep(backoff) } catch (e: InterruptedException) { break }
            backoff = (backoff * 2).coerceAtMost(60000L)
        }
    }

    private fun handle(line: String) {
        val j = try { JSONObject(line) } catch (e: Exception) { return }
        val id = j.optString("id")
        if (id.isNotEmpty()) Prefs.setSince(this, id)
        if (j.optString("event") != "message") return
        // only reminders that arrived after installation and are still fresh
        val sent = j.optLong("time", 0L) * 1000
        val now = System.currentTimeMillis()
        if (sent > 0 && (sent < Prefs.installedAt(this) || now - sent > 30 * 60 * 1000L)) return
        val actions = ArrayList<Array<String>>()
        j.optJSONArray("actions")?.let { arr ->
            for (i in 0 until arr.length()) {
                val a = arr.getJSONObject(i)
                if (a.optString("action") == "http") {
                    actions.add(arrayOf(a.optString("label"), a.optString("url"), a.optString("method", "POST"), a.optString("body"), a.optJSONObject("headers")?.toString() ?: "{}"))
                }
            }
        }
        Alarm.show(this, j.optString("title", "תזכורת"), j.optString("message"), actions)
    }

    companion object {
        @Volatile var connectedAt = 0L
        fun start(c: Context) {
            ContextCompat.startForegroundService(c, Intent(c, ListenerService::class.java))
        }
        fun stop(c: Context) { c.stopService(Intent(c, ListenerService::class.java)) }
    }
}
