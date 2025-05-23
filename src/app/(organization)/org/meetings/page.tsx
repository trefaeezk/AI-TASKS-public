'use client';

// منع التوليد المسبق للصفحة
export const dynamic = 'force-dynamic';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Plus, Clock, Users, Video, MapPin, Calendar as CalendarIcon } from 'lucide-react';
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
  const isOwner = userClaims?.owner === true;
  const isAdmin = userClaims?.admin === true;
  const isEngineer = userClaims?.engineer === true;
  const isSupervisor = userClaims?.supervisor === true;
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
      <div className="container mx-auto p-4">
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
    <div className="container mx-auto p-4">
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
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>إنشاء اجتماع جديد</DialogTitle>
                <DialogDescription>
                  أدخل تفاصيل الاجتماع الجديد. اضغط على حفظ عند الانتهاء.
                </DialogDescription>
              </DialogHeader>
              <CreateMeetingForm
                onSuccess={() => setIsCreateDialogOpen(false)}
                organizationId={organizationId || ''}
              />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="upcoming" value={activeTab} onValueChange={setActiveTab} className="mb-6">
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="upcoming">
            <Clock className="ml-2 h-4 w-4" />
            الاجتماعات القادمة
          </TabsTrigger>
          <TabsTrigger value="daily">
            <CalendarIcon className="ml-2 h-4 w-4" />
            اجتماعات اليوم
          </TabsTrigger>
          <TabsTrigger value="past">
            <Clock className="ml-2 h-4 w-4" />
            الاجتماعات السابقة
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="space-y-4">
          {filteredMeetings.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                لا توجد اجتماعات قادمة.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {filteredMeetings.map((meeting) => (
                <Card key={meeting.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleViewMeeting(meeting)}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{meeting.title}</CardTitle>
                      <Badge variant="outline" className={getStatusColor(meeting.status)}>
                        {formatMeetingStatus(meeting.status)}
                      </Badge>
                    </div>
                    <CardDescription>
                      {format(meeting.startDate, 'EEEE, d MMMM yyyy - HH:mm', { locale: ar })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-2">
                    <div className="flex items-center text-sm text-muted-foreground mb-2">
                      <Users className="ml-2 h-4 w-4" />
                      <span>{meeting.participants.length} مشارك</span>
                    </div>
                    {meeting.isOnline ? (
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Video className="ml-2 h-4 w-4" />
                        <span>اجتماع عبر الإنترنت</span>
                      </div>
                    ) : meeting.location ? (
                      <div className="flex items-center text-sm text-muted-foreground">
                        <MapPin className="ml-2 h-4 w-4" />
                        <span>{meeting.location}</span>
                      </div>
                    ) : null}
                  </CardContent>
                  <CardFooter>
                    <Badge variant="outline">{formatMeetingType(meeting.type)}</Badge>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="daily">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center">
                  <CalendarIcon className="ml-2 h-5 w-5" />
                  اجتماعات {format(selectedDate, 'EEEE, d MMMM yyyy', { locale: ar })}
                </div>
                <div className="flex items-center space-x-2">
                  <Button variant="outline" size="sm" onClick={() => setSelectedDate(new Date())}>
                    اليوم
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setSelectedDate(addDays(selectedDate, -1))}>
                    السابق
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setSelectedDate(addDays(selectedDate, 1))}>
                    التالي
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2">
                {weekDays.map((day, index) => (
                  <div
                    key={index}
                    className={`border rounded p-2 min-h-[100px] ${
                      isSameDay(day, new Date()) ? 'bg-primary/10 border-primary' : ''
                    } ${
                      isSameDay(day, selectedDate) ? 'ring-2 ring-primary' : ''
                    }`}
                    onClick={() => setSelectedDate(day)}
                  >
                    <div className="text-center font-medium">
                      {format(day, 'EEEE', { locale: ar })}
                    </div>
                    <div className="text-center text-sm text-muted-foreground">
                      {format(day, 'd MMM', { locale: ar })}
                    </div>
                    {renderCalendarMeetings(day)}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="past" className="space-y-4">
          {filteredMeetings.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                لا توجد اجتماعات سابقة.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {filteredMeetings.map((meeting) => (
                <Card key={meeting.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleViewMeeting(meeting)}>
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{meeting.title}</CardTitle>
                      <Badge variant="outline" className={getStatusColor(meeting.status)}>
                        {formatMeetingStatus(meeting.status)}
                      </Badge>
                    </div>
                    <CardDescription>
                      {format(meeting.startDate, 'EEEE, d MMMM yyyy - HH:mm', { locale: ar })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center text-sm text-muted-foreground mb-2">
                      <Users className="ml-2 h-4 w-4" />
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
        <DialogContent className="sm:max-w-[700px] max-h-[80vh] overflow-y-auto">
          {selectedMeeting && (
            <MeetingDetails meeting={selectedMeeting} onClose={() => setIsDetailsDialogOpen(false)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
