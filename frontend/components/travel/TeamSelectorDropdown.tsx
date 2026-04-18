'use client';

import { useEffect, useState } from 'react';
import { api, type TeamSummary, TRAVEL_ACTIVE_TEAM_STORAGE_KEY } from '@/lib/api';
import { useTeamPlanning } from '@/lib/teamPlanningContext';
import {
  Users, ChevronDown, Check, ShieldCheck, X,
} from 'lucide-react';

export default function TeamSelectorDropdown() {
  const { activeTeamId, bindToTeam } = useTeamPlanning();
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const { teams: t } = await api.listTeams();
        if (!mounted) return;
        setTeams(t);

        const stored =
          typeof window !== 'undefined'
            ? localStorage.getItem(TRAVEL_ACTIVE_TEAM_STORAGE_KEY)
            : null;
        if (stored && t.some((team) => team.id === stored)) {
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
    return () => {
      mounted = false;
    };
  }, [activeTeamId, bindToTeam]);

  const activeTeam = teams.find((t) => t.id === activeTeamId);

  const handleSelect = (id: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TRAVEL_ACTIVE_TEAM_STORAGE_KEY, id);
    }
    bindToTeam(id);
    setIsOpen(false);
  };

  if (teams.length === 0) return null;

  return (
    <div className="flex items-center gap-3 relative z-40">

      {/* ── Team picker dropdown ── */}
      <div className="relative">
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
              {teams.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleSelect(t.id)}
                  className="w-full text-left px-4 py-2.5 text-sm font-medium hover:bg-gray-50 flex items-center justify-between"
                >
                  <span className="truncate pr-4 text-gray-800">{t.name}</span>
                  {t.id === activeTeamId && (
                    <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Privacy Shield badge ── */}
      <button
        onClick={() => setIsPrivacyOpen(true)}
        className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1.5 rounded-xl transition-colors shadow-sm"
        title="Privacy & Data Integrity"
      >
        <ShieldCheck className="w-4 h-4 text-blue-600" />
        <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wide">Privacy Shield</span>
      </button>

      {/* ── Privacy Shield modal ── */}
      {isPrivacyOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setIsPrivacyOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-auto space-y-4 animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setIsPrivacyOpen(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Privacy by Design</h3>
            </div>
            <p className="text-sm text-gray-600">
              TripReady Copilot is built for enterprise security. Here is how your data is handled:
            </p>
            <ul className="text-sm text-gray-800 space-y-2 list-disc pl-4">
              <li><strong>Calendar Data:</strong> Processed fully client-side. Never cached or sent to external LLMs.</li>
              <li>
                <strong>LLM Communication:</strong> Only anonymized constraints (e.g., "Destination: London") are sent
                for processing. Over a secure TLS 1.3 connection.
              </li>
              <li><strong>Trip Information:</strong> Saved exclusively in your company's private, encrypted enterprise database.</li>
            </ul>
            <div className="pt-4 border-t border-gray-100">
              <p className="text-xs text-center text-gray-400 font-medium">Compliant with Enterprise Safety Standards</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
