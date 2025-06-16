# 📚 Comprehensive Documentation Guide - Task Management System

## 🎯 نظرة عامة

Welcome to the comprehensive documentation for the Task Management System. This system provides integrated solutions for managing users, organizations, and tasks with an advanced permissions system.

---

## 📋 فهرس التوثيق

### 🔐 نظام المستخدمين والصلاحيات
- **[📚 User System Documentation](./USER_SYSTEM_DOCUMENTATION.md)**
  - Role and Permission Structure
  - Account Types (Individual and Organization)
  - Detailed Permissions for Each Role
  - Database Structure
  - Practical Examples

- **[🔐 Permissions and Security Guide](./USER_PERMISSIONS_GUIDE.md)**
  - Advanced Permissions System
  - Permission Checking (Frontend & Backend)
  - Custom Permissions
  - System Security and Protection Rules
  - Programming Examples and Ready-to-Use Code

### 🏢 إدارة المؤسسات
- **[🏢 Organization Management Guide](./ORGANIZATION_MANAGEMENT.md)**
  - Creating and Managing Organizations
  - Managing Members and Roles
  - Departments and Organizational Structure
  - Workflow and Processes
  - Practical Examples for Different Companies

### 🔌 التكامل والـ APIs
- **[🔌 API Reference](./API_REFERENCE.md)**
  - All Available APIs
  - Authentication and Authorization
  - Integration Examples in Different Languages
  - Error Handling
  - Ready-to-Use Code

---

## 🚀 البدء السريع

### 1. **فهم النظام**
Start by reading the [User System Documentation](./USER_SYSTEM_DOCUMENTATION.md) to understand the general structure and different roles.

### 2. **إعداد المؤسسة**
Follow the [Organization Management Guide](./ORGANIZATION_MANAGEMENT.md) to create your organization and organize teams.

### 3. **التكامل التقني**
Use the [API Reference](./API_REFERENCE.md) to develop applications and integrate with the system.

### 4. **إدارة الصلاحيات**
Review the [Permissions Guide](./USER_PERMISSIONS_GUIDE.md) to configure security and access control.

---

## 🎭 الأدوار والصلاحيات - ملخص سريع

### 🌐 أدوار النظام العامة (النمط الجديد is* فقط)
| الدور | الوصف | الاستخدام |
|-------|--------|-----------|
| `isSystemOwner` | مالك النظام | إدارة النظام بالكامل |
| `isSystemAdmin` | أدمن النظام | إدارة المؤسسات والمستخدمين |
| `isIndependent` | مستخدم مستقل | إدارة المهام الشخصية |

### 🏢 أدوار المؤسسات (النمط الجديد is* فقط)
| الدور | الوصف | الصلاحيات الرئيسية |
|-------|--------|-------------------|
| `isOrgOwner` | مالك المؤسسة | جميع الصلاحيات داخل المؤسسة |
| `isOrgAdmin` | أدمن المؤسسة | إدارة الأعضاء والمهام والتقارير |
| `isOrgSupervisor` | مشرف | إدارة المهام والموافقة عليها |
| `isOrgEngineer` | مهندس | إنشاء وتطوير المشاريع |
| `isOrgTechnician` | فني | تنفيذ المهام التقنية |
| `isOrgAssistant` | مساعد فني | المساعدة في المهام البسيطة |

---

## 🔧 أمثلة سريعة

### 👤 إنشاء مستخدم جديد
```typescript
const userData = {
  email: "user@company.com",
  password: "securePassword",
  name: "أحمد محمد",
  role: "org_engineer",
  accountType: "organization",
  organizationId: "org_123"
};

const newUser = await createUser(userData);
```

### 🏢 إنشاء مؤسسة
```typescript
const orgData = {
  name: "شركة التقنية المتقدمة",
  description: "شركة متخصصة في تطوير البرمجيات",
  settings: {
    allowPublicJoin: false,
    requireApproval: true,
    maxMembers: 100
  }
};

const organization = await createOrganization(orgData);
```

### ✅ التحقق من الصلاحيات
```typescript
// Frontend
const { hasPermission } = usePermissions();
const canCreateTasks = hasPermission('tasks:create');

// Backend
const hasAccess = await hasPermission(userId, 'tasks:create');
```

---

## 📞 معلومات الاتصال

### 🌐 الروابط المهمة
- **الموقع الرسمي**: https://yourapp.com
- **التوثيق التقني**: https://docs.yourapp.com
- **حالة النظام**: https://status.yourapp.com

---

*آخر تحديث: ديسمبر 2024*

**نصيحة**: ابدأ بقراءة [توثيق نظام المستخدمين](./USER_SYSTEM_DOCUMENTATION.md) للحصول على فهم شامل للنظام! 🚀
