'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Calendar, momentLocalizer, View, Views } from 'react-big-calendar';
import moment from 'moment';
import 'moment/locale/ar';
import { Meeting } from '@/types/meeting';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Users, 
  MapPin, 
  Video,
  ChevronLeft,
  ChevronRight,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';

// إعداد moment للغة العربية
moment.locale('ar');
const localizer = momentLocalizer(moment);

interface MeetingsCalendarProps {
  meetings: Meeting[];
  onSelectMeeting?: (meeting: Meeting) => void;
  onCreateMeeting?: (date: Date) => void;
  className?: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: Meeting;
}

export function MeetingsCalendar({ 
  meetings, 
  onSelectMeeting, 
  onCreateMeeting,
  className 
}: MeetingsCalendarProps) {
  const [currentView, setCurrentView] = useState<View>(Views.MONTH);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);

  // تحويل الاجتماعات إلى أحداث التقويم
  const events: CalendarEvent[] = useMemo(() => {
    return meetings.map(meeting => ({
      id: meeting.id,
      title: meeting.title,
      start: meeting.startDate,
      end: meeting.endDate || new Date(meeting.startDate.getTime() + 60 * 60 * 1000), // ساعة افتراضية
      resource: meeting,
    }));
  }, [meetings]);

  // معالج اختيار حدث
  const handleSelectEvent = useCallback((event: CalendarEvent) => {
    setSelectedEvent(event);
    setIsEventDialogOpen(true);
    if (onSelectMeeting) {
      onSelectMeeting(event.resource);
    }
  }, [onSelectMeeting]);

  // معالج اختيار فترة زمنية (لإنشاء اجتماع جديد)
  const handleSelectSlot = useCallback(({ start }: { start: Date }) => {
    if (onCreateMeeting) {
      onCreateMeeting(start);
    }
  }, [onCreateMeeting]);

  // تخصيص مظهر الأحداث
  const eventStyleGetter = useCallback((event: CalendarEvent) => {
    const meeting = event.resource;
    let backgroundColor = '#3174ad';
    let borderColor = '#3174ad';

    // ألوان مختلفة حسب حالة الاجتماع
    switch (meeting.status) {
      case 'scheduled':
        backgroundColor = '#3b82f6';
        borderColor = '#2563eb';
        break;
      case 'in-progress':
        backgroundColor = '#f59e0b';
        borderColor = '#d97706';
        break;
      case 'completed':
        backgroundColor = '#10b981';
        borderColor = '#059669';
        break;
      case 'cancelled':
        backgroundColor = '#ef4444';
        borderColor = '#dc2626';
        break;
    }

    return {
      style: {
        backgroundColor,
        borderColor,
        color: 'white',
        border: `2px solid ${borderColor}`,
        borderRadius: '4px',
        fontSize: '12px',
        padding: '2px 4px',
      }
    };
  }, []);

  // تخصيص عرض الحدث
  const EventComponent = ({ event }: { event: CalendarEvent }) => {
    const meeting = event.resource;
    return (
      <div className="flex items-center gap-1 text-xs">
        <div className="flex-1 truncate">
          {meeting.title}
        </div>
        {meeting.isOnline ? (
          <Video className="h-3 w-3 flex-shrink-0" />
        ) : (
          <MapPin className="h-3 w-3 flex-shrink-0" />
        )}
      </div>
    );
  };

  // تخصيص شريط الأدوات
  const CustomToolbar = ({ label, onNavigate, onView }: any) => {
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between mb-4 p-4 bg-background border rounded-lg gap-4">
        {/* التنقل */}
        <div className="flex items-center gap-2 order-2 sm:order-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('PREV')}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('TODAY')}
            className="h-8 px-3 text-xs"
          >
            اليوم
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigate('NEXT')}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>

        {/* العنوان */}
        <h2 className="text-base md:text-lg font-semibold order-1 sm:order-2">{label}</h2>

        {/* أزرار العرض */}
        <div className="flex items-center gap-1 order-3">
          <Button
            variant={currentView === Views.MONTH ? "default" : "outline"}
            size="sm"
            onClick={() => onView(Views.MONTH)}
            className="h-8 px-2 text-xs"
          >
            <span className="hidden sm:inline">شهر</span>
            <span className="sm:hidden">ش</span>
          </Button>
          <Button
            variant={currentView === Views.WEEK ? "default" : "outline"}
            size="sm"
            onClick={() => onView(Views.WEEK)}
            className="h-8 px-2 text-xs"
          >
            <span className="hidden sm:inline">أسبوع</span>
            <span className="sm:hidden">أ</span>
          </Button>
          <Button
            variant={currentView === Views.DAY ? "default" : "outline"}
            size="sm"
            onClick={() => onView(Views.DAY)}
            className="h-8 px-2 text-xs"
          >
            <span className="hidden sm:inline">يوم</span>
            <span className="sm:hidden">ي</span>
          </Button>
          {onCreateMeeting && (
            <Button
              size="sm"
              onClick={() => onCreateMeeting(new Date())}
              className="h-8 px-2 text-xs ml-2"
            >
              <Plus className="h-3 w-3 ml-1" />
              <span className="hidden sm:inline">إنشاء اجتماع</span>
              <span className="sm:hidden">إنشاء</span>
            </Button>
          )}
        </div>
      </div>
    );
  };

  // تنسيق حالة الاجتماع
  const formatMeetingStatus = (status: string) => {
    switch (status) {
      case 'scheduled': return 'مجدول';
      case 'in-progress': return 'جاري';
      case 'completed': return 'مكتمل';
      case 'cancelled': return 'ملغي';
      default: return status;
    }
  };

  // لون حالة الاجتماع
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'in-progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <Card>
        <CardContent className="p-0">
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            style={{ height: 600 }}
            onSelectEvent={handleSelectEvent}
            onSelectSlot={handleSelectSlot}
            selectable
            view={currentView}
            onView={setCurrentView}
            date={currentDate}
            onNavigate={setCurrentDate}
            eventPropGetter={eventStyleGetter}
            components={{
              event: EventComponent,
              toolbar: CustomToolbar,
            }}
            messages={{
              next: "التالي",
              previous: "السابق",
              today: "اليوم",
              month: "شهر",
              week: "أسبوع",
              day: "يوم",
              agenda: "جدول الأعمال",
              date: "التاريخ",
              time: "الوقت",
              event: "حدث",
              noEventsInRange: "لا توجد أحداث في هذا النطاق",
              showMore: (total) => `+${total} المزيد`,
            }}
            formats={{
              monthHeaderFormat: 'MMMM YYYY',
              dayHeaderFormat: 'dddd DD/MM',
              dayRangeHeaderFormat: ({ start, end }) => 
                `${moment(start).format('DD/MM')} - ${moment(end).format('DD/MM')}`,
              timeGutterFormat: 'HH:mm',
              eventTimeRangeFormat: ({ start, end }) => 
                `${moment(start).format('HH:mm')} - ${moment(end).format('HH:mm')}`,
            }}
            rtl={true}
          />
        </CardContent>
      </Card>

      {/* مربع حوار تفاصيل الحدث */}
      <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
        <DialogContent className="sm:max-w-md">
          {selectedEvent && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between">
                  <span>{selectedEvent.resource.title}</span>
                  <Badge variant="outline" className={getStatusColor(selectedEvent.resource.status)}>
                    {formatMeetingStatus(selectedEvent.resource.status)}
                  </Badge>
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {format(selectedEvent.resource.startDate, 'EEEE, d MMMM yyyy', { locale: ar })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">
                    {format(selectedEvent.resource.startDate, 'HH:mm', { locale: ar })}
                    {selectedEvent.resource.endDate && 
                      ` - ${format(selectedEvent.resource.endDate, 'HH:mm', { locale: ar })}`
                    }
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{selectedEvent.resource.participants.length} مشارك</span>
                </div>
                {selectedEvent.resource.isOnline ? (
                  <div className="flex items-center gap-2">
                    <Video className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">اجتماع عبر الإنترنت</span>
                  </div>
                ) : selectedEvent.resource.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{selectedEvent.resource.location}</span>
                  </div>
                )}
                {selectedEvent.resource.description && (
                  <div className="text-sm text-muted-foreground">
                    {selectedEvent.resource.description}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
