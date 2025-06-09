
'use client';

import React, { useState, useEffect, useCallback } from 'react'; // Added useCallback
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useParams, useRouter } from 'next/navigation';
import { FolderTree, Users, Calendar, BarChart3, ArrowLeft, Building2, PlusCircle } from 'lucide-react'; // Added PlusCircle
import { db } from '@/config/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { AssignMemberToDepartmentDialog } from '@/components/organization/AssignMemberToDepartmentDialog'; // Import the new dialog

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
  name: string; // Required to match AssignMemberToDepartmentDialog
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
  const [isAssignMemberDialogOpen, setIsAssignMemberDialogOpen] = useState(false); // State for new dialog

  const organizationId = userClaims?.organizationId;
  const userDepartmentId = userClaims?.departmentId;
  const isOwner = userClaims?.isOrgOwner === true || userClaims?.isOwner === true;
  const isAdmin = userClaims?.isOrgAdmin === true || userClaims?.isAdmin === true;
  const isOrgSupervisor = userClaims?.isOrgSupervisor === true;
  const isOrgEngineer = userClaims?.isOrgEngineer === true;
  const isOrgTechnician = userClaims?.isOrgTechnician === true;
  const isOrgAssistant = userClaims?.isOrgAssistant === true;

  // مالك ومدير المؤسسة بدون قسم محدد (وصول كامل)
  const hasFullAccess = (isOwner || isAdmin) && !userDepartmentId;

  // التحقق من صلاحية الوصول لهذا القسم
  const canAccessThisDepartment = hasFullAccess || // مالك/مدير بدون قسم
    (isOwner || isAdmin) || // مالك/مدير المؤسسة (حتى لو كان لديه قسم)
    (userDepartmentId && userDepartmentId === departmentId &&
     (isOrgSupervisor || isOrgEngineer || isOrgTechnician || isOrgAssistant)); // أعضاء القسم

  const canManageMembers = isOwner || isAdmin; // Permission to manage members

  // Renamed and memoized for stability
  const refreshDepartmentData = useCallback(async () => {
    if (!user || !organizationId || !departmentId) {
      setLoading(false);
      return;
    }
    setLoading(true); // Set loading true when fetching data
    try {
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
      setDepartment({ ...departmentData, id: departmentDoc.id });

      const membersQuery = query(
        collection(db, 'organizations', organizationId, 'members'),
        where('departmentId', '==', departmentId)
      );
      const membersSnapshot = await getDocs(membersQuery);
      const membersList: Member[] = [];
      for (const memberDoc of membersSnapshot.docs) {
        const memberData = memberDoc.data();
        const userDetailsDoc = await getDoc(doc(db, 'users', memberDoc.id));
        const userName = userDetailsDoc.exists() ? userDetailsDoc.data().name || userDetailsDoc.data().displayName || 'مستخدم غير معروف' : 'مستخدم غير معروف';
        membersList.push({
          uid: memberDoc.id,
          email: memberData.email || 'N/A',
          name: userName,
          displayName: userName,
          role: memberData.role || 'N/A',
          departmentId: memberData.departmentId,
        });
      }
      setMembers(membersList);

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
        if (taskData.status === 'completed') completedTasks++;
        else if (taskData.status === 'pending') pendingTasks++;
        if (taskData.status !== 'completed' && taskData.dueDate && taskData.dueDate.toDate() < now) overdueTasks++;
      });

      const meetingsQuery = query(
        collection(db, 'meetings'),
        where('organizationId', '==', organizationId),
        where('departmentId', '==', departmentId)
      );
      const meetingsSnapshot = await getDocs(meetingsQuery);

      setStats({
        tasks: { total: totalTasks, completed: completedTasks, pending: pendingTasks, overdue: overdueTasks },
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
  }, [user, organizationId, departmentId, router, toast]);

  useEffect(() => {
    refreshDepartmentData();
  }, [refreshDepartmentData]); // Run the memoized function

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

  // فحص صلاحية الوصول
  if (!canAccessThisDepartment) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-destructive">ليس لديك صلاحية الوصول إلى هذا القسم.</p>
            <p className="text-muted-foreground mt-2">يمكنك الوصول إلى قسمك فقط.</p>
            <div className="flex justify-center gap-2 mt-4">
              {userDepartmentId && (
                <Button asChild>
                  <Link href={`/org/departments/${userDepartmentId}`}>
                    الذهاب إلى قسمي
                  </Link>
                </Button>
              )}
              <Button asChild variant="outline">
                <Link href="/org/tasks">المهام</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!department) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-destructive">القسم غير موجود.</p>
            <Button asChild className="mt-4">
              <Link href="/org/departments">العودة إلى الأقسام</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 md:px-6 py-4">
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
              <Link href={`/org/members?department=${departmentId}`}>عرض الأعضاء</Link>
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
              <Link href={`/org/kpi?department=${departmentId}`}>عرض مؤشرات الأداء</Link>
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
                  <Link href={`/org/tasks?department=${departmentId}`}>عرض مهام القسم</Link>
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
                        <h3 className="font-medium">{member.displayName || member.name || member.email}</h3>
                        <p className="text-sm text-muted-foreground">
                          {member.role}
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
                {canManageMembers && (
                  <Button onClick={() => setIsAssignMemberDialogOpen(true)} variant="outline">
                    <PlusCircle className="ml-2 h-4 w-4" />
                    تعيين عضو إلى هذا القسم
                  </Button>
                )}
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

          {organizationId && (
            <AssignMemberToDepartmentDialog
              isOpen={isAssignMemberDialogOpen}
              onOpenChange={setIsAssignMemberDialogOpen}
              organizationId={organizationId}
              departmentId={departmentId}
              currentDepartmentMembers={members}
              onMemberAssigned={() => refreshDepartmentData()} // Refresh members list after assignment
            />
          )}
        </div>
      </div>
    </div>
  );
}

    