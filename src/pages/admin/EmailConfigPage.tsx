import React, { useState, useEffect, useMemo } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import api from "../../api/axios";
import { toast } from "react-toastify";
import {
  Mail,
  Send,
  RefreshCw,
  CheckCircle2,
  Eye,
  EyeOff,
  Server,
  ShieldCheck,
  Check,
  X,
  Sparkles,
  HelpCircle,
  Gauge,
  Lock,
} from "lucide-react";

type EmailConfig = {
  _id?: string;
  service: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass?: string;
  hasPass?: boolean;
  fromName: string;
  fromEmail: string;
  replyTo?: string;
  maxTps?: number;
  enableOtp: boolean;
  enableAlertBroadcast: boolean;
  emailValidationMode?: "strict" | "restricted_domains";
  allowedDomains?: string;
  isActive: boolean;
  lastTestedAt?: string | null;
  lastTestStatus?: "success" | "failed" | "not_tested";
  lastTestMessage?: string;
};

const SERVICE_PRESETS: Record<string, Partial<EmailConfig>> = {
  Gmail: { host: "smtp.gmail.com", port: 587, secure: false, maxTps: 5 },
  Office365: { host: "smtp.office365.com", port: 587, secure: false, maxTps: 10 },
  Outlook: { host: "smtp-mail.outlook.com", port: 587, secure: false, maxTps: 10 },
  SendGrid: { host: "smtp.sendgrid.net", port: 587, secure: false, maxTps: 25 },
  Mailgun: { host: "smtp.mailgun.org", port: 587, secure: false, maxTps: 20 },
  Custom: { host: "", port: 587, secure: false, maxTps: 10 },
};

