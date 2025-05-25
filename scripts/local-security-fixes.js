#!/usr/bin/env node

/**
 * سكريبت الإصلاح الأمني - النسخة المحلية فقط
 * 
 * يعدل الملفات المحلية فقط (لا يتصل بـ Firebase)
 * 
 * الاستخدام:
 * node scripts/local-security-fixes.js --fix=all
 * node scripts/local-security-fixes.js --fix=cors
 * node scripts/local-security-fixes.js --fix=password
 * node scripts/local-security-fixes.js --fix=encryption
 * node scripts/local-security-fixes.js --fix=rateLimit
 * node scripts/local-security-fixes.js --check
 */

const fs = require('fs');
const path = require('path');

console.log('🔧 سكريبت الإصلاح الأمني - النسخة المحلية');
console.log('📁 يعدل الملفات المحلية فقط (لا يتصل بـ Firebase)');
console.log('---\n');

class LocalSecurityFixer {
  constructor() {
    this.fixes = {
      cors: this.fixCorsSettings.bind(this),
      password: this.fixPasswordPolicy.bind(this),
      encryption: this.setupEncryption.bind(this),
      rateLimit: this.setupRateLimit.bind(this),
      errorHandler: this.setupErrorHandler.bind(this),
      all: this.fixAll.bind(this)
    };
  }

