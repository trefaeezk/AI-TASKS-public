import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
  doc as firestoreDoc,
  getDoc
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  subWeeks,
  subMonths,
  subYears
} from 'date-fns';

// أنواع البيانات للتقارير
export type ReportPeriodType = 'weekly' | 'monthly' | 'yearly';

export interface PeriodRange {
  start: Date;
  end: Date;
  type: ReportPeriodType;
}

export interface DailyTaskReport {
  id: string;
  title: string;
  description?: string;
  priority: 'high' | 'medium' | 'low';
  status: 'completed' | 'in-progress' | 'pending';
  assignedTo?: string;
  assigneeName?: string;
  estimatedTime: number; // بالدقائق
  actualTime?: number;
  category: string;
  dueDate?: Date;
  completedDate?: Date;
}

export interface DailyGoalReport {
  id: string;
  title: string;
  description: string;
  progress: number; // نسبة مئوية
  target: number;
  achieved: number;
  unit: string;
}

export interface PeriodStats {
  tasksCompleted: number;
  tasksTotal: number;
  hoursWorked: number;
  hoursPlanned: number;
  meetingsHeld: number;
  meetingsPlanned: number;
  goalsAchieved: number;
  goalsTotal: number;
  periodType: ReportPeriodType;
  startDate: Date;
  endDate: Date;
}

// للتوافق مع الكود الموجود
export interface WeeklyStats extends PeriodStats {
  periodType: 'weekly';
}

export interface DepartmentPerformance {
  id: string;
  name: string;
  completionRate: number;
  tasksCompleted: number;
  tasksTotal: number;
  efficiency: number;
  trend: 'up' | 'down' | 'stable';
}

export interface WeeklyHighlight {
  id: string;
  type: 'achievement' | 'challenge' | 'milestone';
  title: string;
  description: string;
  date: Date;
  department?: string;
}

export interface WeeklyComparison {
  currentWeek: {
    completionRate: number;
    onTimeRate: number;
    efficiency: number;
    tasksCompleted: number;
    totalTasks: number;
    hoursWorked: number;
    hoursPlanned: number;
  };
  previousWeek: {
    completionRate: number;
    onTimeRate: number;
    efficiency: number;
    tasksCompleted: number;
    totalTasks: number;
    hoursWorked: number;
    hoursPlanned: number;
  };
  weekBeforePrevious?: {
    completionRate: number;
    onTimeRate: number;
    efficiency: number;
    tasksCompleted: number;
    totalTasks: number;
    hoursWorked: number;
    hoursPlanned: number;
  };
}

/**
 * جلب المهام اليومية للمؤسسة
 */
export async function getDailyTasks(
  organizationId: string, 
  selectedDate: Date
): Promise<DailyTaskReport[]> {
  try {
    const dayStart = startOfDay(selectedDate);
    const dayEnd = endOfDay(selectedDate);

    // جلب المهام المجدولة لهذا اليوم أو المستحقة
    const tasksQuery = query(
      collection(db, 'tasks'),
      where('organizationId', '==', organizationId),
      where('dueDate', '>=', Timestamp.fromDate(dayStart)),
      where('dueDate', '<=', Timestamp.fromDate(dayEnd))
    );

    const tasksSnapshot = await getDocs(tasksQuery);
    const tasks: DailyTaskReport[] = [];

    for (const doc of tasksSnapshot.docs) {
      const data = doc.data();
      
      // جلب اسم المستخدم المكلف بالمهمة
      let assigneeName = '';
      if (data.assignedToUserId) {
        try {
          const memberDocRef = firestoreDoc(db, 'organizations', organizationId, 'members', data.assignedToUserId);
          const memberDoc = await getDoc(memberDocRef);
          if (memberDoc.exists()) {
            const memberData = memberDoc.data() as { displayName?: string; name?: string };
            assigneeName = memberData.displayName || memberData.name || 'مستخدم غير معروف';
          }
        } catch (error) {
          console.error('Error fetching user name:', error);
        }
      }

      tasks.push({
        id: doc.id,
        title: data.description || data.title || '',
        description: data.details || '',
        priority: data.priority || 'medium',
        status: data.status || 'pending',
        assignedTo: data.assignedToUserId,
        assigneeName,
        estimatedTime: data.durationValue || 60, // افتراضي 60 دقيقة
        actualTime: data.actualTime,
        category: data.taskCategoryName || 'عام',
        dueDate: data.dueDate ? data.dueDate.toDate() : undefined,
        completedDate: data.completedDate ? data.completedDate.toDate() : undefined
      });
    }

    return tasks;
  } catch (error) {
    console.error('Error fetching daily tasks:', error);
    return [];
  }
}

