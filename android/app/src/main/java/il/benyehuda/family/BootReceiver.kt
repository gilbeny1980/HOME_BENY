package il.benyehuda.family

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (Prefs.topic(context).isNotEmpty()) ListenerService.start(context)
    }
}
