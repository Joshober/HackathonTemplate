'use client';

import React, { useState } from 'react';
import { Objective } from '@/lib/api';
import { OKRPermissions } from '@/hooks/useOKRPermissions';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Progress } from './ui/progress';
import { api } from '@/lib/api';

interface OKRPinnedFieldsProps {
  objective: Objective;
  permissions: OKRPermissions;
}

export function OKRPinnedFields({ objective, permissions }: OKRPinnedFieldsProps) {
  const [editing, setEditing] = useState<string | null>(null);
  const [values, setValues] = useState(objective.pinnedFields || {});

  const handleSave = async (field: string, value: any) => {
    if (!permissions.canEditObjective) return;
    
    try {
      await api.updatePinnedFields(objective._id!, {
        ...values,
        [field]: value,
      });
      setValues(prev => ({ ...prev, [field]: value }));
      setEditing(null);
    } catch (err) {
      console.error('Failed to update pinned field:', err);
    }
  };

  const fields = [
    { key: 'theme', label: 'Theme' },
    { key: 'roadmap', label: 'Roadmap' },
    { key: 'customerSegments', label: 'Customer Segments' },
    { key: 'value', label: 'Value' },
    { key: 'documents', label: 'Documents' },
    { key: 'overallNecessity', label: 'Overall Necessity' },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
      {fields.map(({ key, label }) => (
        <div key={key} className="space-y-1">
          <Label className="text-xs text-muted-foreground">{label}</Label>
          {editing === key ? (
            <Input
              value={values[key as keyof typeof values] || ''}
              onChange={(e) => setValues(prev => ({ ...prev, [key]: e.target.value }))}
              onBlur={() => handleSave(key, values[key as keyof typeof values])}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSave(key, values[key as keyof typeof values]);
                } else if (e.key === 'Escape') {
                  setEditing(null);
                }
              }}
              autoFocus
              disabled={!permissions.canEditObjective}
            />
          ) : (
            <div
              className="text-sm p-2 border rounded cursor-pointer hover:bg-accent"
              onClick={() => permissions.canEditObjective && setEditing(key)}
            >
              {values[key as keyof typeof values] || <span className="text-muted-foreground">None</span>}
            </div>
          )}
        </div>
      ))}
      
      {values.deliveryProgress !== undefined && (
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Delivery Progress</Label>
          <div className="space-y-2">
            <Progress value={(values.deliveryProgress || 0) * 100} />
            <span className="text-sm">{(values.deliveryProgress || 0) * 100}%</span>
          </div>
        </div>
      )}
    </div>
  );
}
