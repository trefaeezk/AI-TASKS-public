
import * as functions from 'firebase-functions';
import nodemailer from 'nodemailer'; // Use import instead of require

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
    // قراءة إعدادات SMTP من متغيرات البيئة أو تكوين Firebase
    const smtpUserFromEnv = process.env.SMTP_USER;
    const smtpPassFromEnv = process.env.SMTP_PASS;
    const smtpHostFromEnv = process.env.SMTP_HOST;
    const smtpPortFromEnv = process.env.SMTP_PORT;

    const smtpUserFromConfig = functions.config().smtp?.user;
    const smtpPassFromConfig = functions.config().smtp?.pass;
    const smtpHostFromConfig = functions.config().smtp?.host;
    const smtpPortFromConfig = functions.config().smtp?.port;

    const smtpUser = smtpUserFromEnv || smtpUserFromConfig || 'tarf4657@gmail.com';
    const smtpPass = smtpPassFromEnv || smtpPassFromConfig; // لا يوجد قيمة افتراضية لكلمة المرور
    const smtpHost = smtpHostFromEnv || smtpHostFromConfig || 'smtp.gmail.com';
    const smtpPortConfigValue = smtpPortFromEnv || smtpPortFromConfig;
    const smtpPort = smtpPortConfigValue ? parseInt(smtpPortConfigValue) : 587;

    console.log(`[SMTP Service] Configuration - Host: ${smtpHost}, Port: ${smtpPort}, User: ${smtpUser ? smtpUser.substring(0, Math.min(3, smtpUser.length)) + '***' : 'NOT SET'}`);
    console.log(`[SMTP Service] SMTP_USER source: ${smtpUserFromEnv ? 'process.env' : smtpUserFromConfig ? 'functions.config' : 'default'}`);
    console.log(`[SMTP Service] SMTP_PASS source: ${smtpPassFromEnv ? 'process.env (exists)' : smtpPassFromConfig ? 'functions.config (exists)' : 'NOT SET'}`);


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
        pass: smtpPass, // كلمة مرور التطبيق
      },
      // logger: true, // Uncomment for detailed Nodemailer logs
      // debug: true,  // Uncomment for detailed Nodemailer logs
    });

    console.log('[SMTP Service] Verifying SMTP connection...');
    try {
      await transporter.verify();
      console.log('[SMTP Service] SMTP connection verified successfully.');
    } catch (verifyError: any) {
      console.error('[SMTP Service] SMTP connection verification failed:', verifyError.message);
      console.error('[SMTP Service] SMTP Verification Error Details:', JSON.stringify(verifyError, Object.getOwnPropertyNames(verifyError)));
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
    console.log(`[SMTP Service] SMTP Response: ${info.response}`);
    return true;

  } catch (error: any) {
    console.error('[SMTP Service] Exception during SMTP email sending:', error);
    console.error('[SMTP Service] SMTP Error Details - Message:', error.message, 'Stack:', error.stack, 'Response:', error.response, 'Response Code:', error.responseCode, 'Full Error:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
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
  console.log(`[SMTP Service] Preparing to send OTP email via SMTP to ${to} with code (masked)`);
  const subject = 'رمز التحقق لصفحة التشخيص (SMTP)';
  const formattedTime = expiryTime.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
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
    
