// ===== مكونات التقارير المستخدمة =====
export { DailyPlanReport } from './DailyPlanReport';
export { WeeklyReport } from './WeeklyReport';

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
