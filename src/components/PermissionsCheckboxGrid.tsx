'use client';

import { useState, useEffect } from 'react';
import {
  PermissionAction,
  PermissionArea,
  PermissionKey,
  permissionToKey
} from '@/types/roles';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Separator } from './ui/separator';

interface PermissionsCheckboxGridProps {
  permissions: PermissionKey[];
  onPermissionsChange?: (permissions: PermissionKey[]) => void;
  readOnly?: boolean;
}

// Translate permission areas to Arabic
const areaLabels: Record<PermissionArea, string> = {
  users: 'المستخدمين',
  tasks: 'المهام',
  reports: 'التقارير',
  settings: 'الإعدادات',
  tools: 'الأدوات',
  dashboard: 'لوحة المعلومات',
  data: 'إدارة البيانات'
};

// Translate permission actions to Arabic
const actionLabels: Record<PermissionAction, string> = {
  view: 'عرض',
  create: 'إنشاء',
  edit: 'تعديل',
  delete: 'حذف',
  approve: 'اعتماد',
  assign: 'تعيين'
};

// Colors for different permission areas
const areaColors: Record<PermissionArea, string> = {
  users: 'bg-blue-50 border-blue-200',
  tasks: 'bg-green-50 border-green-200',
  reports: 'bg-amber-50 border-amber-200',
  settings: 'bg-purple-50 border-purple-200',
  tools: 'bg-cyan-50 border-cyan-200',
  dashboard: 'bg-indigo-50 border-indigo-200',
  data: 'bg-rose-50 border-rose-200'
};

export function PermissionsCheckboxGrid({
  permissions = [],
  onPermissionsChange,
  readOnly = false
}: PermissionsCheckboxGridProps) {
  const [selectedPermissions, setSelectedPermissions] = useState<PermissionKey[]>(permissions);

  // Update permissions when props change
  useEffect(() => {
    setSelectedPermissions(permissions);
  }, [permissions]);

  // Check if a permission is granted
  const hasPermission = (area: PermissionArea, action: PermissionAction): boolean => {
    const key = permissionToKey({ area, action });
    return selectedPermissions.includes(key);
  };

  // Toggle a permission
  const togglePermission = (area: PermissionArea, action: PermissionAction) => {
    if (readOnly) return;

    const key = permissionToKey({ area, action });
    const newPermissions = hasPermission(area, action)
      ? selectedPermissions.filter(p => p !== key)
      : [...selectedPermissions, key];

    setSelectedPermissions(newPermissions);

    if (onPermissionsChange) {
      onPermissionsChange(newPermissions);
    }
  };

  // All available actions
  const actions: PermissionAction[] = ['view', 'create', 'edit', 'delete', 'approve', 'assign'];

  // All available areas
  const areas: PermissionArea[] = ['users', 'tasks', 'reports', 'settings', 'tools', 'dashboard', 'data'];

  // Group permissions by area
  const permissionsByArea = areas.reduce((acc, area) => {
    acc[area] = actions.map(action => ({
      area,
      action,
      key: permissionToKey({ area, action })
    }));
    return acc;
  }, {} as Record<PermissionArea, { area: PermissionArea; action: PermissionAction; key: PermissionKey }[]>);

  // Split areas into two columns
  const leftAreas = areas.filter((_, index) => index % 2 === 0);
  const rightAreas = areas.filter((_, index) => index % 2 === 1);

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* العمود الأيمن */}
        <div className="space-y-4">
          {leftAreas.map(area => (
            <Card key={area} className={`border-2 ${areaColors[area]}`}>
              <CardContent className="p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-sm">{areaLabels[area]}</h3>
                  <Badge variant="outline" className="text-xs">
                    {permissionsByArea[area].filter(({ area: a, action: act }) =>
                      hasPermission(a, act)).length} / {permissionsByArea[area].length}
                  </Badge>
                </div>
                <Separator className="mb-3" />
                <div className="grid grid-cols-2 gap-2">
                  {permissionsByArea[area].map(({ action, key }) => (
                    <div key={key} className="flex items-center space-x-2 space-x-reverse">
                      <Checkbox
                        id={key}
                        checked={selectedPermissions.includes(key)}
                        onCheckedChange={() => togglePermission(area, action)}
                        disabled={readOnly}
                      />
                      <Label
                        htmlFor={key}
                        className={`text-xs ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        {actionLabels[action]}
                      </Label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* العمود الأيسر */}
        <div className="space-y-4">
          {rightAreas.map(area => (
            <Card key={area} className={`border-2 ${areaColors[area]}`}>
              <CardContent className="p-4">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-sm">{areaLabels[area]}</h3>
                  <Badge variant="outline" className="text-xs">
                    {permissionsByArea[area].filter(({ area: a, action: act }) =>
                      hasPermission(a, act)).length} / {permissionsByArea[area].length}
                  </Badge>
                </div>
                <Separator className="mb-3" />
                <div className="grid grid-cols-2 gap-2">
                  {permissionsByArea[area].map(({ action, key }) => (
                    <div key={key} className="flex items-center space-x-2 space-x-reverse">
                      <Checkbox
                        id={key}
                        checked={selectedPermissions.includes(key)}
                        onCheckedChange={() => togglePermission(area, action)}
                        disabled={readOnly}
                      />
                      <Label
                        htmlFor={key}
                        className={`text-xs ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        {actionLabels[action]}
                      </Label>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
