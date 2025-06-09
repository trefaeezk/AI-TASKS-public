'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Translate } from '@/components/Translate';
import { 
  Edit, 
  UserX, 
  Trash2, 
  Building, 
  User, 
  Calendar, 
  Activity,
  Crown,
  ShieldAlert,
  Shield,
  ShieldCheck,
  ShieldQuestion,
  UserCog,
  Settings
} from 'lucide-react';
import { UserRole } from '@/types/roles';
import { cn } from '@/lib/utils';

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

interface Department {
  id: string;
  name: string;
}

interface MemberCardProps {
  member: Member;
  departments: Department[];
  showActions?: boolean;
  isOwner?: boolean;
  isAdmin?: boolean;
  onEdit?: (member: Member) => void;
  onRemove?: (member: Member) => void;
  onDelete?: (member: Member) => void;
}

// Map roles to icons and colors (Dark mode compatible)
const roleConfig: Record<UserRole, { icon: React.ReactNode; color: string; bgColor: string }> = {
  isSystemOwner: {
    icon: <Crown className="h-4 w-4" />,
    color: 'text-purple-700 dark:text-purple-300',
    bgColor: 'bg-purple-100 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800'
  },
  isSystemAdmin: {
    icon: <ShieldAlert className="h-4 w-4" />,
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-100 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
  },
  isIndependent: {
    icon: <UserCog className="h-4 w-4" />,
    color: 'text-gray-700 dark:text-gray-300',
    bgColor: 'bg-gray-100 border-gray-200 dark:bg-gray-800/50 dark:border-gray-700'
  },
  isOrgOwner: {
    icon: <Crown className="h-4 w-4" />,
    color: 'text-orange-700 dark:text-orange-300',
    bgColor: 'bg-orange-100 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800'
  },
  isOrgAdmin: {
    icon: <ShieldAlert className="h-4 w-4" />,
    color: 'text-red-700 dark:text-red-300',
    bgColor: 'bg-red-100 border-red-200 dark:bg-red-900/20 dark:border-red-800'
  },
  isOrgSupervisor: {
    icon: <Shield className="h-4 w-4" />,
    color: 'text-green-700 dark:text-green-300',
    bgColor: 'bg-green-100 border-green-200 dark:bg-green-900/20 dark:border-green-800'
  },
  isOrgEngineer: {
    icon: <ShieldCheck className="h-4 w-4" />,
    color: 'text-teal-700 dark:text-teal-300',
    bgColor: 'bg-teal-100 border-teal-200 dark:bg-teal-900/20 dark:border-teal-800'
  },
  isOrgTechnician: {
    icon: <Settings className="h-4 w-4" />,
    color: 'text-indigo-700 dark:text-indigo-300',
    bgColor: 'bg-indigo-100 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800'
  },
  isOrgAssistant: {
    icon: <ShieldQuestion className="h-4 w-4" />,
    color: 'text-slate-700 dark:text-slate-300',
    bgColor: 'bg-slate-100 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700'
  }
};

export function MemberCard({ 
  member, 
  departments, 
  showActions = true, 
  isOwner = false, 
  isAdmin = false,
  onEdit,
  onRemove,
  onDelete
}: MemberCardProps) {
  const department = departments.find(d => d.id === member.departmentId);
  const roleInfo = roleConfig[member.role];
  
  return (
    <Card className={cn("hover:shadow-md transition-all duration-200 w-full", roleInfo.bgColor)}>
      <CardContent className="p-responsive-3 min-h-0">
        <div className="flex justify-between items-start gap-responsive-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-responsive-2 mb-responsive-2">
              <div className={cn("p-2 rounded-full flex-shrink-0", roleInfo.bgColor)}>
                <div className={roleInfo.color}>
                  {roleInfo.icon}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-responsive-lg truncate text-foreground">{member.name}</h3>
                <p className="text-responsive-sm text-muted-foreground truncate">{member.email}</p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-responsive-1 mb-responsive-2">
              <Badge variant="default" className={cn("text-responsive-xs", roleInfo.color, roleInfo.bgColor)}>
                {roleInfo.icon}
                <Translate text={`roles.${member.role}`} defaultValue={member.role} />
              </Badge>

              {department && (
                <Badge variant="outline" className="text-responsive-xs max-w-full">
                  <Building className="h-3 w-3 ml-1 flex-shrink-0" />
                  <span className="truncate">{department.name}</span>
                </Badge>
              )}

              {!member.departmentId && (
                <Badge variant="secondary" className="text-responsive-xs">
                  <User className="h-3 w-3 ml-1" />
                  <Translate text="organization.unassigned" />
                </Badge>
              )}

              <Badge variant={member.isActive ? "default" : "destructive"} className="text-responsive-xs">
                <Activity className="h-3 w-3 ml-1" />
                {member.isActive ? "نشط" : "غير نشط"}
              </Badge>
            </div>
            
            <div className="flex flex-col gap-responsive-1 text-responsive-xs text-muted-foreground">
              <div className="flex items-center gap-responsive-1">
                <Calendar className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">انضم: {member.joinedAt.toLocaleDateString('ar-SA')}</span>
              </div>
              {member.lastActivity && (
                <div className="flex items-center gap-responsive-1">
                  <Activity className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">آخر نشاط: {member.lastActivity.toLocaleDateString('ar-SA')}</span>
                </div>
              )}
            </div>
          </div>
          
          {showActions && (isOwner || isAdmin) && (
            <div className="flex flex-col sm:flex-row gap-responsive-1 ml-responsive-2 flex-shrink-0">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit?.(member)}
                className="h-8 w-8 p-0"
                title="تعديل العضو"
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRemove?.(member)}
                disabled={member.role === 'isOrgOwner' && !isOwner}
                title="إزالة من المؤسسة"
                className="h-8 w-8 p-0"
              >
                <UserX className="h-4 w-4 text-orange-600" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete?.(member)}
                disabled={member.role === 'isOrgOwner' && !isOwner}
                title="حذف المستخدم نهائياً"
                className="h-8 w-8 p-0"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
