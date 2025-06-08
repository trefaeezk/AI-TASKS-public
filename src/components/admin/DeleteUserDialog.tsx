/**
 * مكون حوار حذف المستخدم
 * يوفر واجهة آمنة لحذف المستخدمين مع التأكيد والتحذيرات
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Trash2, User, Shield } from 'lucide-react';
import { useUserDeletion } from '@/hooks/useUserDeletion';

interface DeleteUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    uid: string;
    name: string;
    email: string;
    role: string;
    accountType: 'individual' | 'organization';
    organizationId?: string;
  } | null;
  onUserDeleted?: () => void;
}

export const DeleteUserDialog: React.FC<DeleteUserDialogProps> = ({
  isOpen,
  onClose,
  user,
  onUserDeleted
}) => {
  const [confirmationText, setConfirmationText] = useState('');
  const [forceDelete, setForceDelete] = useState(false);
  const [deleteDataOnly, setDeleteDataOnly] = useState(false);
  
  const {
    isDeleting,
    deleteProgress,
    deleteUserCompletely,
    deleteIndividualUserData
  } = useUserDeletion();

  // إعادة تعيين الحالة عند إغلاق الحوار
  const handleClose = () => {
    if (!isDeleting) {
      setConfirmationText('');
      setForceDelete(false);
      setDeleteDataOnly(false);
      onClose();
    }
  };

  // التحقق من صحة النص المدخل
  const isConfirmationValid = confirmationText === user?.email;

  // تحديد نوع الحذف المطلوب
  const isOwnerRole = user?.role === 'isOrgOwner' || user?.role === 'isSystemOwner';
  const requiresForceDelete = isOwnerRole && !forceDelete;

  // تنفيذ عملية الحذف
  const handleDelete = async () => {
    if (!user || !isConfirmationValid) return;

    try {
      let success = false;

      if (deleteDataOnly) {
        // حذف البيانات فقط (للمستخدمين الأفراد)
        success = await deleteIndividualUserData(user.uid);
      } else {
        // حذف شامل
        const result = await deleteUserCompletely(user.uid, forceDelete);
        success = result?.success || false;
      }

      if (success) {
        onUserDeleted?.();
        handleClose();
      }
    } catch (error) {
      console.error('Error in delete operation:', error);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            حذف المستخدم
          </DialogTitle>
          <DialogDescription>
            أنت على وشك حذف المستخدم "{user.name}" ({user.email})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* معلومات المستخدم */}
          <div className="bg-muted p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4" />
              <span className="font-medium">معلومات المستخدم</span>
            </div>
            <div className="text-sm space-y-1">
              <div><strong>الاسم:</strong> {user.name}</div>
              <div><strong>البريد الإلكتروني:</strong> {user.email}</div>
              <div><strong>الدور:</strong> {user.role}</div>
              <div><strong>نوع الحساب:</strong> {user.accountType === 'individual' ? 'فردي' : 'مؤسسة'}</div>
            </div>
          </div>

          {/* تحذيرات خاصة بالأدوار المهمة */}
          {isOwnerRole && (
            <Alert variant="destructive">
              <Shield className="h-4 w-4" />
              <AlertTitle>تحذير: دور مهم</AlertTitle>
              <AlertDescription>
                هذا المستخدم لديه دور مالك. حذفه قد يؤثر على النظام أو المؤسسة.
                {user.role === 'isOrgOwner' && ' تأكد من وجود مالك آخر للمؤسسة قبل الحذف.'}
              </AlertDescription>
            </Alert>
          )}

          {/* خيارات الحذف للمستخدمين الأفراد */}
          {user.accountType === 'individual' && (
            <div className="space-y-3">
              <Label className="text-base font-medium">خيارات الحذف:</Label>
              
              <div className="flex items-center space-x-2 space-x-reverse">
                <Checkbox
                  id="deleteDataOnly"
                  checked={deleteDataOnly}
                  onCheckedChange={(checked) => setDeleteDataOnly(checked as boolean)}
                />
                <Label htmlFor="deleteDataOnly" className="text-sm">
                  حذف البيانات فقط (الاحتفاظ بحساب المصادقة)
                </Label>
              </div>
              
              {!deleteDataOnly && (
                <div className="text-sm text-muted-foreground pr-6">
                  سيتم حذف حساب المصادقة وجميع البيانات المرتبطة
                </div>
              )}
            </div>
          )}

          {/* خيار الحذف القسري */}
          {isOwnerRole && !deleteDataOnly && (
            <div className="flex items-center space-x-2 space-x-reverse">
              <Checkbox
                id="forceDelete"
                checked={forceDelete}
                onCheckedChange={(checked) => setForceDelete(checked as boolean)}
              />
              <Label htmlFor="forceDelete" className="text-sm">
                حذف قسري (تجاهل التحذيرات)
              </Label>
            </div>
          )}

          {/* قائمة البيانات التي سيتم حذفها */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>سيتم حذف البيانات التالية:</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                {!deleteDataOnly && <li>حساب المصادقة من Firebase Auth</li>}
                <li>البيانات الأساسية للمستخدم</li>
                {user.accountType === 'individual' && <li>بيانات المستخدم الفردي</li>}
                {user.accountType === 'organization' && <li>عضوية المؤسسة</li>}
                <li>جميع المهام المرتبطة</li>
                <li>جميع الاجتماعات المرتبطة</li>
                <li>جميع الأهداف والنتائج الرئيسية</li>
                <li>جميع التقارير</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* حقل التأكيد */}
          <div className="space-y-2">
            <Label htmlFor="confirmation">
              اكتب البريد الإلكتروني للمستخدم للتأكيد:
            </Label>
            <Input
              id="confirmation"
              type="email"
              placeholder={user.email}
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              disabled={isDeleting}
            />
          </div>

          {/* شريط التقدم */}
          {isDeleting && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">جاري الحذف...</span>
                <span className="text-sm text-muted-foreground">{deleteProgress}</span>
              </div>
              <Progress value={undefined} className="w-full" />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isDeleting}
          >
            إلغاء
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!isConfirmationValid || requiresForceDelete || isDeleting}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            {deleteDataOnly ? 'حذف البيانات' : 'حذف المستخدم'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
