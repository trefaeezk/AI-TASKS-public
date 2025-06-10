'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Users, 
  UserPlus, 
  MoreVertical, 
  Building,
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
  departmentId?: string | null;
}

interface Department {
  id: string;
  name: string;
}

interface IndividualMembersManagerProps {
  members: Member[];
  departments: Department[];
  organizationId: string;
  canManageMembers: boolean;
  onMemberUpdated: () => void;
}

export function IndividualMembersManager({
  members,
  departments,
  organizationId,
  canManageMembers,
  onMemberUpdated
}: IndividualMembersManagerProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');

  // الأفراد بدون قسم
  const individualMembers = members.filter(member => !member.departmentId);

  // تعيين المستخدم لقسم
  const handleAssignToDepartment = async () => {
    if (!selectedMember || !selectedDepartmentId) return;

    setLoading(true);
    try {
      const updateOrganizationMember = httpsCallable(functions, 'updateOrganizationMember');
      await updateOrganizationMember({
        orgId: organizationId,
        userId: selectedMember.uid,
        departmentId: selectedDepartmentId
      });

      toast({
        title: 'تم تعيين العضو للقسم',
        description: `تم تعيين ${selectedMember.name} للقسم بنجاح.`,
      });

      onMemberUpdated();
      setIsAssignDialogOpen(false);
      setSelectedMember(null);
      setSelectedDepartmentId('');
    } catch (error: any) {
      console.error('Error assigning member to department:', error);
      toast({
        title: 'خطأ في تعيين العضو',
        description: error.message || 'حدث خطأ أثناء محاولة تعيين العضو للقسم.',
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
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="ml-2 h-5 w-5" />
            الأفراد بدون قسم ({individualMembers.length})
          </CardTitle>
          <CardDescription>
            أعضاء المؤسسة الذين لم يتم تعيينهم لأي قسم
          </CardDescription>
        </CardHeader>
        <CardContent>
          {individualMembers.length === 0 ? (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">جميع الأعضاء معينون لأقسام</p>
            </div>
          ) : (
            <div className="space-y-3">
              {individualMembers.map((member) => (
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
                  
                  {canManageMembers && departments.length > 0 && (
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
                            setIsAssignDialogOpen(true);
                          }}
                          className="text-blue-600"
                        >
                          <Building className="ml-2 h-4 w-4" />
                          تعيين لقسم
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* حوار تعيين العضو لقسم */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تعيين العضو لقسم</DialogTitle>
            <DialogDescription>
              اختر القسم الذي تريد تعيين <strong>{selectedMember?.name}</strong> إليه.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">القسم</label>
              <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر القسم" />
                </SelectTrigger>
                <SelectContent>
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
            <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={handleAssignToDepartment}
              disabled={loading || !selectedDepartmentId}
            >
              {loading ? 'جاري التعيين...' : 'تعيين للقسم'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
