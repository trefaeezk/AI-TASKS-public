'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CalendarDays, 
  Calendar, 
  CalendarRange,
  BarChart,
  TrendingUp,
  Building
} from 'lucide-react';
import { PeriodReportCard } from '@/components/PeriodReportCard';
import { type ReportPeriodType } from '@/services/organizationReports';

interface ReportSelectorProps {
  organizationId?: string;
  departmentId?: string;
  userId?: string;
  className?: string;
}

/**
 * مكون اختيار نوع التقرير
 * يسمح للمستخدم باختيار نوع التقرير (أسبوعي، شهري، سنوي)
 */
export function ReportSelector({ 
  organizationId, 
  departmentId, 
  userId, 
  className 
}: ReportSelectorProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriodType | null>(null);

  // بيانات أنواع التقارير
  const reportTypes = [
    {
      type: 'weekly' as ReportPeriodType,
      title: 'التقرير الأسبوعي',
      description: 'تقرير مفصل للأداء الأسبوعي مع تحليل المهام والإنتاجية',
      icon: <CalendarDays className="h-8 w-8" />,
      color: 'bg-blue-500',
      features: ['تحليل المهام اليومية', 'مقارنة الأسابيع', 'تحليل الأقسام', 'رسوم بيانية تفاعلية'],
      recommended: true
    },
    {
      type: 'monthly' as ReportPeriodType,
      title: 'التقرير الشهري',
      description: 'نظرة شاملة على الأداء الشهري والاتجاهات طويلة المدى',
      icon: <Calendar className="h-8 w-8" />,
      color: 'bg-green-500',
      features: ['تحليل الاتجاهات الشهرية', 'مقارنة الأشهر', 'إحصائيات مفصلة', 'تقارير قابلة للتصدير'],
      recommended: false
    },
    {
      type: 'yearly' as ReportPeriodType,
      title: 'التقرير السنوي',
      description: 'تقرير استراتيجي شامل للأداء السنوي والتخطيط المستقبلي',
      icon: <CalendarRange className="h-8 w-8" />,
      color: 'bg-purple-500',
      features: ['تحليل الأداء السنوي', 'مقارنة السنوات', 'تقييم الأهداف', 'تخطيط استراتيجي'],
      recommended: false
    }
  ];

  // إذا تم اختيار نوع تقرير، عرض التقرير
  if (selectedPeriod) {
    return (
      <div className="space-y-4">
        {/* زر العودة */}
        <div className="flex items-center justify-between">
          <Button 
            variant="outline" 
            onClick={() => setSelectedPeriod(null)}
            className="mb-4"
          >
            ← العودة لاختيار نوع التقرير
          </Button>
        </div>

        {/* التقرير المحدد */}
        <PeriodReportCard
          organizationId={organizationId}
          departmentId={departmentId}
          userId={userId}
          defaultPeriodType={selectedPeriod}
          className={className}
        />
      </div>
    );
  }

  // عرض اختيار نوع التقرير
  return (
    <div className="space-y-6">
      {/* العنوان */}
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight">اختر نوع التقرير</h2>
        <p className="text-muted-foreground mt-2">
          اختر نوع التقرير الذي تريد عرضه وتحليله
        </p>
      </div>

      {/* بطاقات اختيار التقارير */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {reportTypes.map((reportType) => (
          <Card 
            key={reportType.type}
            className="relative cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105"
            onClick={() => setSelectedPeriod(reportType.type)}
          >
            {reportType.recommended && (
              <Badge className="absolute -top-2 -right-2 bg-orange-500 hover:bg-orange-600">
                مُوصى به
              </Badge>
            )}
            
            <CardHeader className="text-center">
              <div className={`w-16 h-16 ${reportType.color} rounded-full flex items-center justify-center text-white mx-auto mb-4`}>
                {reportType.icon}
              </div>
              <CardTitle className="text-xl">{reportType.title}</CardTitle>
              <CardDescription className="text-center">
                {reportType.description}
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">الميزات المتاحة:</h4>
                <ul className="space-y-2">
                  {reportType.features.map((feature, index) => (
                    <li key={index} className="flex items-center text-sm">
                      <div className="w-2 h-2 bg-primary rounded-full ml-2 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <Button className="w-full mt-4" variant="outline">
                <BarChart className="ml-2 h-4 w-4" />
                عرض التقرير
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* معلومات إضافية */}
      <div className="bg-muted/30 p-6 rounded-lg">
        <div className="flex items-start space-x-4">
          <TrendingUp className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
          <div>
            <h3 className="font-semibold mb-2">نصائح لاختيار التقرير المناسب:</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>• <strong>التقرير الأسبوعي:</strong> مثالي للمتابعة اليومية وإدارة المهام قصيرة المدى</li>
              <li>• <strong>التقرير الشهري:</strong> مناسب لتقييم الأداء الشهري والتخطيط متوسط المدى</li>
              <li>• <strong>التقرير السنوي:</strong> ضروري للتخطيط الاستراتيجي وتقييم الأهداف طويلة المدى</li>
            </ul>
          </div>
        </div>
      </div>

      {/* إحصائيات سريعة */}
      {organizationId && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <Building className="h-8 w-8 text-blue-500" />
                <div className="mr-4">
                  <p className="text-sm font-medium text-muted-foreground">المؤسسة</p>
                  <p className="text-2xl font-bold">نشطة</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <CalendarDays className="h-8 w-8 text-green-500" />
                <div className="mr-4">
                  <p className="text-sm font-medium text-muted-foreground">التقارير المتاحة</p>
                  <p className="text-2xl font-bold">3</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center">
                <BarChart className="h-8 w-8 text-purple-500" />
                <div className="mr-4">
                  <p className="text-sm font-medium text-muted-foreground">التحليلات</p>
                  <p className="text-2xl font-bold">متقدمة</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
