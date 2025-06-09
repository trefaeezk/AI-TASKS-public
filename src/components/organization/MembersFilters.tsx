'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Translate } from '@/components/Translate';
import { Search, Filter, Crown, ShieldAlert, Shield, ShieldCheck, ShieldQuestion, UserCog, Settings } from 'lucide-react';
import { UserRole, ROLE_HIERARCHY } from '@/types/roles';

interface Department {
  id: string;
  name: string;
  membersCount?: number; // عدد الأعضاء في القسم
}

interface MembersFiltersProps {
  searchTerm: string;
  selectedRole: UserRole | 'all';
  selectedDepartment: string;
  departments: Department[];
  availableRoles: UserRole[]; // الأدوار الموجودة فعلاً في المؤسسة
  roleStats: Record<UserRole, number>; // إحصائيات الأدوار
  individualsCount: number; // عدد الأفراد بدون قسم
  isOwner: boolean;
  filteredCount: number;
  totalCount: number;
  onSearchChange: (value: string) => void;
  onRoleChange: (value: UserRole | 'all') => void;
  onDepartmentChange: (value: string) => void;
  onReset: () => void;
}

// Map roles to icons
const roleIcons: Record<UserRole, React.ReactNode> = {
  isSystemOwner: <Crown className="h-3 w-3" />,
  isSystemAdmin: <ShieldAlert className="h-3 w-3" />,
  isIndependent: <UserCog className="h-3 w-3" />,
  isOrgOwner: <Crown className="h-3 w-3" />,
  isOrgAdmin: <ShieldAlert className="h-3 w-3" />,
  isOrgSupervisor: <Shield className="h-3 w-3" />,
  isOrgEngineer: <ShieldCheck className="h-3 w-3" />,
  isOrgTechnician: <Settings className="h-3 w-3" />,
  isOrgAssistant: <ShieldQuestion className="h-3 w-3" />
};

export function MembersFilters({
  searchTerm,
  selectedRole,
  selectedDepartment,
  departments,
  availableRoles,
  roleStats,
  individualsCount,
  isOwner,
  filteredCount,
  totalCount,
  onSearchChange,
  onRoleChange,
  onDepartmentChange,
  onReset
}: MembersFiltersProps) {
  const hasActiveFilters = searchTerm || selectedRole !== 'all' || selectedDepartment !== 'all';

  return (
    <>
      {/* شريط البحث والفلاتر */}
      <Card className="mb-6 w-full">
        <CardContent className="p-4 w-full">
          <div className="flex flex-col gap-responsive-3">
            <div className="w-full">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="البحث في الأعضاء..."
                  value={searchTerm}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pr-10 w-full text-responsive-base"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-responsive-2">
              <Select value={selectedRole} onValueChange={onRoleChange}>
                <SelectTrigger className="w-full sm:min-w-0 sm:flex-1 text-responsive-sm">
                  <SelectValue placeholder="الدور" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الأدوار ({totalCount})</SelectItem>
                  {/* عرض الأدوار الموجودة فعلاً في المؤسسة مرتبة حسب التسلسل الهرمي */}
                  {ROLE_HIERARCHY.filter(role => availableRoles.includes(role)).map((role) => (
                    <SelectItem key={role} value={role}>
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          {roleIcons[role]}
                          <Translate text={`roles.${role}`} />
                        </div>
                        <span className="text-xs text-muted-foreground ml-2">
                          ({roleStats[role] || 0})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={selectedDepartment} onValueChange={onDepartmentChange}>
                <SelectTrigger className="w-full sm:min-w-0 sm:flex-1 text-responsive-sm">
                  <SelectValue placeholder="القسم" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الأقسام ({totalCount})</SelectItem>
                  <SelectItem value="none">
                    <div className="flex items-center justify-between w-full">
                      <span>بدون قسم</span>
                      <span className="text-xs text-muted-foreground ml-2">
                        ({individualsCount})
                      </span>
                    </div>
                  </SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      <div className="flex items-center justify-between w-full">
                        <span>{dept.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                          ({dept.membersCount || 0})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onReset}
                  className="flex items-center gap-responsive-1 w-full sm:w-auto sm:flex-shrink-0 text-responsive-sm"
                >
                  <Filter className="h-4 w-4" />
                  إعادة تعيين
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* مؤشر النتائج المفلترة */}
      {hasActiveFilters && (
        <div className="mb-responsive-3 p-responsive-2 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex flex-col gap-responsive-2">
            <div className="flex items-center gap-responsive-1 text-blue-800">
              <Filter className="h-4 w-4 flex-shrink-0" />
              <span className="text-responsive-sm font-medium">
                عرض {filteredCount} من أصل {totalCount} عضو
              </span>
            </div>
            <div className="flex flex-wrap gap-responsive-1">
              {searchTerm && (
                <Badge variant="outline" className="text-responsive-xs">
                  البحث: <span className="truncate max-w-20">{searchTerm}</span>
                </Badge>
              )}
              {selectedRole !== 'all' && (
                <Badge variant="outline" className="text-responsive-xs">
                  الدور: <Translate text={`roles.${selectedRole}`} />
                </Badge>
              )}
              {selectedDepartment !== 'all' && (
                <Badge variant="outline" className="text-responsive-xs">
                  القسم: <span className="truncate max-w-20">
                    {selectedDepartment === 'none' ? 'بدون قسم' : departments.find(d => d.id === selectedDepartment)?.name}
                  </span>
                </Badge>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
