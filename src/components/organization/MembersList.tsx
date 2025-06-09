'use client';

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Translate } from '@/components/Translate';
import { MemberCard } from './MemberCard';
import { Users, Shield, User, Building } from 'lucide-react';
import { UserRole, ROLE_HIERARCHY } from '@/types/roles';
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

interface MembersListProps {
  members: Member[];
  departments: Department[];
  activeTab: string;
  isOwner: boolean;
  isAdmin: boolean;
  searchTerm: string;
  selectedRole: UserRole | 'all';
  selectedDepartment: string;
  stats: {
    total: number;
    individuals: number;
    inDepartments: number;
    byRole: Record<UserRole, number>;
  };
  onTabChange: (value: string) => void;
  onEditMember: (member: Member) => void;
  onRemoveMember: (member: Member) => void;
  onDeleteMember: (member: Member) => void;
}

// Map roles to icons and colors for role sections (Dark mode compatible)
const roleConfig: Record<UserRole, { icon: React.ReactNode; color: string; bgColor: string }> = {
  isSystemOwner: {
    icon: <Shield className="h-4 w-4" />,
    color: 'text-purple-700 dark:text-purple-300',
    bgColor: 'bg-purple-100 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800'
  },
  isSystemAdmin: {
    icon: <Shield className="h-4 w-4" />,
    color: 'text-blue-700 dark:text-blue-300',
    bgColor: 'bg-blue-100 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
  },
  isIndependent: {
    icon: <User className="h-4 w-4" />,
    color: 'text-gray-700 dark:text-gray-300',
    bgColor: 'bg-gray-100 border-gray-200 dark:bg-gray-800/50 dark:border-gray-700'
  },
  isOrgOwner: {
    icon: <Shield className="h-4 w-4" />,
    color: 'text-orange-700 dark:text-orange-300',
    bgColor: 'bg-orange-100 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800'
  },
  isOrgAdmin: {
    icon: <Shield className="h-4 w-4" />,
    color: 'text-red-700 dark:text-red-300',
    bgColor: 'bg-red-100 border-red-200 dark:bg-red-900/20 dark:border-red-800'
  },
  isOrgSupervisor: {
    icon: <Shield className="h-4 w-4" />,
    color: 'text-green-700 dark:text-green-300',
    bgColor: 'bg-green-100 border-green-200 dark:bg-green-900/20 dark:border-green-800'
  },
  isOrgEngineer: {
    icon: <Shield className="h-4 w-4" />,
    color: 'text-teal-700 dark:text-teal-300',
    bgColor: 'bg-teal-100 border-teal-200 dark:bg-teal-900/20 dark:border-teal-800'
  },
  isOrgTechnician: {
    icon: <Shield className="h-4 w-4" />,
    color: 'text-indigo-700 dark:text-indigo-300',
    bgColor: 'bg-indigo-100 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800'
  },
  isOrgAssistant: {
    icon: <Shield className="h-4 w-4" />,
    color: 'text-slate-700 dark:text-slate-300',
    bgColor: 'bg-slate-100 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700'
  }
};

