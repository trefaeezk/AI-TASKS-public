'use client';

import React from 'react';
import { Meeting } from '@/types/meeting';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, isSameDay, isSameMonth, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek } from 'date-fns';
import { ar } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MiniCalendarProps {
  meetings: Meeting[];
  selectedDate?: Date;
  onDateSelect?: (date: Date) => void;
  className?: string;
}

export function MiniCalendar({ 
  meetings, 
  selectedDate = new Date(), 
  onDateSelect,
  className 
}: MiniCalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());

  // الحصول على أيام الشهر
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 6 }); // السبت
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 6 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // الحصول على اجتماعات اليوم
  const getMeetingsForDay = (date: Date) => {
    return meetings.filter(meeting => isSameDay(meeting.startDate, date));
  };

  // التنقل بين الشهور
  const goToPreviousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const goToNextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    if (onDateSelect) {
      onDateSelect(today);
    }
  };

  // أيام الأسبوع
  const weekDays = ['ح', 'ن', 'ث', 'ر', 'خ', 'ج', 'س'];

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">
            {format(currentMonth, 'MMMM yyyy', { locale: ar })}
          </CardTitle>
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={goToPreviousMonth}
              className="h-6 w-6 p-0"
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={goToToday}
              className="h-6 px-2 text-xs"
            >
              اليوم
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={goToNextMonth}
              className="h-6 w-6 p-0"
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-2">
        {/* أيام الأسبوع */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((day, index) => (
            <div
              key={index}
              className="h-6 flex items-center justify-center text-xs font-medium text-muted-foreground"
            >
              {day}
            </div>
          ))}
        </div>

        {/* أيام الشهر */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => {
            const dayMeetings = getMeetingsForDay(day);
            const isToday = isSameDay(day, new Date());
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const hasMeetings = dayMeetings.length > 0;

            return (
              <button
                key={index}
                onClick={() => onDateSelect && onDateSelect(day)}
                className={cn(
                  "h-8 w-8 text-xs rounded-md flex flex-col items-center justify-center relative transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  {
                    "text-muted-foreground": !isCurrentMonth,
                    "bg-primary text-primary-foreground": isSelected,
                    "bg-accent": isToday && !isSelected,
                    "font-semibold": isToday,
                  }
                )}
              >
                <span className="leading-none">
                  {format(day, 'd')}
                </span>
                
                {/* مؤشر الاجتماعات */}
                {hasMeetings && (
                  <div className="absolute bottom-0.5 left-1/2 transform -translate-x-1/2">
                    <div className="flex space-x-0.5">
                      {dayMeetings.slice(0, 3).map((meeting, meetingIndex) => (
                        <div
                          key={meetingIndex}
                          className={cn(
                            "w-1 h-1 rounded-full",
                            {
                              "bg-blue-500": meeting.status === 'scheduled',
                              "bg-yellow-500": meeting.status === 'in-progress',
                              "bg-green-500": meeting.status === 'completed',
                              "bg-red-500": meeting.status === 'cancelled',
                            }
                          )}
                        />
                      ))}
                      {dayMeetings.length > 3 && (
                        <div className="w-1 h-1 rounded-full bg-gray-400" />
                      )}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* معلومات اليوم المحدد */}
        {selectedDate && (
          <div className="mt-3 pt-3 border-t">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              {format(selectedDate, 'EEEE, d MMMM', { locale: ar })}
            </div>
            {getMeetingsForDay(selectedDate).length > 0 ? (
              <div className="space-y-1">
                {getMeetingsForDay(selectedDate).slice(0, 3).map((meeting, index) => (
                  <div
                    key={index}
                    className="flex items-center space-x-2 text-xs p-1 rounded bg-muted/50"
                  >
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full flex-shrink-0",
                        {
                          "bg-blue-500": meeting.status === 'scheduled',
                          "bg-yellow-500": meeting.status === 'in-progress',
                          "bg-green-500": meeting.status === 'completed',
                          "bg-red-500": meeting.status === 'cancelled',
                        }
                      )}
                    />
                    <div className="flex-1 truncate">
                      <div className="font-medium truncate">{meeting.title}</div>
                      <div className="text-muted-foreground">
                        {format(meeting.startDate, 'HH:mm')}
                      </div>
                    </div>
                  </div>
                ))}
                {getMeetingsForDay(selectedDate).length > 3 && (
                  <div className="text-xs text-muted-foreground text-center">
                    +{getMeetingsForDay(selectedDate).length - 3} المزيد
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground text-center py-2">
                لا توجد اجتماعات
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
