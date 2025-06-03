'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle, XCircle, Building, User, Mail } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

interface InvitationInfo {
  invitation: {
    id: string;
    email: string;
    role: string;
    status: 'pending' | 'accepted' | 'rejected';
    invitedByName: string;
    createdAt: any;
    departmentId: string | null;
  };
  organization: {
    id: string;
    name: string;
    description: string | null;
    type: string | null;
    website: string | null;
  };
  department: {
    id: string;
    name: string;
    description: string | null;
  } | null;
}

export default function InvitationPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const invitationId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [invitationInfo, setInvitationInfo] = useState<InvitationInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ترجمة الأدوار (النمط الجديد is* فقط)
  const roleTranslations: { [key: string]: string } = {
    'isOrgOwner': 'مالك المؤسسة',
    'isOrgAdmin': 'مدير المؤسسة',
    'isOrgSupervisor': 'مشرف',
    'isOrgEngineer': 'مهندس',
    'isOrgTechnician': 'فني',
    'isOrgAssistant': 'مساعد'
  };

  // جلب بيانات الدعوة باستخدام Firebase Function (آمن للمستخدمين غير المسجلين)
  useEffect(() => {
    const fetchInvitationInfo = async () => {
      try {
        // استخدام Firebase Function لجلب البيانات الآمنة
        const getInvitationInfo = httpsCallable(functions, 'getInvitationInfo');
        const result = await getInvitationInfo({ invitationId });

        const data = result.data as { success: boolean } & InvitationInfo;

        if (data.success) {
          setInvitationInfo(data);

          // التحقق من البريد الإلكتروني إذا كان المستخدم مسجل دخول
          if (user && user.email !== data.invitation.email) {
            setError('هذه الدعوة ليست لبريدك الإلكتروني الحالي');
          }
        } else {
          setError('فشل في جلب بيانات الدعوة');
        }

      } catch (error: any) {
        console.error('Error fetching invitation info:', error);

        // معالجة أخطاء Firebase Functions
        if (error.code === 'functions/not-found') {
          setError('الدعوة غير موجودة أو انتهت صلاحيتها');
        } else if (error.code === 'functions/failed-precondition') {
          setError(error.message || 'هذه الدعوة تمت معالجتها بالفعل');
        } else {
          setError('حدث خطأ أثناء جلب بيانات الدعوة');
        }
      } finally {
        setLoading(false);
      }
    };

    if (invitationId) {
      fetchInvitationInfo();
    }
  }, [invitationId, user]);

  // قبول الدعوة
  const handleAcceptInvitation = async () => {
    if (!user || !invitationInfo) return;

    setProcessing(true);
    try {
      const acceptOrganizationInvitation = httpsCallable(functions, 'acceptOrganizationInvitation');
      await acceptOrganizationInvitation({ invitationId });

      // إعادة توجيه إلى صفحة المؤسسة
      router.push('/org/dashboard');
    } catch (error: any) {
      console.error('Error accepting invitation:', error);
      setError(error.message || 'حدث خطأ أثناء قبول الدعوة');
    } finally {
      setProcessing(false);
    }
  };

  // رفض الدعوة
  const handleRejectInvitation = async () => {
    if (!user || !invitationInfo) return;

    setProcessing(true);
    try {
      const rejectOrganizationInvitation = httpsCallable(functions, 'rejectOrganizationInvitation');
      await rejectOrganizationInvitation({ invitationId });

      setError('تم رفض الدعوة بنجاح');
    } catch (error: any) {
      console.error('Error rejecting invitation:', error);
      setError(error.message || 'حدث خطأ أثناء رفض الدعوة');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>جاري تحميل الدعوة...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-red-600">خطأ في الدعوة</CardTitle>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <Button
              onClick={() => router.push('/')}
              className="w-full mt-4"
              variant="outline"
            >
              العودة للصفحة الرئيسية
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invitationInfo) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
      <Card className="w-full max-w-lg shadow-xl">
        <CardHeader className="text-center pb-6">
          <div className="mx-auto mb-4 p-3 bg-blue-100 rounded-full">
            <Building className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            دعوة للانضمام إلى المؤسسة
          </CardTitle>
          <CardDescription className="text-gray-600">
            تم دعوتك للانضمام إلى مؤسسة جديدة
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* معلومات المؤسسة */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-3 flex items-center">
              <Building className="h-5 w-5 ml-2" />
              تفاصيل المؤسسة
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">اسم المؤسسة:</span>
                <span className="font-medium text-blue-700">{invitationInfo.organization.name}</span>
              </div>
              {invitationInfo.organization.description && (
                <div className="flex justify-between">
                  <span className="text-gray-600">وصف المؤسسة:</span>
                  <span className="font-medium text-sm">{invitationInfo.organization.description}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">الدور المطلوب:</span>
                <Badge variant="secondary">
                  {roleTranslations[invitationInfo.invitation.role] || invitationInfo.invitation.role}
                </Badge>
              </div>
              {invitationInfo.department && (
                <div className="flex justify-between">
                  <span className="text-gray-600">القسم:</span>
                  <Badge variant="outline" className="text-green-700 border-green-300">
                    {invitationInfo.department.name}
                  </Badge>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">دعوة من:</span>
                <span className="font-medium">{invitationInfo.invitation.invitedByName}</span>
              </div>
            </div>
          </div>

          {/* معلومات المستخدم */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
              <User className="h-5 w-5 ml-2" />
              معلومات الدعوة
            </h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">البريد الإلكتروني:</span>
                <span className="font-medium flex items-center">
                  <Mail className="h-4 w-4 ml-1" />
                  {invitationInfo.invitation.email}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">تاريخ الدعوة:</span>
                <span className="font-medium">
                  {invitationInfo.invitation.createdAt?.toDate?.()?.toLocaleDateString('ar-SA') || 'غير محدد'}
                </span>
              </div>
              {invitationInfo.organization.website && (
                <div className="flex justify-between">
                  <span className="text-gray-600">موقع المؤسسة:</span>
                  <a
                    href={invitationInfo.organization.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-600 hover:underline"
                  >
                    زيارة الموقع
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* أزرار العمل */}
          {user ? (
            <div className="flex gap-3">
              <Button
                onClick={handleAcceptInvitation}
                disabled={processing}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {processing ? (
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                ) : (
                  <CheckCircle className="h-4 w-4 ml-2" />
                )}
                قبول الدعوة
              </Button>
              <Button
                onClick={handleRejectInvitation}
                disabled={processing}
                variant="outline"
                className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
              >
                {processing ? (
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                ) : (
                  <XCircle className="h-4 w-4 ml-2" />
                )}
                رفض الدعوة
              </Button>
            </div>
          ) : (
            <Alert>
              <AlertTitle>تسجيل الدخول مطلوب</AlertTitle>
              <AlertDescription>
                يجب تسجيل الدخول أولاً لقبول أو رفض الدعوة.
              </AlertDescription>
              <Button
                onClick={() => router.push('/auth/login')}
                className="w-full mt-3"
              >
                تسجيل الدخول
              </Button>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
