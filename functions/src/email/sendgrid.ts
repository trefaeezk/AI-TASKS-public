import * as sgMail from '@sendgrid/mail';
import * as functions from 'firebase-functions';

// تكوين مفتاح API لـ SendGrid
// يجب إضافة مفتاح API في إعدادات Firebase Functions Environment Variables
// firebase functions:config:set sendgrid.apikey="YOUR_SENDGRID_API_KEY"
const apiKey = process.env.SENDGRID_API_KEY || functions.config().sendgrid?.apikey;

if (apiKey) {
  sgMail.setApiKey(apiKey);
} else {
  console.warn('SendGrid API key is not set. Email sending will not work.');
}

/**
 * إرسال بريد إلكتروني باستخدام SendGrid
 * @param to عنوان البريد الإلكتروني للمستلم
 * @param subject عنوان البريد الإلكتروني
 * @param text نص البريد الإلكتروني (بدون تنسيق)
 * @param html محتوى البريد الإلكتروني بتنسيق HTML (اختياري)
 * @returns وعد بنتيجة إرسال البريد الإلكتروني
 */
export const sendEmail = async (
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<boolean> => {
  if (!apiKey) {
    console.error('SendGrid API key is not set. Cannot send email.');
    return false;
  }

  try {
    const msg = {
      to,
      from: 'security@studio--tasks-intelligence.europe-west1.hosted.app', // يجب أن يكون هذا البريد الإلكتروني متحققًا منه في SendGrid
      subject,
      text,
      html: html || text,
    };

    await sgMail.send(msg);
    console.log(`Email sent successfully to ${to}`);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};

/**
 * إرسال رمز OTP عبر البريد الإلكتروني
 * @param to عنوان البريد الإلكتروني للمستلم
 * @param otp رمز OTP
 * @param expiryTime وقت انتهاء صلاحية الرمز
 * @returns وعد بنتيجة إرسال البريد الإلكتروني
 */
export const sendOTPEmail = async (
  to: string,
  otp: string,
  expiryTime: Date
): Promise<boolean> => {
  const subject = 'رمز التحقق لصفحة التشخيص';
  
  // تنسيق وقت انتهاء الصلاحية
  const formattedTime = expiryTime.toLocaleTimeString('ar-SA', {
    hour: '2-digit',
    minute: '2-digit',
  });
  
  const text = `رمز التحقق الخاص بك هو: ${otp}. هذا الرمز صالح حتى الساعة ${formattedTime}.`;
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px; direction: rtl; text-align: right;">
      <h2 style="color: #333;">رمز التحقق لصفحة التشخيص</h2>
      <p>مرحبًا،</p>
      <p>لقد طلبت رمز تحقق للوصول إلى صفحة التشخيص. رمز التحقق الخاص بك هو:</p>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; text-align: center; font-size: 24px; font-family: monospace; letter-spacing: 5px; margin: 20px 0;">
        ${otp}
      </div>
      <p>هذا الرمز صالح حتى الساعة ${formattedTime}.</p>
      <p>إذا لم تطلب هذا الرمز، يرجى تجاهل هذا البريد الإلكتروني وإبلاغ مسؤول النظام.</p>
      <p style="margin-top: 30px; font-size: 12px; color: #777;">
        هذا بريد إلكتروني تم إنشاؤه تلقائيًا، يرجى عدم الرد عليه.
      </p>
    </div>
  `;
  
  return sendEmail(to, subject, text, html);
};
