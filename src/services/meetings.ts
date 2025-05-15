'use client';

import { db } from '@/config/firebase';
import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import {
  Meeting,
  MeetingFirestore,
  MeetingType,
  MeetingStatus,
  MeetingParticipant,
  AgendaItem,
  MeetingDecision,
  MeetingTask
} from '@/types/meeting';
import { v4 as uuidv4 } from 'uuid';
import { addDays, addWeeks, addMonths, setHours, setMinutes, getDay } from 'date-fns';

// إنشاء اجتماع جديد
export async function createMeeting(meetingData: Omit<Meeting, 'id'>): Promise<string> {
  try {
    // تحويل البيانات إلى صيغة Firestore
    const firestoreData: Omit<MeetingFirestore, 'id'> = {
      ...meetingData,
      startDate: Timestamp.fromDate(meetingData.startDate),
      endDate: meetingData.endDate ? Timestamp.fromDate(meetingData.endDate) : undefined,
      participants: meetingData.participants.map(p => ({
        ...p,
        joinedAt: p.joinedAt ? Timestamp.fromDate(p.joinedAt) : undefined,
        leftAt: p.leftAt ? Timestamp.fromDate(p.leftAt) : undefined,
      })),
      decisions: meetingData.decisions.map(d => ({
        ...d,
        dueDate: d.dueDate ? Timestamp.fromDate(d.dueDate) : undefined,
      })),
      tasks: meetingData.tasks.map(t => ({
        ...t,
        dueDate: t.dueDate ? Timestamp.fromDate(t.dueDate) : undefined,
      })),
      recurringPattern: meetingData.recurringPattern ? {
        ...meetingData.recurringPattern,
        endDate: meetingData.recurringPattern.endDate ? Timestamp.fromDate(meetingData.recurringPattern.endDate) : undefined,
      } : undefined,
      createdAt: serverTimestamp() as Timestamp,
      updatedAt: serverTimestamp() as Timestamp,
    };

    // إضافة الاجتماع إلى Firestore
    const docRef = await addDoc(collection(db, 'meetings'), firestoreData);

    // إذا كان الاجتماع متكرر، قم بإنشاء الاجتماعات المتكررة
    if (meetingData.isRecurring && meetingData.recurringPattern) {
      await createRecurringMeetings(docRef.id, meetingData);
    }

    return docRef.id;
  } catch (error) {
    console.error('Error creating meeting:', error);
    throw error;
  }
}

// إنشاء اجتماعات متكررة
async function createRecurringMeetings(parentMeetingId: string, meetingData: Omit<Meeting, 'id'>): Promise<void> {
  try {
    if (!meetingData.recurringPattern) return;

    const { frequency, interval, daysOfWeek, endDate, count } = meetingData.recurringPattern;
    const startDate = meetingData.startDate;
    const endDateTime = meetingData.endDate;
    const duration = endDateTime ? endDateTime.getTime() - startDate.getTime() : 60 * 60 * 1000; // ساعة افتراضية

    let occurrences: Date[] = [];
    let currentDate = new Date(startDate);
    let occurrenceCount = 0;
    const maxOccurrences = count || 10; // حد أقصى للتكرارات

    // حساب تواريخ الاجتماعات المتكررة
    while (occurrenceCount < maxOccurrences && (!endDate || currentDate <= endDate)) {
      if (occurrenceCount > 0) { // تخطي الاجتماع الأول لأنه تم إنشاؤه بالفعل
        // إضافة التاريخ حسب نمط التكرار
        if (frequency === 'daily') {
          currentDate = addDays(currentDate, interval);
        } else if (frequency === 'weekly') {
          if (daysOfWeek && daysOfWeek.length > 0) {
            // إذا كان هناك أيام محددة في الأسبوع
            let found = false;
            for (let i = 1; i <= 7; i++) {
              const nextDay = addDays(currentDate, i);
              const dayOfWeek = getDay(nextDay);
              if (daysOfWeek.includes(dayOfWeek)) {
                currentDate = nextDay;
                found = true;
                break;
              }
            }
            if (!found) {
              currentDate = addWeeks(currentDate, interval);
            }
          } else {
            currentDate = addWeeks(currentDate, interval);
          }
        } else if (frequency === 'monthly') {
          currentDate = addMonths(currentDate, interval);
        }

        // التحقق من تاريخ الانتهاء
        if (endDate && currentDate > endDate) break;

        occurrences.push(new Date(currentDate));
      }

      occurrenceCount++;
    }

    // إنشاء الاجتماعات المتكررة
    const batch = writeBatch(db);

    for (const occurrence of occurrences) {
      const endDateTime = meetingData.endDate
        ? new Date(occurrence.getTime() + duration)
        : undefined;

      const recurringMeetingData: Omit<MeetingFirestore, 'id'> = {
        ...meetingData,
        title: meetingData.title,
        startDate: Timestamp.fromDate(occurrence),
        endDate: endDateTime ? Timestamp.fromDate(endDateTime) : undefined,
        participants: meetingData.participants.map(p => ({
          ...p,
          joinedAt: undefined,
          leftAt: undefined,
          attendanceStatus: undefined,
        })),
        decisions: [],
        tasks: [],
        notes: '',
        summary: '',
        status: 'scheduled',
        isRecurring: false, // الاجتماعات المتكررة الفردية ليست متكررة بنفسها
        recurringPattern: undefined,
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
      };

      const docRef = doc(collection(db, 'meetings'));
      batch.set(docRef, recurringMeetingData);
    }

    await batch.commit();
  } catch (error) {
    console.error('Error creating recurring meetings:', error);
    throw error;
  }
}

