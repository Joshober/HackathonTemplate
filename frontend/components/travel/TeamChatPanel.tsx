'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type TeamMessage } from '@/lib/api';
import type { User } from '@/lib/auth';
import { MessageCircle, Send } from 'lucide-react';

export default function TeamChatPanel({
  teamId,
  user,
}: {
  teamId: string | null;
  user: User;
}) {
  type TeamSystemEvent = {
    type: 'event_vote' | 'availability_request';
    itemId?: string | null;
    title?: string;
    city?: string;
    description?: string;
    imageUrl?: string;
    sourceUrl?: string;
    message?: string;
  };

  const parseSystemEvent = (content: string): TeamSystemEvent | null => {
    if (!content.startsWith('[SYSTEM_EVENT]')) return null;
    const raw = content.slice('[SYSTEM_EVENT]'.length).trim();
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as TeamSystemEvent;
      if (parsed?.type === 'event_vote' || parsed?.type === 'availability_request') return parsed;
    } catch {
      return null;
    }
    return null;
  };

  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [askAssistant, setAskAssistant] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<TeamSystemEvent | null>(null);
  const [selectedAvailabilityEvent, setSelectedAvailabilityEvent] = useState<TeamSystemEvent | null>(null);
  const [decisionBusy, setDecisionBusy] = useState<null | 'approve' | 'veto'>(null);
  const [availabilityStart, setAvailabilityStart] = useState('');
  const [availabilityEnd, setAvailabilityEnd] = useState('');
  const [availabilitySaving, setAvailabilitySaving] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!teamId) {
      setMessages([]);
      setErr(null);
      return;
    }
    let cancelled = false;
    setLoadingHistory(true);
    setErr(null);
    api
      .getTeamMessages(teamId, 100)
      .then(({ messages: rows }) => {
        if (!cancelled) setMessages(rows);
      })
      .catch((e) => {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Could not load messages');
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false);
      });
    return () => {
      cancelled = true;
    };
  }, [teamId]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || pending || !teamId) return;
      setErr(null);
      setPending(true);
      setInput('');
      try {
        const { userMessage, assistantMessage } = await api.sendTeamMessage(teamId, trimmed, {
          invokeAssistant: true, // simplified for new UI
        });
        setMessages((prev) =>
          assistantMessage ? [...prev, userMessage, assistantMessage] : [...prev, userMessage]
        );
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Request failed');
        setInput(trimmed);
      } finally {
        setPending(false);
      }
    },
    [teamId, pending]
  );

  const submitManualAvailability = useCallback(async () => {
    if (!teamId || !availabilityStart || !availabilityEnd || availabilityStart > availabilityEnd || availabilitySaving) return;
    setAvailabilitySaving(true);
    setErr(null);
    try {
      const existing = await api.getTeamAvailability(teamId);
      const mine = existing.members.find((m) => m.userId === user.sub);
      const windows = [...(mine?.windows || []), { startDate: availabilityStart, endDate: availabilityEnd }];
      await api.setMyTeamAvailability(teamId, windows);
      const actor = user.name || user.email || 'A teammate';
      await api.sendTeamMessage(
        teamId,
        `[SYSTEM] ${actor} submitted availability: ${availabilityStart} to ${availabilityEnd}.`,
        { invokeAssistant: false }
      );
      setAvailabilityStart('');
      setAvailabilityEnd('');
      setSelectedAvailabilityEvent(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save availability');
    } finally {
      setAvailabilitySaving(false);
    }
  }, [teamId, availabilityStart, availabilityEnd, availabilitySaving, user]);

  const handleEventDecision = useCallback(
    async (decision: 'approve' | 'veto') => {
      if (!teamId || !selectedEvent?.itemId || decisionBusy) return;
      setDecisionBusy(decision);
      setErr(null);
      try {
        const [teamDetail, allItems] = await Promise.all([api.getTeam(teamId), api.getItems()]);
        const item = allItems.find((i) => i._id === selectedEvent.itemId);
        const travel = item?.travel && typeof item.travel === 'object' ? (item.travel as Record<string, unknown>) : {};
        const existing = Array.isArray(travel.approvals)
          ? (travel.approvals as Array<{ name?: string; role?: string; status?: string }>)
          : [];
        const meEmail = user.email?.trim().toLowerCase() || '';
        const me = teamDetail.members.find(
          (m) => m.userId === user.sub || ((m.email || '').trim().toLowerCase() === meEmail && meEmail.length > 0)
        );
        const actorName = (me?.displayName || me?.email || user.name || user.email || 'Team member').trim();
        const baseApprovals =
          existing.length > 0
            ? existing.map((a) => ({
                name: (a.name || '').trim() || 'Team member',
                role: (a.role || 'Reviewer').trim(),
                status: a.status === 'approved' || a.status === 'needs_changes' ? a.status : 'pending',
              }))
            : (teamDetail.members || []).map((m) => ({
                name: (m.displayName || m.email || 'Team member').trim(),
                role: 'Reviewer',
                status: 'pending' as const,
              }));
        const approvals = (() => {
          let matched = false;
          const next = baseApprovals.map((a) => {
            if (a.name === actorName) {
              matched = true;
              return { ...a, status: decision === 'approve' ? 'approved' : 'needs_changes' };
            }
            return a;
          });
          if (!matched) {
            next.push({
              name: actorName,
              role: 'Reviewer',
              status: decision === 'approve' ? 'approved' : 'needs_changes',
            });
          }
          return next;
        })();
        await api.updateItem(selectedEvent.itemId, {
          travel: {
            ...travel,
            approvals,
            opportunityStatus: decision === 'approve' ? 'approved' : 'needs_changes',
          },
        });
        const actor = user.name || user.email || 'A teammate';
        const decisionMessage = `[SYSTEM] ${actor} ${decision === 'approve' ? 'approved' : 'denied'} "${selectedEvent.title || 'event'}".`;
        try {
          await api.sendTeamMessage(teamId, decisionMessage, { invokeAssistant: false });
        } catch {
          // Keep the main action successful even if posting a follow-up note fails.
        }
        setSelectedEvent(null);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Could not update event decision');
      } finally {
        setDecisionBusy(null);
      }
    },
    [teamId, selectedEvent, decisionBusy, user]
  );

  if (!teamId) {
    return (
      <div className="flex flex-col min-h-[56vh] gap-3 justify-center text-center px-4">
        <p className="text-sm text-travel-muted">Create a team or pick one from the list to open the shared thread.</p>
        <p className="text-xs text-travel-muted">Messages are stored on the server for all members.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full absolute inset-0">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto w-full px-5 py-4 flex flex-col pt-10">
        {loadingHistory ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-gray-400">Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center opacity-80 mt-[-10%]">
            <MessageCircle className="w-16 h-16 text-gray-300 stroke-[1.5] mb-4" />
            <p className="text-[#64748b] text-base font-semibold">No messages yet</p>
            <p className="text-[#94a3b8] text-sm mt-0.5">Start the conversation!</p>
          </div>
        ) : (
          <>
            {messages.map((m) => {
            const systemEvent = parseSystemEvent(m.content);
            const isUser = m.role === 'user';
            const isSystemNotice = m.content.startsWith('[SYSTEM] ') || Boolean(systemEvent);
            const content = systemEvent
              ? systemEvent.type === 'availability_request'
                ? systemEvent.message ||
                  `We are now looking into booking times for "${systemEvent.title || 'this event'}". Please send your availability.`
                : `New event added: "${systemEvent.title || 'Untitled'}"${systemEvent.city ? ` in ${systemEvent.city}` : ''}.`
              : isSystemNotice
                ? m.content.replace(/^\[SYSTEM\]\s*/, '')
                : m.content;
            const label =
              isSystemNotice
                ? 'System'
                : isUser && m.userId === user.sub
                ? 'You'
                : isUser
                  ? m.authorDisplayName || 'Teammate'
                  : m.authorDisplayName || 'Travel assistant';
            return (
              <div key={m.id} className={`space-y-0.5 ${isUser && !isSystemNotice ? 'ml-4' : 'mr-4'}`}>
                <p className="text-[10px] uppercase tracking-wide text-travel-muted px-1">{label}</p>
                <div
                  className={`text-sm leading-relaxed rounded-xl px-3 py-2 ${
                    isSystemNotice
                      ? 'bg-amber-50 text-amber-900 border border-amber-200'
                      : isUser
                        ? 'bg-blue-100 text-gray-900 border border-blue-200'
                        : 'bg-white text-gray-800 border border-gray-100 shadow-sm'
                  }`}
                >
                  {content}
                  {systemEvent ? (
                    <div className="mt-2">
                      {systemEvent.type === 'event_vote' ? (
                        <button
                          type="button"
                          onClick={() => setSelectedEvent(systemEvent)}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white hover:bg-amber-100 text-amber-900 font-medium"
                        >
                          Review event
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSelectedAvailabilityEvent(systemEvent)}
                          className="text-xs px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white hover:bg-amber-100 text-amber-900 font-medium"
                        >
                          Send availability
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
              );
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {err ? <p className="text-xs text-red-500 px-5 text-center mt-2">{err}</p> : null}

      {/* Input Area */}
      <div className="shrink-0 p-4 pb-6 bg-white shrink">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2 bg-[#f8f9fa] outline outline-1 outline-gray-100 rounded-full pl-5 pr-2 py-1.5 focus-within:outline-blue-500 transition-all shadow-sm max-w-full overflow-hidden"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message"
            className="flex-1 bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none min-w-0"
            disabled={pending}
          />
          <button
            type="submit"
            disabled={pending || !input.trim()}
            className="w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white shrink-0"
            aria-label="Send message"
          >
            {pending ? '…' : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
      {selectedAvailabilityEvent ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-gray-200 shadow-xl overflow-hidden">
            <div className="p-4 space-y-3">
              <h3 className="text-base font-semibold text-gray-900">Share your availability</h3>
              <p className="text-xs text-travel-muted">
                {selectedAvailabilityEvent.title
                  ? `For: ${selectedAvailabilityEvent.title}`
                  : 'Share your available dates for this booking window.'}
              </p>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-travel-muted">
                  Start date
                  <input
                    type="date"
                    value={availabilityStart}
                    onChange={(e) => setAvailabilityStart(e.target.value)}
                    className="mt-1 w-full rounded-xl bg-white border border-gray-200 px-3 py-2 text-sm text-gray-900"
                  />
                </label>
                <label className="text-xs text-travel-muted">
                  End date
                  <input
                    type="date"
                    value={availabilityEnd}
                    onChange={(e) => setAvailabilityEnd(e.target.value)}
                    className="mt-1 w-full rounded-xl bg-white border border-gray-200 px-3 py-2 text-sm text-gray-900"
                  />
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    void (async () => {
                      try {
                        const { auth_url } = await api.getGoogleCalendarAuthUrl();
                        window.location.href = auth_url;
                      } catch (e) {
                        setErr(e instanceof Error ? e.message : 'Could not open Google Calendar connect');
                      }
                    })()
                  }
                  className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold py-2.5"
                >
                  Connect Google Calendar
                </button>
                <button
                  type="button"
                  onClick={() => void submitManualAvailability()}
                  disabled={availabilitySaving || !availabilityStart || !availabilityEnd || availabilityStart > availabilityEnd}
                  className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5"
                >
                  {availabilitySaving ? 'Saving…' : 'Save manually'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAvailabilityEvent(null)}
                className="w-full rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm text-gray-700 py-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {selectedEvent ? (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white border border-gray-200 shadow-xl overflow-hidden">
            {selectedEvent.imageUrl ? (
              <div
                className="h-48 bg-gray-100 bg-cover bg-center"
                style={{ backgroundImage: `url(${selectedEvent.imageUrl})` }}
                aria-label={selectedEvent.title || 'Event image'}
              />
            ) : (
              <div className="h-32 bg-gradient-to-br from-gray-100 to-gray-50" />
            )}
            <div className="p-4 space-y-3">
              <div>
                <h3 className="text-base font-semibold text-gray-900">{selectedEvent.title || 'Untitled event'}</h3>
                {selectedEvent.city ? <p className="text-xs text-travel-muted mt-1">{selectedEvent.city}</p> : null}
              </div>
              <p className="text-sm text-gray-700">{selectedEvent.description || 'No description provided.'}</p>
              {selectedEvent.sourceUrl ? (
                <a
                  href={selectedEvent.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline inline-block"
                >
                  Open source link
                </a>
              ) : null}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => void handleEventDecision('approve')}
                  disabled={decisionBusy != null}
                  className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5"
                >
                  {decisionBusy === 'approve' ? 'Approving…' : 'Approve'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleEventDecision('veto')}
                  disabled={decisionBusy != null}
                  className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-sm font-semibold py-2.5"
                >
                  {decisionBusy === 'veto' ? 'Vetoing…' : 'Veto'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                disabled={decisionBusy != null}
                className="w-full rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-sm text-gray-700 py-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
