'use client';

import { useState, useEffect } from 'react';
import {
  DEFAULT_ROLE_PERMISSIONS,
  PermissionAction,
  PermissionArea,
  PermissionKey,
  UserRole,
  keyToPermission,
  permissionToKey
} from '@/types/roles';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { AlertCircle, CheckCircle2, Info, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

interface PermissionsManagerProps {
  role: UserRole;
  customPermissions?: PermissionKey[];
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

export function PermissionsManager({
  role,
  customPermissions = [],
  onPermissionsChange,
  readOnly = false
}: PermissionsManagerProps) {
  // Get default permissions for the role
  const defaultPermissions = DEFAULT_ROLE_PERMISSIONS[role] || [];

  // State for current permissions
  const [permissions, setPermissions] = useState<PermissionKey[]>(
    customPermissions.length > 0 ? customPermissions : [...defaultPermissions]
  );

  // State for tracking if permissions are customized
  const [isCustomized, setIsCustomized] = useState(customPermissions.length > 0);

  // State for active tab
  const [activeTab, setActiveTab] = useState<PermissionArea>('users');

  // Update permissions when role changes
  useEffect(() => {
    if (!isCustomized) {
      setPermissions(DEFAULT_ROLE_PERMISSIONS[role] || []);
    }
  }, [role, isCustomized]);

  // Check if a permission is granted
  const hasPermission = (area: PermissionArea, action: PermissionAction): boolean => {
    const key = permissionToKey({ area, action });
    return permissions.includes(key);
  };

  // Toggle a permission
  const togglePermission = (area: PermissionArea, action: PermissionAction) => {
    if (readOnly) return;

    const key = permissionToKey({ area, action });
    const newPermissions = hasPermission(area, action)
      ? permissions.filter(p => p !== key)
      : [...permissions, key];

    setPermissions(newPermissions);
    setIsCustomized(true);

    if (onPermissionsChange) {
      onPermissionsChange(newPermissions);
    }
  };

  // Reset to default permissions
  const resetToDefault = () => {
    if (readOnly) return;

    const defaultPerms = DEFAULT_ROLE_PERMISSIONS[role] || [];
    setPermissions(defaultPerms);
    setIsCustomized(false);

    if (onPermissionsChange) {
      onPermissionsChange(defaultPerms);
    }
  };

  // All available actions
  const actions: PermissionAction[] = ['view', 'create', 'edit', 'delete', 'approve', 'assign'];

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>إدارة الصلاحيات</CardTitle>
            <CardDescription>تحديد الصلاحيات المسموح بها للمستخدم</CardDescription>
          </div>
          {isCustomized && (
            <Badge variant="outline" className="gap-1">
              <Info className="h-3 w-3" />
              صلاحيات مخصصة
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isCustomized && !readOnly && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>تم تخصيص الصلاحيات</AlertTitle>
            <AlertDescription className="flex justify-between items-center">
              <span>تم تعديل الصلاحيات عن الإعدادات الافتراضية للدور.</span>
              <Button
                variant="outline"
                size="sm"
                onClick={resetToDefault}
                className="gap-1"
              >
                <RefreshCw className="h-3 w-3" />
                إعادة للافتراضي
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as PermissionArea)}>
          <TabsList className="grid grid-cols-3 md:grid-cols-6 mb-4">
            {Object.entries(areaLabels).map(([area, label]) => (
              <TabsTrigger key={area} value={area} className="text-xs">
                {label}
              </TabsTrigger>
            ))}
          </TabsList>

          {Object.entries(areaLabels).map(([area, label]) => (
            <TabsContent key={area} value={area} className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {actions.map((action) => (
                  <div key={`${area}-${action}`} className="flex items-center space-x-2 space-x-reverse">
                    <Checkbox
                      id={`${area}-${action}`}
                      checked={hasPermission(area as PermissionArea, action)}
                      onCheckedChange={() => togglePermission(area as PermissionArea, action)}
                      disabled={readOnly}
                    />
                    <Label
                      htmlFor={`${area}-${action}`}
                      className={`text-sm ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      {actionLabels[action]}
                    </Label>
                  </div>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
