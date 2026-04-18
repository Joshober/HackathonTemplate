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

  /** Travel Companion lives in the `(travel)` route group. */

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



describe('Feature: DashboardShell nav items', () => {

  const shellPath = path.join(__dirname, '../components/DashboardShell.tsx');

  const content = fs.readFileSync(shellPath, 'utf-8');



  const EXPECTED_NAV = [

    { label: 'Travel Companion', href: '/home' },

    { label: 'Legacy hub', href: '/dashboard' },

    { label: 'Chaos Logs', href: '/chat' },

    { label: 'AI Tutor', href: '/tutor' },

    { label: 'Existential Threats', href: '/bullshit-detect' },

    { label: 'Voice Assistant', href: '/voice-assistant' },

    { label: 'Pose Attendance', href: '/pose-attendance' },

    { label: 'Help us', href: '/support' },

  ];



  it.each(EXPECTED_NAV)('nav has $label linking to $href', ({ label, href }) => {

    expect(content).toContain(href);

    expect(content).toContain(label);

  });



  it('nav or footer has profile link', () => {

    expect(content).toContain('/profile');

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



describe('Feature: Landing and dashboard', () => {

  it('landing page exists', () => {

    const p = path.join(APP_DIR, 'page.tsx');

    expect(fs.existsSync(p)).toBe(true);

  });



  it('dashboard page exists', () => {

    const p = path.join(APP_DIR, 'dashboard', 'page.tsx');

    expect(fs.existsSync(p)).toBe(true);

  });



  it('dashboard links to travel app and legacy tools', () => {

    const dashboardPath = path.join(APP_DIR, 'dashboard', 'page.tsx');

    const content = fs.readFileSync(dashboardPath, 'utf-8');

    expect(content).toContain('/home');

    const links = ['/tutor', '/chat', '/support', '/voice-assistant', '/bullshit-detect', '/pose-attendance', '/profile/edit'];

    links.forEach((href) => {

      expect(content).toContain(href);

    });

  });

});


