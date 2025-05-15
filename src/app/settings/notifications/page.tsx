'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Bell, Mail, Clock, Calendar, CheckCircle, AlertTriangle, Wand2, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { NotificationSettings, NotificationType } from '@/types/notification';
import { getUserNotificationSettings, updateUserNotificationSettings } from '@/services/notifications';

export default function NotificationSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings | null>(null);

  // تحميل إعدادات الإشعارات
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchSettings = async () => {
      try {
        const userSettings = await getUserNotificationSettings(user.uid);
        setSettings(userSettings);
      } catch (error) {
        console.error('Error fetching notification settings:', error);
        toast({
          title: 'خطأ',
          description: 'حدث خطأ أثناء تحميل إعدادات الإشعارات',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [user, toast]);

  // تحديث الإعدادات
  const handleUpdateSettings = async () => {
    if (!user || !settings) return;

    try {
      setSaving(true);
      await updateUserNotificationSettings(user.uid, settings);
      toast({
        title: 'تم الحفظ',
        description: 'تم حفظ إعدادات الإشعارات بنجاح',
      });
    } catch (error) {
      console.error('Error updating notification settings:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء حفظ إعدادات الإشعارات',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // تحديث قيمة إعداد
  const updateSetting = <K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) => {
    if (!settings) return;
    setSettings({
      ...settings,
      [key]: value,
    });
  };

  // تحديث قائمة أنواع الإشعارات المستبعدة
  const toggleExcludedType = (type: NotificationType) => {
    if (!settings) return;

    const excludedTypes = settings.excludedTypes || [];
    const newExcludedTypes = excludedTypes.includes(type)
      ? excludedTypes.filter(t => t !== type)
      : [...excludedTypes, type];

    setSettings({
      ...settings,
      excludedTypes: newExcludedTypes,
    });
  };

  // التحقق مما إذا كان نوع الإشعار مستبعدًا
  const isTypeExcluded = (type: NotificationType) => {
    if (!settings || !settings.excludedTypes) return false;
    return settings.excludedTypes.includes(type);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">إعدادات الإشعارات</h1>
        <div className="space-y-6">
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-[300px] w-full" />
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-6">إعدادات الإشعارات</h1>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              يرجى تسجيل الدخول لعرض إعدادات الإشعارات.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center mb-6">
        <Bell className="ml-2 h-6 w-6" />
        <h1 className="text-2xl font-bold">إعدادات الإشعارات</h1>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>إعدادات عامة</CardTitle>
            <CardDescription>
              تخصيص كيفية استلام الإشعارات
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enablePushNotifications">إشعارات التطبيق</Label>
                <p className="text-sm text-muted-foreground">
                  استلام إشعارات داخل التطبيق
                </p>
              </div>
              <Switch
                id="enablePushNotifications"
                checked={settings.enablePushNotifications}
                onCheckedChange={(checked) => updateSetting('enablePushNotifications', checked)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enableEmailNotifications">إشعارات البريد الإلكتروني</Label>
                <p className="text-sm text-muted-foreground">
                  استلام إشعارات عبر البريد الإلكتروني
                </p>
              </div>
              <Switch
                id="enableEmailNotifications"
                checked={settings.enableEmailNotifications}
                onCheckedChange={(checked) => updateSetting('enableEmailNotifications', checked)}
              />
            </div>
            {settings.enableEmailNotifications && (
              <div className="pr-8">
                <Label htmlFor="emailFrequency">تكرار البريد الإلكتروني</Label>
                <Select
                  value={settings.emailFrequency}
                  onValueChange={(value) => updateSetting('emailFrequency', value as any)}
                >
                  <SelectTrigger id="emailFrequency" className="mt-1">
                    <SelectValue placeholder="اختر تكرار البريد الإلكتروني" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">فوري</SelectItem>
                    <SelectItem value="daily">يومي (ملخص)</SelectItem>
                    <SelectItem value="weekly">أسبوعي (ملخص)</SelectItem>
                    <SelectItem value="never">أبدًا</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enableAiSuggestions">اقتراحات الذكاء الاصطناعي</Label>
                <p className="text-sm text-muted-foreground">
                  استلام اقتراحات ذكية لتحسين الإنتاجية
                </p>
              </div>
              <Switch
                id="enableAiSuggestions"
                checked={settings.enableAiSuggestions}
                onCheckedChange={(checked) => updateSetting('enableAiSuggestions', checked)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>أنواع الإشعارات</CardTitle>
            <CardDescription>
              اختر أنواع الإشعارات التي ترغب في استلامها
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle className="ml-2 h-4 w-4 text-primary" />
                <div>
                  <Label>إشعارات المهام</Label>
                  <p className="text-sm text-muted-foreground">
                    إنشاء المهام، تعيين المهام، تغيير الحالة
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.enableTaskNotifications}
                onCheckedChange={(checked) => updateSetting('enableTaskNotifications', checked)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Calendar className="ml-2 h-4 w-4 text-blue-500" />
                <div>
                  <Label>إشعارات الاجتماعات</Label>
                  <p className="text-sm text-muted-foreground">
                    إنشاء الاجتماعات، تذكيرات، تحديثات
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.enableMeetingNotifications}
                onCheckedChange={(checked) => updateSetting('enableMeetingNotifications', checked)}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Info className="ml-2 h-4 w-4 text-muted-foreground" />
                <div>
                  <Label>إشعارات النظام</Label>
                  <p className="text-sm text-muted-foreground">
                    تحديثات النظام، إضافة أعضاء، إنشاء أقسام
                  </p>
                </div>
              </div>
              <Switch
                checked={settings.enableSystemNotifications}
                onCheckedChange={(checked) => updateSetting('enableSystemNotifications', checked)}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>وقت عدم الإزعاج</CardTitle>
            <CardDescription>
              تعيين فترة زمنية لا ترغب في استلام إشعارات خلالها
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="doNotDisturb">تفعيل وقت عدم الإزعاج</Label>
              <Switch
                id="doNotDisturb"
                checked={!!settings.doNotDisturbStart && !!settings.doNotDisturbEnd}
                onCheckedChange={(checked) => {
                  if (checked) {
                    updateSetting('doNotDisturbStart', '22:00');
                    updateSetting('doNotDisturbEnd', '08:00');
                  } else {
                    updateSetting('doNotDisturbStart', undefined);
                    updateSetting('doNotDisturbEnd', undefined);
                  }
                }}
              />
            </div>
            {settings.doNotDisturbStart && settings.doNotDisturbEnd && (
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div>
                  <Label htmlFor="doNotDisturbStart">من</Label>
                  <Input
                    id="doNotDisturbStart"
                    type="time"
                    value={settings.doNotDisturbStart}
                    onChange={(e) => updateSetting('doNotDisturbStart', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="doNotDisturbEnd">إلى</Label>
                  <Input
                    id="doNotDisturbEnd"
                    type="time"
                    value={settings.doNotDisturbEnd}
                    onChange={(e) => updateSetting('doNotDisturbEnd', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-end">
            <Button onClick={handleUpdateSettings} disabled={saving}>
              {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
