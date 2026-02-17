'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

interface OKRModalHistoryProps {
  objectiveId: string;
}

export function OKRModalHistory({ objectiveId }: OKRModalHistoryProps) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const audit = await api.getObjectiveAudit(objectiveId);
        setHistory(audit);
      } catch (err) {
        console.error('Failed to load history:', err);
      } finally {
        setLoading(false);
      }
    };

    loadHistory();
  }, [objectiveId]);

  if (loading) {
    return <div>Loading history...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audit Trail</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {history.length > 0 ? (
            history.map((entry, idx) => (
              <div key={idx} className="border-l-2 pl-4 py-2">
                <div className="text-sm font-medium">{entry.action}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(entry.timestamp).toLocaleString()} by @{entry.userId}
                </div>
                {entry.reason && (
                  <div className="text-sm mt-1">{entry.reason}</div>
                )}
                {entry.changes && entry.changes.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    {entry.changes.map((change: any, i: number) => (
                      <div key={i}>
                        {change.field}: {String(change.oldValue)} → {String(change.newValue)}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-sm text-muted-foreground">No history available</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
