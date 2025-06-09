'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Users, Activity, User, Building } from 'lucide-react';
import { UserRole } from '@/types/roles';

interface MembersStatsProps {
  stats: {
    total: number;
    active: number;
    individuals: number;
    inDepartments: number;
    byRole: Record<UserRole, number>;
  };
}

export function MembersStats({ stats }: MembersStatsProps) {
  return (
    <div className="grid gap-responsive-3 grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 mb-6 w-full">
      <Card className="hover:shadow-md transition-shadow w-full">
        <CardContent className="p-responsive-3 text-center w-full">
          <div className="flex items-center justify-center mb-responsive-2">
            <Users className="h-6 w-6 text-blue-600" />
          </div>
          <div className="text-responsive-xl font-bold text-blue-600">{stats.total}</div>
          <div className="text-responsive-sm text-muted-foreground">إجمالي الأعضاء</div>
        </CardContent>
      </Card>
      
      <Card className="hover:shadow-md transition-shadow w-full">
        <CardContent className="p-responsive-3 text-center w-full">
          <div className="flex items-center justify-center mb-responsive-2">
            <Activity className="h-6 w-6 text-green-600" />
          </div>
          <div className="text-responsive-xl font-bold text-green-600">{stats.active}</div>
          <div className="text-responsive-sm text-muted-foreground">الأعضاء النشطين</div>
        </CardContent>
      </Card>

      <Card className="hover:shadow-md transition-shadow w-full">
        <CardContent className="p-responsive-3 text-center w-full">
          <div className="flex items-center justify-center mb-responsive-2">
            <User className="h-6 w-6 text-orange-600" />
          </div>
          <div className="text-responsive-xl font-bold text-orange-600">{stats.individuals}</div>
          <div className="text-responsive-sm text-muted-foreground">أفراد</div>
        </CardContent>
      </Card>

      <Card className="hover:shadow-md transition-shadow w-full">
        <CardContent className="p-responsive-3 text-center w-full">
          <div className="flex items-center justify-center mb-responsive-2">
            <Building className="h-6 w-6 text-purple-600" />
          </div>
          <div className="text-responsive-xl font-bold text-purple-600">{stats.inDepartments}</div>
          <div className="text-responsive-sm text-muted-foreground">في أقسام</div>
        </CardContent>
      </Card>
    </div>
  );
}
