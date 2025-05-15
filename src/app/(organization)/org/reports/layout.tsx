'use client';

import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, ListChecks, BarChart, Calendar, ArrowLeft, Building2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function OrganizationReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const pathname = usePathname();
  
  // التحقق مما إذا كنا في صفحة فرعية
  const isSubPage = pathname !== '/org/reports';
  
  if (!user) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="p-6 text-center">
            <p>يجب تسجيل الدخول لعرض تقارير المؤسسة.</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto p-4">
      {isSubPage && (
        <div className="mb-6 flex justify-between items-center" dir="rtl">
          <h1 className="text-2xl font-bold flex items-center">
            <FileText className="ml-2 h-6 w-6" />
            <Building2 className="ml-2 h-6 w-6 text-primary" />
            تقارير المؤسسة
          </h1>
          <Button asChild variant="outline" size="sm">
            <Link href="/org/reports">
              <ArrowLeft className="ml-2 h-4 w-4" />
              العودة إلى تقارير المؤسسة
            </Link>
          </Button>
        </div>
      )}
      
      {!isSubPage && (
        <div className="mb-6" dir="rtl">
          <h1 className="text-2xl font-bold flex items-center">
            <FileText className="ml-2 h-6 w-6" />
            <Building2 className="ml-2 h-6 w-6 text-primary" />
            تقارير المؤسسة
          </h1>
          <p className="text-muted-foreground mt-1">
            تقارير شاملة عن مهام وإنجازات المؤسسة
          </p>
          
          <Tabs defaultValue="daily" className="mt-6">
            <TabsList className="grid grid-cols-3 mb-4">
              <TabsTrigger value="daily">
                <div className="flex items-center">
                  <ListChecks className="ml-2 h-4 w-4" />
                  خطة اليوم
                </div>
              </TabsTrigger>
              <TabsTrigger value="weekly">
                <div className="flex items-center">
                  <Calendar className="ml-2 h-4 w-4" />
                  التقارير الأسبوعية
                </div>
              </TabsTrigger>
              <TabsTrigger value="analytics" disabled>
                <div className="flex items-center">
                  <BarChart className="ml-2 h-4 w-4" />
                  تحليلات الأداء
                </div>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="daily">
              <p className="text-sm text-muted-foreground mb-4">
                خطة اليوم تساعد المؤسسة على تنظيم المهام وتحديد الأولويات بناءً على المواعيد والأهمية.
              </p>
              <Button asChild className="w-full sm:w-auto">
                <Link href="/org/reports#daily-plan">
                  عرض خطة اليوم
                </Link>
              </Button>
            </TabsContent>
            
            <TabsContent value="weekly">
              <p className="text-sm text-muted-foreground mb-4">
                التقارير الأسبوعية تقدم نظرة شاملة عن إنجازات المؤسسة والمهام المكتملة والجارية والقادمة.
              </p>
              <Button asChild className="w-full sm:w-auto">
                <Link href="/org/reports/weekly">
                  عرض التقارير الأسبوعية
                </Link>
              </Button>
            </TabsContent>
            
            <TabsContent value="analytics">
              <p className="text-sm text-muted-foreground mb-4">
                تحليلات الأداء تقدم إحصائيات ورسوم بيانية عن أداء المؤسسة ومعدل إنجاز المهام.
              </p>
              <Button disabled className="w-full sm:w-auto">
                قريبًا
              </Button>
            </TabsContent>
          </Tabs>
        </div>
      )}
      
      {children}
    </div>
  );
}
