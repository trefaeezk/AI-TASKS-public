'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Wand2, ListChecks, Calendar, BarChart, RefreshCw, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Notification } from '@/types/notification';
import { getUserNotifications, updateNotificationStatus } from '@/services/notifications';
import { 
  generateDailySummary, 
  generateTaskPrioritization, 
  generateDeadlineAdjustment, 
  generateWorkloadManagement 
} from '@/services/smartSuggestions';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

export default function SuggestionsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Notification[]>([]);
  const [activeTab, setActiveTab] = useState('all');

  // تحميل الاقتراحات
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchSuggestions = async () => {
      try {
        const notifications = await getUserNotifications(user.uid, {
          limit: 50,
        });
        
        // تصفية الإشعارات للحصول على الاقتراحات فقط
        const aiSuggestions = notifications.filter(
          notification => notification.type === 'ai_suggestion'
        );
        
        setSuggestions(aiSuggestions);
      } catch (error) {
        console.error('Error fetching suggestions:', error);
        toast({
          title: 'خطأ',
          description: 'حدث خطأ أثناء تحميل الاقتراحات',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSuggestions();
  }, [user, toast]);

  // تعليم الاقتراح كمقروء
  const handleSuggestionClick = async (suggestion: Notification) => {
    if (suggestion.status === 'unread') {
      try {
        await updateNotificationStatus(suggestion.id, 'read');
        
        // تحديث حالة الاقتراح محليًا
        setSuggestions(prevSuggestions => 
          prevSuggestions.map(s => 
            s.id === suggestion.id 
              ? { ...s, status: 'read', readAt: new Date() } 
              : s
          )
        );
      } catch (error) {
        console.error('Error marking suggestion as read:', error);
      }
    }
  };

  // توليد اقتراح جديد
  const handleGenerateSuggestion = async (type: string) => {
    if (!user) return;

    try {
      setGenerating(type);
      
      const userName = user.displayName || user.email || 'المستخدم';
      
      switch (type) {
        case 'daily_summary':
          await generateDailySummary(user.uid, userName);
          break;
        case 'task_prioritization':
          await generateTaskPrioritization(user.uid, userName);
          break;
        case 'deadline_adjustment':
          await generateDeadlineAdjustment(user.uid, userName);
          break;
        case 'workload_management':
          await generateWorkloadManagement(user.uid, userName);
          break;
      }
      
      toast({
        title: 'تم توليد الاقتراح',
        description: 'تم توليد اقتراح جديد بنجاح. قم بتحديث الصفحة لعرضه.',
      });
      
      // إعادة تحميل الاقتراحات
      const notifications = await getUserNotifications(user.uid, {
        limit: 50,
      });
      
      const aiSuggestions = notifications.filter(
        notification => notification.type === 'ai_suggestion'
      );
      
      setSuggestions(aiSuggestions);
    } catch (error) {
      console.error('Error generating suggestion:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء توليد الاقتراح',
        variant: 'destructive',
      });
    } finally {
      setGenerating(null);
    }
  };

  // تصفية الاقتراحات حسب النوع
  const filteredSuggestions = suggestions.filter(suggestion => {
    if (activeTab === 'all') return true;
    
    const metadata = suggestion.metadata || {};
    const suggestionType = metadata.suggestionType || '';
    
    return suggestionType === activeTab;
  });

  // الحصول على عنوان نوع الاقتراح
  const getSuggestionTypeTitle = (type: string) => {
    switch (type) {
      case 'daily_summary':
        return 'الملخص اليومي';
      case 'task_prioritization':
        return 'ترتيب أولويات المهام';
      case 'deadline_adjustment':
        return 'تعديل المواعيد النهائية';
      case 'workload_management':
        return 'إدارة عبء العمل';
      default:
        return 'اقتراح';
    }
  };

  // الحصول على أيقونة نوع الاقتراح
  const getSuggestionTypeIcon = (type: string) => {
    switch (type) {
      case 'daily_summary':
        return <Clock className="h-5 w-5" />;
      case 'task_prioritization':
        return <ListChecks className="h-5 w-5" />;
      case 'deadline_adjustment':
        return <Calendar className="h-5 w-5" />;
      case 'workload_management':
        return <BarChart className="h-5 w-5" />;
      default:
        return <Wand2 className="h-5 w-5" />;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center mb-6">
          <Wand2 className="ml-2 h-6 w-6" />
          <h1 className="text-2xl font-bold">الاقتراحات الذكية</h1>
        </div>
        <div className="space-y-6">
          <Skeleton className="h-12 w-full" />
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <Skeleton className="h-[200px] w-full" />
            <Skeleton className="h-[200px] w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center mb-6">
        <Wand2 className="ml-2 h-6 w-6" />
        <h1 className="text-2xl font-bold">الاقتراحات الذكية</h1>
      </div>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 mb-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center">
              <Clock className="ml-2 h-5 w-5 text-blue-500" />
              الملخص اليومي
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-2">
            <p className="text-sm text-muted-foreground">
              ملخص للمهام المكتملة والمستحقة اليوم مع خطة عمل مقترحة.
            </p>
          </CardContent>
          <CardFooter>
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => handleGenerateSuggestion('daily_summary')}
              disabled={generating !== null}
            >
              {generating === 'daily_summary' ? (
                <>
                  <RefreshCw className="ml-2 h-4 w-4 animate-spin" />
                  جاري التوليد...
                </>
              ) : (
                <>
                  <Wand2 className="ml-2 h-4 w-4" />
                  توليد ملخص
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center">
              <ListChecks className="ml-2 h-5 w-5 text-green-500" />
              ترتيب الأولويات
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-2">
            <p className="text-sm text-muted-foreground">
              اقتراحات لترتيب أولويات المهام بناءً على الاستعجال والأهمية.
            </p>
          </CardContent>
          <CardFooter>
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => handleGenerateSuggestion('task_prioritization')}
              disabled={generating !== null}
            >
              {generating === 'task_prioritization' ? (
                <>
                  <RefreshCw className="ml-2 h-4 w-4 animate-spin" />
                  جاري التوليد...
                </>
              ) : (
                <>
                  <Wand2 className="ml-2 h-4 w-4" />
                  توليد اقتراح
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center">
              <Calendar className="ml-2 h-5 w-5 text-amber-500" />
              تعديل المواعيد
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-2">
            <p className="text-sm text-muted-foreground">
              اقتراحات لتعديل المواعيد النهائية بناءً على أدائك وعبء العمل.
            </p>
          </CardContent>
          <CardFooter>
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => handleGenerateSuggestion('deadline_adjustment')}
              disabled={generating !== null}
            >
              {generating === 'deadline_adjustment' ? (
                <>
                  <RefreshCw className="ml-2 h-4 w-4 animate-spin" />
                  جاري التوليد...
                </>
              ) : (
                <>
                  <Wand2 className="ml-2 h-4 w-4" />
                  توليد اقتراح
                </>
              )}
            </Button>
          </CardFooter>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center">
              <BarChart className="ml-2 h-5 w-5 text-purple-500" />
              إدارة عبء العمل
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-2">
            <p className="text-sm text-muted-foreground">
              اقتراحات لتوزيع العمل بشكل أفضل وتجنب الإرهاق.
            </p>
          </CardContent>
          <CardFooter>
            <Button 
              variant="outline" 
              className="w-full" 
              onClick={() => handleGenerateSuggestion('workload_management')}
              disabled={generating !== null}
            >
              {generating === 'workload_management' ? (
                <>
                  <RefreshCw className="ml-2 h-4 w-4 animate-spin" />
                  جاري التوليد...
                </>
              ) : (
                <>
                  <Wand2 className="ml-2 h-4 w-4" />
                  توليد اقتراح
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </div>

      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="grid grid-cols-5 mb-4">
          <TabsTrigger value="all">الكل</TabsTrigger>
          <TabsTrigger value="daily_summary">الملخص اليومي</TabsTrigger>
          <TabsTrigger value="task_prioritization">الأولويات</TabsTrigger>
          <TabsTrigger value="deadline_adjustment">المواعيد</TabsTrigger>
          <TabsTrigger value="workload_management">عبء العمل</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {filteredSuggestions.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <Wand2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  لا توجد اقتراحات {activeTab !== 'all' ? `من نوع ${getSuggestionTypeTitle(activeTab)}` : ''}.
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  قم بتوليد اقتراح جديد باستخدام الأزرار أعلاه.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredSuggestions.map((suggestion) => {
                const metadata = suggestion.metadata || {};
                const suggestionType = metadata.suggestionType || '';
                const actionItems = metadata.actionItems || [];
                
                return (
                  <Card 
                    key={suggestion.id} 
                    className={`hover:shadow-md transition-shadow ${suggestion.status === 'unread' ? 'border-primary' : ''}`}
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center">
                          {getSuggestionTypeIcon(suggestionType)}
                          <span className="mr-2">{suggestion.title}</span>
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          {suggestion.status === 'unread' && (
                            <Badge variant="default" className="bg-primary">جديد</Badge>
                          )}
                          <Badge variant="outline">
                            {getSuggestionTypeTitle(suggestionType)}
                          </Badge>
                        </div>
                      </div>
                      <CardDescription>
                        {format(suggestion.createdAt, 'EEEE, d MMMM yyyy - HH:mm', { locale: ar })}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm">{suggestion.message}</p>
                      
                      {actionItems.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium">الإجراءات المقترحة:</h4>
                          <ul className="list-disc list-inside space-y-1">
                            {actionItems.map((item: any, index: number) => (
                              <li key={index} className="text-sm text-muted-foreground">
                                {item.description}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
