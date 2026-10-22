import React, { useState, useEffect } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import api from "../../api/axios";
import { toast } from "react-toastify";
import {
  Server,
  Send,
  RefreshCw,
  CheckCircle2,
  Radio,
  Phone,
  Sliders,
  HelpCircle,
  ShieldCheck,
  Check,
  X,
  Sparkles,
  Globe,
  Gauge,
  Eye,
  EyeOff,
} from "lucide-react";

type SmsConfig = {
  _id?: string;
  systemId?: string; // read-only display from .env — not editable
  host: string;
  port: number;
  protocol: string;
  systemType?: string;
  sourceAddr?: string;
  sourceAddrTon?: number;
  sourceAddrNpi?: number;
  destAddrTon?: number;
  destAddrNpi?: number;
  dataCoding?: number;
  enquireLinkIntervalMs?: number;
  reconnectIntervalMs?: number;
  phoneValidationMode?: "ethiopia_only" | "all";
  allowedOperators?: string[];
  maxTps?: number;
  dlrEnabled?: boolean;
  httpEndpoint?: string | null;
  httpMethod?: "POST" | "GET";
  httpAuthType?: "bearer" | "api_key" | "basic" | "none";
  httpApiKey?: string | null;
  hasHttpApiKey?: boolean;
  httpHeaders?: string | null;
  httpPayloadTemplate?: string | null;
  isActive?: boolean;
  lastTestedAt?: string | null;
  lastTestStatus?: "success" | "failed" | "not_tested";
  lastTestMessage?: string;
};

