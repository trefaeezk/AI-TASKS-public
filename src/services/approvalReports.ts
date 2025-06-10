/**
 * خدمة تقارير المهام المعلقة والموافقات
 */

import { db } from '@/config/firebase';
import { collection, query, where, getDocs, orderBy, Timestamp, limit } from 'firebase/firestore';
import { Task } from '@/types/task';

// أنواع البيانات للتقارير
export interface ApprovalStats {
  totalPendingTasks: number;
  departmentPendingTasks: number;
  organizationPendingTasks: number;
  totalApprovedTasks: number;
  totalRejectedTasks: number;
  averageApprovalTime: number; // بالساعات
  approvalRate: number; // نسبة الموافقة
  rejectionRate: number; // نسبة الرفض
  pendingByDepartment: { [departmentId: string]: number };
  approvalsByUser: { [userId: string]: { approved: number; rejected: number; name: string } };
}

export interface ApprovalTimelineData {
  date: string;
  pending: number;
  approved: number;
  rejected: number;
}

export interface DepartmentApprovalStats {
  departmentId: string;
  departmentName: string;
  pendingTasks: number;
  approvedTasks: number;
  rejectedTasks: number;
  averageApprovalTime: number;
  approvalRate: number;
}

export interface UserApprovalActivity {
  userId: string;
  userName: string;
  role: string;
  totalApprovals: number;
  totalRejections: number;
  averageResponseTime: number; // بالساعات
  lastActivity: Date;
}

export interface PendingTaskDetails {
  id: string;
  title: string;
  description: string;
  submittedBy: string;
  submittedByName: string;
  submittedAt: Date;
  approvalLevel: 'department' | 'organization';
  departmentId?: string;
  departmentName?: string;
  priority: string;
  dueDate?: Date;
  waitingTime: number; // بالساعات
}

/**
 * جلب إحصائيات الموافقات العامة
 */
export async function getApprovalStats(organizationId: string, departmentId?: string): Promise<ApprovalStats> {
  try {
    // إنشاء الاستعلامات
    let baseQuery = query(collection(db, 'tasks'), where('organizationId', '==', organizationId));
    
    if (departmentId) {
      baseQuery = query(baseQuery, where('departmentId', '==', departmentId));
    }

    // جلب المهام المعلقة
    const pendingQuery = query(baseQuery, where('status', '==', 'pending-approval'));
    const pendingSnapshot = await getDocs(pendingQuery);
    
    // جلب المهام المعتمدة
    const approvedQuery = query(baseQuery, where('approvedBy', '!=', null));
    const approvedSnapshot = await getDocs(approvedQuery);
    
    // جلب المهام المرفوضة
    const rejectedQuery = query(baseQuery, where('rejectedBy', '!=', null));
    const rejectedSnapshot = await getDocs(rejectedQuery);

    // حساب الإحصائيات
    const totalPendingTasks = pendingSnapshot.size;
    const totalApprovedTasks = approvedSnapshot.size;
    const totalRejectedTasks = rejectedSnapshot.size;
    
    let departmentPendingTasks = 0;
    let organizationPendingTasks = 0;
    const pendingByDepartment: { [departmentId: string]: number } = {};
    
    pendingSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.approvalLevel === 'department') {
        departmentPendingTasks++;
        if (data.departmentId) {
          pendingByDepartment[data.departmentId] = (pendingByDepartment[data.departmentId] || 0) + 1;
        }
      } else {
        organizationPendingTasks++;
      }
    });

    // حساب متوسط وقت الموافقة
    let totalApprovalTime = 0;
    let approvalTimeCount = 0;
    const approvalsByUser: { [userId: string]: { approved: number; rejected: number; name: string } } = {};

    approvedSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.submittedAt && data.approvedAt) {
        const submittedTime = data.submittedAt.toDate();
        const approvedTime = data.approvedAt.toDate();
        const timeDiff = (approvedTime.getTime() - submittedTime.getTime()) / (1000 * 60 * 60); // ساعات
        totalApprovalTime += timeDiff;
        approvalTimeCount++;
      }
      
      if (data.approvedBy) {
        if (!approvalsByUser[data.approvedBy]) {
          approvalsByUser[data.approvedBy] = { approved: 0, rejected: 0, name: 'مستخدم غير معروف' };
        }
        approvalsByUser[data.approvedBy].approved++;
      }
    });

    rejectedSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.rejectedBy) {
        if (!approvalsByUser[data.rejectedBy]) {
          approvalsByUser[data.rejectedBy] = { approved: 0, rejected: 0, name: 'مستخدم غير معروف' };
        }
        approvalsByUser[data.rejectedBy].rejected++;
      }
    });

    const averageApprovalTime = approvalTimeCount > 0 ? totalApprovalTime / approvalTimeCount : 0;
    const totalProcessed = totalApprovedTasks + totalRejectedTasks;
    const approvalRate = totalProcessed > 0 ? (totalApprovedTasks / totalProcessed) * 100 : 0;
    const rejectionRate = totalProcessed > 0 ? (totalRejectedTasks / totalProcessed) * 100 : 0;

    return {
      totalPendingTasks,
      departmentPendingTasks,
      organizationPendingTasks,
      totalApprovedTasks,
      totalRejectedTasks,
      averageApprovalTime,
      approvalRate,
      rejectionRate,
      pendingByDepartment,
      approvalsByUser
    };
  } catch (error) {
    console.error('Error fetching approval stats:', error);
    throw error;
  }
}

