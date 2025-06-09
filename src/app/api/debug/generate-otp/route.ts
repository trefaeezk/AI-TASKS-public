import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/config/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// دالة لإنشاء رمز OTP عشوائي
function generateOTP(): string {
  // إنشاء رمز من 6 أرقام
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: NextRequest) {
  try {
    // الحصول على المستخدم الحالي
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول لإنشاء رمز التحقق' },
        { status: 401 }
      );
    }

    // التحقق من أن المستخدم هو مالك التطبيق
    const idTokenResult = await currentUser.getIdTokenResult();
    const isOwner = idTokenResult.claims.owner === true;

    if (!isOwner) {
      return NextResponse.json(
        { error: 'غير مصرح لك بإنشاء رمز التحقق' },
        { status: 403 }
      );
    }

    // حذف الرموز القديمة للمستخدم
    const otpCollectionRef = collection(db, 'debugOTP');
    const userOTPQuery = query(otpCollectionRef, where('userId', '==', currentUser.uid));
    const userOTPDocs = await getDocs(userOTPQuery);

    // حذف جميع الرموز القديمة
    const deletePromises = userOTPDocs.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);

    // إنشاء رمز OTP جديد
    const otp = generateOTP();

    // وقت انتهاء الصلاحية (30 دقيقة من الآن)
    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + 30);

    // تخزين الرمز في قاعدة البيانات
    await addDoc(collection(db, 'debugOTP'), {
      userId: currentUser.uid,
      userEmail: currentUser.email,
      otp,
      createdAt: serverTimestamp(),
      expiryTime,
      used: false
    });

    // تسجيل نشاط إنشاء رمز التحقق
    await addDoc(collection(db, 'debugActivityLogs'), {
      userId: currentUser.uid,
      userEmail: currentUser.email,
      action: 'تم إنشاء رمز تحقق جديد',
      timestamp: serverTimestamp(),
      userAgent: request.headers.get('user-agent') || 'غير معروف',
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'غير معروف',
    });

    // في بيئة الإنتاج، يمكن إرسال الرمز عبر البريد الإلكتروني أو الرسائل القصيرة
    // هنا نعيد الرمز مباشرة للاختبار فقط
    return NextResponse.json({
      success: true,
      otp,
      expiryTime: expiryTime.toISOString(),
      message: 'تم إنشاء رمز التحقق بنجاح. في بيئة الإنتاج، سيتم إرسال هذا الرمز عبر البريد الإلكتروني أو الرسائل القصيرة.'
    });
  } catch (error: any) {
    console.error('خطأ في إنشاء رمز التحقق:', error);
    return NextResponse.json(
      { error: error.message || 'حدث خطأ أثناء إنشاء رمز التحقق' },
      { status: 500 }
    );
  }
}
