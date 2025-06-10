'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Users, UserPlus, UserX, Shield, Edit, Trash2, AlertTriangle, Loader2, User, Building, Search, Filter, ShieldAlert, ShieldCheck, ShieldQuestion, UserCog, Calendar, Activity, Crown, Settings } from 'lucide-react';
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
import { Translate } from '@/components/Translate';
import { DeleteUserDialog } from '@/components/admin/DeleteUserDialog';
import { MembersStats, MembersFilters, MembersList } from '@/components/organization';
import { IndividualMembersManager } from '@/components/organization/IndividualMembersManager';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, addDoc, updateDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { UserRole, ROLE_HIERARCHY } from '@/types/roles';



interface Member {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
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
  const [isDeleteUserDialogOpen, setIsDeleteUserDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    role: 'isOrgAssistant' as UserRole,
    departmentId: 'none',
  });
  const [formLoading, setFormLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole | 'all'>('all');
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');

  const organizationId = userClaims?.organizationId;
  const userDepartmentId = userClaims?.departmentId;

  // النمط الموحد is* فقط (بدون توافق مع القديم)
  const isOwner = userClaims?.isOrgOwner === true;
  const isAdmin = userClaims?.isOrgAdmin === true;
  const isOrgSupervisor = userClaims?.isOrgSupervisor === true;
  const isOrgEngineer = userClaims?.isOrgEngineer === true;
  const isOrgTechnician = userClaims?.isOrgTechnician === true;
  const isOrgAssistant = userClaims?.isOrgAssistant === true;

  // مالك ومدير المؤسسة بدون قسم محدد (وصول كامل)
  const hasFullAccess = (isOwner || isAdmin) && !userDepartmentId;

  // تحديد نوع المستخدم
  const canViewAllMembers = isOwner || isAdmin || hasFullAccess; // الإدارة العليا ترى جميع الأعضاء
  const isDepartmentMember = userDepartmentId && (isOrgSupervisor || isOrgEngineer || isOrgTechnician || isOrgAssistant || isOwner || isAdmin) && !hasFullAccess;

  // 📊 تصفية الأعضاء حسب الصلاحيات والتبويب والبحث
  const filteredMembers = members.filter(member => {
    // أولاً: تطبيق فلتر الصلاحيات
    if (hasFullAccess) {
      // مالك/مدير المؤسسة بدون قسم - وصول كامل لجميع الأعضاء
      // لا فلتر إضافي
    } else if (isDepartmentMember) {
      // أعضاء الأقسام يرون أعضاء قسمهم فقط
      if (member.departmentId !== userDepartmentId) {
        return false;
      }
    }
    // الإدارة العليا الأخرى ترى جميع الأعضاء (لا فلتر إضافي)

    // ثانياً: تطبيق فلتر البحث
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
        member.email.toLowerCase().includes(searchLower) ||
        member.name.toLowerCase().includes(searchLower) ||
        (departments.find(d => d.id === member.departmentId)?.name.toLowerCase().includes(searchLower));

      if (!matchesSearch) return false;
    }

    // ثالثاً: تطبيق فلتر الدور
    if (selectedRole !== 'all' && member.role !== selectedRole) {
      return false;
    }

    // رابعاً: تطبيق فلتر القسم
    if (selectedDepartment !== 'all') {
      if (selectedDepartment === 'none' && member.departmentId) return false;
      if (selectedDepartment !== 'none' && member.departmentId !== selectedDepartment) return false;
    }

    // خامساً: تطبيق فلتر التبويب
    switch (activeTab) {
      case 'individuals':
        return !member.departmentId; // الأفراد (بدون قسم)
      case 'departments':
        return member.departmentId; // أعضاء الأقسام
      case 'roles':
        return true; // جميع الأعضاء مجمعين حسب الأدوار
      default:
        return true; // جميع الأعضاء
    }
  });

  // 📊 إحصائيات الأعضاء (مع مراعاة الصلاحيات)
  const visibleMembers = hasFullAccess
    ? members // وصول كامل لجميع الأعضاء
    : isDepartmentMember
      ? members.filter(m => m.departmentId === userDepartmentId) // أعضاء القسم فقط
      : members; // الإدارة العليا الأخرى

  const membersStats = {
    total: visibleMembers.length,
    individuals: visibleMembers.filter(m => !m.departmentId).length,
    inDepartments: visibleMembers.filter(m => m.departmentId).length,
    active: visibleMembers.filter(m => m.isActive).length,
    byRole: visibleMembers.reduce((acc, member) => {
      acc[member.role] = (acc[member.role] || 0) + 1;
      return acc;
    }, {} as Record<UserRole, number>)
  };

  // استخراج الأدوار الموجودة فعلاً في المؤسسة
  const availableRoles = Array.from(new Set(visibleMembers.map(m => m.role))) as UserRole[];



  // 🔍 تسجيل للتحقق من البيانات
  console.log('📊 Members Stats:', membersStats);
  console.log('👥 All Members:', members.map(m => ({ email: m.email, departmentId: m.departmentId })));
  console.log('📋 Active Tab:', activeTab);
  console.log('🔍 Filtered Members:', filteredMembers.length);

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
          name: doc.data().name,
          membersCount: 0 // سيتم تحديثه لاحقاً
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

            // 🔍 تسجيل بيانات العضو الخام
            console.log(`👤 Member ${memberId}:`, {
              email: memberData.email,
              role: memberData.role,
              departmentId: memberData.departmentId,
              rawData: memberData
            });

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
                name: userData?.name || userData?.displayName || memberData.name || memberData.displayName || 'مستخدم غير معروف',

                // 🎭 الدور: من عضوية المؤسسة (أولوية)
                role: memberData.role || userData?.role || 'isOrgAssistant',

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
                name: memberData.name || memberData.displayName || 'مستخدم غير معروف',
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

          // تحديث عدد الأعضاء في كل قسم
          setDepartments(prevDepartments =>
            prevDepartments.map(dept => ({
              ...dept,
              membersCount: membersData.filter(member => member.departmentId === dept.id).length
            }))
          );

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

      // استدعاء وظيفة دعوة عضو (الدالة الصحيحة)
      const inviteUserToOrganization = httpsCallable(functions, 'inviteUserToOrganization');
      await inviteUserToOrganization({
        email: formData.email,
        role: formData.role,
        departmentId: formData.departmentId === 'none' ? null : formData.departmentId,
        organizationId: organizationId
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

      // استدعاء وظيفة تعديل عضو (الاسم الصحيح)
      const updateOrganizationMember = httpsCallable(functions, 'updateOrganizationMember');
      await updateOrganizationMember({
        userId: selectedMember.uid,
        role: formData.role,
        departmentId: formData.departmentId === 'none' ? null : formData.departmentId,
        orgId: organizationId
      });

      toast({
        title: 'تم تعديل العضو بنجاح',
        description: 'تم تعديل بيانات العضو بنجاح.',
      });

      // تحديث البيانات المحلية للعضو المحدد
      if (selectedMember) {
        setSelectedMember({
          ...selectedMember,
          role: formData.role,
          departmentId: formData.departmentId === 'none' ? null : formData.departmentId
        });
      }

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

  // حذف عضو (إزالة من المؤسسة فقط)
  const handleDeleteMember = async () => {
    if (!user || !organizationId || !selectedMember) return;

    setFormLoading(true);

    try {
      const idToken = await user.getIdToken();

      // استدعاء وظيفة حذف عضو (الاسم الصحيح)
      const removeOrganizationMember = httpsCallable(functions, 'removeOrganizationMember');
      await removeOrganizationMember({
        userId: selectedMember.uid,
        orgId: organizationId
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

  // حذف المستخدم بشكل شامل (حساب + بيانات)
  const handleDeleteUserCompletely = (member: Member) => {
    setSelectedMember(member);
    setIsDeleteUserDialogOpen(true);
  };

  const handleUserDeleted = () => {
    // إعادة تحميل قائمة الأعضاء
    // سيتم تحديثها تلقائياً عبر onSnapshot
    setSelectedMember(null);
  };

  if (loading) {
    return (
      <div className="flex flex-col h-full w-full">
        <div className="flex-1 overflow-y-auto w-full">
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
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-screen">
      <div className="flex-1 overflow-y-auto">
        {/* Full width layout like tasks page */}
        <div className="px-4 md:px-6 py-4 space-y-4 md:space-y-6">
          {/* Header Section - Mobile First Design */}
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
            <div className="flex flex-col gap-2">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold flex items-center flex-wrap gap-2">
                <Users className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0" />
                <span className="break-words"><Translate text="organization.members" /></span>
                {isDepartmentMember && !hasFullAccess && (
                  <Badge variant="outline" className="text-xs sm:text-sm">
                    قسمي فقط
                  </Badge>
                )}
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground">
                إدارة أعضاء المؤسسة والأدوار والصلاحيات
              </p>
            </div>
            {(isOwner || isAdmin) && (
              <Button
                onClick={() => setIsAddDialogOpen(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-2 touch-manipulation"
                size="sm"
              >
                <UserPlus className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline"><Translate text="organization.addMember" /></span>
                <span className="sm:hidden">إضافة عضو</span>
              </Button>
            )}
          </div>

          {/* إحصائيات سريعة - Responsive Grid */}
          <div className="w-full">
            <MembersStats stats={membersStats} />
          </div>

          {/* شريط البحث والفلاتر - Enhanced Mobile Experience */}
          <div className="w-full">
            <MembersFilters
              searchTerm={searchTerm}
              selectedRole={selectedRole}
              selectedDepartment={selectedDepartment}
              departments={departments}
              availableRoles={availableRoles}
              roleStats={membersStats.byRole}
              individualsCount={membersStats.individuals}
              isOwner={isOwner}
              filteredCount={filteredMembers.length}
              totalCount={membersStats.total}
              onSearchChange={setSearchTerm}
              onRoleChange={setSelectedRole}
              onDepartmentChange={setSelectedDepartment}
              onReset={() => {
                setSearchTerm('');
                setSelectedRole('all');
                setSelectedDepartment('all');
              }}
            />
          </div>

          {/* رسالة توضيحية لأعضاء الأقسام - Enhanced Mobile Design */}
          {isDepartmentMember && !hasFullAccess && (
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4 w-full">
              <div className="flex items-start sm:items-center gap-3 text-blue-800 dark:text-blue-200">
                <Building className="h-5 w-5 flex-shrink-0 mt-0.5 sm:mt-0" />
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-sm sm:text-base block">
                    عرض محدود - أعضاء قسمك فقط
                  </span>
                  <p className="text-xs sm:text-sm text-blue-600 dark:text-blue-300 mt-1 leading-relaxed">
                    كعضو في القسم، يمكنك رؤية أعضاء قسمك فقط. الإدارة العليا يمكنها رؤية جميع الأعضاء.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* إدارة الأفراد بدون قسم */}
          {activeTab === 'individuals' && (isOwner || isAdmin) && (
            <div className="mb-6">
              <IndividualMembersManager
                members={members}
                departments={departments}
                organizationId={organizationId!}
                canManageMembers={isOwner || isAdmin}
                onMemberUpdated={() => {
                  // سيتم تحديث البيانات تلقائياً عبر onSnapshot
                }}
              />
            </div>
          )}

          {/* قائمة الأعضاء - Full Width with Responsive Design */}
          <div className="w-full">
            <MembersList
              members={filteredMembers}
              departments={departments}
              activeTab={activeTab}
              isOwner={isOwner}
              isAdmin={isAdmin}
              searchTerm={searchTerm}
              selectedRole={selectedRole}
              selectedDepartment={selectedDepartment}
              stats={membersStats}
              onTabChange={setActiveTab}
              onEditMember={(member) => {
                setSelectedMember(member);
                setFormData({
                  email: member.email,
                  role: member.role,
                  departmentId: member.departmentId || 'none',
                });
                setIsEditDialogOpen(true);
              }}
              onRemoveMember={(member) => {
                setSelectedMember(member);
                setIsDeleteDialogOpen(true);
              }}
              onDeleteMember={handleDeleteUserCompletely}
            />
          </div>
        </div>
      </div>

      {/* مربع حوار إضافة عضو - Enhanced Mobile Experience */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-lg sm:text-xl">
              <Translate text="organization.addMember" />
            </DialogTitle>
            <DialogDescription className="text-sm sm:text-base">
              <Translate text="organization.addMemberDescription" />
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium">
                <Translate text="auth.email" />
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="example@example.com"
                className="w-full touch-manipulation"
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role" className="text-sm font-medium">
                <Translate text="organization.role" />
              </Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value as UserRole })}
              >
                <SelectTrigger className="w-full touch-manipulation">
                  <SelectValue placeholder="اختر الدور" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px] overflow-y-auto">
                  {isOwner && <SelectItem value="isOrgOwner"><Translate text="roles.isOrgOwner" /></SelectItem>}
                  <SelectItem value="isOrgAdmin"><Translate text="roles.isOrgAdmin" /></SelectItem>
                  <SelectItem value="isOrgEngineer"><Translate text="roles.isOrgEngineer" /></SelectItem>
                  <SelectItem value="isOrgSupervisor"><Translate text="roles.isOrgSupervisor" /></SelectItem>
                  <SelectItem value="isOrgTechnician"><Translate text="roles.isOrgTechnician" /></SelectItem>
                  <SelectItem value="isOrgAssistant"><Translate text="roles.isOrgAssistant" /></SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="department" className="text-sm font-medium">
                <Translate text="organization.department" />
              </Label>
              <Select
                value={formData.departmentId}
                onValueChange={(value) => setFormData({ ...formData, departmentId: value })}
              >
                <SelectTrigger className="w-full touch-manipulation">
                  <SelectValue placeholder="اختر القسم" />
                </SelectTrigger>
                <SelectContent className="max-h-[200px] overflow-y-auto">
                  <SelectItem value="none">
                    <Translate text="organization.noDepartment" />
                  </SelectItem>
                  {departments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsAddDialogOpen(false)}
              className="w-full sm:w-auto touch-manipulation"
              size="sm"
            >
              <Translate text="general.cancel" />
            </Button>
            <Button
              onClick={handleAddMember}
              disabled={formLoading}
              className="w-full sm:w-auto touch-manipulation"
              size="sm"
            >
              {formLoading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  <Translate text="general.adding" />
                </>
              ) : (
                <Translate text="general.add" />
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* مربع حوار تعديل عضو - Enhanced Mobile Experience */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md mx-auto max-h-[90vh] overflow-y-auto">
          <DialogHeader className="space-y-3">
            <DialogTitle className="text-lg sm:text-xl">
              <Translate text="organization.editMember" />
            </DialogTitle>
            <DialogDescription className="text-sm sm:text-base">
              <Translate text="organization.editMemberDescription" />
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">
                <Translate text="auth.email" />
              </Label>
              <Input
                id="email"
                value={formData.email}
                disabled
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">
                <Translate text="organization.role" />
              </Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value as UserRole })}
                disabled={selectedMember?.role === 'isOrgOwner' && !isOwner}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {isOwner && <SelectItem value="isOrgOwner"><Translate text="roles.isOrgOwner" /></SelectItem>}
                  <SelectItem value="isOrgAdmin"><Translate text="roles.isOrgAdmin" /></SelectItem>
                  <SelectItem value="isOrgEngineer"><Translate text="roles.isOrgEngineer" /></SelectItem>
                  <SelectItem value="isOrgSupervisor"><Translate text="roles.isOrgSupervisor" /></SelectItem>
                  <SelectItem value="isOrgTechnician"><Translate text="roles.isOrgTechnician" /></SelectItem>
                  <SelectItem value="isOrgAssistant"><Translate text="roles.isOrgAssistant" /></SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">
                <Translate text="organization.department" />
              </Label>
              <Select
                value={formData.departmentId}
                onValueChange={(value) => setFormData({ ...formData, departmentId: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <Translate text="organization.noDepartment" />
                  </SelectItem>
                  {departments.map((department) => (
                    <SelectItem key={department.id} value={department.id}>
                      {department.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              className="w-full sm:w-auto touch-manipulation"
              size="sm"
            >
              <Translate text="general.cancel" />
            </Button>
            <Button
              onClick={handleEditMember}
              disabled={formLoading}
              className="w-full sm:w-auto touch-manipulation"
              size="sm"
            >
              {formLoading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  <Translate text="general.updating" />
                </>
              ) : (
                <Translate text="general.saveChanges" />
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* مربع حوار تأكيد الحذف - Enhanced Mobile Experience */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="w-[95vw] max-w-md mx-auto">
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-lg sm:text-xl">
              <Translate text="organization.confirmDeleteMember" />
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm sm:text-base leading-relaxed">
              <Translate text="organization.deleteMemberWarning" />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-0">
            <AlertDialogCancel className="w-full sm:w-auto touch-manipulation">
              <Translate text="general.cancel" />
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 w-full sm:w-auto touch-manipulation"
            >
              {formLoading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  <Translate text="general.deleting" />
                </>
              ) : (
                <Translate text="general.delete" />
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* مربع حوار حذف المستخدم نهائياً */}
      <DeleteUserDialog
        isOpen={isDeleteUserDialogOpen}
        onClose={() => setIsDeleteUserDialogOpen(false)}
        user={selectedMember ? {
          uid: selectedMember.uid,
          name: selectedMember.name || selectedMember.email || 'مستخدم غير معروف',
          email: selectedMember.email || '',
          role: selectedMember.role,
          accountType: 'organization',
          organizationId: organizationId
        } : null}
        onUserDeleted={handleUserDeleted}
      />
    </div>
  );
}
