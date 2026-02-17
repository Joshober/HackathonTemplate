'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { api, Objective, KeyResult } from '@/lib/api';
import { X, Loader2 } from 'lucide-react';
import { OKRModalOverview } from './OKRModalOverview';
import { OKRModalProgress } from './OKRModalProgress';
import { OKRModalUpdates } from './OKRModalUpdates';
import { OKRModalHistory } from './OKRModalHistory';
import { OKRModalDependencies } from './OKRModalDependencies';
import { OKRModalFiles } from './OKRModalFiles';
import { OKRWorkflowState } from './OKRWorkflowState';
import { OKRPinnedFields } from './OKRPinnedFields';
import { useOKRPermissions } from '@/hooks/useOKRPermissions';
import { OKRRealtimeIndicator } from './OKRRealtimeIndicator';
import { OKRExecutiveView } from './OKRExecutiveView';

interface OKRModalProps {
  objectiveId: string | null;
  open: boolean;
  onClose: () => void;
}

export function OKRModal({ objectiveId, open, onClose }: OKRModalProps) {
  const [objective, setObjective] = useState<Objective | null>(null);
  const [keyResults, setKeyResults] = useState<KeyResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [lastModified, setLastModified] = useState<string | null>(null);
  const [executiveView, setExecutiveView] = useState(false);

  const permissions = useOKRPermissions(objectiveId, objective);

  useEffect(() => {
    if (!objectiveId || !open) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [obj, krs] = await Promise.all([
          api.getObjective(objectiveId),
          api.getKeyResults(objectiveId),
        ]);
        setObjective(obj);
        setKeyResults(krs);
        setLastModified(obj.lastModified || obj.updatedAt || null);
      } catch (err: any) {
        setError(err.message || 'Failed to load OKR');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [objectiveId, open]);

  // Real-time polling
  useEffect(() => {
    if (!objectiveId || !open || !lastModified) return;

    const interval = setInterval(async () => {
      try {
        const updates = await api.getObjectiveUpdates(objectiveId, lastModified);
        if (updates.hasUpdates) {
          // Reload data
          const [obj, krs] = await Promise.all([
            api.getObjective(objectiveId),
            api.getKeyResults(objectiveId),
          ]);
          setObjective(obj);
          setKeyResults(krs);
          setLastModified(obj.lastModified || obj.updatedAt || null);
        }
      } catch (err) {
        // Silently fail for polling errors
        console.error('Polling error:', err);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [objectiveId, open, lastModified]);

  const handleClose = () => {
    setActiveTab('overview');
    onClose();
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  if (!open) return null;

  if (executiveView && objective) {
    return (
      <OKRExecutiveView
        objective={objective}
        keyResults={keyResults}
        onClose={() => setExecutiveView(false)}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <DialogTitle>Loading...</DialogTitle>
                </div>
              ) : error ? (
                <DialogTitle className="text-destructive">Error: {error}</DialogTitle>
              ) : objective ? (
                <>
                  <DialogTitle className="text-2xl mb-2">{objective.title}</DialogTitle>
                  {objective.description && (
                    <p className="text-sm text-muted-foreground">{objective.description}</p>
                  )}
                </>
              ) : null}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClose}
              className="ml-4"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        {objective && (
          <>
            <OKRRealtimeIndicator objectiveId={objectiveId!} lastModified={lastModified} />
            
            <div className="px-6 pt-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  <OKRPinnedFields objective={objective} permissions={permissions} />
                  <OKRWorkflowState objective={objective} permissions={permissions} />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setExecutiveView(true)}
                  className="ml-4"
                >
                  Executive View
                </Button>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="mx-6 mt-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="progress">Progress</TabsTrigger>
                <TabsTrigger value="updates">Updates</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
                <TabsTrigger value="dependencies">Dependencies</TabsTrigger>
                <TabsTrigger value="files">Files</TabsTrigger>
              </TabsList>

              <div className="flex-1 overflow-y-auto px-6 pb-6">
                <TabsContent value="overview" className="mt-4">
                  <OKRModalOverview
                    objective={objective}
                    keyResults={keyResults}
                    permissions={permissions}
                  />
                </TabsContent>

                <TabsContent value="progress" className="mt-4">
                  <OKRModalProgress
                    objective={objective}
                    keyResults={keyResults}
                    permissions={permissions}
                    onUpdate={(kr) => {
                      setKeyResults(prev => prev.map(k => k._id === kr._id ? kr : k));
                    }}
                  />
                </TabsContent>

                <TabsContent value="updates" className="mt-4">
                  <OKRModalUpdates
                    objective={objective}
                    keyResults={keyResults}
                    permissions={permissions}
                    onUpdate={(kr) => {
                      setKeyResults(prev => prev.map(k => k._id === kr._id ? kr : k));
                    }}
                  />
                </TabsContent>

                <TabsContent value="history" className="mt-4">
                  <OKRModalHistory objectiveId={objectiveId!} />
                </TabsContent>

                <TabsContent value="dependencies" className="mt-4">
                  <OKRModalDependencies
                    objective={objective}
                    permissions={permissions}
                    onUpdate={(obj) => {
                      setObjective(obj);
                    }}
                  />
                </TabsContent>

                <TabsContent value="files" className="mt-4">
                  <OKRModalFiles
                    objectiveId={objectiveId!}
                    objective={objective}
                    permissions={permissions}
                    onUpdate={(obj) => {
                      setObjective(obj);
                    }}
                  />
                </TabsContent>
              </div>
            </Tabs>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
