import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { LOGISTICS_HUBS } from '../services/routing';

const ROLES = [
  { label: 'Volunteer', value: 'volunteer' },
  { label: 'Admin', value: 'admin' },
] as const;

type ProfileRole = (typeof ROLES)[number]['value'];

export default function SignUp() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<ProfileRole>('volunteer');
  const [parishHub, setParishHub] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [secureEntry, setSecureEntry] = useState(true);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    if (!trimmedEmail || !trimmedPassword) {
      setError('Please enter both email and password.');
      return;
    }
    if (!parishHub) {
      setError('Please select your Parish Hub.');
      return;
    }
    setLoading(true);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: trimmedPassword,
      });
      if (signUpError) throw signUpError;
      if (data.user) {
        const { error: profileError } = await supabase.from('profiles').upsert(
          { id: data.user.id, role, parish_hub: parishHub },
          { onConflict: 'id' }
        );
        if (profileError) {
          console.error('Profile upsert error:', profileError);
        }
        navigate('/logistics', { replace: true });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign up failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 sm:px-6">
      <form
        onSubmit={handleSignUp}
        className="w-full max-w-md bg-white rounded-xl shadow-xl p-6 sm:p-8"
      >
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Create Account</h1>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-600 mb-2">Role</label>
          <div className="flex gap-3">
            {ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setRole(r.value)}
                className={`flex-1 py-3 rounded-lg border-2 text-center transition-colors ${
                  role === r.value
                    ? 'border-blue-600 bg-blue-50 text-blue-600 font-bold'
                    : 'border-gray-200 bg-gray-50 text-gray-700'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-600 mb-2">Parish Hub</label>
          <select
            value={parishHub}
            onChange={(e) => setParishHub(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-4 py-3 bg-gray-50 text-gray-800"
            required
          >
            <option value="">Select your hub...</option>
            {LOGISTICS_HUBS.map((hub) => (
              <option key={hub.id} value={hub.id}>
                {hub.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-semibold text-gray-600 mb-2">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full border border-gray-200 rounded-lg px-4 py-3 bg-gray-50 text-gray-800 placeholder-gray-400"
            autoComplete="email"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-600 mb-2">Password</label>
          <div className="flex items-center border border-gray-200 rounded-lg bg-gray-50">
            <input
              type={secureEntry ? 'password' : 'text'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 characters"
              className="flex-1 px-4 py-3 text-gray-800 bg-transparent border-0 focus:outline-none focus:ring-0"
              autoComplete="new-password"
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
          {loading ? 'Creating account...' : 'Sign Up'}
        </button>

        <p className="mt-4 text-center text-gray-600 text-sm">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 font-semibold hover:underline">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
