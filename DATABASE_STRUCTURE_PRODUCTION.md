# هيكلة قاعدة البيانات للإنتاج

## 🏗️ الهيكلة الجديدة المبسطة

### 📁 **المجموعات الرئيسية**:

```
firestore/
├── users/                    # معلومات المستخدمين الأساسية
├── organizations/            # بيانات المؤسسات
│   └── {orgId}/members/     # أعضاء كل مؤسسة
├── tasks/                   # جميع المهام (فردية ومؤسسة)
├── reports/                 # جميع التقارير
├── notifications/           # الإشعارات
├── categories/              # فئات المهام
├── okrs/                    # الأهداف والنتائج الرئيسية
├── settings/                # إعدادات المستخدمين
└── system/                  # إعدادات النظام العامة
```

## 🔐 **قواعد الأمان المبسطة**

### **المبادئ الأساسية**:
1. **البساطة**: قواعد واضحة ومفهومة
2. **الأمان**: حماية البيانات الشخصية والمؤسسية
3. **المرونة**: دعم الأفراد والمؤسسات
4. **الأداء**: تقليل عدد الاستعلامات

### **نظام الصلاحيات**:

#### **1. المستخدمون** (`/users/{userId}`)
```javascript
// المستخدم يمكنه الوصول لبياناته الخاصة
allow read, write: if request.auth.uid == userId;

// الأدمن يمكنه الوصول لجميع المستخدمين
allow read, write: if request.auth.token.admin == true;
```

#### **2. المؤسسات** (`/organizations/{orgId}`)
```javascript
// قراءة: أعضاء المؤسسة أو الأدمن
allow read: if exists(/databases/.../organizations/{orgId}/members/{userId}) || admin;

// كتابة: أدمن المؤسسة أو أدمن النظام
allow write: if admin || (member && member.role == 'admin');
```

#### **3. المهام** (`/tasks/{taskId}`)
```javascript
// مهام فردية: المالك فقط
// مهام المؤسسة: أعضاء المؤسسة
// الأدمن: الوصول لجميع المهام
```

#### **4. التقارير** (`/reports/{reportId}`)
```javascript
// نفس منطق المهام
// إضافة: منشئ التقرير يمكنه حذفه
```

#### **5. الإشعارات** (`/notifications/{notificationId}`)
```javascript
// المستخدم يرى إشعاراته فقط
// يمكن تحديث حالة القراءة
// الأدمن يمكنه إدارة جميع الإشعارات
```

## 📊 **هيكل البيانات**

### **1. المستخدم** (`/users/{userId}`)
```typescript
interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  organizationId?: string;  // للمؤسسات
  accountType: 'individual' | 'organization';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  settings: {
    language: 'ar' | 'en';
    theme: 'light' | 'dark';
    notifications: boolean;
  };
}
```

### **2. المؤسسة** (`/organizations/{orgId}`)
```typescript
interface Organization {
  id: string;
  name: string;
  description?: string;
  logo?: string;
  ownerId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  settings: {
    language: 'ar' | 'en';
    timezone: string;
  };
}

// عضو المؤسسة
interface OrganizationMember {
  userId: string;
  role: 'admin' | 'supervisor' | 'engineer' | 'technician' | 'assistant';
  permissions: {
    canCreateTasks?: boolean;
    canEditTasks?: boolean;
    canDeleteTasks?: boolean;
    canViewReports?: boolean;
    canCreateReports?: boolean;
    canEditReports?: boolean;
    canDeleteReports?: boolean;
  };
  joinedAt: Timestamp;
  updatedAt: Timestamp;
}
```

### **3. المهمة** (`/tasks/{taskId}`)
```typescript
interface Task {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  dueDate?: Timestamp;
  
  // للمهام الفردية
  userId?: string;
  
  // للمهام المؤسسية
  organizationId?: string;
  assignedTo?: string;
  departmentId?: string;
  
  // مشترك
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // اختياري
  categoryId?: string;
  okrId?: string;
  tags?: string[];
  attachments?: string[];
}
```