export function MembersList({
  members,
  departments,
  activeTab,
  isOwner,
  isAdmin,
  searchTerm,
  selectedRole,
  selectedDepartment,
  stats,
  onTabChange,
  onEditMember,
  onRemoveMember,
  onDeleteMember
}: MembersListProps) {
  
  // تجميع الأعضاء حسب الأدوار (مرتبة حسب التسلسل الهرمي)
  const membersByRole = ROLE_HIERARCHY.reduce((acc, role) => {
    const roleMembers = members.filter(m => m.role === role);
    if (roleMembers.length > 0) {
      acc[role] = roleMembers;
    }
    return acc;
  }, {} as Record<UserRole, Member[]>);

  // تجميع الأعضاء حسب الأقسام
  const membersByDepartment = members.reduce((acc, member) => {
    const deptKey = member.departmentId || 'none';
    if (!acc[deptKey]) acc[deptKey] = [];
    acc[deptKey].push(member);
    return acc;
  }, {} as Record<string, Member[]>);

  const EmptyState = ({ icon: Icon, title, description }: { 
    icon: React.ComponentType<any>; 
    title: string; 
    description: string; 
  }) => (
    <div className="text-center py-8 text-muted-foreground">
      <Icon className="mx-auto h-12 w-12 mb-4 opacity-50" />
      <p className="text-lg font-medium mb-2">{title}</p>
      <p className="text-sm">{description}</p>
    </div>
  );

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
      <div className="overflow-x-auto">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto p-1 gap-1 min-w-max">
        <TabsTrigger value="all" className="flex items-center justify-center gap-1 text-xs sm:text-sm px-2 py-2 h-auto min-h-[2.5rem] sm:min-h-[3rem]">
          <Users className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
          <span className="hidden xs:inline truncate">الكل</span>
          <Badge variant="secondary" className="text-[10px] px-1 ml-1">{stats.total}</Badge>
        </TabsTrigger>
        <TabsTrigger value="roles" className="flex items-center justify-center gap-1 text-xs sm:text-sm px-2 py-2 h-auto min-h-[2.5rem] sm:min-h-[3rem]">
          <Shield className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
          <span className="hidden xs:inline truncate">الأدوار</span>
          <Badge variant="secondary" className="text-[10px] px-1 ml-1">{Object.keys(stats.byRole).length}</Badge>
        </TabsTrigger>
        <TabsTrigger value="individuals" className="flex items-center justify-center gap-1 text-xs sm:text-sm px-2 py-2 h-auto min-h-[2.5rem] sm:min-h-[3rem]">
          <User className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
          <span className="hidden xs:inline truncate">أفراد</span>
          <Badge variant="secondary" className="text-[10px] px-1 ml-1">{stats.individuals}</Badge>
        </TabsTrigger>
        <TabsTrigger value="departments" className="flex items-center justify-center gap-1 text-xs sm:text-sm px-2 py-2 h-auto min-h-[2.5rem] sm:min-h-[3rem]">
          <Building className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
          <span className="hidden xs:inline truncate">أقسام</span>
          <Badge variant="secondary" className="text-[10px] px-1 ml-1">{stats.inDepartments}</Badge>
        </TabsTrigger>
        </TabsList>
      </div>

      {/* 📋 جميع الأعضاء */}
      <TabsContent value="all" className="mt-6">
        {members.length === 0 ? (
          <EmptyState
            icon={Users}
            title="لا يوجد أعضاء"
            description={
              searchTerm || selectedRole !== 'all' || selectedDepartment !== 'all' 
                ? "جرب تغيير معايير البحث أو الفلاتر"
                : "لا يوجد أعضاء في المؤسسة حالياً"
            }
          />
        ) : (
          <div className="grid gap-responsive-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 w-full">
            {members.map((member) => (
              <MemberCard 
                key={member.uid} 
                member={member} 
                departments={departments}
                isOwner={isOwner}
                isAdmin={isAdmin}
                onEdit={onEditMember}
                onRemove={onRemoveMember}
                onDelete={onDeleteMember}
              />
            ))}
          </div>
        )}
      </TabsContent>

      {/* 📋 تبويب الأدوار */}
      <TabsContent value="roles" className="mt-6">
        {Object.keys(membersByRole).length === 0 ? (
          <EmptyState
            icon={Shield}
            title="لا توجد أدوار"
            description="لا يوجد أعضاء يطابقون معايير البحث"
          />
        ) : (
          <div className="space-y-6">
            {Object.entries(membersByRole).map(([role, roleMembers]) => {
              const roleInfo = roleConfig[role as UserRole];
              return (
                <div key={role}>
                  <div className={cn("flex items-center gap-3 mb-4 p-3 rounded-lg", roleInfo.bgColor)}>
                    <div className={roleInfo.color}>
                      {roleInfo.icon}
                    </div>
                    <h3 className="text-lg font-semibold">
                      <Translate text={`roles.${role}`} defaultValue={role} />
                    </h3>
                    <Badge variant="secondary">{roleMembers.length}</Badge>
                  </div>
                  <div className="grid gap-responsive-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 w-full">
                    {roleMembers.map((member) => (
                      <MemberCard
                        key={member.uid}
                        member={member}
                        departments={departments}
                        isOwner={isOwner}
                        isAdmin={isAdmin}
                        onEdit={onEditMember}
                        onRemove={onRemoveMember}
                        onDelete={onDeleteMember}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </TabsContent>

      {/* 👥 تبويب الأفراد */}
      <TabsContent value="individuals" className="mt-6">
        {members.filter(m => !m.departmentId).length === 0 ? (
          <EmptyState
            icon={User}
            title="لا يوجد أفراد"
            description="جميع الأعضاء معينون إلى أقسام"
          />
        ) : (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 dark:bg-blue-900/20 dark:border-blue-800">
              <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                <User className="h-5 w-5" />
                <span className="font-medium">
                  <Translate text="organization.membersWithoutDepartment" />
                </span>
              </div>
              <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">
                <Translate text="organization.canAssignToDepartment" />
              </p>
            </div>
            <div className="grid gap-responsive-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 w-full">
              {members.filter(m => !m.departmentId).map((member) => (
                <MemberCard
                  key={member.uid}
                  member={member}
                  departments={departments}
                  isOwner={isOwner}
                  isAdmin={isAdmin}
                  onEdit={onEditMember}
                  onRemove={onRemoveMember}
                  onDelete={onDeleteMember}
                />
              ))}
            </div>
          </div>
        )}
      </TabsContent>

      {/* 🏢 تبويب أعضاء الأقسام */}
      <TabsContent value="departments" className="mt-6">
        {members.filter(m => m.departmentId).length === 0 ? (
          <EmptyState
            icon={Building}
            title="لا يوجد أعضاء في الأقسام"
            description="قم بتعيين الأعضاء إلى أقسام"
          />
        ) : (
          <div className="space-y-6">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 dark:bg-green-900/20 dark:border-green-800">
              <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
                <Building className="h-5 w-5" />
                <span className="font-medium">
                  <Translate text="organization.departmentMembers" />
                </span>
              </div>
              <p className="text-sm text-green-600 dark:text-green-300 mt-1">
                <Translate text="organization.membersAssignedToDepartments" />
              </p>
            </div>
            
            {Object.entries(membersByDepartment)
              .filter(([deptId]) => deptId !== 'none')
              .map(([deptId, deptMembers]) => {
                const department = departments.find(d => d.id === deptId);
                return (
                  <div key={deptId}>
                    <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-green-100 border border-green-200 dark:bg-green-900/20 dark:border-green-800">
                      <Building className="h-5 w-5 text-green-700 dark:text-green-300" />
                      <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
                        {department?.name || (
                          <Translate text="organization.unknownDepartment" />
                        )}
                      </h3>
                      <Badge variant="secondary">{deptMembers.length}</Badge>
                    </div>
                    <div className="grid gap-responsive-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 w-full">
                      {deptMembers.map((member) => (
                        <MemberCard
                          key={member.uid}
                          member={member}
                          departments={departments}
                          isOwner={isOwner}
                          isAdmin={isAdmin}
                          onEdit={onEditMember}
                          onRemove={onRemoveMember}
                          onDelete={onDeleteMember}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
