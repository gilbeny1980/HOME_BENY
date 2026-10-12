// Diagnostics: shows which environment variables are set (never their values).
module.exports = (req, res) => {
  const e = process.env, has = k => !!e[k];
  res.status(200).json({
    TURSO_DATABASE_URL: has('TURSO_DATABASE_URL'), TURSO_AUTH_TOKEN: has('TURSO_AUTH_TOKEN'),
    FAMILY_CODE: has('FAMILY_CODE'), ADMIN_EMAIL: has('ADMIN_EMAIL'), RESEND_API_KEY: has('RESEND_API_KEY'),
    VAPID_PUBLIC_KEY: has('VAPID_PUBLIC_KEY'), VAPID_PRIVATE_KEY: has('VAPID_PRIVATE_KEY'), VAPID_SUBJECT: has('VAPID_SUBJECT'),
    CRON_SECRET: has('CRON_SECRET'), CRON_SECRET_length: (e.CRON_SECRET || '').length,
    env: e.VERCEL_ENV || null,
  });
};
