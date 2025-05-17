'use client';

// منع التوليد المسبق للصفحة
export const dynamic = 'force-dynamic';

// تعطيل التوليد المسبق للصفحة
export const runtime = 'edge';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { WeeklyReportCard } from '@/components/WeeklyReportCard';
import { FileText, Calendar, ArrowLeft, Building2, Users } from 'lucide-react';
import Link from 'next/link';
import { format, subWeeks, startOfWeek, endOfWeek } from 'date-fns';
import { ar } from 'date-fns/locale';
import { db } from '@/config/firebase';
import { collection, query, getDocs } from 'firebase/firestore';

interface Department {
  id: string;
  name: string;
}

export default function OrganizationWeeklyReportsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'current' | 'previous' | 'custom'>('current');
  const [reportType, setReportType] = useState<'organization' | 'department'>('organization');
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);

  // تحديد فترات التقارير
  const now = new Date();
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 0 }); // Sunday
  const currentWeekEnd = endOfWeek(now, { weekStartsOn: 0 }); // Saturday
  const previousWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 0 });
  const previousWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 0 });

  // جلب معرف المؤسسة من المستخدم
  useEffect(() => {
    if (user) {
      const claims = (user as any).customClaims;
      if (claims && claims.organizationId) {
        setOrganizationId(claims.organizationId);
      }
    }
  }, [user]);

  // جلب الأقسام من Firestore
  useEffect(() => {
    if (!organizationId) return;

    const fetchDepartments = async () => {
      try {
        const departmentsQuery = query(
          collection(db, 'organizations', organizationId, 'departments')
        );
        const snapshot = await getDocs(departmentsQuery);
        const departmentsList: Department[] = [];

        snapshot.forEach((doc) => {
          departmentsList.push({
            id: doc.id,
            name: doc.data().name || 'قسم بدون اسم',
          });
        });

        setDepartments(departmentsList);

        // تعيين القسم الأول كقسم افتراضي إذا كانت هناك أقسام
        if (departmentsList.length > 0) {
          setSelectedDepartmentId(departmentsList[0].id);
        }
      } catch (error) {
        console.error('Error fetching departments:', error);
      }
    };

    fetchDepartments();
  }, [organizationId]);

  // تنسيق التاريخ
  const formatDateRange = (start: Date, end: Date) => {
    return `${format(start, 'dd MMM', { locale: ar })} - ${format(end, 'dd MMM yyyy', { locale: ar })}`;
  };

  if (!user || !organizationId) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="p-6 text-center">
            <p>يجب تسجيل الدخول كعضو في مؤسسة لعرض التقارير الأسبوعية.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center">
          <FileText className="ml-2 h-6 w-6" />
          التقارير الأسبوعية للمؤسسة
        </h1>
        <Button asChild variant="outline" size="sm">
          <Link href="/org/reports">
            <ArrowLeft className="ml-2 h-4 w-4" />
            العودة إلى التقارير
          </Link>
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Calendar className="ml-2 h-5 w-5 text-primary" />
            اختر نوع التقرير وفترته
          </CardTitle>
          <CardDescription>
            يمكنك عرض تقارير للمؤسسة بالكامل أو لقسم محدد
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="report-type">نوع التقرير</Label>
              <Select value={reportType} onValueChange={(value) => setReportType(value as 'organization' | 'department')}>
                <SelectTrigger id="report-type">
                  <SelectValue placeholder="اختر نوع التقرير" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="organization">
                    <div className="flex items-center">
                      <Building2 className="ml-2 h-4 w-4" />
                      تقرير المؤسسة بالكامل
                    </div>
                  </SelectItem>
                  <SelectItem value="department">
                    <div className="flex items-center">
                      <Users className="ml-2 h-4 w-4" />
                      تقرير قسم محدد
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {reportType === 'department' && (
              <div className="space-y-2">
                <Label htmlFor="department">القسم</Label>
                <Select
                  value={selectedDepartmentId}
                  onValueChange={setSelectedDepartmentId}
                  disabled={departments.length === 0}
                >
                  <SelectTrigger id="department">
                    <SelectValue placeholder="اختر القسم" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((department) => (
                      <SelectItem key={department.id} value={department.id}>
                        {department.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
            <TabsList className="grid grid-cols-3 mb-4">
              <TabsTrigger value="current">
                الأسبوع الحالي
                <span className="mr-2 text-xs text-muted-foreground">
                  ({formatDateRange(currentWeekStart, currentWeekEnd)})
                </span>
              </TabsTrigger>
              <TabsTrigger value="previous">
                الأسبوع السابق
                <span className="mr-2 text-xs text-muted-foreground">
                  ({formatDateRange(previousWeekStart, previousWeekEnd)})
                </span>
              </TabsTrigger>
              <TabsTrigger value="custom" disabled>
                فترة مخصصة
              </TabsTrigger>
            </TabsList>

            <TabsContent value="current">
              <WeeklyReportCard
                organizationId={organizationId}
                departmentId={reportType === 'department' ? selectedDepartmentId : undefined}
                reportPeriod={{ startDate: currentWeekStart, endDate: currentWeekEnd }}
              />
            </TabsContent>

            <TabsContent value="previous">
              <WeeklyReportCard
                organizationId={organizationId}
                departmentId={reportType === 'department' ? selectedDepartmentId : undefined}
                reportPeriod={{ startDate: previousWeekStart, endDate: previousWeekEnd }}
              />
            </TabsContent>

            <TabsContent value="custom">
              <div className="text-center py-8 text-muted-foreground">
                سيتم تنفيذ هذه الميزة قريبًا.
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
