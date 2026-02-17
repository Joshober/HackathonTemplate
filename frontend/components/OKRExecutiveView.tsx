'use client';

import React from 'react';
import { Objective, KeyResult } from '@/lib/api';
import { Button } from './ui/button';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

interface OKRExecutiveViewProps {
  objective: Objective;
  keyResults: KeyResult[];
  onClose: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
}

export function OKRExecutiveView({
  objective,
  keyResults,
  onClose,
  onPrevious,
  onNext,
}: OKRExecutiveViewProps) {
  const avgScore = keyResults.length > 0
    ? keyResults.reduce((sum, kr) => sum + (kr.score || 0), 0) / keyResults.length
    : 0;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex items-center justify-between p-6 border-b">
        <div className="flex items-center gap-4">
          {onPrevious && (
            <Button variant="ghost" size="icon" onClick={onPrevious}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
          )}
          <h1 className="text-3xl font-bold">{objective.title}</h1>
          {onNext && (
            <Button variant="ghost" size="icon" onClick={onNext}>
              <ChevronRight className="h-5 w-5" />
            </Button>
          )}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 p-12 flex flex-col items-center justify-center space-y-8">
        <div className="text-center space-y-4">
          <div className="text-6xl font-bold">{Math.round(avgScore * 100)}%</div>
          <div className="text-2xl text-muted-foreground">Overall Progress</div>
          <Progress value={avgScore * 100} className="w-96 h-4" />
        </div>

        <div className="grid grid-cols-2 gap-8 w-full max-w-4xl">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Department</div>
            <div className="text-xl">{objective.division || 'N/A'}</div>
          </div>
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground">Status</div>
            <Badge className="text-lg px-4 py-2">
              {objective.workflowState || 'active'}
            </Badge>
          </div>
        </div>

        <div className="w-full max-w-4xl space-y-4">
          <h2 className="text-2xl font-semibold">Key Results</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {keyResults.map((kr) => (
              <div key={kr._id} className="border rounded-lg p-6">
                <div className="text-lg font-medium mb-2">{kr.title}</div>
                <div className="text-3xl font-bold mb-2">
                  {Math.round((kr.score || 0) * 100)}%
                </div>
                <Progress value={(kr.score || 0) * 100} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