/**
 * جلب بيانات الخط الزمني للموافقات
 */
export async function getApprovalTimeline(organizationId: string, days: number = 30): Promise<ApprovalTimelineData[]> {
  try {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    const baseQuery = query(
      collection(db, 'tasks'),
      where('organizationId', '==', organizationId),
      where('submittedAt', '>=', Timestamp.fromDate(startDate)),
      where('submittedAt', '<=', Timestamp.fromDate(endDate))
    );

    const snapshot = await getDocs(baseQuery);
    const dailyData: { [date: string]: { pending: number; approved: number; rejected: number } } = {};

    // تهيئة البيانات لكل يوم
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      dailyData[dateStr] = { pending: 0, approved: 0, rejected: 0 };
    }

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const submittedDate = data.submittedAt.toDate().toISOString().split('T')[0];
      
      if (dailyData[submittedDate]) {
        if (data.status === 'pending-approval') {
          dailyData[submittedDate].pending++;
        } else if (data.approvedBy) {
          dailyData[submittedDate].approved++;
        } else if (data.rejectedBy) {
          dailyData[submittedDate].rejected++;
        }
      }
    });

    return Object.entries(dailyData).map(([date, data]) => ({
      date,
      ...data
    }));
  } catch (error) {
    console.error('Error fetching approval timeline:', error);
    throw error;
  }
}

/**
 * جلب إحصائيات الموافقات حسب القسم
 */
export async function getDepartmentApprovalStats(organizationId: string): Promise<DepartmentApprovalStats[]> {
  try {
    // جلب جميع الأقسام
    const departmentsQuery = query(
      collection(db, 'organizations', organizationId, 'departments')
    );
    const departmentsSnapshot = await getDocs(departmentsQuery);
    
    const stats: DepartmentApprovalStats[] = [];

    for (const deptDoc of departmentsSnapshot.docs) {
      const deptData = deptDoc.data();
      const departmentId = deptDoc.id;
      
      // جلب مهام القسم
      const tasksQuery = query(
        collection(db, 'tasks'),
        where('organizationId', '==', organizationId),
        where('departmentId', '==', departmentId),
        where('requiresApproval', '==', true)
      );
      
      const tasksSnapshot = await getDocs(tasksQuery);
      
      let pendingTasks = 0;
      let approvedTasks = 0;
      let rejectedTasks = 0;
      let totalApprovalTime = 0;
      let approvalTimeCount = 0;

      tasksSnapshot.docs.forEach(doc => {
        const taskData = doc.data();
        
        if (taskData.status === 'pending-approval') {
          pendingTasks++;
        } else if (taskData.approvedBy) {
          approvedTasks++;
          if (taskData.submittedAt && taskData.approvedAt) {
            const timeDiff = (taskData.approvedAt.toDate().getTime() - taskData.submittedAt.toDate().getTime()) / (1000 * 60 * 60);
            totalApprovalTime += timeDiff;
            approvalTimeCount++;
          }
        } else if (taskData.rejectedBy) {
          rejectedTasks++;
        }
      });

      const averageApprovalTime = approvalTimeCount > 0 ? totalApprovalTime / approvalTimeCount : 0;
      const totalProcessed = approvedTasks + rejectedTasks;
      const approvalRate = totalProcessed > 0 ? (approvedTasks / totalProcessed) * 100 : 0;

      stats.push({
        departmentId,
        departmentName: deptData.name || 'قسم غير معروف',
        pendingTasks,
        approvedTasks,
        rejectedTasks,
        averageApprovalTime,
        approvalRate
      });
    }

    return stats.sort((a, b) => b.pendingTasks - a.pendingTasks);
  } catch (error) {
    console.error('Error fetching department approval stats:', error);
    throw error;
  }
}

