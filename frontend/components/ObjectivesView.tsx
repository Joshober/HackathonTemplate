'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';
import { 
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  Users,
  Building2,
  RefreshCw,
  Edit,
  Target
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { api, Objective as ApiObjective, KeyResult as ApiKeyResult, ObjectiveTree } from '@/lib/api';

interface KeyResult {
  id: string;
  title: string;
  target: number;
  unit: string;
  currentValue: number;
  score: number;
  notes: string;
}

interface Objective {
  id: string;
  title: string;
  description: string;
  level: 'strategic' | 'functional' | 'tactical';
  timeline: 'annual' | 'quarterly';
  fiscalYear: number;
  quarter?: number;
  division?: string;
  owner: string;
  progress: number;
  keyResults: KeyResult[];
  children?: Objective[];
}

// Helper to convert API data to component format
function convertToObjectiveTree(apiObj: ObjectiveTree, allObjectives: ApiObjective[]): Objective {
  const krs = (apiObj.keyResults || []).map(kr => ({
    id: kr._id || '',
    title: kr.title,
    target: parseFloat(kr.target || '0'),
    unit: kr.unit || '',
    currentValue: parseFloat(kr.currentValue || '0'),
    score: kr.score || 0,
    notes: kr.notes?.[0]?.text || ''
  }));

  const progress = krs.length > 0
    ? Math.round(krs.reduce((sum, kr) => sum + kr.score, 0) / krs.length)
    : 0;

  return {
    id: apiObj._id || '',
    title: apiObj.title,
    description: apiObj.description || '',
    level: apiObj.level,
    timeline: apiObj.timeline,
    fiscalYear: apiObj.fiscalYear,
    quarter: apiObj.quarter ? parseInt(apiObj.quarter) : undefined,
    division: apiObj.division,
    owner: apiObj.ownerId || 'Unknown',
    progress,
    keyResults: krs,
    children: (apiObj.children || []).map(child => convertToObjectiveTree(child, allObjectives))
  };
}


interface ObjectivesViewProps {
  onUpdateProgress?: (objective: Objective) => void;
  onObjectiveClick?: (objectiveId: string) => void;
}

export function ObjectivesView({ onUpdateProgress, onObjectiveClick }: ObjectivesViewProps) {
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const fiscalYear = new Date().getFullYear();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const allObjs = await api.getObjectives({ fiscalYear });
      
      // Find root objectives (no parent)
      const rootObjs = allObjs.filter(o => !o.parentObjectiveId);

      // Build tree structure by fetching full tree for each root
      const rootTrees = await Promise.all(rootObjs.map(async (obj) => {
        if (!obj._id) return null;
        try {
          const tree = await api.getObjectiveTree(obj._id);
          return convertToObjectiveTree(tree, allObjs);
        } catch {
          return null;
        }
      }));

      const validTrees = rootTrees.filter((t): t is Objective => t !== null);
      setObjectives(validTrees);
      if (validTrees.length > 0) {
        setExpandedNodes(new Set([validTrees[0].id]));
      }
    } catch (error) {
      console.error('Error loading objectives:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleNode = (id: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedNodes(newExpanded);
  };

  const getLevelBadgeVariant = (level: string): "default" | "secondary" | "outline" => {
    switch (level) {
      case 'strategic': return 'default';
      case 'functional': return 'secondary';
      case 'tactical': return 'outline';
      default: return 'default';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const renderObjectiveTree = (objective: Objective, depth: number = 0) => {
    const isExpanded = expandedNodes.has(objective.id);
    const hasChildren = objective.children && objective.children.length > 0;

    return (
      <div key={objective.id} className="mb-3">
        <Card className={`${depth > 0 ? 'ml-8' : ''} hover:shadow-md transition-shadow`}>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div 
                className="flex items-start gap-3 flex-1 cursor-pointer"
                onClick={() => {
                  toggleNode(objective.id);
                  onObjectiveClick?.(objective.id);
                }}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 mt-1"
                  onClick={() => toggleNode(objective.id)}
                  disabled={!hasChildren}
                >
                  {hasChildren ? (
                    isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                  ) : (
                    <Target className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Badge variant={getLevelBadgeVariant(objective.level)} className="capitalize">
                      {objective.level}
                    </Badge>
                    <Badge variant="outline">
                      {objective.timeline === 'annual' ? objective.fiscalYear : `Q${objective.quarter} ${objective.fiscalYear}`}
                    </Badge>
                    {objective.division && (
                      <Badge variant="outline">
                        <Building2 className="h-3 w-3 mr-1" />
                        {objective.division}
                      </Badge>
                    )}
                    <Badge 
                      variant="outline" 
                      className={objective.progress >= 80 ? 'border-green-500 text-green-700' : 
                                 objective.progress >= 60 ? 'border-yellow-500 text-yellow-700' : 
                                 'border-red-500 text-red-700'}
                    >
                      {objective.progress >= 80 ? 'On Track' : objective.progress >= 60 ? 'At Risk' : 'Behind'}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg mb-1">{objective.title}</CardTitle>
                  <CardDescription>{objective.description}</CardDescription>
                  <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{objective.owner}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                {onUpdateProgress && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateProgress(objective);
                    }}
                    title="Update Progress"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
                <Button 
                  variant="ghost" 
                  size="sm" 
                  title="Edit Objective"
                  onClick={(e) => {
                    e.stopPropagation();
                    onObjectiveClick?.(objective.id);
                  }}
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Overall Progress</span>
                  <span className={`text-sm font-bold ${getScoreColor(objective.progress)}`}>
                    {objective.progress}%
                  </span>
                </div>
                <Progress value={objective.progress} className="h-2" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Key Results ({objective.keyResults.length})</span>
                </div>
                {objective.keyResults.map((kr) => (
                  <div key={kr.id} className="p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-sm font-medium flex-1">{kr.title}</span>
                      <span className={`text-sm font-bold ml-2 ${getScoreColor(kr.score)}`}>
                        {kr.score}%
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-2">
                      <span>Current: {kr.currentValue} {kr.unit}</span>
                      <span>Target: {kr.target} {kr.unit}</span>
                    </div>
                    <Progress value={(kr.currentValue / kr.target) * 100} className="h-1 mb-2" />
                    {kr.notes && (
                      <p className="text-xs text-muted-foreground italic">{kr.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {isExpanded && hasChildren && (
          <div className="mt-3">
            {objective.children?.map(child => renderObjectiveTree(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <CardTitle>All Objectives</CardTitle>
          <CardDescription>Hierarchical view of strategic, functional, and tactical objectives</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search objectives..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-2">
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger className="w-[160px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="strategic">Strategic</SelectItem>
                  <SelectItem value="functional">Functional</SelectItem>
                  <SelectItem value="tactical">Tactical</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="on-track">On Track</SelectItem>
                  <SelectItem value="at-risk">At Risk</SelectItem>
                  <SelectItem value="behind">Behind</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Objectives Tree */}
      {loading ? (
        <div className="text-center text-muted-foreground py-8">Loading...</div>
      ) : objectives.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No objectives found. Create one with "New Objective" button.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {objectives.map(obj => renderObjectiveTree(obj))}
        </div>
      )}
    </div>
  );
}
