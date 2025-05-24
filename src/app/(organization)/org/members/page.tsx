'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, UserPlus, UserX, Shield, Edit, Trash2, AlertTriangle, Loader2, User, Building } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Translate } from '@/components/Translate';
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
  const [activeTab, setActiveTab] = useState('all');

  const organizationId = userClaims?.organizationId;
  const isOwner = userClaims?.owner === true;
  const isAdmin = userClaims?.admin === true;

  // 📊 تصفية الأعضاء حسب التبويب
  const filteredMembers = members.filter(member => {
    switch (activeTab) {
      case 'individuals':
        return !member.departmentId; // الأفراد (بدون قسم)
      case 'departments':
        return member.departmentId; // أعضاء الأقسام
      default:
        return true; // جميع الأعضاء
    }
  });

  // 📊 إحصائيات الأعضاء
  const membersStats = {
    total: members.length,
    individuals: members.filter(m => !m.departmentId).length,
    inDepartments: members.filter(m => m.departmentId).length
  };

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
          <Translate text="organization.members" />
        </h1>
        {(isOwner || isAdmin) && (
          <Button onClick={() => setIsAddDialogOpen(true)} className="flex items-center">
            <UserPlus className="ml-2 h-4 w-4" />
            <Translate text="organization.addMember" />
          </Button>
        )}
      </div>

      {/* 📋 تبويبات الأعضاء */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <Translate text="general.all" />
            <Badge variant="secondary">{membersStats.total}</Badge>
          </TabsTrigger>
          <TabsTrigger value="individuals" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <Translate text="organization.individuals" />
            <Badge variant="secondary">{membersStats.individuals}</Badge>
          </TabsTrigger>
          <TabsTrigger value="departments" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            <Translate text="organization.departments" />
            <Badge variant="secondary">{membersStats.inDepartments}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* 📋 جميع الأعضاء */}
        <TabsContent value="all" className="mt-6">
          {members.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Translate text="organization.noMembers" />
            </div>
          ) : (
            <div className="space-y-4">
              {members.map((member) => (
            <Card key={member.uid}>
              <CardContent className="p-4 flex justify-between items-center">
                <div>
                  <h3 className="font-medium">{member.email}</h3>
                  <p className="text-sm text-muted-foreground">
                    <Translate text={`roles.${member.role}`} defaultValue={member.role} />
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
        </TabsContent>

        {/* 👥 تبويب الأفراد */}
        <TabsContent value="individuals" className="mt-6">
          {filteredMembers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <User className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">
                <Translate text="organization.noIndividuals" />
              </p>
              <p className="text-sm">
                <Translate text="organization.allMembersAssigned" />
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 text-blue-800">
                  <User className="h-5 w-5" />
                  <span className="font-medium">
                    <Translate text="organization.membersWithoutDepartment" />
                  </span>
                </div>
                <p className="text-sm text-blue-600 mt-1">
                  <Translate text="organization.canAssignToDepartment" />
                </p>
              </div>
              {filteredMembers.map((member) => (
                <Card key={member.uid} className="border-l-4 border-l-blue-500">
                  <CardContent className="p-4 flex justify-between items-center">
                    <div>
                      <h3 className="font-medium">{member.email}</h3>
                      <p className="text-sm text-muted-foreground">
                        {member.name} • {member.role}
                      </p>
                      <Badge variant="outline" className="mt-1">
                        <Translate text="organization.unassigned" />
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      {(isOwner || isAdmin) && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
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
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setSelectedMember(member);
                              setIsDeleteDialogOpen(true);
                            }}
                          >
                            <UserX className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* 🏢 تبويب أعضاء الأقسام */}
        <TabsContent value="departments" className="mt-6">
          {filteredMembers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">
                <Translate text="organization.noDepartmentMembers" />
              </p>
              <p className="text-sm">
                <Translate text="organization.assignMembersToDepartments" />
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 text-green-800">
                  <Building className="h-5 w-5" />
                  <span className="font-medium">
                    <Translate text="organization.departmentMembers" />
                  </span>
                </div>
                <p className="text-sm text-green-600 mt-1">
                  <Translate text="organization.membersAssignedToDepartments" />
                </p>
              </div>
              {filteredMembers.map((member) => {
                const department = departments.find(d => d.id === member.departmentId);
                return (
                  <Card key={member.uid} className="border-l-4 border-l-green-500">
                    <CardContent className="p-4 flex justify-between items-center">
                      <div>
                        <h3 className="font-medium">{member.email}</h3>
                        <p className="text-sm text-muted-foreground">
                          {member.name} • {member.role}
                        </p>
                        <Badge variant="default" className="mt-1">
                          {department?.name || (
                            <Translate text="organization.unknownDepartment" />
                          )}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-2">
                        {(isOwner || isAdmin) && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
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
                              variant="destructive"
                              size="sm"
                              onClick={() => {
                                setSelectedMember(member);
                                setIsDeleteDialogOpen(true);
                              }}
                            >
                              <UserX className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* مربع حوار إضافة عضو */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <Translate text="organization.addMember" />
            </DialogTitle>
            <DialogDescription>
              <Translate text="organization.addMemberDescription" />
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">
                <Translate text="auth.email" />
              </Label>
              <Input
                id="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="example@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">
                <Translate text="organization.role" />
              </Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {isOwner && <SelectItem value="owner"><Translate text="roles.owner" /></SelectItem>}
                  <SelectItem value="admin"><Translate text="roles.admin" /></SelectItem>
                  <SelectItem value="engineer"><Translate text="roles.engineer" /></SelectItem>
                  <SelectItem value="supervisor"><Translate text="roles.supervisor" /></SelectItem>
                  <SelectItem value="technician"><Translate text="roles.technician" /></SelectItem>
                  <SelectItem value="assistant"><Translate text="roles.assistant" /></SelectItem>
                  <SelectItem value="user"><Translate text="roles.user" /></SelectItem>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              <Translate text="general.cancel" />
            </Button>
            <Button onClick={handleAddMember} disabled={formLoading}>
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

      {/* مربع حوار تعديل عضو */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              <Translate text="organization.editMember" />
            </DialogTitle>
            <DialogDescription>
              <Translate text="organization.editMemberDescription" />
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
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
                onValueChange={(value) => setFormData({ ...formData, role: value })}
                disabled={selectedMember?.role === 'owner' && !isOwner}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {isOwner && <SelectItem value="owner"><Translate text="roles.owner" /></SelectItem>}
                  <SelectItem value="admin"><Translate text="roles.admin" /></SelectItem>
                  <SelectItem value="engineer"><Translate text="roles.engineer" /></SelectItem>
                  <SelectItem value="supervisor"><Translate text="roles.supervisor" /></SelectItem>
                  <SelectItem value="technician"><Translate text="roles.technician" /></SelectItem>
                  <SelectItem value="assistant"><Translate text="roles.assistant" /></SelectItem>
                  <SelectItem value="user"><Translate text="roles.user" /></SelectItem>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              <Translate text="general.cancel" />
            </Button>
            <Button onClick={handleEditMember} disabled={formLoading}>
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

      {/* مربع حوار تأكيد الحذف */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <Translate text="organization.confirmDeleteMember" />
            </AlertDialogTitle>
            <AlertDialogDescription>
              <Translate text="organization.deleteMemberWarning" />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Translate text="general.cancel" />
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMember} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
    </div>
  );
}
