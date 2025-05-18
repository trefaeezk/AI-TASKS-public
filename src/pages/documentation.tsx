import React, { useState } from 'react';
import { NextPage } from 'next';
import Head from 'next/head';
import DocumentationPage from '@/components/documentation/DocumentationPage';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const Documentation: NextPage = () => {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  // التحقق من تسجيل الدخول
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=/documentation');
    }
  }, [user, loading, router]);

  // معالجة الأخطاء
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Error caught by error handler:', event.error);
      setError('حدث خطأ أثناء تحميل الصفحة. يرجى تحديث الصفحة أو المحاولة مرة أخرى لاحقًا.');
    };

    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('error', handleError);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex justify-center items-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Head>
        <title>الوثائق - نظام إدارة المهام</title>
        <meta name="description" content="وثائق نظام إدارة المهام" />
      </Head>

      {error ? (
        <div className="container mx-auto py-8">
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>خطأ</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button
            onClick={() => window.location.reload()}
            className="mt-4"
          >
            تحديث الصفحة
          </Button>
        </div>
      ) : (
        <DocumentationPage />
      )}
    </div>
  );
};

export default Documentation;
