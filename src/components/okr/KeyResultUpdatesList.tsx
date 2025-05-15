'use client';

/**
 * مكون قائمة تحديثات النتيجة الرئيسية
 * 
 * يعرض هذا المكون قائمة بتحديثات النتيجة الرئيسية.
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { History, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface KeyResultUpdatesListProps {
  updates: {
    id: string;
    keyResultId: string;
    previousValue: number;
    newValue: number;
    notes?: string;
    date: { seconds: number; nanoseconds: number };
    userId: string;
    userName: string;
  }[];
  keyResult: {
    type: 'numeric' | 'percentage' | 'boolean' | 'currency';
    unit?: string;
  };
}

export function KeyResultUpdatesList({ updates, keyResult }: KeyResultUpdatesListProps) {
  // تنسيق القيمة حسب نوع النتيجة الرئيسية
  const formatValue = (value: number, type: string, unit?: string) => {
    switch (type) {
      case 'percentage':
        return `${value}%`;
      case 'currency':
        return `${value} ${unit || ''}`;
      case 'boolean':
        return value === 1 ? 'نعم' : 'لا';
      default:
        return `${value} ${unit || ''}`;
    }
  };
  
  // الحصول على أيقونة التغيير
  const getChangeIcon = (previousValue: number, newValue: number) => {
    if (newValue > previousValue) {
      return <TrendingUp className="h-5 w-5 text-green-500" />;
    } else if (newValue < previousValue) {
      return <TrendingDown className="h-5 w-5 text-red-500" />;
    } else {
      return <Minus className="h-5 w-5 text-gray-500" />;
    }
  };
  
  // حساب نسبة التغيير
  const calculateChangePercentage = (previousValue: number, newValue: number) => {
    if (previousValue === 0) {
      return newValue > 0 ? 100 : 0;
    }
    
    return ((newValue - previousValue) / Math.abs(previousValue)) * 100;
  };
  
  if (updates.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <History className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
          <h2 className="text-xl font-semibold mb-2">لا توجد تحديثات</h2>
          <p className="text-muted-foreground">
            لم يتم تسجيل أي تحديثات لهذه النتيجة الرئيسية بعد.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">تاريخ التحديثات</CardTitle>
          <CardDescription>
            سجل تحديثات القيمة الحالية للنتيجة الرئيسية
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {updates.map((update) => {
              const updateDate = new Date(update.date.seconds * 1000);
              const changePercentage = calculateChangePercentage(update.previousValue, update.newValue);
              const isPositiveChange = update.newValue > update.previousValue;
              const isNoChange = update.newValue === update.previousValue;
              
              return (
                <div key={update.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center">
                      <History className="ml-2 h-5 w-5 text-primary" />
                      <div>
                        <p className="font-medium">{update.userName}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(updateDate, 'dd MMMM yyyy - HH:mm', { locale: ar })}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center">
                      {getChangeIcon(update.previousValue, update.newValue)}
                      <span className={`mr-1 font-medium ${
                        isNoChange ? 'text-gray-500' : (isPositiveChange ? 'text-green-500' : 'text-red-500')
                      }`}>
                        {isNoChange ? 'لا تغيير' : (
                          `${isPositiveChange ? '+' : ''}${Math.round(changePercentage)}%`
                        )}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center p-2 bg-muted rounded-md mb-2">
                    <div>
                      <p className="text-sm text-muted-foreground">القيمة السابقة</p>
                      <p className="font-medium">
                        {formatValue(update.previousValue, keyResult.type, keyResult.unit)}
                      </p>
                    </div>
                    
                    <div className="text-center">
                      <div className="w-8 h-8 flex items-center justify-center">
                        {getChangeIcon(update.previousValue, update.newValue)}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">القيمة الجديدة</p>
                      <p className="font-medium">
                        {formatValue(update.newValue, keyResult.type, keyResult.unit)}
                      </p>
                    </div>
                  </div>
                  
                  {update.notes && (
                    <div className="mt-2">
                      <p className="text-sm text-muted-foreground">ملاحظات:</p>
                      <p className="text-sm">{update.notes}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