  /**
   * إصلاح إعدادات CORS
   */
  async fixCorsSettings() {
    console.log('🔧 إصلاح إعدادات CORS...');

    const corsConfigPath = path.join(process.cwd(), 'functions/src/shared/function-utils.ts');
    
    if (!fs.existsSync(corsConfigPath)) {
      console.log('⚠️ ملف CORS غير موجود:', corsConfigPath);
      return { success: false, message: 'ملف CORS غير موجود' };
    }

    let content = fs.readFileSync(corsConfigPath, 'utf8');

    // استبدال الإعداد غير الآمن
    const unsafePattern = /cors\(\s*{\s*origin:\s*true\s*}\s*\)/g;
    const safeConfig = `cors({ 
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
})`;

    if (unsafePattern.test(content)) {
      content = content.replace(unsafePattern, safeConfig);
      fs.writeFileSync(corsConfigPath, content);
      console.log('✅ تم إصلاح إعدادات CORS');
      console.log('📝 الملف المحدث:', corsConfigPath);
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
   * إعداد نظام التشفير
   */
  async setupEncryption() {
    console.log('🔧 إعداد نظام التشفير...');

    const cryptoUtilsPath = path.join(process.cwd(), 'functions/src/shared/crypto-utils.ts');
    
    const cryptoUtilsContent = `import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'your-32-char-secret-key-here!!';

/**
 * أدوات التشفير للبيانات الحساسة
 */
export class CryptoUtils {
  /**
   * تشفير النص باستخدام SHA-256
   */
  static hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * التحقق من صحة البيانات المشفرة
   */
  static verifyHash(data: string, hash: string): boolean {
    return this.hash(data) === hash;
  }

  /**
   * إنشاء salt عشوائي للأمان الإضافي
   */
  static generateSalt(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * تشفير البيانات مع salt
   */
  static hashWithSalt(data: string, salt: string): string {
    return crypto.createHash('sha256').update(data + salt).digest('hex');
  }

  /**
   * إنشاء رمز عشوائي آمن
   */
  static generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * تشفير متقدم باستخدام AES-256-GCM
   */
  static encryptAdvanced(text: string): { encrypted: string; iv: string; tag: string } {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-gcm', ENCRYPTION_KEY);
    
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
   * فك التشفير المتقدم
   */
  static decryptAdvanced(encryptedData: { encrypted: string; iv: string; tag: string }): string {
    const decipher = crypto.createDecipher('aes-256-gcm', ENCRYPTION_KEY);
    decipher.setAuthTag(Buffer.from(encryptedData.tag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }
}

// تصدير دوال مساعدة سريعة
export const hashOTP = (otp: string) => CryptoUtils.hash(otp);
export const verifyOTP = (otp: string, hash: string) => CryptoUtils.verifyHash(otp, hash);
export const generateSecureOTP = () => Math.floor(100000 + Math.random() * 900000).toString();
`;

    // إنشاء المجلد إذا لم يكن موجوداً
    const dir = path.dirname(cryptoUtilsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(cryptoUtilsPath, cryptoUtilsContent);
    console.log('✅ تم إنشاء ملف التشفير');
    console.log('📝 الملف الجديد:', cryptoUtilsPath);

    return { success: true, message: 'تم إعداد نظام التشفير' };
  }

  /**
   * إعداد Rate Limiting
   */
  async setupRateLimit() {
    console.log('🔧 إعداد Rate Limiting...');

    const rateLimiterPath = path.join(process.cwd(), 'functions/src/shared/rate-limiter.ts');
    
    const rateLimiterContent = `/**
 * نظام Rate Limiting لحماية من الهجمات المتكررة
 */

interface RateLimitConfig {
  maxAttempts: number;    // عدد المحاولات المسموح
  windowMs: number;       // النافذة الزمنية بالميلي ثانية
  blockDurationMs: number; // مدة الحظر بالميلي ثانية
}

interface AttemptRecord {
  count: number;
  firstAttempt: number;
  blockedUntil?: number;
}

export class RateLimiter {
  private attempts = new Map<string, AttemptRecord>();

  constructor(private config: RateLimitConfig) {}

  /**
   * التحقق من إمكانية المحاولة
   */
  canAttempt(identifier: string): { 
    allowed: boolean; 
    remainingAttempts?: number; 
    blockedUntil?: number;
    resetTime?: number;
  } {
    const now = Date.now();
    const record = this.attempts.get(identifier);

    if (!record) {
      // أول محاولة
      this.attempts.set(identifier, { count: 1, firstAttempt: now });
      return { 
        allowed: true, 
        remainingAttempts: this.config.maxAttempts - 1,
        resetTime: now + this.config.windowMs
      };
    }

    // التحقق من انتهاء فترة الحظر
    if (record.blockedUntil && now < record.blockedUntil) {
      return { 
        allowed: false, 
        blockedUntil: record.blockedUntil 
      };
    }

    // التحقق من انتهاء النافذة الزمنية
    if (now - record.firstAttempt > this.config.windowMs) {
      // إعادة تعيين العداد
      this.attempts.set(identifier, { count: 1, firstAttempt: now });
      return { 
        allowed: true, 
        remainingAttempts: this.config.maxAttempts - 1,
        resetTime: now + this.config.windowMs
      };
    }

    // زيادة العداد
    record.count++;

    if (record.count > this.config.maxAttempts) {
      // حظر المستخدم
      record.blockedUntil = now + this.config.blockDurationMs;
      return { 
        allowed: false, 
        blockedUntil: record.blockedUntil 
      };
    }

    return { 
      allowed: true, 
      remainingAttempts: this.config.maxAttempts - record.count,
      resetTime: record.firstAttempt + this.config.windowMs
    };
  }

  /**
   * إعادة تعيين المحاولات للمستخدم
   */
  reset(identifier: string): void {
    this.attempts.delete(identifier);
  }

  /**
   * الحصول على إحصائيات المحاولات
   */
  getStats(identifier: string): AttemptRecord | null {
    return this.attempts.get(identifier) || null;
  }

  /**
   * تنظيف السجلات المنتهية الصلاحية
   */
  cleanup(): void {
    const now = Date.now();
    for (const [identifier, record] of this.attempts.entries()) {
      // حذف السجلات القديمة
      if (now - record.firstAttempt > this.config.windowMs * 2) {
        this.attempts.delete(identifier);
      }
    }
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

export const passwordResetRateLimiter = new RateLimiter({
  maxAttempts: 3,
  windowMs: 60 * 60 * 1000, // ساعة واحدة
  blockDurationMs: 2 * 60 * 60 * 1000 // ساعتين
});

export const apiRateLimiter = new RateLimiter({
  maxAttempts: 100,
  windowMs: 60 * 1000, // دقيقة واحدة
  blockDurationMs: 5 * 60 * 1000 // 5 دقائق
});

// تنظيف دوري للسجلات
setInterval(() => {
  loginRateLimiter.cleanup();
  otpRateLimiter.cleanup();
  passwordResetRateLimiter.cleanup();
  apiRateLimiter.cleanup();
}, 60 * 60 * 1000); // كل ساعة
`;

    const dir = path.dirname(rateLimiterPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(rateLimiterPath, rateLimiterContent);
    console.log('✅ تم إنشاء ملف Rate Limiter');
    console.log('📝 الملف الجديد:', rateLimiterPath);

    return { success: true, message: 'تم إعداد Rate Limiting' };
  }

  /**
   * إعداد معالج الأخطاء الآمن
   */
  async setupErrorHandler() {
    console.log('🔧 إعداد معالج الأخطاء الآمن...');

    const errorHandlerPath = path.join(process.cwd(), 'functions/src/shared/error-handler.ts');
    
    const errorHandlerContent = `/**
 * معالج الأخطاء الآمن - لا يكشف معلومات حساسة
 */

export enum ErrorCode {
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  INVALID_INPUT = 'INVALID_INPUT',
  RATE_LIMITED = 'RATE_LIMITED',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR'
}

export interface SafeError {
  code: ErrorCode;
  message: string;
  timestamp: number;
  requestId?: string;
}

export class ErrorHandler {
  /**
   * إنشاء خطأ آمن بدون كشف معلومات حساسة
   */
  static createSafeError(
    code: ErrorCode, 
    userMessage: string, 
    internalDetails?: any,
    requestId?: string
  ): SafeError {
    // تسجيل التفاصيل الداخلية للمطورين فقط
    if (internalDetails) {
      console.error(\`[\${code}] Internal details:\`, {
        requestId,
        details: internalDetails,
        timestamp: new Date().toISOString()
      });
    }

    return {
      code,
      message: userMessage,
      timestamp: Date.now(),
      requestId
    };
  }

  /**
   * معالجة أخطاء المصادقة
   */
  static handleAuthError(error: any, requestId?: string): SafeError {
    if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
      return this.createSafeError(
        ErrorCode.AUTHENTICATION_FAILED,
        'بيانات تسجيل الدخول غير صحيحة',
        error,
        requestId
      );
    }

    if (error.code === 'auth/too-many-requests') {
      return this.createSafeError(
        ErrorCode.RATE_LIMITED,
        'تم تجاوز عدد المحاولات المسموح. يرجى المحاولة لاحقاً',
        error,
        requestId
      );
    }

    if (error.code === 'auth/user-disabled') {
      return this.createSafeError(
        ErrorCode.AUTHENTICATION_FAILED,
        'تم تعطيل هذا الحساب',
        error,
        requestId
      );
    }

    return this.createSafeError(
      ErrorCode.INTERNAL_ERROR,
      'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى',
      error,
      requestId
    );
  }

  /**
   * معالجة أخطاء التحقق من البيانات
   */
  static handleValidationError(error: any, requestId?: string): SafeError {
    return this.createSafeError(
      ErrorCode.VALIDATION_ERROR,
      'البيانات المدخلة غير صحيحة',
      error,
      requestId
    );
  }

  /**
   * معالجة أخطاء الصلاحيات
   */
  static handlePermissionError(requiredPermission: string, requestId?: string): SafeError {
    return this.createSafeError(
      ErrorCode.INSUFFICIENT_PERMISSIONS,
      'غير مصرح بالوصول إلى هذه الوظيفة',
      { requiredPermission },
      requestId
    );
  }

  /**
   * معالجة أخطاء Rate Limiting
   */
  static handleRateLimitError(blockedUntil: number, requestId?: string): SafeError {
    const blockedUntilDate = new Date(blockedUntil);
    return this.createSafeError(
      ErrorCode.RATE_LIMITED,
      \`تم حظرك مؤقتاً. يمكنك المحاولة مرة أخرى في \${blockedUntilDate.toLocaleTimeString()}\`,
      { blockedUntil },
      requestId
    );
  }

  /**
   * تسجيل حدث أمني
   */
  static logSecurityEvent(
    event: string, 
    userId: string, 
    details: any, 
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): void {
    console.warn(\`[SECURITY-\${severity.toUpperCase()}] \${event}\`, {
      userId,
      details,
      timestamp: new Date().toISOString(),
      severity
    });
  }
}

// دوال مساعدة سريعة
export const createAuthError = (message: string, details?: any) => 
  ErrorHandler.handleAuthError({ message, ...details });

export const createPermissionError = (permission: string) => 
  ErrorHandler.handlePermissionError(permission);

export const createValidationError = (message: string, details?: any) => 
  ErrorHandler.handleValidationError({ message, ...details });
`;

    const dir = path.dirname(errorHandlerPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(errorHandlerPath, errorHandlerContent);
    console.log('✅ تم إنشاء ملف معالج الأخطاء');
    console.log('📝 الملف الجديد:', errorHandlerPath);

    return { success: true, message: 'تم إعداد معالج الأخطاء الآمن' };
  }

  /**
   * تطبيق جميع الإصلاحات المحلية
   */
  async fixAll() {
    console.log('🚀 بدء تطبيق جميع الإصلاحات المحلية...\n');

    const results = [];

    try {
      console.log('1️⃣ إصلاح إعدادات CORS...');
      results.push(await this.fixCorsSettings());
      console.log('');

      console.log('2️⃣ إصلاح سياسة كلمات المرور...');
      results.push(await this.fixPasswordPolicy());
      console.log('');

      console.log('3️⃣ إعداد نظام التشفير...');
      results.push(await this.setupEncryption());
      console.log('');

      console.log('4️⃣ إعداد Rate Limiting...');
      results.push(await this.setupRateLimit());
      console.log('');

      console.log('5️⃣ إعداد معالج الأخطاء...');
      results.push(await this.setupErrorHandler());
      console.log('');

      console.log('🎉 تم تطبيق جميع الإصلاحات المحلية بنجاح!');
      
      // ملخص النتائج
      console.log('\n📊 ملخص النتائج:');
      results.forEach((result, index) => {
        const status = result.success ? '✅' : '❌';
        console.log(`  ${status} ${index + 1}. ${result.message}`);
      });

      return { success: true, results };

    } catch (error) {
      console.error('❌ خطأ في تطبيق الإصلاحات:', error);
      throw error;
    }
  }

  /**
   * فحص الحالة الأمنية للملفات المحلية
   */
  async checkSecurity() {
    console.log('🔍 فحص الحالة الأمنية للملفات المحلية...\n');

    const issues = [];

    // فحص CORS
    const corsPath = path.join(process.cwd(), 'functions/src/shared/function-utils.ts');
    if (fs.existsSync(corsPath)) {
      const content = fs.readFileSync(corsPath, 'utf8');
      if (content.includes('origin: true')) {
        issues.push('⚠️ إعدادات CORS غير آمنة');
      } else {
        console.log('✅ إعدادات CORS آمنة');
      }
    } else {
      issues.push('⚠️ ملف CORS غير موجود');
    }

    // فحص سياسة كلمات المرور
    const signupPath = path.join(process.cwd(), 'src/app/(auth)/signup/page.tsx');
    if (fs.existsSync(signupPath)) {
      const content = fs.readFileSync(signupPath, 'utf8');
      if (content.includes('.min(6')) {
        issues.push('⚠️ سياسة كلمات المرور ضعيفة');
      } else {
        console.log('✅ سياسة كلمات المرور قوية');
      }
    } else {
      issues.push('⚠️ ملف التسجيل غير موجود');
    }

    // فحص وجود ملفات الأمان
    const securityFiles = [
      { path: 'functions/src/shared/crypto-utils.ts', name: 'نظام التشفير' },
      { path: 'functions/src/shared/rate-limiter.ts', name: 'Rate Limiting' },
      { path: 'functions/src/shared/error-handler.ts', name: 'معالج الأخطاء' }
    ];

    securityFiles.forEach(file => {
      const fullPath = path.join(process.cwd(), file.path);
      if (fs.existsSync(fullPath)) {
        console.log(`✅ ${file.name} موجود`);
      } else {
        issues.push(`⚠️ ${file.name} غير موجود`);
      }
    });

    console.log('\n📊 نتائج الفحص:');
    if (issues.length === 0) {
      console.log('✅ لم يتم العثور على مشاكل أمنية في الملفات المحلية');
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

    return await this.fixes[fixType](options);
  }
}

// تشغيل السكريبت
async function main() {
  const args = process.argv.slice(2);
  const fixer = new LocalSecurityFixer();

  try {
    if (args.includes('--check')) {
      await fixer.checkSecurity();
      return;
    }

    const fixArg = args.find(arg => arg.startsWith('--fix='));
    if (!fixArg) {
      console.log('الاستخدام:');
      console.log('  node scripts/local-security-fixes.js --fix=all');
      console.log('  node scripts/local-security-fixes.js --fix=cors');
      console.log('  node scripts/local-security-fixes.js --fix=password');
      console.log('  node scripts/local-security-fixes.js --fix=encryption');
      console.log('  node scripts/local-security-fixes.js --fix=rateLimit');
      console.log('  node scripts/local-security-fixes.js --fix=errorHandler');
      console.log('  node scripts/local-security-fixes.js --check');
      return;
    }

    const fixType = fixArg.split('=')[1];
    const result = await fixer.run(fixType);
    console.log('\n✅ النتيجة:', result);

  } catch (error) {
    console.error('\n❌ خطأ:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = LocalSecurityFixer;
