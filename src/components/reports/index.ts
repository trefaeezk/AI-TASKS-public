// ===== مكونات التقارير المستخدمة =====
export { DailyPlanReport } from './DailyPlanReport';
export { WeeklyReport } from './WeeklyReport';

// ===== مكونات تقارير الموافقات =====
export { ApprovalStatsCard } from './ApprovalStatsCard';
export { ApprovalTimelineChart } from './ApprovalTimelineChart';
export { PendingTasksTable } from './PendingTasksTable';
export { DepartmentApprovalStats } from './DepartmentApprovalStats';
export { ApprovalReportExport } from './ApprovalReportExport';
export { ApprovalSummaryCard } from './ApprovalSummaryCard';

// ===== مكونات التقارير الرئيسية =====
export { PeriodReportCard } from '../PeriodReportCard';
export { WeeklyReportCard } from '../WeeklyReportCard';
export { MonthlyReportCard } from '../MonthlyReportCard';
export { YearlyReportCard } from '../YearlyReportCard';
export { ReportSelector } from '../ReportSelector';

// ===== مكونات الرسوم البيانية =====
export { WeeklyReportCharts } from '../charts/WeeklyReportCharts';
export { WeeklyTrendAnalysis } from '../charts/WeeklyTrendAnalysis';
export { DepartmentAnalysis } from '../charts/DepartmentAnalysis';

// ===== مكونات التصدير =====
export { AdvancedExport } from '../export/AdvancedExport';

// ===== الأنواع والواجهات =====
export type {
  ReportPeriodType,
  PeriodStats,
  WeeklyStats,
  DepartmentPerformance,
  WeeklyHighlight,
  WeeklyComparison,
  PeriodRange
} from '../../services/organizationReports';

// ===== أنواع تقارير الموافقات =====
export type {
  ApprovalStats,
  ApprovalTimelineData,
  DepartmentApprovalStats,
  PendingTaskDetails,
  UserApprovalActivity
} from '../../services/approvalReports';

// ===== الخدمات =====
export {
  getPeriodStats,
  getPeriodComparison,
  getWeeklyStats,
  getDepartmentPerformance,
  getEnhancedDepartmentPerformance,
  getWeeklyComparison,
  getWeeklyHighlights,
  getDailyTasks,
  getDailyGoals
} from '../../services/organizationReports';

// ===== خدمات تقارير الموافقات =====
export {
  getApprovalStats,
  getApprovalTimeline,
  getDepartmentApprovalStats,
  getPendingTasksDetails,
  getUserApprovalActivity
} from '../../services/approvalReports';
