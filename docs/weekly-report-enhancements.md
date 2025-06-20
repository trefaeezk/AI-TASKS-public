# نظام التقارير المتقدم للمؤسسات

## نظرة عامة

تم تطوير نظام تقارير شامل يدعم **التقارير الأسبوعية والشهرية والسنوية** مع ميزات متقدمة تشمل الرسوم البيانية التفاعلية، تحليل الاتجاهات، تحليل الأقسام، وخيارات التصدير المتقدمة.

## الميزات الجديدة

### 🆕 دعم الفترات المتعددة
- **التقارير الأسبوعية**: تحليل مفصل للأداء الأسبوعي
- **التقارير الشهرية**: نظرة شاملة على الاتجاهات الشهرية
- **التقارير السنوية**: تحليل استراتيجي للأداء السنوي
- **مكون موحد**: `PeriodReportCard` يدعم جميع الفترات
- **اختيار تفاعلي**: `ReportSelector` لاختيار نوع التقرير

### 1. الرسوم البيانية التفاعلية (`WeeklyReportCharts`)
- **الرسم البياني الدائري**: توزيع المهام حسب الحالة
- **الرسم البياني الشريطي**: مؤشرات الأداء الرئيسية
- **تحليل الأولويات**: توزيع المهام حسب مستوى الأولوية
- **تفاعلية كاملة**: إمكانية التكبير والتصغير والتنقل

### 2. تحليل الاتجاهات (`WeeklyTrendAnalysis`)
- **مقارنة زمنية**: مقارنة الأداء عبر 3 أسابيع
- **مؤشرات الاتجاه**: عرض التحسن أو التراجع بصرياً
- **رسوم بيانية خطية**: تتبع التطور عبر الزمن
- **تحليل التغييرات**: تفسير ذكي للتغييرات

### 3. تحليل الأقسام (`DepartmentAnalysis`)
- **مقارنة الأقسام**: مقارنة شاملة لجميع الأقسام
- **رسم بياني رادار**: تحليل متعدد الأبعاد للقسم الأفضل
- **ترتيب الأداء**: تصنيف الأقسام حسب الأداء
- **إحصائيات مفصلة**: حجم الفريق، متوسط المدة، الكفاءة

### 4. التصدير المتقدم (`AdvancedExport`)
- **تصدير PDF**: تقرير مفصل مع الرسوم البيانية
- **تصدير Excel**: جداول بيانات تفاعلية
- **تصدير صورة**: صورة عالية الجودة للتقرير
- **خيارات مخصصة**: اختيار المحتوى المطلوب تضمينه

## التبويبات الجديدة

### الرسوم البيانية
- عرض تفاعلي للبيانات
- رسوم بيانية ملونة ومنسقة
- دعم للغة العربية

### الاتجاهات
- مقارنة الأسابيع
- مؤشرات التحسن/التراجع
- تحليل ذكي للتغييرات

### الأقسام
- تحليل أداء الأقسام
- مقارنات تفصيلية
- توصيات للتحسين

### التصدير
- خيارات متعددة للتصدير
- تخصيص المحتوى
- جودة عالية

## المكتبات المستخدمة

```json
{
  "chart.js": "^4.4.0",
  "react-chartjs-2": "^5.2.0",
  "exceljs": "^4.4.0",
  "html2canvas": "^1.4.1",
  "jspdf": "^2.5.1"
}
```

## الاستخدام

```tsx
import { WeeklyReportCard } from '@/components/WeeklyReportCard';

// للمؤسسة
<WeeklyReportCard 
  organizationId="org-id"
  reportPeriod={{
    startDate: new Date(),
    endDate: new Date()
  }}
/>

// للقسم
<WeeklyReportCard 
  organizationId="org-id"
  departmentId="dept-id"
  reportPeriod={{
    startDate: new Date(),
    endDate: new Date()
  }}
/>
```

## الملفات المضافة

```
src/
├── components/
│   ├── charts/
│   │   ├── WeeklyReportCharts.tsx
│   │   ├── WeeklyTrendAnalysis.tsx
│   │   ├── DepartmentAnalysis.tsx
│   │   └── index.ts
│   └── export/
│       ├── AdvancedExport.tsx
│       └── index.ts
└── services/
    └── organizationReports.ts (محدث)
```

## التحسينات في الخدمات

### `organizationReports.ts`
- إضافة `getWeeklyComparison()` للمقارنات الزمنية
- إضافة `getEnhancedDepartmentPerformance()` لتحليل الأقسام المتقدم
- تحسين حساب المؤشرات والإحصائيات

## الميزات المستقبلية

1. **تقارير مخصصة**: إنشاء تقارير حسب الطلب
2. **تنبؤات ذكية**: استخدام الذكاء الاصطناعي للتنبؤ
3. **تكامل أعمق**: ربط مع أنظمة خارجية
4. **تحليلات متقدمة**: مؤشرات أداء أكثر تفصيلاً

## الدعم والصيانة

- جميع المكونات مكتوبة بـ TypeScript
- دعم كامل للغة العربية
- تصميم متجاوب لجميع الأجهزة
- اختبارات شاملة للجودة
