'use client';

import React, { useState, useEffect } from 'react';
import { api, Objective, KeyResult } from '@/lib/api';
import { Card, CardContent } from './ui/card';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';

interface OKRTableViewProps {
  onObjectiveClick?: (objectiveId: string) => void;
}

export function OKRTableView({ onObjectiveClick }: OKRTableViewProps) {
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [keyResults, setKeyResults] = useState<Record<string, KeyResult[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const loadData = async () => {
      try {
        const objs = await api.getObjectives();
        setObjectives(objs);
        
        // Load key results for all objectives
        const krMap: Record<string, KeyResult[]> = {};
        for (const obj of objs) {
          if (obj._id) {
            try {
              const krs = await api.getKeyResults(obj._id);
              krMap[obj._id] = krs;
            } catch (err) {
              krMap[obj._id] = [];
            }
          }
        }
        setKeyResults(krMap);
      } catch (err) {
        console.error('Failed to load OKRs:', err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const filteredObjectives = objectives.filter(obj =>
    obj.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    obj.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search objectives..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Objectives</th>
                <th className="text-left p-2">Key Results</th>
                <th className="text-left p-2">Owner</th>
                <th className="text-left p-2">Partner with</th>
                <th className="text-left p-2">Expected EoQ Key Result Score</th>
                <th className="text-left p-2">Current Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredObjectives.map((obj) => {
                const isExpanded = expanded.has(obj._id || '');
                const krs = keyResults[obj._id || ''] || [];
                
                return (
                  <React.Fragment key={obj._id}>
                    <tr
                      className="border-b hover:bg-accent cursor-pointer"
                      onClick={() => {
                        toggleExpand(obj._id || '');
                        onObjectiveClick?.(obj._id || '');
                      }}
                    >
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          {krs.length > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand(obj._id || '');
                              }}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                          )}
                          <span className="font-medium">{obj.title}</span>
                          <Badge>{obj.level}</Badge>
                        </div>
                      </td>
                      <td className="p-2">
                        {krs.length} key result{krs.length !== 1 ? 's' : ''}
                      </td>
                      <td className="p-2">
                        {obj.ownerId ? `@${obj.ownerId}` : '-'}
                      </td>
                      <td className="p-2">-</td>
                      <td className="p-2">
                        {krs.length > 0 && krs[0].expectedEoQScore !== undefined
                          ? krs[0].expectedEoQScore.toFixed(1)
                          : '-'}
                      </td>
                      <td className="p-2">
                        {obj.workflowState && (
                          <Badge variant="outline">{obj.workflowState}</Badge>
                        )}
                      </td>
                    </tr>
                    {isExpanded && krs.map((kr) => (
                      <tr key={kr._id} className="bg-muted/50">
                        <td className="p-2 pl-8">
                          <span className="text-sm">{kr.title}</span>
                        </td>
                        <td className="p-2">-</td>
                        <td className="p-2">
                          {kr.ownerId ? `@${kr.ownerId}` : '-'}
                        </td>
                        <td className="p-2">
                          {kr.partnerId ? `@${kr.partnerId}` : '-'}
                        </td>
                        <td className="p-2">
                          {kr.expectedEoQScore !== undefined
                            ? (
                                <span className={kr.expectedEoQScore === 1.0 ? 'text-green-600 font-medium' : ''}>
                                  {kr.expectedEoQScore.toFixed(1)}
                                </span>
                              )
                            : '-'}
                        </td>
                        <td className="p-2">
                          {kr.notes && kr.notes.length > 0 ? (
                            <div className="text-sm">
                              {kr.notes[kr.notes.length - 1].text?.substring(0, 50)}
                              {kr.notes[kr.notes.length - 1].text && kr.notes[kr.notes.length - 1].text.length > 50 ? '...' : ''}
                            </div>
                          ) : '-'}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
