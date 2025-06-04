
'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, UserPlus } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { db, functions } from '@/lib/firebase'; // Ensure functions is imported
import { collection, query, getDocs, doc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions'; // Import httpsCallable

interface Member {
  uid: string;
  email: string;
  name: string; // Assuming name is available or will be fetched
  departmentId?: string;
}

interface AssignMemberToDepartmentDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  departmentId: string;
  currentDepartmentMembers: Member[]; // To filter out already assigned members
  onMemberAssigned: () => void; // Callback to refresh the member list
}

export function AssignMemberToDepartmentDialog({
  isOpen,
  onOpenChange,
  organizationId,
  departmentId,
  currentDepartmentMembers,
  onMemberAssigned,
}: AssignMemberToDepartmentDialogProps) {
  const { toast } = useToast();
  const [allOrgMembers, setAllOrgMembers] = useState<Member[]>([]);
  const [assignableMembers, setAssignableMembers] = useState<Member[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    if (isOpen && organizationId) {
      const fetchOrgMembers = async () => {
        setLoadingMembers(true);
        try {
          const membersRef = collection(db, 'organizations', organizationId, 'members');
          const membersSnapshot = await getDocs(membersRef);
          const fetchedMembers: Member[] = [];

          for (const memberDoc of membersSnapshot.docs) {
            const memberData = memberDoc.data();
            // Fetch user details (name, email) from the top-level users collection
            const userDetailsDoc = await getDoc(doc(db, 'users', memberDoc.id));
            const userName = userDetailsDoc.exists() ? userDetailsDoc.data().name || userDetailsDoc.data().displayName : 'مستخدم غير معروف';
            const userEmail = userDetailsDoc.exists() ? userDetailsDoc.data().email : 'بريد غير متوفر';

            fetchedMembers.push({
              uid: memberDoc.id,
              email: userEmail,
              name: userName,
              departmentId: memberData.departmentId,
            });
          }
          setAllOrgMembers(fetchedMembers);
        } catch (error) {
          console.error('Error fetching organization members:', error);
          toast({
            title: 'خطأ',
            description: 'حدث خطأ أثناء جلب أعضاء المؤسسة.',
            variant: 'destructive',
          });
        } finally {
          setLoadingMembers(false);
        }
      };
      fetchOrgMembers();
    }
  }, [isOpen, organizationId, toast]);

  useEffect(() => {
    // Filter out members already in the current department
    const currentMemberIds = new Set(currentDepartmentMembers.map(m => m.uid));
    const filtered = allOrgMembers.filter(member => !currentMemberIds.has(member.uid) && member.departmentId !== departmentId);
    setAssignableMembers(filtered);
  }, [allOrgMembers, currentDepartmentMembers, departmentId]);

  const handleMemberToggle = (memberId: string) => {
    setSelectedMembers(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleAssign = async () => {
    if (selectedMembers.length === 0) {
      toast({
        title: 'لا يوجد أعضاء محددون',
        description: 'يرجى اختيار عضو واحد على الأقل لتعيينه.',
        variant: 'default',
      });
      return;
    }

    setAssigning(true);
    try {
      // Get the updateOrganizationMember cloud function
      const updateOrganizationMemberFn = httpsCallable(functions, 'updateOrganizationMember');

      const promises = selectedMembers.map(memberId => {
        // Call the cloud function for each selected member
        return updateOrganizationMemberFn({
          orgId: organizationId,
          userId: memberId,
          departmentId: departmentId, // Assign to the current department
        });
      });

      await Promise.all(promises);

      toast({
        title: 'تم التعيين بنجاح',
        description: `تم تعيين ${selectedMembers.length} عضوًا إلى القسم.`,
      });
      onMemberAssigned(); // Refresh the members list in the parent component
      onOpenChange(false); // Close the dialog
      setSelectedMembers([]); // Reset selection
    } catch (error: any) {
      console.error('Error assigning members:', error);
      toast({
        title: 'خطأ في التعيين',
        description: error.message || 'حدث خطأ أثناء محاولة تعيين الأعضاء.',
        variant: 'destructive',
      });
    } finally {
      setAssigning(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>تعيين عضو إلى القسم</DialogTitle>
          <DialogDescription>
            اختر الأعضاء الذين ترغب في تعيينهم إلى هذا القسم.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          {loadingMembers ? (
            <div className="flex justify-center items-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : assignableMembers.length === 0 ? (
            <p className="text-center text-muted-foreground">
              جميع أعضاء المؤسسة معينون بالفعل إلى هذا القسم أو لا يوجد أعضاء آخرون.
            </p>
          ) : (
            <ScrollArea className="h-60">
              <div className="space-y-2 p-1">
                {assignableMembers.map(member => (
                  <div
                    key={member.uid}
                    className="flex items-center space-x-2 space-x-reverse p-2 border rounded-md hover:bg-accent/50"
                  >
                    <Checkbox
                      id={`member-assign-${member.uid}`}
                      checked={selectedMembers.includes(member.uid)}
                      onCheckedChange={() => handleMemberToggle(member.uid)}
                    />
                    <Label
                      htmlFor={`member-assign-${member.uid}`}
                      className="flex-1 cursor-pointer"
                    >
                      {member.name} ({member.email})
                    </Label>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={assigning}>
            إلغاء
          </Button>
          <Button onClick={handleAssign} disabled={assigning || selectedMembers.length === 0}>
            {assigning ? (
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="ml-2 h-4 w-4" />
            )}
            تعيين المحدد
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

    