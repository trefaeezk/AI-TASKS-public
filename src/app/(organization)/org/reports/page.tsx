'use client';

// منع التوليد المسبق للصفحة
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { DailyPlanReport } from '@/components/reports/DailyPlanReport';

export default function OrganizationReportsPage() {
  const { user, userClaims } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const organizationId = userClaims?.organizationId;

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    if (!organizationId) {
      toast({
        title: 'خطأ في الوصول',
        description: 'يجب أن تكون عضوًا في مؤسسة لعرض الخطة اليومية.',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
  }, [user, organizationId, toast]);

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!user || !organizationId) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">
              يجب تسجيل الدخول وأن تكون عضوًا في مؤسسة لعرض الخطة اليومية.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <DailyPlanReport
        organizationId={organizationId}
        onBack={() => {}}
      />
    </div>
  );
}
