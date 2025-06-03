'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { PermissionsManager } from '@/components/PermissionsManager';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ManagedUser } from '@/types/user';
import { PermissionKey, UserRole } from '@/types/roles';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { Translate } from '../Translate';

// دالة لعرض أسماء الأدوار بالعربية
const getRoleDisplayName = (role: string): string => {
  const roleNames: Record<string, string> = {
    'isSystemOwner': 'مالك النظام',
    'isSystemAdmin': 'أدمن النظام العام',
    'isIndependent': 'مستخدم مستقل',
    'isOrgOwner': 'مالك المؤسسة',
    'isOrgAdmin': 'أدمن المؤسسة',
    'isOrgSupervisor': 'مشرف',
    'isOrgEngineer': 'مهندس',
    'isOrgTechnician': 'فني',
    'isOrgAssistant': 'مساعد فني'
  };
  return roleNames[role] || role;
};

interface UserDetailsDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  user: ManagedUser | null;
  onUpdateRole: (userId: string, role: UserRole) => Promise<void>;
  onUpdatePermissions: (userId: string, permissions: PermissionKey[]) => Promise<void>;
  onToggleDisabled: (userId: string, disabled: boolean) => Promise<void>;
  loading: boolean;
}

export function UserDetailsDialog({
  isOpen,
  onOpenChange,
  user,
  onUpdateRole,
  onUpdatePermissions,
  onToggleDisabled,
  loading
}: UserDetailsDialogProps) {
  const { toast } = useToast();
  const { refreshUserData } = useAuth();
  const [activeTab, setActiveTab] = useState('details');
  const [selectedRole, setSelectedRole] = useState<UserRole>('isOrgAssistant');
  const [customPermissions, setCustomPermissions] = useState<PermissionKey[]>([]);
  const [isDisabled, setIsDisabled] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Update state when user changes
  useEffect(() => {
    if (user) {
      setSelectedRole(user.role || 'isOrgAssistant');
      setCustomPermissions(user.customPermissions || []);
      setIsDisabled(user.disabled);
    }
  }, [user]);

  const handleSaveChanges = async () => {
    if (!user) return;

    setIsSaving(true);
    try {
      // Only update role if it changed
      if (selectedRole !== user.role) {
        await onUpdateRole(user.uid, selectedRole);

        // إعادة تحميل معلومات المستخدم بعد تحديث الدور
        console.log("[UserDetailsDialog] Role updated, refreshing user data");
        await refreshUserData();
      }

      // Only update permissions if they changed
      const currentPermissions = user.customPermissions || [];
      if (JSON.stringify(customPermissions.sort()) !== JSON.stringify(currentPermissions.sort())) {
        await onUpdatePermissions(user.uid, customPermissions);
      }

      toast({
        title: 'تم حفظ التغييرات',
        description: 'تم تحديث معلومات المستخدم بنجاح.',
      });
    } catch (error) {
      console.error('Error saving user changes:', error);
      toast({
        title: 'خطأ في حفظ التغييرات',
        description: 'حدث خطأ أثناء محاولة حفظ التغييرات.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleDisabled = async () => {
    if (!user) return;

    try {
      await onToggleDisabled(user.uid, !isDisabled);
      setIsDisabled(!isDisabled);
    } catch (error) {
      console.error('Error toggling user disabled status:', error);
      toast({
        title: 'خطأ في تغيير حالة المستخدم',
        description: 'حدث خطأ أثناء محاولة تغيير حالة المستخدم.',
        variant: 'destructive',
      });
    }
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>تفاصيل المستخدم</DialogTitle>
          <DialogDescription>
            عرض وتعديل معلومات المستخدم والصلاحيات
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 mb-4">
            <TabsTrigger value="details">المعلومات الأساسية</TabsTrigger>
            <TabsTrigger value="permissions">الصلاحيات</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>معلومات المستخدم</CardTitle>
                <CardDescription>المعلومات الأساسية للمستخدم</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground">المعرف</Label>
                    <p className="text-sm font-medium break-all bg-muted p-2 rounded text-xs font-mono">
                      {user.uid}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">الاسم</Label>
                      <p className="text-sm font-medium">{user.name || 'غير محدد'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">البريد الإلكتروني</Label>
                      <p className="text-sm font-medium break-all">{user.email || 'غير محدد'}</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">الدور الحالي</Label>
                    <p className="text-sm font-medium bg-primary/10 text-primary px-2 py-1 rounded-md inline-block">
                      {user.role ? (
                        getRoleDisplayName(user.role)
                      ) : (
                        'غير محدد'
                      )}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground">الدور</Label>
                  <Select
                    value={selectedRole}
                    onValueChange={(value) => setSelectedRole(value as UserRole)}
                    disabled={loading || isSaving}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر دورًا" />
                    </SelectTrigger>
                    <SelectContent>
                      {/* أدوار النظام العامة (النمط الجديد is* فقط) */}
                      <SelectItem value="isSystemOwner">مالك النظام</SelectItem>
                      <SelectItem value="isSystemAdmin">أدمن النظام العام</SelectItem>
                      <SelectItem value="isIndependent">مستخدم مستقل</SelectItem>

                      {/* أدوار المؤسسات (النمط الجديد is* فقط) */}
                      <SelectItem value="isOrgOwner">مالك المؤسسة</SelectItem>
                      <SelectItem value="isOrgAdmin">أدمن المؤسسة</SelectItem>
                      <SelectItem value="isOrgSupervisor">مشرف</SelectItem>
                      <SelectItem value="isOrgEngineer">مهندس</SelectItem>
                      <SelectItem value="isOrgTechnician">فني</SelectItem>
                      <SelectItem value="isOrgAssistant">مساعد فني</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between space-x-2 space-x-reverse">
                  <div className="flex flex-col space-y-1">
                    <Label htmlFor="user-status" className="text-muted-foreground">
                      حالة المستخدم
                    </Label>
                    <span className="text-sm">
                      {isDisabled ? 'معطل' : 'نشط'}
                    </span>
                  </div>
                  <Switch
                    id="user-status"
                    checked={!isDisabled}
                    onCheckedChange={handleToggleDisabled}
                    disabled={loading || isSaving}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="permissions">
            <PermissionsManager
              role={selectedRole}
              customPermissions={customPermissions}
              onPermissionsChange={setCustomPermissions}
              readOnly={loading || isSaving}
            />
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <DialogClose asChild>
            <Button type="button" variant="outline">إغلاق</Button>
          </DialogClose>
          <Button
            onClick={handleSaveChanges}
            disabled={loading || isSaving}
            className="gap-2"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            حفظ التغييرات
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
