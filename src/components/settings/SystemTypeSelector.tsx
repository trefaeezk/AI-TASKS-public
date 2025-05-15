'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { User, Building, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { SystemType } from '@/types/system';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

interface SystemTypeSelectorProps {
  onSystemTypeChange?: (type: SystemType) => void;
}

export default function SystemTypeSelector({ onSystemTypeChange }: SystemTypeSelectorProps) {
  const { user, refreshUserData } = useAuth();
  const { toast } = useToast();
  const [systemType, setSystemType] = useState<SystemType | null>(null);
  const [loading, setLoading] = useState(true);
  const [changing, setChanging] = useState(false);

  // تحميل نوع النظام الحالي
  useEffect(() => {
    const loadSystemType = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // التحقق من نوع الحساب
        const userDoc = await getDoc(doc(db, 'individuals', user.uid));
        if (userDoc.exists()) {
          setSystemType('individual');
        } else {
          // التحقق من عضوية المؤسسات
          const orgMemberships = await getDoc(doc(db, 'users', user.uid));
          if (orgMemberships.exists() && orgMemberships.data()?.role) {
            setSystemType('organization');
          } else {
            // التحقق من إعدادات النظام العامة
            const settingsDoc = await getDoc(doc(db, 'system', 'settings'));
            if (settingsDoc.exists()) {
              setSystemType(settingsDoc.data()?.type || 'individual');
            } else {
              setSystemType('individual'); // الافتراضي
            }
          }
        }
      } catch (error) {
        console.error('Error loading system type:', error);
        toast({
          title: 'خطأ',
          description: 'حدث خطأ أثناء تحميل نوع النظام',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadSystemType();
  }, [user, toast]);

  // تغيير نوع النظام
  const handleSystemTypeChange = async (newType: SystemType) => {
    console.log("تم النقر على زر تطبيق التغييرات، النوع المحدد:", newType);

    if (!user || changing) {
      console.log("لا يمكن تغيير النظام:", {
        userExists: !!user,
        alreadyChanging: changing
      });
      return;
    }

    // إذا كان النوع الجديد هو نفس النوع الحالي، نسمح بالتغيير ولكن نسجل ذلك
    if (newType === systemType) {
      console.log("تطبيق نفس نوع النظام الحالي:", newType);
    }

    setChanging(true);
    try {
      console.log("بدء تغيير نوع النظام إلى:", newType);

      // استدعاء دالة Firebase لتغيير نوع النظام
      const switchSystemType = httpsCallable(functions, 'switchSystemType');
      console.log("قبل استدعاء دالة switchSystemType");
      const result = await switchSystemType({ type: newType });
      console.log("نتيجة استدعاء دالة switchSystemType:", result);

      // تحديث الحالة المحلية
      setSystemType(newType);
      console.log("تم تحديث الحالة المحلية إلى:", newType);

      // تحديث معلومات المستخدم
      console.log("قبل تحديث معلومات المستخدم");
      await refreshUserData();
      console.log("بعد تحديث معلومات المستخدم");

      // إخطار المستخدم
      toast({
        title: 'تم تغيير نوع النظام',
        description: `تم التحويل إلى نظام ${newType === 'individual' ? 'الأفراد' : 'المؤسسات'} بنجاح`,
      });
      console.log("تم عرض رسالة النجاح");

      // استدعاء دالة رد الاتصال إذا تم توفيرها
      if (onSystemTypeChange) {
        onSystemTypeChange(newType);
        console.log("تم استدعاء دالة رد الاتصال");
      }
    } catch (error: any) {
      console.error('Error changing system type:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء تغيير نوع النظام',
        variant: 'destructive',
      });
    } finally {
      setChanging(false);
      console.log("تم الانتهاء من عملية تغيير النظام");
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>نوع النظام</CardTitle>
          <CardDescription>جاري تحميل نوع النظام...</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>نوع النظام</CardTitle>
        <CardDescription>اختر نوع النظام الذي تريد استخدامه</CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={systemType || undefined}
          onValueChange={(value) => setSystemType(value as SystemType)}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4"
        >
          {/* نظام الأفراد */}
          <div className={`border rounded-lg p-4 cursor-pointer transition-all ${
            systemType === 'individual'
              ? 'border-primary bg-primary/10 shadow-md'
              : 'border-border hover:border-primary/50 hover:bg-muted'
          }`}>
            <div className="flex items-center mb-2">
              <RadioGroupItem
                value="individual"
                id="individual-system"
                checked={systemType === 'individual'}
                className="ml-2"
              />
              <Label htmlFor="individual-system" className="flex items-center text-lg font-medium cursor-pointer">
                <User className="ml-2 h-5 w-5" />
                نظام الأفراد
              </Label>
            </div>
            <p className="text-sm text-muted-foreground pr-6">
              للاستخدام الشخصي. أنت المالك الوحيد للنظام وتتحكم في جميع البيانات.
            </p>
          </div>

          {/* نظام المؤسسات */}
          <div className={`border rounded-lg p-4 cursor-pointer transition-all ${
            systemType === 'organization'
              ? 'border-primary bg-primary/10 shadow-md'
              : 'border-border hover:border-primary/50 hover:bg-muted'
          }`}>
            <div className="flex items-center mb-2">
              <RadioGroupItem
                value="organization"
                id="organization-system"
                checked={systemType === 'organization'}
                className="ml-2"
              />
              <Label htmlFor="organization-system" className="flex items-center text-lg font-medium cursor-pointer">
                <Building className="ml-2 h-5 w-5" />
                نظام المؤسسات
              </Label>
            </div>
            <p className="text-sm text-muted-foreground pr-6">
              للشركات والمؤسسات. يمكنك إدارة المستخدمين والصلاحيات وتنظيم العمل الجماعي.
            </p>
          </div>
        </RadioGroup>

        <Button
          onClick={() => {
            console.log("تم النقر على الزر");
            if (systemType) {
              console.log("استدعاء handleSystemTypeChange مع النوع:", systemType);
              handleSystemTypeChange(systemType);
            } else {
              console.log("لا يمكن استدعاء handleSystemTypeChange، نوع النظام غير محدد");
            }
          }}
          disabled={!systemType || changing}
          className="w-full"
        >
          {changing && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
          {changing ? 'جاري تغيير النظام...' : 'تطبيق التغييرات'}
        </Button>
      </CardContent>
    </Card>
  );
}
