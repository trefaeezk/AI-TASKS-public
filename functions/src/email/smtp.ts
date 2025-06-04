
import * as functions from 'firebase-functions';

/**
 * وظيفة لإرسال البريد الإلكتروني باستخدام SMTP مباشرة
 * تستخدم حزمة nodemailer لإرسال البريد الإلكتروني
 */
export const sendEmailSMTP = async (
  to: string,
  subject: string,
  text: string,
  html?: string
): Promise<boolean> => {
  console.log(`[SMTP Service] Attempting to send email via SMTP to: ${to}`);
  try {
    const nodemailer = require('nodemailer');

    const smtpUser = process.env.SMTP_USER || functions.config().smtp?.user || 'tarf4657@gmail.com';
    const smtpPass = process.env.SMTP_PASS || functions.config().smtp?.pass || 'wdak ntgs yjwi pqtl'; // كلمة مرور التطبيق
    const smtpHost = process.env.SMTP_HOST || functions.config().smtp?.host || 'smtp.gmail.com';
    const smtpPortEnv = process.env.SMTP_PORT || functions.config().smtp?.port;
    const smtpPort = smtpPortEnv ? parseInt(smtpPortEnv) : 587; // تأكد من أن المنفذ رقم, الافتراضي 587

    console.log(`[SMTP Service] Configuration - Host: ${smtpHost}, Port: ${smtpPort}, User: ${smtpUser ? smtpUser.substring(0,3) + '***' : 'NOT SET'}`);

    if (!smtpUser || !smtpPass) {
      console.error('[SMTP Service] SMTP User or Password not configured. Cannot send email via SMTP.');
      return false;
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465, // true for 465, false for other ports (STARTTLS)
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      // إضافة المزيد من خيارات التصحيح إذا لزم الأمر
      // logger: true,
      // debug: true, // Enable debug output from nodemailer
    });

    console.log('[SMTP Service] Verifying SMTP connection...');
    try {
      await transporter.verify();
      console.log('[SMTP Service] SMTP connection verified successfully.');
    } catch (verifyError: any) {
      console.error('[SMTP Service] SMTP connection verification failed:', verifyError.message);
      console.error('[SMTP Service] SMTP Verification Error Details:', verifyError);
      return false; // لا يمكن المتابعة إذا فشل التحقق
    }

    const mailOptions = {
      from: `Tasks Intelligence <${smtpUser}>`,
      to: to,
      subject: subject,
      text: text,
      html: html || text,
    };

    console.log('[SMTP Service] Sending email with SMTP. Options (excluding content):', JSON.stringify({
      to: mailOptions.to,
      from: mailOptions.from,
      subject: mailOptions.subject,
    }));

    const info = await transporter.sendMail(mailOptions);
    console.log(`[SMTP Service] Email sent successfully via SMTP to ${to}. Message ID: ${info.messageId}`);
    return true;

  } catch (error: any) {
    console.error('[SMTP Service] Exception during SMTP email sending:', error);
    console.error('[SMTP Service] SMTP Error Details - Message:', error.message, 'Stack:', error.stack, 'Response:', error.response, 'Response Code:', error.responseCode);
    return false;
  }
};

/**
 * إرسال رمز OTP عبر البريد الإلكتروني باستخدام SMTP
 */
export const sendOTPEmailSMTP = async (
  to: string,
  otp: string,
  expiryTime: Date
): Promise<boolean> => {
  console.log(`[SMTP Service] Preparing to send OTP email via SMTP to ${to} with code ${otp.substring(0,1)}*****`);
  const subject = 'رمز التحقق لصفحة التشخيص (SMTP)';
  const formattedTime = `${expiryTime.getHours()}:${expiryTime.getMinutes().toString().padStart(2, '0')}`;
  const text = `رمز التحقق الخاص بك هو: ${otp}. هذا الرمز صالح حتى الساعة ${formattedTime}.`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px; text-align: center;">
      <h2 style="color: #333;">رمز التحقق لصفحة التشخيص (عبر SMTP)</h2>
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

    