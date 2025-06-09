'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Meeting, MeetingStatus, AttendanceStatus, AgendaItem, MeetingDecision, MeetingTask } from '@/types/meeting';
import { updateMeeting, addAgendaItem, updateAgendaItem, addMeetingDecision, addMeetingTask } from '@/services/meetings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { DialogTitle, DialogDescription, DialogHeader, DialogFooter } from '@/components/ui/dialog';
import { Calendar, Clock, Users, Video, MapPin, CheckCircle, XCircle, AlertCircle, Plus, FileText, ListChecks } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { v4 as uuidv4 } from 'uuid';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface MeetingDetailsProps {
  meeting: Meeting;
  onClose: () => void;
}

export function MeetingDetails({ meeting, onClose }: MeetingDetailsProps) {
  const { user, userClaims } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('details');
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState(meeting.notes || '');
  const [summary, setSummary] = useState(meeting.summary || '');
  const [status, setStatus] = useState<MeetingStatus>(meeting.status);

  // بيانات بند جدول الأعمال الجديد
  const [newAgendaTitle, setNewAgendaTitle] = useState('');
  const [newAgendaDescription, setNewAgendaDescription] = useState('');
  const [newAgendaDuration, setNewAgendaDuration] = useState(15);

  // بيانات القرار الجديد
  const [newDecisionDescription, setNewDecisionDescription] = useState('');
  const [newDecisionResponsible, setNewDecisionResponsible] = useState('');

  // بيانات المهمة الجديدة
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');

  const isOwner = userClaims?.isOrgOwner === true;
  const isAdmin = userClaims?.isOrgAdmin === true;
  const isEngineer = userClaims?.isOrgEngineer === true;
  const isSupervisor = userClaims?.isOrgSupervisor === true;
  const canEdit = isOwner || isAdmin || isEngineer || isSupervisor || meeting.createdBy === user?.uid;

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

  // تنسيق حالة الحضور
  const formatAttendanceStatus = (status?: AttendanceStatus) => {
    switch (status) {
      case 'present': return 'حاضر';
      case 'absent': return 'غائب';
      case 'late': return 'متأخر';
      case 'excused': return 'معتذر';
      default: return 'غير محدد';
    }
  };

  // الحصول على لون حالة الحضور
  const getAttendanceStatusColor = (status?: AttendanceStatus) => {
    switch (status) {
      case 'present': return 'bg-green-100 text-green-800';
      case 'absent': return 'bg-red-100 text-red-800';
      case 'late': return 'bg-yellow-100 text-yellow-800';
      case 'excused': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // تحديث حالة الاجتماع
  const handleUpdateStatus = async (newStatus: MeetingStatus) => {
    if (!user) return;

    try {
      setLoading(true);
      await updateMeeting(meeting.id, { status: newStatus });
      setStatus(newStatus);
      toast({
        title: 'تم تحديث الحالة',
        description: `تم تغيير حالة الاجتماع إلى ${formatMeetingStatus(newStatus)}`,
      });
    } catch (error) {
      console.error('Error updating meeting status:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء تحديث حالة الاجتماع',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // حفظ الملاحظات والملخص
  const handleSaveNotes = async () => {
    if (!user) return;

    try {
      setLoading(true);
      await updateMeeting(meeting.id, { notes, summary });
      toast({
        title: 'تم الحفظ',
        description: 'تم حفظ الملاحظات والملخص بنجاح',
      });
    } catch (error) {
      console.error('Error saving notes and summary:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء حفظ الملاحظات والملخص',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // إضافة بند جدول أعمال جديد
  const handleAddAgendaItem = async () => {
    if (!user || !newAgendaTitle) return;

    try {
      setLoading(true);

      const newItem: AgendaItem = {
        id: uuidv4(),
        title: newAgendaTitle,
        description: newAgendaDescription,
        duration: newAgendaDuration,
        status: 'pending',
      };

      await addAgendaItem(meeting.id, newItem);

      setNewAgendaTitle('');
      setNewAgendaDescription('');
      setNewAgendaDuration(15);

      toast({
        title: 'تمت الإضافة',
        description: 'تم إضافة بند جدول الأعمال بنجاح',
      });
    } catch (error) {
      console.error('Error adding agenda item:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء إضافة بند جدول الأعمال',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // إضافة قرار جديد
  const handleAddDecision = async () => {
    if (!user || !newDecisionDescription) return;

    try {
      setLoading(true);

      const responsible = meeting.participants.find(p => p.userId === newDecisionResponsible);

      const newDecision: Omit<MeetingDecision, 'id'> = {
        description: newDecisionDescription,
        responsibleUserId: (newDecisionResponsible && newDecisionResponsible !== 'none') ? newDecisionResponsible : undefined,
        responsibleUserName: responsible?.name,
        status: 'pending',
      };

      await addMeetingDecision(meeting.id, newDecision);

      setNewDecisionDescription('');
      setNewDecisionResponsible('none');

      toast({
        title: 'تمت الإضافة',
        description: 'تم إضافة القرار بنجاح',
      });
    } catch (error) {
      console.error('Error adding decision:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء إضافة القرار',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // إضافة مهمة جديدة
  const handleAddTask = async () => {
    if (!user || !newTaskDescription) return;

    try {
      setLoading(true);

      const assignee = meeting.participants.find(p => p.userId === newTaskAssignee);

      const newTask: Omit<MeetingTask, 'id'> = {
        description: newTaskDescription,
        assignedToUserId: (newTaskAssignee && newTaskAssignee !== 'unassigned') ? newTaskAssignee : undefined,
        assignedToUserName: assignee?.name,
        status: 'pending',
      };

      await addMeetingTask(meeting.id, newTask);

      setNewTaskDescription('');
      setNewTaskAssignee('unassigned');

      toast({
        title: 'تمت الإضافة',
        description: 'تم إضافة المهمة بنجاح',
      });
    } catch (error) {
      console.error('Error adding task:', error);
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء إضافة المهمة',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center justify-between">
          <span>{meeting.title}</span>
          <Badge variant="outline" className={getStatusColor(status)}>
            {formatMeetingStatus(status)}
          </Badge>
        </DialogTitle>
        <DialogDescription>
          {format(meeting.startDate, 'EEEE, d MMMM yyyy - HH:mm', { locale: ar })}
          {meeting.endDate && ` إلى ${format(meeting.endDate, 'HH:mm', { locale: ar })}`}
        </DialogDescription>
      </DialogHeader>

      <Tabs defaultValue="details" value={activeTab} onValueChange={setActiveTab} className="mt-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 h-auto p-1">
          <TabsTrigger value="details" className="text-xs md:text-sm px-2 py-2">
            التفاصيل
          </TabsTrigger>
          <TabsTrigger value="agenda" className="text-xs md:text-sm px-2 py-2">
            <span className="hidden sm:inline">جدول الأعمال</span>
            <span className="sm:hidden">الأعمال</span>
          </TabsTrigger>
          <TabsTrigger value="decisions" className="text-xs md:text-sm px-2 py-2">
            القرارات
          </TabsTrigger>
          <TabsTrigger value="tasks" className="text-xs md:text-sm px-2 py-2">
            المهام
          </TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">معلومات الاجتماع</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center">
                  <Calendar className="ml-2 h-4 w-4 text-muted-foreground" />
                  <span>
                    {format(meeting.startDate, 'EEEE, d MMMM yyyy', { locale: ar })}
                  </span>
                </div>
                <div className="flex items-center">
                  <Clock className="ml-2 h-4 w-4 text-muted-foreground" />
                  <span>
                    {format(meeting.startDate, 'HH:mm', { locale: ar })}
                    {meeting.endDate && ` - ${format(meeting.endDate, 'HH:mm', { locale: ar })}`}
                  </span>
                </div>
                {meeting.isOnline ? (
                  <div className="flex items-center">
                    <Video className="ml-2 h-4 w-4 text-muted-foreground" />
                    <span>اجتماع عبر الإنترنت</span>
                    {meeting.meetingLink && (
                      <a href={meeting.meetingLink} target="_blank" rel="noopener noreferrer" className="mr-2 text-primary underline">
                        رابط الاجتماع
                      </a>
                    )}
                  </div>
                ) : meeting.location ? (
                  <div className="flex items-center">
                    <MapPin className="ml-2 h-4 w-4 text-muted-foreground" />
                    <span>{meeting.location}</span>
                  </div>
                ) : null}
                {meeting.description && (
                  <div className="mt-2">
                    <h4 className="text-sm font-medium">الوصف:</h4>
                    <p className="text-sm text-muted-foreground">{meeting.description}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>المشاركون ({meeting.participants.length})</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="max-h-40 overflow-y-auto">
                <div className="space-y-2">
                  {meeting.participants.map((participant) => (
                    <div key={participant.userId} className="flex items-center justify-between">
                      <span>{participant.name}</span>
                      <Badge variant="outline" className={getAttendanceStatusColor(participant.attendanceStatus)}>
                        {formatAttendanceStatus(participant.attendanceStatus)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {canEdit && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="notes">ملاحظات الاجتماع</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="أدخل ملاحظات الاجتماع"
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="summary">ملخص الاجتماع</Label>
                  <Textarea
                    id="summary"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="أدخل ملخص الاجتماع"
                    rows={4}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={handleSaveNotes} disabled={loading}>
                  حفظ الملاحظات والملخص
                </Button>
              </div>
            </div>
          )}

          {canEdit && (
            <div className="mt-4">
              <h3 className="text-sm font-medium mb-2">تغيير حالة الاجتماع:</h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUpdateStatus('scheduled')}
                  disabled={status === 'scheduled' || loading}
                  className={status === 'scheduled' ? 'border-blue-500' : ''}
                >
                  مجدول
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUpdateStatus('in-progress')}
                  disabled={status === 'in-progress' || loading}
                  className={status === 'in-progress' ? 'border-yellow-500' : ''}
                >
                  جاري
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUpdateStatus('completed')}
                  disabled={status === 'completed' || loading}
                  className={status === 'completed' ? 'border-green-500' : ''}
                >
                  مكتمل
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUpdateStatus('cancelled')}
                  disabled={status === 'cancelled' || loading}
                  className={status === 'cancelled' ? 'border-red-500' : ''}
                >
                  ملغي
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="agenda" className="space-y-4 mt-4">
          {meeting.agenda.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                لا توجد بنود في جدول الأعمال.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {meeting.agenda.map((item, index) => (
                <Card key={item.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center justify-between">
                      <span>{index + 1}. {item.title}</span>
                      {item.duration && (
                        <Badge variant="outline">{item.duration} دقيقة</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  {item.description && (
                    <CardContent className="pt-0">
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}

          {canEdit && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">إضافة بند جديد</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="agendaTitle">العنوان</Label>
                    <Input
                      id="agendaTitle"
                      value={newAgendaTitle}
                      onChange={(e) => setNewAgendaTitle(e.target.value)}
                      placeholder="عنوان البند"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agendaDescription">الوصف (اختياري)</Label>
                    <Textarea
                      id="agendaDescription"
                      value={newAgendaDescription}
                      onChange={(e) => setNewAgendaDescription(e.target.value)}
                      placeholder="وصف البند"
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="agendaDuration">المدة (بالدقائق)</Label>
                    <Input
                      id="agendaDuration"
                      type="number"
                      min="5"
                      step="5"
                      value={newAgendaDuration}
                      onChange={(e) => setNewAgendaDuration(parseInt(e.target.value))}
                    />
                  </div>
                  <Button onClick={handleAddAgendaItem} disabled={!newAgendaTitle || loading} className="w-full">
                    <Plus className="ml-2 h-4 w-4" />
                    إضافة بند
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="decisions" className="space-y-4 mt-4">
          {meeting.decisions.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                لا توجد قرارات مسجلة.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {meeting.decisions.map((decision) => (
                <Card key={decision.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{decision.description}</CardTitle>
                    {decision.responsibleUserName && (
                      <CardDescription>
                        المسؤول: {decision.responsibleUserName}
                      </CardDescription>
                    )}
                  </CardHeader>
                  {decision.dueDate && (
                    <CardContent className="pt-0">
                      <div className="flex items-center">
                        <Calendar className="ml-2 h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          تاريخ الاستحقاق: {format(decision.dueDate, 'PPP', { locale: ar })}
                        </span>
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}

          {canEdit && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">إضافة قرار جديد</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="decisionDescription">وصف القرار</Label>
                    <Textarea
                      id="decisionDescription"
                      value={newDecisionDescription}
                      onChange={(e) => setNewDecisionDescription(e.target.value)}
                      placeholder="وصف القرار"
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="decisionResponsible">المسؤول (اختياري)</Label>
                    <Select value={newDecisionResponsible} onValueChange={setNewDecisionResponsible}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر المسؤول" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">بدون مسؤول</SelectItem>
                        {meeting.participants.map((participant) => (
                          <SelectItem key={participant.userId} value={participant.userId}>
                            {participant.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleAddDecision} disabled={!newDecisionDescription || loading} className="w-full">
                    <Plus className="ml-2 h-4 w-4" />
                    إضافة قرار
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4 mt-4">
          {meeting.tasks.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                لا توجد مهام مسجلة.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {meeting.tasks.map((task) => (
                <Card key={task.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{task.description}</CardTitle>
                    {task.assignedToUserName && (
                      <CardDescription>
                        مسند إلى: {task.assignedToUserName}
                      </CardDescription>
                    )}
                  </CardHeader>
                  {task.dueDate && (
                    <CardContent className="pt-0">
                      <div className="flex items-center">
                        <Calendar className="ml-2 h-4 w-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">
                          تاريخ الاستحقاق: {format(task.dueDate, 'PPP', { locale: ar })}
                        </span>
                      </div>
                    </CardContent>
                  )}
                </Card>
              ))}
            </div>
          )}

          {canEdit && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">إضافة مهمة جديدة</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="taskDescription">وصف المهمة</Label>
                    <Textarea
                      id="taskDescription"
                      value={newTaskDescription}
                      onChange={(e) => setNewTaskDescription(e.target.value)}
                      placeholder="وصف المهمة"
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="taskAssignee">مسند إلى (اختياري)</Label>
                    <Select value={newTaskAssignee} onValueChange={setNewTaskAssignee}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر المسؤول" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">بدون تعيين</SelectItem>
                        {meeting.participants.map((participant) => (
                          <SelectItem key={participant.userId} value={participant.userId}>
                            {participant.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleAddTask} disabled={!newTaskDescription || loading} className="w-full">
                    <Plus className="ml-2 h-4 w-4" />
                    إضافة مهمة
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <DialogFooter className="mt-6">
        <Button variant="outline" onClick={onClose}>
          إغلاق
        </Button>
      </DialogFooter>
    </>
  );
}
