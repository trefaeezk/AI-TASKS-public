'use client';

import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, ListChecks, BarChart, Calendar, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function ReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const pathname = usePathname();

  // التحقق مما إذا كنا في صفحة فرعية
  const isSubPage = pathname !== '/reports';

  if (!user) {
    return (
      <div className="container mx-auto p-4">
        <Card>
          <CardContent className="p-6 text-center">
            <p>يجب تسجيل الدخول لعرض التقارير.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      {isSubPage && (
        <div className="mb-6" dir="rtl">
          <h1 className="text-2xl font-bold flex items-center">
            {pathname.includes('/reports/weekly') ? (
              <>
                <FileText className="ml-2 h-6 w-6" />
                التقارير الأسبوعية
              </>
            ) : (
              <>
                <ListChecks className="ml-2 h-6 w-6" />
                الخطة اليومية
              </>
            )}
          </h1>
        </div>
      )}

      {!isSubPage && (
        <div className="mb-6" dir="rtl">
          <h1 className="text-2xl font-bold flex items-center">
            <ListChecks className="ml-2 h-6 w-6" />
            الخطة اليومية
          </h1>
          <p className="text-muted-foreground mt-1">
            اقتراحات الذكاء الاصطناعي لمهام اليوم بناءً على التواريخ والأولويات
          </p>
        </div>
      )}

      {children}
    </div>
  );
}
