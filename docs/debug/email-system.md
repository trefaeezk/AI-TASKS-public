# نظام البريد الإلكتروني في صفحة التشخيص

## نظرة عامة

يستخدم نظام البريد الإلكتروني في صفحة التشخيص لإرسال رموز التحقق (OTP) وإجراء اختبارات على وظائف البريد الإلكتروني. يعتمد النظام على خدمة SMTP كطريقة أساسية لإرسال البريد الإلكتروني، مع استخدام Resend API كخطة بديلة في حالة فشل SMTP.

## آلية إرسال البريد الإلكتروني

### 1. باستخدام SMTP

يستخدم النظام مكتبة `nodemailer` لإرسال البريد الإلكتروني عبر SMTP. يتم تكوين إعدادات SMTP من خلال متغيرات البيئة أو إعدادات Firebase Functions.

#### إعدادات SMTP

```typescript
const smtpConfig = {
  host: process.env.SMTP_HOST || functions.config().smtp?.host || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || functions.config().smtp?.port || '587'),
  secure: false, // استخدام STARTTLS
  auth: {
    user: process.env.SMTP_USER || functions.config().smtp?.user || 'tarf4657@gmail.com',
    pass: process.env.SMTP_PASS || functions.config().smtp?.pass || 'wdak ntgs yjwi pqtl'
  }
};
```

#### وظيفة إرسال البريد الإلكتروني باستخدام SMTP

```typescript
export const sendEmailSMTP = async (
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<boolean> => {
  try {
    // استيراد حزمة nodemailer
    const nodemailer = require('nodemailer');

    // إنشاء ناقل SMTP
    const transporter = nodemailer.createTransport(smtpConfig);

    // التحقق من اتصال SMTP
    await transporter.verify();

    // إعداد خيارات البريد الإلكتروني
    const mailOptions = {
      from: `Tasks Intelligence <${smtpConfig.auth.user}>`,
      to: to,
      subject: subject,
      text: text,
      html: html || text
    };

    // إرسال البريد الإلكتروني
    const info = await transporter.sendMail(mailOptions);
    
    console.log('Email sent successfully with SMTP:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email with SMTP:', error);
    return false;
  }
};
```

### 2. باستخدام Resend API

في حالة فشل إرسال البريد الإلكتروني باستخدام SMTP، يستخدم النظام Resend API كخطة بديلة.

#### إعدادات Resend API

```typescript
const apiKey = process.env.RESEND_API_KEY || functions.config().resend?.apikey || 're_ArCXhKjj_NS9DCLB8DYpKL3HV6FxcXu92';
const resend = new Resend(apiKey);
```

#### وظيفة إرسال البريد الإلكتروني باستخدام Resend API

```typescript
export const sendEmail = async (emailData: EmailData): Promise<boolean> => {
  if (!apiKey) {
    console.error('Resend API key is not set. Cannot send email.');
    return false;
  }

  try {
    // إعداد خيارات البريد الإلكتروني
    const emailOptions: any = {
      from: 'Tasks Intelligence <onboarding@resend.dev>',
      to: emailData.to,
      subject: emailData.subject,
      html: emailData.html || `<p>${emailData.text || ''}</p>`,
      text: emailData.text || emailData.html?.replace(/<[^>]*>/g, '') || '',
      react: null
    };

    // إرسال البريد الإلكتروني
    const result = await resend.emails.send(emailOptions);
    
    if (result.error) {
      console.error('Error sending email with Resend:', result.error);
      return false;
    }

    console.log(`Email sent successfully to ${emailData.to} with ID: ${result.data?.id}`);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};
```

## وظائف البريد الإلكتروني في صفحة التشخيص

### 1. إرسال رمز التحقق (OTP)

تستخدم هذه الوظيفة لإرسال رمز التحقق (OTP) إلى البريد الإلكتروني المرتبط بحساب المستخدم.

#### وظيفة إرسال رمز التحقق

```typescript
export const generateAndSendOTP = functions.https.onCall(async (_, context) => {
  // التحقق من وجود مستخدم مسجل الدخول
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'يجب تسجيل الدخول لإنشاء رمز التحقق'
    );
  }

  const uid = context.auth.uid;
  const userEmail = context.auth.token.email;

  // التحقق من أن المستخدم هو مالك التطبيق
  const isOwner = context.auth.token.owner === true;

  if (!isOwner) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'غير مصرح لك بإنشاء رمز التحقق'
    );
  }

  try {
    // إنشاء رمز OTP جديد
    const otp = generateOTP();

    // وقت انتهاء الصلاحية (30 دقيقة من الآن)
    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + 30);

    // تخزين الرمز في قاعدة البيانات
    await db.collection('debugOTP').doc(uid).set({
      userId: uid,
      userEmail: userEmail,
      otp,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiryTime,
      used: false
    });

    // إرسال الرمز عبر البريد الإلكتروني باستخدام SMTP
    try {
      const { sendOTPEmailSMTP } = await import('../email/smtp');
      const smtpEmailSent = await sendOTPEmailSMTP(userEmail, otp, expiryTime);

      if (smtpEmailSent) {
        return {
          success: true,
          emailSent: true,
          expiryTime: expiryTime.toISOString(),
          message: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني'
        };
      }
    } catch (smtpError) {
      console.error('Error sending email via SMTP:', smtpError);
    }

    // إذا فشل إرسال البريد الإلكتروني باستخدام SMTP، نحاول استخدام Resend
    const emailSent = await sendOTPEmail(userEmail, otp, expiryTime);

    return {
      success: true,
      emailSent,
      expiryTime: expiryTime.toISOString(),
      message: emailSent
        ? 'تم إرسال رمز التحقق إلى بريدك الإلكتروني'
        : 'تم إنشاء رمز التحقق ولكن فشل إرساله عبر البريد الإلكتروني. يرجى التحقق من إعدادات البريد الإلكتروني.'
    };
  } catch (error) {
    console.error('Error generating OTP:', error);
    throw new functions.https.HttpsError(
      'internal',
      'حدث خطأ أثناء إنشاء رمز التحقق',
      error
    );
  }
});
```

