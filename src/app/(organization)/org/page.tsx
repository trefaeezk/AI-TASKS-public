'use client';

// منع التوليد المسبق للصفحة
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Building, Users, FolderTree, ListTodo, BarChart3, Settings } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

export default function OrganizationDashboard() {
  const { user, userClaims } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    members: 0,
    departments: 0,
    tasks: {
      total: 0,
      completed: 0,
      overdue: 0
    }
  });
  const [recentTasks, setRecentTasks] = useState<any[]>([]);

  const organizationId = userClaims?.organizationId;
  const organizationName = userClaims?.organizationName || 'المؤسسة';
  const isOwner = userClaims?.owner === true;
  const isAdmin = userClaims?.admin === true;

  useEffect(() => {
    const fetchOrganizationData = async () => {
      if (!user || !organizationId) {
        setLoading(false);
        return;
      }

      try {
        // جلب عدد الأعضاء
        const membersQuery = query(
          collection(db, 'organizations', organizationId, 'members')
        );
        const membersSnapshot = await getDocs(membersQuery);

        // جلب عدد الأقسام
        const departmentsQuery = query(
          collection(db, 'organizations', organizationId, 'departments')
        );
        const departmentsSnapshot = await getDocs(departmentsQuery);

        // جلب إحصائيات المهام
        const tasksQuery = query(
          collection(db, 'tasks'),
          where('organizationId', '==', organizationId)
        );
        const tasksSnapshot = await getDocs(tasksQuery);

        const completedTasks = tasksSnapshot.docs.filter(doc => doc.data().status === 'completed').length;
        const overdueTasks = tasksSnapshot.docs.filter(doc => {
          const data = doc.data();
          return data.status !== 'completed' && data.dueDate && data.dueDate.toDate() < new Date();
        }).length;

        // جلب أحدث المهام
        const recentTasksQuery = query(
          collection(db, 'tasks'),
          where('organizationId', '==', organizationId),
          orderBy('createdAt', 'desc'),
          limit(5)
        );
        const recentTasksSnapshot = await getDocs(recentTasksQuery);
        const recentTasksData = recentTasksSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate(),
          dueDate: doc.data().dueDate?.toDate()
        }));

        setStats({
          members: membersSnapshot.size,
          departments: departmentsSnapshot.size,
          tasks: {
            total: tasksSnapshot.size,
            completed: completedTasks,
            overdue: overdueTasks
          }
        });

        setRecentTasks(recentTasksData);
      } catch (error) {
        console.error('Error fetching organization data:', error);
        toast({
          title: 'خطأ في جلب بيانات المؤسسة',
          description: 'حدث خطأ أثناء محاولة جلب بيانات المؤسسة.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchOrganizationData();
  }, [user, organizationId, toast]);

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <Skeleton className="h-12 w-3/4 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold flex items-center">
          <Building className="ml-2 h-6 w-6" />
          لوحة تحكم {organizationName}
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <Users className="ml-2 h-5 w-5 text-blue-500" />
              الأعضاء
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.members}</div>
            <p className="text-sm text-muted-foreground">عضو في المؤسسة</p>
            <Button asChild variant="ghost" className="mt-2 w-full">
              <Link href="/org/members">عرض الأعضاء</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <FolderTree className="ml-2 h-5 w-5 text-green-500" />
              الأقسام
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.departments}</div>
            <p className="text-sm text-muted-foreground">قسم في المؤسسة</p>
            <Button asChild variant="ghost" className="mt-2 w-full">
              <Link href="/org/departments">عرض الأقسام</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center">
              <ListTodo className="ml-2 h-5 w-5 text-purple-500" />
              المهام
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.tasks.total}</div>
            <div className="flex justify-between text-sm">
              <span className="text-green-500">{stats.tasks.completed} مكتملة</span>
              <span className="text-red-500">{stats.tasks.overdue} متأخرة</span>
            </div>
            <Button asChild variant="ghost" className="mt-2 w-full">
              <Link href="/org/tasks">عرض المهام</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center">
              <ListTodo className="ml-2 h-5 w-5" />
              أحدث المهام
            </CardTitle>
            <CardDescription>آخر 5 مهام تم إنشاؤها في المؤسسة</CardDescription>
          </CardHeader>
          <CardContent>
            {recentTasks.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">لا توجد مهام حالياً</p>
            ) : (
              <div className="space-y-4">
                {recentTasks.map((task) => (
                  <div key={task.id} className="flex justify-between items-center border-b pb-2">
                    <div>
                      <h3 className="font-medium">{task.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {task.dueDate ? `تاريخ الاستحقاق: ${task.dueDate.toLocaleDateString()}` : 'بدون تاريخ استحقاق'}
                      </p>
                    </div>
                    <div className={`px-2 py-1 rounded text-xs ${
                      task.status === 'completed' ? 'bg-green-100 text-green-800' :
                      task.status === 'overdue' ? 'bg-red-100 text-red-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {task.status === 'completed' ? 'مكتملة' :
                       task.status === 'overdue' ? 'متأخرة' :
                       task.status === 'in_progress' ? 'قيد التنفيذ' :
                       task.status === 'pending' ? 'معلقة' :
                       task.status === 'hold' ? 'متوقفة' : 'جديدة'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
