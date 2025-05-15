
// src/app/(app)/kpi/loading.tsx
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3 } from 'lucide-react';

export default function KpiLoading() {
  return (
    <div className="space-y-6" dir="rtl">
       <h1 className="text-2xl font-bold text-primary flex items-center">
         <Skeleton className="h-6 w-6 ml-2 rounded-full bg-muted" />
          <Skeleton className="h-7 w-48 bg-muted" />
       </h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
           <Skeleton className="h-24 w-full rounded-lg bg-muted" />
           <Skeleton className="h-24 w-full rounded-lg bg-muted" />
           <Skeleton className="h-24 w-full rounded-lg bg-muted" />
           <Skeleton className="h-24 w-full rounded-lg bg-muted" />
       </div>
       <Skeleton className="h-64 w-full rounded-lg bg-muted" />
       <Skeleton className="h-40 w-full rounded-lg bg-muted" />
    </div>
  );
}
