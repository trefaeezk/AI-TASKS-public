'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  Bell,
  CheckCircle,
  Clock,
  Calendar,
  AlertTriangle,
  Info,
  Wand2,
  X,
  Check,
  Settings
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Notification, NotificationType } from '@/types/notification';
import {
  getUserNotifications,
  subscribeToUserNotifications,
  updateNotificationStatus,
  markAllNotificationsAsRead
} from '@/services/notifications';
import Link from 'next/link';

export function NotificationsPopover() {
  const { user, userClaims } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  const organizationId = userClaims?.organizationId;

  // الاستماع للإشعارات في الوقت الفعلي
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    setLoading(true);

    // الاشتراك في الإشعارات
    const unsubscribe = subscribeToUserNotifications(
      user.uid,
      (fetchedNotifications) => {
        setNotifications(fetchedNotifications);
        setUnreadCount(fetchedNotifications.filter(n => n.status === 'unread').length);
        setLoading(false);
      },
      {
        limit: 20,
        organizationId,
      }
    );

    return () => unsubscribe();
  }, [user, organizationId]);

  // تعليم الإشعار كمقروء عند النقر عليه
  const handleNotificationClick = async (notification: Notification) => {
    if (notification.status === 'unread') {
      try {
        await updateNotificationStatus(notification.id, 'read');
      } catch (error) {
        console.error('Error marking notification as read:', error);
      }
    }

    // إذا كان هناك رابط للإجراء، قم بإغلاق القائمة
    if (notification.actionLink) {
      setIsOpen(false);
    }
  };

  // تعليم جميع الإشعارات كمقروءة
  const handleMarkAllAsRead = async () => {
    if (!user) return;

    try {
      await markAllNotificationsAsRead(user.uid);
      toast({
        title: 'تم تعليم جميع الإشعارات كمقروءة',
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء تعليم الإشعارات كمقروءة',
        variant: 'destructive',
      });
    }
  };

  // الحصول على أيقونة الإشعار حسب النوع
  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'task_created':
      case 'task_assigned':
      case 'task_status_changed':
        return <CheckCircle className="h-4 w-4 text-primary" />;
      case 'task_due_soon':
        return <Clock className="h-4 w-4 text-amber-500" />;
      case 'task_overdue':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'task_completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'meeting_created':
      case 'meeting_reminder':
      case 'meeting_updated':
      case 'meeting_cancelled':
        return <Calendar className="h-4 w-4 text-blue-500" />;
      case 'department_created':
      case 'member_added':
        return <Info className="h-4 w-4 text-blue-500" />;
      case 'ai_suggestion':
        return <Wand2 className="h-4 w-4 text-purple-500" />;
      case 'system':
      default:
        return <Info className="h-4 w-4 text-muted-foreground" />;
    }
  };

  // تصفية الإشعارات حسب التبويب النشط
  const filteredNotifications = notifications.filter(notification => {
    if (activeTab === 'all') return true;
    if (activeTab === 'unread') return notification.status === 'unread';
    if (activeTab === 'tasks') return notification.type.startsWith('task_');
    if (activeTab === 'meetings') return notification.type.startsWith('meeting_');
    if (activeTab === 'suggestions') return notification.type === 'ai_suggestion';
    return true;
  });

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
          <span className="sr-only">الإشعارات</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4">
          <h3 className="font-medium">الإشعارات</h3>
          <div className="flex gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={handleMarkAllAsRead}
                title="تعليم الكل كمقروء"
              >
                <Check className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              asChild
              title="إعدادات الإشعارات"
            >
              <Link href="/settings/notifications">
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
        <Separator />
        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-5 p-0 h-10">
            <TabsTrigger value="all" className="text-xs">الكل</TabsTrigger>
            <TabsTrigger value="unread" className="text-xs">غير مقروءة</TabsTrigger>
            <TabsTrigger value="tasks" className="text-xs">المهام</TabsTrigger>
            <TabsTrigger value="meetings" className="text-xs">الاجتماعات</TabsTrigger>
            <TabsTrigger value="suggestions" className="text-xs">اقتراحات</TabsTrigger>
          </TabsList>
          <TabsContent value={activeTab} className="mt-0">
            <ScrollArea className="h-[300px]">
              {loading ? (
                <div className="flex items-center justify-center h-[300px]">
                  <div className="animate-spin">
                    <Bell className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[300px] text-center p-4">
                  <Bell className="h-10 w-10 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">لا توجد إشعارات</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredNotifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-muted cursor-pointer ${notification.status === 'unread' ? 'bg-muted/50' : ''}`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex gap-3">
                        <div className="flex-shrink-0 mt-1">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm font-medium ${notification.status === 'unread' ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {notification.title}
                            </p>
                            <p className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDistanceToNow(notification.createdAt, { locale: ar, addSuffix: true })}
                            </p>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {notification.message}
                          </p>
                          {notification.actionLink && notification.actionText && (
                            <div className="mt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs w-full"
                                asChild
                              >
                                <Link href={notification.actionLink}>
                                  {notification.actionText}
                                </Link>
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
