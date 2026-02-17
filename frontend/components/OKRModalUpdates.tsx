'use client';

import React, { useState } from 'react';
import { Objective, KeyResult } from '@/lib/api';
import { OKRPermissions } from '@/hooks/useOKRPermissions';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { api } from '@/lib/api';

interface OKRModalUpdatesProps {
  objective: Objective;
  keyResults: KeyResult[];
  permissions: OKRPermissions;
  onUpdate: (kr: KeyResult) => void;
}

export function OKRModalUpdates({ objective, keyResults, permissions, onUpdate }: OKRModalUpdatesProps) {
  const [newUpdate, setNewUpdate] = useState<{ krId: string; text: string; date: string } | null>(null);

  const handleAddUpdate = async (krId: string) => {
    if (!newUpdate || !newUpdate.text.trim()) return;
    
    try {
      const kr = keyResults.find(k => k._id === krId);
      if (!kr) return;
      
      const notes = kr.notes || [];
      const update = {
        text: newUpdate.text,
        date: newUpdate.date,
        userId: 'current-user', // TODO: Get from auth
        createdAt: new Date().toISOString(),
      };
      
      const updated = await api.updateKeyResult(krId, {
        notes: [...notes, update],
      });
      
      onUpdate(updated);
      setNewUpdate(null);
    } catch (err) {
      console.error('Failed to add update:', err);
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
            <div className="space-y-2">
              {kr.notes && kr.notes.length > 0 ? (
                kr.notes.map((note, idx) => (
                  <div key={idx} className="border-l-2 pl-4 py-2">
                    <div className="text-xs text-muted-foreground">
                      {note.date || new Date(note.createdAt || '').toLocaleDateString()}
                    </div>
                    <div className="text-sm">{note.text}</div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">No updates yet</div>
              )}
            </div>
            
            {permissions.canEditKR && (
              <div className="space-y-2 border-t pt-4">
                {newUpdate?.krId === kr._id ? (
                  <>
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={newUpdate.date}
                      onChange={(e) => setNewUpdate(prev => prev ? { ...prev, date: e.target.value } : null)}
                    />
                    <Label>Update</Label>
                    <Input
                      value={newUpdate.text}
                      onChange={(e) => setNewUpdate(prev => prev ? { ...prev, text: e.target.value } : null)}
                      placeholder="Enter update..."
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleAddUpdate(kr._id!)}>
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setNewUpdate(null)}>
                        Cancel
                      </Button>
                    </div>
                  </>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setNewUpdate({ krId: kr._id!, text: '', date: new Date().toISOString().split('T')[0] })}>
                    Add Update
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
