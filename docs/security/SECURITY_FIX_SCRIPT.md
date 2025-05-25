# 🛠️ سكريبت الإصلاح السريع للمشاكل الأمنية

**تاريخ الإنشاء:** 2025-01-27  
**الغرض:** إصلاح المشاكل الأمنية المكتشفة في تقرير المراجعة  
**الأولوية:** عاجل 🚨

---

## 📋 قائمة الإصلاحات

### 🚨 إصلاحات عاجلة (24 ساعة)

#### 1. إصلاح سياسة كلمات المرور
**الملف:** `src/app/(auth)/signup/page.tsx`

```typescript
// ❌ الكود الحالي (ضعيف)
password: z.string().min(6, { message: t('auth.passwordMinLength', { length: '6' }) })

// ✅ الكود المحسن (قوي)
password: z.string()
  .min(8, { message: t('auth.passwordMinLength', { length: '8' }) })
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    { message: t('auth.passwordComplexity') }
  )
```

**الملف:** `src/app/(auth)/login/page.tsx`
```typescript
// تحديث نفس القاعدة في صفحة تسجيل الدخول
password: z.string()
  .min(8, { message: t('auth.passwordMinLength', { length: '8' }) })
```

#### 2. تقييد إعدادات CORS
**الملف:** `functions/src/shared/function-utils.ts`

```typescript
// ❌ الكود الحالي (غير آمن)
export const corsHandler = cors({ origin: true });

// ✅ الكود المحسن (آمن)
export const corsHandler = cors({ 
  origin: [
    'https://yourdomain.com',
    'https://www.yourdomain.com',
    'http://localhost:3000', // للتطوير فقط
    'http://localhost:3001'  // للتطوير فقط
  ],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});
```

#### 3. تشفير البيانات الحساسة (OTP)
**ملف جديد:** `functions/src/shared/crypto-utils.ts`

```typescript
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-char-secret-key-here!!';
const ALGORITHM = 'aes-256-gcm';

export class CryptoUtils {
  /**
   * تشفير النص
   */
  static encrypt(text: string): { encrypted: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(ALGORITHM, ENCRYPTION_KEY);
    cipher.setAAD(Buffer.from('additional-data'));
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex')
    };
  }

  /**
   * فك التشفير
   */
  static decrypt(encryptedData: { encrypted: string; iv: string; tag: string }): string {
    const decipher = crypto.createDecipher(ALGORITHM, ENCRYPTION_KEY);
    decipher.setAAD(Buffer.from('additional-data'));
    decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  /**
   * إنشاء hash للبيانات الحساسة
   */
  static hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * التحقق من hash
   */
  static verifyHash(data: string, hash: string): boolean {
    return this.hash(data) === hash;
  }
}
```

**تحديث:** `functions/src/email/index.ts`
```typescript
import { CryptoUtils } from '../shared/crypto-utils';

// ❌ الكود الحالي
await db.collection('debugOTP').doc(uid).set({
  otp,
  // ... باقي البيانات
});

// ✅ الكود المحسن
const hashedOTP = CryptoUtils.hash(otp);
await db.collection('debugOTP').doc(uid).set({
  otp: hashedOTP, // تخزين hash بدلاً من القيمة الأصلية
  // ... باقي البيانات
});
```

**تحديث:** `src/app/api/debug/verify-otp/route.ts`
```typescript
import { CryptoUtils } from '../../../functions/src/shared/crypto-utils';

// ❌ الكود الحالي
where('otp', '==', otp)

// ✅ الكود المحسن
const hashedOTP = CryptoUtils.hash(otp);
where('otp', '==', hashedOTP)
```

---

## ⚠️ إصلاحات متوسطة المدى (أسبوع)

#### 4. إضافة Rate Limiting
**ملف جديد:** `functions/src/shared/rate-limiter.ts`

