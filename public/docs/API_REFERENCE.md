# 🔌 مرجع API ونظام المستخدمين

## 📋 جدول المحتويات
- [نظرة عامة](#نظرة-عامة)
- [المصادقة والتفويض](#المصادقة-والتفويض)
- [APIs إدارة المستخدمين](#apis-إدارة-المستخدمين)
- [APIs إدارة المؤسسات](#apis-إدارة-المؤسسات)
- [APIs الصلاحيات](#apis-الصلاحيات)
- [أمثلة التكامل](#أمثلة-التكامل)

---

## 🔍 نظرة عامة

### 🌐 Base URL
```
https://europe-west1-your-project.cloudfunctions.net/api
```

### 📝 تنسيق الاستجابة
```typescript
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}
```

### 🔐 Headers مطلوبة
```typescript
{
  'Authorization': 'Bearer <firebase_id_token>',
  'Content-Type': 'application/json'
}
```

---

## 🔐 المصادقة والتفويض

### 🎫 الحصول على Token
```typescript
// Frontend (Firebase Auth)
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const auth = getAuth();
const userCredential = await signInWithEmailAndPassword(auth, email, password);
const idToken = await userCredential.user.getIdToken();

// استخدام Token في API calls
const response = await fetch('/api/users', {
  headers: {
    'Authorization': `Bearer ${idToken}`,
    'Content-Type': 'application/json'
  }
});
```

### 🔍 التحقق من Token (Backend)
```typescript
// Cloud Functions
import { auth } from 'firebase-admin';

export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Token مطلوب' });
    }
    
    const decodedToken = await auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token غير صالح' });
  }
};
```

---

## 👥 APIs إدارة المستخدمين

### 📊 GET /api/users
**الوصف**: جلب قائمة المستخدمين  
**الصلاحية المطلوبة**: `users:view`

```typescript
// Request
GET /api/users?page=1&limit=10&role=org_admin&organizationId=org_123

// Response
{
  "success": true,
  "data": {
    "users": [
      {
        "uid": "user_123",
        "email": "user@example.com",
        "name": "أحمد محمد",
        "role": "org_admin",
        "accountType": "organization",
        "organizationId": "org_123",
        "departmentId": "dept_456",
        "createdAt": "2024-01-01T00:00:00Z",
        "lastActivity": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 25,
      "totalPages": 3
    }
  }
}
```

### 👤 GET /api/users/:userId
**الوصف**: جلب بيانات مستخدم محدد  
**الصلاحية المطلوبة**: `users:view`

```typescript
// Request
GET /api/users/user_123

// Response
{
  "success": true,
  "data": {
    "uid": "user_123",
    "email": "user@example.com",
    "name": "أحمد محمد",
    "role": "org_admin",
    "accountType": "organization",
    "organizationId": "org_123",
    "departmentId": "dept_456",
    "permissions": ["users:view", "tasks:create", "reports:edit"],
    "customPermissions": ["special:access"],
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

### ➕ POST /api/users
**الوصف**: إنشاء مستخدم جديد  
**الصلاحية المطلوبة**: `users:create`

```typescript
// Request
POST /api/users
{
  "email": "newuser@example.com",
  "password": "securePassword123",
  "name": "سارة أحمد",
  "role": "org_engineer",
  "accountType": "organization",
  "organizationId": "org_123",
  "departmentId": "dept_456"
}

// Response
{
  "success": true,
  "data": {
    "uid": "new_user_456",
    "email": "newuser@example.com",
    "name": "سارة أحمد",
    "role": "org_engineer",
    "message": "تم إنشاء المستخدم بنجاح"
  }
}
```

### ✏️ PUT /api/users/:userId
**الوصف**: تحديث بيانات المستخدم  
**الصلاحية المطلوبة**: `users:edit`

```typescript
// Request
PUT /api/users/user_123
{
  "name": "أحمد محمد السعيد",
  "role": "org_supervisor",
  "departmentId": "dept_789"
}

// Response
{
  "success": true,
  "data": {
    "uid": "user_123",
    "updatedFields": ["name", "role", "departmentId"],
    "message": "تم تحديث المستخدم بنجاح"
  }
}
```

### 🗑️ DELETE /api/users/:userId
**الوصف**: حذف مستخدم  
**الصلاحية المطلوبة**: `users:delete`

```typescript
// Request
DELETE /api/users/user_123

// Response
{
  "success": true,
  "data": {
    "uid": "user_123",
    "message": "تم حذف المستخدم بنجاح"
  }
}
```

---

## 🏢 APIs إدارة المؤسسات

### 🏗️ POST /api/organizations
**الوصف**: إنشاء مؤسسة جديدة  
**الصلاحية المطلوبة**: `system_admin` أو `system_owner`

```typescript
// Request
POST /api/organizations
{
  "name": "شركة التقنية المتقدمة",
  "description": "شركة متخصصة في تطوير البرمجيات",
  "website": "https://techcompany.com",
  "email": "info@techcompany.com",
  "settings": {
    "allowPublicJoin": false,
    "requireApproval": true,
    "maxMembers": 100
  }
}

// Response
{
  "success": true,
  "data": {
    "id": "org_789",
    "name": "شركة التقنية المتقدمة",
    "ownerId": "current_user_id",
    "message": "تم إنشاء المؤسسة بنجاح"
  }
}
```

### 👥 GET /api/organizations/:orgId/members
**الوصف**: جلب أعضاء المؤسسة  
**الصلاحية المطلوبة**: `users:view` في نفس المؤسسة

```typescript
// Request
GET /api/organizations/org_123/members?role=org_admin&department=dept_456

// Response
{
  "success": true,
  "data": {
    "members": [
      {
        "userId": "user_123",
        "name": "أحمد محمد",
        "email": "ahmed@example.com",
        "role": "org_admin",
        "departmentId": "dept_456",
        "departmentName": "قسم التطوير",
        "joinedAt": "2024-01-01T00:00:00Z",
        "status": "active"
      }
    ],
    "stats": {
      "totalMembers": 15,
      "activeMembers": 12,
      "pendingMembers": 3
    }
  }
}
```

### 📨 POST /api/organizations/:orgId/invite
**الوصف**: دعوة عضو جديد للمؤسسة  
**الصلاحية المطلوبة**: `users:create`

```typescript
// Request
POST /api/organizations/org_123/invite
{
  "email": "newmember@example.com",
  "role": "org_engineer",
  "departmentId": "dept_456",
  "message": "مرحباً بك في فريقنا"
}

// Response
{
  "success": true,
  "data": {
    "invitationId": "inv_789",
    "email": "newmember@example.com",
    "expiresAt": "2024-01-22T00:00:00Z",
    "message": "تم إرسال الدعوة بنجاح"
  }
}
```

---

## 🔐 APIs الصلاحيات

### 🎯 GET /api/users/:userId/permissions
**الوصف**: جلب صلاحيات المستخدم  
**الصلاحية المطلوبة**: `users:view`

```typescript
// Request
GET /api/users/user_123/permissions

// Response
{
  "success": true,
  "data": {
    "userId": "user_123",
    "role": "org_admin",
    "permissions": {
      "default": [
        "users:view", "users:create", "users:edit",
        "tasks:view", "tasks:create", "tasks:edit"
      ],
      "custom": ["special:access", "reports:advanced"],
      "total": [
        "users:view", "users:create", "users:edit",
        "tasks:view", "tasks:create", "tasks:edit",
        "special:access", "reports:advanced"
      ]
    }
  }
}
```

### ✅ POST /api/users/:userId/permissions/check
**الوصف**: التحقق من صلاحية محددة  
**الصلاحية المطلوبة**: `users:view`

```typescript
// Request
POST /api/users/user_123/permissions/check
{
  "permission": "tasks:create"
}

// Response
{
  "success": true,
  "data": {
    "userId": "user_123",
    "permission": "tasks:create",
    "hasPermission": true,
    "source": "role" // أو "custom"
  }
}
```

### 🔄 PUT /api/users/:userId/permissions
**الوصف**: تحديث الصلاحيات المخصصة  
**الصلاحية المطلوبة**: `users:edit`

```typescript
// Request
PUT /api/users/user_123/permissions
{
  "customPermissions": ["special:access", "reports:advanced"],
  "action": "add" // أو "remove" أو "replace"
}

// Response
{
  "success": true,
  "data": {
    "userId": "user_123",
    "updatedPermissions": ["special:access", "reports:advanced"],
    "message": "تم تحديث الصلاحيات بنجاح"
  }
}
```

---

## 💻 أمثلة التكامل

### 🔧 JavaScript/TypeScript Client
```typescript
class UserManagementAPI {
  private baseURL = 'https://europe-west1-your-project.cloudfunctions.net/api';
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options.headers
      }
    });

    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error?.message || 'API Error');
    }
    
    return data.data;
  }

  // جلب المستخدمين
  async getUsers(filters?: {
    page?: number;
    limit?: number;
    role?: string;
    organizationId?: string;
  }) {
    const params = new URLSearchParams(filters as any);
    return this.request(`/users?${params}`);
  }

  // إنشاء مستخدم
  async createUser(userData: {
    email: string;
    password: string;
    name: string;
    role: string;
    accountType: string;
    organizationId?: string;
  }) {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }

  // تحديث دور المستخدم
  async updateUserRole(userId: string, role: string) {
    return this.request(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify({ role })
    });
  }

  // التحقق من الصلاحية
  async checkPermission(userId: string, permission: string) {
    return this.request(`/users/${userId}/permissions/check`, {
      method: 'POST',
      body: JSON.stringify({ permission })
    });
  }
}

