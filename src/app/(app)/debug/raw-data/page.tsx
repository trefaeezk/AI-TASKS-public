'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Database, 
  Shield, 
  RefreshCw, 
  Copy, 
  Eye, 
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

export default function RawDataPage() {
  const { user, userClaims, refreshUserData } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [firestoreData, setFirestoreData] = useState<any>(null);
  const [authClaims, setAuthClaims] = useState<any>(null);
  const [fixing, setFixing] = useState(false);

  // جلب البيانات الخام
  const fetchRawData = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // جلب Auth Claims مباشرة
      const idTokenResult = await user.getIdTokenResult(true);
      setAuthClaims(idTokenResult.claims);

      // جلب بيانات Firestore مباشرة
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        setFirestoreData(userDoc.data());
      } else {
        setFirestoreData(null);
      }

    } catch (error) {
      console.error('Error fetching raw data:', error);
      toast({
        title: 'خطأ في جلب البيانات',
        description: 'حدث خطأ أثناء جلب البيانات الخام',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // نسخ البيانات للحافظة
  const copyToClipboard = (data: any, title: string) => {
    const jsonString = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(jsonString).then(() => {
      toast({
        title: 'تم النسخ',
        description: `تم نسخ ${title} إلى الحافظة`,
        variant: 'default',
      });
    });
  };

  // إصلاح Auth Claims
  const fixAuthClaims = async () => {
    if (!user || !firestoreData) return;

    setFixing(true);
    try {
      const functions = getFunctions();
      const fixPermissionsFn = httpsCallable(functions, 'fixUserPermissions');
      
      const result = await fixPermissionsFn({
        uid: user.uid,
        targetRole: firestoreData.role || 'system_owner',
        accountType: firestoreData.accountType || 'individual'
      });

      console.log('Fix result:', result);

      // تحديث البيانات
      await refreshUserData(true);
      await fetchRawData();

      toast({
        title: '✅ تم الإصلاح',
        description: 'تم مزامنة Auth Claims مع بيانات Firestore',
        variant: 'default',
      });

    } catch (error: any) {
      console.error('Error fixing auth claims:', error);
      toast({
        title: '❌ فشل الإصلاح',
        description: error.message || 'حدث خطأ أثناء الإصلاح',
        variant: 'destructive',
      });
    } finally {
      setFixing(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchRawData();
    }
  }, [user]);

  // مقارنة البيانات
  const compareData = () => {
    if (!authClaims || !firestoreData) return { status: 'unknown', issues: [] };

    const issues = [];
    
    // مقارنة الحقول المهمة
    if (authClaims.role !== firestoreData.role) {
      issues.push(`Role مختلف: Auth="${authClaims.role}" vs Firestore="${firestoreData.role}"`);
    }

    if (authClaims.system_owner !== firestoreData.isSystemOwner) {
      issues.push(`System Owner مختلف: Auth="${authClaims.system_owner}" vs Firestore="${firestoreData.isSystemOwner}"`);
    }

    if (authClaims.owner !== firestoreData.isOwner) {
      issues.push(`Owner مختلف: Auth="${authClaims.owner}" vs Firestore="${firestoreData.isOwner}"`);
    }

    if (authClaims.accountType !== firestoreData.accountType) {
      issues.push(`Account Type مختلف: Auth="${authClaims.accountType}" vs Firestore="${firestoreData.accountType}"`);
    }

    return {
      status: issues.length === 0 ? 'synced' : 'out_of_sync',
      issues
    };
  };

  const comparison = compareData();

  if (!user) {
    return (
      <div className="container mx-auto p-4" dir="rtl">
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>غير مسجل الدخول</AlertTitle>
          <AlertDescription>يجب تسجيل الدخول لعرض البيانات الخام</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-primary flex items-center">
            <Database className="ml-3 h-8 w-8" />
            البيانات الخام للمستخدم
          </h1>
          <p className="text-muted-foreground mt-1">
            عرض مفصل لجميع البيانات من Firebase Auth و Firestore
          </p>
        </div>
        <Button 
          onClick={fetchRawData} 
          disabled={loading}
          variant="outline"
        >
          <RefreshCw className={`ml-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          تحديث البيانات
        </Button>
      </div>

      {/* Comparison Status */}
      <Card className={`border-2 ${
        comparison.status === 'synced' ? 'border-green-200 bg-green-50' :
        comparison.status === 'out_of_sync' ? 'border-red-200 bg-red-50' :
        'border-gray-200'
      }`}>
        <CardHeader>
          <CardTitle className="flex items-center">
            {comparison.status === 'synced' ? (
              <CheckCircle className="ml-2 h-5 w-5 text-green-600" />
            ) : comparison.status === 'out_of_sync' ? (
              <AlertTriangle className="ml-2 h-5 w-5 text-red-600" />
            ) : (
              <Eye className="ml-2 h-5 w-5" />
            )}
            حالة المزامنة
          </CardTitle>
          <CardDescription>
            مقارنة بين Firebase Auth Claims و Firestore Data
          </CardDescription>
        </CardHeader>
        <CardContent>
          {comparison.status === 'synced' ? (
            <div className="text-green-700">
              ✅ البيانات متزامنة بشكل صحيح
            </div>
          ) : comparison.status === 'out_of_sync' ? (
            <div className="space-y-2">
              <div className="text-red-700 font-medium">❌ البيانات غير متزامنة:</div>
              <ul className="list-disc list-inside space-y-1 text-sm text-red-600">
                {comparison.issues.map((issue, index) => (
                  <li key={index}>{issue}</li>
                ))}
              </ul>
              <Button 
                onClick={fixAuthClaims}
                disabled={fixing}
                className="mt-3"
                variant="destructive"
              >
                <Shield className={`ml-2 h-4 w-4 ${fixing ? 'animate-spin' : ''}`} />
                {fixing ? 'جاري الإصلاح...' : 'إصلاح Auth Claims'}
              </Button>
            </div>
          ) : (
            <div className="text-gray-600">
              جاري التحقق من حالة المزامنة...
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Firebase Auth Claims */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <Shield className="ml-2 h-5 w-5" />
                Firebase Auth Claims
              </div>
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => copyToClipboard(authClaims, 'Auth Claims')}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </CardTitle>
            <CardDescription>
              الصلاحيات المخزنة في Firebase Authentication
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-4">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground mt-2">جاري التحميل...</p>
              </div>
            ) : authClaims ? (
              <div className="space-y-3">
                {Object.entries(authClaims).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="font-medium text-sm">{key}:</span>
                    <Badge 
                      variant={
                        value === true ? "default" : 
                        value === false ? "secondary" : 
                        value === undefined ? "destructive" :
                        "outline"
                      }
                      className="text-xs"
                    >
                      {value === undefined ? 'undefined' : String(value)}
                    </Badge>
                  </div>
                ))}
                <Separator className="my-3" />
                <div className="text-xs text-muted-foreground">
                  <strong>JSON الخام:</strong>
                  <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-40">
                    {JSON.stringify(authClaims, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <XCircle className="h-6 w-6 text-red-500 mx-auto" />
                <p className="text-sm text-red-600 mt-2">فشل في جلب Auth Claims</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Firestore Data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <Database className="ml-2 h-5 w-5" />
                Firestore Data
              </div>
              <Button 
                size="sm" 
                variant="ghost"
                onClick={() => copyToClipboard(firestoreData, 'Firestore Data')}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </CardTitle>
            <CardDescription>
              البيانات المخزنة في قاعدة بيانات Firestore
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-4">
                <RefreshCw className="h-6 w-6 animate-spin mx-auto" />
                <p className="text-sm text-muted-foreground mt-2">جاري التحميل...</p>
              </div>
            ) : firestoreData ? (
              <div className="space-y-3">
                {Object.entries(firestoreData).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="font-medium text-sm">{key}:</span>
                    <Badge 
                      variant={
                        value === true ? "default" : 
                        value === false ? "secondary" : 
                        value === null ? "destructive" :
                        "outline"
                      }
                      className="text-xs"
                    >
                      {value === null ? 'null' : 
                       typeof value === 'object' ? JSON.stringify(value) :
                       String(value)}
                    </Badge>
                  </div>
                ))}
                <Separator className="my-3" />
                <div className="text-xs text-muted-foreground">
                  <strong>JSON الخام:</strong>
                  <pre className="mt-2 p-2 bg-gray-100 rounded text-xs overflow-auto max-h-40">
                    {JSON.stringify(firestoreData, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <XCircle className="h-6 w-6 text-red-500 mx-auto" />
                <p className="text-sm text-red-600 mt-2">لا توجد بيانات في Firestore</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Context Data */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Eye className="ml-2 h-5 w-5" />
            بيانات AuthContext
          </CardTitle>
          <CardDescription>
            البيانات المستخدمة في التطبيق من AuthContext
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">معلومات المستخدم:</h4>
              <div className="space-y-1 text-sm">
                <div>UID: <code className="bg-gray-100 px-1 rounded">{user?.uid}</code></div>
                <div>Email: <code className="bg-gray-100 px-1 rounded">{user?.email}</code></div>
                <div>Display Name: <code className="bg-gray-100 px-1 rounded">{user?.displayName || 'null'}</code></div>
              </div>
            </div>
            <div>
              <h4 className="font-medium mb-2">UserClaims من Context:</h4>
              <div className="text-xs">
                <pre className="p-2 bg-gray-100 rounded overflow-auto max-h-32">
                  {JSON.stringify(userClaims, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>كيفية قراءة البيانات</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div>
              <strong>🔴 undefined/null:</strong> القيمة مفقودة أو غير محددة
            </div>
            <div>
              <strong>🟢 true:</strong> الصلاحية مفعلة
            </div>
            <div>
              <strong>🟡 false:</strong> الصلاحية غير مفعلة
            </div>
            <div>
              <strong>📋 نسخ البيانات:</strong> اضغط على أيقونة النسخ لنسخ البيانات الخام
            </div>
            <div>
              <strong>🔧 الإصلاح:</strong> إذا كانت البيانات غير متزامنة، اضغط "إصلاح Auth Claims"
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
