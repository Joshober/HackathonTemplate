'use client';

import { useRouter } from 'next/navigation';
import { useTeamPlanning } from '@/lib/teamPlanningContext';
import { useTravelAuth } from '@/components/travel/useTravelAuth';
import {
  Plane, MapPin, Calendar, DollarSign, Hotel, Sun, Coffee,
  Moon, AlertCircle, CheckCircle2, ArrowLeft, Share2,
} from 'lucide-react';

function TimeSlot({ icon, label, text }: { icon: React.ReactNode; label: string; text: string }) {
  return (
    <div className="flex gap-2.5">
      <div className="flex flex-col items-center">
        <div className="w-7 h-7 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center shrink-0 shadow-sm text-gray-500">
          {icon}
        </div>
        <div className="flex-1 w-px bg-gray-200 my-1" />
      </div>
      <div className="pb-3 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400 mb-0.5">{label}</p>
        <p className="text-sm text-gray-800 leading-snug">{text}</p>
      </div>
    </div>
  );
}

export default function TravelItineraryInner() {
  const { user, loading } = useTravelAuth();
  const { generatedPlan, leaderApproved } = useTeamPlanning();
  const router = useRouter();

  if (loading || !user) {
    return <div className="py-24 text-center text-sm text-gray-400">Signing you in…</div>;
  }

  if (!leaderApproved || !generatedPlan) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-gray-300" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-800 mb-1">Itinerary Locked</h3>
          <p className="text-sm text-gray-500">
            The trip needs final approval before the itinerary is revealed.
          </p>
        </div>
        <button
          onClick={() => router.push('/approve')}
          className="px-5 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700 transition-colors"
        >
          Go to Approve
        </button>
      </div>
    );
  }

  const plan = generatedPlan;
  const totalDays = plan.dayByDay.length || Math.round(
    (new Date(plan.endDate).getTime() - new Date(plan.startDate).getTime()) / 86400000
  );

  return (
    <div className="space-y-4 pb-8">
      {/* Hero card */}
      <div className="rounded-2xl overflow-hidden shadow-lg border border-gray-100">
        <div className="relative bg-gradient-to-br from-violet-700 via-purple-700 to-indigo-800 px-5 pt-6 pb-16 text-white">
          {/* Decorative circles */}
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-4 w-20 h-20 rounded-full bg-white/5 translate-y-1/2" />

          <button onClick={() => router.back()} className="relative flex items-center gap-1 text-white/70 hover:text-white text-xs mb-4 transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>

          <div className="relative">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold text-emerald-300 uppercase tracking-wide">Trip Approved</span>
            </div>
            <h1 className="text-2xl font-extrabold mb-1">{plan.destination}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-white/80">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {plan.startDate} → {plan.endDate}
              </span>
              <span className="flex items-center gap-1">
                <Plane className="w-3.5 h-3.5" />
                {totalDays} day{totalDays !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="bg-white -mt-8 mx-4 rounded-2xl shadow-md border border-gray-100 grid grid-cols-3 divide-x divide-gray-100 relative z-10">
          <div className="px-3 py-3 text-center">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-bold">Budget Low</p>
            <p className="text-base font-extrabold text-gray-900">${plan.budgetEstimateUSD.low.toLocaleString()}</p>
          </div>
          <div className="px-3 py-3 text-center">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-bold">Budget High</p>
            <p className="text-base font-extrabold text-gray-900">${plan.budgetEstimateUSD.high.toLocaleString()}</p>
          </div>
          <div className="px-3 py-3 text-center">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-bold">Days</p>
            <p className="text-base font-extrabold text-gray-900">{totalDays}</p>
          </div>
        </div>
        <div className="h-8 bg-white" />
      </div>

      {/* Highlights */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400 mb-2 flex items-center gap-1.5 px-1">
          <MapPin className="w-3.5 h-3.5" /> Trip Highlights
        </h2>
        <div className="flex flex-wrap gap-2">
          {plan.highlights.map((h, i) => (
            <span key={i} className="bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-100 text-violet-700 rounded-full px-3 py-1 text-xs font-semibold">
              {h}
            </span>
          ))}
        </div>
      </div>

      {/* Day-by-Day */}
      <div>
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400 mb-3 flex items-center gap-1.5 px-1">
          <Calendar className="w-3.5 h-3.5" /> Day-by-Day Itinerary
        </h2>

        {plan.dayByDay.length > 0 ? (
          <div className="space-y-3">
            {plan.dayByDay.map((day) => (
              <div key={day.day} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* Day header */}
                <div className="bg-gradient-to-r from-violet-600 to-purple-700 px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-white/70 uppercase tracking-wide">Day {day.day}</p>
                    <p className="text-sm font-bold text-white">{day.date}</p>
                  </div>
                  {day.hotel && (
                    <div className="flex items-center gap-1 bg-white/10 rounded-xl px-2.5 py-1">
                      <Hotel className="w-3 h-3 text-white/80" />
                      <span className="text-[10px] text-white/80 font-medium truncate max-w-[100px]">{day.hotel}</span>
                    </div>
                  )}
                </div>

                {/* Timeline */}
                <div className="px-4 pt-4 pb-2">
                  <TimeSlot icon={<Coffee className="w-3.5 h-3.5" />} label="Morning" text={day.morning} />
                  <TimeSlot icon={<Sun className="w-3.5 h-3.5" />} label="Afternoon" text={day.afternoon} />
                  <TimeSlot icon={<Moon className="w-3.5 h-3.5" />} label="Evening" text={day.evening} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Fallback: no day-by-day data, show summary */
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-5">
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{plan.rawSummary}</p>
          </div>
        )}
      </div>

      {/* Notes */}
      {plan.notes && (
        <div className="bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
          <h4 className="text-xs font-bold text-amber-700 mb-1 flex items-center gap-1">
            <DollarSign className="w-3.5 h-3.5" /> Sage&apos;s Notes
          </h4>
          <p className="text-xs text-amber-800 leading-relaxed">{plan.notes}</p>
        </div>
      )}

      {/* Share button */}
      <button className="w-full flex items-center justify-center gap-2 border-2 border-violet-200 text-violet-700 font-bold text-sm py-3 rounded-2xl hover:bg-violet-50 transition-colors">
        <Share2 className="w-4 h-4" /> Share Itinerary with Team
      </button>
    </div>
  );
}
