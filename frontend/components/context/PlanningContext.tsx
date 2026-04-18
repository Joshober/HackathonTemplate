import { createContext, useContext, useState, ReactNode } from "react";

interface PlanningContextType {
  isPlanningActive: boolean;
  isLeader: boolean;
  currentGroupId: number | null;
  startPlanning: (groupId: number) => void;
  cancelPlanning: () => void;
  setIsLeader: (isLeader: boolean) => void;
}

const PlanningContext = createContext<PlanningContextType | undefined>(undefined);

export function PlanningProvider({ children }: { children: ReactNode }) {
  const [isPlanningActive, setIsPlanningActive] = useState(false);
  const [isLeader, setIsLeader] = useState(false);
  const [currentGroupId, setCurrentGroupId] = useState<number | null>(null);

  const startPlanning = (groupId: number) => {
    setIsPlanningActive(true);
    setCurrentGroupId(groupId);
  };

  const cancelPlanning = () => {
    setIsPlanningActive(false);
    setCurrentGroupId(null);
  };

  return (
    <PlanningContext.Provider
      value={{
        isPlanningActive,
        isLeader,
        currentGroupId,
        startPlanning,
        cancelPlanning,
        setIsLeader,
      }}
    >
      {children}
    </PlanningContext.Provider>
  );
}

export function usePlanning() {
  const context = useContext(PlanningContext);
  if (!context) {
    throw new Error("usePlanning must be used within PlanningProvider");
  }
  return context;
}
