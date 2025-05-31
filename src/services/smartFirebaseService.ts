import { httpsCallable, Functions } from 'firebase/functions';
import { auth } from '@/lib/firebase';

export interface FunctionConfig {
  function_type: 'callable' | 'http' | 'hybrid';
  is_enabled: boolean;
  cors_enabled: boolean;
  allowed_origins: string[];
  rate_limit: number;
  require_auth: boolean;
  admin_only: boolean;
  security_level: 'high' | 'medium' | 'low';
  security_warnings: string[];
  security_score: number;
}

export class SmartFirebaseService {
  private functions: Functions;
  private configCache = new Map<string, FunctionConfig>();
  private dynamicFunction: any;

  constructor(functions: Functions) {
    this.functions = functions;
    // الدالة الشاملة الوحيدة
    this.dynamicFunction = httpsCallable(this.functions, 'dynamicFunctionControl');
  }

  /**
   * استدعاء دالة بطريقة ذكية حسب الإعدادات
   */
  async callFunction(action: string, data: any, targetFunction?: string): Promise<any> {
    try {
      // الحصول على إعدادات الدالة
      const config = await this.getConfig(targetFunction || action);
      
      if (!config.is_enabled) {
        throw new Error(`الدالة ${targetFunction || action} معطلة حالياً`);
      }

      // تحذير أمني
      if (config.security_level === 'low') {
        console.warn(`⚠️ تحذير أمني: الدالة ${targetFunction || action} لها مستوى أمان منخفض:`, config.security_warnings);
      }

      // استدعاء الدالة الشاملة
      const result = await this.dynamicFunction({
        action,
        targetFunction: targetFunction || action,
        userData: data,
        timestamp: Date.now()
      });

      console.log(`✅ نجح استدعاء ${action}:`, result.data);
      return result.data;

    } catch (error: any) {
      console.error(`❌ فشل استدعاء ${action}:`, error);
      
      // محاولة HTTP fallback إذا فشل Callable
      if (error.code === 'functions/internal' || error.message.includes('CORS')) {
        console.log(`🔄 محاولة HTTP fallback للدالة ${action}...`);
        return await this.callHttpFallback(action, data, targetFunction);
      }
      
      throw error;
    }
  }

  /**
   * HTTP Fallback للطوارئ
   */
  private async callHttpFallback(action: string, data: any, targetFunction?: string): Promise<any> {
    try {
      const token = await auth.currentUser?.getIdToken();
      
      const response = await fetch(`https://us-central1-tasks-intelligence.cloudfunctions.net/dynamicFunctionControl`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          data: {
            action,
            targetFunction: targetFunction || action,
            userData: data
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log(`✅ نجح HTTP fallback للدالة ${action}:`, result);
      return result.data || result;

    } catch (error) {
      console.error(`❌ فشل HTTP fallback للدالة ${action}:`, error);
      throw error;
    }
  }

  /**
   * الحصول على إعدادات دالة من Django أو الكاش
   */
  private async getConfig(functionName: string): Promise<FunctionConfig> {
    // التحقق من الكاش أولاً
    if (this.configCache.has(functionName)) {
      return this.configCache.get(functionName)!;
    }

    try {
      // محاولة الحصول من Django
      const response = await fetch(`http://localhost:8000/api/firebase-config/${functionName}/`);
      if (response.ok) {
        const config = await response.json();
        this.configCache.set(functionName, config);
        
        // تنظيف الكاش بعد 5 دقائق
        setTimeout(() => this.configCache.delete(functionName), 5 * 60 * 1000);
        
        return config;
      }
    } catch (error) {
      console.log(`Could not fetch config for ${functionName}, using defaults`);
    }

    // إعدادات افتراضية آمنة
    const defaultConfig: FunctionConfig = {
      function_type: 'callable',
      is_enabled: true,
      cors_enabled: false,
      allowed_origins: [],
      rate_limit: 100,
      require_auth: true,
      admin_only: true,
      security_level: 'high',
      security_warnings: [],
      security_score: 50
    };

    this.configCache.set(functionName, defaultConfig);
    return defaultConfig;
  }

  /**
   * تبديل نوع دالة بين callable و http
   */
  async toggleFunctionType(functionName: string): Promise<any> {
    try {
      const response = await fetch(`http://localhost:8000/api/firebase-config/${functionName}/toggle/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      
      // تحديث الكاش
      this.configCache.delete(functionName);
      
      return result;
    } catch (error) {
      console.error(`Error toggling function type for ${functionName}:`, error);
      throw error;
    }
  }

  /**
   * الحصول على إحصائيات الأمان
   */
  async getSecurityDashboard(): Promise<any> {
    try {
      const response = await fetch('http://localhost:8000/api/firebase-config/security-audit/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await auth.currentUser?.getIdToken()}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching security dashboard:', error);
      throw error;
    }
  }

  // ===== دوال مخصصة لكل عملية =====

  async createUser(userData: any): Promise<any> {
    return this.callFunction('createUser', userData);
  }

  async updateUser(uid: string, updates: any): Promise<any> {
    return this.callFunction('updateUser', { uid, updates });
  }

  async deleteUser(uid: string): Promise<any> {
    return this.callFunction('deleteUser', { uid });
  }

  async listUsers(limit = 100, pageToken?: string): Promise<any> {
    return this.callFunction('listUsers', { limit, pageToken });
  }

  async getFunctionConfig(functionName: string): Promise<FunctionConfig> {
    return this.getConfig(functionName);
  }

  /**
   * تنظيف الكاش
   */
  clearCache(): void {
    this.configCache.clear();
  }

  /**
   * الحصول على إحصائيات الكاش
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.configCache.size,
      keys: Array.from(this.configCache.keys())
    };
  }
}

// إنشاء instance واحد للاستخدام العام
let smartFirebaseService: SmartFirebaseService | null = null;

export const getSmartFirebaseService = (functions: Functions): SmartFirebaseService => {
  if (!smartFirebaseService) {
    smartFirebaseService = new SmartFirebaseService(functions);
  }
  return smartFirebaseService;
};

// دوال مساعدة للاستخدام المباشر
export const createUser = async (functions: Functions, userData: any) => {
  const service = getSmartFirebaseService(functions);
  return service.createUser(userData);
};

export const updateUser = async (functions: Functions, uid: string, updates: any) => {
  const service = getSmartFirebaseService(functions);
  return service.updateUser(uid, updates);
};

export const deleteUser = async (functions: Functions, uid: string) => {
  const service = getSmartFirebaseService(functions);
  return service.deleteUser(uid);
};

export const listUsers = async (functions: Functions, limit?: number, pageToken?: string) => {
  const service = getSmartFirebaseService(functions);
  return service.listUsers(limit, pageToken);
};
