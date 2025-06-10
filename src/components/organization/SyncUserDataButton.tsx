'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { Loader2, RefreshCw } from 'lucide-react';

interface SyncUserDataButtonProps {
  userId: string;
  organizationId: string;
  correctName?: string;
  onSyncComplete?: () => void;
}

export function SyncUserDataButton({ 
  userId, 
  organizationId, 
  correctName, 
  onSyncComplete 
}: SyncUserDataButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  const handleSync = async () => {
    setSyncing(true);
    
    try {
      const syncUserData = httpsCallable(functions, 'syncUserData');
      const result = await syncUserData({
        userId,
        organizationId,
        correctName
      });

      const data = result.data as any;
      
      toast({
        title: 'تم مزامنة البيانات بنجاح',
        description: `تم تحديث الاسم إلى: ${data.finalName}`,
      });

      if (onSyncComplete) {
        onSyncComplete();
      }
    } catch (error: any) {
      console.error('Error syncing user data:', error);
      toast({
        title: 'خطأ في مزامنة البيانات',
        description: error.message || 'حدث خطأ أثناء محاولة مزامنة البيانات.',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Button
      onClick={handleSync}
      disabled={syncing}
      variant="outline"
      size="sm"
      className="flex items-center gap-2"
    >
      {syncing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
      {syncing ? 'جاري المزامنة...' : 'مزامنة البيانات'}
    </Button>
  );
}

interface SyncAllMembersButtonProps {
  organizationId: string;
  onSyncComplete?: () => void;
}

export function SyncAllMembersButton({ 
  organizationId, 
  onSyncComplete 
}: SyncAllMembersButtonProps) {
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  const handleSyncAll = async () => {
    setSyncing(true);
    
    try {
      const syncAllOrganizationMembersData = httpsCallable(functions, 'syncAllOrganizationMembersData');
      const result = await syncAllOrganizationMembersData({
        organizationId
      });

      const data = result.data as any;
      
      toast({
        title: 'تم مزامنة جميع البيانات بنجاح',
        description: `تم مزامنة ${data.syncedCount} عضو من أصل ${data.totalCount}`,
      });

      if (data.errors && data.errors.length > 0) {
        console.warn('Sync errors:', data.errors);
        toast({
          title: 'تحذير',
          description: `تم مزامنة البيانات مع بعض الأخطاء. راجع وحدة التحكم للتفاصيل.`,
          variant: 'destructive',
        });
      }

      if (onSyncComplete) {
        onSyncComplete();
      }
    } catch (error: any) {
      console.error('Error syncing all members data:', error);
      toast({
        title: 'خطأ في مزامنة البيانات',
        description: error.message || 'حدث خطأ أثناء محاولة مزامنة بيانات جميع الأعضاء.',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Button
      onClick={handleSyncAll}
      disabled={syncing}
      variant="outline"
      size="sm"
      className="flex items-center gap-2"
    >
      {syncing ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <RefreshCw className="h-4 w-4" />
      )}
      {syncing ? 'جاري مزامنة الجميع...' : 'مزامنة جميع الأعضاء'}
    </Button>
  );
}
