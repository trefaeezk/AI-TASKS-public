import React, { useState } from 'react';
import { NextPage, GetServerSideProps } from 'next';
import Head from 'next/head';
import DocumentationPage from '@/components/documentation/DocumentationPage';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

// تعريف واجهة البيانات
interface DocumentationProps {
  documents: {
    id: string;
    title: string;
    description: string;
    category: string;
    path: string;
    requiredPermission: string;
  }[];
  initialDocContent?: string;
  initialDocId?: string;
}

// دالة getServerSideProps لتحميل البيانات من الخادم
export const getServerSideProps: GetServerSideProps = async ({ req }) => {
  try {
    // استخدام API الوثائق الداخلي
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host;
    const baseUrl = `${protocol}://${host}`;

    // استخدام API الوثائق بدون firebase-admin
    const response = await fetch(`${baseUrl}/api/documentation`);

    if (!response.ok) {
      throw new Error(`Error fetching documentation data: ${response.statusText}`);
    }

    const data = await response.json();

    return {
      props: {
        documents: data.documents || [],
        initialDocContent: data.initialDocContent || '',
        initialDocId: data.initialDocId || 'general-overview',
      },
    };
  } catch (error) {
    console.error('Error in getServerSideProps:', error);
    return {
      props: {
        documents: [],
        initialDocContent: '',
        initialDocId: '',
        error: 'حدث خطأ أثناء تحميل البيانات من الخادم',
      },
    };
  }
};

const Documentation: NextPage<DocumentationProps> = ({ documents, initialDocContent, initialDocId }) => {
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

  // إضافة سجلات تصحيح
  console.log('Rendering Documentation page');
  console.log('Documents:', documents);
  console.log('Initial Doc Content:', initialDocContent ? 'Available' : 'Not available');
  console.log('Initial Doc ID:', initialDocId);
  console.log('User:', user);
  console.log('Loading:', loading);
  console.log('Error:', error);

  return (
    <div className="min-h-screen bg-background">
      <Head>
        <title>الوثائق - نظام إدارة المهام</title>
        <meta name="description" content="وثائق نظام إدارة المهام" />
      </Head>

      {/* إضافة عنصر بسيط للتحقق من عملية التقديم */}
      <div className="container mx-auto py-4 text-center">
        <h1 className="text-2xl font-bold">صفحة الوثائق</h1>
        <p className="text-muted-foreground">جاري تحميل المحتوى...</p>

        {/* إضافة زر اختبار API */}
        <div className="mt-4">
          <Button
            onClick={async () => {
              try {
                console.log('Testing API...');
                const response = await fetch('/api/test');
                const data = await response.json();
                console.log('API test response:', data);
                alert('API is working! Check console for details.');
              } catch (error) {
                console.error('API test error:', error);
                alert('API test failed! Check console for details.');
              }
            }}
            className="mx-2"
          >
            اختبار API
          </Button>

          <Button
            onClick={async () => {
              try {
                console.log('Testing Documentation API...');
                const response = await fetch('/api/documentation');
                const data = await response.json();
                console.log('Documentation API response:', data);
                alert('Documentation API is working! Check console for details.');
              } catch (error) {
                console.error('Documentation API test error:', error);
                alert('Documentation API test failed! Check console for details.');
              }
            }}
            className="mx-2"
          >
            اختبار API الوثائق
          </Button>

          <Button
            onClick={async () => {
              try {
                console.log('Testing Docs API...');
                // استخدام رمز مصادقة فارغ للاختبار
                const response = await fetch('/api/docs/README.md', {
                  headers: {
                    'Authorization': 'Bearer test-token'
                  }
                });
                if (response.ok) {
                  const text = await response.text();
                  console.log('Docs API response:', text.substring(0, 100) + '...');
                  alert('Docs API is working! Check console for details.');
                } else {
                  console.error('Docs API error:', response.status, response.statusText);
                  alert(`Docs API error: ${response.status} ${response.statusText}`);
                }
              } catch (error) {
                console.error('Docs API test error:', error);
                alert('Docs API test failed! Check console for details.');
              }
            }}
            className="mx-2"
          >
            اختبار API الملفات
          </Button>
        </div>
      </div>

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
};

export default Documentation;
