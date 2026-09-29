import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Database, CloudRain, Smartphone, Download, ShieldCheck, ChevronDown, Building2, GraduationCap, CheckCircle2, AlertTriangle, UserPlus, Sparkles, Bot, Globe, Mail, MessageSquare, Newspaper } from 'lucide-react';

import axios from 'axios';

const platformDefaults = { 
  studentReg: true, 
  partnerReg: true, 
  schoolReg: false, 
  aiShortlisting: true, 
  mockInterviews: true, 
  maintenanceMode: false,
  requireAdminApproval: true
};

const notificationsDefaults = {
  emailNotif: true,
  smsAlerts: false,
  weeklyDigest: true,
  newSignups: true
};

const dataSettingsDefaults = {
  automatedBackups: true,
  strictDeviceLimits: false,
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

const notificationsItems = [
  { key: "emailNotif", label: "Email notifications", desc: "Platform updates and alerts, sent to your inbox.", icon: Mail, tint: "text-sky-600 bg-sky-50" },
  { key: "smsAlerts", label: "SMS alerts", desc: "Critical security alerts, sent as a text message.", icon: MessageSquare, tint: "text-violet-600 bg-violet-50" },
  { key: "weeklyDigest", label: "Weekly digest", desc: "A summary of platform activity, once a week.", icon: Newspaper, tint: "text-amber-600 bg-amber-50" },
  { key: "newSignups", label: "New registration alerts", desc: "A notice when a partner or school registers.", icon: UserPlus, tint: "text-rose-600 bg-rose-50" },
];

export const PlatformConfigSettings = () => {
  
  const platformItems = [
    { key: "studentReg", label: "Student Registration", desc: "Allow new students to create accounts.", icon: UserPlus, color: "from-blue-400 to-cyan-400" },
    { key: "schoolReg", label: "School Registration", desc: "Allow institutions to create accounts.", icon: GraduationCap, color: "from-emerald-400 to-teal-400" },
    { key: "partnerReg", label: "Partner Registration", desc: "Allow companies to register.", icon: Building2, color: "from-purple-400 to-pink-400" },
    { key: "aiShortlisting", label: "AI Shortlisting", desc: "Enable automated candidate screening.", icon: Sparkles, color: "from-amber-400 to-orange-400" },
    { key: "mockInterviews", label: "Mock Interview Module", desc: "Coming soon - Not yet connected.", icon: Bot, color: "from-slate-400 to-slate-400", unavailable: true },
    { key: "maintenanceMode", label: "Maintenance Mode", desc: "Restrict access for all non-admin users.", icon: AlertTriangle, color: "from-rose-400 to-red-400", danger: true },
    { key: "requireAdminApproval", label: "Require Admin Approval", desc: "New posts must be approved by an admin before going live.", icon: ShieldCheck, color: "from-sky-400 to-indigo-400" },
  ];

  const [features, setFeatures] = useState(platformDefaults);
  const [isPlatformExpanded, setIsPlatformExpanded] = useState(false);
  const [isNotifExpanded, setIsNotifExpanded] = useState(false);
  const [isDataExpanded, setIsDataExpanded] = useState(false);
  const [dataFeatures, setDataFeatures] = useState(dataSettingsDefaults);
  const [notifFeatures, setNotifFeatures] = useState(notificationsDefaults);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState("");
  const [notice, setNotice] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [confirmPrompt, setConfirmPrompt] = useState(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    try { 
      const { data } = await settingsApi.get("/api/admin/settings"); 
      if (data.platformFeatures) setFeatures({ ...platformDefaults, ...data.platformFeatures }); 
      if (data.notificationsSettings) setNotifFeatures({ ...notificationsDefaults, ...data.notificationsSettings });
      if (data.dataSettings) setDataFeatures({ ...dataSettingsDefaults, ...data.dataSettings });
    } catch (error) { 
      setNotice({ 
        type: "error", 
        text: getErrorMessage(error, "Could not load settings.") 
      }); 
    } finally { 
      setLoading(false); 
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const savePlatform = async (key, value, providedReason = null) => {
    const isSensitive = key === "maintenanceMode" || value === false;
    
    if (isSensitive && providedReason === null) {
      setConfirmPrompt({ key, value });
      setReason("");
      return;
    }

    if (isSensitive && providedReason.trim().length < 10) {
      setNotice({ type: "error", text: "A reason of at least 10 characters is required." });
      return;
    }

    const previous = features;
    const next = { ...features, [key]: value };
    setFeatures(next);
    setSavingKey(key);
    setNotice(null);
    setConfirmPrompt(null);
    try {
      await settingsApi.put("/api/admin/settings", { 
        platformFeatures: { [key]: value },
        reason: providedReason
      });
      setNotice({ type: "success", text: "Platform setting updated." });
    } catch (error) { 
      setFeatures(previous); 
      setNotice({ 
        type: "error", 
        text: getErrorMessage(error, "The change could not be saved.") 
      }); 
    } finally { 
      setSavingKey(""); 
    }
  };

  const toggleNotifChange = async (key) => {
    const value = !notifFeatures[key];
    const previous = notifFeatures;
    setNotifFeatures({ ...notifFeatures, [key]: value });
    setSavingKey(key);
    setNotice(null);

    try {
      await settingsApi.put("/api/admin/settings", {
        notificationsSettings: { [key]: value }
      });
      setNotice({ type: "success", text: "Notification setting updated." });
    } catch (err) {
      setNotifFeatures(previous);
      setNotice({ type: "error", text: getErrorMessage(err, "Couldn't save that change. Try again.") });
    } finally {
      setSavingKey("");
    }
  };

  const toggleDataChange = async (key) => {
    const value = !dataFeatures[key];
    const previous = dataFeatures;
    setDataFeatures({ ...dataFeatures, [key]: value });
    setSavingKey(key);
    setNotice(null);

    try {
      await settingsApi.put("/api/admin/settings", {
        dataSettings: { [key]: value }
      });
      setNotice({ type: "success", text: "Data and security setting updated." });
    } catch (error) {
      setDataFeatures(previous);
      setNotice({ type: "error", text: getErrorMessage(error, "The change could not be saved.") });
    } finally {
      setSavingKey("");
    }
  };

  const exportUserData = async () => {
    setExporting(true);
    setNotice(null);
    try {
      const response = await settingsApi.get("/api/admin/settings/export/users", { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([response.data], { type: "text/csv" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `skillnaav-users-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setNotice({ type: "success", text: "User data export downloaded." });
    } catch (error) {
      setNotice({ type: "error", text: getErrorMessage(error, "Unable to export user data.") });
    } finally {
      setExporting(false);
    }
  };

  const dataItems = [
    { key: "automatedBackups", label: "Automated Weekly Backups", desc: "Auto-export database to secure cloud storage every Sunday.", icon: CloudRain, tint: "text-blue-600 bg-blue-50" },
    { key: "strictDeviceLimits", label: "Strict Device Limits", desc: "Prevent students from logging into more than 2 devices simultaneously.", icon: Smartphone, tint: "text-rose-600 bg-rose-50" },
  ];

  const activeCount = Object.values(notifFeatures).filter(Boolean).length;

  return (
    <div className="space-y-6 m-2 sm:m-4 md:m-6 max-w-4xl">
      {notice && (
        <div className={`rounded-xl border px-4 py-3 text-sm flex items-center gap-2 ${
          notice.type === "error"
            ? "border-red-200 bg-red-50 text-red-700"
            : "border-emerald-200 bg-emerald-50 text-emerald-700"
        }`}>
          {notice.type === "success" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          {notice.text}
        </div>
      )}

      {/* Platform Controls */}
      <div className="rounded-2xl bg-blue-50/50 shadow-sm border border-blue-100 p-6">
        <button 
          type="button" 
          onClick={() => setIsPlatformExpanded(!isPlatformExpanded)}
          className="flex w-full items-center justify-between text-left focus:outline-none mb-6"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400 to-cyan-400 text-gray-800 shadow-lg">
              <Globe size={18} className="text-white" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-800">Platform Controls</h4>
              <p className="text-sm text-gray-500">Changes take effect across SkillNaav immediately</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-xl bg-white border border-gray-200 px-3 py-1.5 shadow-sm">
              <Globe size={14} className="text-emerald-500" />
              <span className="text-xs font-bold tracking-wide text-emerald-500 uppercase">Live</span>
            </div>
            <ChevronDown 
              size={20} 
              className={`text-gray-400 transition-transform duration-200 ${isPlatformExpanded ? 'rotate-180' : ''}`} 
            />
          </div>
        </button>

        {isPlatformExpanded && (
          loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="mb-3 animate-spin text-indigo-600" size={32} />
            <span className="text-sm text-gray-500">Loading platform controls…</span>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {platformItems.map(({ key, label, desc, icon: Icon, color, unavailable, danger }) => (
              <div key={key} className={`group relative rounded-2xl bg-gray-50 border p-5 transition-all ${
                danger && features[key] 
                  ? 'border-red-500/30 bg-red-500/10 hover:bg-red-500/20' 
                  : 'border-gray-200 hover:bg-gray-100 hover:border-gray-300'
              } ${unavailable ? 'opacity-50' : ''}`}>
                <div className="flex items-start gap-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${color} shadow-lg`}>
                    <Icon size={20} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                          {label}
                          {unavailable && (
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                              Coming Soon
                            </span>
                          )}
                        </h4>
                        <p className="mt-1 text-sm text-gray-500">{desc}</p>
                      </div>
                      {!unavailable && (
                        savingKey === key ? (
                          <Loader2 size={20} className="animate-spin text-indigo-600 mt-1" />
                        ) : (
                          <button
                            onClick={() => savePlatform(key, !features[key])}
                            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center justify-start rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 ${
                              features[key] 
                                ? danger ? 'bg-red-600' : 'bg-indigo-600'
                                : 'bg-gray-200'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                features[key] ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
        )}
      </div>

      {/* Notifications Controls */}
      <div className="rounded-2xl bg-blue-50/50 shadow-sm border border-blue-100 p-6">
        <button 
          type="button" 
          onClick={() => setIsNotifExpanded(!isNotifExpanded)}
          className="flex w-full items-center justify-between text-left focus:outline-none mb-6"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400 to-cyan-400 text-gray-800 shadow-lg">
              <Mail size={18} className="text-white" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-800">Notifications</h4>
              <p className="text-sm text-gray-500">Choose which platform communications you receive.</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <div className="flex shrink-0 flex-col items-end gap-1">
              <div className="flex items-center gap-1" aria-hidden="true">
                {notificationsItems.map(({ key }) => (
                  <span
                    key={key}
                    className={`h-4 w-1.5 rounded-full transition-colors duration-300 ${
                      notifFeatures[key] ? 'bg-indigo-600' : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>
              <span className="font-mono text-[10px] tabular-nums text-gray-400 uppercase tracking-wide font-bold">
                {activeCount}/{notificationsItems.length} on
              </span>
            </div>
            <ChevronDown 
              size={20} 
              className={`text-gray-400 transition-transform duration-200 ${isNotifExpanded ? 'rotate-180' : ''}`} 
            />
          </div>
        </button>

        {isNotifExpanded && (
          loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Loader2 className="animate-spin text-gray-400" size={24} />
            <span className="text-sm text-gray-500">Loading notification settings…</span>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {notificationsItems.map(({ key, label, desc, icon: Icon, tint }) => (
              <li key={key} className="flex items-start gap-4 py-4">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tint}`}>
                  <Icon size={18} strokeWidth={2} />
                </div>

                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-semibold text-gray-800">{label}</h4>
                  <p className="mt-0.5 text-sm text-gray-500">{desc}</p>
                </div>

                <div className="flex h-10 shrink-0 items-center">
                  {savingKey === key ? (
                    <Loader2 size={18} className="animate-spin text-gray-400" />
                  ) : (
                    <button
                      type="button"
                      role="switch"
                      aria-checked={notifFeatures[key]}
                      onClick={() => toggleNotifChange(key)}
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
                        notifFeatures[key] ? 'bg-indigo-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                          notifFeatures[key] ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )
        )}
      </div>



      {/* Data & Security Controls */}
      <div className="rounded-2xl bg-blue-50/50 shadow-sm border border-blue-100 p-6">
        <button 
          type="button" 
          onClick={() => setIsDataExpanded(!isDataExpanded)}
          className="flex w-full items-center justify-between text-left focus:outline-none mb-6"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400 to-cyan-400 text-gray-800 shadow-lg">
              <Database size={18} className="text-white" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-800">Data & Security</h4>
              <p className="text-sm text-gray-500">Manage platform backups, limits, and exports.</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-4">
            <ChevronDown 
              size={20} 
              className={`text-gray-400 transition-transform duration-200 ${isDataExpanded ? 'rotate-180' : ''}`} 
            />
          </div>
        </button>

        {isDataExpanded && (
          <div className="space-y-6">
            <ul className="divide-y divide-gray-100">
              {dataItems.map(({ key, label, desc, icon: Icon, tint }) => (
                <li key={key} className="flex items-start gap-4 py-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tint}`}>
                    <Icon size={18} strokeWidth={2} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold text-gray-800">{label}</h4>
                    <p className="mt-0.5 text-sm text-gray-500">{desc}</p>
                  </div>

                  <div className="flex h-10 shrink-0 items-center">
                    {savingKey === key ? (
                      <Loader2 size={18} className="animate-spin text-gray-400" />
                    ) : (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={dataFeatures[key]}
                        onClick={() => toggleDataChange(key)}
                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 ${
                          dataFeatures[key] ? 'bg-indigo-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                            dataFeatures[key] ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            
            <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-semibold text-gray-800">Export User Data</h4>
                <p className="text-sm text-gray-500 mt-0.5">Generate a CSV spreadsheet of all registered users.</p>
              </div>
              <button 
                type="button"
                onClick={exportUserData}
                disabled={exporting}
                className="flex items-center gap-2 rounded-xl bg-white border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 hover:text-indigo-600 transition-colors shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {exporting ? "Exporting..." : "Export CSV"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Sensitive Change</h3>
            </div>
            <p className="mb-4 text-sm text-gray-500">
              You are about to make a sensitive change to the platform's availability. Please provide a reason (minimum 10 characters).
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Disabling registration for maintenance window..."
              className="mb-4 w-full rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-900 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-200"
              rows={3}
            />
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => setConfirmPrompt(null)}
                className="rounded-xl px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={() => savePlatform(confirmPrompt.key, confirmPrompt.value, reason)}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlatformConfigSettings;
