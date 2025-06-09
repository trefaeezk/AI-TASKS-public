'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { createMeeting } from '@/services/meetings';
import { Meeting, MeetingType, MeetingStatus } from '@/types/meeting';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Clock, Users } from 'lucide-react';
import { format, addHours, setHours, setMinutes } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';

interface CreateMeetingFormProps {
  onSuccess: () => void;
  organizationId: string;
  departmentId?: string;
}

interface Department {
  id: string;
  name: string;
}

interface Member {
  uid: string;
  email: string;
  displayName?: string;
  role: string;
  departmentId?: string;
}

export function CreateMeetingForm({ onSuccess, organizationId, departmentId }: CreateMeetingFormProps) {
  const { user, userClaims } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [isRecurring, setIsRecurring] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  // بيانات الاجتماع
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<MeetingType>('custom');
  const [selectedDepartment, setSelectedDepartment] = useState<string | undefined>(departmentId);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [startTime, setStartTime] = useState('09:00');
  const [duration, setDuration] = useState(60); // بالدقائق
  const [location, setLocation] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [recurringFrequency, setRecurringFrequency] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [recurringInterval, setRecurringInterval] = useState(1);
  const [recurringCount, setRecurringCount] = useState(5);

  // تحميل الأقسام
  useEffect(() => {
    if (!organizationId) return;

    const fetchDepartments = async () => {
      try {
        const departmentsQuery = query(
          collection(db, 'organizations', organizationId, 'departments')
        );
        const snapshot = await getDocs(departmentsQuery);
        const departmentsList: Department[] = [];
        snapshot.forEach((doc) => {
          departmentsList.push({
            id: doc.id,
            name: doc.data().name,
          });
        });
        setDepartments(departmentsList);
      } catch (error) {
        console.error('Error fetching departments:', error);
      }
    };

    fetchDepartments();
  }, [organizationId]);

  // تحميل الأعضاء
  useEffect(() => {
    if (!organizationId) return;

    const fetchMembers = async () => {
      try {
        const membersQuery = query(
          collection(db, 'organizations', organizationId, 'members')
        );
        const snapshot = await getDocs(membersQuery);
        const membersList: Member[] = [];
        snapshot.forEach((doc) => {
          membersList.push({
            uid: doc.id,
            email: doc.data().email,
            displayName: doc.data().displayName,
            role: doc.data().role,
            departmentId: doc.data().departmentId,
          });
        });
        setMembers(membersList);
      } catch (error) {
        console.error('Error fetching members:', error);
      }
    };

    fetchMembers();
  }, [organizationId]);

  // تحديث قائمة الأعضاء المحددين عند تغيير القسم
  useEffect(() => {
    if (selectedDepartment && selectedDepartment !== 'none') {
      // تحديد أعضاء القسم تلقائيًا
      const departmentMembers = members
        .filter(member => member.departmentId === selectedDepartment)
        .map(member => member.uid);
      setSelectedMembers(departmentMembers);
    } else {
      setSelectedMembers([]);
    }
  }, [selectedDepartment, members]);

  // تحويل وقت البدء إلى ساعة ودقيقة
  const parseStartTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    return { hours, minutes };
  };

  // إنشاء تاريخ البدء مع الوقت
  const createStartDateTime = () => {
    const { hours, minutes } = parseStartTime(startTime);
    const dateTime = new Date(startDate);
    dateTime.setHours(hours, minutes, 0, 0);
    return dateTime;
  };

  // إنشاء تاريخ الانتهاء
  const createEndDateTime = (start: Date) => {
    return new Date(start.getTime() + duration * 60000);
  };

  // تقديم النموذج
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || !organizationId) {
      toast({
        title: 'خطأ',
        description: 'يجب تسجيل الدخول وتحديد المؤسسة',
        variant: 'destructive',
      });
      return;
    }

    if (!title) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال عنوان الاجتماع',
        variant: 'destructive',
      });
      return;
    }

    try {
      setLoading(true);

      const startDateTime = createStartDateTime();
      const endDateTime = createEndDateTime(startDateTime);

      // إعداد المشاركين
      const participants = selectedMembers.map(memberId => {
        const member = members.find(m => m.uid === memberId);
        return {
          userId: memberId,
          name: member?.displayName || member?.email || '',
          email: member?.email || '',
          role: member?.role || '',
        };
      });

      // إضافة المستخدم الحالي إذا لم يكن موجودًا
      if (!participants.some(p => p.userId === user.uid)) {
        participants.push({
          userId: user.uid,
          name: user.displayName || user.email || '',
          email: user.email || '',
          role: userClaims?.role || '',
        });
      }

      // إنشاء بيانات الاجتماع
      const meetingData: any = {
        title: title || '',
        description: description || '',
        type,
        status: 'scheduled',
        startDate: startDateTime,
        endDate: endDateTime,
        location: isOnline ? '' : (location || ''),
        isOnline,
        meetingLink: isOnline ? (meetingLink || '') : '',
        organizationId,
        createdBy: user.uid,
        participants,
        agenda: [],
        decisions: [],
        tasks: [],
        notes: '',
        summary: '',
        isRecurring,
      };

      // إضافة departmentId فقط إذا لم يكن 'none'
      if (selectedDepartment && selectedDepartment !== 'none') {
        meetingData.departmentId = selectedDepartment;
      }

      // إضافة recurringPattern فقط إذا كان الاجتماع متكرر
      if (isRecurring) {
        meetingData.recurringPattern = {
          frequency: recurringFrequency,
          interval: recurringInterval,
          count: recurringCount,
        };
      }

      // إنشاء الاجتماع
      await createMeeting(meetingData);

      toast({
        title: 'تم إنشاء الاجتماع',
        description: 'تم إنشاء الاجتماع بنجاح',
      });

      onSuccess();
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

  return (
    <div className="max-h-[70vh] overflow-y-auto mobile-scroll scrollbar-thin px-1">
      <form onSubmit={handleSubmit} className="space-y-4 pb-4">
        <div className="space-y-2">
        <Label htmlFor="title">عنوان الاجتماع</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="أدخل عنوان الاجتماع"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">وصف الاجتماع</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="أدخل وصف الاجتماع"
          rows={3}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>نوع الاجتماع</Label>
          <Select value={type} onValueChange={(value) => setType(value as MeetingType)}>
            <SelectTrigger>
              <SelectValue placeholder="اختر نوع الاجتماع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">يومي</SelectItem>
              <SelectItem value="weekly">أسبوعي</SelectItem>
              <SelectItem value="monthly">شهري</SelectItem>
              <SelectItem value="custom">مخصص</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>القسم</Label>
          <Select
            value={selectedDepartment}
            onValueChange={setSelectedDepartment}
          >
            <SelectTrigger>
              <SelectValue placeholder="اختر القسم (اختياري)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">بدون قسم (عام للمؤسسة)</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>تاريخ الاجتماع</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-right font-normal",
                  !startDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="ml-2 h-4 w-4" />
                {startDate ? format(startDate, 'PPP', { locale: ar }) : "اختر التاريخ"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={startDate}
                onSelect={(date) => date && setStartDate(date)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label htmlFor="startTime">وقت البدء</Label>
          <Input
            id="startTime"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="duration">مدة الاجتماع (بالدقائق)</Label>
          <Input
            id="duration"
            type="number"
            min="15"
            step="15"
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value))}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="isOnline">اجتماع عبر الإنترنت</Label>
            <Switch
              id="isOnline"
              checked={isOnline}
              onCheckedChange={setIsOnline}
            />
          </div>
          {isOnline ? (
            <Input
              placeholder="رابط الاجتماع"
              value={meetingLink}
              onChange={(e) => setMeetingLink(e.target.value)}
            />
          ) : (
            <Input
              placeholder="مكان الاجتماع"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="isRecurring">اجتماع متكرر</Label>
          <Switch
            id="isRecurring"
            checked={isRecurring}
            onCheckedChange={setIsRecurring}
          />
        </div>

        {isRecurring && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
            <div>
              <Label>التكرار</Label>
              <Select
                value={recurringFrequency}
                onValueChange={(value) => setRecurringFrequency(value as 'daily' | 'weekly' | 'monthly')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">يومي</SelectItem>
                  <SelectItem value="weekly">أسبوعي</SelectItem>
                  <SelectItem value="monthly">شهري</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>الفاصل</Label>
              <Input
                type="number"
                min="1"
                value={recurringInterval}
                onChange={(e) => setRecurringInterval(parseInt(e.target.value))}
              />
            </div>

            <div>
              <Label>عدد المرات</Label>
              <Input
                type="number"
                min="1"
                value={recurringCount}
                onChange={(e) => setRecurringCount(parseInt(e.target.value))}
              />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label className="flex items-center">
          <Users className="ml-2 h-4 w-4" />
          المشاركون ({selectedMembers.length})
        </Label>
        <div className="border rounded-md p-4 max-h-48 overflow-y-auto mobile-scroll scrollbar-thin">
          {members.length === 0 ? (
            <p className="text-center text-muted-foreground">لا يوجد أعضاء في المؤسسة</p>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div key={member.uid} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id={`member-${member.uid}`}
                    checked={selectedMembers.includes(member.uid)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedMembers([...selectedMembers, member.uid]);
                      } else {
                        setSelectedMembers(selectedMembers.filter(id => id !== member.uid));
                      }
                    }}
                    className="ml-2"
                  />
                  <label htmlFor={`member-${member.uid}`} className="flex-1">
                    {member.displayName || member.email}
                    {member.departmentId && departments.find(d => d.id === member.departmentId) && (
                      <span className="text-xs text-muted-foreground mr-2">
                        ({departments.find(d => d.id === member.departmentId)?.name})
                      </span>
                    )}
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end space-x-2 pt-4 border-t bg-background sticky bottom-0">
        <Button type="button" variant="outline" onClick={onSuccess} disabled={loading}>
          إلغاء
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? 'جاري الإنشاء...' : 'إنشاء الاجتماع'}
        </Button>
        </div>
      </form>
    </div>
  );
}
