'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Wand2, Calendar, Download, Send } from 'lucide-react';
import { format, startOfDay, endOfDay, addDays, subDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { db } from '@/config/firebase';
import { collection, query, where, getDocs, Timestamp, orderBy } from 'firebase/firestore';
import { TaskType } from '@/types/task';
import { Meeting, AgendaItem } from '@/types/meeting';
import { createMeeting } from '@/services/meetings';
import { v4 as uuidv4 } from 'uuid';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { generateDailyMeetingAgenda } from '@/services/ai';

interface DailyMeetingGeneratorProps {
  departmentId?: string;
  onSuccess?: () => void;
}

export function DailyMeetingGenerator({ departmentId, onSuccess }: DailyMeetingGeneratorProps) {
  const { user, userClaims } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [tasks, setTasks] = useState<TaskType[]>([]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [generatedAgenda, setGeneratedAgenda] = useState<{
    title: string;
    description: string;
    agenda: AgendaItem[];
    summary: string;
  } | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const organizationId = userClaims?.organizationId;
  const isOwner = userClaims?.isOrgOwner === true;
  const isAdmin = userClaims?.isOrgAdmin === true;
  const isEngineer = userClaims?.engineer === true;
  const isSupervisor = userClaims?.supervisor === true;
  const canCreateMeetings = isOwner || isAdmin || isEngineer || isSupervisor;

  // تحميل المهام للقسم
  useEffect(() => {
    if (!user || !organizationId) return;

    const fetchTasks = async () => {
      setLoadingTasks(true);
      try {
        const tasksQuery = departmentId
          ? query(
              collection(db, 'tasks'),
              where('organizationId', '==', organizationId),
              where('departmentId', '==', departmentId),
              orderBy('dueDate', 'asc')
            )
          : query(
              collection(db, 'tasks'),
              where('organizationId', '==', organizationId),
              orderBy('dueDate', 'asc')
            );

        const snapshot = await getDocs(tasksQuery);
        const fetchedTasks: TaskType[] = [];

        snapshot.forEach((doc) => {
          const data = doc.data();
          fetchedTasks.push({
            id: doc.id,
            title: data.title,
            description: data.description || '',
            details: data.details || '',
            status: data.status,
            priority: data.priority,
            startDate: data.startDate ? (data.startDate as Timestamp).toDate() : undefined,
            dueDate: data.dueDate ? (data.dueDate as Timestamp).toDate() : undefined,
            completedDate: data.completedDate ? (data.completedDate as Timestamp).toDate() : undefined,
            durationValue: data.durationValue,
            durationUnit: data.durationUnit,
            taskCategoryName: data.taskCategoryName,
            createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate() : new Date(),
            updatedAt: data.updatedAt ? (data.updatedAt as Timestamp).toDate() : new Date(),
          });
        });

        setTasks(fetchedTasks);
      } catch (error) {
        console.error('Error fetching tasks:', error);
        toast({
          title: 'خطأ',
          description: 'حدث خطأ أثناء تحميل المهام',
          variant: 'destructive',
        });
      } finally {
        setLoadingTasks(false);
      }
    };

    fetchTasks();
  }, [user, organizationId, departmentId, toast]);

  // توليد جدول أعمال الاجتماع اليومي
  const handleGenerateAgenda = async () => {
    if (!user || !organizationId) {
      toast({
        title: 'خطأ',
        description: 'يجب تسجيل الدخول وتحديد المؤسسة',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);

      // تحديد المهام المكتملة بالأمس
      const yesterday = subDays(selectedDate, 1);
      const yesterdayStart = startOfDay(yesterday);
      const yesterdayEnd = endOfDay(yesterday);

      const completedYesterday = tasks.filter(
        task =>
          task.status === 'completed' &&
          task.completedDate &&
          task.completedDate >= yesterdayStart &&
          task.completedDate <= yesterdayEnd
      );

      // تحديد المهام المتأخرة
      const today = startOfDay(selectedDate);
      const overdueTasks = tasks.filter(
        task =>
          task.status === 'hold' &&
          task.dueDate &&
          task.dueDate < today
      );

      // تحديد مهام اليوم
      const todayEnd = endOfDay(selectedDate);
      const todayTasks = tasks.filter(
        task =>
          task.status === 'hold' &&
          task.dueDate &&
          task.dueDate >= today &&
          task.dueDate <= todayEnd
      );

      // تحديد المهام القادمة
      const tomorrow = addDays(selectedDate, 1);
      const tomorrowStart = startOfDay(tomorrow);
      const tomorrowEnd = endOfDay(addDays(selectedDate, 7)); // المهام القادمة خلال أسبوع

      const upcomingTasks = tasks.filter(
        task =>
          task.status === 'hold' &&
          task.dueDate &&
          task.dueDate >= tomorrowStart &&
          task.dueDate <= tomorrowEnd
      );

      // استدعاء خدمة الذكاء الاصطناعي لتوليد جدول الأعمال
      const allTasks = [...completedYesterday, ...overdueTasks, ...todayTasks, ...upcomingTasks];
      const result = await generateDailyMeetingAgenda({
        departmentName: departmentId ? 'القسم' : 'المؤسسة', // يمكن استبداله بالاسم الفعلي
        date: format(selectedDate, 'yyyy-MM-dd'),
        tasks: allTasks.map(task => ({
          id: task.id,
          title: task.description, // TaskType uses description as title
          description: task.details || '',
          status: task.status,
          priority: task.priority,
          dueDate: task.dueDate,
        })),
        duration: 30, // 30 minutes default
        focusAreas: customPrompt ? [customPrompt] : undefined,
      });

      // تحويل النتيجة إلى التنسيق المطلوب
      setGeneratedAgenda({
        title: result.meetingTitle,
        description: result.notes || '',
        agenda: result.agenda.map(item => ({
          id: item.id || uuidv4(),
          title: item.title,
          description: item.description,
          duration: item.duration,
          presenter: undefined,
          status: 'pending' as const,
          notes: undefined,
        })),
        summary: result.objectives.join('. '),
      });

      toast({
        title: 'تم التوليد',
        description: 'تم توليد جدول أعمال الاجتماع اليومي بنجاح',
      });
    } catch (error) {
      console.error('Error generating agenda:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء توليد جدول الأعمال',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // إنشاء اجتماع جديد باستخدام جدول الأعمال المولد
  const handleCreateMeeting = async () => {
    if (!user || !organizationId || !generatedAgenda) {
      toast({
        title: 'خطأ',
        description: 'يجب توليد جدول الأعمال أولاً',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);

      // إعداد وقت الاجتماع (9 صباحًا بشكل افتراضي)
      const meetingDate = new Date(selectedDate);
      meetingDate.setHours(9, 0, 0, 0);

      // إنشاء الاجتماع
      const meetingData: any = {
        title: generatedAgenda.title,
        description: generatedAgenda.description,
        type: 'daily',
        status: 'scheduled',
        startDate: meetingDate,
        endDate: new Date(meetingDate.getTime() + 30 * 60000), // 30 دقيقة
        isOnline: false,
        location: '',
        meetingLink: '',
        organizationId,
        createdBy: user.uid,
        participants: [], // سيتم إضافة المشاركين لاحقًا
        agenda: generatedAgenda.agenda,
        decisions: [],
        tasks: [],
        notes: '',
        summary: generatedAgenda.summary,
        isRecurring: false,
      };

      // إضافة departmentId فقط إذا كان موجود
      if (departmentId) {
        meetingData.departmentId = departmentId;
      }

      // إنشاء الاجتماع
      await createMeeting(meetingData);

      toast({
        title: 'تم إنشاء الاجتماع',
        description: 'تم إنشاء الاجتماع اليومي بنجاح',
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error creating meeting:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء إنشاء الاجتماع',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // تصدير جدول الأعمال كملف PDF
  const handleExportAgenda = () => {
    // تنفيذ تصدير PDF (سيتم تنفيذه لاحقًا)
    toast({
      title: 'قريبًا',
      description: 'سيتم تنفيذ هذه الميزة قريبًا',
    });
  };

  // إرسال جدول الأعمال بالبريد الإلكتروني
  const handleSendAgenda = () => {
    // تنفيذ إرسال البريد الإلكتروني (سيتم تنفيذه لاحقًا)
    toast({
      title: 'قريبًا',
      description: 'سيتم تنفيذ هذه الميزة قريبًا',
    });
  };

  if (loadingTasks) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Calendar className="ml-2 h-5 w-5" />
          توليد اجتماع يومي
        </CardTitle>
        <CardDescription>
          توليد جدول أعمال اجتماع يومي بناءً على المهام والإنجازات
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>تاريخ الاجتماع</Label>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={() => setSelectedDate(subDays(selectedDate, 1))}>
              السابق
            </Button>
            <div className="flex-1 text-center">
              {format(selectedDate, 'EEEE, d MMMM yyyy', { locale: ar })}
            </div>
            <Button variant="outline" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
              التالي
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="customPrompt">توجيهات مخصصة (اختياري)</Label>
          <Textarea
            id="customPrompt"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="أضف توجيهات خاصة للاجتماع، مثل: التركيز على جودة التقرير الفني، مناقشة خطة المشروع الجديد، إلخ."
            rows={3}
          />
        </div>

        <Button
          onClick={handleGenerateAgenda}
          disabled={loading || tasks.length === 0}
          className="w-full"
        >
          <Wand2 className="ml-2 h-4 w-4" />
          {loading ? 'جاري التوليد...' : 'توليد جدول الأعمال'}
        </Button>

        {generatedAgenda && (
          <div className="mt-6 space-y-4">
            <div className="border rounded-md p-4">
              <h3 className="text-lg font-semibold mb-2">{generatedAgenda.title}</h3>
              <p className="text-sm text-muted-foreground mb-4">{generatedAgenda.description}</p>

              <h4 className="font-medium mb-2">جدول الأعمال:</h4>
              <ol className="list-decimal list-inside space-y-2 mb-4">
                {generatedAgenda.agenda.map((item) => (
                  <li key={item.id} className="text-sm">
                    <span className="font-medium">{item.title}</span>
                    {item.description && (
                      <p className="text-xs text-muted-foreground mr-6 mt-1">{item.description}</p>
                    )}
                    {item.duration && (
                      <span className="text-xs text-muted-foreground mr-2">({item.duration} دقيقة)</span>
                    )}
                  </li>
                ))}
              </ol>

              <h4 className="font-medium mb-2">ملخص:</h4>
              <p className="text-sm text-muted-foreground">{generatedAgenda.summary}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              {canCreateMeetings && (
                <Button onClick={handleCreateMeeting} disabled={loading} className="flex-1">
                  <Calendar className="ml-2 h-4 w-4" />
                  إنشاء اجتماع
                </Button>
              )}
              <Button variant="outline" onClick={handleExportAgenda} disabled={loading} className="flex-1">
                <Download className="ml-2 h-4 w-4" />
                تصدير PDF
              </Button>
              <Button variant="outline" onClick={handleSendAgenda} disabled={loading} className="flex-1">
                <Send className="ml-2 h-4 w-4" />
                إرسال بالبريد
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