// الاستخدام
const api = new UserManagementAPI(idToken);

// جلب المستخدمين
const users = await api.getUsers({ role: 'org_admin', page: 1 });

// إنشاء مستخدم جديد
const newUser = await api.createUser({
  email: 'user@example.com',
  password: 'password123',
  name: 'أحمد محمد',
  role: 'org_engineer',
  accountType: 'organization',
  organizationId: 'org_123'
});
```

### 🐍 Python Client
```python
import requests
from typing import Dict, Any, Optional

class UserManagementAPI:
    def __init__(self, token: str):
        self.base_url = 'https://europe-west1-your-project.cloudfunctions.net/api'
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
    
    def _request(self, endpoint: str, method: str = 'GET', data: Optional[Dict] = None) -> Dict[str, Any]:
        url = f"{self.base_url}{endpoint}"
        response = requests.request(method, url, headers=self.headers, json=data)
        
        result = response.json()
        if not result.get('success'):
            raise Exception(result.get('error', {}).get('message', 'API Error'))
        
        return result.get('data')
    
    def get_users(self, **filters) -> Dict[str, Any]:
        params = '&'.join([f"{k}={v}" for k, v in filters.items()])
        return self._request(f"/users?{params}")
    
    def create_user(self, user_data: Dict[str, Any]) -> Dict[str, Any]:
        return self._request('/users', 'POST', user_data)
    
    def update_user_role(self, user_id: str, role: str) -> Dict[str, Any]:
        return self._request(f'/users/{user_id}', 'PUT', {'role': role})

