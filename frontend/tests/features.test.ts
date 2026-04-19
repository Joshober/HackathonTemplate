/**
 * Feature tests: ensure Travel Companion routes and API surface are present.
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

const EXPECTED_ROUTES = ['', 'home', 'explorer', 'assistant', 'team', 'profile', 'profile/edit', 'profile/new', 'api/auth/callback'];

describe('Feature: All routes exist', () => {
  it.each(EXPECTED_ROUTES)('route "%s" has a page', (route) => {
    const pagePath = pagePathForRoute(route);
    const exists = fs.existsSync(pagePath);
    expect(exists, `Missing: ${pagePath}`).toBe(true);
  });
});

describe('Feature: Legacy paths redirect in next.config', () => {
  it('next.config defines redirects to /home', () => {
    const p = path.join(__dirname, '../next.config.ts');
    const content = fs.readFileSync(p, 'utf-8');
    expect(content).toContain('redirects');
    expect(content).toContain("destination: '/home'");
    expect(content).toContain("'/chat'");
    expect(content).toContain("'/explorer'");
    expect(content).toContain("'/explore/:path*'");
  });
});

describe('Feature: Travel bottom navigation', () => {
  const navPath = path.join(__dirname, '../components/travel/BottomNav.tsx');
  const content = fs.readFileSync(navPath, 'utf-8');
  const tabs = ['/home', '/assistant', '/team', '/profile'];
  it.each(tabs)('bottom nav includes %s', (href) => {
    expect(content).toContain(href);
  });
  it('bottom nav does not include explore', () => {
    expect(content).not.toContain('/explore');
    expect(content).not.toContain('/explorer');
  });
});

describe('Feature: API client exports (Travel product)', () => {
  const apiPath = path.join(__dirname, '../lib/api.ts');
  const content = fs.readFileSync(apiPath, 'utf-8');

  const EXPECTED_METHODS = [
    'getProfile',
    'createProfile',
    'updateProfile',
    'getItems',
    'createItem',
    'updateItem',
    'searchExplorerOpportunities',
    'fetchTravelPricingPreview',
    'transcribeAudio',
    'generateVoice',
    'chatPipeline',
    'createTicket',
    'listTeams',
    'getTeam',
    'sendTeamMessage',
  ];

  it.each(EXPECTED_METHODS)('api has method %s', (method) => {
    expect(content).toContain(`async ${method}(`);
  });
});

describe('Feature: Travel day itinerary', () => {
  it('TravelDayItinerary includes stable today copy', () => {
    const p = path.join(__dirname, '../components/travel/TravelDayItinerary.tsx');
    const content = fs.readFileSync(p, 'utf-8');
    expect(content).toContain('Today');
    expect(content).toContain('No trip record on file yet');
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
