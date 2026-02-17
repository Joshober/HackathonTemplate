'use client';

import React from 'react';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { RefreshCw } from 'lucide-react';

interface OKRRealtimeIndicatorProps {
  objectiveId: string;
  lastModified: string | null;
}

export function OKRRealtimeIndicator({ objectiveId, lastModified }: OKRRealtimeIndicatorProps) {
  // This is a placeholder - in a real implementation, you'd track updates
  return null; // Hide for now, can be enhanced later
}
