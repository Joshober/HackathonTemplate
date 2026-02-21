/**
 * Feature tests: ensure all app routes and features are present.
 * Run: npm run test
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const APP_DIR = path.join(__dirname, '../app');

const EXPECTED_ROUTES = [
  '',
  'dashboard',
  'tutor',
  'profile',
  'profile/edit',
  'profile/new',
  'chat',
  'support',
  'voice-assistant',
  'bullshit-detect',
  'pose-attendance',
  'api/auth/callback',
];

describe('Feature: All routes exist', () => {
  it.each(EXPECTED_ROUTES)('route "%s" has a page', (route) => {
    const pagePath =
      route === ''
        ? path.join(APP_DIR, 'page.tsx')
        : path.join(APP_DIR, ...route.split('/').filter(Boolean), 'page.tsx');
    const exists = fs.existsSync(pagePath);
    expect(exists, `Missing: ${pagePath}`).toBe(true);
  });
});

describe('Feature: DashboardShell nav items', () => {
  const shellPath = path.join(__dirname, '../components/DashboardShell.tsx');
  const content = fs.readFileSync(shellPath, 'utf-8');

  const EXPECTED_NAV = [
    { label: 'Overview', href: '/dashboard' },
    { label: 'AI Tutor', href: '/tutor' },
    { label: 'Profile', href: '/profile' },
    { label: 'Chat Pipeline', href: '/chat' },
    { label: 'Bullshit Detect', href: '/bullshit-detect' },
    { label: 'Voice Assistant', href: '/voice-assistant' },
    { label: 'Pose Attendance', href: '/pose-attendance' },
  ];

  it.each(EXPECTED_NAV)('nav has $label linking to $href', ({ label, href }) => {
    expect(content).toContain(`href: '${href}'`);
    expect(content).toContain(`label: '${label}'`);
  });
});

describe('Feature: API client exports', () => {
  const apiPath = path.join(__dirname, '../lib/api.ts');
  const content = fs.readFileSync(apiPath, 'utf-8');

  const EXPECTED_METHODS = [
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

describe('Feature: Landing and dashboard', () => {
  it('landing page exists', () => {
    const p = path.join(APP_DIR, 'page.tsx');
    expect(fs.existsSync(p)).toBe(true);
  });

  it('dashboard page exists', () => {
    const p = path.join(APP_DIR, 'dashboard', 'page.tsx');
    expect(fs.existsSync(p)).toBe(true);
  });

  it('dashboard references all feature routes', () => {
    const dashboardPath = path.join(APP_DIR, 'dashboard', 'page.tsx');
    const content = fs.readFileSync(dashboardPath, 'utf-8');
    const links = ['/tutor', '/chat', '/support', '/voice-assistant', '/bullshit-detect', '/pose-attendance', '/profile'];
    links.forEach((href) => {
      expect(content).toContain(href);
    });
  });
});
