import React, { memo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { DocumentCategory, Document } from './DocumentationPage';

interface DocumentationSidebarProps {
  documents: Document[];
  activeDocId: string | null;
  setActiveDocId: (id: string) => void;
  activeCategory: DocumentCategory;
  setActiveCategory: (category: DocumentCategory) => void;
}

const DocumentationSidebar: React.FC<DocumentationSidebarProps> = memo(({
  documents,
  activeDocId,
  setActiveDocId,
  activeCategory,
  setActiveCategory,
}) => {
  // الحصول على الفئات الفريدة من الوثائق المتاحة
  const getUniqueCategories = (): DocumentCategory[] => {
    if (!documents || documents.length === 0) {
      console.log('No documents available');
      return ['general'] as DocumentCategory[];
    }
    const categories = documents.map(doc => doc.category);
    const uniqueCategories = [...new Set(categories)] as DocumentCategory[];
    console.log('Unique categories:', uniqueCategories);
    return uniqueCategories.length > 0 ? uniqueCategories : ['general'] as DocumentCategory[];
  };

  // الحصول على الوثائق حسب الفئة
  const getDocumentsByCategory = (category: DocumentCategory): Document[] => {
    if (!documents || documents.length === 0) {
      console.log('No documents available for category:', category);
      return [];
    }
    const filteredDocs = documents.filter(doc => doc.category === category);
    console.log(`Documents for category ${category}:`, filteredDocs.length);
    return filteredDocs;
  };

  // ترجمة اسم الفئة إلى العربية
  const getCategoryName = (category: DocumentCategory): string => {
    switch (category) {
      case 'general':
        return 'عام';
      case 'debug':
        return 'التشخيص';
      case 'users':
        return 'المستخدمين';
      case 'tasks':
        return 'المهام';
      case 'reports':
        return 'التقارير';
      case 'settings':
        return 'الإعدادات';
      case 'performance':
        return 'الأداء';
      case 'development':
        return 'التطوير';
      default:
        // للفئات غير المعروفة، نعرض الاسم كما هو
        console.log('Unknown category:', category);
        return String(category);
    }
  };

  const uniqueCategories = getUniqueCategories();

  // إضافة سجلات تصحيح
  console.log('DocumentationSidebar component rendering');
  console.log('Documents:', documents);
  console.log('Unique categories:', uniqueCategories);
  console.log('Active category:', activeCategory);
  console.log('Active doc ID:', activeDocId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>الوثائق</CardTitle>
        <CardDescription>اختر قسم الوثائق</CardDescription>
      </CardHeader>
      <CardContent>
        {/* عرض عدد الوثائق والفئات للتشخيص */}
        <div className="mb-4 p-2 bg-muted rounded-md">
          <p className="text-sm">عدد الوثائق: {documents.length}</p>
          <p className="text-sm">عدد الفئات: {uniqueCategories.length}</p>
          <p className="text-sm">الفئة النشطة: {getCategoryName(activeCategory)}</p>
        </div>

        <Tabs value={activeCategory} onValueChange={(value) => setActiveCategory(value as DocumentCategory)}>
          <TabsList className="grid" style={{ gridTemplateColumns: `repeat(${uniqueCategories.length || 1}, 1fr)` }}>
            {uniqueCategories.map(category => (
              <TabsTrigger key={category} value={category}>
                {getCategoryName(category)}
              </TabsTrigger>
            ))}
          </TabsList>

          {uniqueCategories.map(category => (
            <TabsContent key={category} value={category}>
              <ScrollArea className="h-[50vh]">
                <div className="space-y-2 p-2">
                  {getDocumentsByCategory(category).map(doc => (
                    <Button
                      key={doc.id}
                      variant={activeDocId === doc.id ? "default" : "ghost"}
                      className="w-full justify-start text-right"
                      onClick={() => {
                        // تجنب إعادة تحميل نفس الوثيقة
                        if (activeDocId !== doc.id) {
                          console.log('Sidebar: Setting active doc ID:', doc.id);
                          setActiveDocId(doc.id);
                        } else {
                          console.log('Sidebar: Document already active:', doc.id);
                        }
                      }}
                    >
                      {doc.title}
                    </Button>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
});

export default DocumentationSidebar;
