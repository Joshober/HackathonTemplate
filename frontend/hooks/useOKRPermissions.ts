import { useState, useEffect } from 'react';
import { api, Objective } from '@/lib/api';

export interface OKRPermissions {
  permissionLevel: string;
  canView: boolean;
  canEditKR: boolean;
  canEditObjective: boolean;
  canDelete: boolean;
  canChangeWorkflow: boolean;
}

export function useOKRPermissions(
  objectiveId: string | null,
  objective: Objective | null
): OKRPermissions {
  const [permissions, setPermissions] = useState<OKRPermissions>({
    permissionLevel: 'viewOnly',
    canView: true,
    canEditKR: false,
    canEditObjective: false,
    canDelete: false,
    canChangeWorkflow: false,
  });

  useEffect(() => {
    if (!objectiveId || !objective) {
      setPermissions({
        permissionLevel: 'viewOnly',
        canView: true,
        canEditKR: false,
        canEditObjective: false,
        canDelete: false,
        canChangeWorkflow: false,
      });
      return;
    }

    const loadPermissions = async () => {
      try {
        const perms = await api.getPermissions(objectiveId);
        setPermissions(perms);
      } catch (err) {
        console.error('Failed to load permissions:', err);
        // Default to view-only on error
        setPermissions({
          permissionLevel: 'viewOnly',
          canView: true,
          canEditKR: false,
          canEditObjective: false,
          canDelete: false,
          canChangeWorkflow: false,
        });
      }
    };

    loadPermissions();
  }, [objectiveId, objective?._id]);

  return permissions;
}