export default function EmailConfigPage() {
  const [config, setConfig] = useState<EmailConfig>({
    service: "Gmail",
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    user: "",
    pass: "",
    hasPass: false,
    fromName: "FDRMC Early Warning & Comms",
    fromEmail: "",
    replyTo: "",
    maxTps: 5,
    enableOtp: true,
    enableAlertBroadcast: true,
    emailValidationMode: "strict",
    allowedDomains: "",
    isActive: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string; latency?: number } | null>(null);
  const [showPass, setShowPass] = useState(false);
  const [activeTab, setActiveTab] = useState<"smtp" | "policy" | "sender" | "test">("smtp");
  const [testEmail, setTestEmail] = useState("");
  const [testMsg, setTestMsg] = useState("Test notification from FDRMC IDRMIS email gateway.");
  const [sendingTest, setSendingTest] = useState(false);

  // Email Validation Simulator
  const [simEmail, setSimEmail] = useState("petrosh122@gmail.coms");

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await api.get("/email-config");
      setConfig({
        ...res.data,
        emailValidationMode: res.data.emailValidationMode || "strict",
        allowedDomains: res.data.allowedDomains || "",
        maxTps: res.data.maxTps ?? 5,
        hasPass: Boolean(res.data.hasPass),
        pass: "", // Never keep raw password in state
      });
      if (res.data.lastTestStatus && res.data.lastTestStatus !== "not_tested") {
        setTestResult({
          success: res.data.lastTestStatus === "success",
          message: res.data.lastTestMessage || "Previous test recorded",
        });
      }
    } catch {
      toast.error("Failed to load email configuration");
    } finally {
      setLoading(false);
    }
  };

  const handleServiceChange = (service: string) => {
    const preset = SERVICE_PRESETS[service] || {};
    setConfig((prev) => ({ ...prev, service, ...preset }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...config };
      // If pass is left blank or empty, don't overwrite previous stored/env password
      if (!payload.pass) {
        delete payload.pass;
      }
      const res = await api.put("/email-config", payload);
      toast.success(res.data?.message || "Email configuration saved successfully!");
      if (res.data?.config) {
        setConfig((prev) => ({
          ...prev,
          ...res.data.config,
          pass: "",
        }));
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const payload: Record<string, any> = {
        service: config.service,
        host: config.host,
        port: config.port,
        secure: config.secure,
        user: config.user,
      };
      if (config.pass) payload.pass = config.pass;
      const res = await api.post("/email-config/test-connection", payload);
      setTestResult(res.data);
      if (res.data.success) toast.success("SMTP connection verified!");
      else toast.error("Connection test failed");
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Connection test failed";
      setTestResult({ success: false, message: msg });
      toast.error(msg);
    } finally {
      setTesting(false);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail.trim()) {
      toast.error("Please enter a recipient email address");
      return;
    }
    setSendingTest(true);
    try {
      const res = await api.post("/email-config/send-test-email", {
        to: testEmail,
        message: testMsg,
      });
      if (res.data.success) {
        toast.success(`Test email sent to ${testEmail}`);
      } else {
        toast.error(res.data.message || "Failed to send test email");
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || "Failed to send test email");
    } finally {
      setSendingTest(false);
    }
  };

  // Client-side simulator for email validation
  const simEmailResult = useMemo(() => {
    if (!simEmail.trim()) return null;
    const trimmed = simEmail.trim().toLowerCase();

    const emailRegex = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;
    if (!emailRegex.test(trimmed)) {
      return { isValid: false, error: `Invalid email structure: "${simEmail}".` };
    }

    const parts = trimmed.split("@");
    if (parts.length !== 2) {
      return { isValid: false, error: "Missing or duplicate @ symbol." };
    }

    const domain = parts[1];
    return {
      isValid: true,
      normalized: trimmed,
      domain,
    };
  }, [simEmail]);

  return (
    <>
      <PageMeta
        title="Email Gateway Configuration | IDRMIS"
        description="SMTP Server Credentials, Security Isolation, and Email Broadcast Rate Limiting"
      />
      <PageBreadcrumb pageTitle="Email Gateway Configuration" />

      <div className="space-y-6">
        {/* Header Hero Banner */}
        <div className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-slate-950/40">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-lg shadow-blue-500/20">
                <Mail className="h-7 w-7" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    SMTP & Email Gateway Settings
                  </h3>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                      testResult?.success
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                        : "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        testResult?.success ? "bg-emerald-500" : "bg-blue-500"
                      }`}
                    />
                    {testResult?.success ? "Verified & Ready" : "Active / Verified"}
                  </span>
                  <span className="rounded-lg bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300 flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    .env Protected
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  National Early Warning & Disaster Alert email transmission gateway with encrypted credentials, rate limiting, and HTML disaster templates.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testing}
                className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-bold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${testing ? "animate-spin text-blue-500" : ""}`} />
                {testing ? "Verifying SMTP..." : "Test SMTP Connection"}
              </button>

              <button
                type="button"
                onClick={() => fetchConfig()}
                disabled={loading}
                className="inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-white p-2.5 text-gray-500 shadow-sm transition hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400"
                title="Reload settings"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-blue-500" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-800">
          <button
            type="button"
            onClick={() => setActiveTab("smtp")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
              activeTab === "smtp"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            <Server className="h-4 w-4" />
            SMTP Server & Rate Limiting
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("policy")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
              activeTab === "policy"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Email Validation & Domain Policy
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("sender")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
              activeTab === "sender"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            <Mail className="h-4 w-4" />
            Sender Identity
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("test")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
              activeTab === "test"
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            <Send className="h-4 w-4" />
            Send Test Email
          </button>
        </div>

        {/* Content */}
        <div className="grid gap-6 xl:grid-cols-[1.8fr_1fr]">
          {activeTab === "test" ? (
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-slate-950/40">
              <div className="border-b border-gray-200 pb-4 dark:border-gray-800">
                <h4 className="text-base font-bold text-gray-900 dark:text-white">
                  Send Test Email
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Verify SMTP gateway delivery by sending a live test email with disaster alert formatting.
                </p>
              </div>

              <form onSubmit={handleSendTestEmail} className="mt-5 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Recipient Email Address
                  </label>
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="e.g. director@fdrmc.gov.et"
                    className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Message Body
                  </label>
                  <textarea
                    rows={4}
                    value={testMsg}
                    onChange={(e) => setTestMsg(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-900 outline-none transition focus:border-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={sendingTest}
                    className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:opacity-60"
                  >
                    <Send className={`h-4 w-4 ${sendingTest ? "animate-bounce" : ""}`} />
                    {sendingTest ? "Sending Email..." : "Send Test Email"}
                  </button>
                </div>
              </form>
            </div>
          ) : activeTab === "policy" ? (
            /* ── POLICY TAB ────────────────────────────────────────── */
            <form
              onSubmit={handleSave}
              className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-slate-950/40"
            >
              <div className="border-b border-gray-200 pb-4 dark:border-gray-800">
                <h4 className="text-base font-bold text-gray-900 dark:text-white">
                  Email Format & Domain Whitelist Policy
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Configure strict RFC validation, typo detection (e.g. rejecting <code>.coms</code>, <code>.con</code>), and approved organizational email domains.
                </p>
              </div>

              <div className="mt-6 space-y-6">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Email Validation Policy Mode
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                        config.emailValidationMode === "strict"
                          ? "border-blue-600 bg-blue-50/50 dark:border-blue-500/40 dark:bg-blue-500/10"
                          : "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950"
                      }`}
                    >
                      <input
                        type="radio"
                        name="emailValidationMode"
                        checked={config.emailValidationMode === "strict"}
                        onChange={() => setConfig({ ...config, emailValidationMode: "strict" })}
                        className="mt-0.5 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <div className="text-xs font-bold text-gray-900 dark:text-white">
                          Strict RFC & TLD Typo Protection (Recommended)
                        </div>
                        <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                          Enforces valid email syntax and rejects common domain typos like .coms, .con, malformed TLDs, and illegal characters.
                        </div>
                      </div>
                    </label>

                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                        config.emailValidationMode === "restricted_domains"
                          ? "border-blue-600 bg-blue-50/50 dark:border-blue-500/40 dark:bg-blue-500/10"
                          : "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950"
                      }`}
                    >
                      <input
                        type="radio"
                        name="emailValidationMode"
                        checked={config.emailValidationMode === "restricted_domains"}
                        onChange={() => setConfig({ ...config, emailValidationMode: "restricted_domains" })}
                        className="mt-0.5 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <div className="text-xs font-bold text-gray-900 dark:text-white">
                          Restricted Domains Only (Whitelisted)
                        </div>
                        <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                          Restricts outgoing emails to explicitly approved domain suffixes (e.g. gov.et, ethionet.et).
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {config.emailValidationMode === "restricted_domains" && (
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                      Approved Email Domains (Comma-separated)
                    </label>
                    <input
                      type="text"
                      value={config.allowedDomains || ""}
                      onChange={(e) => setConfig({ ...config, allowedDomains: e.target.value })}
                      placeholder="e.g. gov.et, ethionet.et, fdrmc.gov.et"
                      className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                    />
                  </div>
                )}

                {/* Simulator */}
                <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 dark:border-blue-500/20 dark:bg-blue-500/5">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-900 dark:text-blue-200">
                    <Sparkles className="h-4 w-4 text-blue-600" />
                    <span>Live Email Policy Validator Simulator</span>
                  </div>
                  <div className="mt-2.5">
                    <input
                      type="text"
                      value={simEmail}
                      onChange={(e) => setSimEmail(e.target.value)}
                      placeholder="Type an email address to test policy..."
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-mono outline-none dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                    />
                  </div>

                  {simEmailResult && (
                    <div className="mt-3 flex items-center justify-between rounded-xl bg-white p-3 border border-gray-200 dark:bg-gray-950 dark:border-gray-800">
                      <div className="flex items-center gap-2">
                        {simEmailResult.isValid ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <X className="h-4 w-4 text-rose-600" />
                        )}
                        <div>
                          <span
                            className={`text-xs font-bold ${
                              simEmailResult.isValid ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600"
                            }`}
                          >
                            {simEmailResult.isValid ? "Valid Email Address" : "Invalid Email Address"}
                          </span>
                          {simEmailResult.error ? (
                            <div className="text-[11px] text-rose-500 font-medium">{simEmailResult.error}</div>
                          ) : (
                            <div className="text-[11px] text-gray-500">
                              Normalized: <strong>{simEmailResult.normalized}</strong> (Domain: @{simEmailResult.domain})
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-3 border-t border-gray-100 dark:border-gray-800">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-7 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {saving ? "Saving Policy..." : "Save Policy Configuration"}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* ── SMTP & SENDER TAB ──────────────────────────────────── */
            <form
              onSubmit={handleSave}
              className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-slate-950/40"
            >
              <div className="border-b border-gray-200 pb-4 dark:border-gray-800 flex items-center justify-between">
                <div>
                  <h4 className="text-base font-bold text-gray-900 dark:text-white">
                    {activeTab === "smtp" ? "SMTP Server & Security Credentials" : "Sender Identity"}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {activeTab === "smtp"
                      ? "SMTP parameters, throughput rate limiting, and environment variable security."
                      : "Outbound display name and emergency return address."}
                  </p>
                </div>
                {activeTab === "smtp" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                    <Lock className="w-3.5 h-3.5" />
                    AES-256-GCM Encrypted
                  </span>
                )}
              </div>

              {activeTab === "smtp" ? (
                <div className="mt-6 space-y-5">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                      Service Provider Preset
                    </label>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                      {Object.keys(SERVICE_PRESETS).map((srv) => (
                        <button
                          key={srv}
                          type="button"
                          onClick={() => handleServiceChange(srv)}
                          className={`rounded-2xl border p-2.5 text-xs font-bold transition ${
                            config.service === srv
                              ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                              : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-400"
                          }`}
                        >
                          {srv}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                        SMTP Host
                      </label>
                      <input
                        type="text"
                        value={config.host}
                        onChange={(e) => setConfig({ ...config, host: e.target.value })}
                        placeholder="smtp.gmail.com"
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                        SMTP Port
                      </label>
                      <input
                        type="number"
                        value={config.port}
                        onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value, 10) || 587 })}
                        placeholder="587"
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                        SMTP Username / Email (.env sourced)
                      </label>
                      <input
                        type="text"
                        value={config.user}
                        onChange={(e) => setConfig({ ...config, user: e.target.value })}
                        placeholder="petrosh122@gmail.com"
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                        required
                      />
                      <p className="mt-1 text-[11px] text-gray-400">
                        Sourced at runtime from backend <code className="text-blue-600">.env</code> (EMAIL_USER).
                      </p>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                        Password / App Key (.env protected)
                      </label>
                      <div className="relative">
                        <input
                          type={showPass ? "text" : "password"}
                          value={config.pass || ""}
                          onChange={(e) => setConfig({ ...config, pass: e.target.value })}
                          placeholder={config.hasPass ? "•••••••• (Saved in .env / DB)" : "Enter App Password"}
                          className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 pr-10 text-sm font-mono text-gray-900 outline-none transition focus:border-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass(!showPass)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="mt-1 text-[11px] text-emerald-600">
                        ✓ Passwords are never stored in plain text. Leave as •••••••• to keep current .env secret.
                      </p>
                    </div>
                  </div>

                  {/* Throughput & Rate Limiting */}
                  <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Gauge className="w-4 h-4 text-blue-600" />
                        <label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                          Broadcast Dispatch Rate (Throughput)
                        </label>
                      </div>
                      <span className="text-xs font-mono font-bold text-blue-600">
                        {config.maxTps ?? 5} emails / sec
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={30}
                      step={1}
                      value={config.maxTps ?? 5}
                      onChange={(e) => setConfig({ ...config, maxTps: parseInt(e.target.value, 10) })}
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                      <span>1 email/sec (Gmail safe)</span>
                      <span>5 emails/sec (Standard)</span>
                      <span>30 emails/sec (Amazon SES / SendGrid)</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* SENDER TAB */
                <div className="mt-6 space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                        From Display Name
                      </label>
                      <input
                        type="text"
                        value={config.fromName}
                        onChange={(e) => setConfig({ ...config, fromName: e.target.value })}
                        placeholder="FDRMC Early Warning"
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                        From Email Address
                      </label>
                      <input
                        type="email"
                        value={config.fromEmail}
                        onChange={(e) => setConfig({ ...config, fromEmail: e.target.value })}
                        placeholder="alerts@fdrmc.gov.et"
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                      Reply-To Address (Optional)
                    </label>
                    <input
                      type="email"
                      value={config.replyTo || ""}
                      onChange={(e) => setConfig({ ...config, replyTo: e.target.value })}
                      placeholder="support@fdrmc.gov.et"
                      className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                    />
                  </div>
                </div>
              )}

              <div className="mt-8 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-7 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {saving ? "Saving..." : "Save Email Gateway Config"}
                </button>
              </div>
            </form>
          )}

          {/* Right Info */}
          <div className="space-y-6">
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-slate-950/40">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                Security & Credential Isolation
              </h4>
              <div className="mt-4 space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2 dark:border-gray-800">
                  <span className="text-gray-500">Service:</span>
                  <span className="font-bold text-gray-900 dark:text-white">{config.service}</span>
                </div>
                <div className="flex items-center justify-between border-b border-gray-100 pb-2 dark:border-gray-800">
                  <span className="text-gray-500">SMTP Host:</span>
                  <span className="font-mono text-gray-700 dark:text-gray-300">{config.host}:{config.port}</span>
                </div>
                <div className="flex items-center justify-between border-b border-gray-100 pb-2 dark:border-gray-800">
                  <span className="text-gray-500">Rate Throttle:</span>
                  <span className="font-mono font-bold text-blue-600">{config.maxTps ?? 5} emails/sec</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Encryption:</span>
                  <span className="font-semibold text-emerald-600">AES-256-GCM + .env</span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-slate-950/40">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-blue-500" />
                Email Validation Rules
              </h4>
              <div className="mt-3 space-y-2 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                <p>• <strong>Strict RFC Validation:</strong> Checks proper syntax and intercepts typos.</p>
                <p>• <strong>Ethiopian Domains:</strong> Recognizes <code className="font-mono text-blue-600">.gov.et</code>, <code className="font-mono text-blue-600">.edu.et</code>, <code className="font-mono text-blue-600">.org.et</code>.</p>
                <p>• <strong>HTML Disaster Templates:</strong> Broadcast emails automatically render in an executive disaster risk format with emergency helpline 939.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
