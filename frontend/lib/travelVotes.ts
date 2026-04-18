'use client';

const KEY = 'travelCompanionVotes';

export type VoteMap = Record<string, string>; // itemId -> optionKey

export function loadVotes(): VoteMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const o = JSON.parse(raw) as unknown;
    if (o && typeof o === 'object' && !Array.isArray(o)) return o as VoteMap;
  } catch {
    /* ignore */
  }
  return {};
}

export function saveVotes(map: VoteMap) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(map));
}

export function setVote(itemId: string, optionKey: string) {
  const m = loadVotes();
  m[itemId] = optionKey;
  saveVotes(m);
}
