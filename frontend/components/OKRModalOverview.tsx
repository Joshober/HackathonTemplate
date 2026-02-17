'use client';

import React from 'react';
import { Objective, KeyResult } from '@/lib/api';
import { OKRPermissions } from '@/hooks/useOKRPermissions';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

interface OKRModalOverviewProps {
  objective: Objective;
  keyResults: KeyResult[];
  permissions: OKRPermissions;
}

export function OKRModalOverview({ objective, keyResults, permissions }: OKRModalOverviewProps) {
  const avgScore = keyResults.length > 0
    ? keyResults.reduce((sum, kr) => sum + (kr.score || 0), 0) / keyResults.length
    : 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Objective Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div>
            <span className="text-sm font-medium">Level:</span>
            <Badge className="ml-2">{objective.level}</Badge>
          </div>
          <div>
            <span className="text-sm font-medium">Timeline:</span>
            <Badge className="ml-2">{objective.timeline}</Badge>
          </div>
          <div>
            <span className="text-sm font-medium">Fiscal Year:</span>
            <span className="ml-2">{objective.fiscalYear}</span>
          </div>
          {objective.division && (
            <div>
              <span className="text-sm font-medium">Division:</span>
              <span className="ml-2">{objective.division}</span>
            </div>
          )}
          {objective.ownerId && (
            <div>
              <span className="text-sm font-medium">Owner:</span>
              <span className="ml-2">@{objective.ownerId}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Key Results Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div>
              <span className="text-sm font-medium">Total Key Results:</span>
              <span className="ml-2">{keyResults.length}</span>
            </div>
            <div>
              <span className="text-sm font-medium">Average Score:</span>
              <span className="ml-2">{avgScore.toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {keyResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Key Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {keyResults.map((kr) => (
                <div key={kr._id} className="border rounded p-2">
                  <div className="font-medium">{kr.title}</div>
                  {kr.score !== null && (
                    <div className="text-sm text-muted-foreground">
                      Score: {kr.score}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