/**
 * جلب الأهداف اليومية
 */
export async function getDailyGoals(
  organizationId: string, 
  selectedDate: Date
): Promise<DailyGoalReport[]> {
  try {
    // حالياً سنحسب الأهداف بناءً على المهام
    const tasks = await getDailyTasks(organizationId, selectedDate);
    
    const goals: DailyGoalReport[] = [
      {
        id: '1',
        title: 'إنجاز المهام المخططة',
        description: 'إكمال جميع المهام المجدولة لليوم',
        progress: tasks.length > 0 ? Math.round((tasks.filter(t => t.status === 'completed').length / tasks.length) * 100) : 0,
        target: tasks.length,
        achieved: tasks.filter(t => t.status === 'completed').length,
        unit: 'مهمة'
      },
      {
        id: '2',
        title: 'ساعات العمل المنتجة',
        description: 'تحقيق الحد الأدنى من ساعات العمل المنتجة',
        progress: tasks.length > 0 ? Math.round((tasks.filter(t => t.status === 'completed').reduce((sum, t) => sum + (t.actualTime || t.estimatedTime), 0) / tasks.reduce((sum, t) => sum + t.estimatedTime, 0)) * 100) : 0,
        target: Math.round(tasks.reduce((sum, t) => sum + t.estimatedTime, 0) / 60), // تحويل إلى ساعات
        achieved: Math.round(tasks.filter(t => t.status === 'completed').reduce((sum, t) => sum + (t.actualTime || t.estimatedTime), 0) / 60),
        unit: 'ساعة'
      }
    ];

    return goals;
  } catch (error) {
    console.error('Error fetching daily goals:', error);
    return [];
  }
}

/**
 * جلب الإحصائيات الأسبوعية
 */
export async function getWeeklyStats(
  organizationId: string, 
  selectedWeek: Date
): Promise<WeeklyStats> {
  try {
    const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 6 }); // السبت
    const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 6 });

    // جلب المهام للأسبوع
    const tasksQuery = query(
      collection(db, 'tasks'),
      where('organizationId', '==', organizationId),
      where('dueDate', '>=', Timestamp.fromDate(weekStart)),
      where('dueDate', '<=', Timestamp.fromDate(weekEnd))
    );

    const tasksSnapshot = await getDocs(tasksQuery);
    let tasksCompleted = 0;
    let hoursWorked = 0;
    let hoursPlanned = 0;

    tasksSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.status === 'completed') {
        tasksCompleted++;
        hoursWorked += (data.actualTime || data.durationValue || 0) / 60; // تحويل من دقائق إلى ساعات
      }
      hoursPlanned += (data.durationValue || 60) / 60; // تحويل من دقائق إلى ساعات
    });

    // جلب الاجتماعات للأسبوع
    const meetingsQuery = query(
      collection(db, 'meetings'),
      where('organizationId', '==', organizationId),
      where('date', '>=', Timestamp.fromDate(weekStart)),
      where('date', '<=', Timestamp.fromDate(weekEnd))
    );

    const meetingsSnapshot = await getDocs(meetingsQuery);
    const meetingsHeld = meetingsSnapshot.size;

    return {
      tasksCompleted,
      tasksTotal: tasksSnapshot.size,
      hoursWorked: Math.round(hoursWorked),
      hoursPlanned: Math.round(hoursPlanned),
      meetingsHeld,
      meetingsPlanned: meetingsHeld, // افتراضياً نفس العدد
      goalsAchieved: 0, // يمكن حسابها لاحقاً
      goalsTotal: 0
    };
  } catch (error) {
    console.error('Error fetching weekly stats:', error);
    return {
      tasksCompleted: 0,
      tasksTotal: 0,
      hoursWorked: 0,
      hoursPlanned: 0,
      meetingsHeld: 0,
      meetingsPlanned: 0,
      goalsAchieved: 0,
      goalsTotal: 0
    };
  }
}

