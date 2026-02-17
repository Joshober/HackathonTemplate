'use client';

import React, { useState, useEffect } from 'react';
import { Objective } from '@/lib/api';
import { OKRPermissions } from '@/hooks/useOKRPermissions';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { api } from '@/lib/api';

interface OKRModalDependenciesProps {
  objective: Objective;
  permissions: OKRPermissions;
  onUpdate: (objective: Objective) => void;
}

export function OKRModalDependencies({ objective, permissions, onUpdate }: OKRModalDependenciesProps) {
  const [dependencies, setDependencies] = useState<{ upstream: any[]; downstream: any[] }>({ upstream: [], downstream: [] });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Objective[]>([]);

  useEffect(() => {
    const loadDependencies = async () => {
      try {
        const deps = await api.getDependencies(objective._id!);
        setDependencies(deps);
      } catch (err) {
        console.error('Failed to load dependencies:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDependencies();
  }, [objective._id]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    try {
      const results = await api.searchObjectives({ q: searchQuery });
      setSearchResults(results.filter(obj => obj._id !== objective._id));
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const handleAddDependency = async (depObjectiveId: string, type: 'upstream' | 'downstream') => {
    try {
      const updated = await api.addDependency(objective._id!, {
        objectiveId: depObjectiveId,
        type: type === 'upstream' ? 'depends_on' : 'related',
        impact: 'medium',
        progress: 0.0,
        isAtRisk: false,
      });
      onUpdate(updated);
      setSearchQuery('');
      setSearchResults([]);
      // Reload dependencies
      const deps = await api.getDependencies(objective._id!);
      setDependencies(deps);
    } catch (err) {
      console.error('Failed to add dependency:', err);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Relates To (Upstream)</CardTitle>
        </CardHeader>
        <CardContent>
          {dependencies.upstream.length > 0 ? (
            <div className="space-y-2">
              {dependencies.upstream.map((dep) => (
                <div key={dep._id} className="border rounded p-2">
                  <div className="font-medium">{dep.title}</div>
                  <div className="text-sm text-muted-foreground">
                    Progress: {dep.progress} | {dep.isAtRisk && <Badge variant="destructive">At Risk</Badge>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No upstream dependencies</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What This Relates To (Downstream)</CardTitle>
        </CardHeader>
        <CardContent>
          {dependencies.downstream.length > 0 ? (
            <div className="space-y-2">
              {dependencies.downstream.map((dep) => (
                <div key={dep._id} className="border rounded p-2">
                  <div className="font-medium">{dep.title}</div>
                  <div className="text-sm text-muted-foreground">
                    Progress: {dep.progress} | {dep.isAtRisk && <Badge variant="destructive">At Risk</Badge>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No downstream dependencies</div>
          )}
        </CardContent>
      </Card>

      {permissions.canEditObjective && (
        <Card>
          <CardHeader>
            <CardTitle>Add Dependency</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search objectives..."
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch}>Search</Button>
            </div>
            {searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map((obj) => (
                  <div key={obj._id} className="border rounded p-2 flex justify-between items-center">
                    <div>
                      <div className="font-medium">{obj.title}</div>
                      <div className="text-sm text-muted-foreground">{obj.division}</div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleAddDependency(obj._id!, 'upstream')}>
                        Add as Upstream
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleAddDependency(obj._id!, 'downstream')}>
                        Add as Downstream
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
