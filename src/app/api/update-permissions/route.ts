import { NextRequest, NextResponse } from 'next/server';
import { db, functions } from '@/config/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { getAuth } from 'firebase/auth';

export async function POST(request: NextRequest) {
  try {
    // الحصول على بيانات الطلب
    const data = await request.json();
    const { userId, role, permissions } = data;

    console.log('Updating permissions for user:', userId);
    console.log('New role:', role);
    console.log('New permissions:', permissions);

    // التحقق من وجود المستخدم في مجموعة users
    const userDoc = await getDoc(doc(db, 'users', userId));

    if (userDoc.exists()) {
      console.log('User found in users collection, updating...');
      // تحديث بيانات المستخدم
      await updateDoc(doc(db, 'users', userId), {
        role: role || 'independent',
        customPermissions: permissions || [],
        updatedAt: new Date()
      });
    } else {
      console.log('User not found in users collection, creating...');
      // إنشاء وثيقة جديدة للمستخدم
      await setDoc(doc(db, 'users', userId), {
        role: role || 'independent',
        customPermissions: permissions || [],
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    // التحقق من وجود المستخدم في مجموعة individuals
    const individualDoc = await getDoc(doc(db, 'individuals', userId));

    if (individualDoc.exists()) {
      console.log('User found in individuals collection, updating...');
      // تحديث بيانات المستخدم
      await updateDoc(doc(db, 'individuals', userId), {
        role: role || 'independent',
        customPermissions: permissions || [],
        updatedAt: new Date()
      });
    } else {
      console.log('User not found in individuals collection, creating...');
      // إنشاء وثيقة جديدة للمستخدم
      await setDoc(doc(db, 'individuals', userId), {
        role: role || 'independent',
        customPermissions: permissions || [],
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    // استدعاء وظيفة سحابية لتحديث Custom Claims في Firebase Auth
    try {
      // الحصول على المستخدم الحالي
      const auth = getAuth();
      const currentUser = auth.currentUser;

      if (!currentUser) {
        throw new Error('يجب تسجيل الدخول لتحديث الصلاحيات');
      }

      // استدعاء وظيفة تحديث الصلاحيات
      const updateUserPermissionsHttp = httpsCallable(functions, 'updateUserPermissionsHttp');

      const result = await updateUserPermissionsHttp({
        uid: userId,
        role: role,
        permissions: permissions
      });

      console.log('Firebase Auth Custom Claims updated successfully:', result);
    } catch (authError: any) {
      console.error('Error updating Firebase Auth Custom Claims:', authError);
      // لا نريد إيقاف العملية إذا فشل تحديث Custom Claims
      // سنعيد رسالة نجاح مع تحذير
      return NextResponse.json({
        success: true,
        warning: 'تم تحديث قاعدة البيانات بنجاح، لكن فشل تحديث صلاحيات المصادقة. قد تحتاج إلى تسجيل الخروج وإعادة تسجيل الدخول لرؤية التغييرات.'
      });
    }

    console.log('Permissions updated successfully');
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating permissions:', error);
    return NextResponse.json(
      { error: error.message || 'حدث خطأ أثناء تحديث الصلاحيات' },
      { status: 500 }
    );
  }
}
