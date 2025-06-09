'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { FolderTree, PlusCircle, Edit, Trash2, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

interface Department {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  membersCount: number;
}

interface OrganizationDepartmentsProps {
  organizationId: string;
  isOwner: boolean;
  isAdmin: boolean;
}

export function OrganizationDepartments({ organizationId, isOwner, isAdmin }: OrganizationDepartmentsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [formLoading, setFormLoading] = useState(false);

  // جلب الأقسام
  useEffect(() => {
    if (!user || !organizationId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // جلب الأقسام
    const departmentsRef = collection(db, 'organizations', organizationId, 'departments');
    const unsubscribe = onSnapshot(
      departmentsRef,
      async (snapshot) => {
        try {
          const departmentsPromises = snapshot.docs.map(async (doc) => {
            const departmentData = doc.data();
            
            // جلب عدد الأعضاء في القسم
            const membersQuery = query(
              collection(db, 'organizations', organizationId, 'members'),
              where('departmentId', '==', doc.id)
            );
            const membersSnapshot = await getDocs(membersQuery);
            
            return {
              id: doc.id,
              name: departmentData.name || '',
              description: departmentData.description || '',
              createdAt: departmentData.createdAt?.toDate() || new Date(),
              membersCount: membersSnapshot.size
            };
          });
          
          const departmentsData = await Promise.all(departmentsPromises);
          setDepartments(departmentsData);
          setLoading(false);
        } catch (error) {
          console.error('Error processing departments:', error);
          toast({
            title: 'خطأ في معالجة بيانات الأقسام',
            description: 'حدث خطأ أثناء محاولة معالجة بيانات الأقسام.',
            variant: 'destructive',
          });
          setLoading(false);
        }
      },
      (error) => {
        console.error('Error fetching departments:', error);
        toast({
          title: 'خطأ في جلب الأقسام',
          description: 'حدث خطأ أثناء محاولة جلب الأقسام.',
          variant: 'destructive',
        });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, organizationId, toast]);

  // إضافة قسم جديد
  const handleAddDepartment = async () => {
    if (!user || !organizationId) return;

    setFormLoading(true);

    try {
      // إضافة القسم إلى Firestore
      await addDoc(collection(db, 'organizations', organizationId, 'departments'), {
        name: formData.name,
        description: formData.description,
        createdAt: new Date(),
        createdBy: user.uid
      });

      toast({
        title: 'تمت إضافة القسم بنجاح',
        description: 'تمت إضافة القسم إلى المؤسسة بنجاح.',
      });

      // إعادة تعيين نموذج الإضافة
      setFormData({
        name: '',
        description: '',
      });
      setIsAddDialogOpen(false);
    } catch (error: any) {
      console.error('Error adding department:', error);
      toast({
        title: 'خطأ في إضافة القسم',
        description: error.message || 'حدث خطأ أثناء محاولة إضافة القسم.',
        variant: 'destructive',
      });
    } finally {
      setFormLoading(false);
    }
  };

  // تعديل قسم
  const handleEditDepartment = async () => {
    if (!user || !organizationId || !selectedDepartment) return;

    setFormLoading(true);

    try {
      // تحديث القسم في Firestore
      await updateDoc(doc(db, 'organizations', organizationId, 'departments', selectedDepartment.id), {
        name: formData.name,
        description: formData.description,
        updatedAt: new Date(),
        updatedBy: user.uid
      });

      toast({
        title: 'تم تعديل القسم بنجاح',
        description: 'تم تعديل بيانات القسم بنجاح.',
      });

      setIsEditDialogOpen(false);
    } catch (error: any) {
      console.error('Error updating department:', error);
      toast({
        title: 'خطأ في تعديل القسم',
        description: error.message || 'حدث خطأ أثناء محاولة تعديل القسم.',
        variant: 'destructive',
      });
    } finally {
      setFormLoading(false);
    }
  };

  // حذف قسم
  const handleDeleteDepartment = async () => {
    if (!user || !organizationId || !selectedDepartment) return;

    setFormLoading(true);

    try {
      // التحقق من عدم وجود أعضاء في القسم
      const membersQuery = query(
        collection(db, 'organizations', organizationId, 'members'),
        where('departmentId', '==', selectedDepartment.id)
      );
      const membersSnapshot = await getDocs(membersQuery);
      
      if (membersSnapshot.size > 0) {
        throw new Error('لا يمكن حذف القسم لأنه يحتوي على أعضاء. قم بنقل الأعضاء إلى قسم آخر أولاً.');
      }
      
      // حذف القسم من Firestore
      await deleteDoc(doc(db, 'organizations', organizationId, 'departments', selectedDepartment.id));

      toast({
        title: 'تم حذف القسم بنجاح',
        description: 'تم حذف القسم من المؤسسة بنجاح.',
      });

      setIsDeleteDialogOpen(false);
    } catch (error: any) {
      console.error('Error deleting department:', error);
      toast({
        title: 'خطأ في حذف القسم',
        description: error.message || 'حدث خطأ أثناء محاولة حذف القسم.',
        variant: 'destructive',
      });
    } finally {
      setFormLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold flex items-center">
          <FolderTree className="ml-2 h-5 w-5" />
          أقسام المؤسسة
        </h2>
        {(isOwner || isAdmin) && (
          <Button onClick={() => setIsAddDialogOpen(true)} className="flex items-center">
            <PlusCircle className="ml-2 h-4 w-4" />
            إضافة قسم
          </Button>
        )}
      </div>

      {departments.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          لا توجد أقسام في المؤسسة
        </div>
      ) : (
        <div className="space-y-4">
          {departments.map((department) => (
            <Card key={department.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-medium">{department.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {department.description || 'لا يوجد وصف'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      عدد الأعضاء: {department.membersCount}
                    </p>
                  </div>
                  {(isOwner || isAdmin) && (
                    <div className="flex space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedDepartment(department);
                          setFormData({
                            name: department.name,
                            description: department.description,
                          });
                          setIsEditDialogOpen(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setSelectedDepartment(department);
                          setIsDeleteDialogOpen(true);
                        }}
                        disabled={department.membersCount > 0}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* مربع حوار إضافة قسم */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة قسم جديد</DialogTitle>
            <DialogDescription>
              أدخل اسم ووصف القسم الجديد.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">اسم القسم</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="اسم القسم"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">وصف القسم</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="وصف القسم"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleAddDepartment} disabled={formLoading || !formData.name}>
              {formLoading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري الإضافة...
                </>
              ) : (
                'إضافة'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* مربع حوار تعديل قسم */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل بيانات القسم</DialogTitle>
            <DialogDescription>
              تعديل اسم ووصف القسم.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">اسم القسم</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="اسم القسم"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">وصف القسم</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="وصف القسم"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleEditDepartment} disabled={formLoading || !formData.name}>
              {formLoading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري التعديل...
                </>
              ) : (
                'حفظ التغييرات'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* مربع حوار تأكيد الحذف */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد من حذف هذا القسم؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف القسم من المؤسسة. هذا الإجراء لا يمكن التراجع عنه.
              {(selectedDepartment?.membersCount ?? 0) > 0 && (
                <div className="mt-2 text-destructive">
                  لا يمكن حذف القسم لأنه يحتوي على أعضاء. قم بنقل الأعضاء إلى قسم آخر أولاً.
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteDepartment} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={(selectedDepartment?.membersCount ?? 0) > 0 || formLoading}
            >
              {formLoading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري الحذف...
                </>
              ) : (
                'حذف'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