/**
 * جلب تفاصيل المهام المعلقة
 */
export async function getPendingTasksDetails(organizationId: string, departmentId?: string): Promise<PendingTaskDetails[]> {
  try {
    let tasksQuery = query(
      collection(db, 'tasks'),
      where('organizationId', '==', organizationId),
      where('status', '==', 'pending-approval'),
      orderBy('submittedAt', 'desc'),
      limit(50)
    );

    if (departmentId) {
      tasksQuery = query(tasksQuery, where('departmentId', '==', departmentId));
    }

    const snapshot = await getDocs(tasksQuery);
    const now = new Date();

    return snapshot.docs.map(doc => {
      const data = doc.data();
      const submittedAt = data.submittedAt?.toDate() || new Date();
      const waitingTime = (now.getTime() - submittedAt.getTime()) / (1000 * 60 * 60); // ساعات

      return {
        id: doc.id,
        title: data.description || 'مهمة بدون عنوان',
        description: data.details || '',
        submittedBy: data.submittedBy || '',
        submittedByName: data.submittedByName || 'مستخدم غير معروف',
        submittedAt,
        approvalLevel: data.approvalLevel || 'department',
        departmentId: data.departmentId,
        departmentName: data.departmentName,
        priority: data.priority || 'medium',
        dueDate: data.dueDate?.toDate(),
        waitingTime
      };
    });
  } catch (error) {
    console.error('Error fetching pending tasks details:', error);
    throw error;
  }
}

/**
 * جلب نشاط المستخدمين في الموافقات
 */
export async function getUserApprovalActivity(organizationId: string): Promise<UserApprovalActivity[]> {
  try {
    // جلب المهام المعتمدة والمرفوضة
    const approvedQuery = query(
      collection(db, 'tasks'),
      where('organizationId', '==', organizationId),
      where('approvedBy', '!=', null)
    );
    
    const rejectedQuery = query(
      collection(db, 'tasks'),
      where('organizationId', '==', organizationId),
      where('rejectedBy', '!=', null)
    );

    const [approvedSnapshot, rejectedSnapshot] = await Promise.all([
      getDocs(approvedQuery),
      getDocs(rejectedQuery)
    ]);

    const userActivity: { [userId: string]: UserApprovalActivity } = {};

    // معالجة المهام المعتمدة
    approvedSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const userId = data.approvedBy;
      
      if (!userActivity[userId]) {
        userActivity[userId] = {
          userId,
          userName: 'مستخدم غير معروف',
          role: 'غير محدد',
          totalApprovals: 0,
          totalRejections: 0,
          averageResponseTime: 0,
          lastActivity: new Date(0)
        };
      }
      
      userActivity[userId].totalApprovals++;
      
      if (data.approvedAt) {
        const activityDate = data.approvedAt.toDate();
        if (activityDate > userActivity[userId].lastActivity) {
          userActivity[userId].lastActivity = activityDate;
        }
      }
    });

    // معالجة المهام المرفوضة
    rejectedSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const userId = data.rejectedBy;
      
      if (!userActivity[userId]) {
        userActivity[userId] = {
          userId,
          userName: 'مستخدم غير معروف',
          role: 'غير محدد',
          totalApprovals: 0,
          totalRejections: 0,
          averageResponseTime: 0,
          lastActivity: new Date(0)
        };
      }
      
      userActivity[userId].totalRejections++;
      
      if (data.rejectedAt) {
        const activityDate = data.rejectedAt.toDate();
        if (activityDate > userActivity[userId].lastActivity) {
          userActivity[userId].lastActivity = activityDate;
        }
      }
    });

    return Object.values(userActivity).sort((a, b) => 
      (b.totalApprovals + b.totalRejections) - (a.totalApprovals + a.totalRejections)
    );
  } catch (error) {
    console.error('Error fetching user approval activity:', error);
    throw error;
  }
}
