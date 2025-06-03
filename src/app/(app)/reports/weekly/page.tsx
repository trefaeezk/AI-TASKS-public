'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WeeklyReportCard } from '@/components/WeeklyReportCard';
import { FileText, Calendar, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { format, subWeeks, startOfWeek, endOfWeek } from 'date-fns';
import { ar } from 'date-fns/locale';

export default function WeeklyReportsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'current' | 'previous' | 'custom'>('current');

  // تحديد فترات التقارير
  const now = new Date();
  const currentWeekStart = startOfWeek(now, { weekStartsOn: 0 }); // Sunday
  const currentWeekEnd = endOfWeek(now, { weekStartsOn: 0 }); // Saturday
  const previousWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 0 });
  const previousWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 0 });

  // تنسيق التاريخ
  const formatDateRange = (start: Date, end: Date) => {
    return `${format(start, 'dd MMM', { locale: ar })} - ${format(end, 'dd MMM yyyy', { locale: ar })}`;
  };

  if (!user) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="p-6 text-center">
            <p>يجب تسجيل الدخول لعرض التقارير الأسبوعية.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4" dir="rtl">

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Calendar className="ml-2 h-5 w-5 text-primary" />
            اختر فترة التقرير
          </CardTitle>
          <CardDescription>
            يمكنك عرض تقارير للأسبوع الحالي أو الأسبوع السابق
          </CardDescription>
        </CardHeader>
        <CardContent>
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
              <WeeklyReportCard reportPeriod={{ startDate: currentWeekStart, endDate: currentWeekEnd }} />
            </TabsContent>

            <TabsContent value="previous">
              <WeeklyReportCard reportPeriod={{ startDate: previousWeekStart, endDate: previousWeekEnd }} />
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
