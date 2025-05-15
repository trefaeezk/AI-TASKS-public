'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Download, Upload, AlertTriangle, CheckCircle } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, writeBatch, Timestamp } from 'firebase/firestore';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

/**
 * مكون إدارة البيانات للمؤسسة
 * يتيح للمستخدم تصدير واستيراد بيانات المؤسسة
 */
export default function OrganizationDataManagement() {
  const { user, userClaims } = useAuth();
  const { hasPermission } = usePermissions();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const organizationId = userClaims?.organizationId;

  // التحقق من صلاحيات المستخدم
  const canManageData = hasPermission('data:view');

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

  if (!organizationId) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>غير متاح</AlertTitle>
        <AlertDescription>
          يجب أن تكون عضوًا في مؤسسة للوصول إلى هذه الصفحة.
        </AlertDescription>
      </Alert>
    );
  }

  // تصدير بيانات المؤسسة
  const exportOrganizationData = async () => {
    try {
      setIsExporting(true);
      setMessage({ type: 'info', text: 'جاري تصدير البيانات...' });

      const exportData: Record<string, any> = {
        organization: {},
        members: {},
        departments: {},
        tasks: {}
      };

      // استرجاع بيانات المؤسسة
      const orgDoc = await getDocs(query(collection(db, 'organizations'), where('__name__', '==', organizationId)));
      if (!orgDoc.empty) {
        exportData.organization = orgDoc.docs[0].data();
      }

      // استرجاع بيانات الأعضاء
      const membersSnapshot = await getDocs(collection(db, 'organizations', organizationId, 'members'));
      membersSnapshot.forEach((doc) => {
        exportData.members[doc.id] = doc.data();
      });

      // استرجاع بيانات الأقسام
      const departmentsSnapshot = await getDocs(collection(db, 'organizations', organizationId, 'departments'));
      departmentsSnapshot.forEach((doc) => {
        exportData.departments[doc.id] = doc.data();
      });

      // استرجاع بيانات المهام
      const tasksSnapshot = await getDocs(query(collection(db, 'tasks'), where('organizationId', '==', organizationId)));
      tasksSnapshot.forEach((doc) => {
        exportData.tasks[doc.id] = doc.data();
      });

      // تحويل البيانات إلى JSON وتنزيلها
      const jsonData = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `organization-data-export-${organizationId}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setMessage({ type: 'success', text: 'تم تصدير بيانات المؤسسة بنجاح!' });
    } catch (error) {
      console.error('Error exporting organization data:', error);
      setMessage({ type: 'error', text: `حدث خطأ أثناء تصدير البيانات: ${error instanceof Error ? error.message : 'خطأ غير معروف'}` });
    } finally {
      setIsExporting(false);
    }
  };

  // استيراد بيانات المؤسسة
  const importOrganizationData = async () => {
    if (!selectedFile) {
      setMessage({ type: 'error', text: 'يرجى اختيار ملف للاستيراد.' });
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

      // التحقق من أن البيانات تنتمي للمؤسسة الحالية
      if (importData.organization && importData.organization.id !== organizationId) {
        throw new Error('البيانات لا تنتمي للمؤسسة الحالية');
      }

      // استيراد البيانات إلى Firestore
      const batch = writeBatch(db);

      // استيراد بيانات المؤسسة
      if (importData.organization) {
        batch.set(doc(db, 'organizations', organizationId), {
          ...importData.organization,
          updatedAt: new Date(),
          updatedBy: user?.uid || 'unknown'
        }, { merge: true });
      }

      // استيراد بيانات الأعضاء
      if (importData.members && typeof importData.members === 'object') {
        for (const [memberId, memberData] of Object.entries(importData.members)) {
          if (typeof memberData === 'object' && memberData !== null) {
            batch.set(doc(db, 'organizations', organizationId, 'members', memberId), memberData);
          }
        }
      }

      // استيراد بيانات الأقسام
      if (importData.departments && typeof importData.departments === 'object') {
        for (const [deptId, deptData] of Object.entries(importData.departments)) {
          if (typeof deptData === 'object' && deptData !== null) {
            batch.set(doc(db, 'organizations', organizationId, 'departments', deptId), deptData);
          }
        }
      }

      // استيراد بيانات المهام
      if (importData.tasks && typeof importData.tasks === 'object') {
        for (const [taskId, taskData] of Object.entries(importData.tasks)) {
          if (typeof taskData === 'object' && taskData !== null && (taskData as any).organizationId === organizationId) {
            batch.set(doc(db, 'tasks', taskId), {
              ...taskData,
              importedAt: new Date()
            });
          }
        }
      }

      // تنفيذ العملية
      await batch.commit();

      setMessage({ type: 'success', text: 'تم استيراد بيانات المؤسسة بنجاح!' });
      setSelectedFile(null);
    } catch (error) {
      console.error('Error importing organization data:', error);
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
        <CardTitle>إدارة بيانات المؤسسة</CardTitle>
        <CardDescription>تصدير واستيراد بيانات المؤسسة</CardDescription>
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
                  <h3 className="font-medium">تصدير بيانات المؤسسة</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  تصدير جميع بيانات المؤسسة بما في ذلك الأعضاء والأقسام والمهام
                </p>
                <Button
                  onClick={exportOrganizationData}
                  disabled={isExporting}
                  className="w-full sm:w-auto"
                  variant="outline"
                >
                  {isExporting ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                  {isExporting ? 'جاري التصدير...' : 'تصدير بيانات المؤسسة'}
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="import" className="space-y-4 mt-4">
            <div className="border rounded-lg p-4 bg-muted/20">
              <div className="flex items-center mb-2">
                <Upload className="h-5 w-5 ml-2 text-primary" />
                <h3 className="font-medium">استيراد بيانات المؤسسة</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                استيراد بيانات المؤسسة من ملف JSON تم تصديره مسبقًا
              </p>
              <div className="space-y-4">
                <div className="flex flex-col space-y-2">
                  <label htmlFor="file-upload" className="text-sm font-medium">
                    اختر ملف JSON
                  </label>
                  <input
                    id="file-upload"
                    type="file"
                    accept=".json"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-muted-foreground
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-md file:border-0
                      file:text-sm file:font-medium
                      file:bg-primary file:text-primary-foreground
                      hover:file:bg-primary/90"
                  />
                </div>
                <Button
                  onClick={importOrganizationData}
                  disabled={isImporting || !selectedFile}
                  className="w-full sm:w-auto"
                  variant="outline"
                >
                  {isImporting ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
                  {isImporting ? 'جاري الاستيراد...' : 'استيراد البيانات'}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {message && (
          <Alert
            variant={message.type === 'error' ? 'destructive' : message.type === 'success' ? 'default' : 'default'}
            className="mt-4"
          >
            {message.type === 'error' ? (
              <AlertTriangle className="h-4 w-4" />
            ) : message.type === 'success' ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin" />
            )}
            <AlertTitle>
              {message.type === 'error' ? 'خطأ' : message.type === 'success' ? 'نجاح' : 'جاري المعالجة'}
            </AlertTitle>
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <p className="text-xs text-muted-foreground">
          تأكد من الاحتفاظ بنسخة احتياطية من بياناتك بشكل منتظم
        </p>
      </CardFooter>
    </Card>
  );
}
