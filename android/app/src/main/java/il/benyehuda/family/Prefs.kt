package il.benyehuda.family

import android.content.Context

object Prefs {
    const val SITE = "https://homework-beta-eight.vercel.app"
    private fun sp(c: Context) = c.getSharedPreferences("by", Context.MODE_PRIVATE)
    fun topic(c: Context): String = sp(c).getString("topic", "") ?: ""
    fun setTopic(c: Context, t: String) = sp(c).edit().putString("topic", t).apply()
    fun sound(c: Context): String = sp(c).getString("sound", "msg") ?: "msg"
    fun setSound(c: Context, s: String) = sp(c).edit().putString("sound", s).apply()
    fun since(c: Context): String = sp(c).getString("since", "") ?: ""
    fun setSince(c: Context, s: String) = sp(c).edit().putString("since", s).apply()
}
