
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
}

interface OrganizationMembersProps {
  organizationId: string;
  isOwner: boolean;
  isAdmin: boolean;
}

export function OrganizationMembers({ organizationId, isOwner, isAdmin }: OrganizationMembersProps) {
  const { user } = useAuth();
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
    role: 'isOrgAssistant',
    departmentId: 'none',
  });
  const [formLoading, setFormLoading] = useState(false);

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
        // Corrected path to fetch departments for the specific organization
        const departmentsQuery = query(
          collection(db, 'organizations', organizationId, 'departments')
        );
        const snapshot = await getDocs(departmentsQuery);
        const departmentsData = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || 'قسم غير مسمى' // Provide a fallback name
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
            let userName = memberData.name || memberData.displayName || 'مستخدم غير معروف';
            let userEmail = memberData.email || 'غير متاح';

            try {
              // Attempt to fetch user details from the top-level 'users' collection
              const userDocRef = doc(db, 'users', memberDoc.id);
              const userDocSnap = await getDoc(userDocRef);
              if (userDocSnap.exists()) {
                const specificUserData = userDocSnap.data();
                userName = (specificUserData as any).name || (specificUserData as any).displayName || userName;
                userEmail = (specificUserData as any).email || userEmail;
              } else {
                // Fallback if not in 'users', try Firebase Auth (less reliable for display name)
                const idToken = await user.getIdToken();
                const response = await fetch(`https://europe-west1-tasks-intelligence.cloudfunctions.net/getUserHttp?uid=${memberDoc.id}`, {
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${idToken}`
                  }
                });
                if (response.ok) {
                  const authUserData = await response.json();
                  userName = authUserData.displayName || userName;
                  userEmail = authUserData.email || userEmail;
                }
              }
            } catch (fetchError) {
              console.error(`Error fetching details for user ${memberDoc.id}:`, fetchError);
            }

            return {
              uid: memberDoc.id,
              email: userEmail,
              name: userName,
              role: memberData.role || 'isOrgAssistant',
              departmentId: memberData.departmentId || undefined,
              joinedAt: memberData.joinedAt?.toDate() || new Date()
            };
          });

          const membersData = await Promise.all(membersPromises);
          setMembers(membersData);
        } catch (error) {
          console.error('Error processing members:', error);
          toast({
            title: 'خطأ في معالجة بيانات الأعضاء',
            description: 'حدث خطأ أثناء محاولة معالجة بيانات الأعضاء.',
            variant: 'destructive',
          });
        } finally {
          setLoading(false); // Moved setLoading to finally
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
      // استدعاء وظيفة إضافة عضو
      const inviteUserToOrganization = httpsCallable(functions, 'inviteUserToOrganization');
      await inviteUserToOrganization({
        email: formData.email,
        role: formData.role,
        departmentId: formData.departmentId === 'none' ? null : formData.departmentId,
        organizationId // Ensure organizationId is passed
      });

      toast({
        title: 'تم إرسال الدعوة بنجاح',
        description: `تم إرسال دعوة إلى ${formData.email} للانضمام إلى المؤسسة.`,
      });

      // إعادة تعيين نموذج الإضافة
      setFormData({
        email: '',
        role: 'isOrgAssistant',
        departmentId: 'none',
      });
      setIsAddDialogOpen(false);
    } catch (error: any) {
      console.error('Error inviting member:', error);
      toast({
        title: 'خطأ في إرسال الدعوة',
        description: error.message || 'حدث خطأ أثناء محاولة إرسال الدعوة.',
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
      // استدعاء وظيفة تعديل عضو
      // Assuming you have a cloud function named 'updateOrganizationMemberRoleAndDepartment'
      const updateOrganizationMember = httpsCallable(functions, 'updateOrganizationMember');
      await updateOrganizationMember({
        uid: selectedMember.uid,
        role: formData.role,
        departmentId: formData.departmentId === 'none' ? null : formData.departmentId,
        organizationId // Ensure organizationId is passed
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
      // استدعاء وظيفة حذف عضو
      const removeMemberFromOrganization = httpsCallable(functions, 'removeMemberFromOrganization');
      await removeMemberFromOrganization({
        uid: selectedMember.uid,
        organizationId // Ensure organizationId is passed
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
                  <h3 className="font-medium">{member.name} ({member.email})</h3>
                  <p className="text-sm text-muted-foreground">
                    {member.role === 'org_owner'  ? 'مالك' :
                     member.role === 'org_admin' ? 'مسؤول' :
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
                      disabled={(member.role === 'isOrgOwner'  || member.uid === user?.uid) && !isOwner} // Owner can't remove self unless they are the only owner
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
              أدخل بريد العضو الإلكتروني ودوره في المؤسسة. سيتم إرسال دعوة للعضو للانضمام.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
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
                  {isOwner && <SelectItem value="isOrgOwner">مالك المؤسسة</SelectItem>}
                  <SelectItem value="isOrgAdmin">أدمن المؤسسة</SelectItem>
                  <SelectItem value="isOrgEngineer">مهندس</SelectItem>
                  <SelectItem value="isOrgSupervisor">مشرف</SelectItem>
                  <SelectItem value="isOrgTechnician">فني</SelectItem>
                  <SelectItem value="isOrgAssistant">مساعد فني</SelectItem>
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
                  <SelectValue placeholder="اختر القسم (اختياري)" />
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
            <Button onClick={handleAddMember} disabled={formLoading || !formData.email}>
              {formLoading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري إرسال الدعوة...
                </>
              ) : (
                'إرسال دعوة'
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
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-email">البريد الإلكتروني</Label>
              <Input
                id="edit-email"
                value={formData.email}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">الدور</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
                disabled={(selectedMember?.role === 'isOrgOwner'  && !isOwner) || selectedMember?.uid === user?.uid}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر الدور" />
                </SelectTrigger>
                <SelectContent>
                  {isOwner && <SelectItem value="isOrgOwner">مالك</SelectItem>}
                  <SelectItem value="isOrgAdmin">مسؤول</SelectItem>
                  <SelectItem value="isOrgEngineer">مهندس</SelectItem>
                  <SelectItem value="isOrgSupervisor">مشرف</SelectItem>
                  <SelectItem value="isOrgTechnician">فني</SelectItem>
                  <SelectItem value="isOrgAssistant">مساعد فني</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-department">القسم</Label>
              <Select
                value={formData.departmentId}
                onValueChange={(value) => setFormData({ ...formData, departmentId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر القسم (اختياري)" />
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
            <AlertDialogAction onClick={handleDeleteMember} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={formLoading}>
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
