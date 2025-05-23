'use client';

import React, { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type OkrFilterValue = 'all' | string;

interface OkrFilterProps {
  value: OkrFilterValue;
  onChange: (value: OkrFilterValue) => void;
  label?: string;
  organizationId?: string;
}

interface Objective {
  id: string;
  title: string;
}

export function OkrFilter({ value, onChange, label = "تصفية حسب OKR", organizationId }: OkrFilterProps) {
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!organizationId) return;

    const fetchObjectives = async () => {
      try {
        setLoading(true);
        const objectivesQuery = query(
          collection(db, 'objectives'),
          where('organizationId', '==', organizationId)
        );
        const snapshot = await getDocs(objectivesQuery);
        const objectivesList: Objective[] = [];

        snapshot.forEach((doc) => {
          const data = doc.data();
          objectivesList.push({
            id: doc.id,
            title: data.title || 'هدف بدون عنوان',
          });
        });

        setObjectives(objectivesList);
      } catch (error) {
        console.error('Error fetching objectives:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchObjectives();
  }, [organizationId]);

  return (
    <div className="space-y-2">
      <Label htmlFor="okr-filter">{label}</Label>
      <Select
        value={value}
        onValueChange={onChange}
        disabled={loading}
      >
        <SelectTrigger id="okr-filter">
          <SelectValue placeholder={loading ? "جاري التحميل..." : "اختر هدف"} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">جميع المهام</SelectItem>
          <SelectItem value="linked">مرتبطة بـ OKR</SelectItem>
          {objectives.map((objective) => (
            <SelectItem key={objective.id} value={objective.id}>
              {objective.title}
            </SelectItem>
          ))}
          {objectives.length === 0 && !loading && (
            <SelectItem value="no-objectives" disabled>
              لا توجد أهداف
            </SelectItem>
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
