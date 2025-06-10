/**
 * مكون إشعارات طلبات الموافقة للمستخدم
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle,
  XCircle,
  Clock,
  User,
  Calendar,
  MessageSquare,
  Bell
} from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { useAuth } from '@/context/AuthContext';
import { Task } from '@/types/task';
import { useToast } from '@/hooks/use-toast';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface MyRequestsNotificationsProps {
  organizationId?: string;
}

export function MyRequestsNotifications({ organizationId }: MyRequestsNotificationsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [notifications, setNotifications] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  // جلب الطلبات التي تم اتخاذ قرار بشأنها ولم يتم قراءتها
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, 'tasks'),
      where('submittedBy', '==', user.uid),
      where('requiresApproval', '==', true),
      orderBy('submittedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tasks = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Task[];
      
      // فلترة المهام التي لم يتم قراءة إشعارها (تم اتخاذ قرار بشأنها)
      const unreadNotifications = tasks.filter(task =>
        task.approvedAt && !task.notificationRead && (task.approved === true || task.approved === false)
      );
      
      // إظهار إشعار للمهام الجديدة
      unreadNotifications.forEach(task => {
        if (task.approved === true) {
          toast({
            title: '✅ تمت الموافقة على طلبك',
            description: `تم قبول مهمة: ${task.description}`,
            duration: 5000,
          });
        } else if (task.approved === false) {
          toast({
            title: '❌ تم رفض طلبك',
            description: `تم رفض مهمة: ${task.description}${task.rejectionReason ? `\nالسبب: ${task.rejectionReason}` : ''}`,
            duration: 7000,
            variant: 'destructive',
          });
        }
      });
      
      setNotifications(unreadNotifications);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching request notifications:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid, toast]);

  const markAsRead = async (taskId: string) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        notificationRead: true
      });
      
      // إزالة من القائمة المحلية
      setNotifications(prev => prev.filter(n => n.id !== taskId));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const promises = notifications.map(notification =>
        updateDoc(doc(db, 'tasks', notification.id), {
          notificationRead: true
        })
      );
      
      await Promise.all(promises);
      setNotifications([]);
      setIsPopoverOpen(false);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const getStatusIcon = (approved: boolean | undefined) => {
    if (approved === true) {
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    } else if (approved === false) {
      return <XCircle className="h-4 w-4 text-red-600" />;
    } else {
      return <Clock className="h-4 w-4 text-orange-600" />;
    }
  };

  const getStatusText = (approved: boolean | undefined) => {
    if (approved === true) {
      return 'تمت الموافقة';
    } else if (approved === false) {
      return 'تم الرفض';
    } else {
      return 'في انتظار الموافقة';
    }
  };

  const getStatusColor = (approved: boolean | undefined) => {
    if (approved === true) {
      return 'bg-green-50 border-green-200';
    } else if (approved === false) {
      return 'bg-red-50 border-red-200';
    } else {
      return 'bg-orange-50 border-orange-200';
    }
  };

  if (!user) return null;

  return (
    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`relative h-8 w-8 ${notifications.length > 0 ? 'text-blue-600 hover:text-blue-700' : ''}`}
          title={`إشعارات طلباتك${notifications.length > 0 ? ` (${notifications.length})` : ''}`}
        >
          <Bell className="h-4 w-4" />
          {notifications.length > 0 && (
            <Badge
              variant="default"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs animate-pulse bg-blue-600"
            >
              {notifications.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-blue-600" />
            <h3 className="font-semibold text-sm">إشعارات طلباتك</h3>
          </div>
          <div className="flex items-center gap-2">
            {notifications.length > 0 && (
              <>
                <Badge variant="secondary" className="text-xs">
                  {notifications.length}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllAsRead}
                  className="text-xs h-6 px-2"
                >
                  قراءة الكل
                </Button>
              </>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-96">
          {loading ? (
            <div className="flex items-center justify-center p-4">
              <Clock className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm text-muted-foreground">جاري التحميل...</span>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-6 text-center">
              <CheckCircle className="h-8 w-8 text-green-600 mb-2" />
              <p className="text-sm text-muted-foreground">لا توجد إشعارات جديدة</p>
            </div>
          ) : (
            <div className="p-2">
              {notifications.map((notification, index) => (
                <div key={notification.id}>
                  <div
                    className={`p-3 rounded-lg border ${getStatusColor(notification.approved)} cursor-pointer hover:opacity-80`}
                    onClick={() => markAsRead(notification.id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(notification.approved)}
                        <span className="text-sm font-medium">
                          {getStatusText(notification.approved)}
                        </span>
                      </div>
                      {notification.approvedAt && (
                        <span className="text-xs text-muted-foreground">
                          {format(notification.approvedAt.toDate(), 'dd/MM HH:mm', { locale: ar })}
                        </span>
                      )}
                    </div>
                    
                    <p className="text-sm font-medium mb-1 line-clamp-2">
                      {notification.description}
                    </p>
                    
                    {notification.rejectionReason && (
                      <div className="flex items-start gap-2 mt-2 p-2 bg-red-100 rounded text-xs">
                        <MessageSquare className="h-3 w-3 text-red-600 mt-0.5 flex-shrink-0" />
                        <span className="text-red-700">
                          <strong>سبب الرفض:</strong> {notification.rejectionReason}
                        </span>
                      </div>
                    )}
                    
                    {notification.approvedByName && (
                      <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                        <User className="h-3 w-3" />
                        <span>بواسطة: {notification.approvedByName}</span>
                      </div>
                    )}
                  </div>
                  {index < notifications.length - 1 && <Separator className="my-2" />}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
