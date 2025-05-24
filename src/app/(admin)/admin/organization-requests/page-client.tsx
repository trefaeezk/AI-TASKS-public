'use client';

// منع التوليد المسبق للصفحة
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { collection, query, getDocs, orderBy, doc, updateDoc } from 'firebase/firestore';
import { ExtendedUser } from '@/types/user';
import { db } from '@/lib/firebase';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { auth } from '@/config/firebase';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Loader2, Check, X, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/PageHeader';

interface OrganizationRequest {
  id: string;
  name: string;
  description: string;
  userName: string;
  userEmail: string;
  userId: string;
  contactEmail: string;
  contactPhone: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
  updatedAt: any;
}

export default function OrganizationRequestsPage() {
  const { user, userClaims, refreshUserData } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const [requests, setRequests] = useState<OrganizationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // التحقق من أن المستخدم مالك النظام أو مدير النظام
  const isSystemOwner = userClaims?.system_owner === true;
  const isSystemAdmin = userClaims?.system_admin === true;
  const isOwner = isSystemOwner || isSystemAdmin || userClaims?.owner === true || userClaims?.admin === true;

  // طباعة معلومات المستخدم للتصحيح
  console.log('User Claims:', userClaims);
  console.log('Is Owner or Admin:', isOwner);

  // إعادة توجيه المستخدم إذا لم يكن مالكًا
  useEffect(() => {
    if (user && userClaims && !isOwner) {
      toast({
        title: 'غير مصرح',
        description: 'ليس لديك صلاحية الوصول إلى هذه الصفحة، هذه الصفحة متاحة لمالك النظام فقط',
        variant: 'destructive',
      });
      router.push('/');
    }
  }, [user, userClaims, isOwner, router, toast]);

  // تحميل طلبات إنشاء المؤسسات
  useEffect(() => {
    if (!user || !isOwner) return;

    const loadRequests = async () => {
      try {
        // إنشاء استعلام لجلب جميع الطلبات مرتبة حسب الحالة (المعلقة أولاً) ثم حسب تاريخ الإنشاء (الأحدث أولاً)
        const requestsQuery = query(
          collection(db, 'organizationRequests'),
          orderBy('status'),
          orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(requestsQuery);
        const requestsData: OrganizationRequest[] = [];

        snapshot.forEach((doc) => {
          requestsData.push({
            id: doc.id,
            ...doc.data()
          } as OrganizationRequest);
        });

        setRequests(requestsData);
      } catch (error) {
        console.error('Error loading organization requests:', error);
        toast({
          title: 'خطأ',
          description: 'حدث خطأ أثناء تحميل طلبات إنشاء المؤسسات',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadRequests();
  }, [user, isOwner, toast]);

  // الموافقة على طلب إنشاء مؤسسة
  const approveRequest = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      const approveOrganizationRequest = httpsCallable(functions, 'approveOrganizationRequest');
      await approveOrganizationRequest({ requestId });

      toast({
        title: 'تمت الموافقة',
        description: 'تمت الموافقة على طلب إنشاء المؤسسة بنجاح',
      });

      // تحديث حالة الطلب في القائمة المحلية
      setRequests(requests.map(req =>
        req.id === requestId
          ? { ...req, status: 'approved', updatedAt: new Date() }
          : req
      ));
    } catch (error: any) {
      console.error('Error approving organization request:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء الموافقة على طلب إنشاء المؤسسة',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  // رفض طلب إنشاء مؤسسة
  const rejectRequest = async (requestId: string) => {
    setProcessingId(requestId);
    try {
      const rejectOrganizationRequest = httpsCallable(functions, 'rejectOrganizationRequest');
      await rejectOrganizationRequest({ requestId });

      toast({
        title: 'تم الرفض',
        description: 'تم رفض طلب إنشاء المؤسسة بنجاح',
      });

      // تحديث حالة الطلب في القائمة المحلية
      setRequests(requests.map(req =>
        req.id === requestId
          ? { ...req, status: 'rejected', updatedAt: new Date() }
          : req
      ));
    } catch (error: any) {
      console.error('Error rejecting organization request:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء رفض طلب إنشاء المؤسسة',
        variant: 'destructive',
      });
    } finally {
      setProcessingId(null);
    }
  };

  // عرض حالة الطلب
  const renderRequestStatus = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800">قيد المراجعة</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-100 text-green-800">تمت الموافقة</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-100 text-red-800">تم الرفض</Badge>;
      default:
        return <Badge variant="outline">غير معروف</Badge>;
    }
  };

  // إذا لم يكن المستخدم مسجل الدخول أو جاري التحميل
  if (!user || loading) {
    return (
      <div className="container mx-auto py-6 flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // إذا لم يكن المستخدم مالكًا
  if (!isOwner) {
    return (
      <div className="container mx-auto py-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-destructive flex items-center">
              <AlertTriangle className="ml-2 h-5 w-5" />
              غير مصرح
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center">ليس لديك صلاحية الوصول إلى هذه الصفحة، هذه الصفحة متاحة لمالك النظام فقط</p>
            <p className="text-center mt-4">إذا كنت قد تم تعيينك كمالك مؤخرًا، يرجى تسجيل الخروج وإعادة تسجيل الدخول لتحديث صلاحياتك.</p>
            <div className="mt-4 p-4 bg-muted rounded-md">
              <div className="flex justify-between items-center">
                <h3 className="text-sm font-semibold mb-2">معلومات المستخدم الحالية:</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => {
                    // عرض معلومات المستخدم كاملة
                    toast({
                      title: 'معلومات المستخدم الكاملة',
                      description: (
                        <pre className="mt-2 w-full p-2 rounded bg-muted text-xs overflow-auto">
                          {JSON.stringify(user, null, 2)}
                        </pre>
                      ),
                      duration: 10000,
                    });
                  }}
                >
                  عرض كامل البيانات
                </Button>
              </div>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li><strong>الدور:</strong> {(user as ExtendedUser)?.customClaims?.role || 'غير محدد'}</li>
                <li><strong>مالك النظام:</strong> {(user as ExtendedUser)?.customClaims?.owner ? 'نعم' : 'لا'}</li>
                <li><strong>مسؤول:</strong> {(user as ExtendedUser)?.customClaims?.admin ? 'نعم' : 'لا'}</li>
                <li><strong>مسؤول نظام الأفراد:</strong> {(user as ExtendedUser)?.customClaims?.individual_admin ? 'نعم' : 'لا'}</li>
                <li><strong>البريد الإلكتروني:</strong> {user?.email || 'غير متوفر'}</li>
                <li><strong>معرف المستخدم:</strong> {user?.uid || 'غير متوفر'}</li>
              </ul>

              <div className="mt-4 space-y-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      // استدعاء دالة تعيين المستخدم كمالك
                      const functions = getFunctions();
                      const setOwnerRoleFunction = httpsCallable(functions, 'setOwnerRole');
                      await setOwnerRoleFunction({ uid: user?.uid, isOwner: true });

                      toast({
                        title: 'تم تعيين نفسك كمالك',
                        description: 'تم تعيينك كمالك بنجاح. يرجى تسجيل الخروج وإعادة تسجيل الدخول لتفعيل الصلاحيات الجديدة.',
                      });
                    } catch (error) {
                      console.error('Error setting owner role:', error);
                      toast({
                        title: 'خطأ',
                        description: 'حدث خطأ أثناء تعيين نفسك كمالك',
                        variant: 'destructive',
                      });
                    }
                  }}
                  className="w-full"
                >
                  <ShieldCheck className="ml-1.5 h-4 w-4" />
                  تعيين نفسي كمالك
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      // تعيين المستخدم كمالك بشكل مباشر عن طريق تحديث وثيقة المستخدم
                      const userDocRef = doc(db, 'users', user?.uid || '');
                      await updateDoc(userDocRef, {
                        role: 'owner',
                        isOwner: true,
                        isAdmin: true,
                        updatedAt: new Date()
                      });

                      toast({
                        title: 'تم تحديث وثيقة المستخدم',
                        description: 'تم تحديث وثيقة المستخدم بنجاح. يرجى تحديث الصلاحيات ثم تسجيل الخروج وإعادة تسجيل الدخول.',
                      });
                    } catch (error) {
                      console.error('Error updating user document:', error);
                      toast({
                        title: 'خطأ',
                        description: 'حدث خطأ أثناء تحديث وثيقة المستخدم',
                        variant: 'destructive',
                      });
                    }
                  }}
                  className="w-full"
                >
                  <ShieldCheck className="ml-1.5 h-4 w-4" />
                  تحديث وثيقة المستخدم
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      // استدعاء دالة تعيين المستخدم كمالك بشكل مباشر
                      const idToken = await auth.currentUser?.getIdToken();
                      if (!idToken) {
                        throw new Error('لم يتم العثور على رمز المصادقة');
                      }

                      const response = await fetch(`https://us-central1-tasks-intelligence.cloudfunctions.net/setOwnerDirectHttp?uid=${user?.uid}`, {
                        method: 'GET',
                        headers: {
                          'Authorization': `Bearer ${idToken}`
                        }
                      });

                      if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'حدث خطأ أثناء تعيين المستخدم كمالك');
                      }

                      await response.json();

                      toast({
                        title: 'تم تعيين المستخدم كمالك',
                        description: 'تم تعيين المستخدم كمالك بنجاح. يرجى تحديث الصلاحيات ثم تسجيل الخروج وإعادة تسجيل الدخول.',
                      });

                      // تحديث معلومات المستخدم
                      await refreshUserData();
                    } catch (error) {
                      console.error('Error setting owner directly:', error);
                      toast({
                        title: 'خطأ',
                        description: `حدث خطأ أثناء تعيين المستخدم كمالك: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`,
                        variant: 'destructive',
                      });
                    }
                  }}
                  className="w-full"
                >
                  <ShieldCheck className="ml-1.5 h-4 w-4" />
                  تعيين كمالك مباشرة
                </Button>
              </div>
            </div>
            <div className="flex justify-center mt-4 gap-4">
              <Button
                onClick={async () => {
                  try {
                    // تحديث معلومات المستخدم
                    await refreshUserData();
                    toast({
                      title: 'تم التحديث',
                      description: 'تم تحديث معلومات المستخدم بنجاح، يرجى الانتظار...',
                    });
                    // تأخير قبل تحديث الصفحة
                    setTimeout(() => {
                      window.location.reload();
                    }, 1500);
                  } catch (error) {
                    console.error('Error refreshing user data:', error);
                    toast({
                      title: 'خطأ',
                      description: 'حدث خطأ أثناء تحديث معلومات المستخدم',
                      variant: 'destructive',
                    });
                  }
                }}
              >
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                تحديث الصلاحيات
              </Button>

              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    // تسجيل الخروج
                    await auth.signOut();
                    toast({
                      title: 'تم تسجيل الخروج',
                      description: 'تم تسجيل الخروج بنجاح، سيتم إعادة توجيهك لصفحة تسجيل الدخول...',
                    });
                    // إعادة توجيه المستخدم لصفحة تسجيل الدخول
                    setTimeout(() => {
                      router.push('/login');
                    }, 1500);
                  } catch (error) {
                    console.error('Error signing out:', error);
                    toast({
                      title: 'خطأ',
                      description: 'حدث خطأ أثناء تسجيل الخروج',
                      variant: 'destructive',
                    });
                  }
                }}
              >
                <X className="ml-2 h-4 w-4" />
                تسجيل الخروج وإعادة الدخول
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // فلترة الطلبات حسب الحالة
  const pendingRequests = requests.filter(req => req.status === 'pending');
  const processedRequests = requests.filter(req => req.status !== 'pending');

  return (
    <div className="container mx-auto py-6 space-y-6">
      <PageHeader
        heading="طلبات إنشاء المؤسسات"
        subheading="مراجعة والموافقة على طلبات إنشاء المؤسسات"
      />

      {/* الطلبات المعلقة */}
      <div>
        <h2 className="text-xl font-semibold mb-4">الطلبات المعلقة ({pendingRequests.length})</h2>

        {pendingRequests.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">لا توجد طلبات معلقة</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {pendingRequests.map((request) => (
              <Card key={request.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle>{request.name}</CardTitle>
                    {renderRequestStatus(request.status)}
                  </div>
                  <CardDescription>
                    تم الإرسال بواسطة: {request.userName} ({request.userEmail})
                    <br />
                    {request.createdAt && (
                      <span>
                        تم الإرسال منذ {formatDistanceToNow(request.createdAt.toDate(), { locale: ar, addSuffix: false })}
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p><strong>الوصف:</strong> {request.description || 'لا يوجد وصف'}</p>
                    <p><strong>البريد الإلكتروني للتواصل:</strong> {request.contactEmail}</p>
                    {request.contactPhone && (
                      <p><strong>رقم الهاتف للتواصل:</strong> {request.contactPhone}</p>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end space-x-2 space-x-reverse">
                  <Button
                    variant="outline"
                    onClick={() => rejectRequest(request.id)}
                    disabled={processingId === request.id}
                  >
                    {processingId === request.id ? (
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    ) : (
                      <X className="ml-2 h-4 w-4" />
                    )}
                    رفض
                  </Button>
                  <Button
                    onClick={() => approveRequest(request.id)}
                    disabled={processingId === request.id}
                  >
                    {processingId === request.id ? (
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="ml-2 h-4 w-4" />
                    )}
                    موافقة
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* الطلبات التي تمت معالجتها */}
      {processedRequests.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">الطلبات السابقة ({processedRequests.length})</h2>
          <div className="grid gap-4">
            {processedRequests.map((request) => (
              <Card key={request.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle>{request.name}</CardTitle>
                    {renderRequestStatus(request.status)}
                  </div>
                  <CardDescription>
                    تم الإرسال بواسطة: {request.userName} ({request.userEmail})
                    <br />
                    {request.createdAt && (
                      <span>
                        تم الإرسال منذ {formatDistanceToNow(request.createdAt.toDate(), { locale: ar, addSuffix: false })}
                      </span>
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p><strong>الوصف:</strong> {request.description || 'لا يوجد وصف'}</p>
                    <p><strong>البريد الإلكتروني للتواصل:</strong> {request.contactEmail}</p>
                    {request.contactPhone && (
                      <p><strong>رقم الهاتف للتواصل:</strong> {request.contactPhone}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}