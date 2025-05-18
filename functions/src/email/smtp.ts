import * as functions from 'firebase-functions';

/**
 * وظيفة لإرسال البريد الإلكتروني باستخدام SMTP مباشرة
 * تستخدم حزمة nodemailer لإرسال البريد الإلكتروني
 *
 * ملاحظة: يجب تثبيت حزمة nodemailer أولاً:
 * npm install nodemailer
 * npm install @types/nodemailer --save-dev
 */

// تنفيذ وظيفة إرسال البريد الإلكتروني باستخدام SMTP
export const sendEmailSMTP = async (
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<boolean> => {
  try {
    // استيراد حزمة nodemailer بشكل ديناميكي
    // هذا يسمح لنا باستخدام الوظيفة حتى لو لم تكن الحزمة مثبتة
    const nodemailer = require('nodemailer');

    // الحصول على إعدادات SMTP من متغيرات البيئة أو استخدام القيم الافتراضية
    const smtpUser = process.env.SMTP_USER || functions.config().smtp?.user || 'tarf4657@gmail.com';
    const smtpPass = process.env.SMTP_PASS || functions.config().smtp?.pass || 'wdak ntgs yjwi pqtl';
    const smtpHost = process.env.SMTP_HOST || functions.config().smtp?.host || 'smtp.gmail.com';
    const smtpPort = process.env.SMTP_PORT || functions.config().smtp?.port || 587;

    console.log(`SMTP Configuration: ${smtpHost}:${smtpPort}, User: ${smtpUser}`);

    // إنشاء ناقل SMTP
    // يمكنك استخدام خدمة Gmail أو أي خدمة SMTP أخرى
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(smtpPort as string),
      secure: false, // true للاتصال الآمن (SSL/TLS)، false للاتصال غير الآمن (STARTTLS)
      auth: {
        user: smtpUser,  // بريدك الإلكتروني
        pass: smtpPass   // كلمة مرور التطبيق (ليست كلمة مرور الحساب)
      }
    });

    // التحقق من اتصال SMTP
    try {
      await transporter.verify();
      console.log('SMTP connection verified successfully');
    } catch (verifyError) {
      console.error('SMTP connection verification failed:', verifyError);
      throw verifyError;
    }

    // إعداد خيارات البريد الإلكتروني
    const mailOptions = {
      from: `Tasks Intelligence <${smtpUser}>`,
      to: to,
      subject: subject,
      text: text,
      html: html || text
    };

    console.log('Sending email with SMTP:', JSON.stringify({
      to: mailOptions.to,
      from: mailOptions.from,
      subject: mailOptions.subject
    }));

    // إرسال البريد الإلكتروني
    const info = await transporter.sendMail(mailOptions);

    console.log('Email sent successfully with SMTP:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email with SMTP:', error);
    return false;
  }
};

/**
 * إرسال رمز OTP عبر البريد الإلكتروني باستخدام SMTP
 * @param to عنوان البريد الإلكتروني للمستلم
 * @param otp رمز OTP
 * @param expiryTime وقت انتهاء صلاحية الرمز
 * @returns وعد بنتيجة إرسال البريد الإلكتروني
 */
export const sendOTPEmailSMTP = async (
  to: string,
  otp: string,
  expiryTime: Date
): Promise<boolean> => {
  const subject = 'رمز التحقق لصفحة التشخيص';

  // تنسيق وقت انتهاء الصلاحية بشكل بسيط
  const formattedTime = `${expiryTime.getHours()}:${expiryTime.getMinutes().toString().padStart(2, '0')}`;

  const text = `رمز التحقق الخاص بك هو: ${otp}. هذا الرمز صالح حتى الساعة ${formattedTime}.`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px; text-align: center;">
      <h2 style="color: #333;">رمز التحقق لصفحة التشخيص</h2>
      <p>مرحبًا،</p>
      <p>تم طلب رمز تحقق للوصول إلى صفحة التشخيص. رمز التحقق الخاص بك هو:</p>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center;">
        <h1 style="margin: 0; color: #4CAF50; font-size: 32px;">${otp}</h1>
      </div>
      <p>هذا الرمز صالح حتى الساعة <strong>${formattedTime}</strong>.</p>
      <p>إذا لم تطلب هذا الرمز، يرجى تجاهل هذا البريد الإلكتروني.</p>
      <p style="margin-top: 30px; font-size: 12px; color: #777;">
        هذا بريد إلكتروني تم إنشاؤه تلقائيًا، يرجى عدم الرد عليه.
      </p>
    </div>
  `;

  return sendEmailSMTP(to, subject, text, html);
};
