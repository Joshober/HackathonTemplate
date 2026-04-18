/**
 * Feature tests: ensure all app routes and features are present.
 * Run: npm run test
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const APP_DIR = path.join(__dirname, '../app');

function pagePathForRoute(route: string): string {
  if (route === '') return path.join(APP_DIR, 'page.tsx');
  const parts = route.split('/').filter(Boolean);
  if (['home', 'explorer', 'assistant', 'team'].includes(parts[0])) {
    return path.join(APP_DIR, '(travel)', ...parts, 'page.tsx');
  }
  return path.join(APP_DIR, ...parts, 'page.tsx');
}

const EXPECTED_ROUTES = [
  '',
  'admin',
  'dashboard',
  'home',
  'explorer',
  'assistant',
  'team',
  'tutor',
  'profile',
  'profile/edit',
  'profile/new',
  'chat',
  'support',
  'voice-assistant',
  'voice',
  'bullshit-detect',
  'pose-attendance',
  'api/auth/callback',
];

describe('Feature: All routes exist', () => {
  it.each(EXPECTED_ROUTES)('route "%s" has a page', (route) => {
    const pagePath = pagePathForRoute(route);
    const exists = fs.existsSync(pagePath);
    expect(exists, `Missing: ${pagePath}`).toBe(true);
  });
});

describe('Feature: Legacy demo routes redirect to Travel Companion', () => {
  const legacyPaths = [
    'dashboard/page.tsx',
    'chat/page.tsx',
    'tutor/page.tsx',
    'support/page.tsx',
    'voice-assistant/page.tsx',
    'voice/page.tsx',
    'bullshit-detect/page.tsx',
    'pose-attendance/page.tsx',
    'admin/page.tsx',
  ];

  it.each(legacyPaths)('%s redirects to /home', (rel) => {
    const p = path.join(APP_DIR, ...rel.split('/'));
    const content = fs.readFileSync(p, 'utf-8');
    expect(content).toContain("redirect('/home')");
  });
});

describe('Feature: Travel bottom navigation', () => {
  const navPath = path.join(__dirname, '../components/travel/BottomNav.tsx');
  const content = fs.readFileSync(navPath, 'utf-8');
  const tabs = ['/home', '/explorer', '/assistant', '/team', '/profile'];
  it.each(tabs)('bottom nav includes %s', (href) => {
    expect(content).toContain(href);
  });
});

describe('Feature: API client exports', () => {
  const apiPath = path.join(__dirname, '../lib/api.ts');
  const content = fs.readFileSync(apiPath, 'utf-8');

  const EXPECTED_METHODS = [
    'adminMe',
    'getAdminSettings',
    'updateAdminProfessorEmails',
    'sendChatMessage',
    'chatPipeline',
    'bullshitDetect',
    'bullshitDetectPipeline',
    'getProfile',
    'createProfile',
    'updateProfile',
    'transcribeAudio',
    'textToSpeech',
    'generateVoice',
    'sendEmail',
    'createTicket',
    'listTickets',
  ];

  it.each(EXPECTED_METHODS)('api has method %s', (method) => {
    expect(content).toContain(`async ${method}(`);
  });
});

describe('Feature: Landing and travel app', () => {
  it('landing page exists', () => {
    const p = path.join(APP_DIR, 'page.tsx');
    expect(fs.existsSync(p)).toBe(true);
  });

  it('landing does not link to legacy dashboard', () => {
    const landingPath = path.join(__dirname, '../components/LandingPage.tsx');
    const content = fs.readFileSync(landingPath, 'utf-8');
    expect(content).not.toContain('href="/dashboard"');
    expect(content).not.toContain('Legacy tools');
  });
});
