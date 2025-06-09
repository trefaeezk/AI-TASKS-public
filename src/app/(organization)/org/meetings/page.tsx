'use client';

// منع التوليد المسبق للصفحة
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Plus, Clock, Users, Video, MapPin, Calendar as CalendarIcon, BarChart3 } from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { ar } from 'date-fns/locale';
import { db } from '@/config/firebase';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { firestoreListenerManager, handleFirestoreError } from '@/utils/firestoreListenerManager';
import { Meeting, MeetingType, MeetingStatus } from '@/types/meeting';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { CreateMeetingForm } from '@/components/meetings/CreateMeetingForm';
import { MeetingDetails } from '@/components/meetings/MeetingDetails';
import { MeetingsCalendar } from '@/components/meetings/MeetingsCalendar';
import { DailyMeetingsView } from '@/components/meetings/DailyMeetingsView';
import { MeetingsStats } from '@/components/meetings/MeetingsStats';

export default function OrganizationMeetingsPage() {
  const { user, userClaims } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [weekDays, setWeekDays] = useState<Date[]>([]);

  const organizationId = userClaims?.organizationId;
  // استخدام النمط الجديد is* فقط (بدون توافق)
  const isOwner = userClaims?.isOrgOwner === true;
  const isAdmin = userClaims?.isOrgAdmin === true;
  const isEngineer = userClaims?.isOrgEngineer === true;
  const isSupervisor = userClaims?.isOrgSupervisor === true;
  const canCreateMeetings = isOwner || isAdmin || isEngineer || isSupervisor;

  // تحديث أيام الأسبوع عند تغيير التاريخ المحدد
  useEffect(() => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 0 }); // الأسبوع يبدأ من الأحد
    const end = endOfWeek(selectedDate, { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start, end });
    setWeekDays(days);
  }, [selectedDate]);

  // تحميل الاجتماعات
  useEffect(() => {
    if (!user || !organizationId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // إنشاء استعلام للاجتماعات حسب المؤسسة
    const meetingsQuery = query(
      collection(db, 'meetings'),
      where('organizationId', '==', organizationId),
      orderBy('startDate', 'asc')
    );

    // الاستماع للتغييرات في الاجتماعات
    const unsubscribe = onSnapshot(
      meetingsQuery,
      (snapshot) => {
        const fetchedMeetings: Meeting[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          fetchedMeetings.push({
            id: doc.id,
            title: data.title,
            description: data.description || '',
            type: data.type,
            status: data.status,
            startDate: data.startDate.toDate(),
            endDate: data.endDate ? data.endDate.toDate() : undefined,
            location: data.location,
            isOnline: data.isOnline,
            meetingLink: data.meetingLink,
            organizationId: data.organizationId,
            departmentId: data.departmentId,
            createdBy: data.createdBy,
            participants: data.participants.map((p: any) => ({
              ...p,
              joinedAt: p.joinedAt ? p.joinedAt.toDate() : undefined,
              leftAt: p.leftAt ? p.leftAt.toDate() : undefined,
            })),
            agenda: data.agenda || [],
            decisions: data.decisions.map((d: any) => ({
              ...d,
              dueDate: d.dueDate ? d.dueDate.toDate() : undefined,
            })),
            tasks: data.tasks.map((t: any) => ({
              ...t,
              dueDate: t.dueDate ? t.dueDate.toDate() : undefined,
            })),
            notes: data.notes,
            summary: data.summary,
            isRecurring: data.isRecurring,
            recurringPattern: data.recurringPattern ? {
              ...data.recurringPattern,
              endDate: data.recurringPattern.endDate ? data.recurringPattern.endDate.toDate() : undefined,
            } : undefined,
          });
        });
        setMeetings(fetchedMeetings);
        setLoading(false);
      },
      (error) => {
        const isPermissionError = handleFirestoreError(error, 'OrganizationMeetingsPage');

        if (!isPermissionError) {
          toast({
            title: 'خطأ',
            description: 'حدث خطأ أثناء تحميل الاجتماعات',
            variant: 'destructive',
          });
        }
        setLoading(false);
      }
    );

    // إضافة listener إلى مدير listeners
    firestoreListenerManager.addListener(`org-meetings-${organizationId}`, unsubscribe);

    return () => {
      unsubscribe();
      firestoreListenerManager.removeListener(`org-meetings-${organizationId}`);
    };
  }, [user, organizationId, toast]);

  // تصفية الاجتماعات حسب التبويب النشط
  const filteredMeetings = meetings.filter((meeting) => {
    const now = new Date();

    if (activeTab === 'upcoming') {
      return meeting.startDate >= now && meeting.status !== 'cancelled';
    } else if (activeTab === 'past') {
      return meeting.startDate < now || meeting.status === 'completed';
    } else if (activeTab === 'daily') {
      // اجتماعات اليوم
      return isSameDay(meeting.startDate, selectedDate);
    }

    return true;
  });

  // عرض تفاصيل الاجتماع
  const handleViewMeeting = (meeting: Meeting) => {
    setSelectedMeeting(meeting);
    setIsDetailsDialogOpen(true);
  };

  // تنسيق نوع الاجتماع
  const formatMeetingType = (type: MeetingType) => {
    switch (type) {
      case 'daily': return 'يومي';
      case 'weekly': return 'أسبوعي';
      case 'monthly': return 'شهري';
      case 'custom': return 'مخصص';
      default: return type;
    }
  };

  // تنسيق حالة الاجتماع
  const formatMeetingStatus = (status: MeetingStatus) => {
    switch (status) {
      case 'scheduled': return 'مجدول';
      case 'in-progress': return 'جاري';
      case 'completed': return 'مكتمل';
      case 'cancelled': return 'ملغي';
      default: return status;
    }
  };

  // الحصول على لون الحالة
  const getStatusColor = (status: MeetingStatus) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'in-progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // عرض الاجتماعات في التقويم
  const renderCalendarMeetings = (day: Date) => {
    const dayMeetings = meetings.filter(meeting => isSameDay(meeting.startDate, day));

    return (
      <div className="mt-1 max-h-24 overflow-y-auto">
        {dayMeetings.map(meeting => (
          <div
            key={meeting.id}
            className={`text-xs p-1 mb-1 rounded cursor-pointer ${getStatusColor(meeting.status)}`}
            onClick={() => handleViewMeeting(meeting)}
          >
            {format(meeting.startDate, 'HH:mm')} - {meeting.title}
          </div>
        ))}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="px-4 md:px-6 py-4">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-10 w-32" />
        </div>
        <Skeleton className="h-12 w-full mb-6" />
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 md:px-6 py-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center">
          <Calendar className="ml-2 h-6 w-6" />
          اجتماعات المؤسسة
        </h1>
        {canCreateMeetings && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="flex items-center">
                <Plus className="ml-2 h-4 w-4" />
                إنشاء اجتماع
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] sm:max-w-[600px] max-h-[90vh] flex flex-col p-4 md:p-6">
              <DialogHeader className="flex-shrink-0">
                <DialogTitle className="text-lg md:text-xl">إنشاء اجتماع جديد</DialogTitle>
                <DialogDescription className="text-sm">
                  أدخل تفاصيل الاجتماع الجديد. اضغط على حفظ عند الانتهاء.
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-hidden">
                <CreateMeetingForm
                  onSuccess={() => setIsCreateDialogOpen(false)}
                  organizationId={organizationId || ''}
                />
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="calendar" value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 mb-4 h-auto p-1">
          <TabsTrigger value="calendar" className="flex items-center justify-center text-xs md:text-sm px-2 py-2">
            <CalendarIcon className="ml-1 h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">التقويم</span>
            <span className="sm:hidden">تقويم</span>
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center justify-center text-xs md:text-sm px-2 py-2">
            <BarChart3 className="ml-1 h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">الإحصائيات</span>
            <span className="sm:hidden">إحصائيات</span>
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="flex items-center justify-center text-xs md:text-sm px-2 py-2">
            <Clock className="ml-1 h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">القادمة</span>
            <span className="sm:hidden">قادمة</span>
          </TabsTrigger>
          <TabsTrigger value="daily" className="flex items-center justify-center text-xs md:text-sm px-2 py-2">
            <CalendarIcon className="ml-1 h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">اليوم</span>
            <span className="sm:hidden">اليوم</span>
          </TabsTrigger>
          <TabsTrigger value="past" className="flex items-center justify-center text-xs md:text-sm px-2 py-2">
            <Clock className="ml-1 h-3 w-3 md:h-4 md:w-4" />
            <span className="hidden sm:inline">السابقة</span>
            <span className="sm:hidden">سابقة</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="space-y-4">
          <MeetingsCalendar
            meetings={meetings}
            onSelectMeeting={handleViewMeeting}
            onCreateMeeting={(date) => {
              setIsCreateDialogOpen(true);
              // يمكن تمرير التاريخ المحدد إلى النموذج لاحقاً
            }}
          />
        </TabsContent>

        <TabsContent value="stats" className="space-y-4">
          <MeetingsStats meetings={meetings} />
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-4">
          {filteredMeetings.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                لا توجد اجتماعات قادمة.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {filteredMeetings.map((meeting) => (
                <Card key={meeting.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleViewMeeting(meeting)}>
                  <CardHeader className="pb-2 p-3 md:p-4">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                      <CardTitle className="text-base md:text-lg line-clamp-2">{meeting.title}</CardTitle>
                      <Badge variant="outline" className={`${getStatusColor(meeting.status)} text-xs flex-shrink-0`}>
                        {formatMeetingStatus(meeting.status)}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs md:text-sm">
                      <div className="flex flex-col gap-1">
                        <span>{format(meeting.startDate, 'EEEE, d MMMM yyyy', { locale: ar })}</span>
                        <span className="font-medium">{format(meeting.startDate, 'HH:mm', { locale: ar })}</span>
                      </div>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-2 p-3 md:p-4 pt-0">
                    <div className="space-y-1">
                      <div className="flex items-center text-xs md:text-sm text-muted-foreground">
                        <Users className="ml-2 h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                        <span>{meeting.participants.length} مشارك</span>
                      </div>
                      {meeting.isOnline ? (
                        <div className="flex items-center text-xs md:text-sm text-muted-foreground">
                          <Video className="ml-2 h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                          <span>اجتماع عبر الإنترنت</span>
                        </div>
                      ) : meeting.location ? (
                        <div className="flex items-center text-xs md:text-sm text-muted-foreground">
                          <MapPin className="ml-2 h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                          <span className="truncate">{meeting.location}</span>
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                  <CardFooter className="p-3 md:p-4 pt-0">
                    <Badge variant="outline" className="text-xs">{formatMeetingType(meeting.type)}</Badge>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="daily">
          <DailyMeetingsView
            meetings={meetings}
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            onSelectMeeting={handleViewMeeting}
          />
        </TabsContent>

        <TabsContent value="past" className="space-y-4">
          {filteredMeetings.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                لا توجد اجتماعات سابقة.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 md:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {filteredMeetings.map((meeting) => (
                <Card key={meeting.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleViewMeeting(meeting)}>
                  <CardHeader className="pb-2 p-3 md:p-4">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                      <CardTitle className="text-base md:text-lg line-clamp-2">{meeting.title}</CardTitle>
                      <Badge variant="outline" className={`${getStatusColor(meeting.status)} text-xs flex-shrink-0`}>
                        {formatMeetingStatus(meeting.status)}
                      </Badge>
                    </div>
                    <CardDescription className="text-xs md:text-sm">
                      <div className="flex flex-col gap-1">
                        <span>{format(meeting.startDate, 'EEEE, d MMMM yyyy', { locale: ar })}</span>
                        <span className="font-medium">{format(meeting.startDate, 'HH:mm', { locale: ar })}</span>
                      </div>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-3 md:p-4 pt-0">
                    <div className="flex items-center text-xs md:text-sm text-muted-foreground">
                      <Users className="ml-2 h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                      <span>{meeting.participants.length} مشارك</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog for Meeting Details */}
      <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[700px] max-h-[90vh] overflow-y-auto p-4 md:p-6">
          {selectedMeeting && (
            <MeetingDetails meeting={selectedMeeting} onClose={() => setIsDetailsDialogOpen(false)} />
          )}
        </DialogContent>
      </Dialog>
        </div>
      </div>
    </div>
  );
}
