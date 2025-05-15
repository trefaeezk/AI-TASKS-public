'use client';

/**
 * مربع حوار تحديث تقدم النتيجة الرئيسية
 */

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { BarChart3 } from 'lucide-react';

interface UpdateKeyResultProgressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    newValue: number;
    notes?: string;
  }) => void;
  keyResult: {
    id: string;
    title: string;
    type: 'numeric' | 'percentage' | 'boolean' | 'currency';
    startValue: number;
    targetValue: number;
    currentValue: number;
    unit?: string;
    progress: number;
  };
}

export function UpdateKeyResultProgressDialog({ 
  open, 
  onOpenChange, 
  onSubmit, 
  keyResult 
}: UpdateKeyResultProgressDialogProps) {
  const [newValue, setNewValue] = useState(keyResult.currentValue);
  const [notes, setNotes] = useState('');
  const [calculatedProgress, setCalculatedProgress] = useState(keyResult.progress);
  const [useSlider, setUseSlider] = useState(keyResult.type === 'percentage');
  
  // تحديث القيمة الحالية عند تغيير النتيجة الرئيسية
  useEffect(() => {
    setNewValue(keyResult.currentValue);
    setCalculatedProgress(keyResult.progress);
  }, [keyResult]);
  
  // حساب التقدم عند تغيير القيمة الجديدة
  useEffect(() => {
    const range = keyResult.targetValue - keyResult.startValue;
    const progress = range !== 0
      ? Math.min(100, Math.max(0, ((newValue - keyResult.startValue) / range) * 100))
      : (newValue >= keyResult.targetValue ? 100 : 0);
    
    setCalculatedProgress(progress);
  }, [newValue, keyResult.startValue, keyResult.targetValue]);
  
  // تحديث القيمة الجديدة عند تغيير التقدم (للسلايدر)
  const handleProgressChange = (value: number[]) => {
    const progress = value[0];
    const range = keyResult.targetValue - keyResult.startValue;
    const newVal = keyResult.startValue + (range * (progress / 100));
    
    // تقريب القيمة حسب نوع النتيجة الرئيسية
    if (keyResult.type === 'boolean') {
      setNewValue(progress >= 50 ? 1 : 0);
    } else if (Number.isInteger(keyResult.startValue) && Number.isInteger(keyResult.targetValue)) {
      setNewValue(Math.round(newVal));
    } else {
      // تقريب إلى رقمين عشريين
      setNewValue(Math.round(newVal * 100) / 100);
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // التحقق من القيم حسب نوع النتيجة الرئيسية
    if (keyResult.type === 'boolean' && (newValue < 0 || newValue > 1)) {
      alert('القيمة للنتيجة الرئيسية من نوع نعم/لا يجب أن تكون 0 أو 1 فقط');
      return;
    }
    
    onSubmit({
      newValue: Number(newValue),
      notes: notes || undefined,
    });
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
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) {
        setNewValue(keyResult.currentValue);
        setNotes('');
      }
      onOpenChange(newOpen);
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>تحديث تقدم النتيجة الرئيسية</DialogTitle>
          <DialogDescription>
            قم بتحديث القيمة الحالية للنتيجة الرئيسية وإضافة ملاحظات.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div>
            <h3 className="font-medium mb-2">{keyResult.title}</h3>
            
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">القيمة البدائية: {formatValue(keyResult.startValue, keyResult.type, keyResult.unit)}</span>
              <span className="text-muted-foreground">القيمة المستهدفة: {formatValue(keyResult.targetValue, keyResult.type, keyResult.unit)}</span>
            </div>
            
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium">التقدم</span>
              <span className="font-medium">{Math.round(calculatedProgress)}%</span>
            </div>
            <Progress value={calculatedProgress} className="h-2 mb-4" />
          </div>
          
          {keyResult.type === 'boolean' ? (
            <div className="space-y-2">
              <Label htmlFor="booleanValue">القيمة الحالية</Label>
              <div className="flex items-center justify-between">
                <span>هل تم تحقيق النتيجة؟</span>
                <Switch
                  id="booleanValue"
                  checked={newValue === 1}
                  onCheckedChange={(checked) => setNewValue(checked ? 1 : 0)}
                />
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center space-x-2 space-x-reverse">
                <Switch
                  id="useSlider"
                  checked={useSlider}
                  onCheckedChange={setUseSlider}
                />
                <Label htmlFor="useSlider">استخدام شريط التمرير</Label>
              </div>
              
              {useSlider ? (
                <div className="space-y-2">
                  <Label>تحديث التقدم</Label>
                  <div className="pt-4">
                    <Slider
                      value={[calculatedProgress]}
                      min={0}
                      max={100}
                      step={1}
                      onValueChange={handleProgressChange}
                    />
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>0%</span>
                    <span>50%</span>
                    <span>100%</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="newValue">القيمة الحالية</Label>
                  <div className="flex items-center">
                    <Input
                      id="newValue"
                      type="number"
                      value={newValue}
                      onChange={(e) => setNewValue(Number(e.target.value))}
                      min={keyResult.type === 'percentage' ? 0 : undefined}
                      max={keyResult.type === 'percentage' ? 100 : undefined}
                      step="any"
                      className="flex-1"
                    />
                    {keyResult.unit && (
                      <span className="mr-2">{keyResult.unit}</span>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
          
          <div className="space-y-2">
            <Label htmlFor="notes">ملاحظات (اختياري)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أضف ملاحظات حول هذا التحديث"
              rows={3}
            />
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit">
              <BarChart3 className="ml-2 h-4 w-4" />
              تحديث التقدم
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
