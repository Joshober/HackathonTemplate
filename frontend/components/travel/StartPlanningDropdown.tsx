'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTeamPlanning } from '@/lib/teamPlanningContext';
import {
  MessageSquare, Map, CheckCircle, Plane, Home, ChevronDown, Lock,
} from 'lucide-react';

interface DropdownItem {
  id: 'chat' | 'plan' | 'approve' | 'travel' | 'return';
  label: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  alwaysLocked?: boolean;
}

const ITEMS: DropdownItem[] = [
  {
    id: 'chat',
    label: 'Chat',
    description: 'Team conversation',
    href: '/team',
    icon: <MessageSquare className="w-4 h-4" />,
  },
  {
    id: 'plan',
    label: 'Plan',
    description: 'AI planning room',
    href: '/plan',
    icon: <Map className="w-4 h-4" />,
  },
  {
    id: 'approve',
    label: 'Approve',
    description: 'Review & vote on plan',
    href: '/approve',
    icon: <CheckCircle className="w-4 h-4" />,
  },
  {
    id: 'travel',
    label: 'Travel',
    description: 'Day-by-day itinerary',
    href: '/travel-plan',
    icon: <Plane className="w-4 h-4" />,
  },
  {
    id: 'return',
    label: 'Return',
    description: 'Post-trip wrap-up',
    href: '/home',
    icon: <Home className="w-4 h-4" />,
  },
];

const STAGE_COLOR: Record<string, string> = {
  chat: 'from-violet-500 to-purple-600',
  plan: 'from-blue-500 to-cyan-500',
  approve: 'from-amber-500 to-orange-500',
  travel: 'from-emerald-500 to-green-500',
  return: 'from-pink-500 to-rose-500',
};

export default function StartPlanningDropdown() {
  const [open, setOpen] = useState(false);
  const { unlockedStages } = useTeamPlanning();
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleClick = (item: DropdownItem) => {
    if (!unlockedStages.has(item.id)) return;
    setOpen(false);
    router.push(item.href);
  };

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-900 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-sm transition-all duration-200 active:scale-95"
      >
        <span>Planning Stages</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-[0_8px_32px_-4px_rgba(0,0,0,0.18)] border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="px-4 pt-3 pb-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Planning Stages</p>
          </div>

          <div className="pb-2">
            {ITEMS.map((item, index) => {
              const locked = !unlockedStages.has(item.id);
              const gradient = STAGE_COLOR[item.id];
              return (
                <button
                  key={item.id}
                  onClick={() => handleClick(item)}
                  disabled={locked}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-150 ${
                    locked
                      ? 'opacity-40 cursor-not-allowed'
                      : 'hover:bg-gray-50 cursor-pointer'
                  }`}
                >
                  {/* Icon badge */}
                  <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shrink-0 shadow-sm`}>
                    {locked ? <Lock className="w-3.5 h-3.5" /> : item.icon}
                  </div>

                  {/* Labels */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-gray-900">{item.label}</span>
                      {locked && (
                        <span className="text-[9px] font-bold uppercase tracking-wide text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                          Locked
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 truncate">{item.description}</p>
                  </div>

                  {/* Step number */}
                  <span className="text-[10px] font-bold text-gray-300 shrink-0">{index + 1}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
