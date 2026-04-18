'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser, login, loginEmailPassword, register, User } from '@/lib/auth';
import Link from 'next/link';
import LandingPage from '@/components/LandingPage';
import { motion } from 'motion/react';

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUser();
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const errorParam = params.get('error');
      if (errorParam) {
        setError(errorParam);
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      setError(null);
      await login();
    } catch (error: unknown) {
      const err = error as { message?: string };
      setError(err?.message || 'Login failed');
    }
  };

  const handleEmailPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await loginEmailPassword(email, password);
      if (typeof window !== 'undefined') window.location.href = '/home';
    } catch (error: unknown) {
      const err = error as { message?: string };
      setError(err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(email, password, name);
      if (typeof window !== 'undefined') window.location.href = '/home';
    } catch (error: unknown) {
      const err = error as { message?: string };
      setError(err?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const navContent = (
    <div className="flex items-center gap-4">
      {!isLoading && user ? (
        <>
          <Link href="/home" className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg font-semibold text-sm transition-colors">
            Open Travel Companion
          </Link>
          <Link href="/profile" className="text-sm text-gray-600 hover:text-gray-900 transition-colors font-medium">
            Profile
          </Link>
        </>
      ) : (
        <Link href="/home" className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-lg font-semibold text-sm transition-colors">
          Open Travel Companion
        </Link>
      )}
    </div>
  );

  return (
    <>
      <LandingPage>{navContent}</LandingPage>

      {/* Login modal / card - fixed overlay when showEmailLogin or when user not logged in and we want to show login on same page */}
      {!isLoading && !user && showEmailLogin && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-md bg-white border border-gray-200 rounded-2xl p-8 shadow-2xl shine-overlay"
          >
            <h3 className="text-xl font-semibold mb-6 text-gray-900">
              {isRegistering ? 'Create account' : 'Sign in'}
            </h3>
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
                {error === 'auth0_not_configured' || error.includes('Auth0 not configured')
                  ? 'Auth0 is not configured. Use email login or set AUTH0_* in backend .env.'
                  : error}
              </div>
            )}
            <form
              onSubmit={isRegistering ? handleRegister : handleEmailPasswordLogin}
              className="space-y-4"
            >
              {isRegistering && (
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                    Name (optional)
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 shadow-sm"
                    placeholder="Your name"
                  />
                </div>
              )}
              <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 shadow-sm"
                  placeholder="your@email.com"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 shadow-sm"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50"
              >
                {loading ? 'Please wait...' : isRegistering ? 'Sign Up' : 'Login'}
              </button>
            </form>
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <button
                type="button"
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setError(null);
                }}
                className="text-blue-600 hover:text-violet-700 font-medium"
              >
                {isRegistering ? 'Already have an account? Login' : "Don't have an account? Sign up"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowEmailLogin(false);
                  setError(null);
                  setEmail('');
                  setPassword('');
                  setName('');
                }}
                className="text-gray-500 hover:text-gray-900"
              >
                Close
              </button>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleLogin}
                className="w-full py-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors text-sm font-medium bg-white"
              >
                Login with Google (Auth0)
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Floating login trigger when not logged in - small button to open email login */}
      {!isLoading && !user && !showEmailLogin && (
        <div className="fixed bottom-8 right-8 z-50">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowEmailLogin(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-5 py-2.5 rounded-xl text-sm shadow-lg shadow-blue-900/20"
          >
            Sign in
          </motion.button>
        </div>
      )}
    </>
  );
}
