'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser, login, User } from '@/lib/auth';
import { AppLayout } from '@/components/AppLayout';
import { OKRTableView } from '@/components/OKRTableView';
import { OKRModal } from '@/components/OKRModal';

export default function OKRTablePage() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      if (!currentUser) {
        await login();
        return;
      }
      setUser(currentUser);
    } catch (error) {
      console.error('Error loading user:', error);
      await login();
    } finally {
      setIsLoading(false);
    }
  };

  const handleObjectiveClick = (objectiveId: string) => {
    setSelectedObjectiveId(objectiveId);
    setModalOpen(true);
  };

  if (isLoading || !user) {
    return (
      <AppLayout title="OKR Table" description="Table view of all objectives and key results">
        <div className="text-center text-muted-foreground">Loading...</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="OKR Table" description="Table view of all objectives and key results">
      <OKRTableView onObjectiveClick={handleObjectiveClick} />
      <OKRModal
        objectiveId={selectedObjectiveId}
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedObjectiveId(null);
        }}
      />
    </AppLayout>
  );
}
