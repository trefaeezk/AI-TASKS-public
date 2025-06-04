'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';

interface DiagnosticResult {
  test: string;
  status: 'success' | 'error' | 'warning';
  message: string;
  details?: any;
}

export function FirebaseFunctionsDiagnostic() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<DiagnosticResult[]>([]);
  const { user } = useAuth();

  const runDiagnostics = async () => {
    setIsRunning(true);
    setResults([]);
    const testResults: DiagnosticResult[] = [];

    // Test 1: Check if functions instance exists
    try {
      if (functions) {
        testResults.push({
          test: 'Firebase Functions Instance',
          status: 'success',
          message: 'Firebase Functions instance is available',
          details: { region: 'europe-west1' }
        });
      } else {
        testResults.push({
          test: 'Firebase Functions Instance',
          status: 'error',
          message: 'Firebase Functions instance is not available'
        });
      }
    } catch (error: any) {
      testResults.push({
        test: 'Firebase Functions Instance',
        status: 'error',
        message: `Error checking functions instance: ${error.message}`
      });
    }

    // Test 2: Check authentication
    try {
      if (user) {
        testResults.push({
          test: 'User Authentication',
          status: 'success',
          message: 'User is authenticated',
          details: { uid: user.uid, email: user.email }
        });
      } else {
        testResults.push({
          test: 'User Authentication',
          status: 'warning',
          message: 'User is not authenticated'
        });
      }
    } catch (error: any) {
      testResults.push({
        test: 'User Authentication',
        status: 'error',
        message: `Error checking authentication: ${error.message}`
      });
    }

    // Test 3: Test simple function call (if functions available)
    if (functions) {
      try {
        console.log('🧪 Testing getSystemSettings function...');
        const getSystemSettingsFn = httpsCallable(functions, 'getSystemSettings');
        const result = await getSystemSettingsFn({});
        
        testResults.push({
          test: 'getSystemSettings Function',
          status: 'success',
          message: 'Successfully called getSystemSettings function',
          details: result.data
        });
      } catch (error: any) {
        console.error('🚨 Error testing getSystemSettings:', error);
        testResults.push({
          test: 'getSystemSettings Function',
          status: 'error',
          message: `Error calling getSystemSettings: ${error.message}`,
          details: { code: error.code, message: error.message }
        });
      }

      // Test 4: Test createUser function (if user is authenticated)
      if (user) {
        try {
          console.log('🧪 Testing createUser function with invalid data...');
          const createUserFn = httpsCallable(functions, 'createUser');
          
          // Test with invalid data to see if function responds
          await createUserFn({
            email: '', // Invalid email to trigger validation
            password: '',
            name: '',
            role: 'test',
            accountType: 'individual'
          });
          
          testResults.push({
            test: 'createUser Function Response',
            status: 'warning',
            message: 'createUser function responded (unexpected success with invalid data)'
          });
        } catch (error: any) {
          console.log('🧪 createUser function error (expected):', error);
          
          if (error.code === 'functions/invalid-argument') {
            testResults.push({
              test: 'createUser Function Response',
              status: 'success',
              message: 'createUser function is responding correctly (validation error as expected)',
              details: { code: error.code }
            });
          } else if (error.code === 'functions/unauthenticated') {
            testResults.push({
              test: 'createUser Function Response',
              status: 'warning',
              message: 'createUser function requires authentication',
              details: { code: error.code }
            });
          } else if (error.code === 'functions/permission-denied') {
            testResults.push({
              test: 'createUser Function Response',
              status: 'warning',
              message: 'createUser function requires admin permissions',
              details: { code: error.code }
            });
          } else {
            testResults.push({
              test: 'createUser Function Response',
              status: 'error',
              message: `Unexpected error from createUser: ${error.message}`,
              details: { code: error.code, message: error.message }
            });
          }
        }
      }
    }

    // Test 5: Check network connectivity
    try {
      const response = await fetch('https://www.google.com', { mode: 'no-cors' });
      testResults.push({
        test: 'Network Connectivity',
        status: 'success',
        message: 'Network connectivity is working'
      });
    } catch (error: any) {
      testResults.push({
        test: 'Network Connectivity',
        status: 'error',
        message: `Network connectivity issue: ${error.message}`
      });
    }

    setResults(testResults);
    setIsRunning(false);
  };

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: DiagnosticResult['status']) => {
    const variants = {
      success: 'default',
      warning: 'secondary',
      error: 'destructive'
    } as const;

    return (
      <Badge variant={variants[status]} className="ml-2">
        {status === 'success' ? 'نجح' : status === 'warning' ? 'تحذير' : 'فشل'}
      </Badge>
    );
  };

  return (
    <Card className="w-full max-w-4xl mx-auto" dir="rtl">
      <CardHeader>
        <CardTitle className="flex items-center">
          🔧 تشخيص Firebase Functions
        </CardTitle>
        <CardDescription>
          اختبار اتصال وعمل Firebase Functions لحل مشاكل إدارة المستخدمين
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          onClick={runDiagnostics} 
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? (
            <>
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              جاري التشخيص...
            </>
          ) : (
            'بدء التشخيص'
          )}
        </Button>

        {results.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">نتائج التشخيص:</h3>
            {results.map((result, index) => (
              <Alert key={index} className="text-right">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    {getStatusIcon(result.status)}
                    <span className="mr-2 font-medium">{result.test}</span>
                    {getStatusBadge(result.status)}
                  </div>
                </div>
                <AlertDescription className="mt-2">
                  {result.message}
                  {result.details && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm text-muted-foreground">
                        عرض التفاصيل
                      </summary>
                      <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-auto">
                        {JSON.stringify(result.details, null, 2)}
                      </pre>
                    </details>
                  )}
                </AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        {results.length > 0 && (
          <div className="mt-6 p-4 bg-muted rounded-lg">
            <h4 className="font-semibold mb-2">ملخص النتائج:</h4>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-green-500">
                  {results.filter(r => r.status === 'success').length}
                </div>
                <div className="text-sm text-muted-foreground">نجح</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-yellow-500">
                  {results.filter(r => r.status === 'warning').length}
                </div>
                <div className="text-sm text-muted-foreground">تحذير</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-red-500">
                  {results.filter(r => r.status === 'error').length}
                </div>
                <div className="text-sm text-muted-foreground">فشل</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
