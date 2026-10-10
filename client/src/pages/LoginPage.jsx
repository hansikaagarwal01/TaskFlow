import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Layers, Crown, Shield, User, Lock, Mail, ArrowRight, UserPlus, LogIn, AlertCircle } from 'lucide-react';

export const LoginPage = () => {
  const { login, register, demoLogin } = useAuth();
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  // Form Fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('sarah.jenkins@taskflow.io');
  const [password, setPassword] = useState('password123');
  const [confirmPassword, setConfirmPassword] = useState('');

  // UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleToggleMode = (mode) => {
    setIsRegisterMode(mode);
    setError('');
    if (mode) {
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    } else {
      setEmail('sarah.jenkins@taskflow.io');
      setPassword('password123');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Client-side validation for Register Mode
    if (isRegisterMode) {
      if (!name.trim() || name.trim().length < 2) {
        setError('Full name must be at least 2 characters long.');
        return;
      }
      if (!email.trim() || !email.includes('@')) {
        setError('Please enter a valid work email address.');
        return;
      }
      if (!password || password.length < 8) {
        setError('Password must be at least 8 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match. Please verify your password.');
        return;
      }
    }

    setLoading(true);
    try {
      if (isRegisterMode) {
        await register(name.trim(), email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
    } catch (err) {
      setError(err.message || (isRegisterMode ? 'Registration failed. Please try again.' : 'Login failed. Please check your credentials.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF6F0] flex flex-col justify-center items-center p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 rounded-2xl bg-[#561C24] flex items-center justify-center mx-auto text-[#FAF6F0] shadow-md">
            <Layers className="w-8 h-8" />
          </div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold text-[#2C1819] tracking-tight">
            TaskFlow
          </h1>
          <p className="text-xs text-[#6B5B52]">
            Internal Enterprise Task & Workflow Management Platform
          </p>
        </div>

        {/* Quick Demo Accounts Switcher Bar */}
        <div className="card-beige p-5 space-y-3 rounded-2xl">
          <div className="flex items-center gap-2 text-xs font-bold text-[#561C24] uppercase tracking-wider">
            <Crown className="w-3.5 h-3.5 text-[#561C24]" />
            <span>1-Click Demo Accounts</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => demoLogin('u-mgr-1')}
              className="p-3 rounded-xl bg-[#F6F0E8] hover:bg-[#E8D8C4]/50 border border-[#E8D8C4] text-left transition-all cursor-pointer"
            >
              <div className="flex items-center gap-1.5 font-bold text-xs text-[#2C1819]">
                <Crown className="w-3.5 h-3.5 text-[#561C24]" />
                <span>Manager</span>
              </div>
              <p className="text-[11px] text-[#6B5B52] truncate mt-0.5">Sarah Jenkins</p>
            </button>

            <button
              type="button"
              onClick={() => demoLogin('u-ldr-eng')}
              className="p-3 rounded-xl bg-[#F6F0E8] hover:bg-[#E8D8C4]/50 border border-[#E8D8C4] text-left transition-all cursor-pointer"
            >
              <div className="flex items-center gap-1.5 font-bold text-xs text-[#2C1819]">
                <Shield className="w-3.5 h-3.5 text-[#6D2932]" />
                <span>Leader</span>
              </div>
              <p className="text-[11px] text-[#6B5B52] truncate mt-0.5">Alex Rivera</p>
            </button>

            <button
              type="button"
              onClick={() => demoLogin('u-emp-eng1')}
              className="p-3 rounded-xl bg-[#F6F0E8] hover:bg-[#E8D8C4]/50 border border-[#E8D8C4] text-left transition-all cursor-pointer"
            >
              <div className="flex items-center gap-1.5 font-bold text-xs text-[#2C1819]">
                <User className="w-3.5 h-3.5 text-[#2D6A4F]" />
                <span>Employee</span>
              </div>
              <p className="text-[11px] text-[#6B5B52] truncate mt-0.5">David Kim</p>
            </button>
          </div>
        </div>

        {/* Main Authentication Card */}
        <div className="card-beige p-7 rounded-2xl space-y-5">
          {/* Mode Selector Header Tabs */}
          <div className="flex items-center bg-[#F6F0E8] p-1 rounded-xl border border-[#E8D8C4]">
            <button
              type="button"
              onClick={() => handleToggleMode(false)}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                !isRegisterMode ? 'bg-white text-[#561C24] shadow-sm border border-[#E8D8C4]' : 'text-[#6B5B52] hover:text-[#2C1819]'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              onClick={() => handleToggleMode(true)}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                isRegisterMode ? 'bg-white text-[#561C24] shadow-sm border border-[#E8D8C4]' : 'text-[#6B5B52] hover:text-[#2C1819]'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Create TaskFlow ID</span>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-[#FDF2F2] border border-[#F8C8C8] text-xs text-[#9B2C2C] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Full Name field (Register Mode Only) */}
            {isRegisterMode && (
              <div>
                <label className="block text-xs font-bold text-[#2C1819] mb-1">Full Name *</label>
                <div className="relative">
                  <User className="w-4 h-4 text-[#8F7E75] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-field input-field-icon-left rounded-xl"
                    placeholder="e.g. Jordan Lee"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#2C1819] mb-1">Work Email *</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#8F7E75] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field input-field-icon-left rounded-xl"
                  placeholder="jordan.lee@taskflow.io"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#2C1819] mb-1">Password *</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#8F7E75] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field input-field-icon-left rounded-xl"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Confirm Password field (Register Mode Only) */}
            {isRegisterMode && (
              <div>
                <label className="block text-xs font-bold text-[#2C1819] mb-1">Confirm Password *</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#8F7E75] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="input-field input-field-icon-left rounded-xl"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary justify-center py-2.5 text-xs rounded-xl mt-2 shadow-sm"
            >
              <span>{loading ? 'Processing...' : isRegisterMode ? 'Create TaskFlow ID Account' : 'Sign In to TaskFlow'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Mode Switch Link */}
          <div className="text-center pt-1 border-t border-[#F0E6D8]">
            {isRegisterMode ? (
              <p className="text-xs text-[#6B5B52]">
                Already have a TaskFlow ID?{' '}
                <button
                  type="button"
                  onClick={() => handleToggleMode(false)}
                  className="text-[#561C24] font-bold hover:underline cursor-pointer"
                >
                  Sign In
                </button>
              </p>
            ) : (
              <p className="text-xs text-[#6B5B52]">
                Need a TaskFlow account?{' '}
                <button
                  type="button"
                  onClick={() => handleToggleMode(true)}
                  className="text-[#561C24] font-bold hover:underline cursor-pointer"
                >
                  Create TaskFlow ID
                </button>
              </p>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-[#6B5B52]">
          Default demo password: <code className="text-[#2C1819] font-mono font-bold">password123</code>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
