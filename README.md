# ניהול משימות משפחת בן יהודה
PWA בעברית (RTL): משימות, לוח שנה עם תזכורות, אנשי קשר (התקשרות / SMS / וואטסאפ / Waze) והערות.
הנתונים משותפים בין כל המכשירים (Upstash Redis) ותזכורות Push מגיעות גם כשהאפליקציה סגורה.

## הקמה (חד־פעמית)
1. **Vercel**: Add New → Project → ייבוא הריפו (Framework: Other, ללא build).
2. **מסד נתונים**: ב-Vercel → Storage → Marketplace → Upstash Redis → חיבור לפרויקט (מגדיר `KV_REST_API_URL` ו-`KV_REST_API_TOKEN`).
3. **מפתחות Push**: `npx web-push generate-vapid-keys`
4. **Environment Variables ב-Vercel** (ואז Redeploy):
   - `FAMILY_CODE` – קוד משפחתי סודי (כל בני המשפחה מזינים אותו באפליקציה בפעם הראשונה)
   - `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (למשל `mailto:you@example.com`)
   - `CRON_SECRET` – מחרוזת אקראית
5. **GitHub → Settings → Secrets → Actions**: `CRON_SECRET` (אותו ערך) ו-`SITE_URL` (למשל `https://your-app.vercel.app`). ה-workflow `reminders.yml` בודק תזכורות כל 5 דקות.
6. בכל מכשיר: פתחו את האתר, הזינו את הקוד, לחצו "הפעל תזכורות". באייפון יש קודם להוסיף למסך הבית.

מיזוג נתונים: לכל פריט חותמת `u`, והחדש מנצח; מחיקה היא סימון `del`.