### **4. التقرير** (`/reports/{reportId}`)
```typescript
interface Report {
  id: string;
  title: string;
  content: string;
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  
  // للتقارير الفردية
  userId?: string;
  
  // للتقارير المؤسسية
  organizationId?: string;
  departmentId?: string;
  
  // مشترك
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  
  // بيانات التقرير
  data: {
    tasksCompleted: number;
    tasksTotal: number;
    productivity: number;
    notes?: string;
  };
}
```

### **5. الإشعار** (`/notifications/{notificationId}`)
```typescript
interface Notification {
  id: string;
  userId: string;
  recipientId: string;
  title: string;
  message: string;
  type: 'task' | 'report' | 'system' | 'reminder';
  read: boolean;
  createdAt: Timestamp;
  
  // بيانات إضافية
  data?: {
    taskId?: string;
    reportId?: string;
    organizationId?: string;
  };
}
```

### **6. الفئة** (`/categories/{categoryId}`)
```typescript
interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string;
  userId: string;  // للفئات الشخصية
  organizationId?: string;  // للفئات المؤسسية
  createdAt: Timestamp;
}
```

### **7. الهدف** (`/okrs/{okrId}`)
```typescript
interface OKR {
  id: string;
  title: string;
  description?: string;
  
  // للأهداف الفردية
  userId?: string;
  
  // للأهداف المؤسسية
  organizationId?: string;
  
  // مشترك
  createdBy: string;
  startDate: Timestamp;
  endDate: Timestamp;
  progress: number; // 0-100
  
  keyResults: {
    id: string;
    title: string;
    target: number;
    current: number;
    unit: string;
  }[];
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### **8. الإعدادات** (`/settings/{settingId}`)
```typescript
interface UserSettings {
  userId: string;
  language: 'ar' | 'en';
  theme: 'light' | 'dark';
  notifications: {
    email: boolean;
    push: boolean;
    taskReminders: boolean;
    reportReminders: boolean;
  };
  dateFormat: string;
  timezone: string;
  updatedAt: Timestamp;
}
```

## 🚀 **مزايا الهيكلة الجديدة**

### ✅ **البساطة**:
- قواعد واضحة ومفهومة
- هيكل مسطح بدون تعقيدات
- سهولة الصيانة والتطوير

### ✅ **الأداء**:
- تقليل عدد الاستعلامات
- فهرسة محسنة
- تحميل سريع للبيانات

### ✅ **الأمان**:
- حماية البيانات الشخصية
- صلاحيات واضحة
- منع الوصول غير المصرح

### ✅ **المرونة**:
- دعم الأفراد والمؤسسات
- نظام صلاحيات مرن
- قابلية التوسع

### ✅ **سهولة التطوير**:
- واجهات برمجية واضحة
- تطوير سريع للميزات
- اختبار مبسط

## 📝 **خطوات التطبيق**

### **1. نشر القواعد الجديدة**:
```bash
firebase deploy --only firestore:rules
```

### **2. اختبار الوصول**:
- تسجيل دخول كمستخدم فردي
- تسجيل دخول كعضو مؤسسة
- اختبار الصلاحيات المختلفة

### **3. مراقبة الأداء**:
- مراقبة استعلامات Firestore
- تحسين الفهارس حسب الحاجة
- مراجعة سجلات الأمان

### **4. التوثيق**:
- توثيق واجهات البرمجة
- دليل المطور
- دليل المستخدم

## 🎯 **النتيجة النهائية**

هيكلة قاعدة بيانات:
- **بسيطة وواضحة** للمطورين
- **آمنة ومحمية** للمستخدمين
- **سريعة وفعالة** للتطبيق
- **مرنة وقابلة للتوسع** للمستقبل

**جاهزة للإنتاج!** 🚀
