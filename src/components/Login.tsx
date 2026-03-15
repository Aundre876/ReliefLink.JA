import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';

export type AuthRole = 'volunteer' | 'admin';

interface LoginProps {
  onLoginSuccess?: (role: AuthRole) => void;
  onGoToCreateShipment?: () => void;
}

function Login({ onLoginSuccess, onGoToCreateShipment }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secureEntry, setSecureEntry] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    if (!trimmedEmail || !trimmedPassword) {
      setError('Please enter both email and password.');
      return;
    }
    setLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword,
      });
      if (signInError) {
        if (signInError.message?.toLowerCase().includes('invalid') || signInError.message?.toLowerCase().includes('credentials')) {
          setError('Invalid login credentials.');
        } else {
          setError(signInError.message);
        }
        return;
      }
      let role: AuthRole = 'volunteer';
      if (data.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();
        if (profile?.role === 'admin') role = 'admin';
      }
      onLoginSuccess?.(role);
    } catch (err) {
      setError('Invalid login credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 sm:px-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleLogin(e);
        }}
        className="w-full max-w-md bg-white rounded-xl shadow-xl p-6 sm:p-8"
      >
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Log in</h1>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-600 mb-2">Email</label>
          <input
            type="email"
            className="w-full border border-gray-200 rounded-lg px-4 py-3 bg-gray-50 text-gray-800 placeholder-gray-400"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-600 mb-2">Password</label>
          <div className="flex flex-row items-center border border-gray-200 rounded-lg bg-gray-50">
            <input
              type={secureEntry ? 'password' : 'text'}
              className="flex-1 px-4 py-3 text-gray-800 bg-transparent border-0 focus:outline-none focus:ring-0"
              placeholder="Enter Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setSecureEntry(!secureEntry)}
              className="px-3 py-2 text-blue-600 font-semibold"
            >
              {secureEntry ? 'Show' : 'Hide'}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg py-3 text-center text-white font-bold text-lg transition-colors"
        >
          {loading ? 'Logging in...' : 'Log in'}
        </button>
        {onGoToCreateShipment && (
          <button
            type="button"
            onClick={onGoToCreateShipment}
            className="w-full py-2 mt-2 text-center text-blue-600 font-semibold"
          >
            Create Shipment →
          </button>
        )}
        <p className="mt-4 text-center text-gray-600 text-sm">
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="text-blue-600 font-semibold hover:underline">
            Sign up
          </Link>
        </p>
      </form>
    </div>
  );
}

export default Login;
