import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import MarkdownRenderer from './MarkdownRenderer';
import DocumentationSidebar from './DocumentationSidebar';
import { usePermissions } from '@/hooks/usePermissions';

// تعريف أنواع الوثائق
export type DocumentCategory = 'general' | 'debug' | 'users' | 'tasks' | 'reports' | 'settings';

// تعريف هيكل الوثيقة
export interface Document {
  id: string;
  title: string;
  description: string;
  category: DocumentCategory;
  path: string;
  requiredPermission: string;
  content?: string;
}

// قائمة الوثائق المتاحة
const documents: Document[] = [
  {
    id: 'debug-overview',
    title: 'نظرة عامة على صفحة التشخيص',
    description: 'شرح عام لصفحة التشخيص وكيفية استخدامها',
    category: 'debug',
    path: '/docs/debug/README.md',
    requiredPermission: 'owner',
  },
  {
    id: 'debug-access-control',
    title: 'إدارة الصلاحيات لصفحة التشخيص',
    description: 'شرح نظام الصلاحيات للوصول إلى صفحة التشخيص',
    category: 'debug',
    path: '/docs/debug/access-control.md',
    requiredPermission: 'owner',
  },
  {
    id: 'debug-email-system',
    title: 'نظام البريد الإلكتروني في صفحة التشخيص',
    description: 'شرح نظام البريد الإلكتروني المستخدم في صفحة التشخيص',
    category: 'debug',
    path: '/docs/debug/email-system.md',
    requiredPermission: 'owner',
  },
  {
    id: 'general-overview',
    title: 'نظرة عامة على النظام',
    description: 'شرح عام لنظام إدارة المهام',
    category: 'general',
    path: '/docs/README.md',
    requiredPermission: 'user',
  },
];

const DocumentationPage: React.FC = () => {
  const router = useRouter();
  const { user, userClaims } = useAuth();
  const { hasPermission } = usePermissions();
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [activeDocument, setActiveDocument] = useState<Document | null>(null);
  const [documentContent, setDocumentContent] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<DocumentCategory>('general');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // التحقق من الصلاحيات للوصول إلى الوثيقة
  const canAccessDocument = (doc: Document): boolean => {
    if (doc.requiredPermission === 'owner') {
      return userClaims?.owner === true;
    }
    if (doc.requiredPermission === 'admin') {
      return userClaims?.admin === true || userClaims?.owner === true;
    }
    if (doc.requiredPermission === 'user') {
      return true; // أي مستخدم مسجل الدخول
    }
    return hasPermission(doc.requiredPermission);
  };

  // الحصول على الوثائق المتاحة للمستخدم الحالي
  const getAccessibleDocuments = (): Document[] => {
    return documents.filter(doc => canAccessDocument(doc));
  };

  // الحصول على الوثائق حسب الفئة
  const getDocumentsByCategory = (category: DocumentCategory): Document[] => {
    return getAccessibleDocuments().filter(doc => doc.category === category);
  };

  // تحميل محتوى الوثيقة
  const loadDocumentContent = async (doc: Document) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(doc.path);
      if (!response.ok) {
        throw new Error(`فشل تحميل الوثيقة: ${response.statusText}`);
      }
      const content = await response.text();
      setDocumentContent(content);
      setActiveDocument(doc);
    } catch (err: any) {
      console.error('Error loading document:', err);
      setError(`حدث خطأ أثناء تحميل الوثيقة: ${err.message}`);
      setDocumentContent('');
    } finally {
      setLoading(false);
    }
  };

  // تحديد الوثيقة النشطة عند تغيير المعرف
  useEffect(() => {
    if (activeDocId) {
      const doc = documents.find(d => d.id === activeDocId);
      if (doc && canAccessDocument(doc)) {
        loadDocumentContent(doc);
        setActiveCategory(doc.category);
      } else {
        setError('ليس لديك صلاحية للوصول إلى هذه الوثيقة');
      }
    } else {
      // تحميل الوثيقة الافتراضية
      const accessibleDocs = getAccessibleDocuments();
      if (accessibleDocs.length > 0) {
        setActiveDocId(accessibleDocs[0].id);
      }
    }
  }, [activeDocId]);

  // التحقق من تسجيل الدخول
  if (!user) {
    return (
      <Card className="w-full max-w-4xl mx-auto mt-8">
        <CardHeader>
          <CardTitle>الوثائق</CardTitle>
          <CardDescription>يجب تسجيل الدخول للوصول إلى الوثائق</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>غير مصرح</AlertTitle>
            <AlertDescription>
              يجب تسجيل الدخول للوصول إلى الوثائق. يرجى تسجيل الدخول والمحاولة مرة أخرى.
            </AlertDescription>
          </Alert>
          <div className="mt-4">
            <Button onClick={() => router.push('/login')}>تسجيل الدخول</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // التحقق من وجود وثائق متاحة
  const accessibleDocs = getAccessibleDocuments();
  if (accessibleDocs.length === 0) {
    return (
      <Card className="w-full max-w-4xl mx-auto mt-8">
        <CardHeader>
          <CardTitle>الوثائق</CardTitle>
          <CardDescription>لا توجد وثائق متاحة</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>لا توجد وثائق</AlertTitle>
            <AlertDescription>
              لا توجد وثائق متاحة لمستوى صلاحياتك الحالي. يرجى التواصل مع مسؤول النظام إذا كنت تعتقد أن هذا خطأ.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">الرئيسية</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/documentation">الوثائق</BreadcrumbLink>
            </BreadcrumbItem>
            {activeDocument && (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink>{activeDocument.title}</BreadcrumbLink>
                </BreadcrumbItem>
              </>
            )}
          </BreadcrumbList>
        </Breadcrumb>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="md:col-span-1">
          <DocumentationSidebar
            documents={accessibleDocs}
            activeDocId={activeDocId}
            setActiveDocId={setActiveDocId}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
          />
        </div>

        {/* Main Content */}
        <div className="md:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>{activeDocument?.title || 'الوثائق'}</CardTitle>
              <CardDescription>{activeDocument?.description || 'اختر وثيقة من القائمة الجانبية'}</CardDescription>
            </CardHeader>
            <CardContent>
              {error && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>خطأ</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
              ) : (
                documentContent && <MarkdownRenderer content={documentContent} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DocumentationPage;