/**
 * جلب أداء الأقسام للأسبوع
 */
export async function getDepartmentPerformance(
  organizationId: string,
  selectedWeek: Date
): Promise<DepartmentPerformance[]> {
  try {
    const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 6 }); // السبت
    const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 6 });

    // جلب الأقسام
    const departmentsQuery = query(
      collection(db, 'organizations', organizationId, 'departments')
    );
    const departmentsSnapshot = await getDocs(departmentsQuery);

    const departmentPerformance: DepartmentPerformance[] = [];

    for (const deptDoc of departmentsSnapshot.docs) {
      const deptData = deptDoc.data();
      const departmentId = deptDoc.id;

      // جلب المهام للقسم في هذا الأسبوع
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('organizationId', '==', organizationId),
        where('departmentId', '==', departmentId),
        where('dueDate', '>=', Timestamp.fromDate(weekStart)),
        where('dueDate', '<=', Timestamp.fromDate(weekEnd))
      );

      const tasksSnapshot = await getDocs(tasksQuery);
      let tasksCompleted = 0;
      let totalEfficiencyTime = 0;
      let totalPlannedTime = 0;

      tasksSnapshot.docs.forEach(doc => {
        const taskData = doc.data();
        if (taskData.status === 'completed') {
          tasksCompleted++;
          totalEfficiencyTime += taskData.actualTime || taskData.durationValue || 0;
        }
        totalPlannedTime += taskData.durationValue || 60;
      });

      const completionRate = tasksSnapshot.size > 0 ? Math.round((tasksCompleted / tasksSnapshot.size) * 100) : 0;
      const efficiency = totalPlannedTime > 0 ? Math.round((totalEfficiencyTime / totalPlannedTime) * 100) : 0;

      // حساب الاتجاه (يمكن تحسينه بمقارنة مع الأسبوع السابق)
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (completionRate >= 90) trend = 'up';
      else if (completionRate < 70) trend = 'down';

      departmentPerformance.push({
        id: departmentId,
        name: deptData.name || 'قسم بدون اسم',
        completionRate,
        tasksCompleted,
        tasksTotal: tasksSnapshot.size,
        efficiency,
        trend
      });
    }

    return departmentPerformance;
  } catch (error) {
    console.error('Error fetching department performance:', error);
    return [];
  }
}

/**
 * جلب أبرز أحداث الأسبوع
 */
export async function getWeeklyHighlights(
  organizationId: string,
  selectedWeek: Date
): Promise<WeeklyHighlight[]> {
  try {
    const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 6 }); // السبت
    const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 6 });

    const highlights: WeeklyHighlight[] = [];

    // جلب المهام المكتملة المهمة
    const completedTasksQuery = query(
      collection(db, 'tasks'),
      where('organizationId', '==', organizationId),
      where('status', '==', 'completed'),
      where('completedDate', '>=', Timestamp.fromDate(weekStart)),
      where('completedDate', '<=', Timestamp.fromDate(weekEnd)),
      where('priority', '==', 'high')
    );

    const completedTasksSnapshot = await getDocs(completedTasksQuery);

    for (const taskDoc of completedTasksSnapshot.docs) {
      const taskData = taskDoc.data();

      // جلب اسم القسم
      let departmentName = '';
      if (taskData.departmentId) {
        try {
          const deptDocRef = firestoreDoc(db, 'organizations', organizationId, 'departments', taskData.departmentId);
          const deptDoc = await getDoc(deptDocRef);
          if (deptDoc.exists()) {
            const deptData = deptDoc.data() as { name?: string };
            departmentName = deptData.name || '';
          }
        } catch (error) {
          console.error('Error fetching department name:', error);
        }
      }

      highlights.push({
        id: taskDoc.id,
        type: 'achievement',
        title: `إنجاز مهمة مهمة: ${taskData.description || taskData.title}`,
        description: taskData.details || 'تم إنجاز مهمة ذات أولوية عالية بنجاح',
        date: taskData.completedDate ? taskData.completedDate.toDate() : new Date(),
        department: departmentName
      });
    }

    // جلب المهام المتأخرة كتحديات
    const overdueTasksQuery = query(
      collection(db, 'tasks'),
      where('organizationId', '==', organizationId),
      where('status', 'in', ['pending', 'in-progress']),
      where('dueDate', '<', Timestamp.fromDate(weekStart))
    );

    const overdueTasksSnapshot = await getDocs(overdueTasksQuery);

    if (overdueTasksSnapshot.size > 0) {
      highlights.push({
        id: 'overdue-tasks',
        type: 'challenge',
        title: `${overdueTasksSnapshot.size} مهام متأخرة`,
        description: `يوجد ${overdueTasksSnapshot.size} مهام متأخرة تحتاج إلى متابعة`,
        date: new Date(),
        department: 'عام'
      });
    }

    // ترتيب الأحداث حسب التاريخ (الأحدث أولاً)
    highlights.sort((a, b) => b.date.getTime() - a.date.getTime());

    return highlights.slice(0, 5); // أحدث 5 أحداث
  } catch (error) {
    console.error('Error fetching weekly highlights:', error);
    return [];
  }
}

