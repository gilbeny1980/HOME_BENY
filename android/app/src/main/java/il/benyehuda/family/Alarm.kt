package il.benyehuda.family

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationCompat

object Alarm {
    const val CH = "alarm"
    const val X_TITLE = "title"
    const val X_BODY = "body"
    const val X_ACTIONS = "actions"

    /** Opens the full-screen alarm: directly over any app (if "display over other apps" is allowed) and as a full-screen-intent notification. */
    fun show(ctx: Context, title: String, body: String, actions: ArrayList<Array<String>>) {
        val nm = ctx.getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 26) {
            val ch = NotificationChannel(CH, "התראות דחופות", NotificationManager.IMPORTANCE_HIGH)
            ch.enableVibration(true)
            ch.lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            nm.createNotificationChannel(ch)
        }
        val intent = Intent(ctx, AlarmActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            .putExtra(X_TITLE, title).putExtra(X_BODY, body)
            .putExtra(X_ACTIONS, ArrayList(actions.map { it.joinToString("\u0001") }))
        val pi = PendingIntent.getActivity(ctx, (System.currentTimeMillis() % 100000).toInt(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val n = NotificationCompat.Builder(ctx, CH)
            .setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setCategory(NotificationCompat.CATEGORY_ALARM)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setContentIntent(pi)
            .setFullScreenIntent(pi, true)
            .build()
        try { nm.notify((System.currentTimeMillis() % 100000).toInt() + 100, n) } catch (e: SecurityException) { }
        // direct launch works when the user allowed "display over other apps"
        if (Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(ctx)) {
            try { ctx.startActivity(intent) } catch (e: Exception) { }
        }
    }
}
