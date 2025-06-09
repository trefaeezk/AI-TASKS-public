'use client';

import React from 'react';
import { Meeting } from '@/types/meeting';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { format, isSameDay, addDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Users, 
  MapPin, 
  Video,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

interface DailyMeetingsViewProps {
  meetings: Meeting[];
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onSelectMeeting: (meeting: Meeting) => void;
}

export function DailyMeetingsView({ 
  meetings, 
  selectedDate, 
  onDateChange, 
  onSelectMeeting 
}: DailyMeetingsViewProps) {
  
  // تصفية الاجتماعات لليوم المحدد
  const dayMeetings = meetings.filter(meeting => 
    isSameDay(meeting.startDate, selectedDate)
  ).sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

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
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center">
            <CalendarIcon className="ml-2 h-5 w-5" />
            <div>
              <h2 className="text-lg font-semibold">
                اجتماعات {format(selectedDate, 'EEEE', { locale: ar })}
              </h2>
              <p className="text-sm text-muted-foreground">
                {format(selectedDate, 'd MMMM yyyy', { locale: ar })}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDateChange(new Date())}
              className="h-8 px-3 text-xs"
            >
              اليوم
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDateChange(addDays(selectedDate, -1))}
              className="h-8 px-2"
            >
              <ChevronRight className="h-4 w-4" />
              <span className="hidden sm:inline ml-1">السابق</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDateChange(addDays(selectedDate, 1))}
              className="h-8 px-2"
            >
              <span className="hidden sm:inline mr-1">التالي</span>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {dayMeetings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CalendarIcon className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>لا توجد اجتماعات في هذا اليوم</p>
          </div>
        ) : (
          <div className="space-y-4">
            {dayMeetings.map((meeting) => (
              <Card 
                key={meeting.id} 
                className="cursor-pointer hover:shadow-md transition-shadow border-l-4"
                style={{
                  borderLeftColor: 
                    meeting.status === 'scheduled' ? '#3b82f6' :
                    meeting.status === 'in-progress' ? '#f59e0b' :
                    meeting.status === 'completed' ? '#10b981' :
                    meeting.status === 'cancelled' ? '#ef4444' : '#6b7280'
                }}
                onClick={() => onSelectMeeting(meeting)}
              >
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                        <h3 className="font-semibold text-base md:text-lg truncate">{meeting.title}</h3>
                        <Badge variant="outline" className={`${getStatusColor(meeting.status)} text-xs flex-shrink-0`}>
                          {formatMeetingStatus(meeting.status)}
                        </Badge>
                      </div>

                      <div className="space-y-1 md:space-y-2 text-xs md:text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Clock className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                          <span>
                            {format(meeting.startDate, 'HH:mm', { locale: ar })}
                            {meeting.endDate &&
                              ` - ${format(meeting.endDate, 'HH:mm', { locale: ar })}`
                            }
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <Users className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                          <span>{meeting.participants.length} مشارك</span>
                        </div>

                        {meeting.isOnline ? (
                          <div className="flex items-center gap-2">
                            <Video className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                            <span className="truncate">اجتماع عبر الإنترنت</span>
                          </div>
                        ) : meeting.location && (
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                            <span className="truncate">{meeting.location}</span>
                          </div>
                        )}

                        {meeting.description && (
                          <p className="text-xs md:text-sm mt-1 md:mt-2 line-clamp-2">
                            {meeting.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <div className="text-xl md:text-2xl font-bold text-primary">
                        {format(meeting.startDate, 'HH', { locale: ar })}
                      </div>
                      <div className="text-xs md:text-sm text-muted-foreground">
                        {format(meeting.startDate, 'mm', { locale: ar })}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
