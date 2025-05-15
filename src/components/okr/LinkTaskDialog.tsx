'use client';

/**
 * مربع حوار ربط مهمة بالنتيجة الرئيسية
 */

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { functions } from '@/config/firebase';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '@/context/AuthContext';
import { useAccountType } from '@/hooks/useAccountType';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { CalendarIcon, Search, Link as LinkIcon, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

interface LinkTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    taskId: string;
    impact: 'low' | 'medium' | 'high';
    notes?: string;
  }) => void;
  keyResultId: string;
  loading: boolean;
}

interface Task {
  id: string;
  title: string;
  status: string;
  dueDate?: { seconds: number; nanoseconds: number };
  assignedTo?: string;
  assigneeName?: string;
}

export function LinkTaskDialog({ open, onOpenChange, onSubmit, keyResultId, loading: submitting }: LinkTaskDialogProps) {
  const { user } = useAuth();
  const { organizationId } = useAccountType();
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [impact, setImpact] = useState<'low' | 'medium' | 'high'>('medium');
  const [notes, setNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  
  // جلب المهام غير المرتبطة
  useEffect(() => {
    if (!open || !organizationId) return;
    
    const fetchTasks = async () => {
      try {
        setLoading(true);
        
        // جلب المهام غير المرتبطة بالنتيجة الرئيسية
        const getUnlinkedTasks = httpsCallable<
          { keyResultId: string; organizationId: string },
          { tasks: Task[] }
        >(functions, 'getUnlinkedTasks');
        
        const result = await getUnlinkedTasks({ keyResultId, organizationId });
        setTasks(result.data.tasks || []);
        setFilteredTasks(result.data.tasks || []);
      } catch (error) {
        console.error('Error fetching unlinked tasks:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTasks();
  }, [open, organizationId, keyResultId]);
  
  // تصفية المهام حسب البحث
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredTasks(tasks);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = tasks.filter(task => 
      task.title.toLowerCase().includes(query) || 
      (task.assigneeName && task.assigneeName.toLowerCase().includes(query))
    );
    
    setFilteredTasks(filtered);
  }, [searchQuery, tasks]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedTaskId) {
      alert('يرجى اختيار مهمة');
      return;
    }
    
    onSubmit({
      taskId: selectedTaskId,
      impact,
      notes: notes || undefined,
    });
  };
  
  const handleReset = () => {
    setSelectedTaskId('');
    setImpact('medium');
    setNotes('');
    setSearchQuery('');
  };
  
  // الحصول على لون حالة المهمة
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'done':
      case 'مكتملة':
        return 'bg-green-100 text-green-800';
      case 'in progress':
      case 'inprogress':
      case 'قيد التنفيذ':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
      case 'معلقة':
        return 'bg-yellow-100 text-yellow-800';
      case 'overdue':
      case 'متأخرة':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={(newOpen) => {
      if (!newOpen) handleReset();
      onOpenChange(newOpen);
    }}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>ربط مهمة بالنتيجة الرئيسية</DialogTitle>
          <DialogDescription>
            اختر مهمة لربطها بهذه النتيجة الرئيسية.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="searchQuery">البحث عن مهمة</Label>
            <div className="relative">
              <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="searchQuery"
                placeholder="ابحث بعنوان المهمة أو اسم المسؤول"
                className="pr-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>اختر مهمة</Label>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="border rounded-lg p-6 text-center">
                <p className="text-muted-foreground">
                  لا توجد مهام متاحة للربط. قد تكون جميع المهام مرتبطة بالفعل بهذه النتيجة الرئيسية.
                </p>
              </div>
            ) : (
              <ScrollArea className="h-60 border rounded-lg">
                <div className="p-2 space-y-2">
                  {filteredTasks.map(task => {
                    const dueDate = task.dueDate ? new Date(task.dueDate.seconds * 1000) : null;
                    const isSelected = selectedTaskId === task.id;
                    
                    return (
                      <div
                        key={task.id}
                        className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                          isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                        }`}
                        onClick={() => setSelectedTaskId(task.id)}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className={`font-medium ${isSelected ? 'text-primary' : ''}`}>
                              {task.title}
                            </h3>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge className={getStatusColor(task.status)}>
                                {task.status}
                              </Badge>
                              
                              {dueDate && (
                                <span className="text-sm text-muted-foreground flex items-center">
                                  <CalendarIcon className="ml-1 h-3 w-3" />
                                  {format(dueDate, 'dd MMM yyyy', { locale: ar })}
                                </span>
                              )}
                              
                              {task.assigneeName && (
                                <span className="text-sm text-muted-foreground">
                                  المسؤول: {task.assigneeName}
                                </span>
                              )}
                            </div>
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
            <Button type="submit" disabled={!selectedTaskId || submitting}>
              {submitting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
              <LinkIcon className="ml-2 h-4 w-4" />
              ربط المهمة
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
