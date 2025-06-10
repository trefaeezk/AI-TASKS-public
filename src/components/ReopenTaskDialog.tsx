'use client';

import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RotateCcw, CheckCircle2 } from 'lucide-react';

interface ReopenTaskDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (resetMilestones: boolean) => void;
  taskDescription: string;
  hasMilestones: boolean;
}

export function ReopenTaskDialog({
  isOpen,
  onOpenChange,
  onConfirm,
  taskDescription,
  hasMilestones
}: ReopenTaskDialogProps) {
  const [resetMilestones, setResetMilestones] = React.useState(true);

  const handleConfirm = () => {
    onConfirm(resetMilestones);
    onOpenChange(false);
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center">
            <RotateCcw className="ml-2 h-5 w-5 text-blue-600" />
            إعادة فتح المهمة
          </AlertDialogTitle>
          <AlertDialogDescription className="text-right">
            هل أنت متأكد من إعادة فتح المهمة "{taskDescription}"؟
          </AlertDialogDescription>
        </AlertDialogHeader>

        {hasMilestones && (
          <div className="py-4">
            <div className="flex items-center space-x-2 space-x-reverse">
              <Checkbox
                id="reset-milestones"
                checked={resetMilestones}
                onCheckedChange={(checked) => setResetMilestones(checked as boolean)}
              />
              <Label 
                htmlFor="reset-milestones" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                <div className="flex items-center">
                  <CheckCircle2 className="ml-1 h-4 w-4 text-green-600" />
                  إعادة تعيين نقاط التتبع المكتملة
                </div>
              </Label>
            </div>
            <p className="text-xs text-muted-foreground mt-2 mr-6">
              {resetMilestones 
                ? "سيتم إعادة تعيين جميع نقاط التتبع المكتملة إلى غير مكتملة"
                : "ستبقى نقاط التتبع كما هي (مكتملة)"
              }
            </p>
          </div>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleConfirm}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <RotateCcw className="ml-2 h-4 w-4" />
            إعادة فتح
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
