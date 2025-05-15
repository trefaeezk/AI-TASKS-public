'use client';

// منع التوليد المسبق للصفحة
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Settings, Users, FolderTree, Building } from 'lucide-react';
import { OrganizationMembers } from '@/components/organization/OrganizationMembers';
import { OrganizationDepartments } from '@/components/organization/OrganizationDepartments';
import { OrganizationSettings } from '@/components/organization/OrganizationSettings';

export default function OrganizationPage() {
  const { user, userClaims } = useAuth();
  const { loading: permissionsLoading } = usePermissions();

  // استخدام نظام الصلاحيات الحقيقي
  const { hasPermission: checkPermission } = usePermissions();

  // دالة للتحقق من الصلاحيات
  const hasPermission = (permission: string) => {
    return checkPermission(permission);
  };
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [organizationData, setOrganizationData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState('members');

  // التحقق من صلاحيات المستخدم
  const hasViewPermission = hasPermission('organization.view');
  const hasManagePermission = hasPermission('organization.manage');
  const isOwner = userClaims?.owner === true;
  const isAdmin = userClaims?.admin === true;
  const organizationId = userClaims?.organizationId;

  useEffect(() => {
    const fetchOrganizationData = async () => {
      if (!user || !organizationId) {
        setLoading(false);
        return;
      }

      try {
        // الحصول على رمز المصادقة للمستخدم الحالي
        const idToken = await user.getIdToken();

        // جلب بيانات المؤسسة
        const response = await fetch(`https://us-central1-tasks-intelligence.cloudfunctions.net/getOrganizationHttp?orgId=${organizationId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });

        if (!response.ok) {
          throw new Error(`فشل في جلب بيانات المؤسسة: ${await response.text()}`);
        }

        const data = await response.json();
        setOrganizationData(data.organization);
      } catch (error) {
        console.error('Error fetching organization data:', error);
        toast({
          title: 'خطأ في جلب بيانات المؤسسة',
          description: error instanceof Error ? error.message : 'حدث خطأ غير معروف',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchOrganizationData();
  }, [user, organizationId, toast]);

  // عرض حالة التحميل
  if (permissionsLoading || loading) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardHeader className="pb-2">
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // التحقق من صلاحيات المستخدم
  if (!hasViewPermission && !isOwner && !isAdmin) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xl flex items-center">
              <AlertCircle className="ml-2 h-5 w-5 text-destructive" />
              غير مصرح
            </CardTitle>
            <CardDescription>
              ليس لديك صلاحية للوصول إلى هذه الصفحة.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // التحقق من وجود معرف المؤسسة
  if (!organizationId) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xl flex items-center">
              <AlertCircle className="ml-2 h-5 w-5 text-destructive" />
              غير متاح
            </CardTitle>
            <CardDescription>
              أنت لست عضوًا في أي مؤسسة.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center">
          <Building className="ml-2 h-6 w-6" />
          إدارة المؤسسة
          {organizationData && <span className="mr-2 text-muted-foreground">({organizationData.name})</span>}
        </h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="members" className="flex items-center">
            <Users className="ml-2 h-4 w-4" />
            الأعضاء
          </TabsTrigger>
          <TabsTrigger value="departments" className="flex items-center">
            <FolderTree className="ml-2 h-4 w-4" />
            الأقسام
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center">
            <Settings className="ml-2 h-4 w-4" />
            الإعدادات
          </TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-4">
          <OrganizationMembers
            organizationId={organizationId}
            isOwner={isOwner}
            isAdmin={isAdmin}
          />
        </TabsContent>

        <TabsContent value="departments" className="mt-4">
          <OrganizationDepartments
            organizationId={organizationId}
            isOwner={isOwner}
            isAdmin={isAdmin}
          />
        </TabsContent>

        <TabsContent value="settings" className="mt-4">
          <OrganizationSettings
            organizationId={organizationId}
            organizationData={organizationData}
            isOwner={isOwner}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
