// src/app/(admin)/admin/loading.tsx
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, UserCog } from 'lucide-react';

export default function AdminLoading() {
  return (
    <div className="space-y-6" dir="rtl">
       <h1 className="text-2xl font-bold text-primary flex items-center">
         <UserCog className="ml-2 h-6 w-6"/> لوحة تحكم المسؤول
       </h1>
        <div className="p-4 border rounded-md bg-card">
            <Skeleton className="h-8 w-1/2 mb-2 bg-muted" />
            <Skeleton className="h-4 w-3/4 mb-6 bg-muted" />

            <div className="space-y-4">
                 <Skeleton className="h-16 w-full rounded-md bg-muted" />
                 <Skeleton className="h-16 w-full rounded-md bg-muted" />
                 <Skeleton className="h-16 w-full rounded-md bg-muted" />
            </div>
        </div>

       {/* Optional: Add skeleton for other potential admin sections */}
    </div>
  );
}
