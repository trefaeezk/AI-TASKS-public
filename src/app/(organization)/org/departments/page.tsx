'use client';

// منع التوليد المسبق للصفحة
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { FolderTree, Plus, Users, Calendar, BarChart3 } from 'lucide-react';
import { db } from '@/config/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Translate } from '@/components/Translate';
import Link from 'next/link';

interface Department {
  id: string;
  name: string;
  description?: string;
  membersCount: number;
  tasksCount: number;
  meetingsCount: number;
}

export default function DepartmentsPage() {
  const { user, userClaims } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newDepartmentName, setNewDepartmentName] = useState('');
  const [newDepartmentDescription, setNewDepartmentDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const organizationId = userClaims?.organizationId;
  // استخدام أسماء الحقول الصحيحة من قاعدة البيانات
  const isSystemOwner = userClaims?.system_owner === true;
  const isSystemAdmin = userClaims?.system_admin === true;
  const isOwner = userClaims?.organization_owner === true || userClaims?.isOwner === true;
  const isAdmin = userClaims?.admin === true || userClaims?.isAdmin === true;
  // مالك النظام يملك صلاحيات كاملة على جميع المؤسسات
  const canCreateDepartment = isSystemOwner || isSystemAdmin || isOwner || isAdmin;

  // تحميل الأقسام
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    // مالك النظام يمكنه الوصول بدون organizationId
    if (!organizationId && !isSystemOwner && !isSystemAdmin) {
      setLoading(false);
      return;
    }

    const fetchDepartments = async () => {
      try {
        // 🏢 جلب الأقسام من المسار الموحد
        const departmentsQuery = query(
          collection(db, 'organizations', organizationId, 'departments')
        );

        const departmentsSnapshot = await getDocs(departmentsQuery);
        const departmentsPromises = departmentsSnapshot.docs.map(async (doc) => {
          const departmentData = doc.data();

          // جلب عدد الأعضاء في القسم
          const membersQuery = query(
            collection(db, 'organizations', organizationId, 'members'),
            where('departmentId', '==', doc.id)
          );
          const membersSnapshot = await getDocs(membersQuery);

          // جلب عدد المهام في القسم
          const tasksQuery = query(
            collection(db, 'tasks'),
            where('organizationId', '==', organizationId),
            where('departmentId', '==', doc.id)
          );
          const tasksSnapshot = await getDocs(tasksQuery);

          // جلب عدد الاجتماعات في القسم
          const meetingsQuery = query(
            collection(db, 'meetings'),
            where('organizationId', '==', organizationId),
            where('departmentId', '==', doc.id)
          );
          const meetingsSnapshot = await getDocs(meetingsQuery);

          return {
            id: doc.id,
            name: departmentData.name || '',
            description: departmentData.description || '',
            membersCount: membersSnapshot.size,
            tasksCount: tasksSnapshot.size,
            meetingsCount: meetingsSnapshot.size
          };
        });

        const departmentsList = await Promise.all(departmentsPromises);
        setDepartments(departmentsList);
      } catch (error) {
        console.error('Error fetching departments:', error);
        toast({
          title: 'خطأ',
          description: 'حدث خطأ أثناء تحميل الأقسام',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDepartments();
  }, [user, organizationId, toast]);

  // إنشاء قسم جديد
  const handleCreateDepartment = async () => {
    if (!user || !organizationId) {
      toast({
        title: 'خطأ',
        description: 'يجب تسجيل الدخول وتحديد المؤسسة',
        variant: 'destructive',
      });
      return;
    }

    if (!newDepartmentName.trim()) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال اسم القسم',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsSubmitting(true);

      // إنشاء القسم الجديد
      const departmentData = {
        name: newDepartmentName.trim(),
        description: newDepartmentDescription.trim() || null,
        organizationId,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // 🏢 إنشاء القسم في المسار الموحد
      await addDoc(collection(db, 'organizations', organizationId, 'departments'), departmentData);

      toast({
        title: 'تم إنشاء القسم',
        description: `تم إنشاء قسم "${newDepartmentName}" بنجاح`,
      });

      // إعادة تعيين النموذج
      setNewDepartmentName('');
      setNewDepartmentDescription('');
      setIsCreateDialogOpen(false);
    } catch (error) {
      console.error('Error creating department:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء إنشاء القسم',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // عرض رسالة إذا لم يكن هناك organizationId
  if (!user || !organizationId) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">
            <Translate text="organization.noOrganizationAccess" />
          </h2>
          <p className="text-muted-foreground mb-4">
            <Translate text="organization.noOrganizationAccessDescription" />
          </p>
          <Button asChild>
            <Link href="/org">
              <Translate text="organization.goToOrganization" />
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center">
          <FolderTree className="ml-2 h-6 w-6" />
          <Translate text="organization.departments" />
        </h1>
        {canCreateDepartment && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center">
                <Plus className="ml-2 h-4 w-4" />
                <Translate text="organization.createNewDepartment" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  <Translate text="organization.createNewDepartment" />
                </DialogTitle>
                <DialogDescription>
                  <Translate text="organization.departmentFormDescription" />
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    <Translate text="organization.departmentName" />
                  </Label>
                  <Input
                    id="name"
                    value={newDepartmentName}
                    onChange={(e) => setNewDepartmentName(e.target.value)}
                    placeholder="أدخل اسم القسم"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">
                    <Translate text="organization.departmentDescription" /> (<Translate text="general.optional" />)
                  </Label>
                  <Textarea
                    id="description"
                    value={newDepartmentDescription}
                    onChange={(e) => setNewDepartmentDescription(e.target.value)}
                    placeholder="أدخل وصف القسم"
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="submit"
                  onClick={handleCreateDepartment}
                  disabled={isSubmitting || !newDepartmentName.trim()}
                >
                  {isSubmitting ? (
                    <Translate text="general.creating" />
                  ) : (
                    <Translate text="organization.createDepartment" />
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {departments.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-muted-foreground">
              <Translate text="organization.noDepartments" />
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {departments.map((department) => (
            <Card key={department.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <CardTitle className="text-lg">{department.name}</CardTitle>
                <CardDescription>
                  {department.description || (
                    <Translate text="organization.noDepartmentDescription" />
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="flex justify-center">
                      <Users className="h-5 w-5 text-blue-500" />
                    </div>
                    <div className="text-lg font-semibold">{department.membersCount}</div>
                    <div className="text-xs text-muted-foreground">
                      <Translate text="organization.member" />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-center">
                      <Calendar className="h-5 w-5 text-green-500" />
                    </div>
                    <div className="text-lg font-semibold">{department.meetingsCount}</div>
                    <div className="text-xs text-muted-foreground">
                      <Translate text="meetings.meeting" />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-center">
                      <BarChart3 className="h-5 w-5 text-purple-500" />
                    </div>
                    <div className="text-lg font-semibold">{department.tasksCount}</div>
                    <div className="text-xs text-muted-foreground">
                      <Translate text="tasks.task" />
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/org/departments/${department.id}`}>
                    <Translate text="organization.departmentDetails" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
