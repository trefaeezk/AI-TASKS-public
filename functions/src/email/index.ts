import { Resend } from 'resend';
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// تكوين مفتاح API لـ Resend
// يجب إضافة مفتاح API في إعدادات Firebase Functions Environment Variables
// firebase functions:config:set resend.apikey="YOUR_RESEND_API_KEY"
const apiKey = process.env.RESEND_API_KEY || functions.config().resend?.apikey || 're_ArCXhKjj_NS9DCLB8DYpKL3HV6FxcXu92';
console.log('Resend API Key:', apiKey); // إضافة سجل للتحقق من المفتاح

// إنشاء مثيل من Resend
const resend = new Resend(apiKey);

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
  if (!apiKey) {
    console.error('Resend API key is not set. Cannot send email.');
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
      // إضافة خاصية react لتوافق مع متطلبات Resend API
      react: null
    };

    // إضافة الخيارات الاختيارية إذا كانت موجودة
    if (emailData.cc) emailOptions.cc = emailData.cc;
    if (emailData.bcc) emailOptions.bcc = emailData.bcc;
    if (emailData.replyTo) emailOptions.reply_to = emailData.replyTo;

    console.log('Sending email with options:', JSON.stringify(emailOptions));

    try {
      const result = await resend.emails.send(emailOptions);

      console.log('Resend API response:', JSON.stringify(result));

      if (result.error) {
        console.error('Error sending email with Resend:', result.error);
        return false;
      }

      console.log(`Email sent successfully to ${emailData.to} with ID: ${result.data?.id}`);
      return true;
    } catch (sendError) {
      console.error('Exception during Resend API call:', sendError);
      return false;
    }
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

  // إذا كان هناك قالب معد مسبقًا في Resend، يمكن استخدامه هنا
  // يمكن استخدام React Email مع Resend لإنشاء قوالب بريد إلكتروني جميلة
  // https://resend.com/docs/react-email

  // استخدام HTML مخصص إذا لم يكن هناك قالب
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

  return sendEmail({
    to,
    subject,
    text,
    html,
  });
};

/**
 * إرسال بريد إلكتروني ترحيبي للمستخدمين الجدد
 * تم تعطيلها مؤقتًا لتقليل استهلاك الموارد
 */
// export const sendWelcomeEmail = async (...)

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

  // تنسيق تاريخ الاستحقاق
  const formattedDate = dueDate.toLocaleDateString('ar-SA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

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

  return sendEmail({
    to,
    subject,
    text,
    html,
  });
};

// دالة لإنشاء رمز OTP عشوائي
function generateOTP(): string {
  // إنشاء رمز من 6 أرقام
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
  const subject = `دعوة للانضمام إلى مؤسسة ${organizationName}`;

  // ترجمة الأدوار للعربية (النمط الجديد is* فقط)
  const roleTranslations: { [key: string]: string } = {
    'isOrgOwner': 'مالك المؤسسة',
    'isOrgAdmin': 'مدير المؤسسة',
    'isOrgSupervisor': 'مشرف',
    'isOrgEngineer': 'مهندس',
    'isOrgTechnician': 'فني',
    'isOrgAssistant': 'مساعد'
  };

  const roleInArabic = roleTranslations[role] || role;

  const text = `
مرحبًا،

تم دعوتك للانضمام إلى مؤسسة "${organizationName}" بدور "${roleInArabic}" من قبل ${inviterName}.

للانضمام إلى المؤسسة، يرجى النقر على الرابط التالي:
${invitationUrl}

إذا لم تكن تتوقع هذه الدعوة، يمكنك تجاهل هذا البريد الإلكتروني.

مع تحيات فريق Tasks Intelligence
  `;

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
          <a href="${invitationUrl}"
             style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
                    color: white;
                    padding: 15px 30px;
                    text-decoration: none;
                    border-radius: 8px;
                    display: inline-block;
                    font-weight: bold;
                    font-size: 16px;
                    box-shadow: 0 4px 15px rgba(37, 99, 235, 0.3);
                    transition: all 0.3s ease;">
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

  return sendEmail({
    to,
    subject,
    text,
    html,
  });
};

