# إعدادات نشر وظائف Firebase

تم تعديل إعدادات النشر لتتوافق مع حدود الاستخدام المسموح بها في Google Cloud Run. فيما يلي الإعدادات الجديدة:

## الإعدادات المعدلة

```json
{
  "functions": [
    {
      "source": ".",
      "codebase": "default",
      "ignore": [
        "node_modules",
        ".git",
        "firebase-debug.log",
        "firebase-debug.*.log"
      ],
      "runtime": "nodejs20",
      "region": "us-central1",
      "memory": "256MB",
      "minInstances": 0,
      "maxInstances": 10,
      "concurrency": 80,
      "timeoutSeconds": 60
    }
  ]
}
```

## شرح الإعدادات

- **maxInstances**: تم تقليل العدد الأقصى للنسخ من 100 إلى 10 لتجنب تجاوز حد الاستخدام.
- **memory**: تم تعيين الذاكرة إلى 256MB لتقليل استهلاك الموارد.
- **concurrency**: تم تعيين عدد الطلبات المتزامنة إلى 80 لتحسين الأداء ضمن حدود الموارد.
- **timeoutSeconds**: تم تعيين مهلة التنفيذ إلى 60 ثانية.

## ملاحظات إضافية

- إذا كنت بحاجة إلى موارد أكثر، يمكنك طلب زيادة الحصة من Google Cloud Console.
- يمكنك تجربة مناطق أخرى إذا كانت المنطقة الحالية (us-central1) تعاني من قيود على الموارد.
- للحصول على أداء أفضل، يمكنك النظر في ترقية خطتك إلى خطة مدفوعة.

## كيفية النشر

لنشر الوظائف بالإعدادات الجديدة، استخدم الأمر التالي:

```bash
firebase deploy --only functions
```

أو لنشر وظيفة محددة:

```bash
firebase deploy --only functions:اسم_الوظيفة
```
