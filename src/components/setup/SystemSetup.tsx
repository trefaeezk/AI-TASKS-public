/**
 * مكون إعداد النظام - يستخدم عند تشغيل التطبيق لأول مرة
 */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, Building, User, AlertTriangle, CheckCircle } from 'lucide-react';
import { db } from '@/config/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '@/hooks/use-auth';
import { SystemType, DEFAULT_SYSTEM_SETTINGS, DEFAULT_ORGANIZATION_SETTINGS } from '@/types/system';

export default function SystemSetup() {
  const { user } = useAuth();
  const router = useRouter();
  const [systemType, setSystemType] = useState<SystemType>('individual');
  const [organizationName, setOrganizationName] = useState('');
  const [allowSelfRegistration, setAllowSelfRegistration] = useState(false);
  const [autoActivateUsers, setAutoActivateUsers] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // التحقق من وجود مستخدم مسجل الدخول
  if (!user) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>غير مصرح</AlertTitle>
        <AlertDescription>
          يجب تسجيل الدخول لإعداد النظام.
        </AlertDescription>
      </Alert>
    );
  }

  // إعداد النظام
  const setupSystem = async () => {
    try {
      setIsSubmitting(true);
      setError(null);

      // تحضير بيانات الإعدادات
      const settings = systemType === 'organization'
        ? {
            ...DEFAULT_ORGANIZATION_SETTINGS,
            organizationName,
            settings: {
              ...DEFAULT_ORGANIZATION_SETTINGS.settings,
              allowSelfRegistration,
              autoActivateUsers
            }
          }
        : DEFAULT_SYSTEM_SETTINGS;

      // حفظ الإعدادات في Firestore
      await setDoc(doc(db, 'system', 'settings'), {
        ...settings,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        createdBy: user.uid
      });

      // تعيين المستخدم الحالي كمسؤول
      // هذا يتم عادة من خلال Cloud Function

      setSuccess(true);

      // إعادة توجيه المستخدم بعد الإعداد
      setTimeout(() => {
        router.push('/');
      }, 2000);

    } catch (error) {
      console.error('Error setting up system:', error);
      setError(error instanceof Error ? error.message : 'حدث خطأ أثناء إعداد النظام');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full max-w-3xl mx-auto shadow-lg">
      <CardHeader className="text-center">
        <CardTitle className="text-xl md:text-2xl">إعداد النظام</CardTitle>
        <CardDescription className="text-sm md:text-base">اختر نوع النظام وقم بتكوين الإعدادات الأساسية</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="space-y-4">
            <Label className="text-base font-medium block mb-2">نوع النظام</Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* بطاقة النظام الفردي */}
              <div
                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  systemType === 'individual'
                    ? 'border-primary bg-primary/10 shadow-md'
                    : 'border-border hover:border-primary/50 hover:bg-muted'
                }`}
                onClick={() => setSystemType('individual')}
              >
                <div className="flex items-center mb-2">
                  <RadioGroupItem
                    value="individual"
                    id="individual"
                    checked={systemType === 'individual'}
                    className="ml-2"
                  />
                  <Label htmlFor="individual" className="flex items-center text-lg font-medium cursor-pointer">
                    <User className="ml-2 h-5 w-5" />
                    نظام فردي
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground pr-6">
                  مناسب للاستخدام الشخصي. ستكون أنت المالك الوحيد للنظام وتتحكم في جميع البيانات.
                </p>
              </div>

              {/* بطاقة نظام المؤسسة */}
              <div
                className={`border rounded-lg p-4 cursor-pointer transition-all ${
                  systemType === 'organization'
                    ? 'border-primary bg-primary/10 shadow-md'
                    : 'border-border hover:border-primary/50 hover:bg-muted'
                }`}
                onClick={() => setSystemType('organization')}
              >
                <div className="flex items-center mb-2">
                  <RadioGroupItem
                    value="organization"
                    id="organization"
                    checked={systemType === 'organization'}
                    className="ml-2"
                  />
                  <Label htmlFor="organization" className="flex items-center text-lg font-medium cursor-pointer">
                    <Building className="ml-2 h-5 w-5" />
                    نظام مؤسسة
                  </Label>
                </div>
                <p className="text-sm text-muted-foreground pr-6">
                  مناسب للشركات والمؤسسات. يمكنك إدارة المستخدمين والصلاحيات وتنظيم العمل الجماعي.
                </p>
              </div>
            </div>
          </div>

          {systemType === 'organization' && (
            <div className="space-y-4 border-t pt-4 mt-6">
              <div className="space-y-2">
                <Label htmlFor="organizationName" className="text-base font-medium">اسم المؤسسة</Label>
                <Input
                  id="organizationName"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  placeholder="أدخل اسم المؤسسة"
                  className="h-10 text-base"
                />
              </div>

              <div className="space-y-4 mt-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 border rounded-md bg-muted/30">
                  <div>
                    <Label htmlFor="allowSelfRegistration" className="font-medium">السماح بالتسجيل الذاتي</Label>
                    <p className="text-sm text-muted-foreground">السماح للمستخدمين بإنشاء حسابات جديدة</p>
                  </div>
                  <Switch
                    id="allowSelfRegistration"
                    checked={allowSelfRegistration}
                    onCheckedChange={setAllowSelfRegistration}
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 border rounded-md bg-muted/30">
                  <div>
                    <Label htmlFor="autoActivateUsers" className="font-medium">تفعيل المستخدمين تلقائيًا</Label>
                    <p className="text-sm text-muted-foreground">تفعيل حسابات المستخدمين الجدد دون موافقة المسؤول</p>
                  </div>
                  <Switch
                    id="autoActivateUsers"
                    checked={autoActivateUsers}
                    onCheckedChange={setAutoActivateUsers}
                  />
                </div>
              </div>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-5 w-5" />
              <AlertTitle className="text-base">خطأ</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert>
              <CheckCircle className="h-5 w-5" />
              <AlertTitle className="text-base">تم بنجاح</AlertTitle>
              <AlertDescription>تم إعداد النظام بنجاح. جاري إعادة التوجيه...</AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <Button
          onClick={setupSystem}
          disabled={isSubmitting || success || (systemType === 'organization' && !organizationName)}
          className="w-full h-12 text-base font-medium"
          size="lg"
        >
          {isSubmitting ? <Loader2 className="ml-2 h-5 w-5 animate-spin" /> : null}
          {isSubmitting ? 'جاري الإعداد...' : 'إعداد النظام'}
        </Button>
        <p className="text-xs text-center text-muted-foreground mt-2">
          يمكنك تغيير هذه الإعدادات لاحقًا من صفحة الإعدادات
        </p>
      </CardFooter>
    </Card>
  );
}
