'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Settings, Save, Loader2, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

interface OrganizationSettingsProps {
  organizationId: string;
  organizationData: any;
  isOwner: boolean;
}

export function OrganizationSettings({ organizationId, organizationData, isOwner }: OrganizationSettingsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    contactEmail: '',
    phone: '',
    address: '',
  });

  // تحميل بيانات المؤسسة
  useEffect(() => {
    if (!user || !organizationId) {
      setLoading(false);
      return;
    }

    const loadOrganizationData = async () => {
      try {
        if (organizationData) {
          setFormData({
            name: organizationData.name || '',
            description: organizationData.description || '',
            contactEmail: organizationData.contactEmail || '',
            phone: organizationData.phone || '',
            address: organizationData.address || '',
          });
          setLoading(false);
        } else {
          // إذا لم يتم تمرير بيانات المؤسسة، نقوم بجلبها من Firestore
          const orgDoc = await getDoc(doc(db, 'organizations', organizationId));
          
          if (orgDoc.exists()) {
            const data = orgDoc.data();
            setFormData({
              name: data.name || '',
              description: data.description || '',
              contactEmail: data.contactEmail || '',
              phone: data.phone || '',
              address: data.address || '',
            });
          }
          
          setLoading(false);
        }
      } catch (error) {
        console.error('Error loading organization data:', error);
        toast({
          title: 'خطأ في تحميل بيانات المؤسسة',
          description: 'حدث خطأ أثناء محاولة تحميل بيانات المؤسسة.',
          variant: 'destructive',
        });
        setLoading(false);
      }
    };

    loadOrganizationData();
  }, [user, organizationId, organizationData, toast]);

  // حفظ بيانات المؤسسة
  const handleSaveSettings = async () => {
    if (!user || !organizationId) return;

    setSaving(true);

    try {
      // تحديث بيانات المؤسسة في Firestore
      await updateDoc(doc(db, 'organizations', organizationId), {
        name: formData.name,
        description: formData.description,
        contactEmail: formData.contactEmail,
        phone: formData.phone,
        address: formData.address,
        updatedAt: new Date(),
        updatedBy: user.uid
      });

      toast({
        title: 'تم حفظ الإعدادات بنجاح',
        description: 'تم تحديث بيانات المؤسسة بنجاح.',
      });
    } catch (error: any) {
      console.error('Error saving organization settings:', error);
      toast({
        title: 'خطأ في حفظ الإعدادات',
        description: error.message || 'حدث خطأ أثناء محاولة حفظ إعدادات المؤسسة.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-40 mb-6" />
        <Skeleton className="h-10 w-full mb-4" />
        <Skeleton className="h-24 w-full mb-4" />
        <Skeleton className="h-10 w-full mb-4" />
        <Skeleton className="h-10 w-full mb-4" />
        <Skeleton className="h-10 w-full mb-4" />
        <Skeleton className="h-10 w-32 mt-6" />
      </div>
    );
  }

  // التحقق من صلاحيات المستخدم
  if (!isOwner) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <AlertTriangle className="ml-2 h-5 w-5 text-destructive" />
            غير مصرح
          </CardTitle>
          <CardDescription>
            يجب أن تكون مالك المؤسسة للوصول إلى إعدادات المؤسسة.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold flex items-center mb-6">
        <Settings className="ml-2 h-5 w-5" />
        إعدادات المؤسسة
      </h2>

      <Card>
        <CardHeader>
          <CardTitle>المعلومات الأساسية</CardTitle>
          <CardDescription>
            تعديل المعلومات الأساسية للمؤسسة.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">اسم المؤسسة</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="اسم المؤسسة"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">وصف المؤسسة</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="وصف المؤسسة"
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>معلومات الاتصال</CardTitle>
          <CardDescription>
            تعديل معلومات الاتصال بالمؤسسة.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="contactEmail">البريد الإلكتروني للتواصل</Label>
            <Input
              id="contactEmail"
              type="email"
              value={formData.contactEmail}
              onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
              placeholder="البريد الإلكتروني للتواصل"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">رقم الهاتف</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="رقم الهاتف"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">العنوان</Label>
            <Textarea
              id="address"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              placeholder="العنوان"
              rows={2}
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <Button onClick={handleSaveSettings} disabled={saving || !formData.name}>
            {saving ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                جاري الحفظ...
              </>
            ) : (
              <>
                <Save className="ml-2 h-4 w-4" />
                حفظ الإعدادات
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
