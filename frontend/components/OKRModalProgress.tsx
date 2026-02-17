'use client';

import React from 'react';
import { Objective, KeyResult } from '@/lib/api';
import { OKRPermissions } from '@/hooks/useOKRPermissions';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Progress } from './ui/progress';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { api } from '@/lib/api';

interface OKRModalProgressProps {
  objective: Objective;
  keyResults: KeyResult[];
  permissions: OKRPermissions;
  onUpdate: (kr: KeyResult) => void;
}

export function OKRModalProgress({ objective, keyResults, permissions, onUpdate }: OKRModalProgressProps) {
  const handleScoreUpdate = async (krId: string, score: number) => {
    if (!permissions.canEditKR) return;
    
    try {
      const updated = await api.updateKeyResult(krId, { score });
      onUpdate(updated);
    } catch (err) {
      console.error('Failed to update score:', err);
    }
  };

  return (
    <div className="space-y-4">
      {keyResults.map((kr) => (
        <Card key={kr._id}>
          <CardHeader>
            <CardTitle>{kr.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {kr.target && (
              <div>
                <Label>Target</Label>
                <div className="text-sm">{kr.target} {kr.unit || ''}</div>
              </div>
            )}
            {kr.currentValue && (
              <div>
                <Label>Current Value</Label>
                <div className="text-sm">{kr.currentValue} {kr.unit || ''}</div>
              </div>
            )}
            <div>
              <Label>Score (0.0 - 1.0)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={kr.score || 0}
                  onChange={(e) => {
                    const score = parseFloat(e.target.value);
                    if (!isNaN(score) && score >= 0 && score <= 1) {
                      handleScoreUpdate(kr._id!, score);
                    }
                  }}
                  disabled={!permissions.canEditKR}
                  className="w-24"
                />
                <Progress value={(kr.score || 0) * 100} className="flex-1" />
              </div>
            </div>
            {kr.expectedEoQScore !== undefined && (
              <div>
                <Label>Expected EoQ Score</Label>
                <div className="text-sm">{kr.expectedEoQScore}</div>
              </div>
            )}
            {kr.ownerId && (
              <div>
                <Label>Owner</Label>
                <div className="text-sm">@{kr.ownerId}</div>
              </div>
            )}
            {kr.partnerId && (
              <div>
                <Label>Partner</Label>
                <div className="text-sm">@{kr.partnerId}</div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
