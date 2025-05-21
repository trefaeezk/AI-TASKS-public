
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { Milestone, TaskStatus } from '@/types/task'; // Added TaskStatus
import { MilestoneItem } from './MilestoneItem';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Save, Loader2, Wand2, AlertTriangle, Percent, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  suggestMilestones,
  suggestMilestoneWeights,
  suggestMilestoneDueDates,
  type SuggestMilestonesInput,
  type SuggestMilestonesOutput,
  type SuggestMilestoneWeightsInput,
  type SuggestMilestoneWeightsOutput,
  type SuggestMilestoneDueDatesInput,
  type SuggestMilestoneDueDatesOutput
} from '@/services/ai';

interface MilestoneTrackerProps {
  taskId: string;
  taskDescription: string;
  taskDetails?: string;
  initialMilestones?: Milestone[];
  onMilestonesChange: (milestones: Milestone[]) => void;
  parentTaskStatus?: TaskStatus; // Added parentTaskStatus
}

export function MilestoneTracker({
  taskId,
  taskDescription,
  taskDetails,
  initialMilestones = [],
  onMilestonesChange,
  parentTaskStatus, // Destructure parentTaskStatus
}: MilestoneTrackerProps) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [isSuggestingMilestones, setIsSuggestingMilestones] = useState(false);
  const [isSuggestingWeights, setIsSuggestingWeights] = useState(false);
  const [isSuggestingDueDates, setIsSuggestingDueDates] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const safeInitialMilestones = Array.isArray(initialMilestones) ? initialMilestones : [];

    const deepCopyWithDates = safeInitialMilestones.map(milestone => {
      const copy = { ...milestone };
      if (milestone.dueDate instanceof Date && !isNaN(milestone.dueDate.getTime())) {
        copy.dueDate = new Date(milestone.dueDate.getTime());
      } else if (milestone.dueDate) {
        copy.dueDate = undefined;
      }
      return copy;
    });

    setMilestones(deepCopyWithDates);
  }, [initialMilestones, taskId]);

  const calculateProgress = () => {
      if (!Array.isArray(milestones) || milestones.length === 0) return 0;
      const currentTotalWeight = milestones.reduce((sum, m) => sum + (m.weight || 0), 0);
      if (currentTotalWeight === 0) return 0;
      const completedWeight = milestones.reduce((sum, m) => sum + (m.completed ? (m.weight || 0) : 0), 0);
       return currentTotalWeight > 0 ? Math.round((completedWeight / currentTotalWeight) * 100) : 0;
  };

  const progress = calculateProgress();

  const getCurrentTotalWeight = () => {
       if (!Array.isArray(milestones)) return 0;
      return milestones.reduce((sum, m) => sum + (m.weight || 0), 0);
  }

  const handleAddMilestone = () => {
     if (!isEditing) setIsEditing(true);
    const newMilestone: Milestone = {
      id: uuidv4(),
      description: '',
      completed: false,
      weight: 0,
      dueDate: undefined,
    };
    const currentMilestonesArray = Array.isArray(milestones) ? milestones : [];
    const updatedMilestones = [...currentMilestonesArray, newMilestone];
    console.log(`[MilestoneTracker ${taskId}] Added new milestone`, newMilestone.id);
    setMilestones(updatedMilestones);
    onMilestonesChange(updatedMilestones);
  };

  const handleToggleComplete = (id: string, completed: boolean) => {
    if (!Array.isArray(milestones)) return;
    const updatedMilestones = milestones.map(m =>
      m.id === id ? { ...m, completed } : m
    );
    console.log(`[MilestoneTracker ${taskId}] Toggled complete for ${id} to ${completed}`);
    setMilestones(updatedMilestones);
    onMilestonesChange(updatedMilestones);
  };

  const handleDescriptionChange = (id: string, description: string) => {
       if (!Array.isArray(milestones)) return;
      const updatedMilestones = milestones.map(m =>
          m.id === id ? { ...m, description } : m
      );
      setMilestones(updatedMilestones);
      onMilestonesChange(updatedMilestones);
  };

  const handleWeightChange = (id: string, weight: number) => {
       if (!Array.isArray(milestones)) return;
      const updatedMilestones = milestones.map(m =>
          m.id === id ? { ...m, weight } : m
      );
       console.log(`[MilestoneTracker ${taskId}] Changed weight for ${id} to ${weight}`);
      setMilestones(updatedMilestones);
      onMilestonesChange(updatedMilestones);
  };

  const handleDueDateChange = (id: string, date: Date | undefined) => {
      if (!Array.isArray(milestones)) return;
      let dateCopy: Date | undefined = undefined;
      if (date instanceof Date && !isNaN(date.getTime())) {
          dateCopy = new Date(date.getTime());
      }
      const updatedMilestones = milestones.map(m =>
          m.id === id ? { ...m, dueDate: dateCopy } : m
      );
      setMilestones(updatedMilestones);
      onMilestonesChange(updatedMilestones);
  };

  const handleDeleteMilestone = (id: string) => {
     if (!Array.isArray(milestones)) return;
    const updatedMilestones = milestones.filter(m => m.id !== id);
     console.log(`[MilestoneTracker ${taskId}] Deleted milestone ${id}`);
    setMilestones(updatedMilestones);
    onMilestonesChange(updatedMilestones);
  };

   const handleSuggestMilestones = useCallback(async () => {
       if (!taskDescription) {
           toast({ title: 'خطأ', description: 'وصف المهمة مطلوب لاقتراح نقاط التتبع.', variant: 'destructive' });
           return;
       }
        console.log(`[MilestoneTracker ${taskId}] Requesting milestone suggestions...`);
       setIsSuggestingMilestones(true);
       try {
           const input: SuggestMilestonesInput = { taskDescription, taskDetails };
           const result: SuggestMilestonesOutput = await suggestMilestones(input);
            console.log(`[MilestoneTracker ${taskId}] AI Suggest Milestones Result:`, result);

           if (result.suggestedMilestones && result.suggestedMilestones.length > 0) {
               const suggested = result.suggestedMilestones.map(desc => ({
                   id: uuidv4(),
                   description: desc,
                   completed: false,
                   weight: 0,
                   dueDate: undefined,
               }));
                setMilestones(suggested);
                setIsEditing(true);
                toast({ title: 'تم اقتراح نقاط تتبع جديدة', description: 'تم استبدال النقاط الحالية. يمكنك الآن تعديل النقاط وتوزيع الأوزان.' });
                onMilestonesChange(suggested);
           } else {
                setMilestones([]);
                onMilestonesChange([]);
               toast({ title: 'لم يتم العثور على اقتراحات', description: 'لم يتمكن الذكاء الاصطناعي من اقتراح نقاط تتبع.' });
           }
       } catch (error) {
           console.error("Error suggesting milestones:", error);
           toast({ title: 'خطأ في الاقتراح', description: 'حدث خطأ أثناء اقتراح نقاط التتبع.', variant: 'destructive' });
       } finally {
           setIsSuggestingMilestones(false);
       }
   }, [taskId, taskDescription, taskDetails, toast, onMilestonesChange]);

    const handleSuggestWeights = useCallback(async () => {
         if (!Array.isArray(milestones) || milestones.length === 0) {
            toast({ title: 'لا توجد نقاط تتبع', description: 'أضف نقاط تتبع أولاً لاقتراح الأوزان.', variant: 'default' });
            return;
        }
        console.log(`[MilestoneTracker ${taskId}] Requesting weight suggestions...`);
        setIsSuggestingWeights(true);
        try {
            const milestonesToWeight = milestones
                .filter(m => m.description.trim() !== '')
                .map(m => ({ id: m.id, description: m.description }));

            if (milestonesToWeight.length === 0) {
                toast({ title: 'نقاط تتبع فارغة', description: 'يرجى إضافة وصف لنقاط التتبع قبل اقتراح الأوزان.', variant: 'default' });
                setIsSuggestingWeights(false);
                return;
            }

            const input: SuggestMilestoneWeightsInput = {
                taskDescription,
                taskDetails,
                milestones: milestonesToWeight,
            };

            const result: SuggestMilestoneWeightsOutput = await suggestMilestoneWeights(input);
            console.log(`[MilestoneTracker ${taskId}] AI Suggest Weights Result:`, result);

            if (result.weightedMilestones && result.weightedMilestones.length > 0) {
                 const suggestedWeightMap = new Map(result.weightedMilestones.map(m => [m.id, m.weight]));
                 const updatedMilestones = milestones.map(m => ({
                     ...m,
                     weight: suggestedWeightMap.get(m.id) ?? m.weight ?? 0,
                 }));
                 setMilestones(updatedMilestones);
                 setIsEditing(true);
                toast({ title: 'تم اقتراح الأوزان', description: 'تم توزيع 100% على نقاط التتبع. يمكنك تعديلها إذا لزم الأمر.' });
                 onMilestonesChange(updatedMilestones);
            } else {
                toast({ title: 'لم يتم العثور على اقتراحات', description: 'لم يتمكن الذكاء الاصطناعي من اقتراح الأوزان.' });
            }
        } catch (error: any) {
            console.error("Error suggesting milestone weights:", error);
            toast({ title: 'خطأ في اقتراح الأوزان', description: error.message || 'حدث خطأ أثناء اقتراح الأوزان.', variant: 'destructive' });
        } finally {
            setIsSuggestingWeights(false);
        }
    }, [taskId, milestones, taskDescription, taskDetails, toast, onMilestonesChange]);

    const handleSuggestDueDates = useCallback(async () => {
        if (!Array.isArray(milestones) || milestones.length === 0) {
            toast({ title: 'لا توجد نقاط تتبع', description: 'أضف نقاط تتبع أولاً لاقتراح تواريخ الاستحقاق.', variant: 'default' });
            return;
        }

        const milestonesWithoutWeights = milestones.filter(m => m.description.trim() !== '' && (!m.weight || m.weight === 0));
        if (milestonesWithoutWeights.length > 0) {
            toast({
                title: 'أوزان غير مكتملة',
                description: 'يجب تعيين أوزان لجميع نقاط التتبع قبل اقتراح تواريخ الاستحقاق.',
                variant: 'destructive'
            });
            return;
        }

        console.log(`[MilestoneTracker ${taskId}] Requesting due date suggestions...`);
        setIsSuggestingDueDates(true);

        try {
            const milestonesToSchedule = milestones
                .filter(m => m.description.trim() !== '')
                .map(m => ({
                    id: m.id,
                    description: m.description,
                    weight: m.weight || 0
                }));

            let taskStartDate: string | undefined = undefined;
            let taskDueDate: string | undefined = undefined;

            const startDateElement = document.getElementById('edit-start-date') || document.getElementById('task-start-date');
            const dueDateElement = document.getElementById('edit-due-date') || document.getElementById('task-due-date');

            if (startDateElement && startDateElement.textContent && !startDateElement.textContent.includes('اختر تاريخًا')) {
                try {
                    const dateText = startDateElement.textContent.trim();
                    const date = new Date(dateText);
                    if (!isNaN(date.getTime())) {
                        taskStartDate = format(date, 'yyyy-MM-dd');
                    }
                } catch (error) {
                    console.error("Error parsing start date:", error);
                }
            }

            if (dueDateElement && dueDateElement.textContent && !dueDateElement.textContent.includes('اختر تاريخًا')) {
                try {
                    const dateText = dueDateElement.textContent.trim();
                    const date = new Date(dateText);
                    if (!isNaN(date.getTime())) {
                        taskDueDate = format(date, 'yyyy-MM-dd');
                    }
                } catch (error) {
                    console.error("Error parsing due date:", error);
                }
            }

            const input: SuggestMilestoneDueDatesInput = {
                taskDescription,
                taskDetails,
                taskStartDate,
                taskDueDate,
                milestones: milestonesToSchedule
            };

            const result: SuggestMilestoneDueDatesOutput = await suggestMilestoneDueDates(input);
            console.log(`[MilestoneTracker ${taskId}] AI Suggest Due Dates Result:`, result);

            if (result.milestonesWithDueDates && result.milestonesWithDueDates.length > 0) {
                const suggestedDueDateMap = new Map(
                    result.milestonesWithDueDates.map(m => [
                        m.id,
                        {
                            date: parseISO(m.dueDate),
                            reasoning: m.reasoning || ''
                        }
                    ])
                );

                const updatedMilestones = milestones.map(m => {
                    const suggestion = suggestedDueDateMap.get(m.id);
                    if (suggestion && !isNaN(suggestion.date.getTime())) {
                        return {
                            ...m,
                            dueDate: suggestion.date
                        };
                    }
                    return m;
                });

                setMilestones(updatedMilestones);
                setIsEditing(true);

                const firstSuggestion = result.milestonesWithDueDates[0];
                const message = firstSuggestion ?
                    `مثال: "${firstSuggestion.dueDate}" لـ "${milestones.find(m => m.id === firstSuggestion.id)?.description}". السبب: ${firstSuggestion.reasoning || ''}` :
                    'تم توزيع التواريخ بناءً على أوزان نقاط التتبع والإطار الزمني للمهمة.';

                toast({
                    title: 'تم اقتراح تواريخ الاستحقاق',
                    description: message,
                    duration: 5000
                });

                onMilestonesChange(updatedMilestones);
            } else {
                toast({
                    title: 'لم يتم العثور على اقتراحات',
                    description: 'لم يتمكن الذكاء الاصطناعي من اقتراح تواريخ استحقاق.'
                });
            }
        } catch (error: any) {
            console.error("Error suggesting milestone due dates:", error);
            toast({
                title: 'خطأ في اقتراح تواريخ الاستحقاق',
                description: error.message || 'حدث خطأ أثناء اقتراح تواريخ الاستحقاق.',
                variant: 'destructive'
            });
        } finally {
            setIsSuggestingDueDates(false);
        }
    }, [taskId, milestones, taskDescription, taskDetails, toast, onMilestonesChange]);

  const handleEditToggle = () => {
      if (isEditing) {
            if (!Array.isArray(milestones)) return;
          const validMilestones = milestones.filter(m => m.description.trim() !== '');
          const currentTotalWeight = validMilestones.reduce((sum, m) => sum + (m.weight || 0), 0);
          console.log(`[MilestoneTracker ${taskId}] Exiting edit mode. Current total weight: ${currentTotalWeight}`);
          if (validMilestones.length > 0 && currentTotalWeight !== 100) {
                toast({
                    title: 'تحذير: الأوزان غير صحيحة',
                    description: `مجموع أوزان نقاط التتبع هو ${currentTotalWeight}%. يجب أن يكون المجموع 100% للخروج من وضع التعديل.`,
                    variant: 'destructive',
                    duration: 5000,
                });
                return;
          }
          const finalMilestones = milestones.filter(m => m.description.trim() !== '');
          setMilestones(finalMilestones);
          onMilestonesChange(finalMilestones);
          setIsEditing(false);
      } else {
           console.log(`[MilestoneTracker ${taskId}] Entering edit mode.`);
          setIsEditing(true);
      }
  };

   const currentMilestonesArray = Array.isArray(milestones) ? milestones : [];

  return (
     <div className="space-y-2 pt-3 border-t border-muted/30 mt-3">
      <div className="flex justify-between items-center mb-1 gap-1 flex-wrap">
         <h4 className="text-sm font-medium text-muted-foreground/80">
             نقاط التتبع ({currentMilestonesArray.filter(m => m.description.trim()).length})
         </h4>
        <div className="flex gap-1">
             <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-1.5 text-xs text-primary hover:bg-primary/10"
                onClick={handleSuggestMilestones}
                disabled={isSuggestingMilestones || isEditing || isSuggestingWeights || isSuggestingDueDates || !taskDescription?.trim()}
                aria-label="اقترح نقاط تتبع بالذكاء الاصطناعي"
            >
                 {isSuggestingMilestones ? <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" /> : <Wand2 className="h-3.5 w-3.5 ml-1" />}
                 اقترح نقاط
            </Button>

            {isEditing && (
                <>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-1.5 text-xs text-primary hover:bg-primary/10"
                        onClick={handleSuggestWeights}
                        disabled={isSuggestingWeights || isSuggestingMilestones || isSuggestingDueDates || currentMilestonesArray.length === 0}
                        aria-label="اقترح أوزان نقاط التتبع بالذكاء الاصطناعي"
                    >
                        {isSuggestingWeights ? <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" /> : <Percent className="h-3.5 w-3.5 ml-1" />}
                        اقترح أوزان
                    </Button>

                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-1.5 text-xs text-primary hover:bg-primary/10"
                        onClick={handleSuggestDueDates}
                        disabled={isSuggestingDueDates || isSuggestingMilestones || isSuggestingWeights || currentMilestonesArray.length === 0}
                        aria-label="اقترح تواريخ استحقاق لنقاط التتبع بالذكاء الاصطناعي"
                    >
                        {isSuggestingDueDates ? <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" /> : <Calendar className="h-3.5 w-3.5 ml-1" />}
                        اقترح تواريخ
                    </Button>
                </>
            )}

             { (currentMilestonesArray.length > 0 || isEditing) && (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-1.5 text-xs text-muted-foreground hover:bg-accent"
                    onClick={handleEditToggle}
                    disabled={isSuggestingMilestones || isSuggestingWeights || isSuggestingDueDates}
                    aria-label={isEditing ? 'تأكيد نقاط التتبع' : 'تعديل نقاط التتبع'}
                >
                    {isEditing ? <Save className="h-3.5 w-3.5 ml-1" /> : <Edit className="h-3.5 w-3.5 ml-1" />}
                    {isEditing ? 'تأكيد' : 'تعديل'}
                </Button>
            )}
        </div>
      </div>

       {!isEditing && currentMilestonesArray.length > 0 && (
         <div className='py-1 mb-2'>
            <Progress value={progress} className="h-1.5" />
           <p className='text-xs text-muted-foreground text-center mt-1.5'>التقدم: {progress}%</p>
         </div>
       )}

       {isEditing && currentMilestonesArray.length > 0 && (
             <div className={cn(
                "text-xs flex items-center gap-1 p-1.5 rounded-md mb-2 border",
                 getCurrentTotalWeight() === 100 ? "text-muted-foreground bg-muted/30 border-muted/50" : "text-destructive bg-destructive/10 border-destructive/30"
            )}>
                 {getCurrentTotalWeight() !== 100 && <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />}
                 <span className='flex-grow'>مجموع الأوزان الحالي: {getCurrentTotalWeight()}%.</span>
                 {getCurrentTotalWeight() !== 100 && <span className='font-medium'>(يجب أن يكون 100%)</span>}
            </div>
        )}

        <ScrollArea className="max-h-48 min-h-[50px] overflow-y-auto pr-2">
          <div className="space-y-1">
            {currentMilestonesArray.map(milestone => (
              <MilestoneItem
                key={milestone.id}
                milestone={milestone}
                isEditing={isEditing}
                onToggleComplete={handleToggleComplete}
                onDescriptionChange={handleDescriptionChange}
                onWeightChange={handleWeightChange}
                onDueDateChange={handleDueDateChange}
                onDelete={handleDeleteMilestone}
                parentTaskStatus={parentTaskStatus} // Pass down parentTaskStatus
              />
            ))}
             {currentMilestonesArray.length === 0 && !isEditing && (
                 <p className="text-xs text-muted-foreground text-center py-3">لا توجد نقاط تتبع لهذه المهمة.</p>
             )}
          </div>
          <ScrollBar orientation="vertical" />
        </ScrollArea>

      {isEditing && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs border-dashed mt-2 text-muted-foreground hover:text-primary hover:border-primary"
          onClick={handleAddMilestone}
        >
          <PlusCircle className="h-3.5 w-3.5 ml-1" />
          إضافة نقطة تتبع
        </Button>
      )}
    </div>
  );
}
