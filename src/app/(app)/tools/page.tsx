'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Wrench, Calculator, Calendar } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

export default function ToolsPage() {
  const { user } = useAuth();
  const { checkPermission, loading: permissionsLoading } = usePermissions();

  // التحقق من صلاحيات المستخدم
  const hasViewPermission = checkPermission('tools', 'view');

  // عرض حالة التحميل
  if (permissionsLoading) {
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
  if (!hasViewPermission) {
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

  // قائمة الأدوات المتاحة
  const tools = [
    {
      id: 'calculator',
      title: 'الحاسبة الهندسية',
      description: 'حاسبة متقدمة للعمليات الهندسية والحسابية',
      icon: Calculator,
      color: 'bg-blue-500'
    },
    {
      id: 'scheduler',
      title: 'مجدول المهام',
      description: 'جدولة المهام وتنظيمها بشكل تلقائي',
      icon: Calendar,
      color: 'bg-orange-500'
    }
  ];

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center">
          <Wrench className="ml-2 h-6 w-6" />
          أدوات النظام
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tools.map((tool) => (
          <Card key={tool.id} className="overflow-hidden">
            <div className={`h-2 ${tool.color}`}></div>
            <CardHeader>
              <CardTitle className="flex items-center">
                <tool.icon className="ml-2 h-5 w-5" />
                {tool.title}
              </CardTitle>
              <CardDescription>{tool.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">فتح الأداة</Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-xl">ملاحظة</CardTitle>
          <CardDescription>
            هذه الصفحة قيد التطوير. سيتم إضافة المزيد من الأدوات قريبًا.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
