import React from 'react';
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

const DocumentationSidebar: React.FC<DocumentationSidebarProps> = ({
  documents,
  activeDocId,
  setActiveDocId,
  activeCategory,
  setActiveCategory,
}) => {
  // الحصول على الفئات الفريدة من الوثائق المتاحة
  const getUniqueCategories = (): DocumentCategory[] => {
    const categories = documents.map(doc => doc.category);
    return [...new Set(categories)] as DocumentCategory[];
  };

  // الحصول على الوثائق حسب الفئة
  const getDocumentsByCategory = (category: DocumentCategory): Document[] => {
    return documents.filter(doc => doc.category === category);
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
      default:
        return category;
    }
  };

  const uniqueCategories = getUniqueCategories();

  return (
    <Card>
      <CardHeader>
        <CardTitle>الوثائق</CardTitle>
        <CardDescription>اختر قسم الوثائق</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeCategory} onValueChange={(value) => setActiveCategory(value as DocumentCategory)}>
          <TabsList className="grid" style={{ gridTemplateColumns: `repeat(${uniqueCategories.length}, 1fr)` }}>
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
                      onClick={() => setActiveDocId(doc.id)}
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
};

export default DocumentationSidebar;
