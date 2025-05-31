'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useParams, useRouter } from 'next/navigation';
import { FolderTree, Users, Calendar, BarChart3, ArrowLeft, Building2 } from 'lucide-react';
import { db } from '@/config/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

interface Department {
  id: string;
  name: string;
  description?: string;
  organizationId: string;
  managerId?: string;
}

interface Member {
  uid: string;
  email: string;
  displayName?: string;
  role: string;
  departmentId?: string;
}

export default function DepartmentDetailsPage() {
  const { user, userClaims } = useAuth();
  const { toast } = useToast();
  const router = useRouter();
  const params = useParams();
  const departmentId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [department, setDepartment] = useState<Department | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [stats, setStats] = useState({
    tasks: {
      total: 0,
      completed: 0,
      pending: 0,
      overdue: 0
    },
    meetings: 0
  });

  const organizationId = userClaims?.organizationId;
  // استخدام أسماء الحقول الصحيحة من قاعدة البيانات
  const isOwner = userClaims?.organization_owner === true || userClaims?.isOwner === true;
  const isAdmin = userClaims?.admin === true || userClaims?.isAdmin === true;
  const isEngineer = userClaims?.engineer === true;
  const isSupervisor = userClaims?.supervisor === true;

  // تحميل معلومات القسم
  useEffect(() => {
    if (!user || !organizationId || !departmentId) {
      setLoading(false);
      return;
    }

    const fetchDepartmentData = async () => {
      try {
        // جلب معلومات القسم من المسار الموحد
        const departmentDoc = await getDoc(doc(db, 'organizations', organizationId, 'departments', departmentId));

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

        // لا حاجة للتحقق من organizationId لأننا نجلب من مسار المؤسسة مباشرة

        setDepartment({
          id: departmentDoc.id,
          ...departmentData,
        });

        // جلب أعضاء القسم
        const membersQuery = query(
          collection(db, 'organizations', organizationId, 'members'),
          where('departmentId', '==', departmentId)
        );

        const membersSnapshot = await getDocs(membersQuery);
        const membersList: Member[] = [];

        membersSnapshot.forEach((doc) => {
          membersList.push({
            uid: doc.id,
            ...doc.data() as Member,
          });
        });

        setMembers(membersList);

        // جلب إحصائيات المهام
        const tasksQuery = query(
          collection(db, 'tasks'),
          where('organizationId', '==', organizationId),
          where('departmentId', '==', departmentId)
        );

        const tasksSnapshot = await getDocs(tasksQuery);
        let totalTasks = 0;
        let completedTasks = 0;
        let pendingTasks = 0;
        let overdueTasks = 0;

        const now = new Date();

        tasksSnapshot.forEach((doc) => {
          const taskData = doc.data();
          totalTasks++;

          if (taskData.status === 'completed') {
            completedTasks++;
          } else if (taskData.status === 'pending') {
            pendingTasks++;

            // التحقق من المهام المتأخرة
            if (taskData.dueDate && taskData.dueDate.toDate() < now) {
              overdueTasks++;
            }
          }
        });

        // جلب عدد الاجتماعات
        const meetingsQuery = query(
          collection(db, 'meetings'),
          where('organizationId', '==', organizationId),
          where('departmentId', '==', departmentId)
        );

        const meetingsSnapshot = await getDocs(meetingsQuery);

        setStats({
          tasks: {
            total: totalTasks,
            completed: completedTasks,
            pending: pendingTasks,
            overdue: overdueTasks
          },
          meetings: meetingsSnapshot.size
        });
      } catch (error) {
        console.error('Error fetching department data:', error);
        toast({
          title: 'خطأ',
          description: 'حدث خطأ أثناء تحميل معلومات القسم',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDepartmentData();
  }, [user, organizationId, departmentId, router, toast]);

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-12 w-full mb-6" />
        <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
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
            <FolderTree className="ml-2 h-6 w-6" />
            <Building2 className="ml-2 h-6 w-6 text-primary" />
            قسم {department.name}
          </h1>
          <p className="text-muted-foreground mt-1">
            {department.description || 'لا يوجد وصف للقسم'}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/org/departments">
            <ArrowLeft className="ml-2 h-4 w-4" />
            العودة إلى الأقسام
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <Users className="ml-2 h-5 w-5 text-blue-500" />
              أعضاء القسم
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{members.length}</div>
            <p className="text-sm text-muted-foreground">عضو في القسم</p>
          </CardContent>
          <CardFooter>
            <Button asChild variant="ghost" className="w-full">
              <Link href="/org/members">عرض الأعضاء</Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <Calendar className="ml-2 h-5 w-5 text-green-500" />
              الاجتماعات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.meetings}</div>
            <p className="text-sm text-muted-foreground">اجتماع للقسم</p>
          </CardContent>
          <CardFooter>
            <Button asChild variant="ghost" className="w-full">
              <Link href={`/org/departments/${departmentId}/meetings`}>
                اجتماعات القسم
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <BarChart3 className="ml-2 h-5 w-5 text-purple-500" />
              مؤشرات الأداء
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats.tasks.total > 0
                ? Math.round((stats.tasks.completed / stats.tasks.total) * 100)
                : 0}%
            </div>
            <p className="text-sm text-muted-foreground">نسبة إنجاز المهام</p>
          </CardContent>
          <CardFooter>
            <Button asChild variant="ghost" className="w-full">
              <Link href="/org/kpi">عرض مؤشرات الأداء</Link>
            </Button>
          </CardFooter>
        </Card>
      </div>

      <Tabs defaultValue="tasks" className="mb-6">
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="tasks">المهام</TabsTrigger>
          <TabsTrigger value="members">الأعضاء</TabsTrigger>
          <TabsTrigger value="meetings">الاجتماعات</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle>مهام القسم</CardTitle>
              <CardDescription>
                إحصائيات ومعلومات عن مهام القسم
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{stats.tasks.total}</div>
                  <p className="text-sm text-muted-foreground">إجمالي المهام</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{stats.tasks.completed}</div>
                  <p className="text-sm text-muted-foreground">مكتملة</p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{stats.tasks.pending}</div>
                  <p className="text-sm text-muted-foreground">قيد التنفيذ</p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-2xl font-bold text-red-600">{stats.tasks.overdue}</div>
                  <p className="text-sm text-muted-foreground">متأخرة</p>
                </div>
              </div>
              <div className="mt-6 text-center">
                <Button asChild>
                  <Link href="/org/tasks">عرض مهام القسم</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle>أعضاء القسم</CardTitle>
              <CardDescription>
                قائمة بأعضاء القسم وأدوارهم
              </CardDescription>
            </CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">لا يوجد أعضاء في هذا القسم</p>
              ) : (
                <div className="space-y-4">
                  {members.map((member) => (
                    <div key={member.uid} className="flex justify-between items-center border-b pb-2">
                      <div>
                        <h3 className="font-medium">{member.displayName || member.email}</h3>
                        <p className="text-sm text-muted-foreground">
                          {member.role === 'owner' ? 'مالك' :
                           member.role === 'admin' ? 'مسؤول' :
                           member.role === 'engineer' ? 'مهندس' :
                           member.role === 'supervisor' ? 'مشرف' :
                           member.role === 'technician' ? 'فني' :
                           member.role === 'assistant' ? 'مساعد فني' : 'مستخدم'}
                        </p>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {member.email}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-6 text-center">
                <Button asChild>
                  <Link href="/org/members">إدارة الأعضاء</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="meetings">
          <Card>
            <CardHeader>
              <CardTitle>اجتماعات القسم</CardTitle>
              <CardDescription>
                إدارة وتنظيم اجتماعات القسم
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="mb-6">
                يمكنك إنشاء وإدارة اجتماعات القسم، وتوليد جداول أعمال الاجتماعات اليومية تلقائيًا.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Button asChild>
                  <Link href={`/org/departments/${departmentId}/meetings`}>
                    <Calendar className="ml-2 h-4 w-4" />
                    اجتماعات القسم
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/org/meetings">
                    جميع الاجتماعات
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
