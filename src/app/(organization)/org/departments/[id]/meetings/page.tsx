'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useParams, useRouter } from 'next/navigation';
import { Calendar, ArrowLeft, Building2 } from 'lucide-react';
import { db } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { DailyMeetingGenerator } from '@/components/meetings/DailyMeetingGenerator';

interface Department {
  id: string;
  name: string;
  description?: string;
  organizationId: string;
  managerId?: string;
}

export default function DepartmentMeetingsPage() {
  const { user, userClaims } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const departmentId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [department, setDepartment] = useState<Department | null>(null);
  const [activeTab, setActiveTab] = useState('daily');

  const organizationId = userClaims?.organizationId;
  // استخدام أسماء الحقول الصحيحة من قاعدة البيانات
  const isOwner = userClaims?.organization_owner === true || userClaims?.isOwner === true;
  const isAdmin = userClaims?.admin === true || userClaims?.isAdmin === true;
  const isEngineer = userClaims?.engineer === true;
  const isSupervisor = userClaims?.supervisor === true;
  const canManageMeetings = isOwner || isAdmin || isEngineer || isSupervisor;

  // تحميل معلومات القسم
  useEffect(() => {
    if (!user || !organizationId || !departmentId) {
      setLoading(false);
      return;
    }

    const fetchDepartment = async () => {
      try {
        const departmentDoc = await getDoc(doc(db, 'departments', departmentId));

        if (!departmentDoc.exists()) {
          toast({
            title: 'خطأ',
            description: 'القسم غير موجود',
            variant: 'destructive',
          });
          router.push('/org/departments');
          return;
        }

        const departmentData = departmentDoc.data() as Department;

        // التحقق من أن القسم ينتمي للمؤسسة الحالية
        if (departmentData.organizationId !== organizationId) {
          toast({
            title: 'خطأ',
            description: 'ليس لديك صلاحية الوصول إلى هذا القسم',
            variant: 'destructive',
          });
          router.push('/org/departments');
          return;
        }

        setDepartment({
          id: departmentDoc.id,
          ...departmentData,
        });
      } catch (error) {
        console.error('Error fetching department:', error);
        toast({
          title: 'خطأ',
          description: 'حدث خطأ أثناء تحميل معلومات القسم',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDepartment();
  }, [user, organizationId, departmentId, router, toast]);

  // إعادة توجيه المستخدم إلى صفحة الاجتماعات بعد إنشاء اجتماع جديد
  const handleMeetingCreated = () => {
    router.push('/org/meetings');
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-12 w-full mb-6" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!department) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-destructive">القسم غير موجود أو ليس لديك صلاحية الوصول إليه.</p>
            <Button asChild className="mt-4">
              <Link href="/org/departments">العودة إلى الأقسام</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center">
            <Calendar className="ml-2 h-6 w-6" />
            <Building2 className="ml-2 h-6 w-6 text-primary" />
            اجتماعات قسم {department.name}
          </h1>
          <p className="text-muted-foreground mt-1">
            إدارة وتنظيم اجتماعات القسم وجداول الأعمال
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/org/departments/${departmentId}`}>
            <ArrowLeft className="ml-2 h-4 w-4" />
            العودة إلى القسم
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="daily" value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="grid grid-cols-2 mb-4">
          <TabsTrigger value="daily">
            <div className="flex items-center">
              <Calendar className="ml-2 h-4 w-4" />
              الاجتماع اليومي
            </div>
          </TabsTrigger>
          <TabsTrigger value="all">
            <div className="flex items-center">
              <Calendar className="ml-2 h-4 w-4" />
              جميع الاجتماعات
            </div>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="daily">
          <div className="grid grid-cols-1 gap-6">
            <DailyMeetingGenerator
              departmentId={departmentId}
              onSuccess={handleMeetingCreated}
            />

            <Card>
              <CardHeader>
                <CardTitle>تعليمات الاجتماع اليومي</CardTitle>
                <CardDescription>
                  إرشادات لإدارة الاجتماع اليومي بفعالية
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-medium mb-1">1. الإعداد المسبق</h3>
                  <p className="text-sm text-muted-foreground">
                    استخدم أداة توليد جدول الأعمال قبل الاجتماع بوقت كافٍ، وأضف توجيهات مخصصة لتركيز الاجتماع على النقاط المهمة.
                  </p>
                </div>

                <div>
                  <h3 className="font-medium mb-1">2. الالتزام بالوقت</h3>
                  <p className="text-sm text-muted-foreground">
                    حافظ على مدة الاجتماع بين 15-30 دقيقة، والتزم بالوقت المخصص لكل بند في جدول الأعمال.
                  </p>
                </div>

                <div>
                  <h3 className="font-medium mb-1">3. التركيز على الحلول</h3>
                  <p className="text-sm text-muted-foreground">
                    عند مناقشة المهام المتأخرة، ركز على الحلول وليس اللوم، وحدد خطوات عملية للمضي قدمًا.
                  </p>
                </div>

                <div>
                  <h3 className="font-medium mb-1">4. توثيق القرارات والمهام</h3>
                  <p className="text-sm text-muted-foreground">
                    سجل جميع القرارات والمهام الجديدة في نهاية الاجتماع، وتأكد من تعيين مسؤول لكل مهمة.
                  </p>
                </div>

                <div>
                  <h3 className="font-medium mb-1">5. المتابعة</h3>
                  <p className="text-sm text-muted-foreground">
                    أرسل ملخص الاجتماع والقرارات لجميع المشاركين بعد الاجتماع مباشرة.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="all">
          <Card>
            <CardHeader>
              <CardTitle>جميع اجتماعات القسم</CardTitle>
              <CardDescription>
                عرض وإدارة جميع اجتماعات القسم
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-6">
                <Button asChild>
                  <Link href="/org/meetings">
                    عرض جميع الاجتماعات
                  </Link>
                </Button>
                <p className="text-sm text-muted-foreground mt-4">
                  يمكنك عرض جميع اجتماعات القسم وإدارتها من صفحة الاجتماعات الرئيسية
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
