# دليل نشر دوال Firebase للمؤسسات (tasks-intelligence)

# 1. سجّل دخولك للـ Firebase CLI (إذا لم تفعّل بعد)
firebase login

# 2. حدّد مشروع المؤسسات ليكون الافتراضي
firebase use --add
# → اختر "tasks-intelligence" ثم اعطه alias (مثلاً "organization")

# 3. ثبّت التبعيات (بما فيها typescript)
npm install

# 4. شغّل البناء (tsc) لترجمة .ts → .js بمجلّد lib/
npm run build

# 5. انشر دوال Cloud Functions لمشروع المؤسسات
firebase deploy --only functions

# 6. راجع سجلّات الدوال لمعرفة إذا نُفّذت بنجاح أو ظهرت أخطاء
firebase functions:log

# (اختياري) لتشغيل محاكي الدوال محلياً:
firebase emulators:start --only functions

# ملاحظات هامة:
# - تأكد من أنك تستخدم مشروع "tasks-intelligence" عند نشر دوال المؤسسات
# - يمكنك التحقق من المشروع الحالي باستخدام الأمر: firebase use
# - للتبديل بين المشاريع استخدم: firebase use [alias]
