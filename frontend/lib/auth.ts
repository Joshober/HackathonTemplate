'use client';

import { api } from './api';

export interface User {
  sub: string;
  name: string;
  email: string;
  picture?: string;
  nickname?: string;
}

let currentUser: User | null = null;
let userPromise: Promise<User | null> | null = null;

export async function login(): Promise<void> {
  try {
    const response = await api.login();
    // Redirect to Auth0 login
    if (typeof window !== 'undefined' && response.auth_url) {
      window.location.href = response.auth_url;
    }
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}

export async function loginEmailPassword(email: string, password: string): Promise<User> {
  try {
    const response = await api.loginEmailPassword(email, password);
    // Clear cache and set new user
    currentUser = response.user;
    userPromise = null;
    return response.user;
  } catch (error) {
    console.error('Email/password login error:', error);
    throw error;
  }
}

export async function register(email: string, password: string, name?: string): Promise<User> {
  try {
    const response = await api.register(email, password, name);
    // Clear cache and set new user
    currentUser = response.user;
    userPromise = null;
    return response.user;
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
}

export async function logout(): Promise<void> {
  try {
    const response = await api.logout();
    // Clear local user
    currentUser = null;
    userPromise = null;
    
    // Redirect to logout URL if provided
    if (typeof window !== 'undefined' && response.logout_url) {
      window.location.href = response.logout_url;
    } else {
      // Just redirect to home
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    }
  } catch (error) {
    console.error('Logout error:', error);
    // Still clear user and redirect
    currentUser = null;
    userPromise = null;
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  }
}

export async function getCurrentUser(): Promise<User | null> {
  // Return cached user if available
  if (currentUser) {
    return currentUser;
  }

  // If there's already a pending request, return it
  if (userPromise) {
    return userPromise;
  }

  // Create new request
  userPromise = (async () => {
    try {
      const user = await api.getCurrentUser();
      currentUser = user;
      return user;
    } catch (error) {
      // 401 or other auth errors are expected when not logged in
      // Don't treat them as actual errors
      currentUser = null;
      return null;
    } finally {
      userPromise = null;
    }
  })();

  return userPromise;
}

export function clearUserCache(): void {
  currentUser = null;
  userPromise = null;
}
