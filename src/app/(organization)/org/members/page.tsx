'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, UserPlus, UserX, Shield, Edit, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

interface Member {
  uid: string;
  email: string;
  name: string;
  role: string;
  departmentId: string | null;
  joinedAt: Date;
  isActive: boolean;
  lastActivity: Date | null;
  avatar: string | null;
}

export default function MembersPage() {
  const { user, userClaims } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [departments, setDepartments] = useState<{id: string, name: string}[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    role: 'user',
    departmentId: 'none',
  });
  const [formLoading, setFormLoading] = useState(false);

  const organizationId = userClaims?.organizationId;
  const isOwner = userClaims?.owner === true;
  const isAdmin = userClaims?.admin === true;

  // جلب الأعضاء والأقسام
  useEffect(() => {
    if (!user || !organizationId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // جلب الأقسام
    const fetchDepartments = async () => {
      try {
        const departmentsQuery = query(
          collection(db, 'organizations', organizationId, 'departments')
        );
        const snapshot = await getDocs(departmentsQuery);
        const departmentsData = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name
        }));
        setDepartments(departmentsData);
      } catch (error) {
        console.error('Error fetching departments:', error);
        toast({
          title: 'خطأ في جلب الأقسام',
          description: 'حدث خطأ أثناء محاولة جلب الأقسام.',
          variant: 'destructive',
        });
      }
    };

    // جلب الأعضاء
    const membersRef = collection(db, 'organizations', organizationId, 'members');
    const unsubscribe = onSnapshot(
      membersRef,
      async (snapshot) => {
        try {
          const membersPromises = snapshot.docs.map(async (memberDoc) => {
            const memberData = memberDoc.data();
            const memberId = memberDoc.id;

            try {
              // 📊 استراتيجية مختلطة: Firestore + Auth

              // 1️⃣ جلب بيانات المستخدم من Firestore
              const userDocRef = doc(db, 'users', memberId);
              const userDocSnap = await getDoc(userDocRef);

              // 2️⃣ تجميع البيانات من مصادر مختلفة
              const userData = userDocSnap.exists() ? userDocSnap.data() : null;

              return {
                uid: memberId,
                // 📧 الإيميل: من Firestore أولاً، ثم من Auth
                email: userData?.email || memberData.email || 'غير متاح',

                // 👤 الاسم: من Firestore (أكثر تفصيلاً)
                name: userData?.name || userData?.displayName || memberData.displayName || 'مستخدم غير معروف',

                // 🎭 الدور: من عضوية المؤسسة (أولوية)
                role: memberData.role || userData?.role || 'assistant',

                // 🏢 القسم: من عضوية المؤسسة
                departmentId: memberData.departmentId || null,

                // 📅 تاريخ الانضمام: من عضوية المؤسسة
                joinedAt: memberData.joinedAt?.toDate() || new Date(),

                // 📊 بيانات إضافية
                isActive: memberData.isActive !== false, // افتراضياً نشط
                lastActivity: userData?.lastActivity?.toDate() || null,
                avatar: userData?.avatar || null
              };

            } catch (error) {
              console.error(`⚠️ Error fetching user data for ${memberId}:`, error);

              // 🛑 في حالة الخطأ: استخدام بيانات العضوية فقط
              return {
                uid: memberId,
                email: memberData.email || 'غير متاح',
                name: memberData.displayName || 'مستخدم غير معروف',
                role: memberData.role || 'assistant',
                departmentId: memberData.departmentId || null,
                joinedAt: memberData.joinedAt?.toDate() || new Date(),
                isActive: true,
                lastActivity: null,
                avatar: null
              };
            }
          });

          const membersData = await Promise.all(membersPromises);
          setMembers(membersData);
          setLoading(false);
        } catch (error) {
          console.error('Error processing members:', error);
          toast({
            title: 'خطأ في معالجة بيانات الأعضاء',
            description: 'حدث خطأ أثناء محاولة معالجة بيانات الأعضاء.',
            variant: 'destructive',
          });
          setLoading(false);
        }
      },
      (error) => {
        console.error('Error fetching members:', error);
        toast({
          title: 'خطأ في جلب الأعضاء',
          description: 'حدث خطأ أثناء محاولة جلب الأعضاء.',
          variant: 'destructive',
        });
        setLoading(false);
      }
    );

    fetchDepartments();

    return () => unsubscribe();
  }, [user, organizationId, toast]);

  // إضافة عضو جديد
  const handleAddMember = async () => {
    if (!user || !organizationId) return;

    setFormLoading(true);

    try {
      const idToken = await user.getIdToken();

      // استدعاء وظيفة إضافة عضو
      const addMemberToOrganization = httpsCallable(functions, 'addMemberToOrganization');
      await addMemberToOrganization({
        email: formData.email,
        role: formData.role,
        departmentId: formData.departmentId === 'none' ? null : formData.departmentId,
        organizationId
      });

      toast({
        title: 'تمت إضافة العضو بنجاح',
        description: 'تمت إضافة العضو إلى المؤسسة بنجاح.',
      });

      // إعادة تعيين نموذج الإضافة
      setFormData({
        email: '',
        role: 'user',
        departmentId: 'none',
      });
      setIsAddDialogOpen(false);
    } catch (error: any) {
      console.error('Error adding member:', error);
      toast({
        title: 'خطأ في إضافة العضو',
        description: error.message || 'حدث خطأ أثناء محاولة إضافة العضو.',
        variant: 'destructive',
      });
    } finally {
      setFormLoading(false);
    }
  };

  // تعديل عضو
  const handleEditMember = async () => {
    if (!user || !organizationId || !selectedMember) return;

    setFormLoading(true);

    try {
      const idToken = await user.getIdToken();

      // استدعاء وظيفة تعديل عضو
      const updateMemberInOrganization = httpsCallable(functions, 'updateMemberInOrganization');
      await updateMemberInOrganization({
        uid: selectedMember.uid,
        role: formData.role,
        departmentId: formData.departmentId === 'none' ? null : formData.departmentId,
        organizationId
      });

      toast({
        title: 'تم تعديل العضو بنجاح',
        description: 'تم تعديل بيانات العضو بنجاح.',
      });

      setIsEditDialogOpen(false);
    } catch (error: any) {
      console.error('Error updating member:', error);
      toast({
        title: 'خطأ في تعديل العضو',
        description: error.message || 'حدث خطأ أثناء محاولة تعديل العضو.',
        variant: 'destructive',
      });
    } finally {
      setFormLoading(false);
    }
  };

  // حذف عضو
  const handleDeleteMember = async () => {
    if (!user || !organizationId || !selectedMember) return;

    setFormLoading(true);

    try {
      const idToken = await user.getIdToken();

      // استدعاء وظيفة حذف عضو
      const removeMemberFromOrganization = httpsCallable(functions, 'removeMemberFromOrganization');
      await removeMemberFromOrganization({
        uid: selectedMember.uid,
        organizationId
      });

      toast({
        title: 'تم حذف العضو بنجاح',
        description: 'تم حذف العضو من المؤسسة بنجاح.',
      });

      setIsDeleteDialogOpen(false);
    } catch (error: any) {
      console.error('Error deleting member:', error);
      toast({
        title: 'خطأ في حذف العضو',
        description: error.message || 'حدث خطأ أثناء محاولة حذف العضو.',
        variant: 'destructive',
      });
    } finally {
      setFormLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4">
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
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center">
          <Users className="ml-2 h-6 w-6" />
          أعضاء المؤسسة
        </h1>
        {(isOwner || isAdmin) && (
          <Button onClick={() => setIsAddDialogOpen(true)} className="flex items-center">
            <UserPlus className="ml-2 h-4 w-4" />
            إضافة عضو
          </Button>
        )}
      </div>

      {members.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          لا يوجد أعضاء في المؤسسة
        </div>
      ) : (
        <div className="space-y-4">
          {members.map((member) => (
            <Card key={member.uid}>
              <CardContent className="p-4 flex justify-between items-center">
                <div>
                  <h3 className="font-medium">{member.email}</h3>
                  <p className="text-sm text-muted-foreground">
                    {member.role === 'owner' ? 'مالك' :
                     member.role === 'admin' ? 'مسؤول' :
                     member.role === 'engineer' ? 'مهندس' :
                     member.role === 'supervisor' ? 'مشرف' :
                     member.role === 'technician' ? 'فني' :
                     member.role === 'assistant' ? 'مساعد فني' : 'مستخدم'}
                    {member.departmentId && departments.find(d => d.id === member.departmentId) &&
                      ` - ${departments.find(d => d.id === member.departmentId)?.name}`}
                  </p>
                </div>
                {(isOwner || isAdmin) && (
                  <div className="flex space-x-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedMember(member);
                        setFormData({
                          email: member.email,
                          role: member.role,
                          departmentId: member.departmentId || 'none',
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
                        setSelectedMember(member);
                        setIsDeleteDialogOpen(true);
                      }}
                      disabled={member.role === 'owner' && !isOwner}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* مربع حوار إضافة عضو */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إضافة عضو جديد</DialogTitle>
            <DialogDescription>
              أدخل بريد العضو الإلكتروني ودوره في المؤسسة.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="example@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">الدور</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر الدور" />
                </SelectTrigger>
                <SelectContent>
                  {isOwner && <SelectItem value="owner">مالك</SelectItem>}
                  <SelectItem value="admin">مسؤول</SelectItem>
                  <SelectItem value="engineer">مهندس</SelectItem>
                  <SelectItem value="supervisor">مشرف</SelectItem>
                  <SelectItem value="technician">فني</SelectItem>
                  <SelectItem value="assistant">مساعد فني</SelectItem>
                  <SelectItem value="user">مستخدم</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">القسم</Label>
              <Select
                value={formData.departmentId}
                onValueChange={(value) => setFormData({ ...formData, departmentId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر القسم" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون قسم</SelectItem>
                  {departments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleAddMember} disabled={formLoading}>
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

      {/* مربع حوار تعديل عضو */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعديل بيانات العضو</DialogTitle>
            <DialogDescription>
              تعديل دور العضو وقسمه في المؤسسة.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                value={formData.email}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">الدور</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
                disabled={selectedMember?.role === 'owner' && !isOwner}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر الدور" />
                </SelectTrigger>
                <SelectContent>
                  {isOwner && <SelectItem value="owner">مالك</SelectItem>}
                  <SelectItem value="admin">مسؤول</SelectItem>
                  <SelectItem value="engineer">مهندس</SelectItem>
                  <SelectItem value="supervisor">مشرف</SelectItem>
                  <SelectItem value="technician">فني</SelectItem>
                  <SelectItem value="assistant">مساعد فني</SelectItem>
                  <SelectItem value="user">مستخدم</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">القسم</Label>
              <Select
                value={formData.departmentId}
                onValueChange={(value) => setFormData({ ...formData, departmentId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر القسم" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون قسم</SelectItem>
                  {departments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleEditMember} disabled={formLoading}>
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
            <AlertDialogTitle>هل أنت متأكد من حذف هذا العضو؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم إزالة العضو من المؤسسة. هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMember} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
