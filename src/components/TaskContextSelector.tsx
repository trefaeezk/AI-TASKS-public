'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Building, Users, User } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { TaskContext } from '@/types/task';
import { Skeleton } from '@/components/ui/skeleton';

interface Department {
  id: string;
  name: string;
}

interface OrganizationMember {
  uid: string;
  email: string;
  name: string;
}

interface TaskContextSelectorProps {
  value: {
    taskContext: TaskContext | undefined;
    departmentId: string | undefined;
    assignedToUserId: string | undefined;
  };
  onChange: (value: {
    taskContext: TaskContext | undefined;
    departmentId: string | undefined;
    assignedToUserId: string | undefined;
  }) => void;
  organizationId?: string;
  disabled?: boolean;
}

export function TaskContextSelector({
  value,
  onChange,
  organizationId,
  disabled = false
}: TaskContextSelectorProps) {
  const { userClaims } = useAuth();

  // تحديد الأدوار المتدنية التي لا يمكنها إسناد مهام للآخرين أو تغيير مستوى المهمة
  const isLowLevelRole = userClaims?.isOrgEngineer || userClaims?.isOrgTechnician || userClaims?.isOrgAssistant;

  // إخفاء خيارات الإسناد ومستوى المهمة للأدوار المتدنية
  const canAssignToOthers = !isLowLevelRole;
  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);

  // Fetch departments when organizationId changes
  useEffect(() => {
    if (!organizationId || value.taskContext !== 'department') return;

    const fetchDepartments = async () => {
      setLoadingDepartments(true);
      try {
        const departmentsQuery = query(
          collection(db, 'organizations', organizationId, 'departments')
        );
        const snapshot = await getDocs(departmentsQuery);
        const departmentsList: Department[] = [];
        snapshot.forEach((doc) => {
          departmentsList.push({
            id: doc.id,
            name: doc.data().name || 'قسم بدون اسم',
          });
        });
        setDepartments(departmentsList);
      } catch (error) {
        console.error('Error fetching departments:', error);
      } finally {
        setLoadingDepartments(false);
      }
    };

    fetchDepartments();
  }, [organizationId, value.taskContext]);

  // Fetch members when organizationId changes
  useEffect(() => {
    if (!organizationId || value.taskContext !== 'individual') return;

    const fetchMembers = async () => {
      setLoadingMembers(true);
      try {
        const membersQuery = query(
          collection(db, 'organizations', organizationId, 'members')
        );
        const snapshot = await getDocs(membersQuery);
        const membersList: OrganizationMember[] = [];

        // Get user details for each member
        for (const doc of snapshot.docs) {
          try {
            const userDoc = await getDocs(query(
              collection(db, 'users'),
              where('uid', '==', doc.id)
            ));

            if (!userDoc.empty) {
              const userData = userDoc.docs[0].data();
              membersList.push({
                uid: doc.id,
                email: userData.email || 'بدون بريد إلكتروني',
                name: userData.name || 'عضو بدون اسم',
              });
            } else {
              membersList.push({
                uid: doc.id,
                email: 'بدون بريد إلكتروني',
                name: 'عضو بدون اسم',
              });
            }
          } catch (error) {
            console.error(`Error fetching user details for ${doc.id}:`, error);
          }
        }

        setMembers(membersList);
      } catch (error) {
        console.error('Error fetching members:', error);
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchMembers();
  }, [organizationId, value.taskContext]);

  // Handle context change
  const handleContextChange = (newContext: TaskContext) => {
    onChange({
      taskContext: newContext,
      departmentId: newContext === 'department' ? value.departmentId : undefined,
      assignedToUserId: newContext === 'individual' ? value.assignedToUserId : undefined,
    });
  };

  // Handle department change
  const handleDepartmentChange = (departmentId: string) => {
    onChange({
      ...value,
      departmentId,
    });
  };

  // Handle assigned user change
  const handleAssignedUserChange = (userId: string) => {
    onChange({
      ...value,
      assignedToUserId: userId,
    });
  };

  return (
    <div className="space-y-4">
      {/* Task Context Selector */}
      <div className="space-y-2">
        <Label htmlFor="task-context" className="flex items-center">
          <Building className="ml-1 h-4 w-4 text-muted-foreground" />
          سياق المهمة
        </Label>
        <Select
          value={value.taskContext || 'individual'}
          onValueChange={(val) => handleContextChange(val as TaskContext)}
          disabled={disabled}
        >
          <SelectTrigger id="task-context" className="w-full">
            <SelectValue placeholder="اختر سياق المهمة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="individual">
              <div className="flex items-center">
                <User className="ml-2 h-4 w-4" />
                <span>فرد</span>
              </div>
            </SelectItem>
            {canAssignToOthers && (
              <SelectItem value="department">
                <div className="flex items-center">
                  <Users className="ml-2 h-4 w-4" />
                  <span>قسم</span>
                </div>
              </SelectItem>
            )}
            {canAssignToOthers && (
              <SelectItem value="organization">
                <div className="flex items-center">
                  <Building className="ml-2 h-4 w-4" />
                  <span>مؤسسة</span>
                </div>
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Department Selector (visible only when context is department) */}
      {value.taskContext === 'department' && (
        <div className="space-y-2">
          <Label htmlFor="department-select" className="flex items-center">
            <Users className="ml-1 h-4 w-4 text-muted-foreground" />
            القسم
          </Label>
          {loadingDepartments ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select
              value={value.departmentId || 'none'}
              onValueChange={handleDepartmentChange}
              disabled={disabled || departments.length === 0}
            >
              <SelectTrigger id="department-select" className="w-full">
                <SelectValue placeholder={departments.length === 0 ? "لا توجد أقسام" : "اختر القسم"} />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.id}>
                    {dept.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* User Selector (visible only when context is individual and user can assign to others) */}
      {value.taskContext === 'individual' && canAssignToOthers && (
        <div className="space-y-2">
          <Label htmlFor="user-select" className="flex items-center">
            <User className="ml-1 h-4 w-4 text-muted-foreground" />
            تعيين إلى
          </Label>
          {loadingMembers ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select
              value={value.assignedToUserId || 'none'}
              onValueChange={handleAssignedUserChange}
              disabled={disabled || members.length === 0}
            >
              <SelectTrigger id="user-select" className="w-full">
                <SelectValue placeholder={members.length === 0 ? "لا يوجد أعضاء" : "اختر العضو"} />
              </SelectTrigger>
              <SelectContent>
                {members.map((member) => (
                  <SelectItem key={member.uid} value={member.uid}>
                    {member.name} ({member.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* رسالة للأدوار المتدنية */}
      {value.taskContext === 'individual' && !canAssignToOthers && (
        <div className="text-sm text-muted-foreground p-3 bg-muted rounded-md">
          <User className="inline ml-1 h-4 w-4" />
          ستتم إضافة هذه المهمة إلى مهامك الشخصية
        </div>
      )}
    </div>
  );
}
