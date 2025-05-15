'use client';

/**
 * صفحة إعدادات المؤسسة
 *
 * تتيح هذه الصفحة للمستخدمين الذين لديهم صلاحيات مناسبة تعديل إعدادات المؤسسة.
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useAccountType } from '@/hooks/useAccountType';
import { db } from '@/config/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save } from 'lucide-react';

interface OrganizationSettings {
  name: string;
  description: string;
  logo?: string;
  contactEmail: string;
  contactPhone?: string;
  address?: string;
  website?: string;
  allowMemberInvites: boolean;
  allowDepartmentCreation: boolean;
  requireTaskApproval: boolean;
  enableAIFeatures: boolean;
}

export default function OrganizationSettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { role, hasPermission } = usePermissions();
  const { organizationId, isOrganization } = useAccountType();
  const { toast } = useToast();

  const [settings, setSettings] = useState<OrganizationSettings>({
    name: '',
    description: '',
    contactEmail: '',
    allowMemberInvites: false,
    allowDepartmentCreation: false,
    requireTaskApproval: false,
    enableAIFeatures: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  // التحقق من الصلاحيات
  const canEdit = role === 'owner' || role === 'admin' || hasPermission('organization.edit');

  // جلب إعدادات المؤسسة
  useEffect(() => {
    if (!user || !isOrganization || !organizationId) {
      router.push('/org');
      return;
    }

    const fetchSettings = async () => {
      try {
        setLoading(true);
        const orgDoc = await getDoc(doc(db, 'organizations', organizationId));

        if (orgDoc.exists()) {
          const orgData = orgDoc.data() as OrganizationSettings;
          setSettings(orgData);
        } else {
          toast({
            title: 'خطأ',
            description: 'لم يتم العثور على بيانات المؤسسة',
            variant: 'destructive',
          });
          router.push('/org');
        }
      } catch (error) {
        console.error('Error fetching organization settings:', error);
        toast({
          title: 'خطأ',
          description: 'حدث خطأ أثناء جلب إعدادات المؤسسة',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [user, isOrganization, organizationId, router]);

  // حفظ إعدادات المؤسسة
  const handleSave = async () => {
    if (!organizationId) return;

    try {
      setSaving(true);
      await updateDoc(doc(db, 'organizations', organizationId), {
        ...settings,
        updatedAt: new Date(),
        updatedBy: user?.uid,
      });

      toast({
        title: 'تم الحفظ',
        description: 'تم حفظ إعدادات المؤسسة بنجاح',
      });
    } catch (error) {
      console.error('Error saving organization settings:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء حفظ إعدادات المؤسسة',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // تحديث قيمة في الإعدادات
  const handleChange = (key: keyof OrganizationSettings, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container py-6 space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">إعدادات المؤسسة</h1>
        <p className="text-muted-foreground">
          إدارة إعدادات المؤسسة والتفضيلات العامة
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="general">عام</TabsTrigger>
          <TabsTrigger value="permissions">الصلاحيات</TabsTrigger>
          <TabsTrigger value="features">الميزات</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>المعلومات الأساسية</CardTitle>
              <CardDescription>
                المعلومات الأساسية عن المؤسسة
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">اسم المؤسسة</Label>
                  <Input
                    id="name"
                    value={settings.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">البريد الإلكتروني للتواصل</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={settings.contactEmail}
                    onChange={(e) => handleChange('contactEmail', e.target.value)}
                    disabled={!canEdit}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">وصف المؤسسة</Label>
                <Textarea
                  id="description"
                  value={settings.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  disabled={!canEdit}
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">رقم الهاتف</Label>
                  <Input
                    id="contactPhone"
                    value={settings.contactPhone || ''}
                    onChange={(e) => handleChange('contactPhone', e.target.value)}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">الموقع الإلكتروني</Label>
                  <Input
                    id="website"
                    value={settings.website || ''}
                    onChange={(e) => handleChange('website', e.target.value)}
                    disabled={!canEdit}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">العنوان</Label>
                <Textarea
                  id="address"
                  value={settings.address || ''}
                  onChange={(e) => handleChange('address', e.target.value)}
                  disabled={!canEdit}
                  rows={2}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleSave}
                disabled={!canEdit || saving}
              >
                {saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                <Save className="ml-2 h-4 w-4" />
                حفظ التغييرات
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="permissions">
          <Card>
            <CardHeader>
              <CardTitle>إعدادات الصلاحيات</CardTitle>
              <CardDescription>
                تحكم في صلاحيات أعضاء المؤسسة
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>السماح بدعوة أعضاء جدد</Label>
                  <p className="text-sm text-muted-foreground">
                    السماح للمشرفين بدعوة أعضاء جدد للمؤسسة
                  </p>
                </div>
                <Switch
                  checked={settings.allowMemberInvites}
                  onCheckedChange={(checked) => handleChange('allowMemberInvites', checked)}
                  disabled={!canEdit}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>السماح بإنشاء أقسام جديدة</Label>
                  <p className="text-sm text-muted-foreground">
                    السماح للمشرفين بإنشاء أقسام جديدة في المؤسسة
                  </p>
                </div>
                <Switch
                  checked={settings.allowDepartmentCreation}
                  onCheckedChange={(checked) => handleChange('allowDepartmentCreation', checked)}
                  disabled={!canEdit}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>طلب موافقة على المهام</Label>
                  <p className="text-sm text-muted-foreground">
                    طلب موافقة المشرف على المهام الجديدة قبل نشرها
                  </p>
                </div>
                <Switch
                  checked={settings.requireTaskApproval}
                  onCheckedChange={(checked) => handleChange('requireTaskApproval', checked)}
                  disabled={!canEdit}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleSave}
                disabled={!canEdit || saving}
              >
                {saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                <Save className="ml-2 h-4 w-4" />
                حفظ التغييرات
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="features">
          <Card>
            <CardHeader>
              <CardTitle>الميزات المتقدمة</CardTitle>
              <CardDescription>
                تفعيل أو تعطيل الميزات المتقدمة في النظام
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>ميزات الذكاء الاصطناعي</Label>
                  <p className="text-sm text-muted-foreground">
                    تفعيل ميزات الذكاء الاصطناعي مثل اقتراح المهام وتوليد التقارير
                  </p>
                </div>
                <Switch
                  checked={settings.enableAIFeatures}
                  onCheckedChange={(checked) => handleChange('enableAIFeatures', checked)}
                  disabled={!canEdit}
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleSave}
                disabled={!canEdit || saving}
              >
                {saving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                <Save className="ml-2 h-4 w-4" />
                حفظ التغييرات
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
