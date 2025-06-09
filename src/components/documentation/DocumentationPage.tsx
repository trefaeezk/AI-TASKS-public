import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import MarkdownRenderer from './MarkdownRenderer';
import DocumentationSidebar from './DocumentationSidebar';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';

// تعريف أنواع الوثائق
export type DocumentCategory = 'general' | 'debug' | 'users' | 'tasks' | 'reports' | 'settings' | 'performance' | 'development' | string;

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

// تعريف واجهة الخصائص
interface DocumentationPageProps {
  serverDocuments?: {
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

const DocumentationPage: React.FC<DocumentationPageProps> = ({
  serverDocuments,
  initialDocContent,
  initialDocId
}) => {
  // تحويل الوثائق من الخادم إلى النموذج المطلوب
  const documents: Document[] = serverDocuments ?
    serverDocuments.map(doc => ({
      ...doc,
      category: doc.category as DocumentCategory
    })) : [
      {
        id: 'debug-overview',
        title: 'نظرة عامة على صفحة التشخيص',
        description: 'شرح عام لصفحة التشخيص وكيفية استخدامها',
        category: 'debug',
        path: 'debug/README.md',
        requiredPermission: 'org_owner',
      },
      {
        id: 'debug-access-control',
        title: 'إدارة الصلاحيات لصفحة التشخيص',
        description: 'شرح نظام الصلاحيات للوصول إلى صفحة التشخيص',
        category: 'debug',
        path: 'debug/access-control.md',
        requiredPermission: 'org_owner',
      },
      {
        id: 'debug-email-system',
        title: 'نظام البريد الإلكتروني في صفحة التشخيص',
        description: 'شرح نظام البريد الإلكتروني المستخدم في صفحة التشخيص',
        category: 'debug',
        path: 'debug/email-system.md',
        requiredPermission: 'org_owner',
      },
      {
        id: 'general-overview',
        title: 'نظرة عامة على النظام',
        description: 'شرح عام لنظام إدارة المهام',
        category: 'general',
        path: 'README.md',
        requiredPermission: 'isIndependent',
      },
    ];
  const router = useRouter();
  const { user, userClaims } = useAuth();
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const [activeDocId, setActiveDocId] = useState<string | null>(initialDocId || null);
  const [activeDocument, setActiveDocument] = useState<Document | null>(null);
  const [documentContent, setDocumentContent] = useState<string>(initialDocContent || '');
  // تحديد الفئة الافتراضية
  const defaultCategory = documents.length > 0 ?
    (documents.find(d => d.category === 'general')?.category || documents[0].category) :
    'general';

  const [activeCategory, setActiveCategory] = useState<DocumentCategory>(defaultCategory);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [retryCount, setRetryCount] = useState<number>(0);

  // استخدام المحتوى المبدئي إذا كان متوفرًا - يتم تنفيذه مرة واحدة فقط
  useEffect(() => {
    console.log('Initial document effect running');
    console.log('Initial doc ID:', initialDocId);
    console.log('Initial doc content length:', initialDocContent ? initialDocContent.length : 0);

    // تجنب إعادة التحميل إذا كان هناك وثيقة نشطة بالفعل
    if (activeDocument) {
      console.log('Skipping initial document loading as active document is already set');
      return;
    }

    if (initialDocContent && initialDocId) {
      const doc = documents.find(d => d.id === initialDocId);
      if (doc) {
        console.log('Setting initial document content for:', doc.id, doc.title);
        setActiveDocument(doc);
        setDocumentContent(initialDocContent);
        setActiveCategory(doc.category);
        console.log('Using initial document content from server');
      }
    }
  }, []); // تنفيذ مرة واحدة فقط عند التحميل الأولي

  // التحقق من الصلاحيات للوصول إلى الوثيقة
  const canAccessDocument = (doc: Document): boolean => {
    console.log('Checking access for document:', doc.id, 'with required permission:', doc.requiredPermission);
    console.log('User claims:', userClaims);

    if (doc.requiredPermission === 'org_owner') {
      const hasAccess = userClaims?.isSystemOwner === true;
      console.log('Owner permission check:', hasAccess);
      return hasAccess;
    }
    if (doc.requiredPermission === 'org_admin') {
      const hasAccess = userClaims?.isSystemAdmin === true || userClaims?.isSystemOwner === true ||
                       userClaims?.isOrgOwner === true || userClaims?.isOrgAdmin === true;
      console.log('Admin permission check:', hasAccess);
      return hasAccess;
    }
    if (doc.requiredPermission === 'isIndependent') {
      console.log('Independent user permission check: true');
      return true; // أي مستخدم مسجل الدخول
    }

    const hasAccess = hasPermission(doc.requiredPermission);
    console.log('Custom permission check:', doc.requiredPermission, hasAccess);
    return hasAccess;
  };

  // الحصول على الوثائق المتاحة للمستخدم الحالي
  const getAccessibleDocuments = (): Document[] => {
    if (!documents || documents.length === 0) {
      console.log('No documents available');
      return [];
    }
    const accessibleDocs = documents.filter(doc => canAccessDocument(doc));
    console.log('Accessible documents count:', accessibleDocs.length);
    return accessibleDocs;
  };

  // الحصول على الوثائق حسب الفئة
  const getDocumentsByCategory = (category: DocumentCategory): Document[] => {
    const accessibleDocs = getAccessibleDocuments();
    if (!accessibleDocs || accessibleDocs.length === 0) {
      console.log('No accessible documents available for category:', category);
      return [];
    }
    const filteredDocs = accessibleDocs.filter(doc => doc.category === category);
    console.log(`Accessible documents for category ${category}:`, filteredDocs.length);
    return filteredDocs;
  };

  // تحميل محتوى الوثيقة
  const loadDocumentContent = useCallback(async (doc: Document) => {
    setLoading(true);
    setError(null);
    try {
      console.log('Loading document content for:', doc.id, doc.path);

      // Load documentation content directly from docs folder
      // Since we removed the API route, we'll load static content
      const response = await fetch(`/docs/${doc.path}`);

      console.log('Response status:', response.status, response.statusText);

      if (!response.ok) {
        throw new Error(`فشل تحميل الوثيقة: ${response.statusText}`);
      }

      const content = await response.text();
      console.log('Content loaded, length:', content.length);
      setDocumentContent(content);
      setActiveDocument(doc);
      setRetryCount(0); // إعادة تعيين عداد المحاولات عند النجاح
    } catch (err: any) {
      console.error('Error loading document:', err);
      setError(`حدث خطأ أثناء تحميل الوثيقة: ${err.message}`);
      setDocumentContent('');

      // إظهار إشعار بالخطأ
      toast({
        title: "خطأ في تحميل الوثيقة",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  // إعادة محاولة تحميل الوثيقة
  const retryLoadDocument = useCallback(() => {
    if (activeDocument) {
      setRetryCount(prev => prev + 1);
      toast({
        title: "جاري إعادة المحاولة",
        description: `محاولة تحميل الوثيقة مرة أخرى (${retryCount + 1})`,
      });
      loadDocumentContent(activeDocument);
    }
  }, [activeDocument, loadDocumentContent, retryCount, toast]);

  // تحديد الوثيقة النشطة عند تغيير المعرف
  useEffect(() => {
    // منع التحميل أثناء عملية تحميل أخرى
    if (loading) {
      console.log('Skipping document loading as another loading is in progress');
      return;
    }

    // تخطي التحميل إذا كان المحتوى المبدئي متوفرًا وهو نفس الوثيقة النشطة
    if (initialDocContent && initialDocId && activeDocId === initialDocId && documentContent) {
      console.log('Skipping document loading as initial content is already set');
      return;
    }

    // تخطي التحميل إذا كانت الوثيقة النشطة هي نفسها الوثيقة الحالية
    if (activeDocument && activeDocument.id === activeDocId) {
      console.log('Skipping document loading as active document is already set');
      return;
    }

    if (activeDocId) {
      const doc = documents.find(d => d.id === activeDocId);
      if (doc && canAccessDocument(doc)) {
        console.log('Loading document:', doc.id, doc.title);
        loadDocumentContent(doc);
        setActiveCategory(doc.category);
      } else {
        setError('ليس لديك صلاحية للوصول إلى هذه الوثيقة');
      }
    } else {
      // تحميل الوثيقة الافتراضية
      const accessibleDocs = getAccessibleDocuments();
      if (accessibleDocs.length > 0) {
        console.log('Setting default document:', accessibleDocs[0].id);
        setActiveDocId(accessibleDocs[0].id);
      }
    }
  }, [activeDocId, canAccessDocument, loadDocumentContent, initialDocContent, initialDocId, documentContent, loading, activeDocument]);

  // إضافة سجلات تصحيح
  console.log('DocumentationPage component rendering');
  console.log('User:', user);
  console.log('User claims:', userClaims);
  console.log('Documents:', documents);

  // التحقق من تسجيل الدخول
  if (!user) {
    console.log('User not logged in, showing login message');
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
  console.log('Available documents:', documents);
  console.log('Accessible documents:', accessibleDocs);
  console.log('User claims:', userClaims);

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
                  <Button
                    onClick={retryLoadDocument}
                    variant="outline"
                    size="sm"
                    className="mt-2"
                  >
                    <RefreshCw className="h-4 w-4 ml-2" />
                    إعادة المحاولة
                  </Button>
                </Alert>
              )}

              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
              ) : (
                documentContent ? (
                  <MarkdownRenderer content={documentContent} />
                ) : (
                  !error && (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>لا يوجد محتوى للعرض. يرجى اختيار وثيقة من القائمة الجانبية.</p>
                    </div>
                  )
                )
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DocumentationPage;
