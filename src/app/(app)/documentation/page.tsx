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

  // Check login status
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=/documentation');
    }
  }, [user, loading, router]);

  // Load data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        // Load static documentation data
        const staticDocuments = [
          {
            id: 'user-system',
            title: 'نظام المستخدمين',
            description: 'دليل شامل لنظام المستخدمين والصلاحيات',
            category: 'system',
            path: 'USER_SYSTEM_DOCUMENTATION.md',
            requiredPermission: 'user',
          },
          {
            id: 'permissions-guide',
            title: 'دليل الصلاحيات',
            description: 'شرح تفصيلي لنظام الصلاحيات والأمان',
            category: 'security',
            path: 'USER_PERMISSIONS_GUIDE.md',
            requiredPermission: 'user',
          },
          {
            id: 'organization-management',
            title: 'إدارة المؤسسات',
            description: 'دليل إدارة المؤسسات والأعضاء',
            category: 'organization',
            path: 'ORGANIZATION_MANAGEMENT.md',
            requiredPermission: 'user',
          },
          {
            id: 'api-reference',
            title: 'مرجع API',
            description: 'توثيق شامل لجميع APIs المتاحة',
            category: 'development',
            path: 'API_REFERENCE.md',
            requiredPermission: 'user',
          }
        ];

        setDocuments(staticDocuments);
        setInitialDocContent('# مرحباً بك في التوثيق\n\nاختر وثيقة من القائمة الجانبية للبدء.');
        setInitialDocId('user-system');
      } catch (error) {
        console.error('Error fetching documentation data:', error);
        setError('Error loading data from server');
      } finally {
        setIsLoading(false);
      }
    };

    if (user) {
      fetchData();
    }
  }, [user]);

  // Error handling
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Error caught by error handler:', event.error);
      setError('An error occurred while loading the page. Please refresh the page or try again later.');
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
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button
            onClick={() => window.location.reload()}
            className="mt-4"
          >
            Refresh Page
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
