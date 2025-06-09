'use client';

import React from 'react';
import { Meeting } from '@/types/meeting';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  Clock, 
  Users, 
  CheckCircle, 
  XCircle, 
  PlayCircle,
  PauseCircle
} from 'lucide-react';

interface MeetingsStatsProps {
  meetings: Meeting[];
}

export function MeetingsStats({ meetings }: MeetingsStatsProps) {
  
  // حساب الإحصائيات
  const stats = React.useMemo(() => {
    const total = meetings.length;
    const scheduled = meetings.filter(m => m.status === 'scheduled').length;
    const inProgress = meetings.filter(m => m.status === 'in-progress').length;
    const completed = meetings.filter(m => m.status === 'completed').length;
    const cancelled = meetings.filter(m => m.status === 'cancelled').length;
    
    const totalParticipants = meetings.reduce((sum, m) => sum + m.participants.length, 0);
    const avgParticipants = total > 0 ? Math.round(totalParticipants / total) : 0;
    
    const onlineMeetings = meetings.filter(m => m.isOnline).length;
    const onlinePercentage = total > 0 ? Math.round((onlineMeetings / total) * 100) : 0;
    
    const thisWeek = meetings.filter(m => {
      const now = new Date();
      const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return m.startDate >= weekStart && m.startDate <= weekEnd;
    }).length;
    
    return {
      total,
      scheduled,
      inProgress,
      completed,
      cancelled,
      avgParticipants,
      onlinePercentage,
      thisWeek
    };
  }, [meetings]);

  const statCards = [
    {
      title: 'إجمالي الاجتماعات',
      value: stats.total,
      icon: Calendar,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'مجدولة',
      value: stats.scheduled,
      icon: Clock,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'جارية',
      value: stats.inProgress,
      icon: PlayCircle,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
    {
      title: 'مكتملة',
      value: stats.completed,
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'ملغية',
      value: stats.cancelled,
      icon: XCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
    },
    {
      title: 'متوسط المشاركين',
      value: stats.avgParticipants,
      icon: Users,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ];

  return (
    <div className="space-y-6">
      {/* الإحصائيات الأساسية */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((stat, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                  <stat.icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </p>
                  <p className="text-2xl font-bold">
                    {stat.value}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* إحصائيات إضافية */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">اجتماعات هذا الأسبوع</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                <span className="text-sm text-muted-foreground">العدد</span>
              </div>
              <Badge variant="secondary" className="text-lg px-3 py-1">
                {stats.thisWeek}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">الاجتماعات الإلكترونية</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <PauseCircle className="h-5 w-5 text-green-600" />
                <span className="text-sm text-muted-foreground">النسبة</span>
              </div>
              <Badge variant="secondary" className="text-lg px-3 py-1">
                {stats.onlinePercentage}%
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* توزيع الحالات */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">توزيع حالات الاجتماعات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { label: 'مجدولة', value: stats.scheduled, total: stats.total, color: 'bg-blue-500' },
              { label: 'جارية', value: stats.inProgress, total: stats.total, color: 'bg-yellow-500' },
              { label: 'مكتملة', value: stats.completed, total: stats.total, color: 'bg-green-500' },
              { label: 'ملغية', value: stats.cancelled, total: stats.total, color: 'bg-red-500' },
            ].map((item, index) => {
              const percentage = item.total > 0 ? Math.round((item.value / item.total) * 100) : 0;
              return (
                <div key={index} className="flex items-center space-x-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{item.label}</span>
                      <span className="text-sm text-muted-foreground">
                        {item.value} ({percentage}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${item.color}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
