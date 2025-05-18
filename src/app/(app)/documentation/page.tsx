'use client';

import React, { useState, useEffect } from 'react';
import DocumentationPage from '@/components/documentation/DocumentationPage';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DocumentationPageApp() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [initialDocContent, setInitialDocContent] = useState<string>('');
  const [initialDocId, setInitialDocId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // التحقق من تسجيل الدخول
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=/documentation');
    }
  }, [user, loading, router]);

  // تحميل البيانات من API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/documentation');
        
        if (!response.ok) {
          throw new Error(`Error fetching documentation data: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        setDocuments(data.documents || []);
        setInitialDocContent(data.initialDocContent || '');
        setInitialDocId(data.initialDocId || 'general-overview');
      } catch (error) {
        console.error('Error fetching documentation data:', error);
        setError('حدث خطأ أثناء تحميل البيانات من الخادم');
      } finally {
        setIsLoading(false);
      }
    };
    
    if (user) {
      fetchData();
    }
  }, [user]);

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

  if (loading || isLoading) {
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
        <DocumentationPage
          serverDocuments={documents}
          initialDocContent={initialDocContent}
          initialDocId={initialDocId}
        />
      )}
    </div>
  );
}
