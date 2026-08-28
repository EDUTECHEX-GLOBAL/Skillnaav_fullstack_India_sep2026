import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, KeyRound, Save, ShieldCheck, CheckCircle2, AlertTriangle, Eye, EyeOff, ChevronDown } from 'lucide-react';

import axios from 'axios';

const defaults = { 
  sessionExpiry: 60, 
  forceLogout: true, 
  maxLoginAttempts: 5, 
  accountLockDuration: 30, 
  require2FA: true 
};

const settingsApi = axios.create({ baseURL: process.env.REACT_APP_API_BASE || "" });

settingsApi.interceptors.request.use((config) => {
  const token = localStorage.getItem("adminToken");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

settingsApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem("adminToken");
      window.location.href = "/admin/login";
    }
    return Promise.reject(error);
  }
);

export const getErrorMessage = (error, fallback) => {
  if (error?.response?.data?.message) return error.response.data.message;
  return fallback;
};

export const SecuritySettings = () => {
  
  const [values, setValues] = useState(defaults);
  const [initial, setInitial] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);


  // Accordion State
  const [isAuthExpanded, setIsAuthExpanded] = useState(false);
  const [isPasswordExpanded, setIsPasswordExpanded] = useState(false);

  // Change Password State

  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState(null); // { type: 'success' | 'error', text: '' }
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const requestPasswordOtp = async () => {
    if (newPassword.length < 8) {
      setPasswordStatus({ type: 'error', text: 'Password must be at least 8 characters.' });
      return;
    }
    setIsChangingPassword(true);
    try {
      await settingsApi.post('/api/admin/change-password-otp');
      setOtpSent(true);
      setPasswordStatus({ type: 'success', text: 'OTP sent to your email! Please enter it below to confirm.' });
    } catch (err) {
      setPasswordStatus({ type: 'error', text: getErrorMessage(err, 'Failed to send OTP') });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const updatePassword = async () => {
    if (!otp) {
      setPasswordStatus({ type: 'error', text: 'Please enter the OTP.' });
      return;
    }
    setIsChangingPassword(true);
    try {
      await settingsApi.post('/api/admin/change-password', { otp, newPassword });
      setPasswordStatus({ type: 'success', text: 'Password successfully updated!' });
      setOtpSent(false);
      setNewPassword('');
      setOtp('');
    } catch (err) {
      setPasswordStatus({ type: 'error', text: getErrorMessage(err, 'Failed to update password') });
    } finally {
      setIsChangingPassword(false);
    }
  };


  const load = useCallback(async () => { 
    setLoading(true); 
    try { 
      const { data } = await settingsApi.get("/api/admin/settings"); 
      const next = { ...defaults, ...data.securitySettings }; 
      setValues(next); 
      setInitial(next); 
    } catch (error) { 
      setNotice({ 
        type: "error", 
        text: getErrorMessage(error, "Could not load security settings.") 
      }); 
    } finally { 
      setLoading(false); 
    } 
  }, []);

  useEffect(() => { load(); }, [load]);

  const change = ({ target: { name, value, type, checked } }) => 
    setValues((current) => ({ 
      ...current, 
      [name]: type === "checkbox" ? checked : value 
    }));

  const dirty = JSON.stringify(values) !== JSON.stringify(initial);

  const save = async () => { 
    setSaving(true); 
    setNotice(null); 
    try { 
      const payload = { 
        ...values, 
        sessionExpiry: Number(values.sessionExpiry), 
        maxLoginAttempts: Number(values.maxLoginAttempts), 
        accountLockDuration: Number(values.accountLockDuration) 
      }; 
      const { data } = await settingsApi.put("/api/admin/settings", { 
        securitySettings: payload 
      }); 
      const next = { ...defaults, ...data.securitySettings }; 
      setValues(next); 
      setInitial(next); 
      setNotice({ 
        type: "success", 
        text: "Security policy saved successfully." 
      }); 
    } catch (error) { 
      setNotice({ 
        type: "error", 
        text: getErrorMessage(error, "Security settings could not be saved.") 
      }); 
    } finally { 
      setSaving(false); 
    } 
  };

  return (
    <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-200 m-2 sm:m-4 md:m-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-800">Security Policy</h3>
          <p className="text-sm text-gray-500 mt-1">
            Set administrator sign-in and password requirements
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl bg-gray-50 border border-gray-200 px-4 py-2.5 ">
          <ShieldCheck size={18} className="text-emerald-400" />
          <span className="text-sm font-semibold text-emerald-400">Protected</span>
        </div>
      </div>

      {notice && (
        <div className={`mb-6 rounded-xl border px-4 py-3 text-sm flex items-center gap-2  ${
          notice.type === "error"
            ? "border-red-200 bg-red-50 text-red-700"
            : "border-emerald-200 bg-emerald-50 text-emerald-700"
        }`}>
          {notice.type === "success" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          {notice.text}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="mb-3 animate-spin text-indigo-600" size={32} />
          <span className="text-sm text-gray-500">Loading security policy…</span>
        </div>
      ) : (
        <>
        <div className="space-y-6">
          {/* Authentication Rules */}
          <div className="rounded-2xl bg-blue-50/50 shadow-sm border border-blue-100 p-6">
            <button 
              type="button" 
              onClick={() => setIsAuthExpanded(!isAuthExpanded)}
              className="flex w-full items-center justify-between text-left focus:outline-none"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-400 to-pink-400 text-gray-800 shadow-lg">
                  <KeyRound size={18} />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-800">Authentication Rules</h4>
                  <p className="text-sm text-gray-500">Limit failed attempts and strengthen access</p>
                </div>
              </div>
              <ChevronDown 
                size={20} 
                className={`text-gray-400 transition-transform duration-200 ${isAuthExpanded ? 'rotate-180' : ''}`} 
              />
            </button>
            {isAuthExpanded && (
              <div className="grid gap-5 mt-5 pt-5 border-t border-blue-100">
              <div>
                <label className="block text-sm font-semibold text-gray-700">
                  Maximum Login Attempts
                </label>
                <p className="text-xs text-gray-400 mt-0.5">Between 1 and 20 attempts</p>
                <input
                  type="number"
                  name="maxLoginAttempts"
                  value={values.maxLoginAttempts}
                  min="1"
                  max="20"
                  onChange={change}
                  className="mt-2 w-full rounded-xl bg-gray-50 border border-gray-200 px-4 py-2.5 text-sm text-gray-800 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-200"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700">
                  Account Lock Duration
                </label>
                <p className="text-xs text-gray-400 mt-0.5">1 minute to 24 hours</p>
                <div className="relative mt-2">
                  <input
                    type="number"
                    name="accountLockDuration"
                    value={values.accountLockDuration}
                    min="1"
                    max="1440"
                    onChange={change}
                    className="w-full rounded-xl bg-gray-50 border border-gray-200 px-4 py-2.5 pr-16 text-sm text-gray-800 outline-none transition-all focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-200"
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                    minutes
                  </span>
                </div>
              </div>
            </div>
            )}
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-blue-100 bg-blue-50/50 p-4 transition-all hover:bg-blue-50/70 shadow-sm">
            <input
              type="checkbox"
              name="require2FA"
              checked={values.require2FA}
              onChange={change}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 bg-gray-50 text-indigo-600 focus:ring-cyan-400/20"
            />
            <div>
              <span className="block text-sm font-semibold text-gray-700">
                Require Two-Factor Authentication
              </span>
              <span className="mt-0.5 block text-xs leading-5 text-gray-500">
                Require an email OTP when administrators sign in
              </span>
            </div>
          </label>

          {/* Actions */}
          <div className="flex items-center justify-end gap-4">
            <p className="flex items-center gap-2 text-xs text-gray-400">
              <ShieldCheck size={14} />
              These rules apply to all administrator accounts
            </p>
            <button
              onClick={save}
              disabled={!dirty || saving}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Save Policy
            </button>
          </div>
        </div>

        
        {/* Change Password Card */}
        <div className="rounded-2xl bg-blue-50/50 shadow-sm border border-blue-100 p-6 mt-6">
          <button 
            type="button" 
            onClick={() => setIsPasswordExpanded(!isPasswordExpanded)}
            className="flex w-full items-center justify-between text-left focus:outline-none"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-400 to-blue-400 text-gray-800 shadow-lg">
                <KeyRound size={18} />
              </div>
              <div>
                <h4 className="font-semibold text-gray-800">Change Password</h4>
                <p className="text-sm text-gray-500">Securely update your admin account password</p>
              </div>
            </div>
            <ChevronDown 
              size={20} 
              className={`text-gray-400 transition-transform duration-200 ${isPasswordExpanded ? 'rotate-180' : ''}`} 
            />
          </button>
          
          {isPasswordExpanded && (
            <div className="mt-5 pt-5 border-t border-blue-100">
              {/* Stepper */}
            <div className="mb-10 flex items-center max-w-2xl">
              {[
                { num: 1, label: 'New password', isActive: true, isDone: newPassword.length >= 8 || otpSent || passwordStatus?.type === 'success' },
                { num: 2, label: 'Request OTP', isActive: newPassword.length >= 8 || otpSent, isDone: otpSent || passwordStatus?.type === 'success' },
                { num: 3, label: 'Enter OTP', isActive: otpSent || passwordStatus?.type === 'success', isDone: passwordStatus?.type === 'success' },
                { num: 4, label: 'Confirmed', isActive: passwordStatus?.type === 'success', isDone: passwordStatus?.type === 'success' },
              ].map((step, idx, arr) => (
                <React.Fragment key={step.num}>
                  {/* Step Item */}
                  <div className="relative flex flex-col items-center flex-1">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                      step.isDone 
                        ? 'border-emerald-600 bg-white text-emerald-600' 
                        : step.isActive && !step.isDone
                          ? 'border-[#2c5282] bg-[#2c5282] text-white' 
                          : 'border-gray-200 bg-white text-gray-400'
                    }`}>
                      {step.isDone ? <CheckCircle2 size={20} /> : <span className="text-sm font-semibold">{step.num}</span>}
                    </div>
                    <span className={`absolute -bottom-6 w-32 text-center text-sm font-medium ${
                      step.isActive || step.isDone ? 'text-gray-700' : 'text-gray-400'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                  {/* Connecting Line */}
                  {idx < arr.length - 1 && (
                    <div className="h-0.5 flex-1 bg-gray-200 mx-2">
                      <div className={`h-full transition-all ${arr[idx + 1].isActive ? 'bg-emerald-600' : 'bg-transparent'}`} style={{ width: arr[idx + 1].isActive ? '100%' : '0%' }}></div>
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Status Messages */}
            {passwordStatus && (
              <div className={`mb-6 flex items-center gap-2 rounded-lg p-3 text-sm max-w-md ${
                passwordStatus.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
              }`}>
                {passwordStatus.type === 'error' ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
                {passwordStatus.text}
              </div>
            )}
            
            {/* Form */}
            <div className="max-w-md mt-6">
              {!otpSent && passwordStatus?.type !== 'success' ? (
                <>
                  <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">New Password</label>
                  <div className="relative mb-2">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        setPasswordStatus(null);
                      }}
                      disabled={isChangingPassword}
                      className="w-full rounded-xl border border-gray-300 py-3 pl-4 pr-12 text-gray-800 focus:border-[#2c5282] focus:ring-1 focus:ring-[#2c5282] outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <p className="text-sm text-gray-500 mb-6">Minimum 8 characters.</p>

                  <button
                    onClick={requestPasswordOtp}
                    disabled={isChangingPassword || newPassword.length < 8}
                    className="rounded-lg bg-[#2c5282] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1a365d] disabled:opacity-50"
                  >
                    {isChangingPassword ? <Loader2 size={16} className="inline mr-2 animate-spin" /> : null}
                    Send code to my email
                  </button>
                </>
              ) : otpSent ? (
                <>
                  <label className="block text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wider">Verification OTP</label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => {
                      setOtp(e.target.value);
                      setPasswordStatus(null);
                    }}
                    disabled={isChangingPassword}
                    maxLength={6}
                    className="w-full rounded-xl border border-gray-300 py-3 px-4 text-gray-800 tracking-widest focus:border-[#2c5282] focus:ring-1 focus:ring-[#2c5282] outline-none mb-6"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={updatePassword}
                      disabled={isChangingPassword || !otp}
                      className="rounded-lg bg-[#2c5282] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1a365d] disabled:opacity-50"
                    >
                      {isChangingPassword ? <Loader2 size={16} className="inline mr-2 animate-spin" /> : null}
                      Update Password
                    </button>
                    <button
                      onClick={() => {
                        setOtpSent(false);
                        setPasswordStatus(null);
                      }}
                      disabled={isChangingPassword}
                      className="text-sm font-medium text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
          )}
        </div>
        </>
      )}
    </div>
  );
};

// ============ LAYOUT ============
