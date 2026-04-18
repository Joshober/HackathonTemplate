'use client';

import { useEffect, useState } from 'react';
import {
  getStoredCalendarToken,
  requestCalendarAccess,
  storeCalendarToken,
  clearCalendarToken,
} from '@/lib/googleCalendar';
import { Calendar, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface Props {
  userId: string;
  compact?: boolean;
}

export default function GoogleCalendarButton({ userId, compact = false }: Props) {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setConnected(!!getStoredCalendarToken(userId));
  }, [userId]);

  const connect = async () => {
    setLoading(true);
    setError(null);
    try {
      const { token, expiresIn } = await requestCalendarAccess();
      storeCalendarToken(userId, token, expiresIn);
      setConnected(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect');
    } finally {
      setLoading(false);
    }
  };

  const disconnect = () => {
    clearCalendarToken(userId);
    setConnected(false);
  };

  if (compact) {
    return (
      <button
        onClick={connected ? disconnect : connect}
        disabled={loading}
        title={connected ? 'Calendar connected – click to disconnect' : 'Connect Google Calendar'}
        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
          connected
            ? 'bg-emerald-100 text-emerald-600 hover:bg-red-100 hover:text-red-500'
            : 'bg-gray-100 text-gray-400 hover:bg-blue-100 hover:text-blue-600'
        }`}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : connected ? (
          <CheckCircle className="w-3.5 h-3.5" />
        ) : (
          <Calendar className="w-3.5 h-3.5" />
        )}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        onClick={connected ? disconnect : connect}
        disabled={loading}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
          connected
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'
            : 'bg-white text-gray-700 border border-gray-200 hover:border-blue-300 hover:text-blue-700'
        }`}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : connected ? (
          <CheckCircle className="w-4 h-4" />
        ) : (
          <Calendar className="w-4 h-4" />
        )}
        <span>{loading ? 'Connecting…' : connected ? 'Calendar Connected' : 'Connect Google Calendar'}</span>
      </button>
      {error && (
        <div className="flex items-center gap-1 text-[11px] text-red-600">
          <AlertCircle className="w-3 h-3" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
