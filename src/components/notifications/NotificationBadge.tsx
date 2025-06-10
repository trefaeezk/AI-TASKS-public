/**
 * مكون عرض شارة الإشعارات غير المقروءة
 */

import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { subscribeToUserNotifications } from '@/services/notifications';
import { Notification } from '@/types/notification';

interface NotificationBadgeProps {
  onClick?: () => void;
  className?: string;
}

export function NotificationBadge({ onClick, className }: NotificationBadgeProps) {
  const { user, userClaims } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setPendingApprovalCount(0);
      return;
    }

    // الاستماع للإشعارات غير المقروءة
    const unsubscribe = subscribeToUserNotifications(
      user.uid,
      (notifications: Notification[]) => {
        const unread = notifications.filter(n => n.status === 'unread');
        setUnreadCount(unread.length);

        // عد الإشعارات المعلقة للموافقة للمسئولين
        if (userClaims?.isOrgOwner || userClaims?.isOrgAdmin || 
            userClaims?.isOrgSupervisor || userClaims?.isOrgEngineer) {
          const pendingApprovals = unread.filter(n => n.type === 'task_approval_pending');
          setPendingApprovalCount(pendingApprovals.length);
        } else {
          setPendingApprovalCount(0);
        }
      },
      {
        status: 'unread',
        limit: 50,
        organizationId: userClaims?.organizationId
      }
    );

    return () => unsubscribe();
  }, [user, userClaims]);

  const totalCount = unreadCount;
  const hasHighPriority = pendingApprovalCount > 0;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className={`relative ${className}`}
      aria-label={`الإشعارات${totalCount > 0 ? ` (${totalCount} غير مقروء)` : ''}`}
    >
      <Bell className={`h-5 w-5 ${hasHighPriority ? 'text-orange-600' : ''}`} />
      
      {totalCount > 0 && (
        <Badge 
          variant={hasHighPriority ? "destructive" : "default"}
          className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs font-bold min-w-[20px]"
        >
          {totalCount > 99 ? '99+' : totalCount}
        </Badge>
      )}
      
      {/* نقطة إضافية للمهام المعلقة للموافقة */}
      {pendingApprovalCount > 0 && (
        <div className="absolute -top-0.5 -right-0.5 h-3 w-3 bg-orange-500 rounded-full border-2 border-background animate-pulse" />
      )}
    </Button>
  );
}

/**
 * مكون مبسط لعرض عدد الإشعارات فقط
 */
export function NotificationCount() {
  const { user, userClaims } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    const unsubscribe = subscribeToUserNotifications(
      user.uid,
      (notifications: Notification[]) => {
        const unread = notifications.filter(n => n.status === 'unread');
        setUnreadCount(unread.length);
      },
      {
        status: 'unread',
        limit: 50,
        organizationId: userClaims?.organizationId
      }
    );

    return () => unsubscribe();
  }, [user, userClaims]);

  if (unreadCount === 0) return null;

  return (
    <Badge variant="destructive" className="ml-2">
      {unreadCount > 99 ? '99+' : unreadCount}
    </Badge>
  );
}

// تم حذف PendingApprovalBadge - استبدل بـ PendingApprovalPopover
