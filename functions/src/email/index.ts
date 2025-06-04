
import { Resend } from 'resend';
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// تكوين مفتاح API لـ Resend
// يجب إضافة مفتاح API في إعدادات Firebase Functions Environment Variables
// firebase functions:config:set resend.apikey="YOUR_RESEND_API_KEY"
const apiKey = process.env.RESEND_API_KEY || functions.config().resend?.apikey || 're_ArCXhKjj_NS9DCLB8DYpKL3HV6FxcXu92';
console.log('[EmailService Index] Resend API Key used:', apiKey ? `re_****${apiKey.substring(apiKey.length - 4)}` : 'Not Set');

// إنشاء مثيل من Resend
let resend: Resend | null = null;
if (apiKey) {
  try {
    resend = new Resend(apiKey);
    console.log('[EmailService Index] Resend instance created successfully.');
  } catch (e: any) {
    console.error('[EmailService Index] Failed to initialize Resend with API key:', e.message);
  }
} else {
  console.warn('[EmailService Index] Resend API key is not configured. Email sending via Resend will be skipped.');
}

/**
 * أنواع قوالب البريد الإلكتروني المتاحة في النظام
 */
export enum EmailTemplate {
  OTP_VERIFICATION = 'otp-verification',
  WELCOME = 'welcome',
  TASK_REMINDER = 'task-reminder',
  TASK_ASSIGNMENT = 'task-assignment',
  WEEKLY_REPORT = 'weekly-report',
  SYSTEM_NOTIFICATION = 'system-notification',
}

/**
 * واجهة بيانات البريد الإلكتروني
 */
export interface EmailData {
  to: string | string[]; // يمكن أن يكون عنوان بريد إلكتروني واحد أو مصفوفة من العناوين
  subject: string;
  text?: string;
  html?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
}

/**
 * إرسال بريد إلكتروني باستخدام Resend
 * @param emailData بيانات البريد الإلكتروني
 * @returns وعد بنتيجة إرسال البريد الإلكتروني
 */
