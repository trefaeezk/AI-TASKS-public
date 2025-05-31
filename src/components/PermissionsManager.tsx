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

  // State for current permissions (المخصصة تبدأ فارغة، الافتراضي حسب الدور)
  const [permissions, setPermissions] = useState<PermissionKey[]>(
    customPermissions && customPermissions.length > 0 ? customPermissions : [...defaultPermissions]
  );

  // State for tracking if permissions are customized
  const [isCustomized, setIsCustomized] = useState(customPermissions && customPermissions.length > 0);

  // Update permissions when role or customPermissions change
  useEffect(() => {
    if (customPermissions && customPermissions.length > 0) {
      setPermissions(customPermissions);
      setIsCustomized(true);
    } else {
      setPermissions([...defaultPermissions]);
      setIsCustomized(false);
    }
  }, [role, customPermissions, defaultPermissions]);

  // Update permissions when customPermissions prop changes
  useEffect(() => {
    if (customPermissions.length > 0) {
      setPermissions(customPermissions);
      setIsCustomized(true);
    }
  }, [customPermissions]);

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

  // Reset to default permissions (الافتراضي حسب الدور)
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

  // All available areas
  const areas: PermissionArea[] = ['users', 'tasks', 'reports', 'settings', 'tools', 'dashboard', 'data'];

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
        {permissions.length > 0 && !readOnly && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>الصلاحيات المخصصة</AlertTitle>
            <AlertDescription className="flex justify-between items-center">
              <span>تم تخصيص {permissions.length} صلاحية لهذا المستخدم.</span>
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

        {permissions.length === 0 && (
          <Alert className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>لا توجد صلاحيات مخصصة</AlertTitle>
            <AlertDescription>
              لم يتم تخصيص أي صلاحيات لهذا المستخدم. يمكن للمدير إضافة الصلاحيات المطلوبة.
            </AlertDescription>
          </Alert>
        )}

        {/* عرض الصلاحيات في شكل شبكة */}
        <div className="grid grid-cols-1 gap-4">
          <Tabs defaultValue="users">
            <TabsList className="grid grid-cols-7 mb-4">
              {areas.map((area) => (
                <TabsTrigger key={area} value={area} className="text-xs">
                  {areaLabels[area]}
                </TabsTrigger>
              ))}
            </TabsList>

            {areas.map((area) => (
              <TabsContent key={area} value={area}>
                <div className="grid grid-cols-3 gap-2">
                  {actions.map((action) => (
                    <div key={`${area}-${action}`} className="flex items-center space-x-2 space-x-reverse">
                      <Checkbox
                        id={`${area}-${action}`}
                        checked={hasPermission(area, action)}
                        onCheckedChange={() => togglePermission(area, action)}
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
        </div>
      </CardContent>
    </Card>
  );
}