```typescript
interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs: number;
}

export class RateLimiter {
  private attempts = new Map<string, { count: number; firstAttempt: number; blockedUntil?: number }>();

  constructor(private config: RateLimitConfig) {}

  /**
   * التحقق من إمكانية المحاولة
   */
  canAttempt(identifier: string): { allowed: boolean; remainingAttempts?: number; blockedUntil?: number } {
    const now = Date.now();
    const record = this.attempts.get(identifier);

    if (!record) {
      // أول محاولة
      this.attempts.set(identifier, { count: 1, firstAttempt: now });
      return { allowed: true, remainingAttempts: this.config.maxAttempts - 1 };
    }

    // التحقق من انتهاء فترة الحظر
    if (record.blockedUntil && now < record.blockedUntil) {
      return { allowed: false, blockedUntil: record.blockedUntil };
    }

    // التحقق من انتهاء النافذة الزمنية
    if (now - record.firstAttempt > this.config.windowMs) {
      // إعادة تعيين العداد
      this.attempts.set(identifier, { count: 1, firstAttempt: now });
      return { allowed: true, remainingAttempts: this.config.maxAttempts - 1 };
    }

    // زيادة العداد
    record.count++;

    if (record.count > this.config.maxAttempts) {
      // حظر المستخدم
      record.blockedUntil = now + this.config.blockDurationMs;
      return { allowed: false, blockedUntil: record.blockedUntil };
    }

    return { 
      allowed: true, 
      remainingAttempts: this.config.maxAttempts - record.count 
    };
  }

  /**
   * إعادة تعيين المحاولات للمستخدم
   */
  reset(identifier: string): void {
    this.attempts.delete(identifier);
  }
}

// إعدادات مختلفة للعمليات المختلفة
export const loginRateLimiter = new RateLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000, // 15 دقيقة
  blockDurationMs: 30 * 60 * 1000 // 30 دقيقة
});

export const otpRateLimiter = new RateLimiter({
  maxAttempts: 3,
  windowMs: 10 * 60 * 1000, // 10 دقائق
  blockDurationMs: 15 * 60 * 1000 // 15 دقيقة
});
```

**تحديث:** `src/components/debug/DebugAuthDialog.tsx`
```typescript
import { otpRateLimiter } from '../../../functions/src/shared/rate-limiter';

const handleVerifyOTP = async () => {
  const identifier = `${user?.uid || 'anonymous'}_${request.ip}`;
  const rateLimitResult = otpRateLimiter.canAttempt(identifier);

  if (!rateLimitResult.allowed) {
    const blockedUntil = new Date(rateLimitResult.blockedUntil!);
    toast({
      title: 'تم حظرك مؤقتاً',
      description: `يمكنك المحاولة مرة أخرى في ${blockedUntil.toLocaleTimeString()}`,
      variant: 'destructive',
    });
    return;
  }

  // باقي منطق التحقق...
  
  if (!success) {
    toast({
      title: 'خطأ',
      description: `رمز التحقق غير صحيح. المحاولات المتبقية: ${rateLimitResult.remainingAttempts}`,
      variant: 'destructive',
    });
  } else {
    // إعادة تعيين العداد عند النجاح
    otpRateLimiter.reset(identifier);
  }
};
```

#### 5. تحسين إدارة الأخطاء
**ملف جديد:** `functions/src/shared/error-handler.ts`

```typescript
export enum ErrorCode {
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  INVALID_INPUT = 'INVALID_INPUT',
  RATE_LIMITED = 'RATE_LIMITED',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

export interface SafeError {
  code: ErrorCode;
  message: string;
  details?: any;
}

export class ErrorHandler {
  /**
   * إنشاء خطأ آمن بدون كشف معلومات حساسة
   */
  static createSafeError(code: ErrorCode, userMessage: string, internalDetails?: any): SafeError {
    // تسجيل التفاصيل الداخلية للمطورين فقط
    if (internalDetails) {
      console.error(`[${code}] Internal details:`, internalDetails);
    }

    return {
      code,
      message: userMessage,
      // لا نرسل التفاصيل الداخلية للمستخدم
    };
  }

  /**
   * معالجة أخطاء المصادقة
   */
  static handleAuthError(error: any): SafeError {
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
      return this.createSafeError(
        ErrorCode.INSUFFICIENT_PERMISSIONS,
        'بيانات تسجيل الدخول غير صحيحة',
        error
      );
    }

    if (error.code === 'auth/too-many-requests') {
      return this.createSafeError(
        ErrorCode.RATE_LIMITED,
        'تم تجاوز عدد المحاولات المسموح. يرجى المحاولة لاحقاً',
        error
      );
    }

    return this.createSafeError(
      ErrorCode.INTERNAL_ERROR,
      'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى',
      error
    );
  }
}
```

**تحديث:** `functions/src/auth/auth.ts`
```typescript
import { ErrorHandler, ErrorCode } from '../shared/error-handler';

// ❌ الكود الحالي
if (!decodedToken.owner && !decodedToken.admin) {
  console.error(`User ${decodedToken.uid} is not an owner or admin`);
  res.status(403).json({ error: 'يجب أن تكون مالكًا أو مسؤولًا لتحديث دور المستخدم.' });
  return;
}

// ✅ الكود المحسن
if (!decodedToken.owner && !decodedToken.admin) {
  const safeError = ErrorHandler.createSafeError(
    ErrorCode.INSUFFICIENT_PERMISSIONS,
    'غير مصرح بالوصول إلى هذه الوظيفة',
    { userId: decodedToken.uid, requiredRole: 'owner_or_admin' }
  );
  res.status(403).json(safeError);
  return;
}
```

