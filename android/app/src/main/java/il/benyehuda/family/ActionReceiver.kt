package il.benyehuda.family

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/** Handles the buttons on the notification itself (done / snooze) without opening the app. */
class ActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val nid = intent.getIntExtra(Alarm.X_NID, -1)
        if (nid >= 0) context.getSystemService(NotificationManager::class.java).cancel(nid)
        val url = intent.getStringExtra("url") ?: return
        val method = intent.getStringExtra("method") ?: "POST"
        val body = intent.getStringExtra("body") ?: ""
        val headers = intent.getStringExtra("headers") ?: "{}"
        val pr = goAsync()
        Thread {
            try {
                val c = URL(url).openConnection() as HttpURLConnection
                c.requestMethod = method; c.connectTimeout = 15000; c.readTimeout = 15000
                val h = JSONObject(headers)
                for (k in h.keys()) c.setRequestProperty(k, h.getString(k))
                if (body.isNotEmpty()) { c.doOutput = true; c.outputStream.use { it.write(body.toByteArray()) } }
                c.responseCode
            } catch (e: Exception) { }
            pr.finish()
        }.start()
    }
}