export default function SmsConfigPage() {
  const [config, setConfig] = useState<SmsConfig>({
    host: "10.204.181.70",
    port: 5019,
    protocol: "SMPP3.4",
    systemType: "",
    sourceAddr: "FDRMC",
    sourceAddrTon: 5,
    sourceAddrNpi: 0,
    destAddrTon: 1,
    destAddrNpi: 1,
    dataCoding: 0,
    enquireLinkIntervalMs: 30000,
    reconnectIntervalMs: 10000,
    maxTps: 20,
    dlrEnabled: true,
    httpEndpoint: "",
    httpMethod: "POST",
    httpAuthType: "bearer",
    httpApiKey: "",
    httpHeaders: "",
    httpPayloadTemplate: '{"to":"{{phone}}","message":"{{message}}","sender":"{{senderId}}"}',
    phoneValidationMode: "ethiopia_only",
    allowedOperators: ["ethio_telecom", "safaricom"],
    isActive: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testResult, setTestResult] = useState<{
    success?: boolean;
    message?: string;
    latency?: number;
  } | null>(null);

  // Test SMS state
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState(
    "Test emergency notification from FDRMC IDRMIS Telecom Gateway."
  );
  const [sendingTestSms, setSendingTestSms] = useState(false);
  const [activeTab, setActiveTab] = useState<"general" | "policy" | "advanced" | "test">("general");

  // Phone Validation Simulator
  const [simPhone, setSimPhone] = useState("0911223344");

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const response = await api.get("/sms-config");
      if (response.data) {
        setConfig({
          ...response.data,
          phoneValidationMode: response.data.phoneValidationMode || "ethiopia_only",
          allowedOperators: response.data.allowedOperators || ["ethio_telecom", "safaricom"],
          maxTps: response.data.maxTps ?? 20,
          dlrEnabled: response.data.dlrEnabled ?? true,
          httpMethod: response.data.httpMethod || "POST",
          httpAuthType: response.data.httpAuthType || "bearer",
          httpEndpoint: response.data.httpEndpoint || "",
          httpHeaders: response.data.httpHeaders || "",
          httpPayloadTemplate:
            response.data.httpPayloadTemplate ||
            '{"to":"{{phone}}","message":"{{message}}","sender":"{{senderId}}"}',
        });
        if (response.data.lastTestStatus && response.data.lastTestStatus !== "not_tested") {
          setTestResult({
            success: response.data.lastTestStatus === "success",
            message: response.data.lastTestMessage || "Previous test recorded",
          });
        }
      }
    } catch (error: any) {
      console.error("Failed to load SMS configuration", error);
      toast.error(error?.response?.data?.message || "Failed to load SMS configuration");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await api.put("/sms-config", config);
      toast.success(response.data?.message || "SMS Gateway configuration saved successfully!");
      if (response.data?.config) {
        setConfig((prev) => ({
          ...prev,
          ...response.data.config,
        }));
      }
    } catch (error: any) {
      console.error("Save error:", error);
      toast.error(error?.response?.data?.message || "Failed to save SMS configuration");
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const response = await api.post("/sms-config/test-connection", config);
      setTestResult(response.data);
      if (response.data.success) {
        toast.success(response.data.message || "Connected to Gateway successfully!");
      } else {
        toast.error(response.data.message || "Failed to connect to Gateway");
      }
    } catch (error: any) {
      const msg = error?.response?.data?.message || error.message || "Connection test failed";
      setTestResult({ success: false, message: msg });
      toast.error(msg);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSendTestSms = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone.trim()) {
      toast.warning("Please enter a recipient phone number");
      return;
    }
    setSendingTestSms(true);
    try {
      const response = await api.post("/sms-config/send-test-sms", {
        phone: testPhone,
        message: testMessage,
      });
      if (response.data?.success) {
        toast.success(response.data.message || `Test SMS sent to ${testPhone}`);
      } else {
        toast.error(response.data?.message || "Failed to send test SMS");
      }
    } catch (error: any) {
      const msg = error?.response?.data?.message || "Failed to send test SMS";
      toast.error(msg);
    } finally {
      setSendingTestSms(false);
    }
  };

  // Presets
  const applyPreset = (preset: "ethio_smpp" | "ethio_rest" | "safaricom_smpp") => {
    if (preset === "ethio_smpp") {
      setConfig((prev) => ({
        ...prev,
        protocol: "SMPP3.4",
        host: "10.204.181.70",
        port: 5019,
        sourceAddr: "FDRMC",
        sourceAddrTon: 5,
        sourceAddrNpi: 0,
        destAddrTon: 1,
        destAddrNpi: 1,
        maxTps: 20,
        dlrEnabled: true,
      }));
      toast.info("Applied Ethio Telecom SMPP 3.4 preset (10.204.181.70:5019)");
    } else if (preset === "ethio_rest") {
      setConfig((prev) => ({
        ...prev,
        protocol: "HTTP",
        httpEndpoint: "https://api.ethiotelecom.et/v1/sms/send",
        httpMethod: "POST",
        httpAuthType: "bearer",
        sourceAddr: "FDRMC",
        maxTps: 50,
        dlrEnabled: true,
      }));
      toast.info("Applied Ethio Telecom Cloud REST API preset");
    } else if (preset === "safaricom_smpp") {
      setConfig((prev) => ({
        ...prev,
        protocol: "SMPP3.4",
        host: "10.150.20.10",
        port: 2775,
        sourceAddr: "FDRMC",
        sourceAddrTon: 5,
        sourceAddrNpi: 0,
        destAddrTon: 1,
        destAddrNpi: 1,
        maxTps: 25,
        dlrEnabled: true,
      }));
      toast.info("Applied Safaricom Ethiopia SMPP preset");
    }
  };

  // Client-side simulation of Ethiopian phone validation
  const testPhoneSimResult = React.useMemo(() => {
    if (!simPhone.trim()) return null;
    let cleaned = simPhone.trim().replace(/[\s\-\(\)\.]/g, "");
    if (cleaned.startsWith("+")) cleaned = cleaned.substring(1);
    if (/^0[97]\d{8}$/.test(cleaned)) cleaned = "251" + cleaned.substring(1);

    const isEthio = /^2519\d{8}$/.test(cleaned);
    const isSafari = /^2517\d{8}$/.test(cleaned);

    const allowed = config.allowedOperators || ["ethio_telecom", "safaricom"];
    if (isEthio) {
      const isAllowed = allowed.includes("ethio_telecom");
      return {
        isValid: isAllowed,
        normalized: cleaned,
        formatted: `+251 ${cleaned.substring(3, 5)} ${cleaned.substring(5, 8)} ${cleaned.substring(8)}`,
        operator: "Ethio Telecom (09)",
        error: isAllowed ? undefined : "Ethio Telecom (09) is disabled in active policy.",
      };
    }
    if (isSafari) {
      const isAllowed = allowed.includes("safaricom");
      return {
        isValid: isAllowed,
        normalized: cleaned,
        formatted: `+251 ${cleaned.substring(3, 5)} ${cleaned.substring(5, 8)} ${cleaned.substring(8)}`,
        operator: "Safaricom Ethiopia (07)",
        error: isAllowed ? undefined : "Safaricom Ethiopia (07) is disabled in active policy.",
      };
    }
    if (config.phoneValidationMode === "all" && /^\d{7,15}$/.test(cleaned)) {
      return {
        isValid: true,
        normalized: cleaned,
        formatted: `+${cleaned}`,
        operator: "International",
      };
    }
    return {
      isValid: false,
      normalized: cleaned,
      error: "Invalid format. Must be a 10-digit number starting with 09 (Ethio Telecom) or 07 (Safaricom), or +2519 / +2517.",
    };
  }, [simPhone, config.allowedOperators, config.phoneValidationMode]);

  const isHttpProtocol = (config.protocol || "").toUpperCase() === "HTTP" || (config.protocol || "").toUpperCase() === "REST";

  return (
    <>
      <PageMeta
        title="SMS Gateway Configuration | IDRMIS"
        description="SMPP 3.4 & HTTP REST Telecommunications Gateway Configuration & TPS Rate Limiting"
      />
      <PageBreadcrumb pageTitle="SMS Gateway Configuration" />

      <div className="space-y-6">
        {/* Header banner */}
        <div className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-slate-950/40">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg shadow-amber-500/20">
                <Radio className="h-7 w-7" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {isHttpProtocol ? "HTTP / REST API Gateway" : "SMPP v3.4 Telecommunications Gateway"}
                  </h3>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                      testResult?.success
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                        : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        testResult?.success ? "bg-emerald-500" : "bg-amber-500"
                      }`}
                    />
                    {testResult?.success ? "Connected & Ready" : "Standby / Testing"}
                  </span>
                  <span className="rounded-lg bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                    Max {config.maxTps ?? 20} TPS
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  National Early Warning SMS Dispatch System supporting direct SMPP 3.4 sockets, HTTP REST Web APIs, and Ethiopian mobile telecom networks.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testingConnection}
                className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-bold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${testingConnection ? "animate-spin text-amber-500" : ""}`}
                />
                {testingConnection
                  ? "Testing Connectivity..."
                  : isHttpProtocol
                  ? "Test HTTP Endpoint"
                  : "Test SMPP Connection Pool"}
              </button>

              <button
                type="button"
                onClick={() => fetchConfig()}
                disabled={loading}
                className="inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-white p-2.5 text-gray-500 shadow-sm transition hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400"
                title="Reload settings"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-amber-500" : ""}`} />
              </button>
            </div>
          </div>

          {/* Quick Presets Bar */}
          <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800/80 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mr-1">
              Telecom Presets:
            </span>
            <button
              type="button"
              onClick={() => applyPreset("ethio_smpp")}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-amber-50 hover:text-amber-700 dark:bg-gray-800 dark:hover:bg-amber-950/40 dark:text-gray-300 transition"
            >
              🇪🇹 Ethio Telecom SMPP (10.204.181.70:5019)
            </button>
            <button
              type="button"
              onClick={() => applyPreset("ethio_rest")}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-blue-50 hover:text-blue-700 dark:bg-gray-800 dark:hover:bg-blue-950/40 dark:text-gray-300 transition"
            >
              ☁️ Ethio Telecom Cloud REST API
            </button>
            <button
              type="button"
              onClick={() => applyPreset("safaricom_smpp")}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-emerald-50 hover:text-emerald-700 dark:bg-gray-800 dark:hover:bg-emerald-950/40 dark:text-gray-300 transition"
            >
              🟢 Safaricom Ethiopia SMPP
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-800">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
              activeTab === "general"
                ? "border-amber-500 text-amber-600 dark:text-amber-400"
                : "border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            <Server className="h-4 w-4" />
            Gateway Credentials & Protocol
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("policy")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
              activeTab === "policy"
                ? "border-amber-500 text-amber-600 dark:text-amber-400"
                : "border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            Phone Number Validation Policy
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("advanced")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
              activeTab === "advanced"
                ? "border-amber-500 text-amber-600 dark:text-amber-400"
                : "border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            <Sliders className="h-4 w-4" />
            Addressing & Encoding
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("test")}
            className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
              activeTab === "test"
                ? "border-amber-500 text-amber-600 dark:text-amber-400"
                : "border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            }`}
          >
            <Send className="h-4 w-4" />
            Send Live Test SMS
          </button>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 xl:grid-cols-[1.8fr_1fr]">
          {activeTab === "test" ? (
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-slate-950/40">
              <div className="border-b border-gray-200 pb-4 dark:border-gray-800">
                <h4 className="text-base font-bold text-gray-900 dark:text-white">
                  Send Test SMS Message
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Send a real-time test SMS via the configured gateway ({config.protocol}) to any mobile phone number.
                </p>
              </div>

              <form onSubmit={handleSendTestSms} className="mt-5 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Recipient Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={testPhone}
                      onChange={(e) => setTestPhone(e.target.value)}
                      placeholder="e.g. 0911223344 or +251911223344"
                      className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-10 pr-4 text-sm text-gray-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                      required
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-gray-400">
                    Accepts 10-digit Ethiopian local (09... / 07...) or international format (+251...).
                  </p>
                </div>

                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                      Message Content
                    </label>
                    <span className="text-[11px] text-gray-400">
                      {testMessage.length} / 160 chars
                    </span>
                  </div>
                  <textarea
                    rows={4}
                    value={testMessage}
                    maxLength={160}
                    onChange={(e) => setTestMessage(e.target.value)}
                    className="w-full rounded-2xl border border-gray-200 bg-white p-4 text-sm leading-relaxed text-gray-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={sendingTestSms}
                    className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition hover:bg-amber-600 disabled:opacity-60"
                  >
                    <Send className={`h-4 w-4 ${sendingTestSms ? "animate-bounce" : ""}`} />
                    {sendingTestSms ? "Transmitting SMS..." : "Send Test SMS Now"}
                  </button>
                </div>
              </form>
            </div>
          ) : activeTab === "policy" ? (
            /* ── PHONE VALIDATION & POLICY TAB ────────────────────────────── */
            <form
              onSubmit={handleSave}
              className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-slate-950/40"
            >
              <div className="border-b border-gray-200 pb-4 dark:border-gray-800">
                <h4 className="text-base font-bold text-gray-900 dark:text-white">
                  Ethiopian Telecom Phone Validation Policy
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Configure allowed phone number formats and telecom operators (Ethio Telecom 09, Safaricom 07) to reject invalid numbers before transmission.
                </p>
              </div>

              <div className="mt-6 space-y-6">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Phone Number Format Restriction
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                        config.phoneValidationMode === "ethiopia_only"
                          ? "border-amber-500 bg-amber-50/50 dark:border-amber-500/40 dark:bg-amber-500/10"
                          : "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950"
                      }`}
                    >
                      <input
                        type="radio"
                        name="phoneValidationMode"
                        checked={config.phoneValidationMode === "ethiopia_only"}
                        onChange={() => setConfig({ ...config, phoneValidationMode: "ethiopia_only" })}
                        className="mt-0.5 text-amber-500 focus:ring-amber-500"
                      />
                      <div>
                        <div className="text-xs font-bold text-gray-900 dark:text-white">
                          Ethiopian Mobile Numbers Only (Recommended)
                        </div>
                        <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                          Strictly accept 10-digit Ethio Telecom (09...) and Safaricom (07...) or +2519 / +2517. Rejects all invalid numbers.
                        </div>
                      </div>
                    </label>

                    <label
                      className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${
                        config.phoneValidationMode === "all"
                          ? "border-amber-500 bg-amber-50/50 dark:border-amber-500/40 dark:bg-amber-500/10"
                          : "border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-950"
                      }`}
                    >
                      <input
                        type="radio"
                        name="phoneValidationMode"
                        checked={config.phoneValidationMode === "all"}
                        onChange={() => setConfig({ ...config, phoneValidationMode: "all" })}
                        className="mt-0.5 text-amber-500 focus:ring-amber-500"
                      />
                      <div>
                        <div className="text-xs font-bold text-gray-900 dark:text-white">
                          All Numbers (Ethiopia + International E.164)
                        </div>
                        <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                          Allows Ethiopian numbers as well as international numbers with valid country codes.
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Allowed Ethiopian Telecom Operators
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={config.allowedOperators?.includes("ethio_telecom") ?? true}
                          onChange={(e) => {
                            const current = config.allowedOperators || ["ethio_telecom", "safaricom"];
                            const updated = e.target.checked
                              ? [...current, "ethio_telecom"]
                              : current.filter((op) => op !== "ethio_telecom");
                            setConfig({ ...config, allowedOperators: updated });
                          }}
                          className="rounded text-amber-500 focus:ring-amber-500"
                        />
                        <div>
                          <div className="text-xs font-bold text-gray-900 dark:text-white">
                            Ethio Telecom
                          </div>
                          <div className="text-[11px] text-gray-400 font-mono">
                            Prefix: 09... / +2519...
                          </div>
                        </div>
                      </div>
                      <span className="rounded-lg bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                        Active
                      </span>
                    </label>

                    <label className="flex cursor-pointer items-center justify-between rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={config.allowedOperators?.includes("safaricom") ?? true}
                          onChange={(e) => {
                            const current = config.allowedOperators || ["ethio_telecom", "safaricom"];
                            const updated = e.target.checked
                              ? [...current, "safaricom"]
                              : current.filter((op) => op !== "safaricom");
                            setConfig({ ...config, allowedOperators: updated });
                          }}
                          className="rounded text-amber-500 focus:ring-amber-500"
                        />
                        <div>
                          <div className="text-xs font-bold text-gray-900 dark:text-white">
                            Safaricom Ethiopia
                          </div>
                          <div className="text-[11px] text-gray-400 font-mono">
                            Prefix: 07... / +2517...
                          </div>
                        </div>
                      </div>
                      <span className="rounded-lg bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                        Active
                      </span>
                    </label>
                  </div>
                </div>

                {/* Simulator */}
                <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-4 dark:border-amber-500/20 dark:bg-amber-500/5">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
                    <Sparkles className="h-4 w-4 text-amber-600" />
                    <span>Live Policy Phone Validator Simulator</span>
                  </div>
                  <div className="mt-2.5">
                    <input
                      type="text"
                      value={simPhone}
                      onChange={(e) => setSimPhone(e.target.value)}
                      placeholder="Type a phone number to test policy..."
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-mono outline-none dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                    />
                  </div>

                  {testPhoneSimResult && (
                    <div className="mt-3 flex items-center justify-between rounded-xl bg-white p-3 border border-gray-200 dark:bg-gray-950 dark:border-gray-800">
                      <div className="flex items-center gap-2">
                        {testPhoneSimResult.isValid ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <X className="h-4 w-4 text-rose-600" />
                        )}
                        <div>
                          <span
                            className={`text-xs font-bold ${
                              testPhoneSimResult.isValid ? "text-emerald-700 dark:text-emerald-400" : "text-rose-600"
                            }`}
                          >
                            {testPhoneSimResult.isValid ? "Valid Phone Number" : "Invalid Phone Number"}
                          </span>
                          {testPhoneSimResult.error ? (
                            <div className="text-[11px] text-rose-500">{testPhoneSimResult.error}</div>
                          ) : (
                            <div className="text-[11px] text-gray-500">
                              Normalized: <strong>{testPhoneSimResult.normalized}</strong> ({testPhoneSimResult.operator})
                            </div>
                          )}
                        </div>
                      </div>

                      {testPhoneSimResult.isValid && testPhoneSimResult.formatted && (
                        <span className="font-mono text-xs font-bold text-gray-700 dark:text-gray-300">
                          {testPhoneSimResult.formatted}
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-3 border-t border-gray-100 dark:border-gray-800">
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-7 py-3 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition hover:bg-amber-600 disabled:opacity-60"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {saving ? "Saving Policy..." : "Save Policy Configuration"}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* ── GENERAL & ADVANCED SETTINGS ─────────────────────────────── */
            <form
              onSubmit={handleSave}
              className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-slate-950/40"
            >
              <div className="flex items-center justify-between border-b border-gray-200 pb-4 dark:border-gray-800">
                <div>
                  <h4 className="text-base font-bold text-gray-900 dark:text-white">
                    {activeTab === "general"
                      ? isHttpProtocol
                        ? "HTTP / REST API Gateway Configuration"
                        : "SMPP 3.4 Connection & Authentication"
                      : "PDU Addressing & Alphabet Encodings"}
                  </h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {activeTab === "general"
                      ? "Primary gateway parameters, throughput limit, and FDRMC sender identity."
                      : "PDU addressing, keepalive intervals, and SMS delivery receipts."}
                  </p>
                </div>
              </div>

              {activeTab === "general" ? (
                <div className="mt-6 space-y-5">
                  {/* Protocol Selector */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                        Gateway Protocol
                      </label>
                      <select
                        value={config.protocol}
                        onChange={(e) => setConfig({ ...config, protocol: e.target.value })}
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-bold text-gray-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                      >
                        <option value="SMPP3.4">SMPP v3.4 (Direct Telecom Socket)</option>
                        <option value="SMPP5.0">SMPP v5.0 (Extended)</option>
                        <option value="HTTP">HTTP / REST API (Cloud Gateway)</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                        Sender ID (Source Address / Shortcode)
                      </label>
                      <input
                        type="text"
                        value={config.sourceAddr || ""}
                        onChange={(e) => setConfig({ ...config, sourceAddr: e.target.value })}
                        placeholder="FDRMC or 8899"
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* HTTP Gateway Specific Fields */}
                  {isHttpProtocol ? (
                    <div className="space-y-4 p-5 rounded-2xl bg-blue-50/40 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50">
                      <div className="flex items-center gap-2 text-xs font-bold text-blue-900 dark:text-blue-300">
                        <Globe className="w-4 h-4 text-blue-600" />
                        <span>HTTP REST API Webhook / Gateway Parameters</span>
                      </div>

                      <div>
                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                          API Endpoint URL
                        </label>
                        <input
                          type="url"
                          value={config.httpEndpoint || ""}
                          onChange={(e) => setConfig({ ...config, httpEndpoint: e.target.value })}
                          placeholder="https://api.ethiotelecom.et/v1/sms/send"
                          className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-mono text-gray-900 outline-none transition focus:border-blue-500 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                          required={isHttpProtocol}
                        />
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                            HTTP Method
                          </label>
                          <select
                            value={config.httpMethod || "POST"}
                            onChange={(e) => setConfig({ ...config, httpMethod: e.target.value as "POST" | "GET" })}
                            className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                          >
                            <option value="POST">POST (Standard JSON)</option>
                            <option value="GET">GET (Query String)</option>
                          </select>
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                            Authentication Type
                          </label>
                          <select
                            value={config.httpAuthType || "bearer"}
                            onChange={(e) => setConfig({ ...config, httpAuthType: e.target.value as any })}
                            className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                          >
                            <option value="bearer">Bearer Token (Authorization: Bearer ...)</option>
                            <option value="api_key">API Key Header (X-API-Key: ...)</option>
                            <option value="basic">Basic Authentication</option>
                            <option value="none">None (IP Whitelisted)</option>
                          </select>
                        </div>
                      </div>

                      {config.httpAuthType !== "none" && (
                        <div>
                          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                            API Secret Token / Key
                          </label>
                          <div className="relative">
                            <input
                              type={showApiKey ? "text" : "password"}
                              value={config.httpApiKey || ""}
                              onChange={(e) => setConfig({ ...config, httpApiKey: e.target.value })}
                              placeholder={config.hasHttpApiKey ? "•••••••• (Saved encrypted)" : "Enter API Token"}
                              className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-4 pr-12 text-sm font-mono text-gray-900 outline-none transition dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                            />
                            <button
                              type="button"
                              onClick={() => setShowApiKey(!showApiKey)}
                              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                            >
                              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          {config.hasHttpApiKey && (
                            <p className="mt-1 text-[11px] text-emerald-600">
                              ✓ Encrypted API key stored in database. Leave as •••••••• to keep current key.
                            </p>
                          )}
                        </div>
                      )}

                      <div>
                        <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                          JSON Payload Template (Optional Custom Mapping)
                        </label>
                        <input
                          type="text"
                          value={config.httpPayloadTemplate || ""}
                          onChange={(e) => setConfig({ ...config, httpPayloadTemplate: e.target.value })}
                          placeholder='{"to":"{{phone}}","message":"{{message}}","from":"{{senderId}}"}'
                          className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-xs font-mono text-gray-900 outline-none dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                        />
                        <p className="mt-1 text-[10.5px] text-gray-400">
                          Tokens: <code className="text-blue-600">{"{{phone}}"}</code>, <code className="text-blue-600">{"{{message}}"}</code>, <code className="text-blue-600">{"{{senderId}}"}</code>.
                        </p>
                      </div>
                    </div>
                  ) : (
                    /* SMPP Gateway Specific Fields */
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                            SMSC Host / IP
                          </label>
                          <input
                            type="text"
                            value={config.host}
                            onChange={(e) => setConfig({ ...config, host: e.target.value })}
                            placeholder="10.204.181.70"
                            className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                            required
                          />
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                            SMSC Port
                          </label>
                          <input
                            type="number"
                            value={config.port}
                            onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value, 10) || 5019 })}
                            placeholder="5019"
                            className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                            required
                          />
                        </div>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                            SMPP System ID (.env protected)
                          </label>
                          <input
                            type="text"
                            value={config.systemId || "••••"}
                            disabled
                            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-mono text-gray-500 cursor-not-allowed dark:border-gray-800 dark:bg-gray-900"
                          />
                          <p className="mt-1 text-[11px] text-gray-400">
                            Managed in backend <code className="text-amber-600">.env</code> (SMPP_SYSTEM_ID).
                          </p>
                        </div>

                        <div>
                          <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                            SMPP Password (.env protected)
                          </label>
                          <input
                            type="text"
                            value="••••••••"
                            disabled
                            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-mono text-gray-500 cursor-not-allowed dark:border-gray-800 dark:bg-gray-900"
                          />
                          <p className="mt-1 text-[11px] text-gray-400">
                            Managed in backend <code className="text-amber-600">.env</code> (SMPP_PASSWORD).
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Throughput & Reliability Section */}
                  <div className="pt-4 border-t border-gray-100 dark:border-gray-800 space-y-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-700 dark:text-gray-300">
                      <Gauge className="w-4 h-4 text-amber-500" />
                      <span>Throughput & SLA Rate Limiting (TPS)</span>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                            Max Broadcast TPS Limit
                          </label>
                          <span className="text-xs font-mono font-bold text-amber-600">
                            {config.maxTps ?? 20} SMS / sec
                          </span>
                        </div>
                        <input
                          type="range"
                          min={5}
                          max={100}
                          step={5}
                          value={config.maxTps ?? 20}
                          onChange={(e) => setConfig({ ...config, maxTps: parseInt(e.target.value, 10) })}
                          className="w-full accent-amber-500 cursor-pointer"
                        />
                        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                          <span>5 TPS (Conservative)</span>
                          <span>20 TPS (Standard)</span>
                          <span>100 TPS (High Capacity)</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-950">
                        <div>
                          <div className="text-xs font-bold text-gray-900 dark:text-white">
                            Handset Delivery Receipts (DLR)
                          </div>
                          <div className="text-[11px] text-gray-400">
                            Listen for <code className="text-amber-600">deliver_sm</code> PDU callbacks
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={config.dlrEnabled ?? true}
                            onChange={(e) => setConfig({ ...config, dlrEnabled: e.target.checked })}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* ADVANCED ADDRESSING TAB */
                <div className="mt-6 space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                        Source TON (Type of Number)
                      </label>
                      <select
                        value={config.sourceAddrTon ?? 5}
                        onChange={(e) => setConfig({ ...config, sourceAddrTon: parseInt(e.target.value, 10) })}
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-amber-500 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                      >
                        <option value={5}>5 - Alphanumeric (e.g. FDRMC)</option>
                        <option value={1}>1 - International (e.g. 2519...)</option>
                        <option value={2}>2 - National</option>
                        <option value={0}>0 - Unknown</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                        Source NPI (Numbering Plan)
                      </label>
                      <select
                        value={config.sourceAddrNpi ?? 0}
                        onChange={(e) => setConfig({ ...config, sourceAddrNpi: parseInt(e.target.value, 10) })}
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-amber-500 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                      >
                        <option value={0}>0 - Unknown</option>
                        <option value={1}>1 - ISDN / E.164</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                        Destination TON
                      </label>
                      <select
                        value={config.destAddrTon ?? 1}
                        onChange={(e) => setConfig({ ...config, destAddrTon: parseInt(e.target.value, 10) })}
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-amber-500 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                      >
                        <option value={1}>1 - International (E.164 - 2519...)</option>
                        <option value={2}>2 - National</option>
                        <option value={0}>0 - Unknown</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                        Destination NPI
                      </label>
                      <select
                        value={config.destAddrNpi ?? 1}
                        onChange={(e) => setConfig({ ...config, destAddrNpi: parseInt(e.target.value, 10) })}
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-amber-500 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                      >
                        <option value={1}>1 - ISDN / E.164 (Standard)</option>
                        <option value={0}>0 - Unknown</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                        Heartbeat Keepalive (enquire_link)
                      </label>
                      <select
                        value={config.enquireLinkIntervalMs ?? 30000}
                        onChange={(e) => setConfig({ ...config, enquireLinkIntervalMs: parseInt(e.target.value, 10) })}
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                      >
                        <option value={15000}>15 Seconds</option>
                        <option value={30000}>30 Seconds (Standard)</option>
                        <option value={60000}>60 Seconds</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                        Auto-Reconnect Interval
                      </label>
                      <select
                        value={config.reconnectIntervalMs ?? 10000}
                        onChange={(e) => setConfig({ ...config, reconnectIntervalMs: parseInt(e.target.value, 10) })}
                        className="w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                      >
                        <option value={5000}>5 Seconds (Fast)</option>
                        <option value={10000}>10 Seconds (Standard)</option>
                        <option value={30000}>30 Seconds</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-8 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-7 py-3 text-sm font-bold text-white shadow-lg shadow-amber-500/20 transition hover:bg-amber-600 disabled:opacity-60"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {saving ? "Saving Configuration..." : "Save SMS Gateway Config"}
                </button>
              </div>
            </form>
          )}

          {/* Right Info Panel */}
          <div className="space-y-6">
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-slate-950/40">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" />
                Telecom Credentials Status
              </h4>
              <div className="mt-4 space-y-3 text-xs">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2 dark:border-gray-800">
                  <span className="text-gray-500">Active Protocol:</span>
                  <span className="font-mono font-bold text-amber-600">
                    {config.protocol}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-gray-100 pb-2 dark:border-gray-800">
                  <span className="text-gray-500">Gateway Route:</span>
                  <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">
                    {isHttpProtocol ? (config.httpEndpoint ? new URL(config.httpEndpoint).host : "Not Set") : `${config.host}:${config.port}`}
                  </span>
                </div>
                <div className="flex items-center justify-between border-b border-gray-100 pb-2 dark:border-gray-800">
                  <span className="text-gray-500">Throughput Limit:</span>
                  <span className="font-mono font-bold text-blue-600">
                    {config.maxTps ?? 20} TPS
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-500">Supported Networks:</span>
                  <span className="font-semibold text-emerald-600">Ethio Telecom & Safaricom</span>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-slate-950/40">
              <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-amber-500" />
                Ethiopian Number Guidelines
              </h4>
              <div className="mt-3 space-y-2 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                <p>• <strong>Ethio Telecom:</strong> 10-digit mobile numbers starting with <code className="font-mono text-amber-600">09</code> or <code className="font-mono text-amber-600">+251 9...</code>.</p>
                <p>• <strong>Safaricom Ethiopia:</strong> 10-digit mobile numbers starting with <code className="font-mono text-amber-600">07</code> or <code className="font-mono text-amber-600">+251 7...</code>.</p>
                <p>• Numbers are automatically normalized into international E.164 format before submission.</p>
                <p>• Long messages in Amharic (UCS-2) or English (GSM-7) are automatically concatenated via UDH.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
