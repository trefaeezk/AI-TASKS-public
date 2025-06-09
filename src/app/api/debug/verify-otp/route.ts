import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/config/firebase';
import { collection, query, where, getDocs, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

export async function POST(request: NextRequest) {
  try {
    // الحصول على بيانات الطلب
    const data = await request.json();
    const { otp } = data;

    if (!otp) {
      return NextResponse.json(
        { error: 'يجب توفير رمز التحقق' },
        { status: 400 }
      );
    }

    // الحصول على المستخدم الحالي
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول للتحقق من رمز التحقق' },
        { status: 401 }
      );
    }

    // التحقق من أن المستخدم هو مالك التطبيق
    const idTokenResult = await currentUser.getIdTokenResult();
    const isOwner = idTokenResult.claims.owner === true;

    if (!isOwner) {
      return NextResponse.json(
        { error: 'غير مصرح لك بالتحقق من رمز التحقق' },
        { status: 403 }
      );
    }

    // البحث عن الرمز في قاعدة البيانات
    const otpCollectionRef = collection(db, 'debugOTP');
    const otpQuery = query(
      otpCollectionRef, 
      where('userId', '==', currentUser.uid),
      where('otp', '==', otp),
      where('used', '==', false)
    );
    
    const otpDocs = await getDocs(otpQuery);

    if (otpDocs.empty) {
      // تسجيل محاولة فاشلة
      await addDoc(collection(db, 'debugActivityLogs'), {
        userId: currentUser.uid,
        userEmail: currentUser.email,
        action: 'محاولة فاشلة للتحقق من رمز التحقق',
        timestamp: serverTimestamp(),
        userAgent: request.headers.get('user-agent') || 'غير معروف',
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'غير معروف',
      });

      return NextResponse.json(
        { error: 'رمز التحقق غير صحيح أو منتهي الصلاحية' },
        { status: 400 }
      );
    }

    const otpDoc = otpDocs.docs[0];
    const otpData = otpDoc.data();
    
    // التحقق من انتهاء صلاحية الرمز
    const expiryTime = otpData.expiryTime.toDate();
    if (expiryTime < new Date()) {
      // تسجيل محاولة فاشلة
      await addDoc(collection(db, 'debugActivityLogs'), {
        userId: currentUser.uid,
        userEmail: currentUser.email,
        action: 'محاولة استخدام رمز تحقق منتهي الصلاحية',
        timestamp: serverTimestamp(),
        userAgent: request.headers.get('user-agent') || 'غير معروف',
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'غير معروف',
      });

      return NextResponse.json(
        { error: 'رمز التحقق منتهي الصلاحية' },
        { status: 400 }
      );
    }

    // تحديث حالة الرمز إلى "مستخدم"
    await updateDoc(otpDoc.ref, { used: true });

    // تسجيل نجاح التحقق
    await addDoc(collection(db, 'debugActivityLogs'), {
      userId: currentUser.uid,
      userEmail: currentUser.email,
      action: 'تم التحقق من رمز التحقق بنجاح',
      timestamp: serverTimestamp(),
      userAgent: request.headers.get('user-agent') || 'غير معروف',
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'غير معروف',
    });

    // إنشاء وقت انتهاء الصلاحية للجلسة (30 دقيقة من الآن)
    const sessionExpiryTime = Date.now() + 30 * 60 * 1000;

    return NextResponse.json({ 
      success: true,
      sessionExpiryTime,
      message: 'تم التحقق من رمز التحقق بنجاح'
    });
  } catch (error: any) {
    console.error('خطأ في التحقق من رمز التحقق:', error);
    return NextResponse.json(
      { error: error.message || 'حدث خطأ أثناء التحقق من رمز التحقق' },
      { status: 500 }
    );
  }
}
