'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Users, User, MoreHorizontal } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cn } from '@/lib/utils';

interface CompactAssigneesListProps {
  assignedToUserId?: string;
  assignedToUserIds?: string[];
  organizationId?: string;
  className?: string;
  maxVisible?: number; // عدد الأسماء المرئية قبل إظهار "المزيد"
  size?: 'xs' | 'sm' | 'md'; // حجم العرض
}

interface UserInfo {
  id: string;
  name: string;
  avatar?: string;
}

export function CompactAssigneesList({ 
  assignedToUserId, 
  assignedToUserIds, 
  organizationId,
  className = "",
  maxVisible = 2,
  size = 'sm'
}: CompactAssigneesListProps) {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchUserInfo = async () => {
      if (!assignedToUserId && (!assignedToUserIds || assignedToUserIds.length === 0)) {
        setUsers([]);
        return;
      }

      setLoading(true);
      try {
        const userIds = assignedToUserId ? [assignedToUserId] : assignedToUserIds || [];
        const userInfoPromises = userIds.map(async (userId) => {
          try {
            if (organizationId) {
              const memberRef = doc(db, 'organizations', organizationId, 'members', userId);
              const memberDoc = await getDoc(memberRef);
              
              if (memberDoc.exists()) {
                const memberData = memberDoc.data();
                return {
                  id: userId,
                  name: memberData.name || memberData.displayName || 'مستخدم غير معروف',
                  avatar: memberData.photoURL
                };
              }
            }
            
            const userRef = doc(db, 'users', userId);
            const userDoc = await getDoc(userRef);
            
            if (userDoc.exists()) {
              const userData = userDoc.data();
              return {
                id: userId,
                name: userData.name || userData.displayName || 'مستخدم غير معروف',
                avatar: userData.photoURL
              };
            }
            
            return {
              id: userId,
              name: 'مستخدم غير معروف',
              avatar: undefined
            };
          } catch (error) {
            console.error(`Error fetching user info for ${userId}:`, error);
            return {
              id: userId,
              name: 'مستخدم غير معروف',
              avatar: undefined
            };
          }
        });

        const userInfos = await Promise.all(userInfoPromises);
        setUsers(userInfos);
      } catch (error) {
        console.error('Error fetching user information:', error);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchUserInfo();
  }, [assignedToUserId, assignedToUserIds, organizationId]);

  if (loading) {
    return (
      <Badge variant="outline" className={cn("animate-pulse", className)}>
        <User className="ml-1 h-3 w-3" />
        ...
      </Badge>
    );
  }

  if (users.length === 0) {
    return null;
  }

  // دالة لاستخراج الاسم المختصر حسب الحجم
  const getShortName = (fullName: string) => {
    const nameParts = fullName.trim().split(' ');
    switch (size) {
      case 'xs':
        // الاسم الأول والثاني (مضغوط)
        return nameParts.length >= 2
          ? `${nameParts[0]} ${nameParts[1]}`
          : nameParts[0] || 'مستخدم';
      case 'sm':
        // الاسم الأول والثاني
        return nameParts.length >= 2
          ? `${nameParts[0]} ${nameParts[1]}`
          : nameParts[0] || 'مستخدم';
      case 'md':
        // الاسم الأول والثاني والثالث إن وجد
        return nameParts.length >= 3
          ? `${nameParts[0]} ${nameParts[1]} ${nameParts[2]}`
          : nameParts.length >= 2
          ? `${nameParts[0]} ${nameParts[1]}`
          : nameParts[0] || 'مستخدم';
      default:
        return nameParts.length >= 2
          ? `${nameParts[0]} ${nameParts[1]}`
          : nameParts[0] || 'مستخدم';
    }
  };

  // تحديد أحجام العناصر حسب الحجم المطلوب
  const sizeClasses = {
    xs: {
      badge: "px-1.5 py-0.5 text-xs h-5",
      icon: "h-2.5 w-2.5",
      text: "max-w-20" // زيادة العرض لاستيعاب اسمين
    },
    sm: {
      badge: "px-2 py-0.5 text-xs h-6",
      icon: "h-3 w-3",
      text: "max-w-24" // زيادة العرض لاستيعاب اسمين
    },
    md: {
      badge: "px-2 py-1 text-sm h-7",
      icon: "h-3.5 w-3.5",
      text: "max-w-32" // زيادة العرض لاستيعاب ثلاثة أسماء
    }
  };

  const currentSize = sizeClasses[size];

  // مستخدم واحد
  if (users.length === 1) {
    const user = users[0];
    const displayName = getShortName(user.name);

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={cn("flex items-center gap-1", currentSize.badge, className)}
            >
              <User className={cn("flex-shrink-0", currentSize.icon)} />
              <span className={cn("truncate", currentSize.text)}>
                {displayName}
              </span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>مُكلف: {user.name}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // متعدد المكلفين
  const visibleUsers = users.slice(0, maxVisible);
  const hiddenUsers = users.slice(maxVisible);
  const hasHidden = hiddenUsers.length > 0;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {/* الأسماء المرئية */}
      {visibleUsers.map((user, index) => (
        <TooltipProvider key={user.id}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge 
                variant="secondary" 
                className={cn("flex items-center gap-1", currentSize.badge)}
              >
                {index === 0 && (
                  <User className={cn("flex-shrink-0", currentSize.icon)} />
                )}
                <span className={cn("truncate", currentSize.text)}>
                  {getShortName(user.name)}
                </span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p>{user.name}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ))}

      {/* زر "المزيد" إذا كان هناك مكلفين مخفيين */}
      {hasHidden && (
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant="outline" 
              size="sm"
              className={cn("flex items-center gap-1", currentSize.badge)}
            >
              <MoreHorizontal className={cn("flex-shrink-0", currentSize.icon)} />
              <span className="text-xs">+{hiddenUsers.length}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-2" align="start">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                جميع المكلفين ({users.length}):
              </p>
              {users.map((user) => (
                <div key={user.id} className="flex items-center gap-2 text-sm">
                  <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                  <span className="truncate">{user.name}</span>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
