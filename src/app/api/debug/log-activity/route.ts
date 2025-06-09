import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

export async function POST(request: NextRequest) {
  try {
    // الحصول على بيانات الطلب
    const data = await request.json();
    const { action } = data;

    // الحصول على المستخدم الحالي
    const auth = getAuth();
    const currentUser = auth.currentUser;

    if (!currentUser) {
      return NextResponse.json(
        { error: 'يجب تسجيل الدخول لتسجيل النشاط' },
        { status: 401 }
      );
    }

    // إنشاء سجل النشاط
    const activityLog = {
      userId: currentUser.uid,
      userEmail: currentUser.email,
      action,
      timestamp: serverTimestamp(),
      userAgent: request.headers.get('user-agent') || 'غير معروف',
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'غير معروف',
    };

    // إضافة السجل إلى قاعدة البيانات
    await addDoc(collection(db, 'debugActivityLogs'), activityLog);

    console.log('تم تسجيل النشاط بنجاح:', activityLog);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('خطأ في تسجيل النشاط:', error);
    return NextResponse.json(
      { error: error.message || 'حدث خطأ أثناء تسجيل النشاط' },
      { status: 500 }
    );
  }
}