// الحصول على اجتماع بواسطة المعرف
export async function getMeetingById(meetingId: string): Promise<Meeting | null> {
  try {
    const docRef = doc(db, 'meetings', meetingId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data() as MeetingFirestore;

    // تحويل البيانات من صيغة Firestore إلى صيغة التطبيق
    return {
      id: docSnap.id,
      title: data.title,
      description: data.description,
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
      participants: data.participants.map(p => ({
        ...p,
        joinedAt: p.joinedAt ? p.joinedAt.toDate() : undefined,
        leftAt: p.leftAt ? p.leftAt.toDate() : undefined,
      })),
      agenda: data.agenda,
      decisions: data.decisions.map(d => ({
        ...d,
        dueDate: d.dueDate ? d.dueDate.toDate() : undefined,
      })),
      tasks: data.tasks.map(t => ({
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
    };
  } catch (error) {
    console.error('Error getting meeting:', error);
    throw error;
  }
}

// الحصول على اجتماعات القسم
export async function getDepartmentMeetings(
  departmentId: string,
  filters?: {
    status?: MeetingStatus;
    type?: MeetingType;
    startDate?: Date;
    endDate?: Date;
  }
): Promise<Meeting[]> {
  try {
    let q = query(
      collection(db, 'meetings'),
      where('departmentId', '==', departmentId),
      orderBy('startDate', 'desc')
    );

    // إضافة الفلاتر إذا تم توفيرها
    if (filters) {
      if (filters.status) {
        q = query(q, where('status', '==', filters.status));
      }
      if (filters.type) {
        q = query(q, where('type', '==', filters.type));
      }
      if (filters.startDate) {
        q = query(q, where('startDate', '>=', Timestamp.fromDate(filters.startDate)));
      }
      if (filters.endDate) {
        q = query(q, where('startDate', '<=', Timestamp.fromDate(filters.endDate)));
      }
    }

    const querySnapshot = await getDocs(q);
    const meetings: Meeting[] = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data() as MeetingFirestore;

      meetings.push({
        id: doc.id,
        title: data.title,
        description: data.description,
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
        participants: data.participants.map(p => ({
          ...p,
          joinedAt: p.joinedAt ? p.joinedAt.toDate() : undefined,
          leftAt: p.leftAt ? p.leftAt.toDate() : undefined,
        })),
        agenda: data.agenda,
        decisions: data.decisions.map(d => ({
          ...d,
          dueDate: d.dueDate ? d.dueDate.toDate() : undefined,
        })),
        tasks: data.tasks.map(t => ({
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

    return meetings;
  } catch (error) {
    console.error('Error getting department meetings:', error);
    throw error;
  }
}

// تحديث اجتماع
export async function updateMeeting(meetingId: string, meetingData: Partial<Meeting>): Promise<void> {
  try {
    const docRef = doc(db, 'meetings', meetingId);

    // تحويل البيانات إلى صيغة Firestore
    const updateData: Partial<MeetingFirestore> = {
      ...meetingData,
      startDate: meetingData.startDate ? Timestamp.fromDate(meetingData.startDate) : undefined,
      endDate: meetingData.endDate ? Timestamp.fromDate(meetingData.endDate) : undefined,
      participants: meetingData.participants ? meetingData.participants.map(p => ({
        ...p,
        joinedAt: p.joinedAt ? Timestamp.fromDate(p.joinedAt) : undefined,
        leftAt: p.leftAt ? Timestamp.fromDate(p.leftAt) : undefined,
      })) : undefined,
      decisions: meetingData.decisions ? meetingData.decisions.map(d => ({
        ...d,
        dueDate: d.dueDate ? Timestamp.fromDate(d.dueDate) : undefined,
      })) : undefined,
      tasks: meetingData.tasks ? meetingData.tasks.map(t => ({
        ...t,
        dueDate: t.dueDate ? Timestamp.fromDate(t.dueDate) : undefined,
      })) : undefined,
      recurringPattern: meetingData.recurringPattern ? {
        ...meetingData.recurringPattern,
        endDate: meetingData.recurringPattern.endDate ? Timestamp.fromDate(meetingData.recurringPattern.endDate) : undefined,
      } : undefined,
      updatedAt: serverTimestamp() as Timestamp,
    };

    await updateDoc(docRef, updateData);
  } catch (error) {
    console.error('Error updating meeting:', error);
    throw error;
  }
}

// حذف اجتماع
export async function deleteMeeting(meetingId: string): Promise<void> {
  try {
    const docRef = doc(db, 'meetings', meetingId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error('Error deleting meeting:', error);
    throw error;
  }
}

// تحديث حالة حضور المشارك
export async function updateParticipantAttendance(
  meetingId: string,
  userId: string,
  attendanceStatus: 'present' | 'absent' | 'late' | 'excused',
  joinedAt?: Date,
  leftAt?: Date
): Promise<void> {
  try {
    const docRef = doc(db, 'meetings', meetingId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Meeting not found');
    }

    const data = docSnap.data() as MeetingFirestore;
    const participants = [...data.participants];

    const participantIndex = participants.findIndex(p => p.userId === userId);

    if (participantIndex === -1) {
      throw new Error('Participant not found');
    }

    participants[participantIndex] = {
      ...participants[participantIndex],
      attendanceStatus,
      joinedAt: joinedAt ? Timestamp.fromDate(joinedAt) : undefined,
      leftAt: leftAt ? Timestamp.fromDate(leftAt) : undefined,
    };

    await updateDoc(docRef, {
      participants,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating participant attendance:', error);
    throw error;
  }
}

// إضافة بند جديد لجدول أعمال الاجتماع
export async function addAgendaItem(
  meetingId: string,
  agendaItem: AgendaItem
): Promise<string> {
  try {
    const docRef = doc(db, 'meetings', meetingId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Meeting not found');
    }

    const data = docSnap.data() as MeetingFirestore;
    const agenda = [...data.agenda];

    agenda.push(agendaItem);

    await updateDoc(docRef, {
      agenda,
      updatedAt: serverTimestamp(),
    });

    return agendaItem.id;
  } catch (error) {
    console.error('Error adding agenda item:', error);
    throw error;
  }
}

// تحديث بند في جدول أعمال الاجتماع
export async function updateAgendaItem(
  meetingId: string,
  agendaItemId: string,
  updates: Partial<AgendaItem>
): Promise<void> {
  try {
    const docRef = doc(db, 'meetings', meetingId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Meeting not found');
    }

    const data = docSnap.data() as MeetingFirestore;
    const agenda = [...data.agenda];

    const itemIndex = agenda.findIndex(item => item.id === agendaItemId);

    if (itemIndex === -1) {
      throw new Error('Agenda item not found');
    }

    agenda[itemIndex] = {
      ...agenda[itemIndex],
      ...updates,
    };

    await updateDoc(docRef, {
      agenda,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating agenda item:', error);
    throw error;
  }
}

// إضافة قرار جديد للاجتماع
export async function addMeetingDecision(
  meetingId: string,
  decision: Omit<MeetingDecision, 'id'>
): Promise<string> {
  try {
    const docRef = doc(db, 'meetings', meetingId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Meeting not found');
    }

    const data = docSnap.data() as MeetingFirestore;
    const decisions = [...data.decisions];

    const newDecision = {
      ...decision,
      id: uuidv4(),
      dueDate: decision.dueDate ? Timestamp.fromDate(decision.dueDate) : undefined,
    };

    decisions.push(newDecision);

    await updateDoc(docRef, {
      decisions,
      updatedAt: serverTimestamp(),
    });

    return newDecision.id;
  } catch (error) {
    console.error('Error adding meeting decision:', error);
    throw error;
  }
}

// إضافة مهمة جديدة للاجتماع
export async function addMeetingTask(
  meetingId: string,
  task: Omit<MeetingTask, 'id'>
): Promise<string> {
  try {
    const docRef = doc(db, 'meetings', meetingId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      throw new Error('Meeting not found');
    }

    const data = docSnap.data() as MeetingFirestore;
    const tasks = [...data.tasks];

    const newTask = {
      ...task,
      id: uuidv4(),
      dueDate: task.dueDate ? Timestamp.fromDate(task.dueDate) : undefined,
    };

    tasks.push(newTask);

    await updateDoc(docRef, {
      tasks,
      updatedAt: serverTimestamp(),
    });

    return newTask.id;
  } catch (error) {
    console.error('Error adding meeting task:', error);
    throw error;
  }
}