/**
 * جلب مقارنة الأسابيع للتحليل الزمني
 */
export async function getWeeklyComparison(
  organizationId: string,
  currentWeek: Date
): Promise<WeeklyComparison> {
  try {
    const currentWeekStart = startOfWeek(currentWeek, { weekStartsOn: 6 });
    const currentWeekEnd = endOfWeek(currentWeek, { weekStartsOn: 6 });

    const previousWeekStart = startOfWeek(new Date(currentWeek.getTime() - 7 * 24 * 60 * 60 * 1000), { weekStartsOn: 6 });
    const previousWeekEnd = endOfWeek(new Date(currentWeek.getTime() - 7 * 24 * 60 * 60 * 1000), { weekStartsOn: 6 });

    const weekBeforePreviousStart = startOfWeek(new Date(currentWeek.getTime() - 14 * 24 * 60 * 60 * 1000), { weekStartsOn: 6 });
    const weekBeforePreviousEnd = endOfWeek(new Date(currentWeek.getTime() - 14 * 24 * 60 * 60 * 1000), { weekStartsOn: 6 });

    // جلب بيانات الأسبوع الحالي
    const currentStats = await getWeeklyStats(organizationId, currentWeek);

    // جلب بيانات الأسبوع السابق
    const previousStats = await getWeeklyStats(organizationId, new Date(currentWeek.getTime() - 7 * 24 * 60 * 60 * 1000));

    // جلب بيانات الأسبوع قبل السابق
    const weekBeforePreviousStats = await getWeeklyStats(organizationId, new Date(currentWeek.getTime() - 14 * 24 * 60 * 60 * 1000));

    // حساب المعدلات
    const calculateRates = (stats: WeeklyStats) => ({
      completionRate: stats.tasksTotal > 0 ? (stats.tasksCompleted / stats.tasksTotal) * 100 : 0,
      onTimeRate: stats.tasksCompleted > 0 ? 85 : 0, // يمكن تحسينها بحساب فعلي
      efficiency: stats.hoursPlanned > 0 ? (stats.hoursWorked / stats.hoursPlanned) * 100 : 0,
      tasksCompleted: stats.tasksCompleted,
      totalTasks: stats.tasksTotal,
      hoursWorked: stats.hoursWorked,
      hoursPlanned: stats.hoursPlanned
    });

    return {
      currentWeek: calculateRates(currentStats),
      previousWeek: calculateRates(previousStats),
      weekBeforePrevious: calculateRates(weekBeforePreviousStats)
    };
  } catch (error) {
    console.error('Error fetching weekly comparison:', error);
    return {
      currentWeek: {
        completionRate: 0,
        onTimeRate: 0,
        efficiency: 0,
        tasksCompleted: 0,
        totalTasks: 0,
        hoursWorked: 0,
        hoursPlanned: 0
      },
      previousWeek: {
        completionRate: 0,
        onTimeRate: 0,
        efficiency: 0,
        tasksCompleted: 0,
        totalTasks: 0,
        hoursWorked: 0,
        hoursPlanned: 0
      }
    };
  }
}

