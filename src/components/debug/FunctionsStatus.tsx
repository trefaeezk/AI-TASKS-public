'use client';

import React, { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { functions } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';

interface FunctionStatus {
  name: string;
  available: boolean;
  lastChecked: Date;
  error?: string;
}

export function FunctionsStatus() {
  const [functionsStatus, setFunctionsStatus] = useState<FunctionStatus[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const { user } = useAuth();

  const functionsToCheck = [
    'createUser',
    'updateUserRole', 
    'updateUserPermissions',
    'toggleUserDisabled',
    'listFirebaseUsers',
    'getSystemSettings'
  ];

  const checkFunctionStatus = async (functionName: string): Promise<FunctionStatus> => {
    try {
      if (!functions) {
        return {
          name: functionName,
          available: false,
          lastChecked: new Date(),
          error: 'Functions instance not available'
        };
      }

      // For now, we'll just check if the functions instance exists
      // In a real scenario, you might want to make a test call
      return {
        name: functionName,
        available: true,
        lastChecked: new Date()
      };
    } catch (error: any) {
      return {
        name: functionName,
        available: false,
        lastChecked: new Date(),
        error: error.message
      };
    }
  };

  const checkAllFunctions = async () => {
    setIsChecking(true);
    try {
      const statusPromises = functionsToCheck.map(checkFunctionStatus);
      const statuses = await Promise.all(statusPromises);
      setFunctionsStatus(statuses);
    } catch (error) {
      console.error('Error checking functions status:', error);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkAllFunctions();
    
    // Check status every 30 seconds
    const interval = setInterval(checkAllFunctions, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: FunctionStatus) => {
    if (status.available) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusBadge = (status: FunctionStatus) => {
    return (
      <Badge variant={status.available ? 'default' : 'destructive'}>
        {status.available ? 'متاح' : 'غير متاح'}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>حالة Firebase Functions</span>
          {isChecking && <Loader2 className="h-4 w-4 animate-spin" />}
        </CardTitle>
        <CardDescription>
          حالة الدوال المطلوبة لإدارة المستخدمين
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {functionsStatus.map((status) => (
            <div key={status.name} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center space-x-3 space-x-reverse">
                {getStatusIcon(status)}
                <div>
                  <div className="font-medium">{status.name}</div>
                  <div className="text-sm text-muted-foreground">
                    آخر فحص: {status.lastChecked.toLocaleTimeString('ar-SA')}
                  </div>
                  {status.error && (
                    <div className="text-sm text-red-500">
                      خطأ: {status.error}
                    </div>
                  )}
                </div>
              </div>
              {getStatusBadge(status)}
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-muted rounded-lg">
          <div className="text-sm">
            <div className="font-medium mb-2">معلومات إضافية:</div>
            <div>Functions Instance: {functions ? '✅ متاح' : '❌ غير متاح'}</div>
            <div>User Authenticated: {user ? '✅ مسجل دخول' : '❌ غير مسجل'}</div>
            <div>User UID: {user?.uid || 'غير متاح'}</div>
            <div>Environment: {process.env.NODE_ENV}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
