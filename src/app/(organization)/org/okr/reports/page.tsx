'use client';

/**
 * صفحة تقارير OKR
 *
 * تعرض هذه الصفحة تقارير وإحصائيات نظام الأهداف والنتائج الرئيسية (OKR).
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useAccountType } from '@/hooks/useAccountType';
import { usePermissions } from '@/hooks/usePermissions';
import { functions } from '@/config/firebase';
import { httpsCallable } from 'firebase/functions';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  BarChart3,
  FileText,
  Target,
  Calendar,
  Download,
  Users,
  Building2,
  AlertTriangle
} from 'lucide-react';
import Link from 'next/link';
import { OkrProgressChart } from '@/components/okr/OkrProgressChart';
import { OkrStatusDistribution } from '@/components/okr/OkrStatusDistribution';
import { OkrCompletionRate } from '@/components/okr/OkrCompletionRate';
import { OkrPeriodSelector } from '@/components/okr/OkrPeriodSelector';
import { OkrDepartmentSelector } from '@/components/okr/OkrDepartmentSelector';
import { OkrReportExport } from '@/components/okr/OkrReportExport';
import { OkrExcelExport } from '@/components/okr/OkrExcelExport';

// نوع فترة OKR
interface OkrPeriod {
  id: string;
  title: string;
  startDate: { seconds: number; nanoseconds: number };
  endDate: { seconds: number; nanoseconds: number };
  status: 'active' | 'completed' | 'planned';
  organizationId: string;
}

// نوع الهدف
interface Objective {
  id: string;
  title: string;
  description?: string;
  periodId: string;
  departmentId?: string;
  departmentName?: string;
  ownerId: string;
  ownerName: string;
  progress: number;
  status: 'active' | 'completed' | 'at_risk' | 'behind';
  organizationId: string;
}

// نوع النتيجة الرئيسية
interface KeyResult {
  id: string;
  objectiveId: string;
  title: string;
  description?: string;
  type: 'numeric' | 'percentage' | 'boolean' | 'currency';
  startValue: number;
  targetValue: number;
  currentValue: number;
  unit?: string;
  progress: number;
  status: 'active' | 'completed' | 'at_risk' | 'behind';
  dueDate: { seconds: number; nanoseconds: number };
  ownerId: string;
  ownerName: string;
  organizationId: string;
}

// نوع القسم
interface Department {
  id: string;
  name: string;
  organizationId: string;
}

// نوع إحصائيات OKR
interface OkrStats {
  totalObjectives: number;
  completedObjectives: number;
  atRiskObjectives: number;
  behindObjectives: number;
  totalKeyResults: number;
  completedKeyResults: number;
  atRiskKeyResults: number;
  behindKeyResults: number;
  averageProgress: number;
  departmentStats: {
    [departmentId: string]: {
      name: string;
      progress: number;
      totalObjectives: number;
      completedObjectives: number;
    };
  };
}

export default function OkrReportsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { organizationId, isOrganization, isLoading: isLoadingAccountType } = useAccountType();
  const { hasPermission, role, loading: isLoadingPermissions } = usePermissions();
  const { toast } = useToast();

  const [periods, setPeriods] = useState<OkrPeriod[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState<string>('');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('all');
  const [stats, setStats] = useState<OkrStats | null>(null);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [keyResults, setKeyResults] = useState<KeyResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // التحقق من الصلاحيات
  const canViewReports = role === 'owner' || role === 'admin' || hasPermission('reports.view');

  // جلب فترات OKR والأقسام
  useEffect(() => {
    if (!user || !isOrganization || !organizationId || isLoadingAccountType || isLoadingPermissions) {
      return;
    }

    const fetchInitialData = async () => {
      try {
        setLoading(true);

        // جلب فترات OKR
        const getOkrPeriods = httpsCallable<{ organizationId: string }, { periods: OkrPeriod[] }>(
          functions,
          'getOkrPeriods'
        );

        const periodsResult = await getOkrPeriods({ organizationId });
        const fetchedPeriods = periodsResult.data.periods || [];
        setPeriods(fetchedPeriods);

        // تعيين الفترة النشطة افتراضيًا
        const activePeriod = fetchedPeriods.find(p => p.status === 'active');
        if (activePeriod) {
          setSelectedPeriodId(activePeriod.id);
        } else if (fetchedPeriods.length > 0) {
          setSelectedPeriodId(fetchedPeriods[0].id);
        }

        // جلب الأقسام
        const getDepartments = httpsCallable<{ organizationId: string }, { departments: Department[] }>(
          functions,
          'getDepartments'
        );

        const departmentsResult = await getDepartments({ organizationId });
        setDepartments(departmentsResult.data.departments || []);
      } catch (error) {
        console.error('Error fetching initial data:', error);
        toast({
          title: 'خطأ',
          description: 'حدث خطأ أثناء جلب البيانات الأولية',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [user, isOrganization, organizationId, isLoadingAccountType, isLoadingPermissions]);

  // جلب إحصائيات OKR عند تغيير الفترة أو القسم
  useEffect(() => {
    if (!selectedPeriodId || !organizationId) {
      return;
    }

    const fetchOkrStats = async () => {
      try {
        setLoading(true);

        // جلب إحصائيات OKR
        const getOkrStats = httpsCallable<
          { periodId: string; departmentId?: string; organizationId: string },
          { stats: OkrStats; objectives: Objective[]; keyResults: KeyResult[] }
        >(functions, 'getOkrStats');

        const params = {
          periodId: selectedPeriodId,
          departmentId: selectedDepartmentId !== 'all' ? selectedDepartmentId : undefined,
          organizationId,
        };

        const result = await getOkrStats(params);
        setStats(result.data.stats);
        setObjectives(result.data.objectives || []);
        setKeyResults(result.data.keyResults || []);
      } catch (error) {
        console.error('Error fetching OKR stats:', error);
        toast({
          title: 'خطأ',
          description: 'حدث خطأ أثناء جلب إحصائيات OKR',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchOkrStats();
  }, [selectedPeriodId, selectedDepartmentId, organizationId]);



  // عرض حالة التحميل
  if (isLoadingAccountType || isLoadingPermissions) {
    return (
      <div className="container py-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-4 w-full max-w-md" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-80 w-full rounded-lg" />
      </div>
    );
  }

  // التحقق من نوع الحساب
  if (!isOrganization) {
    return (
      <div className="container py-6">
        <Card>
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">غير مصرح</h2>
            <p className="text-muted-foreground">
              هذه الصفحة متاحة فقط لحسابات المؤسسات.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // التحقق من الصلاحيات
  if (!canViewReports) {
    return (
      <div className="container py-6">
        <Card>
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">غير مصرح</h2>
            <p className="text-muted-foreground">
              ليس لديك صلاحية لعرض تقارير OKR.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center mb-2">
            <Button variant="outline" size="sm" asChild className="ml-2">
              <Link href="/org/okr">
                <ArrowLeft className="ml-2 h-4 w-4" />
                العودة
              </Link>
            </Button>
            <h1 className="text-3xl font-bold tracking-tight">تقارير OKR</h1>
          </div>
          <p className="text-muted-foreground">
            تقارير وإحصائيات نظام الأهداف والنتائج الرئيسية
          </p>
        </div>

        <div className="flex gap-2">
          <OkrReportExport
            periodId={selectedPeriodId}
            departmentId={selectedDepartmentId !== 'all' ? selectedDepartmentId : undefined}
            organizationId={organizationId || ''}
            disabled={loading || !stats}
          />

          <OkrExcelExport
            periodId={selectedPeriodId}
            departmentId={selectedDepartmentId !== 'all' ? selectedDepartmentId : undefined}
            organizationId={organizationId || ''}
            disabled={loading || !stats}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="period-selector">الفترة</Label>
          <Select
            value={selectedPeriodId}
            onValueChange={setSelectedPeriodId}
            disabled={loading || periods.length === 0}
          >
            <SelectTrigger id="period-selector">
              <SelectValue placeholder="اختر الفترة" />
            </SelectTrigger>
            <SelectContent>
              {periods.map(period => (
                <SelectItem key={period.id} value={period.id}>
                  {period.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="department-selector">القسم</Label>
          <Select
            value={selectedDepartmentId}
            onValueChange={setSelectedDepartmentId}
            disabled={loading}
          >
            <SelectTrigger id="department-selector">
              <SelectValue placeholder="اختر القسم" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الأقسام</SelectItem>
              {departments.map(department => (
                <SelectItem key={department.id} value={department.id}>
                  {department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="overview" className="flex items-center">
            <BarChart3 className="ml-2 h-4 w-4" />
            نظرة عامة
          </TabsTrigger>
          <TabsTrigger value="objectives" className="flex items-center">
            <Target className="ml-2 h-4 w-4" />
            الأهداف
          </TabsTrigger>
          <TabsTrigger value="departments" className="flex items-center">
            <Building2 className="ml-2 h-4 w-4" />
            الأقسام
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <OkrCompletionRate
              value={stats?.averageProgress || 0}
              total={100}
              loading={loading}
              title="نسبة الإنجاز الكلية"
              type="objectives"
            />

            <OkrCompletionRate
              value={stats?.completedObjectives || 0}
              total={stats?.totalObjectives || 0}
              loading={loading}
              title="إكمال الأهداف"
              type="objectives"
            />

            <OkrCompletionRate
              value={stats?.completedKeyResults || 0}
              total={stats?.totalKeyResults || 0}
              loading={loading}
              title="إكمال النتائج الرئيسية"
              type="keyResults"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <OkrStatusDistribution
              data={[
                { name: 'مكتملة', value: stats?.completedObjectives || 0, status: 'completed' as const },
                { name: 'نشطة', value: stats ? stats.totalObjectives - stats.completedObjectives - stats.atRiskObjectives - stats.behindObjectives : 0, status: 'active' as const },
                { name: 'في خطر', value: stats?.atRiskObjectives || 0, status: 'at_risk' as const },
                { name: 'متأخرة', value: stats?.behindObjectives || 0, status: 'behind' as const }
              ].filter(item => item.value > 0)}
              loading={loading}
              title="توزيع حالات الأهداف"
              height={300}
            />

            <OkrStatusDistribution
              data={[
                { name: 'مكتملة', value: stats?.completedKeyResults || 0, status: 'completed' as const },
                { name: 'نشطة', value: stats ? stats.totalKeyResults - stats.completedKeyResults - stats.atRiskKeyResults - stats.behindKeyResults : 0, status: 'active' as const },
                { name: 'في خطر', value: stats?.atRiskKeyResults || 0, status: 'at_risk' as const },
                { name: 'متأخرة', value: stats?.behindKeyResults || 0, status: 'behind' as const }
              ].filter(item => item.value > 0)}
              loading={loading}
              title="توزيع حالات النتائج الرئيسية"
              height={300}
            />
          </div>
        </TabsContent>

        <TabsContent value="objectives">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">تقدم الأهداف</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : objectives.length > 0 ? (
                <div className="space-y-4">
                  {objectives.map(objective => (
                    <div key={objective.id} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-medium">{objective.title}</h3>
                          {objective.departmentName && (
                            <p className="text-sm text-muted-foreground">
                              {objective.departmentName}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{Math.round(objective.progress)}%</div>
                          <p className="text-sm text-muted-foreground">
                            {objective.status === 'completed' && 'مكتمل'}
                            {objective.status === 'active' && 'نشط'}
                            {objective.status === 'at_risk' && 'في خطر'}
                            {objective.status === 'behind' && 'متأخر'}
                          </p>
                        </div>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full ${
                            objective.status === 'at_risk'
                              ? 'bg-yellow-500'
                              : objective.status === 'behind'
                              ? 'bg-red-500'
                              : 'bg-primary'
                          }`}
                          style={{ width: `${objective.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">لا توجد أهداف في هذه الفترة</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="departments">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">تقدم الأقسام</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : stats && stats.departmentStats ? (
                <div className="space-y-4">
                  {Object.entries(stats.departmentStats).map(([deptId, deptStat]) => (
                    <div key={deptId} className="border rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-medium">{deptStat.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {deptStat.totalObjectives} أهداف، {deptStat.completedObjectives} مكتملة
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{Math.round(deptStat.progress)}%</div>
                        </div>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${deptStat.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">لا توجد بيانات للأقسام</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
