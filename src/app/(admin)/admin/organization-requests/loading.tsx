import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Building } from 'lucide-react';

export default function OrganizationRequestsLoading() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center space-x-2 space-x-reverse">
        <Building className="h-6 w-6 text-primary" />
        <Skeleton className="h-8 w-64 bg-muted" />
      </div>
      
      <div className="space-y-4">
        <Skeleton className="h-8 w-48 bg-muted" />
        
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40 bg-muted mb-2" />
            <Skeleton className="h-4 w-64 bg-muted" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full bg-muted" />
              <Skeleton className="h-4 w-3/4 bg-muted" />
              <Skeleton className="h-4 w-1/2 bg-muted" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-40 bg-muted mb-2" />
            <Skeleton className="h-4 w-64 bg-muted" />
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Skeleton className="h-4 w-full bg-muted" />
              <Skeleton className="h-4 w-3/4 bg-muted" />
              <Skeleton className="h-4 w-1/2 bg-muted" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
