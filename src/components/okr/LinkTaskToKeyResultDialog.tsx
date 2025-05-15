'use client';

/**
 * مربع حوار ربط المهمة بنتيجة رئيسية
 */

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { functions } from '@/config/firebase';
import { httpsCallable } from 'firebase/functions';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Target, Link as LinkIcon, Loader2, CheckCircle, AlertTriangle, Clock } from 'lucide-react';

interface LinkTaskToKeyResultDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    keyResultId: string;
    objectiveId: string;
    impact: 'low' | 'medium' | 'high';
    notes?: string;
  }) => void;
  taskId: string;
  organizationId: string;
}

interface KeyResult {
  id: string;
  title: string;
  objectiveId: string;
  objectiveTitle: string;
  periodId: string;
  progress: number;
  status: 'active' | 'completed' | 'at_risk' | 'behind';
}

export function LinkTaskToKeyResultDialog({ 
  open, 
  onOpenChange, 
  onSubmit, 
  taskId,
  organizationId 
}: LinkTaskToKeyResultDialogProps) {
  const [keyResults, setKeyResults] = useState<KeyResult[]>([]);
  const [filteredKeyResults, setFilteredKeyResults] = useState<KeyResult[]>([]);
  const [selectedKeyResultId, setSelectedKeyResultId] = useState('');
  const [selectedObjectiveId, setSelectedObjectiveId] = useState('');
  const [impact, setImpact] = useState<'low' | 'medium' | 'high'>('medium');
  const [notes, setNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // جلب النتائج الرئيسية غير المرتبطة
  useEffect(() => {
    if (!open || !organizationId) return;
    
    const fetchKeyResults = async () => {
      try {
        setLoading(true);
        
        // جلب النتائج الرئيسية غير المرتبطة بالمهمة
        const getUnlinkedKeyResults = httpsCallable<
          { taskId: string; organizationId: string },
          { keyResults: KeyResult[] }
        >(functions, 'getUnlinkedKeyResults');
        
        const result = await getUnlinkedKeyResults({ taskId, organizationId });
        setKeyResults(result.data.keyResults || []);
        setFilteredKeyResults(result.data.keyResults || []);
      } catch (error) {
        console.error('Error fetching unlinked key results:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchKeyResults();
  }, [open, organizationId, taskId]);
  
  // تصفية النتائج الرئيسية حسب البحث
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredKeyResults(keyResults);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = keyResults.filter(keyResult => 
      keyResult.title.toLowerCase().includes(query) || 
      keyResult.objectiveTitle.toLowerCase().includes(query)
    );
    
    setFilteredKeyResults(filtered);
  }, [searchQuery, keyResults]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedKeyResultId || !selectedObjectiveId) {
      alert('يرجى اختيار نتيجة رئيسية');
      return;
    }
    
    setSubmitting(true);
    
    try {
      await onSubmit({
        keyResultId: selectedKeyResultId,
        objectiveId: selectedObjectiveId,
        impact,
        notes: notes || undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };
  
  const handleReset = () => {
    setSelectedKeyResultId('');
    setSelectedObjectiveId('');
    setImpact('medium');
    setNotes('');
    setSearchQuery('');
  };
  
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
  
  // الحصول على أيقونة حالة النتيجة الرئيسية
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="ml-1 h-3 w-3" />;
      case 'at_risk': return <AlertTriangle className="ml-1 h-3 w-3" />;
      case 'behind': return <Clock className="ml-1 h-3 w-3" />;
      case 'completed': return <CheckCircle className="ml-1 h-3 w-3" />;
      default: return null;
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
  
  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) handleReset();
      onOpenChange(newOpen);
    }}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>ربط المهمة بنتيجة رئيسية</DialogTitle>
          <DialogDescription>
            اختر نتيجة رئيسية لربط المهمة بها.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="searchQuery">البحث عن نتيجة رئيسية</Label>
            <div className="relative">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="searchQuery"
                placeholder="ابحث بعنوان النتيجة الرئيسية أو الهدف"
                className="pr-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>اختر نتيجة رئيسية</Label>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredKeyResults.length === 0 ? (
              <div className="border rounded-lg p-6 text-center">
                <p className="text-muted-foreground">
                  لا توجد نتائج رئيسية متاحة للربط. قد تكون جميع النتائج الرئيسية مرتبطة بالفعل بهذه المهمة.
                </p>
              </div>
            ) : (
              <ScrollArea className="h-60 border rounded-lg">
                <div className="p-2 space-y-2">
                  {filteredKeyResults.map(keyResult => {
                    const isSelected = selectedKeyResultId === keyResult.id;
                    
                    return (
                      <div
                        key={keyResult.id}
                        className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                          isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                        }`}
                        onClick={() => {
                          setSelectedKeyResultId(keyResult.id);
                          setSelectedObjectiveId(keyResult.objectiveId);
                        }}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-1 mb-1">
                              <Badge className={getStatusColor(keyResult.status)}>
                                {getStatusIcon(keyResult.status)}
                                {getStatusText(keyResult.status)}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                {Math.round(keyResult.progress)}% مكتمل
                              </span>
                            </div>
                            
                            <h3 className={`font-medium ${isSelected ? 'text-primary' : ''}`}>
                              {keyResult.title}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              <Target className="inline-block ml-1 h-3 w-3" />
                              {keyResult.objectiveTitle}
                            </p>
                          </div>
                          
                          {isSelected && (
                            <Badge variant="outline" className="bg-primary/10 border-primary/20">
                              <LinkIcon className="ml-1 h-3 w-3" />
                              محدد
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="impact">تأثير المهمة على النتيجة الرئيسية</Label>
            <Select value={impact} onValueChange={(value: 'low' | 'medium' | 'high') => setImpact(value)}>
              <SelectTrigger id="impact">
                <SelectValue placeholder="اختر مستوى التأثير" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">منخفض</SelectItem>
                <SelectItem value="medium">متوسط</SelectItem>
                <SelectItem value="high">عالي</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="notes">ملاحظات (اختياري)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أضف ملاحظات حول هذا الربط"
              rows={3}
            />
          </div>
          
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={!selectedKeyResultId || submitting}>
              {submitting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              <LinkIcon className="ml-2 h-4 w-4" />
              ربط النتيجة الرئيسية
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
