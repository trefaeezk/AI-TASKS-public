// src/app/(admin)/admin/logs/loading.tsx
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, FileText } from 'lucide-react';

export default function LogsLoading() {
  return (
    <div className="space-y-6" dir="rtl">
       <div className="flex justify-between items-center">
           <h1 className="text-2xl font-bold text-primary flex items-center">
             <Skeleton className="h-6 w-6 ml-2 rounded-full bg-muted" />
              <Skeleton className="h-7 w-48 bg-muted" />
           </h1>
            <Skeleton className="h-9 w-24 bg-muted" />
       </div>

       <div className="border rounded-md bg-card p-4">
            <Skeleton className="h-8 w-1/2 mb-2 bg-muted" />
            <Skeleton className="h-4 w-3/4 mb-6 bg-muted" />

            <div className="space-y-2">
                 <Skeleton className="h-10 w-full rounded-md bg-muted" />
                 <Skeleton className="h-10 w-full rounded-md bg-muted" />
                 <Skeleton className="h-10 w-full rounded-md bg-muted" />
                 <Skeleton className="h-10 w-full rounded-md bg-muted" />
                 <Skeleton className="h-10 w-full rounded-md bg-muted" />
            </div>
       </div>
    </div>
  );
}
