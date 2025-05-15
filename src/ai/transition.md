# ملاحظة هامة حول نقل وظائف الذكاء الاصطناعي

تم نقل جميع وظائف الذكاء الاصطناعي من الواجهة الأمامية (المتصفح) إلى الخادم الخلفي (Firebase Functions) لتحسين أداء التطبيق وتقليل حجم التحميل الأولي.

## التغييرات الرئيسية

1. تم نقل معالجة الذكاء الاصطناعي من المتصفح إلى الخادم الخلفي
2. تم إزالة تبعيات `genkit` و `@genkit-ai/googleai` و `@genkit-ai/next` و `genkit-cli` و `handlebars` من `package.json`
3. تم إنشاء خدمة جديدة في `src/services/ai.ts` للتعامل مع وظائف الذكاء الاصطناعي في الخادم الخلفي

## الخطوات التالية

1. يجب تحديث جميع المكونات التي تستخدم وظائف الذكاء الاصطناعي لاستخدام الخدمة الجديدة في `src/services/ai.ts` بدلاً من استيراد الوظائف من `src/ai/flows/...`
2. بعد تحديث جميع المكونات، يمكن إزالة مجلد `src/ai` بالكامل

## مثال على التحديث

قبل:
```typescript
import { suggestMilestones, type SuggestMilestonesInput, type SuggestMilestonesOutput } from '@/ai/flows/suggest-milestones';
```

بعد:
```typescript
import { suggestMilestones, type SuggestMilestonesInput, type SuggestMilestonesOutput } from '@/services/ai';
```