---

## 🔧 إصلاح المستخدم المشكوك فيه

**ملف جديد:** `scripts/fix-user-roles.js`

```javascript
const admin = require('firebase-admin');

// تهيئة Firebase Admin
admin.initializeApp();
const db = admin.firestore();

async function fixUserRoles(uid) {
  try {
    console.log(`🔧 بدء إصلاح المستخدم: ${uid}`);

    // 1. الحصول على بيانات المستخدم الحالية
    const userRecord = await admin.auth().getUser(uid);
    const userDoc = await db.collection('users').doc(uid).get();

    if (!userDoc.exists) {
      throw new Error('المستخدم غير موجود في Firestore');
    }

    const userData = userDoc.data();
    console.log('📊 البيانات الحالية:', userData);

    // 2. تحديد الدور الصحيح
    const correctRole = 'system_owner'; // أو حسب المطلوب

    // 3. إنشاء Claims صحيحة
    const correctClaims = {
      role: correctRole,
      accountType: 'individual',
      
      // الأدوار الجديدة (واحد فقط)
      system_owner: correctRole === 'system_owner',
      system_admin: false,
      organization_owner: false,
      admin: false,
      
      // النظام القديم (للتوافق)
      owner: correctRole === 'system_owner',
      individual_admin: false
    };

    // 4. تحديث Custom Claims
    await admin.auth().setCustomUserClaims(uid, correctClaims);
    console.log('✅ تم تحديث Custom Claims');

    // 5. تحديث Firestore
    const correctFirestoreData = {
      role: correctRole,
      
      // الأدوار الجديدة
      isSystemOwner: correctRole === 'system_owner',
      isSystemAdmin: false,
      isOrganizationOwner: false,
      isAdmin: false,
      
      // النظام القديم
      isOwner: correctRole === 'system_owner',
      owner: correctRole === 'system_owner',
      admin: false,
      
      // تنظيف البيانات
      isIndividualAdmin: false,
      
      // تحديث التواريخ
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastClaimsUpdate: admin.firestore.FieldValue.serverTimestamp(),
      fixedRoles: true,
      fixedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('users').doc(uid).update(correctFirestoreData);
    console.log('✅ تم تحديث Firestore');

    // 6. فرض التحقق من البريد الإلكتروني إذا لم يكن محققاً
    if (!userRecord.emailVerified) {
      console.log('📧 البريد الإلكتروني غير محقق - يجب التحقق يدوياً');
    }

    // 7. تسجيل الإصلاح
    await db.collection('securityLogs').add({
      action: 'USER_ROLES_FIXED',
      userId: uid,
      oldData: userData,
      newData: correctFirestoreData,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      fixedBy: 'SECURITY_SCRIPT'
    });

    console.log('🎉 تم إصلاح المستخدم بنجاح!');
    
    return {
      success: true,
      oldClaims: userRecord.customClaims,
      newClaims: correctClaims,
      message: 'تم إصلاح الأدوار بنجاح'
    };

  } catch (error) {
    console.error('❌ خطأ في إصلاح المستخدم:', error);
    throw error;
  }
}

// تشغيل السكريبت
const uid = process.argv[2];
if (!uid) {
  console.error('❌ يجب توفير معرف المستخدم');
  console.log('الاستخدام: node fix-user-roles.js <USER_UID>');
  process.exit(1);
}

fixUserRoles(uid)
  .then(result => {
    console.log('✅ النتيجة:', result);
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ فشل الإصلاح:', error);
    process.exit(1);
  });
```

---

## 📅 خطة التنفيذ

### المرحلة 1: الإصلاحات العاجلة (24 ساعة)
1. ✅ تحديث سياسة كلمات المرور
2. ✅ تقييد CORS
3. ✅ تشفير OTP
4. ✅ إصلاح المستخدم المشكوك فيه

### المرحلة 2: التحسينات المتوسطة (أسبوع)
1. ✅ إضافة Rate Limiting
2. ✅ تحسين إدارة الأخطاء
3. ✅ تطبيق السجلات الأمنية

### المرحلة 3: المراقبة والاختبار (أسبوعين)
1. ✅ اختبار جميع الإصلاحات
2. ✅ مراقبة الأداء
3. ✅ تدريب الفريق

---

## 🧪 اختبار الإصلاحات

```bash
# 1. اختبار سياسة كلمات المرور
npm run test:password-policy

# 2. اختبار CORS
npm run test:cors

# 3. اختبار التشفير
npm run test:encryption

# 4. اختبار Rate Limiting
npm run test:rate-limiting

# 5. اختبار شامل
npm run test:security
```

---

*تم إنشاء هذا السكريبت بواسطة Augment Agent - 2025-01-27*
