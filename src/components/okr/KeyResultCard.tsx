'use client';

/**
 * مكون بطاقة النتيجة الرئيسية
 * 
 * يعرض هذا المكون بطاقة تحتوي على معلومات النتيجة الرئيسية.
 */

import React from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { CalendarIcon, Edit, ArrowRight, Users } from 'lucide-react';

interface KeyResultProps {
  keyResult: {
    id: string;
    title: string;
    description?: string;
    type: 'numeric' | 'percentage' | 'boolean' | 'currency';
    startValue: number;
    targetValue: number;
    currentValue: number;
    unit?: string;
    progress: number;
    status: 'active' | 'completed' | 'at_risk' | 'behind';
    dueDate: { seconds: number; nanoseconds: number };
    ownerId: string;
    ownerName: string;
  };
  canEdit: boolean;
  onUpdate: () => void;
  onClick: () => void;
}

export function KeyResultCard({ keyResult, canEdit, onUpdate, onClick }: KeyResultProps) {
  // تحويل التاريخ من Firestore Timestamp إلى Date
  const dueDate = new Date(keyResult.dueDate.seconds * 1000);
  
  // الحصول على لون حالة النتيجة الرئيسية
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'at_risk': return 'bg-yellow-100 text-yellow-800';
      case 'behind': return 'bg-red-100 text-red-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };
  
  // الحصول على نص حالة النتيجة الرئيسية
  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'نشطة';
      case 'at_risk': return 'في خطر';
      case 'behind': return 'متأخرة';
      case 'completed': return 'مكتملة';
      default: return status;
    }
  };
  
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
  
  return (
    <Card className="overflow-hidden transition-all hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">{keyResult.title}</CardTitle>
          <Badge className={getStatusColor(keyResult.status)}>
            {getStatusText(keyResult.status)}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="pb-2">
        {keyResult.description && (
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
            {keyResult.description}
          </p>
        )}
        
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center text-sm text-muted-foreground">
            <Users className="ml-1 h-4 w-4" />
            <span>{keyResult.ownerName}</span>
          </div>
          
          <div className="flex items-center text-sm text-muted-foreground">
            <CalendarIcon className="ml-1 h-4 w-4" />
            <span>{format(dueDate, 'dd MMM yyyy', { locale: ar })}</span>
          </div>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">التقدم</span>
            <span className="font-medium">{Math.round(keyResult.progress)}%</span>
          </div>
          <Progress value={keyResult.progress} className="h-2" />
          
          <div className="flex justify-between text-sm mt-2">
            <span className="text-muted-foreground">القيمة الحالية</span>
            <span className="font-medium">
              {formatValue(keyResult.currentValue, keyResult.type, keyResult.unit)}
            </span>
          </div>
          
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">القيمة المستهدفة</span>
            <span className="font-medium">
              {formatValue(keyResult.targetValue, keyResult.type, keyResult.unit)}
            </span>
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="pt-2">
        <div className="flex justify-between w-full">
          {canEdit && (
            <Button variant="outline" size="sm" onClick={onUpdate}>
              <Edit className="ml-2 h-4 w-4" />
              تحديث
            </Button>
          )}
          
          <Button variant="ghost" size="sm" className="mr-auto" onClick={onClick}>
            التفاصيل
            <ArrowRight className="mr-2 h-4 w-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
