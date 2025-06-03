'use client';

/**
 * Organization Settings Page
 *
 * This page allows users with appropriate permissions to modify organization settings.
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useAccountType } from '@/hooks/useAccountType';
import { useLanguage } from '@/context/LanguageContext';
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
import { Loader2, Save, ArrowRight, Bell, Languages } from 'lucide-react';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Translate } from '@/components/Translate';
import Link from 'next/link';

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
  const { t, direction } = useLanguage();

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

  // Check permissions
  const canEdit = role === 'org_owner'  || role === 'org_admin' || hasPermission('organization.edit');

  // Fetch organization settings
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
            title: t('common.error'),
            description: t('organization.organizationDataNotFound'),
            variant: 'destructive',
          });
          router.push('/org');
        }
      } catch (error) {
        console.error('Error fetching organization settings:', error);
        toast({
          title: t('common.error'),
          description: t('organization.errorFetchingOrganizationSettings'),
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [user, isOrganization, organizationId, router]);

  // Save organization settings
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
        title: t('settings.settingsSaved'),
        description: t('organization.organizationSettingsSaved'),
      });
    } catch (error) {
      console.error('Error saving organization settings:', error);
      toast({
        title: t('common.error'),
        description: t('organization.errorSavingOrganizationSettings'),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Update a value in settings
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
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight"><Translate text="organization.organizationSettings" /></h1>
          <LanguageSwitcher variant="default" size="sm" />
        </div>
        <p className="text-muted-foreground">
          <Translate text="settings.generalSettings" defaultValue="إدارة إعدادات المؤسسة والتفضيلات العامة" />
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="general"><Translate text="general.general" defaultValue="عام" /></TabsTrigger>
          <TabsTrigger value="permissions"><Translate text="organization.organizationPermissions" defaultValue="الصلاحيات" /></TabsTrigger>
          <TabsTrigger value="features"><Translate text="settings.features" defaultValue="الميزات" /></TabsTrigger>
          <TabsTrigger value="notifications"><Translate text="notifications.notifications" defaultValue="الإشعارات" /></TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>{t('organization.basicInformation')}</CardTitle>
              <CardDescription>
                {t('organization.basicInformationDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t('organization.organizationName')}</Label>
                  <Input
                    id="name"
                    value={settings.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">{t('organization.organizationEmail')}</Label>
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
                <Label htmlFor="description">{t('organization.organizationDescription')}</Label>
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
                  <Label htmlFor="contactPhone">{t('organization.organizationPhone')}</Label>
                  <Input
                    id="contactPhone"
                    value={settings.contactPhone || ''}
                    onChange={(e) => handleChange('contactPhone', e.target.value)}
                    disabled={!canEdit}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">{t('organization.organizationWebsite')}</Label>
                  <Input
                    id="website"
                    value={settings.website || ''}
                    onChange={(e) => handleChange('website', e.target.value)}
                    disabled={!canEdit}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">{t('organization.organizationAddress')}</Label>
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
                {saving && <Loader2 className={`${direction === 'rtl' ? 'ml-2' : 'mr-2'} h-4 w-4 animate-spin`} />}
                <Save className={`${direction === 'rtl' ? 'ml-2' : 'mr-2'} h-4 w-4`} />
                {t('settings.saveSettings')}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="permissions">
          <Card>
            <CardHeader>
              <CardTitle>{t('organization.permissionsSettings')}</CardTitle>
              <CardDescription>
                {t('organization.permissionsSettingsDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t('organization.allowMemberInvites')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('organization.allowMemberInvitesDescription')}
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
                  <Label>{t('organization.allowDepartmentCreation')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('organization.allowDepartmentCreationDescription')}
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
                  <Label>{t('organization.requireTaskApproval')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('organization.requireTaskApprovalDescription')}
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
                {saving && <Loader2 className={`${direction === 'rtl' ? 'ml-2' : 'mr-2'} h-4 w-4 animate-spin`} />}
                <Save className={`${direction === 'rtl' ? 'ml-2' : 'mr-2'} h-4 w-4`} />
                {t('settings.saveSettings')}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="features">
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.advancedSettings')}</CardTitle>
              <CardDescription>
                {t('organization.advancedFeaturesDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t('organization.aiFeatures')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('organization.aiFeaturesDescription')}
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
                {saving && <Loader2 className={`${direction === 'rtl' ? 'ml-2' : 'mr-2'} h-4 w-4 animate-spin`} />}
                <Save className={`${direction === 'rtl' ? 'ml-2' : 'mr-2'} h-4 w-4`} />
                {t('settings.saveSettings')}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>{t('notifications.notificationSettings')}</CardTitle>
              <CardDescription>
                {t('notifications.notificationSettingsDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t('notifications.notificationSettings')}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t('notifications.customizeNotifications')}
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/org/settings/notifications" className="flex items-center">
                    <span>{t('notifications.manageNotifications')}</span>
                    <ArrowRight className={`${direction === 'rtl' ? 'mr-2' : 'ml-2'} h-4 w-4`} />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
