
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { Milestone } from '@/types/task';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Trash2, GripVertical, Check, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, parseISO } from 'date-fns'; // Ensure parseISO is imported if needed elsewhere
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
}: MilestoneItemProps) {

    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    // Use a separate state for the picker to avoid updating the main state until confirm
    const [pickerDate, setPickerDate] = useState<Date | undefined>(undefined); // Initialize separately

    // Sync pickerDate when milestone.dueDate changes externally or popover opens
    useEffect(() => {
      // Ensure milestone.dueDate is a valid Date before setting
       // Convert Firestore Timestamp (if received as string) back to Date for picker
        let initialDate: Date | undefined = undefined;
        if (milestone.dueDate) {
            try {
                const dateObj = new Date(milestone.dueDate);
                if (!isNaN(dateObj.getTime())) {
                    initialDate = dateObj;
                }
            } catch (e) {
                console.error(`[MilestoneItem ${milestone.id}] Error parsing initial dueDate:`, e, "Value:", milestone.dueDate);
            }
        }
        setPickerDate(initialDate);
        console.log(`[MilestoneItem ${milestone.id}] Initialized pickerDate to:`, initialDate);
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

    // Confirm the date selected in the picker
    const handleDateConfirm = useCallback(() => {
        // Ensure pickerDate is valid before updating
        const dateToSave = (pickerDate instanceof Date && !isNaN(pickerDate.getTime())) ? pickerDate : undefined;

        // Create a new Date object to ensure we're not passing a reference that might be modified elsewhere
        const dateToSaveCopy = dateToSave ? new Date(dateToSave.getTime()) : undefined;

        onDueDateChange(milestone.id, dateToSaveCopy); // Update parent state with the copy
        setIsPopoverOpen(false);
    }, [milestone.id, pickerDate, onDueDateChange]);

    // Cancel date selection
    const handleDateCancel = useCallback(() => {
        // Reset picker state to the original milestone date (if valid)
        let originalDate: Date | undefined = undefined;
        if (milestone.dueDate) {
            try {
                const dateObj = new Date(milestone.dueDate);
                if (!isNaN(dateObj.getTime())) {
                    originalDate = dateObj;
                }
            } catch (e) {
                // Silently handle error
                originalDate = undefined;
            }
        }
        setPickerDate(originalDate);
        setIsPopoverOpen(false);
    }, [milestone.dueDate, milestone.id]);

     // Memoized calculation for display date
     const displayDate = useMemo(() => {
         // Ensure milestone.dueDate is correctly parsed into a Date object
         let dateObj: Date | undefined = undefined;
         if (milestone.dueDate) {
             try {
                 dateObj = new Date(milestone.dueDate);
                 if (isNaN(dateObj.getTime())) {
                     dateObj = undefined; // Invalidate if parsing failed
                 }
             } catch (e) {
                 dateObj = undefined;
             }
         }

         if (dateObj instanceof Date) {
             try {
                 return format(dateObj, 'd MMM', { locale: ar });
             } catch (e) {
                 return null;
             }
         }
         return null;
     }, [milestone.dueDate, milestone.id]);


    // Handle opening the popover
    const handleTriggerClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        // Set the picker's initial date to the current milestone due date (if valid) or today when opening
        let currentDate: Date | undefined = undefined;
        if (milestone.dueDate) {
             try {
                 const dateObj = new Date(milestone.dueDate);
                 if (!isNaN(dateObj.getTime())) {
                     currentDate = dateObj;
                 }
             } catch (e) {
                 // Silently handle error
             }
        }
        setPickerDate(currentDate || new Date()); // Default to today if no valid date
        setIsPopoverOpen(true);
    }, [milestone.dueDate, milestone.id]);


  return (
     <div className={cn(
        "flex flex-wrap items-start sm:items-center gap-x-2 gap-y-1 py-1.5 group transition-opacity w-full border-b border-dashed border-muted/30", // Added border-b
        milestone.completed && !isEditing && "opacity-60"
        )}>
      {isEditing && dragHandleProps && (
        <Button
            {...dragHandleProps}
            variant="ghost"
            size="icon"
            className="h-6 w-6 cursor-grab text-muted-foreground hover:bg-accent flex-shrink-0 order-first self-center sm:self-auto"
            aria-label="إعادة ترتيب النقطة"
            onClick={(e) => e.stopPropagation()} // Prevent triggering other actions
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

        {/* Use flex-grow for description input/label */}
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
                    "text-foreground/90 line-clamp-2", // Use line-clamp-2 for better display
                    milestone.completed && "line-through text-muted-foreground/70"
                )}
                title={milestone.description}
            >
              {milestone.description || <span className='italic text-muted-foreground/80'>بدون عنوان</span>}
            </label>
          )}
        </div>

        {/* Actions aligned to the end */}
        <div className="flex items-center gap-x-1 sm:gap-x-1 flex-shrink-0 order-last ml-auto sm:ml-0">
            {/* Due Date Picker (only in edit mode) */}
            {isEditing && (
                <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen} modal={true}>
                    <PopoverTrigger asChild>
                        <Button
                            type="button"
                            variant={'outline'}
                            size="sm"
                            // Adjusted padding, width auto, ensure proper vertical alignment
                            className={cn(
                                'h-8 w-auto px-1.5 text-xs font-normal flex items-center gap-1 flex-shrink-0',
                                'border-input hover:bg-accent',
                                // Style based on whether a date *is* set for the milestone
                                (displayDate) // Check if displayDate is truthy (meaning a valid date exists)
                                    ? 'bg-accent/50 text-accent-foreground border-accent'
                                    : 'text-muted-foreground',
                             )}
                            onClick={handleTriggerClick} // Use the new handler
                        >
                            <CalendarIcon className="h-3 w-3 flex-shrink-0" />
                            {/* Display formatted date if valid, otherwise placeholder */}
                             {/* Adjusted width for better date display */}
                            <span className="min-w-[45px] text-center">
                                {displayDate ?? 'تاريخ؟'}
                             </span>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-popover border-border" align="start" collisionPadding={10}>
                        <Calendar
                            mode="single"
                            selected={pickerDate} // Use pickerDate for selection
                            onSelect={setPickerDate} // Update pickerDate directly
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
            )}

            {isEditing && (
                 <div className="flex items-center gap-0.5 w-auto flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Input
                        type="number"
                        value={milestone.weight ?? 0}
                        onChange={handleWeightChange}
                         // Slightly wider input for weight
                        className="h-8 text-sm w-12 sm:w-14 text-center bg-input px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        min="0"
                        max="100"
                        aria-label={`وزن النقطة ${milestone.description || 'بدون عنوان'}`}
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                </div>
            )}

            {isEditing && (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    // Reduced size and adjusted margin for delete button
                    className="h-6 w-6 text-destructive opacity-50 hover:opacity-100 group-hover:opacity-100 flex-shrink-0"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(milestone.id);
                    }}
                    aria-label={`حذف النقطة ${milestone.description || 'بدون عنوان'}`}
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
            )}
        </div>

         {/* Show date in display mode if set */}
        {!isEditing && displayDate && (
           <span className="text-xs text-muted-foreground px-1 flex items-center flex-shrink-0 whitespace-nowrap order-last sm:order-none text-right mr-auto sm:mr-0">
               <CalendarIcon className="h-3 w-3 ml-1" />
               {displayDate}
           </span>
       )}
    </div>
  );
}
