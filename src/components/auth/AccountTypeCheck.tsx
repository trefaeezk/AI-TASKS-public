'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, User, Building } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { SystemType } from '@/types/system';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';

export default function AccountTypeCheck() {
  const { user, refreshUserData, userClaims } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [accountType, setAccountType] = useState<SystemType>('individual');
  const [organizationId, setOrganizationId] = useState('');
  const [departmentId, setDepartmentId] = useState('');

  // تحميل نوع الحساب من custom claims
  useEffect(() => {
    // تجنب التحديثات المتكررة
    let isActive = true;
    let refreshAttempted = false; // لتتبع ما إذا كانت محاولة التحديث قد تمت بالفعل

    const loadUserData = async () => {
      if (userClaims && isActive) {
        // إذا كان لدينا بالفعل معلومات المستخدم، نستخدمها
        setAccountType(userClaims.accountType as SystemType || 'individual');
        setOrganizationId(userClaims.organizationId || '');
        setDepartmentId(userClaims.departmentId || '');
        setLoading(false);
      } else if (user && isActive && !refreshAttempted) {
        // إذا كان المستخدم موجودًا ولكن ليس لديه custom claims، نحاول تحديث البيانات مرة واحدة فقط
        refreshAttempted = true;
        try {
          // إضافة تأخير قبل محاولة التحديث لتجنب تجاوز الحصة
          setTimeout(async () => {
            if (isActive) {
              try {
                await refreshUserData();
              } catch (error) {
                console.error('Error refreshing user data:', error);
              } finally {
                if (isActive) {
                  setLoading(false);
                }
              }
            }
          }, 1000);
        } catch (error) {
          console.error('Error setting timeout:', error);
          if (isActive) {
            setLoading(false);
          }
        }
      } else if (isActive) {
        setLoading(false);
      }
    };

    loadUserData();

    // تنظيف عند تفكيك المكون
    return () => {
      isActive = false;
    };
  }, [user, userClaims, refreshUserData]);

  // التحقق من نوع الحساب
  const verifyAccountType = async () => {
    if (!user) return;

    setVerifying(true);
    try {
      // استدعاء دالة Firebase للتحقق من نوع الحساب
      const verifyAccountTypeFunc = httpsCallable(functions, 'verifyAccountType');
      const result = await verifyAccountTypeFunc({
        requestedType: accountType,
        organizationId: accountType === 'organization' ? organizationId : undefined,
        departmentId: accountType === 'organization' && departmentId ? departmentId : undefined
      });

      const data = result.data as any;

      if (data.success) {
        // تحديث نوع الحساب في custom claims
        const updateAccountTypeFunc = httpsCallable(functions, 'updateAccountType');
        await updateAccountTypeFunc({
          accountType,
          organizationId: accountType === 'organization' ? organizationId : undefined,
          departmentId: accountType === 'organization' && departmentId ? departmentId : undefined
        });

        // تحديث معلومات المستخدم بعد تأخير قصير
        setTimeout(async () => {
          try {
            await refreshUserData();
          } catch (error) {
            console.error('Error refreshing user data after account type update:', error);
          }
        }, 2000); // تأخير لمدة 2 ثانية

        toast({
          title: 'تم التحقق بنجاح',
          description: `تم التحقق من نوع الحساب بنجاح: ${accountType === 'individual' ? 'فردي' : 'مؤسسة'}`,
        });

        // إعادة توجيه المستخدم إلى الصفحة الرئيسية بعد تأخير قصير
        setTimeout(() => {
          router.push('/');
        }, 500);
      }
    } catch (error: any) {
      console.error('Error verifying account type:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء التحقق من نوع الحساب',
        variant: 'destructive',
      });
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>التحقق من نوع الحساب</CardTitle>
        <CardDescription>
          يرجى اختيار نوع الحساب الذي تريد الدخول إليه
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="account-type">نوع الحساب</Label>
          <Select
            value={accountType}
            onValueChange={(value) => setAccountType(value as SystemType)}
            disabled={verifying}
          >
            <SelectTrigger id="account-type" className="w-full">
              <SelectValue placeholder="اختر نوع الحساب" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="individual">
                <div className="flex items-center">
                  <User className="ml-2 h-4 w-4" />
                  <span>حساب فردي</span>
                </div>
              </SelectItem>
              <SelectItem value="organization">
                <div className="flex items-center">
                  <Building className="ml-2 h-4 w-4" />
                  <span>حساب مؤسسة</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {accountType === 'organization' && (
          <>
            <div className="space-y-2">
              <Label htmlFor="organization-id">معرف المؤسسة</Label>
              <Input
                id="organization-id"
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                disabled={verifying}
                placeholder="أدخل معرف المؤسسة"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="department-id">معرف القسم (اختياري)</Label>
              <Input
                id="department-id"
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                disabled={verifying}
                placeholder="أدخل معرف القسم (اختياري)"
              />
            </div>
          </>
        )}
      </CardContent>
      <CardFooter>
        <Button
          className="w-full"
          onClick={verifyAccountType}
          disabled={verifying || (accountType === 'organization' && !organizationId)}
        >
          {verifying && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
          {verifying ? 'جاري التحقق...' : 'تأكيد'}
        </Button>
      </CardFooter>
    </Card>
  );
}