### 2. اختبار إرسال البريد الإلكتروني

تستخدم هذه الوظيفة لاختبار إرسال البريد الإلكتروني باستخدام SMTP.

#### وظيفة اختبار إرسال البريد الإلكتروني

```typescript
export const testSMTPEmail = functions.https.onCall(async (data, context) => {
  // التحقق من وجود مستخدم مسجل الدخول
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'يجب تسجيل الدخول لاختبار إرسال البريد الإلكتروني'
    );
  }

  // التحقق من أن المستخدم هو مالك التطبيق
  const isOwner = context.auth.token.owner === true;

  if (!isOwner) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'غير مصرح لك باختبار إرسال البريد الإلكتروني'
    );
  }

  const { email } = data;
  const userEmail = email || context.auth.token.email;

  try {
    // استيراد وظيفة sendEmailSMTP من ملف smtp
    const { sendEmailSMTP } = await import('./smtp');
    
    const result = await sendEmailSMTP(
      userEmail,
      'اختبار إرسال البريد الإلكتروني باستخدام SMTP',
      `هذا بريد إلكتروني اختباري للتأكد من عمل خدمة البريد الإلكتروني SMTP. الوقت الحالي: ${new Date().toLocaleString()}`,
      `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px; text-align: center;">
          <h2 style="color: #333;">اختبار إرسال البريد الإلكتروني باستخدام SMTP</h2>
          <p>مرحبًا،</p>
          <p>هذا بريد إلكتروني اختباري للتأكد من عمل خدمة البريد الإلكتروني SMTP.</p>
          <p>الوقت الحالي: <strong>${new Date().toLocaleString()}</strong></p>
          <p style="margin-top: 30px; font-size: 12px; color: #777;">
            هذا بريد إلكتروني تم إنشاؤه تلقائيًا، يرجى عدم الرد عليه.
          </p>
        </div>
      `
    );
    
    if (result) {
      return {
        success: true,
        message: `تم إرسال البريد الإلكتروني الاختباري بنجاح إلى ${userEmail} باستخدام SMTP`
      };
    } else {
      throw new functions.https.HttpsError(
        'internal',
        'فشل إرسال البريد الإلكتروني الاختباري باستخدام SMTP'
      );
    }
  } catch (error) {
    console.error('Error in SMTP test email sending:', error);
    throw new functions.https.HttpsError(
      'internal',
      'حدث خطأ أثناء اختبار إرسال البريد الإلكتروني باستخدام SMTP',
      error
    );
  }
});
```

## تكوين إعدادات البريد الإلكتروني

### 1. تكوين إعدادات SMTP

يمكن تكوين إعدادات SMTP من خلال إعدادات Firebase Functions:

```bash
firebase functions:config:set smtp.host="smtp.gmail.com" smtp.port="587" smtp.user="tarf4657@gmail.com" smtp.pass="wdak ntgs yjwi pqtl"
```

### 2. تكوين إعدادات Resend API

يمكن تكوين إعدادات Resend API من خلال إعدادات Firebase Functions:

```bash
firebase functions:config:set resend.apikey="re_ArCXhKjj_NS9DCLB8DYpKL3HV6FxcXu92"
```

## استكشاف الأخطاء وإصلاحها

### مشكلة: فشل إرسال البريد الإلكتروني باستخدام SMTP

**الحلول المحتملة**:

1. تحقق من إعدادات SMTP في Firebase Functions.
2. تأكد من أن كلمة مرور التطبيق صحيحة.
3. تحقق من أن حساب Gmail يسمح بالوصول من تطبيقات أقل أمانًا.
4. جرب استخدام خدمة SMTP أخرى.

### مشكلة: فشل إرسال البريد الإلكتروني باستخدام Resend API

**الحلول المحتملة**:

1. تحقق من مفتاح API لـ Resend في Firebase Functions.
2. تأكد من أن حساب Resend نشط.
3. تحقق من سجلات Firebase Functions للحصول على مزيد من المعلومات حول الخطأ.

## ملاحظات هامة

- **استخدم كلمة مرور تطبيق لحساب Gmail**: لا تستخدم كلمة مرور الحساب الأصلية.
- **قم بتحديث كلمة مرور التطبيق بانتظام**: لزيادة مستوى الأمان.
- **استخدم خدمة بريد إلكتروني مخصصة للإنتاج**: مثل SendGrid أو Mailgun.
- **قم بمراقبة سجلات إرسال البريد الإلكتروني**: للكشف عن أي مشكلات.
