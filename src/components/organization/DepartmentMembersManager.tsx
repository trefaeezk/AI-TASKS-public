'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Users, 
  UserMinus, 
  UserPlus, 
  MoreVertical, 
  Edit, 
  Trash2,
  Crown,
  Shield,
  ShieldCheck,
  Settings,
  User
} from 'lucide-react';

interface Member {
  uid: string;
  email: string;
  name: string;
  displayName?: string;
  role: string;
  departmentId?: string;
}

interface DepartmentMembersManagerProps {
  members: Member[];
  departmentId: string;
  organizationId: string;
  canManageMembers: boolean;
  onMemberUpdated: () => void;
  onAssignMember: () => void;
}

export function DepartmentMembersManager({
  members,
  departmentId,
  organizationId,
  canManageMembers,
  onMemberUpdated,
  onAssignMember
}: DepartmentMembersManagerProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);

  // إزالة المستخدم من القسم
  const handleRemoveFromDepartment = async () => {
    if (!selectedMember) return;

    setLoading(true);
    try {
      const removeUserFromDepartment = httpsCallable(functions, 'removeUserFromDepartment');
      await removeUserFromDepartment({
        orgId: organizationId,
        userId: selectedMember.uid
      });

      toast({
        title: 'تم إزالة العضو من القسم',
        description: `تم إزالة ${selectedMember.name} من القسم بنجاح. أصبح الآن فرداً بدون قسم.`,
      });

      onMemberUpdated();
      setIsRemoveDialogOpen(false);
      setSelectedMember(null);
    } catch (error: any) {
      console.error('Error removing member from department:', error);
      toast({
        title: 'خطأ في إزالة العضو',
        description: error.message || 'حدث خطأ أثناء محاولة إزالة العضو من القسم.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // أيقونة الدور
  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'isOrgOwner':
        return <Crown className="h-4 w-4 text-yellow-500" />;
      case 'isOrgAdmin':
        return <Shield className="h-4 w-4 text-red-500" />;
      case 'isOrgSupervisor':
        return <ShieldCheck className="h-4 w-4 text-blue-500" />;
      case 'isOrgEngineer':
        return <Settings className="h-4 w-4 text-green-500" />;
      case 'isOrgTechnician':
        return <Settings className="h-4 w-4 text-orange-500" />;
      case 'isOrgAssistant':
        return <User className="h-4 w-4 text-gray-500" />;
      default:
        return <User className="h-4 w-4 text-gray-500" />;
    }
  };

  // ترجمة الدور
  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'isOrgOwner':
        return 'مالك المؤسسة';
      case 'isOrgAdmin':
        return 'مدير المؤسسة';
      case 'isOrgSupervisor':
        return 'مشرف';
      case 'isOrgEngineer':
        return 'مهندس';
      case 'isOrgTechnician':
        return 'فني';
      case 'isOrgAssistant':
        return 'مساعد فني';
      default:
        return role;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle className="flex items-center">
              <Users className="ml-2 h-5 w-5" />
              أعضاء القسم ({members.length})
            </CardTitle>
            <CardDescription>
              إدارة أعضاء القسم وأدوارهم
            </CardDescription>
          </div>
          {canManageMembers && (
            <Button onClick={onAssignMember} variant="outline" size="sm">
              <UserPlus className="ml-2 h-4 w-4" />
              تعيين عضو
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <div className="text-center py-8">
            <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">لا يوجد أعضاء في هذا القسم</p>
            {canManageMembers && (
              <Button onClick={onAssignMember} variant="outline">
                <UserPlus className="ml-2 h-4 w-4" />
                تعيين أول عضو
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <div key={member.uid} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="flex items-center space-x-3 space-x-reverse">
                  <div className="flex-shrink-0">
                    {getRoleIcon(member.role)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">
                      {member.name || member.displayName || member.email}
                    </h3>
                    <div className="flex items-center space-x-2 space-x-reverse mt-1">
                      <Badge variant="secondary" className="text-xs">
                        {getRoleLabel(member.role)}
                      </Badge>
                      <span className="text-sm text-muted-foreground truncate">
                        {member.email}
                      </span>
                    </div>
                  </div>
                </div>
                
                {canManageMembers && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setSelectedMember(member);
                          setIsRemoveDialogOpen(true);
                        }}
                        className="text-orange-600"
                      >
                        <UserMinus className="ml-2 h-4 w-4" />
                        إزالة من القسم
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* حوار تأكيد إزالة العضو من القسم */}
      <AlertDialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>إزالة العضو من القسم</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من إزالة <strong>{selectedMember?.name}</strong> من هذا القسم؟
              <br />
              <br />
              سيصبح العضو فرداً بدون قسم في المؤسسة، ولكن سيحتفظ بعضويته في المؤسسة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveFromDepartment}
              disabled={loading}
              className="bg-orange-600 hover:bg-orange-700"
            >
              {loading ? 'جاري الإزالة...' : 'إزالة من القسم'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
