'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, Share2 } from 'lucide-react';
import { db } from '@/config/firebase';
import { collection, query, getDocs } from 'firebase/firestore';
import { createDepartmentSubtasks, hasSubtasks } from '@/services/subtasks';
import { TaskType } from '@/types/task';

interface Department {
  id: string;
  name: string;
}

interface CreateSubtasksDialogProps {
  task: TaskType;
  onSubtasksCreated?: () => void;
}

export function CreateSubtasksDialog({ task, onSubtasksCreated }: CreateSubtasksDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingDepartments, setFetchingDepartments] = useState(false);
  const [hasExistingSubtasks, setHasExistingSubtasks] = useState(false);
  const [checkingSubtasks, setCheckingSubtasks] = useState(false);

  // التحقق من وجود مهام فرعية عند فتح الحوار
  useEffect(() => {
    if (open && task.id) {
      setCheckingSubtasks(true);
      hasSubtasks(task.id)
        .then(result => {
          setHasExistingSubtasks(result);
        })
        .catch(error => {
          console.error('Error checking for subtasks:', error);
        })
        .finally(() => {
          setCheckingSubtasks(false);
        });
    }
  }, [open, task.id]);

  // جلب الأقسام عند فتح الحوار
  useEffect(() => {
    if (open && user && task.organizationId) {
      setFetchingDepartments(true);
      const fetchDepartments = async () => {
        try {
          const departmentsQuery = query(
            collection(db, 'organizations', task.organizationId!, 'departments')
          );
          const snapshot = await getDocs(departmentsQuery);
          const departmentsList: Department[] = [];
          snapshot.forEach((doc) => {
            departmentsList.push({
              id: doc.id,
              name: doc.data().name || 'قسم بدون اسم',
            });
          });
          setDepartments(departmentsList);
        } catch (error) {
          console.error('Error fetching departments:', error);
          toast({
            title: 'خطأ في جلب الأقسام',
            description: 'حدث خطأ أثناء محاولة جلب الأقسام.',
            variant: 'destructive',
          });
        } finally {
          setFetchingDepartments(false);
        }
      };

      fetchDepartments();
    }
  }, [open, user, task.organizationId, toast]);

  // تحديث قائمة الأقسام المحددة
  const handleDepartmentToggle = (departmentId: string) => {
    setSelectedDepartments(prev => {
      if (prev.includes(departmentId)) {
        return prev.filter(id => id !== departmentId);
      } else {
        return [...prev, departmentId];
      }
    });
  };

  // تحديد جميع الأقسام
  const handleSelectAll = () => {
    if (selectedDepartments.length === departments.length) {
      setSelectedDepartments([]);
    } else {
      setSelectedDepartments(departments.map(dept => dept.id));
    }
  };

  // إنشاء المهام الفرعية
  const handleCreateSubtasks = async () => {
    if (!user || !task.id || selectedDepartments.length === 0) {
      toast({
        title: 'خطأ',
        description: 'يرجى تحديد قسم واحد على الأقل.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const createdSubtaskIds = await createDepartmentSubtasks(task.id, selectedDepartments);
      
      toast({
        title: 'تم إنشاء المهام الفرعية',
        description: `تم إنشاء ${createdSubtaskIds.length} مهمة فرعية للأقسام المحددة.`,
      });
      
      setOpen(false);
      setSelectedDepartments([]);
      
      // استدعاء دالة رد الاتصال إذا تم توفيرها
      if (onSubtasksCreated) {
        onSubtasksCreated();
      }
    } catch (error: any) {
      console.error('Error creating subtasks:', error);
      toast({
        title: 'خطأ في إنشاء المهام الفرعية',
        description: error.message || 'حدث خطأ أثناء محاولة إنشاء المهام الفرعية.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // التحقق من صلاحية المهمة لإنشاء مهام فرعية
  const isValidTask = task && task.taskContext === 'organization' && task.organizationId;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-1"
          disabled={!isValidTask}
          title={!isValidTask ? 'يمكن إنشاء مهام فرعية فقط للمهام على مستوى المؤسسة' : 'إنشاء مهام فرعية للأقسام'}
        >
          <Share2 className="h-4 w-4 ml-1" />
          توزيع على الأقسام
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>إنشاء مهام فرعية للأقسام</DialogTitle>
          <DialogDescription>
            سيتم إنشاء نسخة من هذه المهمة لكل قسم محدد، مع الاحتفاظ بجميع التفاصيل ونقاط التتبع.
          </DialogDescription>
        </DialogHeader>
        
        {checkingSubtasks ? (
          <div className="flex justify-center items-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="mr-2">جاري التحقق من المهام الفرعية...</span>
          </div>
        ) : hasExistingSubtasks ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 my-4">
            <p className="text-yellow-800 font-medium">تنبيه</p>
            <p className="text-yellow-700 text-sm">
              هذه المهمة لديها بالفعل مهام فرعية. إنشاء مهام فرعية جديدة سيؤدي إلى وجود مهام فرعية متعددة لنفس المهمة.
            </p>
          </div>
        ) : null}
        
        <div className="py-4">
          <div className="flex items-center justify-between mb-4">
            <Label htmlFor="departments" className="text-base font-medium">الأقسام</Label>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSelectAll}
              disabled={fetchingDepartments || departments.length === 0}
            >
              {selectedDepartments.length === departments.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
            </Button>
          </div>
          
          {fetchingDepartments ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <span className="mr-2">جاري جلب الأقسام...</span>
            </div>
          ) : departments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              لا توجد أقسام في هذه المؤسسة.
            </div>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto p-1">
              {departments.map((department) => (
                <div key={department.id} className="flex items-center space-x-2 space-x-reverse">
                  <Checkbox 
                    id={`department-${department.id}`} 
                    checked={selectedDepartments.includes(department.id)}
                    onCheckedChange={() => handleDepartmentToggle(department.id)}
                  />
                  <Label 
                    htmlFor={`department-${department.id}`}
                    className="flex-1 cursor-pointer"
                  >
                    {department.name}
                  </Label>
                </div>
              ))}
            </div>
          )}
        </div>
        
        <DialogFooter className="sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
          >
            إلغاء
          </Button>
          <Button
            type="button"
            onClick={handleCreateSubtasks}
            disabled={loading || selectedDepartments.length === 0}
          >
            {loading ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                جاري الإنشاء...
              </>
            ) : (
              'إنشاء المهام الفرعية'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
