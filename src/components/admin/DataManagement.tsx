/**
 * مكون إدارة البيانات - يتيح تصدير واستيراد بيانات المستخدمين
 */
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Download, Upload, AlertTriangle, CheckCircle } from 'lucide-react';
import { db } from '@/config/firebase';
import { collection, getDocs, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { hasPermission } from '@/types/roles';

// أنواع البيانات التي يمكن تصديرها/استيرادها
type DataType = 'users' | 'tasks' | 'all';

export default function DataManagement() {
  const { user, userPermissions } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // التحقق من صلاحيات المستخدم
  const canManageData = userPermissions && hasPermission(userPermissions, 'data:view');

  if (!canManageData) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>غير مصرح</AlertTitle>
        <AlertDescription>
          ليس لديك صلاحية للوصول إلى هذه الصفحة.
        </AlertDescription>
      </Alert>
    );
  }

  // تصدير البيانات
  const exportData = async (dataType: DataType) => {
    try {
      setIsExporting(true);
      setMessage({ type: 'info', text: 'جاري تصدير البيانات...' });

      const exportData: Record<string, any> = {};

      // تحديد المجموعات التي سيتم تصديرها
      const collectionsToExport = dataType === 'all'
        ? ['users', 'tasks', 'reports', 'settings']
        : dataType === 'users'
          ? ['users']
          : ['tasks'];

      // استرجاع البيانات من Firestore
      for (const collectionName of collectionsToExport) {
        const querySnapshot = await getDocs(collection(db, collectionName));
        exportData[collectionName] = {};

        querySnapshot.forEach((doc) => {
          exportData[collectionName][doc.id] = doc.data();
        });
      }

      // تحويل البيانات إلى JSON وتنزيلها
      const jsonData = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `data-export-${dataType}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setMessage({ type: 'success', text: 'تم تصدير البيانات بنجاح!' });
    } catch (error) {
      console.error('Error exporting data:', error);
      setMessage({ type: 'error', text: `حدث خطأ أثناء تصدير البيانات: ${error instanceof Error ? error.message : 'خطأ غير معروف'}` });
    } finally {
      setIsExporting(false);
    }
  };

  // استيراد البيانات
  const importData = async () => {
    if (!selectedFile) {
      setMessage({ type: 'error', text: 'الرجاء اختيار ملف للاستيراد' });
      return;
    }

    try {
      setIsImporting(true);
      setMessage({ type: 'info', text: 'جاري استيراد البيانات...' });

      // قراءة الملف
      const fileContent = await selectedFile.text();
      const importData = JSON.parse(fileContent);

      // التحقق من صحة البيانات
      if (!importData || typeof importData !== 'object') {
        throw new Error('تنسيق البيانات غير صالح');
      }

      // استيراد البيانات إلى Firestore
      const batch = writeBatch(db);

      // معالجة كل مجموعة
      for (const [collectionName, collectionData] of Object.entries(importData)) {
        if (typeof collectionData === 'object' && collectionData !== null) {
          for (const [docId, docData] of Object.entries(collectionData)) {
            const docRef = doc(db, collectionName, docId);
            batch.set(docRef, docData);
          }
        }
      }

      // تنفيذ العملية
      await batch.commit();

      setMessage({ type: 'success', text: 'تم استيراد البيانات بنجاح!' });
      setSelectedFile(null);
    } catch (error) {
      console.error('Error importing data:', error);
      setMessage({ type: 'error', text: `حدث خطأ أثناء استيراد البيانات: ${error instanceof Error ? error.message : 'خطأ غير معروف'}` });
    } finally {
      setIsImporting(false);
    }
  };

  // معالجة اختيار الملف
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>إدارة البيانات</CardTitle>
        <CardDescription>تصدير واستيراد بيانات التطبيق</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="export">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export">تصدير البيانات</TabsTrigger>
            <TabsTrigger value="import">استيراد البيانات</TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 gap-4">
              {/* بطاقات تصدير البيانات */}
              <div className="border rounded-lg p-4 bg-muted/20">
                <div className="flex items-center mb-2">
                  <Download className="h-5 w-5 ml-2 text-primary" />
                  <h3 className="font-medium">تصدير بيانات المستخدمين</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  تصدير جميع بيانات المستخدمين بما في ذلك الأدوار والصلاحيات
                </p>
                <Button
                  onClick={() => exportData('users')}
                  disabled={isExporting}
                  className="w-full sm:w-auto"
                  variant="outline"
                >
                  {isExporting ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                  {isExporting ? 'جاري التصدير...' : 'تصدير بيانات المستخدمين'}
                </Button>
              </div>

              <div className="border rounded-lg p-4 bg-muted/20">
                <div className="flex items-center mb-2">
                  <Download className="h-5 w-5 ml-2 text-primary" />
                  <h3 className="font-medium">تصدير بيانات المهام</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  تصدير جميع المهام والتقارير والبيانات المرتبطة بها
                </p>
                <Button
                  onClick={() => exportData('tasks')}
                  disabled={isExporting}
                  className="w-full sm:w-auto"
                  variant="outline"
                >
                  {isExporting ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                  {isExporting ? 'جاري التصدير...' : 'تصدير بيانات المهام'}
                </Button>
              </div>

              <div className="border rounded-lg p-4 bg-muted/20">
                <div className="flex items-center mb-2">
                  <Download className="h-5 w-5 ml-2 text-primary" />
                  <h3 className="font-medium">تصدير جميع البيانات</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  تصدير جميع بيانات النظام بما في ذلك المستخدمين والمهام والإعدادات
                </p>
                <Button
                  onClick={() => exportData('all')}
                  disabled={isExporting}
                  className="w-full sm:w-auto"
                >
                  {isExporting ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                  {isExporting ? 'جاري التصدير...' : 'تصدير جميع البيانات'}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="import" className="space-y-4 mt-4">
            <div className="flex flex-col gap-4">
              <div className="border rounded-lg p-4 bg-muted/20">
                <div className="flex items-center mb-2">
                  <Upload className="h-5 w-5 ml-2 text-primary" />
                  <h3 className="font-medium">استيراد البيانات</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  اختر ملف JSON لاستيراد البيانات منه
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1">
                    <label
                      htmlFor="file-upload"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer items-center"
                    >
                      {selectedFile ? selectedFile.name : 'اختر ملف JSON...'}
                      <input
                        id="file-upload"
                        type="file"
                        accept=".json"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </label>
                  </div>

                  <Button
                    onClick={importData}
                    disabled={isImporting || !selectedFile}
                    className="sm:w-auto"
                  >
                    {isImporting ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                    {isImporting ? 'جاري الاستيراد...' : 'استيراد البيانات'}
                  </Button>
                </div>
              </div>

              <Alert variant="warning">
                <AlertTriangle className="h-5 w-5" />
                <AlertTitle className="text-base">تحذير</AlertTitle>
                <AlertDescription>
                  استيراد البيانات سيؤدي إلى استبدال البيانات الحالية. تأكد من عمل نسخة احتياطية قبل الاستيراد.
                </AlertDescription>
              </Alert>
            </div>
          </TabsContent>
        </Tabs>

        {message && (
          <Alert variant={message.type === 'error' ? 'destructive' : message.type === 'success' ? 'default' : 'secondary'} className="mt-4">
            {message.type === 'error' ? <AlertTriangle className="h-4 w-4" /> :
             message.type === 'success' ? <CheckCircle className="h-4 w-4" /> :
             <Loader2 className="h-4 w-4" />}
            <AlertTitle>{message.type === 'error' ? 'خطأ' : message.type === 'success' ? 'نجاح' : 'معلومات'}</AlertTitle>
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