/**
 * وظيفة سحابية لإنشاء وإرسال رمز OTP
 * تتحقق من أن المستخدم هو مالك التطبيق
 * ثم تنشئ رمز OTP وترسله عبر البريد الإلكتروني
 */
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

  if (!userEmail) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'لا يوجد بريد إلكتروني مرتبط بحسابك'
    );
  }

  try {
    const db = admin.firestore();

    // إنشاء رمز OTP جديد
    const otp = generateOTP();

    // وقت انتهاء الصلاحية (30 دقيقة من الآن)
    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + 30);

    // تخزين الرمز في قاعدة البيانات (مع حذف الرموز القديمة)
    await db.collection('debugOTP').doc(uid).set({
      userId: uid,
      userEmail: userEmail,
      otp,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiryTime,
      used: false
    });

    // إرسال الرمز عبر البريد الإلكتروني باستخدام SMTP
    console.log(`Attempting to send OTP email via SMTP to ${userEmail} with code ${otp}`);

    try {
      // استيراد وظيفة sendOTPEmailSMTP من ملف smtp
      const { sendOTPEmailSMTP } = await import('../email/smtp');

      // إرسال البريد الإلكتروني باستخدام SMTP
      const smtpEmailSent = await sendOTPEmailSMTP(userEmail, otp, expiryTime);

      if (smtpEmailSent) {
        console.log(`Successfully sent OTP email via SMTP to ${userEmail}`);
        return {
          success: true,
          emailSent: true,
          expiryTime: expiryTime.toISOString(),
          message: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني'
        };
      } else {
        console.warn(`Failed to send OTP email via SMTP to ${userEmail}`);
      }
    } catch (smtpError) {
      console.error('Error sending email via SMTP:', smtpError);
    }

    // إذا فشل إرسال البريد الإلكتروني باستخدام SMTP، نحاول استخدام Resend
    console.log(`Attempting to send OTP email via Resend to ${userEmail} with code ${otp}`);
    const emailSent = await sendOTPEmail(userEmail, otp, expiryTime);

    if (!emailSent) {
      console.warn(`Failed to send OTP email via Resend to ${userEmail}`);
    } else {
      console.log(`Successfully sent OTP email via Resend to ${userEmail}`);
    }

    // إرجاع نتيجة العملية
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

/**
 * وظيفة سحابية للتحقق من رمز OTP
 * تتحقق من صحة الرمز وأنه لم ينته وقته ولم يتم استخدامه من قبل
 */
export const verifyOTP = functions.https.onCall(async (data, context) => {
  // التحقق من وجود مستخدم مسجل الدخول
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'يجب تسجيل الدخول للتحقق من رمز التحقق'
    );
  }

  const uid = context.auth.uid;
  const { otp } = data;

  if (!otp) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'يجب توفير رمز التحقق'
    );
  }

  // التحقق من أن المستخدم هو مالك التطبيق
  const isOwner = context.auth.token.owner === true;

  if (!isOwner) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'غير مصرح لك بالتحقق من رمز التحقق'
    );
  }

  try {
    const db = admin.firestore();

    // البحث عن الرمز في قاعدة البيانات
    const otpDoc = await db.collection('debugOTP').doc(uid).get();

    if (!otpDoc.exists) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'لم يتم العثور على رمز تحقق'
      );
    }

    const otpData = otpDoc.data();

    if (!otpData || otpData.otp !== otp || otpData.used === true) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'رمز التحقق غير صحيح أو تم استخدامه بالفعل'
      );
    }

    // التحقق من انتهاء صلاحية الرمز
    const expiryTime = otpData.expiryTime.toDate();
    if (expiryTime < new Date()) {
      throw new functions.https.HttpsError(
        'deadline-exceeded',
        'رمز التحقق منتهي الصلاحية'
      );
    }

    // تحديث حالة الرمز إلى "مستخدم"
    await otpDoc.ref.update({ used: true });

    // إنشاء وقت انتهاء الصلاحية للجلسة (30 دقيقة من الآن)
    const sessionExpiryTime = Date.now() + 30 * 60 * 1000;

    return {
      success: true,
      sessionExpiryTime,
      message: 'تم التحقق من رمز التحقق بنجاح'
    };
  } catch (error) {
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }

    console.error('Error verifying OTP:', error);
    throw new functions.https.HttpsError(
      'internal',
      'حدث خطأ أثناء التحقق من رمز التحقق',
      error
    );
  }
});

// تم حذف وظيفة اختبار إرسال البريد الإلكتروني لأنها نجحت