'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type TeamSummary, TRAVEL_ACTIVE_TEAM_STORAGE_KEY } from '@/lib/api';
import { useTeamPlanning } from '@/lib/teamPlanningContext';
import { Users, ChevronDown, Check } from 'lucide-react';

export default function TeamSelectorDropdown() {
  const { activeTeamId, bindToTeam } = useTeamPlanning();
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const { teams: t } = await api.listTeams();
        if (!mounted) return;
        setTeams(t);
        
        // Auto-select first team if none is active and there's one available, 
        // or just ensure local storage matches
        const stored = typeof window !== 'undefined' ? localStorage.getItem(TRAVEL_ACTIVE_TEAM_STORAGE_KEY) : null;
        if (stored && t.some(team => team.id === stored)) {
          if (activeTeamId !== stored) bindToTeam(stored);
        } else if (t.length > 0 && !stored && !activeTeamId) {
          const firstId = t[0].id;
          if (typeof window !== 'undefined') {
            localStorage.setItem(TRAVEL_ACTIVE_TEAM_STORAGE_KEY, firstId);
          }
          bindToTeam(firstId);
        }
      } catch {
        // ignore
      }
    })();
    return () => { mounted = false; };
  }, [activeTeamId, bindToTeam]);

  const activeTeam = teams.find(t => t.id === activeTeamId);

  const handleSelect = (id: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TRAVEL_ACTIVE_TEAM_STORAGE_KEY, id);
    }
    bindToTeam(id);
    setIsOpen(false);
  };

  if (teams.length === 0) return null;

  return (
    <div className="relative z-40">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-white/50 hover:bg-white/80 p-2 rounded-xl backdrop-blur-sm transition-all border border-gray-200"
      >
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#4472fa] to-[#a445f6] flex items-center justify-center flex-shrink-0">
          <Users className="w-3.5 h-3.5 text-white" />
        </div>
        <div className="text-left flex-1 min-w-0 pr-2">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider leading-none">Active Group</p>
          <p className="text-sm font-semibold text-gray-900 truncate max-w-[120px] leading-tight mt-0.5">
            {activeTeam?.name || 'Select a Group'}
          </p>
        </div>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden py-1 z-50">
            {teams.map(t => (
              <button
                key={t.id}
                onClick={() => handleSelect(t.id)}
                className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-gray-50 flex items-center justify-between"
              >
                <span className="truncate pr-4 text-gray-800">{t.name}</span>
                {t.id === activeTeamId && <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