/**
 * جلب أداء الأقسام المحسن مع بيانات إضافية
 */
export async function getEnhancedDepartmentPerformance(
  organizationId: string,
  selectedWeek: Date
): Promise<DepartmentPerformance[]> {
  try {
    const weekStart = startOfWeek(selectedWeek, { weekStartsOn: 6 });
    const weekEnd = endOfWeek(selectedWeek, { weekStartsOn: 6 });

    // جلب الأقسام
    const departmentsQuery = query(
      collection(db, 'organizations', organizationId, 'departments')
    );
    const departmentsSnapshot = await getDocs(departmentsQuery);

    const departmentPerformance: (DepartmentPerformance & {
      onTimeRate: number;
      averageTaskDuration: number;
      teamSize: number;
    })[] = [];

    for (const deptDoc of departmentsSnapshot.docs) {
      const deptData = deptDoc.data();
      const departmentId = deptDoc.id;

      // جلب المهام للقسم
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('organizationId', '==', organizationId),
        where('departmentId', '==', departmentId),
        where('dueDate', '>=', Timestamp.fromDate(weekStart)),
        where('dueDate', '<=', Timestamp.fromDate(weekEnd))
      );

      const tasksSnapshot = await getDocs(tasksQuery);

      // جلب أعضاء القسم
      const membersQuery = query(
        collection(db, 'organizations', organizationId, 'members'),
        where('departmentId', '==', departmentId)
      );
      const membersSnapshot = await getDocs(membersQuery);

      let tasksCompleted = 0;
      let onTimeCompleted = 0;
      let totalDuration = 0;
      let totalPlannedTime = 0;
      let totalEfficiencyTime = 0;

      tasksSnapshot.docs.forEach(doc => {
        const taskData = doc.data();
        const duration = taskData.durationValue || 60;
        totalDuration += duration;

        if (taskData.status === 'completed') {
          tasksCompleted++;
          totalEfficiencyTime += taskData.actualTime || duration;

          // حساب الالتزام بالموعد
          if (taskData.completedDate && taskData.dueDate) {
            const completedDate = taskData.completedDate.toDate();
            const dueDate = taskData.dueDate.toDate();
            if (completedDate <= dueDate) {
              onTimeCompleted++;
            }
          }
        }
        totalPlannedTime += duration;
      });

      const completionRate = tasksSnapshot.size > 0 ? (tasksCompleted / tasksSnapshot.size) * 100 : 0;
      const onTimeRate = tasksCompleted > 0 ? (onTimeCompleted / tasksCompleted) * 100 : 0;
      const efficiency = totalPlannedTime > 0 ? (totalEfficiencyTime / totalPlannedTime) * 100 : 0;
      const averageTaskDuration = tasksSnapshot.size > 0 ? (totalDuration / tasksSnapshot.size) / 60 : 0; // بالساعات

      // تحديد الاتجاه
      let trend: 'up' | 'down' | 'stable' = 'stable';
      if (completionRate >= 90) trend = 'up';
      else if (completionRate < 70) trend = 'down';

      departmentPerformance.push({
        id: departmentId,
        name: deptData.name || 'قسم بدون اسم',
        completionRate,
        tasksCompleted,
        tasksTotal: tasksSnapshot.size,
        efficiency,
        trend,
        onTimeRate,
        averageTaskDuration,
        teamSize: membersSnapshot.size
      });
    }

    return departmentPerformance;
  } catch (error) {
    console.error('Error fetching enhanced department performance:', error);
    return [];
  }
}

/**
 * دالة موحدة لجلب إحصائيات أي فترة زمنية
 */
