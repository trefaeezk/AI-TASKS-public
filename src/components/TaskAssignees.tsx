'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Users, User, ChevronDown, ChevronUp } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cn } from '@/lib/utils';

interface TaskAssigneesProps {
  assignedToUserId?: string;
  assignedToUserIds?: string[];
  organizationId?: string;
  className?: string;
  showNames?: boolean;
  maxDisplay?: number;
  compact?: boolean; // عرض مضغوط
  expandable?: boolean; // قابل للتوسيع
}

interface UserInfo {
  id: string;
  name: string;
  avatar?: string;
}

export function TaskAssignees({
  assignedToUserId,
  assignedToUserIds,
  organizationId,
  className = "",
  showNames = false,
  maxDisplay = 3,
  compact = false,
  expandable = true
}: TaskAssigneesProps) {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

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
              // جلب معلومات المستخدم من مجموعة أعضاء المؤسسة
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
            
            // إذا لم نجد المستخدم في المؤسسة، جرب جلبه من مجموعة المستخدمين العامة
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
      <Badge variant="outline" className={className}>
        <User className="ml-1 h-3.5 w-3.5" />
        جاري التحميل...
      </Badge>
    );
  }

  if (users.length === 0) {
    return null;
  }

  // دالة لاستخراج الاسم المختصر
  const getShortName = (fullName: string) => {
    const nameParts = fullName.trim().split(' ');
    if (compact) {
      // في الوضع المضغوط: الاسم الأول والثاني (للتمييز بين الأسماء المتشابهة)
      return nameParts.length >= 2
        ? `${nameParts[0]} ${nameParts[1]}`
        : nameParts[0] || 'مستخدم';
    } else {
      // في الوضع العادي: الاسم الأول والثاني والثالث إن وجد
      return nameParts.length >= 3
        ? `${nameParts[0]} ${nameParts[1]} ${nameParts[2]}`
        : nameParts.length >= 2
        ? `${nameParts[0]} ${nameParts[1]}`
        : nameParts[0] || 'مستخدم';
    }
  };

  // مستخدم واحد
  if (users.length === 1) {
    const user = users[0];
    const displayName = getShortName(user.name);

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={cn("flex items-center gap-1", className)}>
              <User className="h-3.5 w-3.5 flex-shrink-0" />
              <span className={cn("truncate", compact ? "max-w-24" : "max-w-32")}>
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
  const displayLimit = compact ? 1 : 2;
  const displayUsers = users.slice(0, displayLimit);
  const remainingCount = users.length - displayLimit;

  // إنشاء نص الأسماء المعروضة
  const namesText = displayUsers.map(user => getShortName(user.name)).join('، ');
  const finalText = remainingCount > 0 ? `${namesText} +${remainingCount}` : namesText;

  // إذا كان العدد كبير وقابل للتوسيع
  if (users.length > 3 && expandable) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <CollapsibleTrigger asChild>
                  <Badge
                    variant="outline"
                    className="flex items-center gap-1 cursor-pointer hover:bg-accent transition-colors"
                  >
                    <Users className="h-3.5 w-3.5 flex-shrink-0" />
                    <span className={cn("truncate", compact ? "max-w-28" : "max-w-40")}>
                      {isExpanded ? `المكلفين (${users.length})` : finalText}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="h-3 w-3 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="h-3 w-3 flex-shrink-0" />
                    )}
                  </Badge>
                </CollapsibleTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>انقر لعرض/إخفاء جميع المكلفين</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <CollapsibleContent className="mt-1">
            <div className="flex flex-wrap gap-1">
              {users.map((user) => (
                <TooltipProvider key={user.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="secondary"
                        className="text-xs px-2 py-0.5 max-w-24 truncate"
                      >
                        {getShortName(user.name)}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{user.name}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
  }

  // العرض العادي للعدد القليل
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={cn("flex items-center gap-1", className)}>
            <Users className="h-3.5 w-3.5 flex-shrink-0" />
            <span className={cn("truncate", compact ? "max-w-28" : "max-w-40")}>
              {finalText}
            </span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1 max-w-48">
            <p className="font-medium">المُكلفين ({users.length}):</p>
            {users.map((user) => (
              <p key={user.id} className="text-sm truncate">• {user.name}</p>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
