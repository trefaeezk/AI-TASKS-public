'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { Loader2, Building } from 'lucide-react';

export default function CreateOrganizationRequest() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: 'خطأ',
        description: 'يجب تسجيل الدخول لإنشاء طلب مؤسسة',
        variant: 'destructive',
      });
      return;
    }
    
    if (!name.trim()) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال اسم المؤسسة',
        variant: 'destructive',
      });
      return;
    }
    
    setLoading(true);
    
    try {
      // استدعاء دالة Firebase لإنشاء طلب مؤسسة
      const requestOrganization = httpsCallable(functions, 'requestOrganization');
      await requestOrganization({
        name,
        description,
        contactEmail: contactEmail || user.email,
        contactPhone,
      });
      
      toast({
        title: 'تم إرسال الطلب',
        description: 'تم إرسال طلب إنشاء المؤسسة بنجاح. سيتم إشعارك عند الموافقة عليه.',
      });
      
      // إعادة تعيين النموذج
      setName('');
      setDescription('');
      setContactEmail('');
      setContactPhone('');
    } catch (error: any) {
      console.error('Error requesting organization:', error);
      toast({
        title: 'خطأ',
        description: error.message || 'حدث خطأ أثناء إرسال طلب إنشاء المؤسسة',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="h-5 w-5" />
          <span>طلب إنشاء مؤسسة جديدة</span>
        </CardTitle>
        <CardDescription>
          أدخل معلومات المؤسسة التي ترغب في إنشائها. سيتم مراجعة طلبك والرد عليه في أقرب وقت ممكن.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="org-name">اسم المؤسسة *</Label>
            <Input
              id="org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="أدخل اسم المؤسسة"
              required
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="org-description">وصف المؤسسة</Label>
            <Textarea
              id="org-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="أدخل وصفًا موجزًا للمؤسسة ونشاطها"
              rows={3}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="contact-email">البريد الإلكتروني للتواصل</Label>
            <Input
              id="contact-email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder={user?.email || 'أدخل البريد الإلكتروني للتواصل'}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="contact-phone">رقم الهاتف للتواصل</Label>
            <Input
              id="contact-phone"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              placeholder="أدخل رقم الهاتف للتواصل"
            />
          </div>
        </CardContent>
        <CardFooter>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                جاري إرسال الطلب...
              </>
            ) : (
              'إرسال طلب إنشاء المؤسسة'
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