export async function getPeriodStats(
  organizationId: string,
  selectedDate: Date,
  periodType: ReportPeriodType
): Promise<PeriodStats> {
  try {
    let periodStart: Date;
    let periodEnd: Date;

    // تحديد بداية ونهاية الفترة حسب النوع
    switch (periodType) {
      case 'weekly':
        periodStart = startOfWeek(selectedDate, { weekStartsOn: 6 }); // السبت
        periodEnd = endOfWeek(selectedDate, { weekStartsOn: 6 });
        break;
      case 'monthly':
        periodStart = startOfMonth(selectedDate);
        periodEnd = endOfMonth(selectedDate);
        break;
      case 'yearly':
        periodStart = startOfYear(selectedDate);
        periodEnd = endOfYear(selectedDate);
        break;
      default:
        throw new Error(`نوع فترة غير مدعوم: ${periodType}`);
    }

    // جلب المهام للفترة
    const tasksQuery = query(
      collection(db, 'tasks'),
      where('organizationId', '==', organizationId),
      where('dueDate', '>=', Timestamp.fromDate(periodStart)),
      where('dueDate', '<=', Timestamp.fromDate(periodEnd))
    );

    const tasksSnapshot = await getDocs(tasksQuery);
    let tasksCompleted = 0;
    let hoursWorked = 0;
    let hoursPlanned = 0;

    tasksSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.status === 'completed') {
        tasksCompleted++;
        hoursWorked += (data.actualTime || data.durationValue || 0) / 60;
      }
      hoursPlanned += (data.durationValue || 60) / 60;
    });

    // جلب الاجتماعات للفترة
    const meetingsQuery = query(
      collection(db, 'meetings'),
      where('organizationId', '==', organizationId),
      where('date', '>=', Timestamp.fromDate(periodStart)),
      where('date', '<=', Timestamp.fromDate(periodEnd))
    );

    const meetingsSnapshot = await getDocs(meetingsQuery);
    const meetingsHeld = meetingsSnapshot.size;

    return {
      tasksCompleted,
      tasksTotal: tasksSnapshot.size,
      hoursWorked: Math.round(hoursWorked),
      hoursPlanned: Math.round(hoursPlanned),
      meetingsHeld,
      meetingsPlanned: meetingsHeld,
      goalsAchieved: 0,
      goalsTotal: 0,
      periodType,
      startDate: periodStart,
      endDate: periodEnd
    };
  } catch (error) {
    console.error(`Error fetching ${periodType} stats:`, error);
    return {
      tasksCompleted: 0,
      tasksTotal: 0,
      hoursWorked: 0,
      hoursPlanned: 0,
      meetingsHeld: 0,
      meetingsPlanned: 0,
      goalsAchieved: 0,
      goalsTotal: 0,
      periodType,
      startDate: new Date(),
      endDate: new Date()
    };
  }
}

/**
 * جلب مقارنة الفترات للتحليل الزمني
 */
export async function getPeriodComparison(
  organizationId: string,
  currentDate: Date,
  periodType: ReportPeriodType
): Promise<{
  current: PeriodStats;
  previous: PeriodStats;
  beforePrevious?: PeriodStats;
}> {
  try {
    let previousDate: Date;
    let beforePreviousDate: Date;

    // تحديد التواريخ السابقة حسب نوع الفترة
    switch (periodType) {
      case 'weekly':
        previousDate = subWeeks(currentDate, 1);
        beforePreviousDate = subWeeks(currentDate, 2);
        break;
      case 'monthly':
        previousDate = subMonths(currentDate, 1);
        beforePreviousDate = subMonths(currentDate, 2);
        break;
      case 'yearly':
        previousDate = subYears(currentDate, 1);
        beforePreviousDate = subYears(currentDate, 2);
        break;
      default:
        throw new Error(`نوع فترة غير مدعوم: ${periodType}`);
    }

    // جلب إحصائيات الفترات
    const [current, previous, beforePrevious] = await Promise.all([
      getPeriodStats(organizationId, currentDate, periodType),
      getPeriodStats(organizationId, previousDate, periodType),
      getPeriodStats(organizationId, beforePreviousDate, periodType)
    ]);

    return {
      current,
      previous,
      beforePrevious
    };
  } catch (error) {
    console.error(`Error fetching ${periodType} comparison:`, error);
    const emptyStats: PeriodStats = {
      tasksCompleted: 0,
      tasksTotal: 0,
      hoursWorked: 0,
      hoursPlanned: 0,
      meetingsHeld: 0,
      meetingsPlanned: 0,
      goalsAchieved: 0,
      goalsTotal: 0,
      periodType,
      startDate: new Date(),
      endDate: new Date()
    };

    return {
      current: emptyStats,
      previous: emptyStats
    };
  }
}
