'use client';

import { useEffect, useState } from 'react';
import { getCurrentUser, login, loginEmailPassword, register, User } from '@/lib/auth';
import Link from 'next/link';

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
    
    // Check for error in URL params
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const errorParam = params.get('error');
      if (errorParam) {
        setError(errorParam);
        // Clear error from URL
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      // User not logged in is not an error
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    try {
      setError(null);
      await login();
    } catch (error: any) {
      const errorMessage = error?.message || 'Login failed';
      setError(errorMessage);
      console.error('Login error:', error);
    }
  };

  const handleEmailPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      const loggedInUser = await loginEmailPassword(email, password);
      setUser(loggedInUser);
      // Redirect to dashboard
      if (typeof window !== 'undefined') {
        window.location.href = '/dashboard';
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Login failed';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    try {
      const newUser = await register(email, password, name);
      setUser(newUser);
      // Redirect to dashboard
      if (typeof window !== 'undefined') {
        window.location.href = '/dashboard';
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Registration failed';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-xl p-8 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Graceland University
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Campus Navigation
        </p>
        
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
            {error === 'auth0_not_configured' || error.includes('Auth0 not configured')
              ? 'Auth0 is not configured. Please set AUTH0_DOMAIN, AUTH0_CLIENT_ID, and AUTH0_CLIENT_SECRET in backend .env file.'
              : `Error: ${error}`}
          </div>
        )}
        
        {isLoading ? (
          <div className="text-gray-500">Loading...</div>
        ) : user ? (
          <div className="space-y-4">
            <p className="text-gray-700">
              Welcome, <span className="font-semibold">{user.name || user.email}</span>!
            </p>
            <div className="flex space-x-4 justify-center">
              <Link
                href="/dashboard"
                className="inline-block bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
              >
                Go to Dashboard
              </Link>
              <Link
                href="/profile"
                className="inline-block border-2 border-indigo-600 text-indigo-600 px-6 py-3 rounded-lg font-semibold hover:bg-indigo-50 transition-colors"
              >
                View Profile
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {!showEmailLogin ? (
              <>
                <button
                  onClick={handleLogin}
                  className="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors"
                >
                  Login with Google
                </button>
                <button
                  onClick={() => setShowEmailLogin(true)}
                  className="w-full border-2 border-indigo-600 text-indigo-600 px-6 py-3 rounded-lg font-semibold hover:bg-indigo-50 transition-colors"
                >
                  Login with Email
                </button>
              </>
            ) : (
              <form onSubmit={isRegistering ? handleRegister : handleEmailPasswordLogin} className="space-y-4">
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="••••••••"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Please wait...' : isRegistering ? 'Sign Up' : 'Login'}
                </button>
                <div className="flex justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRegistering(!isRegistering);
                      setError(null);
                    }}
                    className="text-indigo-600 hover:text-indigo-700"
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
                    className="text-gray-600 hover:text-gray-700"
                  >
                    Back
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
