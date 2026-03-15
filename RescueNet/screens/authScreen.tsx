import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { supabase } from '../services/supabaseClient';

const roles = [
  { label: 'Customer', value: 'customer' },
  { label: 'Driver', value: 'driver' },
  { label: 'Admin', value: 'admin' },
];

export type AuthRole = 'customer' | 'driver' | 'admin';

interface AuthScreenProps {
  onLoginSuccess?: (role: AuthRole) => void;
  onGoToCreateShipment?: () => void;
}

const AuthScreen = ({ onLoginSuccess, onGoToCreateShipment }: AuthScreenProps) => {
  const [isRegister, setIsRegister] = useState(false);
  const [role, setRole] = useState<AuthRole>('customer');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secureEntry, setSecureEntry] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    setError(null);
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    if (!trimmedEmail || !trimmedPassword) {
      setError('Please enter both email and password.');
      return;
    }
    setLoading(true);
    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password: trimmedPassword,
      });
      if (signUpError) throw signUpError;
      Alert.alert('Success', 'Account created. Please check your email to confirm.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Sign up failed. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    setError(null);
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    if (!trimmedEmail || !trimmedPassword) {
      setError('Please enter both email and password.');
      return;
    }
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword,
      });
      if (signInError) throw signInError;
      onLoginSuccess?.(role);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid login credentials.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = () => {
    if (isRegister) {
      handleSignUp();
    } else {
      handleLogin();
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-white justify-center px-6"
    >
      <View className="bg-white rounded-xl shadow-xl p-8">
        <View className="flex-row items-center justify-between mb-6">
          <Text className="text-2xl font-bold text-gray-800">
            {isRegister ? 'Register' : 'Login'}
          </Text>
          <View className="flex-row items-center">
            <Text className="mr-1 text-gray-500">Login</Text>
            <Switch
              value={isRegister}
              onValueChange={(v) => { setIsRegister(v); setError(null); }}
              thumbColor={isRegister ? '#2563eb' : '#aaa'}
              trackColor={{ false: '#d1d5db', true: '#93c5fd' }}
              accessibilityLabel="Toggle register or login"
            />
            <Text className="ml-1 text-gray-500">Register</Text>
          </View>
        </View>
        
        {error && (
          <View className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
            <Text className="text-red-700 text-sm">{error}</Text>
          </View>
        )}

        <View className="mb-4">
          <Text className="text-sm font-semibold text-gray-600 mb-2">
            Select Role
          </Text>
          <View className="flex-row gap-x-3">
            {roles.map((r) => (
              <TouchableOpacity
                key={r.value}
                onPress={() => setRole(r.value as AuthRole)}
                activeOpacity={0.8}
                className={`flex-1 items-center py-3 rounded-lg border-2 ${
                  role === r.value
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 bg-gray-50'
                }`}
              >
                <Text
                  className={
                    role === r.value
                      ? 'text-blue-600 font-bold'
                      : 'text-gray-700'
                  }
                >
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View className="mb-4">
          <Text className="text-sm font-semibold text-gray-600 mb-2">Email</Text>
          <TextInput
            className="border border-gray-200 rounded-lg px-4 py-3 bg-gray-50 text-gray-800"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="your@email.com"
            value={email}
            onChangeText={setEmail}
            placeholderTextColor="#a1a1aa"
          />
        </View>

        <View className="mb-6">
          <Text className="text-sm font-semibold text-gray-600 mb-2">Password</Text>
          <View className="flex-row items-center border border-gray-200 rounded-lg bg-gray-50">
            <TextInput
              className="flex-1 px-4 py-3 text-gray-800"
              secureTextEntry={secureEntry}
              value={password}
              onChangeText={setPassword}
              placeholder="Enter Password"
              placeholderTextColor="#a1a1aa"
              autoCapitalize="none"
            />
            <TouchableOpacity
              onPress={() => setSecureEntry(!secureEntry)}
              className="px-3 py-2"
            >
              <Text className="text-blue-600 font-semibold">
                {secureEntry ? "Show" : "Hide"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          className="bg-blue-600 rounded-lg py-3 mb-2 disabled:opacity-50"
          onPress={handleAuth}
          activeOpacity={0.85}
          disabled={loading}
        >
          <Text className="text-center text-white font-bold text-lg">
            {loading ? 'Please wait...' : isRegister ? 'Register' : 'Login'}
          </Text>
        </TouchableOpacity>
        {onGoToCreateShipment && (
          <TouchableOpacity
            onPress={onGoToCreateShipment}
            className="py-2 mt-2"
          >
            <Text className="text-center text-blue-600 font-semibold">
              Create Shipment →
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
};

export default AuthScreen;