# الاستخدام
api = UserManagementAPI(id_token)

# جلب المستخدمين
users = api.get_users(role='org_admin', page=1)

# إنشاء مستخدم
new_user = api.create_user({
    'email': 'user@example.com',
    'password': 'password123',
    'name': 'أحمد محمد',
    'role': 'org_engineer',
    'accountType': 'organization',
    'organizationId': 'org_123'
})
```

### 📱 React Hook
```typescript
// hooks/useUserAPI.ts
import { useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';

export function useUserAPI() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiCall = useCallback(async (endpoint: string, options: RequestInit = {}) => {
    if (!user) throw new Error('User not authenticated');
    
    setLoading(true);
    setError(null);
    
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      });
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error?.message || 'API Error');
      }
      
      return data.data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const getUsers = useCallback((filters?: any) => {
    const params = new URLSearchParams(filters);
    return apiCall(`/users?${params}`);
  }, [apiCall]);

  const createUser = useCallback((userData: any) => {
    return apiCall('/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
  }, [apiCall]);

  return {
    loading,
    error,
    getUsers,
    createUser,
    apiCall
  };
}

// الاستخدام في المكون
function UserManagement() {
  const { getUsers, createUser, loading, error } = useUserAPI();
  const [users, setUsers] = useState([]);

  useEffect(() => {
    getUsers({ role: 'org_admin' })
      .then(setUsers)
      .catch(console.error);
  }, [getUsers]);

  const handleCreateUser = async (userData: any) => {
    try {
      await createUser(userData);
      // تحديث القائمة
      const updatedUsers = await getUsers();
      setUsers(updatedUsers);
    } catch (err) {
      console.error('Error creating user:', err);
    }
  };

  if (loading) return <div>جاري التحميل...</div>;
  if (error) return <div>خطأ: {error}</div>;

  return (
    <div>
      {/* عرض المستخدمين */}
    </div>
  );
}
```

---

## 🔍 معالجة الأخطاء

### 📋 رموز الأخطاء الشائعة
```typescript
const ERROR_CODES = {
  'auth/invalid-token': 'Token غير صالح',
  'auth/token-expired': 'Token منتهي الصلاحية',
  'permission-denied': 'ليس لديك صلاحية للوصول',
  'user-not-found': 'المستخدم غير موجود',
  'organization-not-found': 'المؤسسة غير موجودة',
  'invalid-role': 'الدور غير صالح',
  'email-already-exists': 'البريد الإلكتروني مستخدم بالفعل'
};
```

### 🛠️ معالج الأخطاء العام
```typescript
function handleAPIError(error: any) {
  if (error.code) {
    const message = ERROR_CODES[error.code] || error.message;
    console.error('API Error:', message);
    return message;
  }
  
  console.error('Unknown error:', error);
  return 'حدث خطأ غير متوقع';
}
```

---

*آخر تحديث: ديسمبر 2024*
