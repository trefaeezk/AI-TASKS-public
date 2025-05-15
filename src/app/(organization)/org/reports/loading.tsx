'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { ListChecks } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function OrganizationReportsLoading() {
  return (
    <div dir="rtl">
      <Card className="mb-8 shadow-lg bg-card border-border rounded-lg">
        <CardHeader>
          <CardTitle className="text-xl text-card-foreground flex items-center">
            <ListChecks className="ml-2 h-5 w-5 text-primary" />
            خطة اليوم المقترحة للمؤسسة
          </CardTitle>
          <CardDescription>
            اقتراحات الذكاء الاصطناعي لمهام اليوم بناءً على التواريخ والأولويات، مع تنبيهات للمهام الفائتة.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <Skeleton className="h-10 w-40 mx-auto rounded-md bg-muted" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-10 w-1/3 mx-auto rounded-md bg-muted" />
            <Skeleton className="h-20 w-full rounded-md bg-muted" />
            <Skeleton className="h-20 w-full rounded-md bg-muted" />
            <Skeleton className="h-20 w-full rounded-md bg-muted" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
