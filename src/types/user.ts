
// src/types/user.ts
import { PermissionKey, UserRole } from './roles';
import { SystemType } from './system';
import { User as FirebaseUser } from 'firebase/auth';

/**
 * Extensión de User de Firebase para incluir customClaims
 */
export interface ExtendedUser extends FirebaseUser {
  customClaims?: {
    role?: UserRole;
    accountType?: SystemType;
    organizationId?: string;
    departmentId?: string;
    [key: string]: any;
  };
}

/**
 * Represents user data relevant for the admin dashboard.
 */
export interface ManagedUser {
  uid: string;
  email: string | null;
  name?: string;
  role: UserRole;
  accountType: SystemType; // نوع الحساب (فرد/مؤسسة)
  organizationId?: string; // معرف المؤسسة (إذا كان نوع الحساب مؤسسة)
  departmentId?: string; // معرف القسم (إذا كان نوع الحساب مؤسسة)
  customPermissions?: PermissionKey[];
  hasAdminAccess: boolean; // النمط الجديد - محسوب من الأدوار
  disabled: boolean;
  createdAt?: any; // Firestore timestamp
  lastLogin?: any; // Firestore timestamp
}

/**
 * Represents user data stored in Firestore
 */
export interface UserData {
  uid: string;                          // ✅ معرف المستخدم
  email: string;
  name: string;
  displayName: string;                  // ✅ اسم العرض
  role: UserRole;
  accountType: SystemType;              // نوع الحساب (فرد/مؤسسة)
  organizationId?: string;              // معرف المؤسسة (إذا كان نوع الحساب مؤسسة)
  departmentId?: string;                // معرف القسم (إذا كان نوع الحساب مؤسسة)

  // النمط الجديد is* فقط
  isSystemOwner: boolean;
  isSystemAdmin: boolean;
  isOrgOwner: boolean;
  isOrgAdmin: boolean;
  isOrgSupervisor: boolean;
  isOrgEngineer: boolean;
  isOrgTechnician: boolean;
  isOrgAssistant: boolean;
  isIndependent: boolean;

  // الحالة والصلاحيات
  disabled: boolean;                    // ✅ حالة التفعيل
  customPermissions?: PermissionKey[];  // ✅ الصلاحيات المخصصة

  // التتبع والتواريخ
  createdAt: any;                       // Firestore timestamp
  updatedAt: any;                       // Firestore timestamp
  createdBy?: string;                   // ✅ من أنشأ المستخدم
  lastLogin?: any;                      // Firestore timestamp
}

/**
 * Represents user claims stored in Firebase Auth
 */
export interface UserClaims {
  role?: UserRole;
  accountType?: SystemType; // نوع الحساب (فرد/مؤسسة)
  organizationId?: string; // معرف المؤسسة (إذا كان نوع الحساب مؤسسة)
  departmentId?: string; // معرف القسم (إذا كان نوع الحساب مؤسسة)

  // النمط الجديد is* فقط
  isSystemOwner?: boolean;
  isSystemAdmin?: boolean;
  isOrgOwner?: boolean;
  isOrgAdmin?: boolean;
  isOrgSupervisor?: boolean;
  isOrgEngineer?: boolean;
  isOrgTechnician?: boolean;
  isOrgAssistant?: boolean;
  isIndependent?: boolean;

  // الصلاحيات المخصصة
  customPermissions?: PermissionKey[];
}

/**
 * Input for creating a new user
 */
export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  accountType: SystemType; // نوع الحساب (فرد/مؤسسة)
  organizationId?: string; // معرف المؤسسة (إذا كان نوع الحساب مؤسسة)
  departmentId?: string; // معرف القسم (إذا كان نوع الحساب مؤسسة)
}


    