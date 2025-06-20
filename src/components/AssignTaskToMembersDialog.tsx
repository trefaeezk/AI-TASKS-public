
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
import { Loader2, UserPlus } from 'lucide-react';
import { db } from '@/config/firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, setDoc, Timestamp, writeBatch } from 'firebase/firestore';
import { TaskType, Milestone } from '@/types/task';
import { v4 as uuidv4 } from 'uuid';

interface Member {
  uid: string;
  email: string;
  name: string;
}

interface AssignTaskToMembersDialogProps {
  task: TaskType;
  onTaskAssigned?: () => void;
}

export function AssignTaskToMembersDialog({ task, onTaskAssigned }: AssignTaskToMembersDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingMembers, setFetchingMembers] = useState(false);
  const [assignMode, setAssignMode] = useState<'whole-task' | 'milestones'>('whole-task');
  const [milestoneAssignments, setMilestoneAssignments] = useState<Record<string, string>>({});

  // جلب أعضاء القسم عند فتح الحوار
  useEffect(() => {
    if (open && user && task.departmentId && task.organizationId) {
      setFetchingMembers(true);
      const fetchDepartmentMembers = async () => {
        try {
          // جلب أعضاء القسم
          const membersQuery = query(
            collection(db, 'organizations', task.organizationId!, 'members'),
            where('departmentId', '==', task.departmentId)
          );
          const membersSnapshot = await getDocs(membersQuery);
          
          if (membersSnapshot.empty) {
            setMembers([]);
            setFetchingMembers(false);
            return;
          }
          
          // جلب معلومات المستخدمين
          const membersList: Member[] = [];
          
          for (const memberDoc of membersSnapshot.docs) {
            try {
              // جلب معلومات المستخدم من مجموعة users
              const userDoc = await getDoc(doc(db, 'users', memberDoc.id));
              
              if (userDoc.exists()) {
                const userData = userDoc.data();
                membersList.push({
                  uid: memberDoc.id,
                  email: userData.email || 'بدون بريد إلكتروني',
                  name: userData.name || 'عضو بدون اسم',
                });
              } else {
                membersList.push({
                  uid: memberDoc.id,
                  email: 'بدون بريد إلكتروني',
                  name: 'عضو بدون اسم',
                });
              }
            } catch (error) {
              console.error(`Error fetching user details for ${memberDoc.id}:`, error);
            }
          }
          
          setMembers(membersList);
        } catch (error) {
          console.error('Error fetching department members:', error);
          toast({
            title: 'خطأ في جلب أعضاء القسم',
            description: 'حدث خطأ أثناء محاولة جلب أعضاء القسم.',
            variant: 'destructive',
          });
        } finally {
          setFetchingMembers(false);
        }
      };

      fetchDepartmentMembers();
    }
  }, [open, user, task.departmentId, task.organizationId, toast]);

  // تحديث قائمة الأعضاء المحددين
  const handleMemberToggle = (memberId: string) => {
    setSelectedMembers(prev => {
      if (prev.includes(memberId)) {
        return prev.filter(id => id !== memberId);
      } else {
        return [...prev, memberId];
      }
    });
  };

  // تحديد جميع الأعضاء
  const handleSelectAll = () => {
    if (selectedMembers.length === members.length) {
      setSelectedMembers([]);
    } else {
      setSelectedMembers(members.map(member => member.uid));
    }
  };

  // تعيين نقطة تتبع لعضو
  const handleAssignMilestone = (milestoneId: string, memberId: string) => {
    setMilestoneAssignments(prev => ({
      ...prev,
      [milestoneId]: memberId
    }));
  };

  // تعيين المهمة للأعضاء المحددين
  const handleAssignTask = async () => {
    if (!user || !task.id) {
      toast({
        title: 'خطأ',
        description: 'بيانات المهمة أو المستخدم غير متوفرة.',
        variant: 'destructive',
      });
      return;
    }

    if (assignMode === 'whole-task' && selectedMembers.length === 0) {
      toast({
        title: 'خطأ',
        description: 'يرجى تحديد عضو واحد على الأقل.',
        variant: 'destructive',
      });
      return;
    }

    if (assignMode === 'milestones' && Object.keys(milestoneAssignments).length === 0) {
      toast({
        title: 'خطأ',
        description: 'يرجى تعيين نقطة تتبع واحدة على الأقل.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const taskRef = doc(db, 'tasks', task.id);
      const taskDocSnap = await getDoc(taskRef);
      
      if (!taskDocSnap.exists()) { 
        throw new Error('المهمة الأصلية غير موجودة');
      }
      const taskData = taskDocSnap.data();

      if (assignMode === 'whole-task') {
        // **التعديل هنا: تحديث المهمة الأصلية مباشرة**
        await updateDoc(taskRef, {
          assignedToUserIds: selectedMembers,
          assignedToUserId: null, // مسح التعيين الفردي إذا كان هناك تعيين جماعي
          updatedAt: Timestamp.now(),
        });
        console.log(`Original task ${task.id} updated with multiple assignees.`);
      } else { // assignMode === 'milestones'
        const milestones = taskData.milestones || [];
        
        const updatedMilestones = milestones.map((milestone: any) => {
          if (milestoneAssignments[milestone.id]) {
            return {
              ...milestone,
              assignedToUserId: milestoneAssignments[milestone.id]
            };
          }
          return milestone;
        });
        
        await updateDoc(taskRef, {
          milestones: updatedMilestones,
          updatedAt: Timestamp.now()
        });
        console.log(`Milestones for task ${task.id} updated with individual assignees.`);
      }
      
      toast({
        title: 'تم تعيين المهمة',
        description: assignMode === 'whole-task' 
          ? `تم تحديث المهمة الأصلية وتعيينها لـ ${selectedMembers.length} عضو.`
          : 'تم تعيين نقاط التتبع للأعضاء المحددين في المهمة الأصلية.',
      });
      
      setOpen(false);
      setSelectedMembers([]);
      setMilestoneAssignments({});
      
      if (onTaskAssigned) {
        onTaskAssigned();
      }
    } catch (error: any) {
      console.error('Error assigning task:', error);
      toast({
        title: 'خطأ في تعيين المهمة',
        description: error.message || 'حدث خطأ أثناء محاولة تعيين المهمة.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  // التحقق من صلاحية المهمة للتعيين (يمكن تعيين مهام القسم لأعضائه)
  const isValidTaskForAssignment = task && task.taskContext === 'department' && task.departmentId;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className="gap-1"
          disabled={!isValidTaskForAssignment}
          title={!isValidTaskForAssignment ? 'يمكن تعيين المهام فقط لأعضاء القسم من مهام القسم' : 'تعيين المهمة لأعضاء القسم'}
        >
          <UserPlus className="h-4 w-4 ml-1" />
          تعيين للأعضاء
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>تعيين المهمة لأعضاء القسم</DialogTitle>
          <DialogDescription>
            {assignMode === 'whole-task' 
              ? 'اختر الأعضاء لتعيين المهمة الأصلية لهم.'
              : 'اختر عضوًا لكل نقطة تتبع في المهمة الأصلية.'
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4">
          <div className="space-y-4">
            <div>
              <Label htmlFor="assign-mode">طريقة التعيين</Label>
              <Select
                value={assignMode}
                onValueChange={(value) => setAssignMode(value as 'whole-task' | 'milestones')}
              >
                <SelectTrigger id="assign-mode">
                  <SelectValue placeholder="اختر طريقة التعيين" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whole-task">تعيين المهمة بالكامل</SelectItem>
                  <SelectItem value="milestones">تعيين نقاط تتبع محددة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {assignMode === 'whole-task' ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <Label htmlFor="members" className="text-base font-medium">أعضاء القسم</Label>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleSelectAll}
                    disabled={fetchingMembers || members.length === 0}
                  >
                    {selectedMembers.length === members.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                  </Button>
                </div>
                
                {fetchingMembers ? (
                  <div className="flex justify-center items-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    <span className="mr-2">جاري جلب الأعضاء...</span>
                  </div>
                ) : members.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    لا يوجد أعضاء في هذا القسم.
                  </div>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto p-1">
                    {members.map((member) => (
                      <div key={member.uid} className="flex items-center space-x-2 space-x-reverse">
                        <Checkbox 
                          id={`member-${member.uid}`} 
                          checked={selectedMembers.includes(member.uid)}
                          onCheckedChange={() => handleMemberToggle(member.uid)}
                        />
                        <Label 
                          htmlFor={`member-${member.uid}`}
                          className="flex-1 cursor-pointer"
                        >
                          {member.name} ({member.email})
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="mb-4">
                  <Label className="text-base font-medium">نقاط التتبع</Label>
                </div>
                
                {!task.milestones || task.milestones.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    لا توجد نقاط تتبع لهذه المهمة.
                  </div>
                ) : (
                  <div className="space-y-4 max-h-60 overflow-y-auto p-1">
                    {task.milestones.map((milestone) => (
                      <div key={milestone.id} className="border p-3 rounded-md">
                        <div className="font-medium mb-2">{milestone.description}</div>
                        <div>
                          <Label htmlFor={`milestone-${milestone.id}`}>تعيين إلى</Label>
                          <Select
                            value={milestoneAssignments[milestone.id] || ''}
                            onValueChange={(value) => handleAssignMilestone(milestone.id, value)}
                          >
                            <SelectTrigger id={`milestone-${milestone.id}`}>
                              <SelectValue placeholder="اختر عضو" />
                            </SelectTrigger>
                            <SelectContent>
                              {members.map((member) => (
                                <SelectItem key={member.uid} value={member.uid}>
                                  {member.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
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
            onClick={handleAssignTask}
            disabled={loading || (assignMode === 'whole-task' && selectedMembers.length === 0) || (assignMode === 'milestones' && Object.keys(milestoneAssignments).length === 0)}
          >
            {loading ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                جاري التعيين...
              </>
            ) : (
              'تعيين المهمة'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
