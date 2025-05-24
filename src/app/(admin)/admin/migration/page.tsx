'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  RefreshCw, 
  Zap, 
  Users, 
  Building,
  ArrowRight,
  Info
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface MigrationStatus {
  totalOrganizations: number;
  migratedCount: number;
  notMigratedCount: number;
  organizations: Array<{
    id: string;
    name: string;
    migrated: boolean;
    migrationDate?: any;
    migratedBy?: string;
    membersCount: number;
    ownerId: string;
  }>;
}

interface MigrationResult {
  organizationId: string;
  organizationName: string;
  success: boolean;
  migratedMembers?: number;
  error?: string;
}

export default function MigrationPage() {
  const { user, userPermissions } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [status, setStatus] = useState<MigrationStatus | null>(null);
  const [migrationResults, setMigrationResults] = useState<MigrationResult[]>([]);

  // التحقق من الصلاحيات
  const canManageMigration = userPermissions?.some(p => 
    p === 'users:assign' || p === 'settings:edit'
  ) || user?.customClaims?.system_owner || user?.customClaims?.owner;

  // جلب حالة الترحيل
  const fetchMigrationStatus = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const functions = getFunctions();
      const checkMigrationStatusFn = httpsCallable<{}, { success: boolean; } & MigrationStatus>(
        functions, 
        'checkMigrationStatus'
      );
      
      const result = await checkMigrationStatusFn({});
      if (result.data.success) {
        setStatus(result.data);
      }
    } catch (error: any) {
      console.error('Error fetching migration status:', error);
      toast({
        title: 'خطأ في جلب حالة الترحيل',
        description: error.message || 'حدث خطأ أثناء جلب حالة الترحيل',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // ترحيل مؤسسة واحدة
  const migrateOrganization = async (organizationId: string) => {
    if (!user) return;

    try {
      const functions = getFunctions();
      const migrateFn = httpsCallable<
        { organizationId: string }, 
        { success: boolean; migratedMembers: any[]; totalMigrated: number }
      >(functions, 'migrateOrganizationToNewRoleSystem');
      
      const result = await migrateFn({ organizationId });
      
      if (result.data.success) {
        toast({
          title: 'تم ترحيل المؤسسة بنجاح',
          description: `تم ترحيل ${result.data.totalMigrated} عضو إلى النظام الجديد`,
        });
        
        // تحديث الحالة
        await fetchMigrationStatus();
      }
    } catch (error: any) {
      console.error('Error migrating organization:', error);
      toast({
        title: 'خطأ في ترحيل المؤسسة',
        description: error.message || 'حدث خطأ أثناء ترحيل المؤسسة',
        variant: 'destructive',
      });
    }
  };

  // ترحيل جميع المؤسسات
  const migrateAllOrganizations = async () => {
    if (!user) return;

    try {
      setMigrating(true);
      setMigrationResults([]);
      
      const functions = getFunctions();
      const migrateAllFn = httpsCallable<
        {}, 
        { success: boolean; totalOrganizations: number; results: MigrationResult[] }
      >(functions, 'migrateAllOrganizationsToNewRoleSystem');
      
      const result = await migrateAllFn({});
      
      if (result.data.success) {
        setMigrationResults(result.data.results);
        
        const successCount = result.data.results.filter(r => r.success).length;
        const failureCount = result.data.results.filter(r => !r.success).length;
        
        toast({
          title: 'تم الانتهاء من الترحيل',
          description: `نجح: ${successCount}، فشل: ${failureCount} من أصل ${result.data.totalOrganizations} مؤسسة`,
        });
        
        // تحديث الحالة
        await fetchMigrationStatus();
      }
    } catch (error: any) {
      console.error('Error migrating all organizations:', error);
      toast({
        title: 'خطأ في ترحيل المؤسسات',
        description: error.message || 'حدث خطأ أثناء ترحيل المؤسسات',
        variant: 'destructive',
      });
    } finally {
      setMigrating(false);
    }
  };

  useEffect(() => {
    if (user && canManageMigration) {
      fetchMigrationStatus();
    }
  }, [user, canManageMigration]);

  if (!canManageMigration) {
    return (
      <div className="container mx-auto p-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>غير مصرح</AlertTitle>
          <AlertDescription>
            ليس لديك الصلاحيات اللازمة للوصول إلى هذه الصفحة.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center">
            <Zap className="ml-2 h-6 w-6 text-yellow-500" />
            ترحيل النظام الجديد للأدوار
          </h1>
          <p className="text-muted-foreground mt-1">
            تطبيق نظام الأدوار والصلاحيات الجديد على المؤسسات الموجودة
          </p>
        </div>
        <Button 
          onClick={fetchMigrationStatus} 
          variant="outline" 
          size="sm"
          disabled={loading}
        >
          <RefreshCw className={`ml-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          تحديث
        </Button>
      </div>

      {/* معلومات النظام الجديد */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>حول النظام الجديد</AlertTitle>
        <AlertDescription>
          النظام الجديد يوفر أدوار أكثر تفصيلاً وصلاحيات مرنة:
          <br />
          • <strong>مالك النظام</strong> (system_owner) - أعلى صلاحية
          <br />
          • <strong>أدمن النظام</strong> (system_admin) - إدارة النظام العام
          <br />
          • <strong>مالك المؤسسة</strong> (organization_owner) - إدارة المؤسسة
          <br />
          • <strong>أدمن المؤسسة</strong> (admin) - إدارة المؤسسة
          <br />
          • <strong>مشرف، مهندس، فني، مساعد</strong> - أدوار متخصصة
        </AlertDescription>
      </Alert>

      {/* إحصائيات الترحيل */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-8 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : status ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">إجمالي المؤسسات</p>
                  <p className="text-2xl font-bold">{status.totalOrganizations}</p>
                </div>
                <Building className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">تم ترحيلها</p>
                  <p className="text-2xl font-bold text-green-600">{status.migratedCount}</p>
                </div>
                <CheckCircle2 className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">في انتظار الترحيل</p>
                  <p className="text-2xl font-bold text-orange-600">{status.notMigratedCount}</p>
                </div>
                <Clock className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* أزرار الترحيل */}
      {status && status.notMigratedCount > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>إجراءات الترحيل</CardTitle>
            <CardDescription>
              تطبيق النظام الجديد على المؤسسات التي لم يتم ترحيلها بعد
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={migrateAllOrganizations}
              disabled={migrating}
              className="w-full"
              size="lg"
            >
              {migrating ? (
                <>
                  <RefreshCw className="ml-2 h-4 w-4 animate-spin" />
                  جاري ترحيل جميع المؤسسات...
                </>
              ) : (
                <>
                  <Zap className="ml-2 h-4 w-4" />
                  ترحيل جميع المؤسسات ({status.notMigratedCount})
                </>
              )}
            </Button>
            
            <p className="text-sm text-muted-foreground text-center">
              سيتم ترحيل جميع المؤسسات والأعضاء إلى النظام الجديد تلقائياً
            </p>
          </CardContent>
        </Card>
      )}

      {/* قائمة المؤسسات */}
      {status && (
        <Card>
          <CardHeader>
            <CardTitle>المؤسسات</CardTitle>
            <CardDescription>
              حالة الترحيل لكل مؤسسة
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {status.organizations.map((org) => (
                <div 
                  key={org.id} 
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <Building className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{org.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {org.membersCount} عضو
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {org.migrated ? (
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        <CheckCircle2 className="ml-1 h-3 w-3" />
                        تم الترحيل
                      </Badge>
                    ) : (
                      <>
                        <Badge variant="secondary">
                          <Clock className="ml-1 h-3 w-3" />
                          في الانتظار
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => migrateOrganization(org.id)}
                          disabled={migrating}
                        >
                          <ArrowRight className="ml-1 h-3 w-3" />
                          ترحيل
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* نتائج الترحيل */}
      {migrationResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>نتائج الترحيل</CardTitle>
            <CardDescription>
              تفاصيل عملية الترحيل الأخيرة
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {migrationResults.map((result, index) => (
                <div 
                  key={index}
                  className={`flex items-center justify-between p-3 border rounded-lg ${
                    result.success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    {result.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                    )}
                    <div>
                      <p className="font-medium">{result.organizationName}</p>
                      {result.success ? (
                        <p className="text-sm text-green-600">
                          تم ترحيل {result.migratedMembers} عضو
                        </p>
                      ) : (
                        <p className="text-sm text-red-600">
                          {result.error}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <Badge 
                    variant={result.success ? "default" : "destructive"}
                    className={result.success ? "bg-green-100 text-green-800" : ""}
                  >
                    {result.success ? 'نجح' : 'فشل'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
