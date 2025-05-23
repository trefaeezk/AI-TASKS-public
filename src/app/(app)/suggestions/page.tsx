'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { useToast } from '@/hooks/use-toast';
import { Translate } from '@/components/Translate';
import { Wand2, ListChecks, Calendar, BarChart, RefreshCw, Clock, RotateCw, Database, Code, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Notification } from '@/types/notification';
import { getUserNotifications, updateNotificationStatus, subscribeToUserNotifications } from '@/services/notifications';
import {
  generateDailySummary,
  generateTaskPrioritization,
  generateDeadlineAdjustment,
  generateWorkloadManagement,
  SmartSuggestionServiceOutput // Use the correct type name
} from '@/services/smartSuggestions';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { TaskType, PriorityLevel } from '@/types/task';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export default function SuggestionsPage() {
  const { user, userClaims } = useAuth(); // Get userClaims
  const { toast } = useToast();
  const { t, language, direction } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Notification[]>([]);
  const [activeTab, setActiveTab] = useState('all');
  const [userTasks, setUserTasks] = useState<TaskType[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [lastAiResponse, setLastAiResponse] = useState<SmartSuggestionServiceOutput | null>(null); // State for AI response

  const isOwner = userClaims?.owner === true; // Check if user is owner

  // Load suggestions
  const fetchSuggestions = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const notifications = await getUserNotifications(user.uid, {
        limit: 50,
      });

      const aiSuggestions = notifications.filter(
        notification => notification.type === 'ai_suggestion'
      );

      console.log(`[SuggestionsPage] Fetched ${aiSuggestions.length} suggestions for user ${user.uid}`);
      setSuggestions(aiSuggestions);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      toast({
        title: t('common.error'),
        description: t('suggestions.errorLoadingSuggestions'),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSuggestions();
    } else {
      setLoading(false);
    }
  }, [user]);

  const handleSuggestionClick = async (suggestion: Notification) => {
    if (suggestion.status === 'unread') {
      try {
        await updateNotificationStatus(suggestion.id, 'read');
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

  const handleGenerateSuggestion = async (type: string) => {
    if (!user) return;
    setLastAiResponse(null); // Clear previous AI response

    if (userTasks.length === 0) {
      toast({
        title: language === 'en' ? 'No Tasks' : 'لا توجد مهام',
        description: language === 'en'
          ? 'You need to create tasks first before generating suggestions.'
          : 'يجب إنشاء مهام أولاً قبل توليد الاقتراحات.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setGenerating(type);
      const userName = user.displayName || user.email || 'المستخدم';
      console.log(`[SuggestionsPage] Generating ${type} suggestion for user ${user.uid} with ${userTasks.length} tasks`);
      console.log('Tasks for suggestion generation:', userTasks);

      let result: SmartSuggestionServiceOutput | undefined;

      switch (type) {
        case 'daily_summary':
          result = await generateDailySummary(user.uid, userName, language);
          break;
        case 'task_prioritization':
          result = await generateTaskPrioritization(user.uid, userName, language);
          break;
        case 'deadline_adjustment':
          result = await generateDeadlineAdjustment(user.uid, userName, language);
          break;
        case 'workload_management':
          result = await generateWorkloadManagement(user.uid, userName, language);
          break;
      }

      setLastAiResponse(result || null); // Store AI response
      console.log(`[SuggestionsPage] Suggestion generation result:`, result);

      if (result && result.suggestion) {
        toast({
          title: language === 'en' ? 'Suggestion Generated' : 'تم توليد الاقتراح',
          description: language === 'en'
            ? 'A new suggestion has been successfully generated. Wait a moment for it to appear in the list.'
            : 'تم توليد اقتراح جديد بنجاح. انتظر لحظة حتى يظهر في القائمة.',
        });
      } else {
        toast({
          title: language === 'en' ? 'No Suggestion Created' : 'لم يتم إنشاء اقتراح',
          description: language === 'en'
            ? 'AI could not create a suggestion for this data.'
            : 'لم يتمكن الذكاء الاصطناعي من إنشاء اقتراح لهذه البيانات.',
          variant: 'default',
        });
      }

      setTimeout(async () => {
        await fetchSuggestions();
        console.log('[SuggestionsPage] Suggestions refreshed after generation');
      }, 2000);

    } catch (error) {
      console.error('Error generating suggestion:', error);
      setLastAiResponse({
        suggestion: {
          title: language === 'en'
            ? `Error generating ${type} suggestion`
            : `خطأ في توليد اقتراح ${type}`,
          description: language === 'en' ? 'A technical error occurred.' : 'حدث خطأ تقني.',
          content: `Error: ${error instanceof Error ? error.message : String(error)}`,
          priority: 'medium',
          actionItems: []
        }
      });
      toast({
        title: language === 'en' ? 'Error' : 'خطأ',
        description: language === 'en'
          ? 'An error occurred while generating the suggestion. Make sure you have tasks in your account.'
          : 'حدث خطأ أثناء توليد الاقتراح. تأكد من وجود مهام في حسابك.',
        variant: 'destructive',
      });
    } finally {
      setGenerating(null);
    }
  };

  useEffect(() => {
    if (!generating && user) {
      console.log(`[SuggestionsPage] Generation completed, scheduling refresh...`);
      const timer = setTimeout(() => {
        console.log(`[SuggestionsPage] Executing scheduled refresh...`);
        fetchSuggestions();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [generating, user]);

  const fetchUserTasks = async () => {
    if (!user) return;
    setLoadingTasks(true);
    try {
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('userId', '==', user.uid),
        orderBy('dueDate', 'asc')
      );
      const tasksSnapshot = await getDocs(tasksQuery);
      const tasks: TaskType[] = [];
      tasksSnapshot.forEach((doc) => {
        const data = doc.data();
        if (!data.description || !data.status) {
          console.warn(`Task ${doc.id} is missing required fields. Skipping.`);
          return;
        }
        try {
          tasks.push({
            id: doc.id,
            description: data.description || '',
            details: data.details || undefined,
            status: data.status,
            priority: data.priority !== undefined ? data.priority as PriorityLevel : undefined,
            startDate: data.startDate ? (data.startDate as Timestamp).toDate() : undefined,
            dueDate: data.dueDate ? (data.dueDate as Timestamp).toDate() : undefined,
            durationValue: data.durationValue,
            durationUnit: data.durationUnit,
            taskCategoryName: data.taskCategoryName || data.categoryName,
            // userId is not part of TaskType, but we need it for reference
            // @ts-ignore - userId is used in the application logic
            userId: data.userId,
            // Add missing fields with default or undefined values if necessary
            title: data.title || data.description,
            completedDate: data.completedDate ? (data.completedDate as Timestamp).toDate() : undefined,
            categoryId: data.categoryId,
            createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate() : new Date(),
            updatedAt: data.updatedAt ? (data.updatedAt as Timestamp).toDate() : new Date(),
          });
        } catch (error) {
          console.error(`Error processing task ${doc.id}:`, error);
        }
      });
      console.log(`[SuggestionsPage] Fetched ${tasks.length} tasks for user ${user.uid}`);
      setUserTasks(tasks);
    } catch (error) {
      console.error('Error fetching user tasks:', error);
      toast({
        title: t('common.error'),
        description: t('suggestions.errorLoadingTasks'),
        variant: 'destructive',
      });
    } finally {
      setLoadingTasks(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchUserTasks();
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    console.log(`[SuggestionsPage] Setting up real-time notifications listener for user ${user.uid}`);

    const unsubscribe = subscribeToUserNotifications(
      user.uid,
      (notifications) => {
        const aiSuggestions = notifications.filter(
          notification => notification.type === 'ai_suggestion'
        );
        console.log(`[SuggestionsPage] Real-time update: ${aiSuggestions.length} suggestions`);
        setSuggestions(aiSuggestions);
        setLoading(false);
      },
      { limit: 50 }
    );

    // إضافة listener إلى مدير listeners
    import('@/utils/firestoreListenerManager').then(({ firestoreListenerManager }) => {
      firestoreListenerManager.addListener(`suggestions-${user.uid}`, unsubscribe);
    });

    return () => {
      console.log(`[SuggestionsPage] Unsubscribing from real-time notifications`);
      unsubscribe();
      import('@/utils/firestoreListenerManager').then(({ firestoreListenerManager }) => {
        firestoreListenerManager.removeListener(`suggestions-${user.uid}`);
      });
    };
  }, [user]);

  const filteredSuggestions = suggestions.filter(suggestion => {
    if (activeTab === 'all') return true;
    const metadata = suggestion.metadata || {};
    const suggestionType = metadata.suggestionType || '';
    return suggestionType === activeTab;
  });

  const getSuggestionTypeTitle = (type: string) => {
    if (language === 'en') {
      switch (type) {
        case 'daily_summary': return 'Daily Summary';
        case 'task_prioritization': return 'Task Prioritization';
        case 'deadline_adjustment': return 'Deadline Adjustment';
        case 'workload_management': return 'Workload Management';
        default: return 'Suggestion';
      }
    } else {
      switch (type) {
        case 'daily_summary': return 'الملخص اليومي';
        case 'task_prioritization': return 'ترتيب أولويات المهام';
        case 'deadline_adjustment': return 'تعديل المواعيد النهائية';
        case 'workload_management': return 'إدارة عبء العمل';
        default: return 'اقتراح';
      }
    }
  };

  const getSuggestionTypeIcon = (type: string) => {
    switch (type) {
      case 'daily_summary': return <Clock className="h-5 w-5" />;
      case 'task_prioritization': return <ListChecks className="h-5 w-5" />;
      case 'deadline_adjustment': return <Calendar className="h-5 w-5" />;
      case 'workload_management': return <BarChart className="h-5 w-5" />;
      default: return <Wand2 className="h-5 w-5" />;
    }
  };

  if (loading && suggestions.length === 0) { // Ensure loading state shows until initial suggestions are fetched
    return (
      <div className="container mx-auto p-4">
        <div className="flex items-center mb-6">
          <Wand2 className={`${direction === 'rtl' ? 'ml-2' : 'mr-2'} h-6 w-6`} />
          <h1 className="text-2xl font-bold">{t('suggestions.smartSuggestions')}</h1>
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
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center">
          <Wand2 className={`${direction === 'rtl' ? 'ml-2' : 'mr-2'} h-6 w-6`} />
          <h1 className="text-2xl font-bold">{t('suggestions.smartSuggestions')}</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchSuggestions}
          disabled={loading}
        >
          {loading ? (
            <RotateCw className={`${direction === 'rtl' ? 'ml-2' : 'mr-2'} h-4 w-4 animate-spin`} />
          ) : (
            <RotateCw className={`${direction === 'rtl' ? 'ml-2' : 'mr-2'} h-4 w-4`} />
          )}
          {t('common.refresh')}
        </Button>
      </div>

      {suggestions.length === 0 && !loading && (
        <Alert className="mb-6">
          <Wand2 className="h-4 w-4" />
          <AlertTitle>{t('suggestions.noSuggestions')}</AlertTitle>
          <AlertDescription>
            {t('suggestions.generateNewSuggestion')}
          </AlertDescription>
        </Alert>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Database className={`${direction === 'rtl' ? 'ml-2' : 'mr-2'} h-5 w-5`} />
            {t('suggestions.currentUserTasks').replace('{count}', userTasks.length.toString())}
          </CardTitle>
          <CardDescription>
            {t('suggestions.tasksDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingTasks ? (
            <Skeleton className="h-40 w-full" />
          ) : userTasks.length === 0 ? (
            <Alert>
              <AlertTitle>{t('suggestions.noTasks')}</AlertTitle>
              <AlertDescription>
                {t('suggestions.noTasksDescription')}
              </AlertDescription>
            </Alert>
          ) : (
             <Collapsible>
                <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm" className="mb-2">
                        {t('suggestions.showHideTasksList').replace('{count}', userTasks.length.toString())}
                    </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <pre className="bg-muted p-4 rounded-md overflow-auto max-h-96 text-xs">
                      {JSON.stringify(userTasks, null, 2)}
                    </pre>
                </CollapsibleContent>
             </Collapsible>
          )}
        </CardContent>
        <CardFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchUserTasks}
            disabled={loadingTasks}
          >
            {loadingTasks ? (
              <RotateCw className={`${direction === 'rtl' ? 'ml-2' : 'mr-2'} h-4 w-4 animate-spin`} />
            ) : (
              <RotateCw className={`${direction === 'rtl' ? 'ml-2' : 'mr-2'} h-4 w-4`} />
            )}
            {t('suggestions.refreshTasksList')}
          </Button>
        </CardFooter>
      </Card>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 mb-6">
        {/* Suggestion Generation Cards */}
        {[
          {
            type: 'daily_summary',
            title: language === 'en' ? 'Daily Summary' : 'الملخص اليومي',
            description: language === 'en'
              ? 'Summary of completed and due tasks today with a suggested action plan.'
              : 'ملخص للمهام المكتملة والمستحقة اليوم مع خطة عمل مقترحة.',
            icon: Clock,
            color: 'text-blue-500'
          },
          {
            type: 'task_prioritization',
            title: language === 'en' ? 'Task Prioritization' : 'ترتيب الأولويات',
            description: language === 'en'
              ? 'Suggestions for prioritizing tasks based on urgency and importance.'
              : 'اقتراحات لترتيب أولويات المهام بناءً على الاستعجال والأهمية.',
            icon: ListChecks,
            color: 'text-green-500'
          },
          {
            type: 'deadline_adjustment',
            title: language === 'en' ? 'Deadline Adjustment' : 'تعديل المواعيد',
            description: language === 'en'
              ? 'Suggestions for adjusting deadlines based on your performance and workload.'
              : 'اقتراحات لتعديل المواعيد النهائية بناءً على أدائك وعبء العمل.',
            icon: Calendar,
            color: 'text-amber-500'
          },
          {
            type: 'workload_management',
            title: language === 'en' ? 'Workload Management' : 'إدارة عبء العمل',
            description: language === 'en'
              ? 'Suggestions for better work distribution and avoiding burnout.'
              : 'اقتراحات لتوزيع العمل بشكل أفضل وتجنب الإرهاق.',
            icon: BarChart,
            color: 'text-purple-500'
          },
        ].map(sugg => (
          <Card key={sugg.type} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center">
                <sugg.icon className={`ml-2 h-5 w-5 ${sugg.color}`} />
                {sugg.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-2">
              <p className="text-sm text-muted-foreground h-20 overflow-hidden">
                {sugg.description}
              </p>
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => handleGenerateSuggestion(sugg.type)}
                disabled={generating !== null || loadingTasks}
              >
                {generating === sugg.type ? (
                  <>
                    <RefreshCw className={`${language === 'en' ? 'mr-2' : 'ml-2'} h-4 w-4 animate-spin`} />
                    {language === 'en' ? 'Generating...' : 'جاري التوليد...'}
                  </>
                ) : (
                  <>
                    <Wand2 className={`${language === 'en' ? 'mr-2' : 'ml-2'} h-4 w-4`} />
                    {language === 'en' ? 'Generate Suggestion' : 'توليد اقتراح'}
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {isOwner && lastAiResponse && (
        <Collapsible className="mb-6">
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-start">
              <Code className={`${direction === 'rtl' ? 'ml-2' : 'mr-2'} h-4 w-4`} />
              {t('suggestions.showLastAiResponse')}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <Card className="mt-2">
              <CardHeader>
                <CardTitle className="text-sm">{t('suggestions.jsonResponse')}</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-md overflow-auto max-h-96 text-xs">
                  {JSON.stringify(lastAiResponse, null, 2)}
                </pre>
              </CardContent>
            </Card>
          </CollapsibleContent>
        </Collapsible>
      )}

      <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="grid grid-cols-5 mb-4">
          <TabsTrigger value="all">{language === 'en' ? 'All' : 'الكل'}</TabsTrigger>
          <TabsTrigger value="daily_summary">{language === 'en' ? 'Daily Summary' : 'الملخص اليومي'}</TabsTrigger>
          <TabsTrigger value="task_prioritization">{language === 'en' ? 'Priorities' : 'الأولويات'}</TabsTrigger>
          <TabsTrigger value="deadline_adjustment">{language === 'en' ? 'Deadlines' : 'المواعيد'}</TabsTrigger>
          <TabsTrigger value="workload_management">{language === 'en' ? 'Workload' : 'عبء العمل'}</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {loading && filteredSuggestions.length === 0 ? (
             <div className="flex items-center justify-center h-[200px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
             </div>
           ) : filteredSuggestions.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center">
                <Wand2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {language === 'en'
                    ? `No suggestions ${activeTab !== 'all' ? `of type ${getSuggestionTypeTitle(activeTab)}` : ''}.`
                    : `لا توجد اقتراحات ${activeTab !== 'all' ? `من نوع ${getSuggestionTypeTitle(activeTab)}` : ''}.`
                  }
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  {language === 'en'
                    ? 'Generate a new suggestion using the buttons above.'
                    : 'قم بتوليد اقتراح جديد باستخدام الأزرار أعلاه.'
                  }
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

