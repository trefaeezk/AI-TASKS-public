'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Users, User, ChevronDown, ChevronUp } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { cn } from '@/lib/utils';

interface SmartAssigneesListProps {
  assignedToUserId?: string;
  assignedToUserIds?: string[];
  organizationId?: string;
  className?: string;
  maxInline?: number; // عدد الأسماء المعروضة في السطر قبل التوسيع
  showFullNamesOnExpand?: boolean; // إظهار الأسماء الكاملة عند التوسيع
}

interface UserInfo {
  id: string;
  name: string;
  avatar?: string;
}

export function SmartAssigneesList({ 
  assignedToUserId, 
  assignedToUserIds, 
  organizationId,
  className = "",
  maxInline = 2,
  showFullNamesOnExpand = true
}: SmartAssigneesListProps) {
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
        جاري التحميل...
      </Badge>
    );
  }

  if (users.length === 0) {
    return null;
  }

  // دالة لاستخراج الاسم (الأول والثاني دائماً للتمييز)
  const getDisplayName = (fullName: string, isShort: boolean = false) => {
    const nameParts = fullName.trim().split(' ');
    if (isShort) {
      // عرض مختصر: الاسم الأول والثاني
      return nameParts.length >= 2
        ? `${nameParts[0]} ${nameParts[1]}`
        : nameParts[0] || 'مستخدم';
    } else {
      // عرض كامل: جميع الأسماء
      return fullName || 'مستخدم غير معروف';
    }
  };

  // مستخدم واحد
  if (users.length === 1) {
    const user = users[0];
    const displayName = getDisplayName(user.name, true);

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={cn("flex items-center gap-1", className)}>
              <User className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate max-w-28">{displayName}</span>
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
  const inlineUsers = users.slice(0, maxInline);
  const hiddenUsers = users.slice(maxInline);
  const hasHidden = hiddenUsers.length > 0;

  // إنشاء نص الأسماء المعروضة في السطر
  const inlineText = inlineUsers.map(user => getDisplayName(user.name, true)).join('، ');
  const finalInlineText = hasHidden ? `${inlineText} +${hiddenUsers.length}` : inlineText;

  return (
    <div className={cn("flex items-center gap-1", className)}>
      {/* العرض الأساسي */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate max-w-32">{finalInlineText}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1 max-w-48">
              <p className="font-medium">المُكلفين ({users.length}):</p>
              {users.slice(0, 5).map((user) => (
                <p key={user.id} className="text-sm truncate">• {getDisplayName(user.name, true)}</p>
              ))}
              {users.length > 5 && (
                <p className="text-xs text-muted-foreground">... و {users.length - 5} آخرين</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* زر التوسيع إذا كان هناك مكلفين مخفيين */}
      {hasHidden && (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <CollapsibleTrigger asChild>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="h-6 w-6 p-0 hover:bg-accent"
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                  </Button>
                </CollapsibleTrigger>
              </TooltipTrigger>
              <TooltipContent>
                <p>{isExpanded ? 'إخفاء' : 'عرض'} جميع المكلفين</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          
          <CollapsibleContent className="mt-1 w-full">
            <div className="flex flex-wrap gap-1">
              {hiddenUsers.map((user) => (
                <TooltipProvider key={user.id}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge 
                        variant="secondary" 
                        className="text-xs px-2 py-0.5 max-w-28 truncate"
                      >
                        {getDisplayName(user.name, !showFullNamesOnExpand)}
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
      )}
    </div>
  );
}