export const sendEmail = async (emailData: EmailData): Promise<boolean> => {
  console.log('[EmailService Index] Attempting to send email via Resend to:', emailData.to);
  if (!resend) {
    console.error('[EmailService Index] Resend is not initialized. Cannot send email. Ensure RESEND_API_KEY is set.');
    return false;
  }

  try {
    // التأكد من وجود محتوى البريد الإلكتروني
    const htmlContent = emailData.html || `<p>${emailData.text || ''}</p>`;
    const textContent = emailData.text || emailData.html?.replace(/<[^>]*>/g, '') || '';

    // إنشاء خيارات البريد الإلكتروني
    const emailOptions: any = {
      from: 'Tasks Intelligence <onboarding@resend.dev>', // استخدام النطاق الافتراضي لـ Resend للاختبار
      to: emailData.to,
      subject: emailData.subject,
      html: htmlContent,
      text: textContent,
      react: null // Ensure react is explicitly null if not used
    };

    if (emailData.cc) emailOptions.cc = emailData.cc;
    if (emailData.bcc) emailOptions.bcc = emailData.bcc;
    if (emailData.replyTo) emailOptions.reply_to = emailData.replyTo;

    console.log('[EmailService Index] Sending email with Resend. Options (excluding content):', JSON.stringify({
      from: emailOptions.from,
      to: emailOptions.to,
      subject: emailOptions.subject,
      cc: emailOptions.cc,
      bcc: emailOptions.bcc,
      reply_to: emailOptions.reply_to,
    }));

    const result = await resend.emails.send(emailOptions);
    console.log('[EmailService Index] Resend API response:', JSON.stringify(result, null, 2));

    if (result.error) {
      console.error('[EmailService Index] Error sending email with Resend:', result.error);
      return false;
    }

    if (result.data && result.data.id) {
        console.log(`[EmailService Index] Email sent successfully via Resend to ${emailData.to} with ID: ${result.data.id}`);
        return true;
    } else {
        console.warn('[EmailService Index] Resend email sending status uncertain. Response did not include a data.id.', result);
        return false;
    }

  } catch (error: any) {
    console.error('[EmailService Index] Exception during Resend API call or email preparation:', error);
    if (error.response && error.response.data) {
        console.error('[EmailService Index] Resend Error Details:', JSON.stringify(error.response.data, null, 2));
    }
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
  const formattedTime = expiryTime.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
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
  console.log(`[EmailService Index] Preparing to send OTP email to ${to} via Resend.`);
  return sendEmail({ to, subject, text, html });
};

/**
 * إرسال تذكير بالمهام
 * @param to عنوان البريد الإلكتروني للمستلم
 * @param taskTitle عنوان المهمة
 * @param dueDate تاريخ استحقاق المهمة
 * @param taskUrl رابط المهمة
 * @returns وعد بنتيجة إرسال البريد الإلكتروني
 */
export const sendTaskReminderEmail = async (
  to: string,
  taskTitle: string,
  dueDate: Date,
  taskUrl: string
): Promise<boolean> => {
  const subject = `تذكير: المهمة "${taskTitle}" تستحق قريبًا`;
  const formattedDate = dueDate.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const text = `تذكير: المهمة "${taskTitle}" تستحق في ${formattedDate}. يرجى إكمالها في الوقت المحدد.`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px; direction: rtl; text-align: right;">
      <h2 style="color: #333;">تذكير بالمهمة</h2>
      <p>مرحبًا،</p>
      <p>هذا تذكير بأن المهمة التالية تستحق قريبًا:</p>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0;">${taskTitle}</h3>
        <p><strong>تاريخ الاستحقاق:</strong> ${formattedDate}</p>
      </div>
      <p>يرجى إكمال المهمة في الوقت المحدد.</p>
      <p><a href="${taskUrl}" style="display: inline-block; background-color: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin-top: 15px;">عرض المهمة</a></p>
      <p style="margin-top: 30px; font-size: 12px; color: #777;">
        هذا بريد إلكتروني تم إنشاؤه تلقائيًا، يرجى عدم الرد عليه.
      </p>
    </div>
  `;
  console.log(`[EmailService Index] Preparing to send task reminder email to ${to} via Resend.`);
  return sendEmail({ to, subject, text, html });
};

// دالة لإنشاء رمز OTP عشوائي
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * إرسال دعوة للانضمام إلى مؤسسة
 * @param to عنوان البريد الإلكتروني للمستلم
 * @param organizationName اسم المؤسسة
 * @param inviterName اسم الشخص الذي أرسل الدعوة
 * @param role الدور المطلوب
 * @param invitationUrl رابط قبول الدعوة
 * @returns وعد بنتيجة إرسال البريد الإلكتروني
 */
export const sendOrganizationInvitationEmail = async (
  to: string,
  organizationName: string,
  inviterName: string,
  role: string,
  invitationUrl: string
): Promise<boolean> => {
  console.log(`[EmailService Index] Preparing organization invitation email for: ${to}`);
  const subject = `دعوة للانضمام إلى مؤسسة ${organizationName}`;
  const roleTranslations: { [key: string]: string } = {
    'isOrgOwner': 'مالك المؤسسة', 'isOrgAdmin': 'مدير المؤسسة', 'isOrgSupervisor': 'مشرف',
    'isOrgEngineer': 'مهندس', 'isOrgTechnician': 'فني', 'isOrgAssistant': 'مساعد'
  };
  const roleInArabic = roleTranslations[role] || role;
  const text = `مرحبًا، تم دعوتك للانضمام إلى مؤسسة "${organizationName}" بدور "${roleInArabic}" من قبل ${inviterName}. للانضمام، يرجى النقر على الرابط: ${invitationUrl}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; direction: rtl; background-color: #f8f9fa;">
      <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #2563eb; margin: 0; font-size: 28px;">Tasks Intelligence</h1>
          <div style="width: 50px; height: 3px; background-color: #2563eb; margin: 10px auto;"></div>
        </div>
        <h2 style="color: #1f2937; text-align: center; margin-bottom: 30px;">دعوة للانضمام إلى المؤسسة</h2>
        <div style="background-color: #eff6ff; padding: 20px; border-radius: 8px; border-right: 4px solid #2563eb; margin-bottom: 30px;">
          <p style="font-size: 16px; line-height: 1.6; margin: 0; color: #1f2937;">
            <strong>مرحبًا،</strong><br><br>
            تم دعوتك للانضمام إلى مؤسسة <strong style="color: #2563eb;">"${organizationName}"</strong>
            بدور <strong style="color: #059669;">"${roleInArabic}"</strong>
            من قبل <strong>${inviterName}</strong>.
          </p>
        </div>
        <div style="text-align: center; margin: 40px 0;">
          <a href="${invitationUrl}" style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px; box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3); transition: all 0.3s ease;">
            🎉 قبول الدعوة والانضمام
          </a>
        </div>
        <div style="background-color: #fef3c7; padding: 15px; border-radius: 8px; border-right: 4px solid #f59e0b; margin: 30px 0;">
          <p style="font-size: 14px; margin: 0; color: #92400e;">
            <strong>ملاحظة:</strong> إذا لم تكن تتوقع هذه الدعوة، يمكنك تجاهل هذا البريد الإلكتروني بأمان.
          </p>
        </div>
        <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
          <p style="font-size: 12px; color: #6b7280; text-align: center; margin: 0;">
            هذا بريد إلكتروني تم إنشاؤه تلقائيًا من نظام Tasks Intelligence<br>
            يرجى عدم الرد على هذا البريد الإلكتروني
          </p>
        </div>
      </div>
    </div>
  `;
  console.log(`[EmailService Index] Attempting to send organization invitation email to ${to} via Resend.`);
  const resendEmailSent = await sendEmail({ to, subject, text, html });
  console.log(`[EmailService Index] Resend invitation email to ${to} send status: ${resendEmailSent}`);

  if (resendEmailSent) {
    return true;
  }

  // Fallback to SMTP if Resend fails
  console.warn(`[EmailService Index] Resend failed for invitation to ${to}. Attempting SMTP fallback...`);
  try {
    const { sendEmailSMTP } = await import('../email/smtp'); // Ensure path is correct
    console.log(`[EmailService Index] Calling sendEmailSMTP for invitation to ${to}.`);
    const smtpEmailSent = await sendEmailSMTP(to, subject, text, html);
    console.log(`[EmailService Index] SMTP invitation email to ${to} send status: ${smtpEmailSent}`);
    return smtpEmailSent;
  } catch (smtpError) {
    console.error(`[EmailService Index] Error sending invitation email via SMTP to ${to}:`, smtpError);
    return false;
  }
};

/**
 * وظيفة سحابية لإنشاء وإرسال رمز OTP
 */
export const generateAndSendOTP = functions.region("europe-west1").https.onCall(async (_, context) => {
  console.log('[generateAndSendOTP Function] Triggered.');
  if (!context.auth) {
    console.error('[generateAndSendOTP Function] Unauthenticated call.');
    throw new functions.https.HttpsError('unauthenticated', 'يجب تسجيل الدخول لإنشاء رمز التحقق');
  }
  const uid = context.auth.uid;
  const userEmail = context.auth.token.email;
  const isOwner = context.auth.token.isSystemOwner === true;

  if (!isOwner) {
    console.error(`[generateAndSendOTP Function] Permission denied for user ${uid}. Not a system owner.`);
    throw new functions.https.HttpsError('permission-denied', 'غير مصرح لك بإنشاء رمز التحقق.');
  }
  if (!userEmail) {
    console.error(`[generateAndSendOTP Function] User ${uid} has no email associated.`);
    throw new functions.https.HttpsError('failed-precondition', 'لا يوجد بريد إلكتروني مرتبط بحسابك');
  }

  try {
    const db = admin.firestore();
    const otp = generateOTP();
    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + 30);

    console.log(`[generateAndSendOTP Function] Generated OTP ${otp.substring(0,1)}***** for user ${uid}, expires at ${expiryTime.toISOString()}.`);
    await db.collection('debugOTP').doc(uid).set({
      userId: uid, userEmail: userEmail, otp,
      createdAt: admin.firestore.FieldValue.serverTimestamp(), expiryTime, used: false
    });
    console.log(`[generateAndSendOTP Function] OTP stored in Firestore for user ${uid}.`);

    console.log(`[generateAndSendOTP Function] Attempting to send OTP email to ${userEmail} via Resend.`);
    const resendEmailSent = await sendOTPEmail(userEmail, otp, expiryTime);

    if (resendEmailSent) {
      console.log(`[generateAndSendOTP Function] Successfully sent OTP email via Resend to ${userEmail}`);
      return { success: true, emailSent: true, expiryTime: expiryTime.toISOString(), message: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني' };
    } else {
      console.warn(`[generateAndSendOTP Function] Failed to send OTP email via Resend to ${userEmail}. Trying SMTP fallback.`);
      try {
        const { sendOTPEmailSMTP } = await import('../email/smtp');
        const smtpEmailSent = await sendOTPEmailSMTP(userEmail, otp, expiryTime);
        if (smtpEmailSent) {
          console.log(`[generateAndSendOTP Function] Successfully sent OTP email via SMTP to ${userEmail}`);
          return { success: true, emailSent: true, expiryTime: expiryTime.toISOString(), message: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني عبر SMTP' };
        } else {
          console.warn(`[generateAndSendOTP Function] Failed to send OTP email via SMTP as well to ${userEmail}`);
          return { success: true, emailSent: false, expiryTime: expiryTime.toISOString(), message: 'تم إنشاء رمز التحقق ولكن فشل إرساله عبر البريد الإلكتروني.' };
        }
      } catch (smtpError) {
        console.error(`[generateAndSendOTP Function] Error sending OTP email via SMTP to ${userEmail}:`, smtpError);
        return { success: true, emailSent: false, expiryTime: expiryTime.toISOString(), message: 'تم إنشاء رمز التحقق ولكن فشل إرساله عبر البريد الإلكتروني (خطأ SMTP).' };
      }
    }
  } catch (error) {
    console.error('[generateAndSendOTP Function] Error:', error);
    throw new functions.https.HttpsError('internal', 'حدث خطأ أثناء إنشاء رمز التحقق', error);
  }
});

/**
 * وظيفة سحابية للتحقق من رمز OTP
 */
export const verifyOTP = functions.region("europe-west1").https.onCall(async (data, context) => {
  console.log('[verifyOTP Function] Triggered with data:', data);
  if (!context.auth) {
    console.error('[verifyOTP Function] Unauthenticated call.');
    throw new functions.https.HttpsError('unauthenticated', 'يجب تسجيل الدخول للتحقق من رمز التحقق');
  }
  const uid = context.auth.uid;
  const { otp } = data;

  if (!otp) {
    console.error('[verifyOTP Function] OTP not provided.');
    throw new functions.https.HttpsError('invalid-argument', 'يجب توفير رمز التحقق');
  }
  const isOwner = context.auth.token.isSystemOwner === true;
  if (!isOwner) {
    console.error(`[verifyOTP Function] Permission denied for user ${uid}. Not a system owner.`);
    throw new functions.https.HttpsError('permission-denied', 'غير مصرح لك بالتحقق من رمز التحقق.');
  }

  try {
    const db = admin.firestore();
    const otpDoc = await db.collection('debugOTP').doc(uid).get();
    if (!otpDoc.exists) {
      console.warn(`[verifyOTP Function] OTP document not found for user ${uid}.`);
      throw new functions.https.HttpsError('not-found', 'لم يتم العثور على رمز تحقق');
    }
    const otpData = otpDoc.data();
    if (!otpData || otpData.otp !== otp || otpData.used === true) {
      console.warn(`[verifyOTP Function] Invalid or used OTP for user ${uid}. Provided: ${otp}, Stored: ${otpData?.otp}, Used: ${otpData?.used}`);
      throw new functions.https.HttpsError('invalid-argument', 'رمز التحقق غير صحيح أو تم استخدامه بالفعل');
    }
    const expiryTime = otpData.expiryTime.toDate();
    if (expiryTime < new Date()) {
      console.warn(`[verifyOTP Function] Expired OTP for user ${uid}. Expires: ${expiryTime}, Current: ${new Date()}`);
      throw new functions.https.HttpsError('deadline-exceeded', 'رمز التحقق منتهي الصلاحية');
    }
    await otpDoc.ref.update({ used: true });
    const sessionExpiryTime = Date.now() + 30 * 60 * 1000; // 30 minutes
    console.log(`[verifyOTP Function] OTP verified successfully for user ${uid}. Session expires at ${new Date(sessionExpiryTime).toISOString()}`);
    return { success: true, sessionExpiryTime, message: 'تم التحقق من رمز التحقق بنجاح' };
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    console.error('[verifyOTP Function] Error:', error);
    throw new functions.https.HttpsError('internal', 'حدث خطأ أثناء التحقق من رمز التحقق', error);
  }
});

    