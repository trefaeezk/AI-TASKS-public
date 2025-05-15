'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Download, Upload, AlertTriangle, CheckCircle } from 'lucide-react';
import { db } from '@/config/firebase';
import { collection, query, where, getDocs, doc, setDoc, writeBatch, orderBy } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { hasPermission } from '@/types/roles';
import { useToast } from '@/hooks/use-toast';

/**
 * مكون إدارة البيانات للمستخدم المستقل
 * يتيح للمستخدم المستقل تصدير واستيراد مهامه الخاصة فقط
 */
export default function IndividualDataManagement() {
  const { user, userClaims } = useAuth();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // التحقق من صلاحيات المستخدم
  const canManageData = userClaims?.role === 'independent' || hasPermission(['data:view'], { area: 'data', action: 'view' });

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

  // تصدير مهام المستخدم المستقل
  const exportUserTasks = async () => {
    if (!user) {
      toast({
        title: "خطأ",
        description: "يجب تسجيل الدخول لتصدير البيانات",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsExporting(true);
      setMessage({ type: 'info', text: 'جاري تصدير المهام...' });

      const exportData: Record<string, any> = {
        tasks: {}
      };

      // استرجاع مهام المستخدم فقط مع استخدام الفهارس المعرفة في firestore.indexes.json
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc') // استخدام الفهرس المركب userId + createdAt
      );

      const querySnapshot = await getDocs(tasksQuery);

      querySnapshot.forEach((doc) => {
        exportData.tasks[doc.id] = doc.data();
      });

      // تحويل البيانات إلى JSON وتنزيلها
      const jsonData = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-tasks-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setMessage({ type: 'success', text: 'تم تصدير المهام بنجاح!' });
      toast({
        title: "تم التصدير بنجاح",
        description: "تم تصدير مهامك بنجاح",
        variant: "default"
      });
    } catch (error) {
      console.error('Error exporting tasks:', error);
      setMessage({ type: 'error', text: `حدث خطأ أثناء تصدير المهام: ${error instanceof Error ? error.message : 'خطأ غير معروف'}` });
      toast({
        title: "خطأ في التصدير",
        description: error instanceof Error ? error.message : 'حدث خطأ أثناء تصدير المهام',
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  // استيراد مهام المستخدم المستقل
  const importUserTasks = async () => {
    if (!user) {
      toast({
        title: "خطأ",
        description: "يجب تسجيل الدخول لاستيراد البيانات",
        variant: "destructive"
      });
      return;
    }

    if (!selectedFile) {
      setMessage({ type: 'error', text: 'الرجاء اختيار ملف للاستيراد' });
      toast({
        title: "خطأ",
        description: "الرجاء اختيار ملف للاستيراد",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsImporting(true);
      setMessage({ type: 'info', text: 'جاري استيراد المهام...' });

      // قراءة الملف
      const fileContent = await selectedFile.text();
      const importData = JSON.parse(fileContent);

      // التحقق من صحة البيانات
      if (!importData || typeof importData !== 'object' || !importData.tasks) {
        throw new Error('تنسيق البيانات غير صالح. يجب أن يحتوي الملف على مهام.');
      }

      // استيراد المهام إلى Firestore
      const batch = writeBatch(db);
      let importCount = 0;

      // معالجة المهام فقط
      const tasksData = importData.tasks;
      if (typeof tasksData === 'object' && tasksData !== null) {
        for (const [docId, docData] of Object.entries(tasksData)) {
          // التأكد من أن المهمة تنتمي للمستخدم الحالي أو تعيينها له
          const taskData = {
            ...docData as any,
            userId: user.uid, // ضمان أن المهمة تنتمي للمستخدم الحالي
            importedAt: new Date()
          };

          const taskRef = doc(db, 'tasks', docId);
          batch.set(taskRef, taskData);
          importCount++;
        }
      }

      // تنفيذ العملية
      await batch.commit();

      setMessage({ type: 'success', text: `تم استيراد ${importCount} مهمة بنجاح!` });
      setSelectedFile(null);
      toast({
        title: "تم الاستيراد بنجاح",
        description: `تم استيراد ${importCount} مهمة بنجاح`,
        variant: "default"
      });
    } catch (error) {
      console.error('Error importing tasks:', error);
      setMessage({ type: 'error', text: `حدث خطأ أثناء استيراد المهام: ${error instanceof Error ? error.message : 'خطأ غير معروف'}` });
      toast({
        title: "خطأ في الاستيراد",
        description: error instanceof Error ? error.message : 'حدث خطأ أثناء استيراد المهام',
        variant: "destructive"
      });
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
        <CardDescription>تصدير واستيراد مهامك الخاصة</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="export">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="export">تصدير البيانات</TabsTrigger>
            <TabsTrigger value="import">استيراد البيانات</TabsTrigger>
          </TabsList>

          <TabsContent value="export" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="border rounded-lg p-4 bg-muted/20">
                <div className="flex items-center mb-2">
                  <Download className="h-5 w-5 ml-2 text-primary" />
                  <h3 className="font-medium">تصدير مهامي</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  تصدير جميع مهامك الخاصة إلى ملف JSON
                </p>
                <Button
                  onClick={exportUserTasks}
                  disabled={isExporting}
                  className="w-full sm:w-auto"
                >
                  {isExporting ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                  {isExporting ? 'جاري التصدير...' : 'تصدير مهامي'}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="import" className="space-y-4 mt-4">
            <div className="flex flex-col gap-4">
              <div className="border rounded-lg p-4 bg-muted/20">
                <div className="flex items-center mb-2">
                  <Upload className="h-5 w-5 ml-2 text-primary" />
                  <h3 className="font-medium">استيراد مهامي</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  اختر ملف JSON لاستيراد المهام منه
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
                    onClick={importUserTasks}
                    disabled={isImporting || !selectedFile}
                    className="sm:w-auto"
                  >
                    {isImporting ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                    {isImporting ? 'جاري الاستيراد...' : 'استيراد المهام'}
                  </Button>
                </div>
              </div>

              <Alert variant="destructive" className="bg-amber-50 border-amber-200 text-amber-800">
                <AlertTriangle className="h-5 w-5" />
                <AlertTitle className="text-base">تحذير</AlertTitle>
                <AlertDescription>
                  استيراد المهام قد يؤدي إلى استبدال المهام الحالية إذا كانت تحمل نفس المعرفات. تأكد من عمل نسخة احتياطية قبل الاستيراد.
                </AlertDescription>
              </Alert>
            </div>
          </TabsContent>
        </Tabs>

        {message && (
          <Alert
            variant={message.type === 'error' ? 'destructive' : message.type === 'success' ? 'default' : 'default'}
            className="mt-4"
          >
            {message.type === 'error' && <AlertTriangle className="h-4 w-4" />}
            {message.type === 'success' && <CheckCircle className="h-4 w-4" />}
            <AlertTitle>
              {message.type === 'error' ? 'خطأ' : message.type === 'success' ? 'نجاح' : 'معلومات'}
            </AlertTitle>
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
