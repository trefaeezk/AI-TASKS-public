// src/app/(admin)/admin/error.tsx
'use client'; // Error components must be Client Components

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error("Admin page error:", error);
  }, [error]);

  return (
    <div dir="rtl" className="flex flex-col items-center justify-center min-h-[calc(100vh-10rem)] text-center p-6 bg-background">
       <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
       <h2 className="text-2xl font-semibold mb-2 text-destructive">حدث خطأ ما!</h2>
       <p className="text-muted-foreground mb-6 max-w-md">
          {error.message || 'عذرًا، واجهتنا مشكلة أثناء تحميل صفحة المسؤول.'}
       </p>
      <Button
        onClick={
          // Attempt to recover by trying to re-render the segment
          () => reset()
        }
        variant="destructive"
        size="lg"
      >
        إعادة المحاولة
      </Button>
       <p className="text-xs text-muted-foreground mt-4">
           إذا استمرت المشكلة، يرجى الاتصال بالدعم. (Digest: {error.digest})
       </p>
    </div>
  );
}
