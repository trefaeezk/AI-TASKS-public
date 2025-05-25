#!/usr/bin/env node

/**
 * سكريبت الإصلاح السريع للمشاكل الأمنية
 *
 * الاستخدام:
 * node scripts/security-fixes.js --fix=all
 * node scripts/security-fixes.js --fix=user --uid=USER_ID
 * node scripts/security-fixes.js --check
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// تحميل متغيرات البيئة
require('dotenv').config();

// تهيئة Firebase Admin
if (admin.apps.length === 0) {
  try {
    // البحث عن ملف Service Account
    const serviceAccountPaths = [
      './functions/serviceAccountKey.json',
      './serviceAccountKey.json',
      './firebase-adminsdk.json'
    ];

    let serviceAccountPath = null;
    for (const path of serviceAccountPaths) {
      if (fs.existsSync(path)) {
        serviceAccountPath = path;
        break;
      }
    }

    if (serviceAccountPath) {
      // التهيئة باستخدام Service Account Key
      const serviceAccount = require(serviceAccountPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
      console.log(`✅ تم تهيئة Firebase Admin باستخدام: ${serviceAccountPath}`);
    } else if (process.env.FIREBASE_PROJECT_ID) {
      // التهيئة باستخدام متغيرات البيئة
      admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID,
        credential: admin.credential.applicationDefault()
      });
      console.log('✅ تم تهيئة Firebase Admin باستخدام متغيرات البيئة');
    } else {
      // التهيئة الافتراضية
      admin.initializeApp();
      console.log('✅ تم تهيئة Firebase Admin بالإعدادات الافتراضية');
    }
  } catch (error) {
    console.error('❌ خطأ في تهيئة Firebase Admin:', error.message);
    console.log('\n💡 حلول مقترحة:');
    console.log('1. ضع ملف serviceAccountKey.json في مجلد functions/');
    console.log('2. أو اضبط متغير البيئة FIREBASE_PROJECT_ID');
    console.log('3. أو استخدم: firebase login');
    process.exit(1);
  }
}

const db = admin.firestore();

class SecurityFixer {
  constructor() {
    this.fixes = {
      user: this.fixUserRoles.bind(this),
      cors: this.fixCorsSettings.bind(this),
      password: this.fixPasswordPolicy.bind(this),
      encryption: this.setupEncryption.bind(this),
      rateLimit: this.setupRateLimit.bind(this),
      all: this.fixAll.bind(this)
    };
  }

  /**
   * إصلاح أدوار المستخدم المشكوك فيه
   */
  async fixUserRoles(uid) {
    if (!uid) {
      throw new Error('معرف المستخدم مطلوب لإصلاح الأدوار');
    }

    console.log(`🔧 بدء إصلاح المستخدم: ${uid}`);

    try {
      // الحصول على بيانات المستخدم
      const userRecord = await admin.auth().getUser(uid);
      const userDoc = await db.collection('users').doc(uid).get();

      if (!userDoc.exists) {
        throw new Error('المستخدم غير موجود في Firestore');
      }

      const userData = userDoc.data();
      console.log('📊 البيانات الحالية:', {
        role: userData.role,
        isSystemOwner: userData.isSystemOwner,
        isSystemAdmin: userData.isSystemAdmin,
        isAdmin: userData.isAdmin
      });

      // تحديد الدور الصحيح
      const correctRole = 'system_owner';

      // إنشاء Claims صحيحة
      const correctClaims = {
        role: correctRole,
        accountType: 'individual',
        system_owner: true,
        system_admin: false,
        organization_owner: false,
        admin: false,
        owner: true,
        individual_admin: false
      };

      // تحديث Custom Claims
      await admin.auth().setCustomUserClaims(uid, correctClaims);
      console.log('✅ تم تحديث Custom Claims');

      // تحديث Firestore
      const correctFirestoreData = {
        role: correctRole,
        isSystemOwner: true,
        isSystemAdmin: false,
        isOrganizationOwner: false,
        isAdmin: false,
        isOwner: true,
        owner: true,
        admin: false,
        isIndividualAdmin: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastClaimsUpdate: admin.firestore.FieldValue.serverTimestamp(),
        fixedRoles: true,
        fixedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await db.collection('users').doc(uid).update(correctFirestoreData);
      console.log('✅ تم تحديث Firestore');

      // تسجيل الإصلاح
      await db.collection('securityLogs').add({
        action: 'USER_ROLES_FIXED',
        userId: uid,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        fixedBy: 'SECURITY_SCRIPT',
        details: {
          oldRole: userData.role,
          newRole: correctRole,
          conflictsFixed: true
        }
      });

      console.log('🎉 تم إصلاح المستخدم بنجاح!');
      return { success: true, message: 'تم إصلاح الأدوار بنجاح' };

    } catch (error) {
      console.error('❌ خطأ في إصلاح المستخدم:', error);
      throw error;
    }
  }

  /**
   * إصلاح إعدادات CORS
   */
  async fixCorsSettings() {
    console.log('🔧 إصلاح إعدادات CORS...');

    const corsConfigPath = path.join(process.cwd(), 'functions/src/shared/function-utils.ts');

    if (!fs.existsSync(corsConfigPath)) {
      throw new Error('ملف CORS غير موجود');
    }

    let content = fs.readFileSync(corsConfigPath, 'utf8');

    // استبدال الإعداد غير الآمن
    const unsafePattern = /cors\(\s*{\s*origin:\s*true\s*}\s*\)/g;
    const safeConfig = `cors({
  origin: [
    'https://yourdomain.com',
    'https://www.yourdomain.com',
    'http://localhost:3000',
    'http://localhost:3001'
  ],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
})`;

    if (unsafePattern.test(content)) {
      content = content.replace(unsafePattern, safeConfig);
      fs.writeFileSync(corsConfigPath, content);
      console.log('✅ تم إصلاح إعدادات CORS');
      return { success: true, message: 'تم تحديث إعدادات CORS' };
    } else {
      console.log('ℹ️ إعدادات CORS تبدو آمنة بالفعل');
      return { success: true, message: 'إعدادات CORS آمنة' };
    }
  }

  /**
   * إصلاح سياسة كلمات المرور
   */
  async fixPasswordPolicy() {
    console.log('🔧 إصلاح سياسة كلمات المرور...');

    const files = [
      'src/app/(auth)/signup/page.tsx',
      'src/app/(auth)/login/page.tsx'
    ];

    let fixedFiles = 0;

    for (const filePath of files) {
      const fullPath = path.join(process.cwd(), filePath);

      if (!fs.existsSync(fullPath)) {
        console.log(`⚠️ الملف غير موجود: ${filePath}`);
        continue;
      }

      let content = fs.readFileSync(fullPath, 'utf8');

      // البحث عن سياسة كلمة المرور الضعيفة
      const weakPasswordPattern = /password:\s*z\.string\(\)\.min\(6[^}]*\)/g;
      const strongPasswordPattern = `password: z.string()
  .min(8, { message: t('auth.passwordMinLength', { length: '8' }) })
  .regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[@$!%*?&])[A-Za-z\\d@$!%*?&]/,
    { message: t('auth.passwordComplexity') }
  )`;

      if (weakPasswordPattern.test(content)) {
        content = content.replace(weakPasswordPattern, strongPasswordPattern);
        fs.writeFileSync(fullPath, content);
        fixedFiles++;
        console.log(`✅ تم إصلاح: ${filePath}`);
      }
    }

    if (fixedFiles > 0) {
      console.log(`✅ تم إصلاح ${fixedFiles} ملف`);
      return { success: true, message: `تم تحديث ${fixedFiles} ملف` };
    } else {
      console.log('ℹ️ سياسة كلمات المرور تبدو قوية بالفعل');
      return { success: true, message: 'سياسة كلمات المرور قوية' };
    }
  }

  /**
   * إعداد التشفير
   */
  async setupEncryption() {
    console.log('🔧 إعداد نظام التشفير...');

    const cryptoUtilsPath = path.join(process.cwd(), 'functions/src/shared/crypto-utils.ts');

    const cryptoUtilsContent = `import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-char-secret-key-here!!';

export class CryptoUtils {
  static hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  static verifyHash(data: string, hash: string): boolean {
    return this.hash(data) === hash;
  }

  static generateSalt(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  static hashWithSalt(data: string, salt: string): string {
    return crypto.createHash('sha256').update(data + salt).digest('hex');
  }
}`;

    // إنشاء المجلد إذا لم يكن موجوداً
    const dir = path.dirname(cryptoUtilsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(cryptoUtilsPath, cryptoUtilsContent);
    console.log('✅ تم إنشاء ملف التشفير');

    return { success: true, message: 'تم إعداد نظام التشفير' };
  }

  /**
   * إعداد Rate Limiting
   */
  async setupRateLimit() {
    console.log('🔧 إعداد Rate Limiting...');

    const rateLimiterPath = path.join(process.cwd(), 'functions/src/shared/rate-limiter.ts');

    const rateLimiterContent = `interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  blockDurationMs: number;
}

export class RateLimiter {
  private attempts = new Map<string, { count: number; firstAttempt: number; blockedUntil?: number }>();

  constructor(private config: RateLimitConfig) {}

  canAttempt(identifier: string): { allowed: boolean; remainingAttempts?: number; blockedUntil?: number } {
    const now = Date.now();
    const record = this.attempts.get(identifier);

    if (!record) {
      this.attempts.set(identifier, { count: 1, firstAttempt: now });
      return { allowed: true, remainingAttempts: this.config.maxAttempts - 1 };
    }

    if (record.blockedUntil && now < record.blockedUntil) {
      return { allowed: false, blockedUntil: record.blockedUntil };
    }

    if (now - record.firstAttempt > this.config.windowMs) {
      this.attempts.set(identifier, { count: 1, firstAttempt: now });
      return { allowed: true, remainingAttempts: this.config.maxAttempts - 1 };
    }

    record.count++;

    if (record.count > this.config.maxAttempts) {
      record.blockedUntil = now + this.config.blockDurationMs;
      return { allowed: false, blockedUntil: record.blockedUntil };
    }

    return {
      allowed: true,
      remainingAttempts: this.config.maxAttempts - record.count
    };
  }

  reset(identifier: string): void {
    this.attempts.delete(identifier);
  }
}

export const loginRateLimiter = new RateLimiter({
  maxAttempts: 5,
  windowMs: 15 * 60 * 1000,
  blockDurationMs: 30 * 60 * 1000
});

export const otpRateLimiter = new RateLimiter({
  maxAttempts: 3,
  windowMs: 10 * 60 * 1000,
  blockDurationMs: 15 * 60 * 1000
});`;

    const dir = path.dirname(rateLimiterPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(rateLimiterPath, rateLimiterContent);
    console.log('✅ تم إنشاء ملف Rate Limiter');

    return { success: true, message: 'تم إعداد Rate Limiting' };
  }

  /**
   * تطبيق جميع الإصلاحات
   */
  async fixAll() {
    console.log('🚀 بدء تطبيق جميع الإصلاحات...');

    const results = [];

    try {
      results.push(await this.fixCorsSettings());
      results.push(await this.fixPasswordPolicy());
      results.push(await this.setupEncryption());
      results.push(await this.setupRateLimit());

      console.log('🎉 تم تطبيق جميع الإصلاحات بنجاح!');
      return { success: true, results };

    } catch (error) {
      console.error('❌ خطأ في تطبيق الإصلاحات:', error);
      throw error;
    }
  }

  /**
   * فحص الحالة الأمنية
   */
  async checkSecurity() {
    console.log('🔍 فحص الحالة الأمنية...');

    const issues = [];

    // فحص CORS
    const corsPath = path.join(process.cwd(), 'functions/src/shared/function-utils.ts');
    if (fs.existsSync(corsPath)) {
      const content = fs.readFileSync(corsPath, 'utf8');
      if (content.includes('origin: true')) {
        issues.push('⚠️ إعدادات CORS غير آمنة');
      }
    }

    // فحص سياسة كلمات المرور
    const signupPath = path.join(process.cwd(), 'src/app/(auth)/signup/page.tsx');
    if (fs.existsSync(signupPath)) {
      const content = fs.readFileSync(signupPath, 'utf8');
      if (content.includes('.min(6')) {
        issues.push('⚠️ سياسة كلمات المرور ضعيفة');
      }
    }

    // فحص المستخدمين المشكوك فيهم
    try {
      const usersSnapshot = await db.collection('users')
        .where('isSystemOwner', '==', true)
        .where('isSystemAdmin', '==', true)
        .get();

      if (!usersSnapshot.empty) {
        issues.push(`⚠️ ${usersSnapshot.size} مستخدم لديه أدوار متضاربة`);
      }
    } catch (error) {
      console.error('خطأ في فحص المستخدمين:', error);
    }

    if (issues.length === 0) {
      console.log('✅ لم يتم العثور على مشاكل أمنية');
    } else {
      console.log('🚨 المشاكل المكتشفة:');
      issues.forEach(issue => console.log(`  ${issue}`));
    }

    return { issues };
  }

  /**
   * تشغيل الإصلاح المحدد
   */
  async run(fixType, options = {}) {
    if (!this.fixes[fixType]) {
      throw new Error(`نوع الإصلاح غير مدعوم: ${fixType}`);
    }

    return await this.fixes[fixType](options.uid);
  }
}

// تشغيل السكريبت
async function main() {
  const args = process.argv.slice(2);
  const fixer = new SecurityFixer();

  try {
    if (args.includes('--check')) {
      await fixer.checkSecurity();
      return;
    }

    const fixArg = args.find(arg => arg.startsWith('--fix='));
    if (!fixArg) {
      console.log('الاستخدام:');
      console.log('  node scripts/security-fixes.js --fix=all');
      console.log('  node scripts/security-fixes.js --fix=user --uid=USER_ID');
      console.log('  node scripts/security-fixes.js --check');
      return;
    }

    const fixType = fixArg.split('=')[1];
    const uidArg = args.find(arg => arg.startsWith('--uid='));
    const uid = uidArg ? uidArg.split('=')[1] : null;

    const result = await fixer.run(fixType, { uid });
    console.log('✅ النتيجة:', result);

  } catch (error) {
    console.error('❌ خطأ:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = SecurityFixer;
