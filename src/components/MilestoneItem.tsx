
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import type { Milestone, TaskStatus } from '@/types/task';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2, GripVertical, Check, Calendar as CalendarIcon, Percent } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';

interface MilestoneItemProps {
  milestone: Milestone;
  isEditing: boolean;
  onToggleComplete: (id: string, completed: boolean) => void;
  onDescriptionChange: (id: string, description: string) => void;
  onWeightChange: (id: string, weight: number) => void;
  onDueDateChange: (id: string, date: Date | undefined) => void;
  onDelete: (id: string) => void;
  dragHandleProps?: any;
  parentTaskStatus?: TaskStatus;
}

export function MilestoneItem({
  milestone,
  isEditing,
  onToggleComplete,
  onDescriptionChange,
  onWeightChange,
  onDueDateChange,
  onDelete,
  dragHandleProps,
  parentTaskStatus,
}: MilestoneItemProps) {
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [pickerDate, setPickerDate] = useState<Date | undefined>(undefined);

    useEffect(() => {
        let initialDate: Date | undefined = undefined;
        if (milestone.dueDate) {
            try {
                // Ensure milestone.dueDate is treated as a Date object or a string that can be parsed
                const dateInput = milestone.dueDate instanceof Date ? milestone.dueDate : new Date(milestone.dueDate);
                if (!isNaN(dateInput.getTime())) {
                    initialDate = dateInput;
                }
            } catch (e) {
                console.error(`[MilestoneItem ${milestone.id}] Error parsing initial dueDate:`, e, "Value:", milestone.dueDate);
            }
        }
        setPickerDate(initialDate);
    }, [milestone.dueDate, milestone.id]);

    const handleWeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let value = parseInt(e.target.value);
        if (isNaN(value) || value < 0) {
            value = 0;
        } else if (value > 100) {
            value = 100;
        }
        onWeightChange(milestone.id, value);
    };

    const handleDescriptionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onDescriptionChange(milestone.id, e.target.value);
    }

    const handleToggleComplete = (checked: boolean | 'indeterminate') => {
        onToggleComplete(milestone.id, !!checked);
    }

    const handleDateConfirm = useCallback(() => {
        const dateToSave = (pickerDate instanceof Date && !isNaN(pickerDate.getTime())) ? pickerDate : undefined;
        const dateToSaveCopy = dateToSave ? new Date(dateToSave.getTime()) : undefined;
        onDueDateChange(milestone.id, dateToSaveCopy);
        setIsPopoverOpen(false);
    }, [milestone.id, pickerDate, onDueDateChange]);

    const handleDateCancel = useCallback(() => {
        let originalDate: Date | undefined = undefined;
        if (milestone.dueDate) {
            try {
                const dateInput = milestone.dueDate instanceof Date ? milestone.dueDate : new Date(milestone.dueDate);
                if (!isNaN(dateInput.getTime())) {
                    originalDate = dateInput;
                }
            } catch (e) {
                originalDate = undefined;
            }
        }
        setPickerDate(originalDate);
        setIsPopoverOpen(false);
    }, [milestone.dueDate, milestone.id]);

    const handleTriggerClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        let currentDate: Date | undefined = undefined;
        if (milestone.dueDate) {
             try {
                 const dateInput = milestone.dueDate instanceof Date ? milestone.dueDate : new Date(milestone.dueDate);
                 if (!isNaN(dateInput.getTime())) {
                     currentDate = dateInput;
                 }
             } catch (e) { /* Silently handle error */ }
        }
        setPickerDate(currentDate || new Date());
        setIsPopoverOpen(true);
    }, [milestone.dueDate]);

    const showDetailsInDisplayMode = !isEditing && parentTaskStatus !== 'completed' && parentTaskStatus !== 'hold';

  return (
     <div className={cn(
        "flex flex-wrap items-start sm:items-center gap-x-2 gap-y-1 py-1.5 group transition-opacity w-full border-b border-dashed border-muted/30",
        milestone.completed && !isEditing && "opacity-60"
        )}>
      {isEditing && dragHandleProps && (
        <Button
            {...dragHandleProps}
            variant="ghost"
            size="icon"
            className="h-6 w-6 cursor-grab text-muted-foreground hover:bg-accent flex-shrink-0 order-first self-center sm:self-auto"
            aria-label="إعادة ترتيب النقطة"
            onClick={(e) => e.stopPropagation()}
        >
            <GripVertical className="h-4 w-4" />
        </Button>
      )}

       <div className="flex items-center flex-shrink-0 pt-1 sm:pt-0" onClick={(e) => e.stopPropagation()}>
            <Checkbox
                id={`milestone-${milestone.id}`}
                checked={milestone.completed}
                onCheckedChange={handleToggleComplete}
                disabled={isEditing}
                aria-label={`Mark milestone ${milestone.description || 'untitled'} as complete`}
            />
       </div>

        <div className="flex-grow min-w-[100px] sm:min-w-[120px] order-3 sm:order-none w-full sm:w-auto">
          {isEditing ? (
            <Input
                dir="rtl"
                type="text"
                value={milestone.description}
                onChange={handleDescriptionChange}
                className={cn(
                    "w-full h-8 text-sm bg-input px-1.5 text-right",
                    milestone.completed && "line-through"
                )}
                placeholder="وصف النقطة..."
                onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <label
                dir="rtl"
                htmlFor={`milestone-${milestone.id}`}
                 className={cn(
                    "text-sm cursor-pointer py-0.5 px-1 block break-words text-right w-full",
                    "text-foreground/90 line-clamp-2",
                    milestone.completed && "line-through text-muted-foreground/70"
                )}
                title={milestone.description}
            >
              {milestone.description || <span className='italic text-muted-foreground/80'>بدون عنوان</span>}
            </label>
          )}
        </div>

        <div className="flex items-center gap-x-1 flex-shrink-0 order-last ml-auto sm:ml-0 mt-1 sm:mt-0 flex-wrap sm:flex-nowrap">
            {isEditing ? (
                <>
                    <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen} modal={true}>
                        <PopoverTrigger asChild>
                            <Button
                                type="button"
                                variant={'outline'}
                                size="sm"
                                className={cn(
                                    'h-7 w-auto px-1.5 text-xs font-normal flex items-center gap-1 flex-shrink-0',
                                    'border-input hover:bg-accent',
                                    (milestone.dueDate && typeof milestone.dueDate.getMonth === 'function' && !isNaN(milestone.dueDate.getTime()))
                                        ? 'bg-accent/50 text-accent-foreground border-accent'
                                        : 'text-muted-foreground',
                                 )}
                                onClick={handleTriggerClick}
                            >
                                <CalendarIcon className="h-3 w-3 flex-shrink-0" />
                                <span className="min-w-[35px] sm:min-w-[45px] text-center text-xs">
                                    {milestone.dueDate && typeof milestone.dueDate.getMonth === 'function' && !isNaN(milestone.dueDate.getTime())
                                        ? format(milestone.dueDate, 'd MMM', { locale: ar })
                                        : 'تاريخ؟'}
                                 </span>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-popover border-border" align="start" collisionPadding={10}>
                            <Calendar
                                mode="single"
                                selected={pickerDate}
                                onSelect={setPickerDate}
                                initialFocus
                                locale={ar}
                                dir="rtl"
                            />
                            <div className="p-2 border-t border-border flex justify-end gap-2">
                                <Button size="sm" type="button" variant="ghost" onClick={handleDateCancel}>إلغاء</Button>
                                <Button size="sm" type="button" onClick={handleDateConfirm} className="bg-primary hover:bg-primary/90 text-primary-foreground">تأكيد</Button>
                            </div>
                        </PopoverContent>
                    </Popover>

                    <div className="flex items-center gap-0.5 w-auto flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Input
                            type="number"
                            value={milestone.weight ?? 0}
                            onChange={handleWeightChange}
                            className="h-7 text-xs w-10 sm:w-12 text-center bg-input px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            min="0"
                            max="100"
                            aria-label={`وزن النقطة ${milestone.description || 'بدون عنوان'}`}
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                    </div>

                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive opacity-50 hover:opacity-100 group-hover:opacity-100 flex-shrink-0"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(milestone.id);
                        }}
                        aria-label={`حذف النقطة ${milestone.description || 'بدون عنوان'}`}
                    >
                        <Trash2 className="h-3 w-3" />
                    </Button>
                </>
            ) : (
                showDetailsInDisplayMode && (
                    <div className="flex items-center gap-x-2 text-xs text-muted-foreground">
                        {/* Display logic for due date */}
                        {milestone.dueDate && typeof milestone.dueDate.getMonth === 'function' && !isNaN(milestone.dueDate.getTime()) ? (
                            <span className="flex items-center whitespace-nowrap">
                                <CalendarIcon className="h-3 w-3 ml-1" />
                                {format(milestone.dueDate, 'd MMM', { locale: ar })}
                            </span>
                        ) : null}
                        {/* Display logic for weight */}
                        {milestone.weight > 0 && (
                            <span className="flex items-center whitespace-nowrap">
                                <Percent className="h-3 w-3 ml-0.5" />
                                {milestone.weight}%
                            </span>
                        )}
                    </div>
                )
            )}
        </div>
    </div>
  );
}
