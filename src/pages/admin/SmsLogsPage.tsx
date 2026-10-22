import React, { useState, useEffect, useMemo, useRef } from "react";
import { useBranchSubcity } from "@/context/HierarchyContext";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import api from "../../api/axios";
import { toast } from "react-toastify";
import {
  MessageSquare,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Phone,
  Send,
  Radio,
  FileSpreadsheet,
  RotateCcw,
  Info,
  X,
  Users,
  Copy,
  Clock,
  Zap,
  Globe,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  MapPin,
  BookmarkPlus,
  Bookmark,
  Check,
} from "lucide-react";
import { formatAlertCategory, ALERT_CATEGORY_LABELS, ALERT_HAZARD_GROUPS } from "@/constants/alertCategories";
import { connectDashboardSocket } from "@/features/live-dashboard/socket/dashboardSocket";

type SmsLog = {
  _id: string;
  recipientPhone: string;
  recipientName?: string;
  message: string;
  category: string;
  severity: string;
  messageType: string;
  status: "pending" | "queued" | "sent" | "delivered" | "failed";
  messageId?: string;
  senderId?: string;
  broadcastBatchId?: string;
  errorDetails?: string;
  sentBy?: { name?: string; email?: string; role?: string };
  deliveredAt?: string;
  retryCount?: number;
  lastResentAt?: string;
  encoding?: "GSM-7" | "UCS-2" | "ASCII";
  segments?: number;
  latencyMs?: number;
  createdAt: string;
};

type SmsStats = {
  total: number;
  sent: number;
  delivered: number;
  failed: number;
  pending: number;
  todayCount: number;
  unicodeCount: number;
  totalSegments: number;
  avgLatency: number;
  deliveryRate: number;
};

type SmsTemplate = {
  id: string;
  title: string;
  category: string;
  severity: string;
  text: string;
  isCustom?: boolean;
};

// Default built-in disaster emergency templates
const DEFAULT_EMERGENCY_TEMPLATES: SmsTemplate[] = [
  {
    id: "flood-en",
    title: "Flood Warning (English)",
    category: "floods",
    severity: "urgent",
    text: "URGENT FLOOD ALERT: Rising water levels detected in your area. Evacuate to higher ground immediately. Stay safe and contact 939 for emergencies. - FDRMC",
  },
  {
    id: "flood-am",
    title: "የጎርፍ ማስጠንቀቂያ (Amharic)",
    category: "floods",
    severity: "urgent",
    text: "አስቸኳይ የጎርፍ አደጋ ማስጠንቀቂያ፡ በአካባቢዎ የውሃ መጠን እየጨመረ ስለሆነ በአፋጣኝ ወደ ከፍታ ቦታዎች ይውጡ። ለአደጋ ጊዜ በ939 ይደውሉ። - FDRMC",
  },
  {
    id: "fire-en",
    title: "Fire Evacuation (English)",
    category: "structural_fire",
    severity: "critical",
    text: "FIRE ALERT: Structural/wildfire emergency reported nearby. Follow local evacuation routes immediately. Avoid smoke inhalation. - FDRMC",
  },
  {
    id: "fire-am",
    title: "የእሳት አደጋ ማስጠንቀቂያ (Amharic)",
    category: "structural_fire",
    severity: "critical",
    text: "አስቸኳይ የእሳት አደጋ ማስጠንቀቂያ፡ በአቅራቢያዎ የእሳት አደጋ ተከስቷል። በአፋጣኝ አካባቢውን ይልቀቁ። - FDRMC",
  },
  {
    id: "weather-en",
    title: "Severe Weather Notice",
    category: "drought",
    severity: "high",
    text: "WEATHER ADVISORY: Severe weather expected in the next 24 hours. Take necessary precautions and secure livestock/property. - FDRMC",
  },
  {
    id: "test-en",
    title: "System Test Notice",
    category: "other",
    severity: "normal",
    text: "SYSTEM TEST: This is a verified test broadcast from the National Early Warning SMS Gateway (FDRMC). No action is required.",
  },
];

const ETHIOPIAN_REGIONS = [
  "Addis Ababa",
  "Afar",
  "Amhara",
  "Benishangul-Gumuz",
  "Central Ethiopia",
  "Dire Dawa",
  "Gambela",
  "Harari",
  "Oromia",
  "Sidama",
  "Somali",
  "South Ethiopia",
  "South West Ethiopia",
  "Tigray",
];

// Detect Unicode / non-ASCII (Amharic)
const isUnicodeText = (text: string): boolean => {
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) > 127) return true;
  }
  return false;
};

export default function SmsLogsPage() {
  const branchSubcity = useBranchSubcity();
  const [branchLocked, setBranchLocked] = useState<string | null>(null);
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit, setLimit] = useState(25);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [encodingFilter, setEncodingFilter] = useState("all");
  const [sortBy] = useState("createdAt");
  const [sortOrder] = useState<"desc" | "asc">("desc");

  // Selection for bulk operations
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Action states
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [bulkResending, setBulkResending] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Stats
  const [stats, setStats] = useState<SmsStats>({
    total: 0,
    sent: 0,
    delivered: 0,
    failed: 0,
    pending: 0,
    todayCount: 0,
    unicodeCount: 0,
    totalSegments: 0,
    avgLatency: 0,
    deliveryRate: 0,
  });

  // Modal States
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [inspectLog, setInspectLog] = useState<SmsLog | null>(null);
  const [editResendLog, setEditResendLog] = useState<SmsLog | null>(null);

  // Template Manager State
  const [savedTemplates, setSavedTemplates] = useState<SmsTemplate[]>([]);
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false);
  const [newTemplateForm, setNewTemplateForm] = useState({
    title: "",
    category: "floods",
    severity: "urgent",
    text: "",
  });

  // Broadcast Form State
  const [broadcastForm, setBroadcastForm] = useState({
    audienceType: "subscribers" as "custom" | "subscribers",
    phoneNumbers: "",
    // Advanced Subscriber Filters matching /admin/alert-subscriptions
    audienceStatus: "active", // 'active' | 'paused' | 'unsubscribed' | 'all'
    hazardGroup: "all", // 'weather' | 'geo' | 'fire' | 'env' | 'all'
    subscriberCategory: "all",
    region: "all",
    city: "all",
    subCity: "all",
    woreda: "all",
    locationFilter: "",
    smsChannelOnly: true,
    // Message attributes
    category: "floods",
    severity: "high",
    senderId: "FDRMC",
    message: "",
  });

  // Live Subscriber Preview State
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewSample, setPreviewSample] = useState<Array<{ name: string; phone: string; region: string; city: string; subCity: string; woreda: string; status: string }>>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const previewDebounceRef = useRef<any>(null);

  // Active Broadcast Background Progress Monitor
  const [activeBroadcast, setActiveBroadcast] = useState<{
    batchId: string;
    total: number;
    sent: number;
    failed: number;
    percent: number;
  } | null>(null);

  // Edit & Resend Form State
  const [resendForm, setResendForm] = useState({
    phone: "",
    recipientName: "",
    message: "",
    category: "general",
    severity: "normal",
    senderId: "FDRMC",
  });

  // Load custom templates from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("IDRMIS_SAVED_SMS_TEMPLATES");
      if (stored) {
        setSavedTemplates(JSON.parse(stored));
      }
    } catch (_) {}
  }, []);

  // Combined Templates
  const allTemplates = useMemo(() => {
    return [...DEFAULT_EMERGENCY_TEMPLATES, ...savedTemplates];
  }, [savedTemplates]);

  // WebSocket listeners for real-time broadcast progress and completion
  useEffect(() => {
    const socket = connectDashboardSocket();

    const handleProgress = (data: any) => {
      if (!data || !data.batchId) return;
      setActiveBroadcast({
        batchId: data.batchId,
        total: data.total || 0,
        sent: data.sent || 0,
        failed: data.failed || 0,
        percent:
          data.percent ??
          Math.round((((data.sent || 0) + (data.failed || 0)) / (data.total || 1)) * 100),
      });
      // Periodically refresh stats
      fetchStats();
    };

    const handleCompleted = (data: any) => {
      toast.success(
        `Emergency Broadcast ${data.batchId || ""} finished: ${data.sent || 0} sent, ${data.failed || 0} failed.`
      );
      fetchLogs();
      fetchStats();
      setTimeout(() => {
        setActiveBroadcast(null);
      }, 7000);
    };

    socket.on("sms:broadcast:progress", handleProgress);
    socket.on("sms:broadcast:completed", handleCompleted);

    return () => {
      socket.off("sms:broadcast:progress", handleProgress);
      socket.off("sms:broadcast:completed", handleCompleted);
    };
  }, []);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [page, limit, statusFilter, categoryFilter, typeFilter, encodingFilter, sortBy, sortOrder]);

  // Lock broadcast subCity to branch scope if user is a branch user
  useEffect(() => {
    const activeSubcity = branchLocked || branchSubcity;
    if (activeSubcity) {
      setBroadcastForm((prev) => ({
        ...prev,
        subCity: activeSubcity,
      }));
    }
  }, [branchSubcity, branchLocked, showBroadcastModal]);

  // Fetch live subscriber preview when subscriber filters change
  useEffect(() => {
    if (!showBroadcastModal || broadcastForm.audienceType !== "subscribers") {
      return;
    }

    if (previewDebounceRef.current) {
      clearTimeout(previewDebounceRef.current);
    }

    previewDebounceRef.current = setTimeout(() => {
      fetchSubscriberPreview();
    }, 350);

    return () => {
      if (previewDebounceRef.current) {
        clearTimeout(previewDebounceRef.current);
      }
    };
  }, [
    showBroadcastModal,
    broadcastForm.audienceType,
    broadcastForm.audienceStatus,
    broadcastForm.hazardGroup,
    broadcastForm.subscriberCategory,
    broadcastForm.region,
    broadcastForm.city,
    broadcastForm.subCity,
    broadcastForm.woreda,
    broadcastForm.locationFilter,
    broadcastForm.smsChannelOnly,
  ]);

  const fetchSubscriberPreview = async () => {
    setPreviewLoading(true);
    try {
      const response = await api.post("/sms-logs/preview-subscribers", {
        audienceStatus: broadcastForm.audienceStatus,
        subscriberCategory: broadcastForm.subscriberCategory,
        hazardGroup: broadcastForm.hazardGroup,
        region: broadcastForm.region,
        city: broadcastForm.city,
        subCity: broadcastForm.subCity,
        woreda: broadcastForm.woreda,
        locationFilter: broadcastForm.locationFilter,
        smsChannelOnly: broadcastForm.smsChannelOnly,
      });
      setPreviewCount(response.data?.totalCount ?? 0);
      setPreviewSample(response.data?.sample || []);
      if (response.data?.branchLocked) setBranchLocked(response.data.branchLocked);
    } catch (err) {
      console.error("Failed to preview subscribers count", err);
      setPreviewCount(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get("/sms-logs/stats");
      if (response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch SMS statistics", error);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params: any = {
        page,
        limit,
        sortBy,
        sortOrder,
      };
      if (statusFilter !== "all") params.status = statusFilter;
      if (categoryFilter !== "all") params.category = categoryFilter;
      if (typeFilter !== "all") params.messageType = typeFilter;
      if (encodingFilter !== "all") params.encoding = encodingFilter;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const response = await api.get("/sms-logs", { params });
      setLogs(response.data?.logs || []);
      setTotal(response.data?.total || 0);
      setTotalPages(response.data?.totalPages || 1);
      if (response.data?.branchLocked) setBranchLocked(response.data.branchLocked);
    } catch (error) {
      console.error("Failed to fetch SMS logs", error);
      toast.error("Failed to fetch SMS logs");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setCategoryFilter("all");
    setTypeFilter("all");
    setEncodingFilter("all");
    setPage(1);
  };

  // Single Quick Resend
  const handleQuickResend = async (id: string) => {
    setResendingId(id);
    try {
      const response = await api.post(`/sms-logs/resend/${id}`);
      if (response.data?.success) {
        toast.success(response.data?.message || "SMS resent successfully");
      } else {
        toast.error(response.data?.message || "Failed to resend SMS");
      }
      fetchLogs();
      fetchStats();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to resend SMS");
    } finally {
      setResendingId(null);
    }
  };

  // Open Edit & Resend Modal
  const handleOpenEditResend = (log: SmsLog) => {
    setEditResendLog(log);
    setResendForm({
      phone: log.recipientPhone,
      recipientName: log.recipientName || "",
      message: log.message,
      category: log.category,
      severity: log.severity,
      senderId: log.senderId || "FDRMC",
    });
  };

  // Submit Edit & Resend
  const handleSubmitEditResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editResendLog) return;
    setResendingId(editResendLog._id);
    try {
      const response = await api.post(`/sms-logs/resend/${editResendLog._id}`, resendForm);
      if (response.data?.success) {
        toast.success(response.data?.message || "SMS resent successfully");
        setEditResendLog(null);
      } else {
        toast.error(response.data?.message || "Failed to resend SMS");
      }
      fetchLogs();
      fetchStats();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to resend SMS");
    } finally {
      setResendingId(null);
    }
  };

  // Bulk Resend Failed
  const handleBulkResendFailed = async (onlySelected = false) => {
    const ids = onlySelected ? selectedIds : [];
    const count = onlySelected ? ids.length : stats.failed;
    if (count === 0) {
      toast.info("No failed SMS messages to retry.");
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to retry sending ${count} failed SMS message(s)?`
      )
    ) {
      return;
    }

    setBulkResending(true);
    try {
      const payload: any = onlySelected ? { ids } : { allFailed: true };
      const response = await api.post("/sms-logs/bulk-resend", payload);
      toast.success(response.data?.message || "Bulk resend completed");
      setSelectedIds([]);
      fetchLogs();
      fetchStats();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Bulk resend failed");
    } finally {
      setBulkResending(false);
    }
  };

  // Single Delete
  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this SMS log record permanently?")) return;
    try {
      await api.delete(`/sms-logs/${id}`);
      setLogs((prev) => prev.filter((item) => item._id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
      toast.success("SMS log deleted");
      fetchStats();
    } catch (error: any) {
      toast.error("Failed to delete SMS log");
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedIds.length} selected SMS log(s)?`)) return;

    setBulkDeleting(true);
    try {
      const response = await api.delete("/sms-logs/bulk-delete", {
        data: { ids: selectedIds },
      });
      toast.success(response.data?.message || "Selected logs deleted");
      setSelectedIds([]);
      fetchLogs();
      fetchStats();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to delete selected logs");
    } finally {
      setBulkDeleting(false);
    }
  };

  // Submit Broadcast SMS
  const handleBroadcastSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastForm.message.trim()) {
      toast.warning("Please enter SMS message content");
      return;
    }
    if (broadcastForm.audienceType === "custom" && !broadcastForm.phoneNumbers.trim()) {
      toast.warning("Please enter at least one recipient phone number");
      return;
    }

    if (broadcastForm.audienceType === "subscribers" && previewCount === 0) {
      toast.error("No subscribers found matching the selected filters. Please adjust your criteria.");
      return;
    }

    setBroadcasting(true);
    try {
      const response = await api.post("/sms-logs/broadcast", broadcastForm);
      if (response.data?.success) {
        if (response.data?.isAsync) {
          toast.info(response.data?.message || "Broadcast is actively dispatching in the background at configured TPS rate.");
          setActiveBroadcast({
            batchId: response.data.batchId,
            total: response.data.totalCount || previewCount || 0,
            sent: 0,
            failed: 0,
            percent: 0,
          });
        } else {
          toast.success(response.data?.message || "Broadcast completed successfully!");
        }
        setShowBroadcastModal(false);
        fetchLogs();
        fetchStats();
      } else {
        toast.error(response.data?.message || "Broadcast dispatch failed");
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to dispatch broadcast");
    } finally {
      setBroadcasting(false);
    }
  };

  // Save New Custom Template
  const handleSaveCustomTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateForm.title.trim() || !newTemplateForm.text.trim()) {
      toast.warning("Please enter template title and message text");
      return;
    }

    const createdTemplate: SmsTemplate = {
      id: `custom-${Date.now()}`,
      title: newTemplateForm.title.trim(),
      category: newTemplateForm.category,
      severity: newTemplateForm.severity,
      text: newTemplateForm.text.trim(),
      isCustom: true,
    };

    const updated = [...savedTemplates, createdTemplate];
    setSavedTemplates(updated);
    try {
      localStorage.setItem("IDRMIS_SAVED_SMS_TEMPLATES", JSON.stringify(updated));
    } catch (_) {}

    toast.success("New SMS preset template saved!");
    setShowCreateTemplateModal(false);
    setNewTemplateForm({ title: "", category: "floods", severity: "urgent", text: "" });
  };

  // Delete Custom Template
  const handleDeleteCustomTemplate = (id: string) => {
    const updated = savedTemplates.filter((t) => t.id !== id);
    setSavedTemplates(updated);
    try {
      localStorage.setItem("IDRMIS_SAVED_SMS_TEMPLATES", JSON.stringify(updated));
    } catch (_) {}
    toast.success("Custom template removed");
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (logs.length === 0) {
      toast.info("No logs available to export");
      return;
    }

    const headers = [
      "Recipient Phone",
      "Recipient Name",
      "Status",
      "Message",
      "Category",
      "Type",
      "Encoding",
      "Segments",
      "Latency (ms)",
      "Sender ID",
      "Message ID",
      "Batch ID",
      "Retry Count",
      "Date",
    ];

    const rows = logs.map((log) => [
      `"${log.recipientPhone || ""}"`,
      `"${log.recipientName || ""}"`,
      `"${log.status}"`,
      `"${log.message.replace(/"/g, '""')}"`,
      `"${log.category}"`,
      `"${log.messageType}"`,
      `"${log.encoding || "GSM-7"}"`,
      log.segments || 1,
      log.latencyMs || 0,
      `"${log.senderId || ""}"`,
      `"${log.messageId || ""}"`,
      `"${log.broadcastBatchId || ""}"`,
      log.retryCount || 0,
      `"${new Date(log.createdAt).toISOString()}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `IDRMIS_SMS_Logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("SMS Logs exported to CSV successfully!");
  };

  // Selection toggle
  const toggleSelectAll = () => {
    if (selectedIds.length === logs.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(logs.map((l) => l._id));
    }
  };

  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Broadcast Message Stats Calculation
  const broadcastIsUnicode = isUnicodeText(broadcastForm.message);
  const broadcastCharLimit = broadcastIsUnicode ? 70 : 160;
  const broadcastSegments = Math.max(1, Math.ceil(broadcastForm.message.length / broadcastCharLimit));

  // Count raw custom recipients
  const parsedPhoneCount = useMemo(() => {
    if (broadcastForm.audienceType !== "custom") return 0;
    const list = broadcastForm.phoneNumbers.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    return new Set(list).size;
  }, [broadcastForm.phoneNumbers, broadcastForm.audienceType]);

  return (
    <>
      <PageMeta
        title="SMS Logs & Broadcast Center | IDRMIS"
        description="Outbound SMPP 3.4 SMS logs, batch broadcast dispatcher, and delivery tracking"
      />
      <PageBreadcrumb pageTitle="SMS Logs & Broadcast Center" />

      <div className="space-y-6">
        {/* Branch Jurisdiction Banner */}
        {branchSubcity && (
          <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800/50 dark:bg-amber-950/20 dark:text-amber-300">
            <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <span className="font-semibold">Branch Jurisdiction — {branchLocked || branchSubcity} Subcity</span>
              <p className="mt-0.5 text-xs text-amber-700/80 dark:text-amber-300/80">
                You are viewing and broadcasting SMS logs scoped to your branch subcity only. Head office users can see all logs city-wide.
              </p>
            </div>
          </div>
        )}

        {/* Live Active Emergency SMS Broadcast Monitor */}
        {activeBroadcast && (
          <div className="relative overflow-hidden rounded-3xl border border-amber-400/80 bg-gradient-to-r from-amber-500/[0.08] via-orange-500/[0.06] to-amber-500/[0.04] p-5 shadow-lg shadow-amber-500/5 dark:border-amber-500/30 dark:from-amber-950/40 dark:to-slate-950/40">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">
                      ⚡ Active Emergency SMS Broadcast Dispatch
                    </span>
                    <span className="font-mono text-[11px] font-bold text-gray-500">
                      #{activeBroadcast.batchId}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Dispatching with telecom TPS throttling & automatic UCS-2 / GSM-7 concatenation.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-auto">
                <span className="text-base font-black font-mono text-amber-600 dark:text-amber-400">
                  {activeBroadcast.percent}%
                </span>
                <span className="text-xs text-gray-400 font-medium">
                  ({activeBroadcast.sent + activeBroadcast.failed} / {activeBroadcast.total})
                </span>
              </div>
            </div>

            {/* Animated Progress Bar */}
            <div className="w-full bg-gray-200/80 dark:bg-gray-800 rounded-full h-3 overflow-hidden p-0.5 shadow-inner">
              <div
                className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 h-full rounded-full transition-all duration-300 shadow-sm"
                style={{ width: `${Math.min(100, Math.max(3, activeBroadcast.percent))}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 font-medium mt-2.5">
              <span>
                Delivered / Sent: <strong className="text-emerald-600 font-bold">{activeBroadcast.sent}</strong>
              </span>
              {activeBroadcast.failed > 0 && (
                <span className="text-rose-600 font-bold">
                  Failed / Rejected: {activeBroadcast.failed}
                </span>
              )}
              <span className="font-mono text-[11px] text-gray-400">
                Rate Throttle: 20 TPS
              </span>
            </div>
          </div>
        )}
        {/* Top Hero Banner & Quick Actions */}
        <div className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-slate-950/40">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-500/20">
                <Radio className="h-7 w-7 animate-pulse" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    SMS Broadcast & Audit Logs
                  </h3>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    SMPP 3.4 Active
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Targeted disaster alert broadcast by hazard category, location, and subscriber status with live delivery auditing.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowBroadcastModal(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-amber-500/20 transition hover:bg-amber-600 active:scale-95"
              >
                <Send className="h-4 w-4" />
                Broadcast SMS
              </button>

              {stats.failed > 0 ? (
                <button
                  type="button"
                  onClick={() => handleBulkResendFailed(false)}
                  disabled={bulkResending}
                  className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-800 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
                >
                  <RotateCcw className={`h-3.5 w-3.5 ${bulkResending ? "animate-spin" : ""}`} />
                  {bulkResending ? "Retrying..." : `Retry All Failed (${stats.failed})`}
                </button>
              ) : null}

              <button
                type="button"
                onClick={handleExportCSV}
                className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs font-bold text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                title="Export current logs as CSV"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                Export CSV
              </button>

              <button
                type="button"
                onClick={() => {
                  fetchLogs();
                  fetchStats();
                }}
                className="inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-white p-2.5 text-gray-500 shadow-sm transition hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400"
                title="Refresh logs & statistics"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-amber-500" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Live KPI Statistics Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-slate-950/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                Total SMS Dispatched
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300">
                <MessageSquare className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-black text-gray-900 dark:text-white">
                {stats.total.toLocaleString()}
              </span>
              <span className="text-xs font-medium text-gray-400">
                ({stats.totalSegments.toLocaleString()} segments)
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-500">
              <Clock className="h-3 w-3 text-gray-400" />
              <span>Today: <strong>{stats.todayCount}</strong> messages</span>
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-slate-950/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                Sent & Delivered
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-black text-gray-900 dark:text-white">
                {(stats.sent + stats.delivered).toLocaleString()}
              </span>
              <span className="text-xs font-bold text-emerald-600">
                {stats.deliveryRate}% Success
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${stats.deliveryRate}%` }}
              />
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-slate-950/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Failed Attempts
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
                <AlertTriangle className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-black text-gray-900 dark:text-white">
                {stats.failed.toLocaleString()}
              </span>
              {stats.pending > 0 ? (
                <span className="text-xs font-medium text-amber-600">
                  ({stats.pending} pending)
                </span>
              ) : null}
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px]">
              <span className="text-gray-400">Needs retry or verification</span>
              {stats.failed > 0 ? (
                <button
                  type="button"
                  onClick={() => handleBulkResendFailed(false)}
                  className="font-bold text-rose-600 hover:underline"
                >
                  Retry Now →
                </button>
              ) : (
                <span className="font-semibold text-emerald-600">Zero errors</span>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-slate-950/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                Encoding & Performance
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                <Globe className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-black text-gray-900 dark:text-white">
                {stats.unicodeCount.toLocaleString()}
              </span>
              <span className="text-xs font-semibold text-blue-600">
                Amharic (UCS-2)
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-[11px] text-gray-500">
              <Zap className="h-3 w-3 text-amber-500" />
              <span>Avg. Latency: <strong>{stats.avgLatency}ms</strong></span>
            </div>
          </div>
        </div>

        {/* Multi-Filter and Search Bar */}
        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-slate-950/40">
          <div className="space-y-4">
            {/* Search row */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <form onSubmit={handleSearchSubmit} className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by phone, recipient, message text, sender ID, message ID, or error..."
                  className="w-full rounded-2xl border border-gray-200 bg-white py-2.5 pl-10 pr-24 text-xs text-gray-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-xl bg-gray-900 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-gray-800 dark:bg-white dark:text-gray-950"
                >
                  Search
                </button>
              </form>

              {/* Status Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: "all", label: "All Logs" },
                  { id: "sent", label: "Sent" },
                  { id: "failed", label: "Failed" },
                  { id: "pending", label: "Pending" },
                ].map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => {
                      setStatusFilter(st.id);
                      setPage(1);
                    }}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                      statusFilter === st.id
                        ? "bg-amber-500 text-white shadow-sm shadow-amber-500/20"
                        : "bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Second row filters */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 dark:text-gray-400">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>Filters:</span>
              </div>

              {/* Hazard Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
              >
                <option value="all">All Hazard Categories</option>
                {Object.entries(ALERT_CATEGORY_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>

              {/* Message Type Filter */}
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
              >
                <option value="all">All Message Types</option>
                <option value="broadcast">Broadcast Batch</option>
                <option value="single">Single Direct</option>
                <option value="alert">Alert Warning</option>
                <option value="test">Gateway Test</option>
                <option value="verification">Verification</option>
              </select>

              {/* Encoding Filter */}
              <select
                value={encodingFilter}
                onChange={(e) => {
                  setEncodingFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
              >
                <option value="all">All Encodings</option>
                <option value="UCS-2">UCS-2 (Amharic / Unicode)</option>
                <option value="GSM-7">GSM-7 (English / ASCII)</option>
              </select>

              {(statusFilter !== "all" ||
                categoryFilter !== "all" ||
                typeFilter !== "all" ||
                encodingFilter !== "all" ||
                searchTerm) && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="rounded-xl px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                >
                  Clear all filters
                </button>
              )}

              {/* Bulk Selected Actions Bar */}
              {selectedIds.length > 0 && (
                <div className="ml-auto flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                  <span>{selectedIds.length} selected</span>
                  <button
                    type="button"
                    onClick={() => handleBulkResendFailed(true)}
                    className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] text-white hover:bg-amber-600"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Retry Selected
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    disabled={bulkDeleting}
                    className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-[11px] text-white hover:bg-rose-700 disabled:opacity-50"
                  >
                    <Trash2 className="h-3 w-3" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Logs Table */}
          <div className="mt-5 overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800">
            <div className="max-w-full overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-gray-200 bg-gray-50/80 font-bold uppercase tracking-wider text-gray-500 dark:border-gray-800 dark:bg-gray-900/50 dark:text-gray-400">
                  <tr>
                    <th className="w-10 px-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={logs.length > 0 && selectedIds.length === logs.length}
                        onChange={toggleSelectAll}
                        className="rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                      />
                    </th>
                    <th className="px-4 py-3.5">Recipient</th>
                    <th className="px-4 py-3.5">Message Content</th>
                    <th className="px-4 py-3.5">Category & Severity</th>
                    <th className="px-4 py-3.5">Type / Sender</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Time / Latency</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-sm text-gray-500">
                        <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-amber-500" />
                        Loading SMS logs...
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-sm text-gray-500">
                        <MessageSquare className="mx-auto mb-2 h-8 w-8 text-gray-300 dark:text-gray-700" />
                        No SMS logs found matching the active filter.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => {
                      const isUnicode = log.encoding === "UCS-2" || isUnicodeText(log.message);
                      const isSelected = selectedIds.includes(log._id);

                      return (
                        <tr
                          key={log._id}
                          className={`transition hover:bg-gray-50/60 dark:hover:bg-slate-900/30 ${
                            isSelected ? "bg-amber-50/40 dark:bg-amber-500/5" : ""
                          }`}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectId(log._id)}
                              className="rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                            />
                          </td>

                          {/* Recipient Phone & Name */}
                          <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                            <div className="flex items-center gap-1.5">
                              <Phone className="h-3.5 w-3.5 text-gray-400" />
                              <span className="font-mono">{log.recipientPhone}</span>
                            </div>
                            {log.recipientName ? (
                              <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                                {log.recipientName}
                              </div>
                            ) : null}
                          </td>

                          {/* Message Body & Badges */}
                          <td className="max-w-md px-4 py-3">
                            <div
                              onClick={() => setInspectLog(log)}
                              className="cursor-pointer line-clamp-2 text-gray-800 hover:text-amber-600 dark:text-gray-200 dark:hover:text-amber-400"
                              title="Click to view full message details"
                            >
                              {log.message}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                              {isUnicode ? (
                                <span className="inline-flex items-center gap-0.5 rounded bg-blue-50 px-1.5 py-0.5 font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                                  <Globe className="h-2.5 w-2.5" />
                                  UCS-2 (Amharic)
                                </span>
                              ) : (
                                <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                  GSM-7 (160c)
                                </span>
                              )}

                              {log.segments && log.segments > 1 ? (
                                <span className="rounded bg-purple-50 px-1.5 py-0.5 font-bold text-purple-700 dark:bg-purple-500/10 dark:text-purple-300">
                                  {log.segments} Segments
                                </span>
                              ) : null}

                              {log.retryCount && log.retryCount > 0 ? (
                                <span className="rounded bg-amber-50 px-1.5 py-0.5 font-bold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
                                  Retried {log.retryCount}x
                                </span>
                              ) : null}
                            </div>

                            {log.errorDetails ? (
                              <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-rose-500">
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                <span className="truncate">{log.errorDetails}</span>
                              </div>
                            ) : null}
                          </td>

                          {/* Hazard Category & Severity */}
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              <span className="inline-flex items-center rounded-lg bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                {formatAlertCategory(log.category)}
                              </span>
                              <div>
                                <span
                                  className={`inline-block text-[10px] font-bold uppercase tracking-wider ${
                                    log.severity === "critical"
                                      ? "text-rose-600"
                                      : log.severity === "urgent" || log.severity === "high"
                                        ? "text-amber-600"
                                        : "text-gray-400"
                                  }`}
                                >
                                  {log.severity || "normal"}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Type & Sender ID */}
                          <td className="px-4 py-3">
                            <div className="font-semibold capitalize text-gray-700 dark:text-gray-300">
                              {log.messageType}
                            </div>
                            <div className="text-[11px] font-mono text-gray-400">
                              Sender: {log.senderId || "FDRMC"}
                            </div>
                          </td>

                          {/* Status Pill */}
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${
                                log.status === "sent" || log.status === "delivered"
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                                  : log.status === "failed"
                                    ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
                                    : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  log.status === "sent" || log.status === "delivered"
                                    ? "bg-emerald-500 animate-pulse"
                                    : log.status === "failed"
                                      ? "bg-rose-500"
                                      : "bg-amber-500 animate-ping"
                                }`}
                              />
                              {log.status}
                            </span>
                          </td>

                          {/* Time & Latency */}
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                            <div>{new Date(log.createdAt).toLocaleDateString()}</div>
                            <div className="text-[11px] text-gray-400">
                              {new Date(log.createdAt).toLocaleTimeString()}
                              {log.latencyMs ? ` (${log.latencyMs}ms)` : ""}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              {/* Resend / Edit Button */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditResend(log)}
                                className="rounded-xl border border-amber-200 bg-amber-50 p-2 text-amber-700 shadow-sm transition hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                                title="Edit & Resend SMS"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </button>

                              {/* Quick One-Click Resend */}
                              <button
                                type="button"
                                onClick={() => handleQuickResend(log._id)}
                                disabled={resendingId === log._id}
                                className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
                                title="Quick Resend (Original Payload)"
                              >
                                <RefreshCw
                                  className={`h-3.5 w-3.5 ${
                                    resendingId === log._id ? "animate-spin text-amber-500" : ""
                                  }`}
                                />
                              </button>

                              {/* Inspect Details */}
                              <button
                                type="button"
                                onClick={() => setInspectLog(log)}
                                className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
                                title="View Technical Details"
                              >
                                <Info className="h-3.5 w-3.5" />
                              </button>

                              {/* Delete */}
                              <button
                                type="button"
                                onClick={() => handleDelete(log._id)}
                                className="rounded-xl p-2 text-gray-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                                title="Delete log"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex flex-col gap-3 border-t border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>Show</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    setLimit(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-semibold text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span>of <strong>{total}</strong> entries</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-40 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  Previous
                </button>

                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">
                  Page {page} of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-40 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
                >
                  Next
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL: ADVANCED BROADCAST SMS DISPATCHER
      ────────────────────────────────────────────────────────────────────────── */}
      {showBroadcastModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-3xl rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-950 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-md shadow-amber-500/20">
                  <Send className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Emergency Broadcast SMS Dispatcher
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Targeted multi-subscriber alerts with live audience matching, location filters, and Amharic Unicode encoding.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBroadcastModal(false)}
                className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleBroadcastSubmit} className="mt-5 space-y-5">
              {/* Audience Type Selection */}
              <div>
                <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Select Broadcast Target
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setBroadcastForm({ ...broadcastForm, audienceType: "subscribers" })}
                    className={`flex items-center justify-between rounded-2xl border p-3.5 text-xs font-bold transition ${
                      broadcastForm.audienceType === "subscribers"
                        ? "border-amber-500 bg-amber-50 text-amber-900 shadow-sm dark:bg-amber-500/10 dark:text-amber-200"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Users className="h-4 w-4 text-blue-500" />
                      <div className="text-left">
                        <div className="font-bold">Subscribed Alert Clients</div>
                        <div className="text-[10px] font-normal opacity-80">Filter by category, status & location</div>
                      </div>
                    </div>
                    {broadcastForm.audienceType === "subscribers" && (
                      <Check className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setBroadcastForm({ ...broadcastForm, audienceType: "custom" })}
                    className={`flex items-center justify-between rounded-2xl border p-3.5 text-xs font-bold transition ${
                      broadcastForm.audienceType === "custom"
                        ? "border-amber-500 bg-amber-50 text-amber-900 shadow-sm dark:bg-amber-500/10 dark:text-amber-200"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Phone className="h-4 w-4 text-amber-500" />
                      <div className="text-left">
                        <div className="font-bold">Manual Phone List</div>
                        <div className="text-[10px] font-normal opacity-80">Paste custom numbers ({parsedPhoneCount} detected)</div>
                      </div>
                    </div>
                    {broadcastForm.audienceType === "custom" && (
                      <Check className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* ── Subscribed Audience Detailed Filter Box ─────────────────────── */}
              {broadcastForm.audienceType === "subscribers" ? (
                <div className="rounded-3xl border border-gray-200 bg-gray-50/70 p-4.5 space-y-4 dark:border-gray-800 dark:bg-gray-900/60">
                  <div className="flex items-center justify-between border-b border-gray-200/70 pb-2.5 dark:border-gray-800">
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-900 dark:text-white">
                      <SlidersHorizontal className="h-4 w-4 text-amber-500" />
                      <span>Subscriber Targeting Criteria (Matching /admin/alert-subscriptions)</span>
                    </div>

                    {/* Live Counter Badge */}
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                        {previewLoading ? (
                          <RefreshCw className="h-3 w-3 animate-spin text-blue-500" />
                        ) : (
                          <Users className="h-3 w-3" />
                        )}
                        <span>
                          {previewCount !== null ? `${previewCount} Matching Subscribers` : "Calculating..."}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Filter Grid */}
                  <div className="grid gap-3 sm:grid-cols-3">
                    {/* Audience Status */}
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                        Audience Status
                      </label>
                      <select
                        value={broadcastForm.audienceStatus}
                        onChange={(e) => setBroadcastForm({ ...broadcastForm, audienceStatus: e.target.value })}
                        className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 outline-none dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                      >
                        <option value="active">Active Subscribers Only (Recommended)</option>
                        <option value="paused">Paused Subscribers</option>
                        <option value="unsubscribed">Unsubscribed</option>
                        <option value="all">All Registered Audiences</option>
                      </select>
                    </div>

                    {/* Hazard Group */}
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                        Hazard Group
                      </label>
                      <select
                        value={broadcastForm.hazardGroup}
                        onChange={(e) => {
                          setBroadcastForm({
                            ...broadcastForm,
                            hazardGroup: e.target.value,
                            subscriberCategory: "all",
                          });
                        }}
                        className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 outline-none dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                      >
                        <option value="all">All Hazard Groups</option>
                        {ALERT_HAZARD_GROUPS.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Specific Hazard Category */}
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                        Specific Hazard
                      </label>
                      <select
                        value={broadcastForm.subscriberCategory}
                        onChange={(e) => {
                          const cat = e.target.value;
                          setBroadcastForm({
                            ...broadcastForm,
                            subscriberCategory: cat,
                            category: cat !== "all" ? cat : broadcastForm.category,
                          });
                        }}
                        className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 outline-none dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                      >
                        <option value="all">All Categories in Group</option>
                        {Object.entries(ALERT_CATEGORY_LABELS).map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Location Filters Grid */}
                  <div className="grid gap-3 sm:grid-cols-4">
                    {/* Region */}
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                        Region
                      </label>
                      <select
                        value={broadcastForm.region}
                        onChange={(e) => setBroadcastForm({ ...broadcastForm, region: e.target.value })}
                        className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 outline-none dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                      >
                        <option value="all">All Regions</option>
                        {ETHIOPIAN_REGIONS.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* City */}
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                        City
                      </label>
                      <input
                        type="text"
                        value={broadcastForm.city === "all" ? "" : broadcastForm.city}
                        onChange={(e) => setBroadcastForm({ ...broadcastForm, city: e.target.value || "all" })}
                        placeholder="e.g. Addis Ababa"
                        className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 outline-none dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                      />
                    </div>

                    {/* SubCity */}
                    <div>
                      <label className="mb-1 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                        <span>Sub-City</span>
                        {(branchLocked || branchSubcity) && (
                          <span className="text-[10px] font-normal text-amber-600 dark:text-amber-400">
                            (locked to your branch)
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        disabled={Boolean(branchLocked || branchSubcity)}
                        value={branchLocked || branchSubcity || (broadcastForm.subCity === "all" ? "" : broadcastForm.subCity)}
                        onChange={(e) => setBroadcastForm({ ...broadcastForm, subCity: e.target.value || "all" })}
                        placeholder="e.g. Bole, Kirkos"
                        className={`w-full rounded-2xl border px-3 py-2 text-xs outline-none ${
                          branchLocked || branchSubcity
                            ? "border-amber-200 bg-amber-50/50 text-amber-900 cursor-not-allowed dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                            : "border-gray-200 bg-white text-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                        }`}
                      />
                    </div>

                    {/* Woreda */}
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                        Woreda
                      </label>
                      <input
                        type="text"
                        value={broadcastForm.woreda === "all" ? "" : broadcastForm.woreda}
                        onChange={(e) => setBroadcastForm({ ...broadcastForm, woreda: e.target.value || "all" })}
                        placeholder="e.g. Woreda 03"
                        className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 outline-none dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Free-text location keyword filter */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex-1 min-w-[240px]">
                      <div className="relative">
                        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={broadcastForm.locationFilter}
                          onChange={(e) => setBroadcastForm({ ...broadcastForm, locationFilter: e.target.value })}
                          placeholder="Search address keyword (e.g. Gerji, Piassa, Lake Hawassa)..."
                          className="w-full rounded-2xl border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-xs text-gray-900 outline-none dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                        />
                      </div>
                    </div>

                    {/* SMS Channel toggle */}
                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={broadcastForm.smsChannelOnly}
                        onChange={(e) => setBroadcastForm({ ...broadcastForm, smsChannelOnly: e.target.checked })}
                        className="rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                      />
                      <span>Only subscribers with SMS channel opted-in</span>
                    </label>
                  </div>

                  {/* Sample preview tags */}
                  {previewSample.length > 0 && (
                    <div className="pt-2 border-t border-gray-200/60 dark:border-gray-800">
                      <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
                        Sample Target Recipients Preview:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {previewSample.map((s, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 rounded-xl bg-white px-2.5 py-1 text-[10px] font-medium text-gray-700 border border-gray-200 shadow-2xs dark:bg-gray-950 dark:border-gray-800 dark:text-gray-300"
                          >
                            <strong>{s.name}</strong> ({s.phone})
                            {s.region ? <span className="text-gray-400">• {s.region}</span> : null}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Custom Phone Number Input */
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                      Recipient Phone Numbers
                    </label>
                    <span className="text-[11px] text-gray-400">
                      Separate by comma, space or newline (e.g. 0911223344, 0712345678, 2519...)
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    value={broadcastForm.phoneNumbers}
                    onChange={(e) => setBroadcastForm({ ...broadcastForm, phoneNumbers: e.target.value })}
                    placeholder="0911223344&#10;0922334455&#10;251933445566"
                    className="w-full rounded-2xl border border-gray-200 bg-white p-3 font-mono text-xs text-gray-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                    required
                  />
                </div>
              )}

              {/* ── Emergency Presets & Custom Template Selector ─────────────────── */}
              <div className="rounded-3xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900 dark:text-white">
                    <Bookmark className="h-4 w-4 text-amber-500" />
                    <span>Emergency SMS Presets & Custom Templates</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowCreateTemplateModal(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 hover:underline dark:text-amber-400"
                  >
                    <BookmarkPlus className="h-3.5 w-3.5" />
                    + Save Current as New Template
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {allTemplates.map((tmpl) => (
                    <div
                      key={tmpl.id}
                      className="group inline-flex items-center rounded-xl border border-gray-200 bg-white text-[11px] font-semibold text-gray-700 transition hover:border-amber-400 hover:bg-amber-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setBroadcastForm({
                            ...broadcastForm,
                            message: tmpl.text,
                            category: tmpl.category,
                            severity: tmpl.severity,
                          })
                        }
                        className="px-2.5 py-1 text-left"
                      >
                        {tmpl.title}
                        {tmpl.isCustom && (
                          <span className="ml-1 text-[9px] text-amber-600 font-bold">(Custom)</span>
                        )}
                      </button>

                      {tmpl.isCustom && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCustomTemplate(tmpl.id)}
                          className="pr-2 pl-1 text-gray-400 hover:text-rose-600"
                          title="Delete custom template"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Message Composer & Character Counter */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    SMS Message Content
                  </label>
                  <div className="flex items-center gap-2 text-[11px]">
                    <span
                      className={`font-bold ${
                        broadcastIsUnicode ? "text-blue-600" : "text-gray-500"
                      }`}
                    >
                      {broadcastIsUnicode ? "UCS-2 (Amharic / Unicode)" : "GSM-7 (Standard English)"}
                    </span>
                    <span className="text-gray-400">|</span>
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      {broadcastForm.message.length} chars ({broadcastSegments} part{broadcastSegments > 1 ? "s" : ""})
                    </span>
                  </div>
                </div>
                <textarea
                  rows={4}
                  value={broadcastForm.message}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
                  placeholder="Enter emergency alert text in English or Amharic (አማርኛ)..."
                  className="w-full rounded-2xl border border-gray-200 bg-white p-3.5 text-sm leading-relaxed text-gray-900 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                  required
                />
              </div>

              {/* Category, Severity & Sender ID */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Hazard Classification
                  </label>
                  <select
                    value={broadcastForm.category}
                    onChange={(e) => setBroadcastForm({ ...broadcastForm, category: e.target.value })}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                  >
                    {Object.entries(ALERT_CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Alert Urgency / Severity
                  </label>
                  <select
                    value={broadcastForm.severity}
                    onChange={(e) => setBroadcastForm({ ...broadcastForm, severity: e.target.value })}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Source Sender ID
                  </label>
                  <input
                    type="text"
                    value={broadcastForm.senderId}
                    onChange={(e) => setBroadcastForm({ ...broadcastForm, senderId: e.target.value })}
                    placeholder="FDRMC"
                    className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 font-mono text-xs text-gray-900 outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
                <div className="text-xs text-gray-500">
                  {broadcastForm.audienceType === "subscribers" ? (
                    <span>
                      Target: <strong>{previewCount !== null ? previewCount : "..."}</strong> subscribers
                    </span>
                  ) : (
                    <span>
                      Target: <strong>{parsedPhoneCount}</strong> phone number(s)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowBroadcastModal(false)}
                    className="rounded-2xl border border-gray-200 px-5 py-2.5 text-xs font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={broadcasting || (broadcastForm.audienceType === "subscribers" && previewCount === 0)}
                    className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-amber-500/20 transition hover:bg-amber-600 disabled:opacity-60"
                  >
                    <Send className={`h-4 w-4 ${broadcasting ? "animate-bounce" : ""}`} />
                    {broadcasting ? "Transmitting Batch..." : "Transmit Broadcast Now"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL: CREATE CUSTOM SMS TEMPLATE
      ────────────────────────────────────────────────────────────────────────── */}
      {showCreateTemplateModal ? (
        <div className="fixed inset-0 z-60 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-950">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <BookmarkPlus className="h-5 w-5 text-amber-500" />
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Save Custom SMS Template
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateTemplateModal(false)}
                className="rounded-xl p-1.5 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomTemplate} className="mt-4 space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Template Title
                </label>
                <input
                  type="text"
                  value={newTemplateForm.title}
                  onChange={(e) => setNewTemplateForm({ ...newTemplateForm, title: e.target.value })}
                  placeholder="e.g. Drought Alert - Somali Region"
                  className="w-full rounded-2xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs text-gray-900 outline-none focus:border-amber-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Category
                  </label>
                  <select
                    value={newTemplateForm.category}
                    onChange={(e) => setNewTemplateForm({ ...newTemplateForm, category: e.target.value })}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                  >
                    {Object.entries(ALERT_CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Severity
                  </label>
                  <select
                    value={newTemplateForm.severity}
                    onChange={(e) => setNewTemplateForm({ ...newTemplateForm, severity: e.target.value })}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Message Text
                </label>
                <textarea
                  rows={4}
                  value={newTemplateForm.text}
                  onChange={(e) => setNewTemplateForm({ ...newTemplateForm, text: e.target.value })}
                  placeholder="Type template message content in English or Amharic..."
                  className="w-full rounded-2xl border border-gray-200 bg-white p-3 text-xs leading-relaxed text-gray-900 outline-none focus:border-amber-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowCreateTemplateModal(false)}
                  className="rounded-2xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-amber-500 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-amber-500/20 hover:bg-amber-600"
                >
                  <Check className="h-3.5 w-3.5" />
                  Save Template
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL: EDIT & RESEND SMS
      ────────────────────────────────────────────────────────────────────────── */}
      {editResendLog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-950">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-gray-800">
              <div className="flex items-center gap-2.5">
                <RotateCcw className="h-5 w-5 text-amber-500" />
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Edit & Resend Outbound SMS
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditResendLog(null)}
                className="rounded-xl p-1.5 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitEditResend} className="mt-4 space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Recipient Phone Number
                </label>
                <input
                  type="text"
                  value={resendForm.phone}
                  onChange={(e) => setResendForm({ ...resendForm, phone: e.target.value })}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-3.5 py-2.5 font-mono text-sm text-gray-900 outline-none focus:border-amber-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Recipient Name (Optional)
                </label>
                <input
                  type="text"
                  value={resendForm.recipientName}
                  onChange={(e) => setResendForm({ ...resendForm, recipientName: e.target.value })}
                  placeholder="e.g. Zone Coordinator"
                  className="w-full rounded-2xl border border-gray-200 bg-white px-3.5 py-2 text-xs text-gray-900 outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                />
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Message Content
                  </label>
                  <span className="text-[11px] text-gray-400">
                    {resendForm.message.length} chars
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={resendForm.message}
                  onChange={(e) => setResendForm({ ...resendForm, message: e.target.value })}
                  className="w-full rounded-2xl border border-gray-200 bg-white p-3 text-xs leading-relaxed text-gray-900 outline-none focus:border-amber-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Hazard Category
                  </label>
                  <select
                    value={resendForm.category}
                    onChange={(e) => setResendForm({ ...resendForm, category: e.target.value })}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                  >
                    {Object.entries(ALERT_CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                    Sender ID
                  </label>
                  <input
                    type="text"
                    value={resendForm.senderId}
                    onChange={(e) => setResendForm({ ...resendForm, senderId: e.target.value })}
                    className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 font-mono text-xs text-gray-900 outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setEditResendLog(null)}
                  className="rounded-2xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resendingId === editResendLog._id}
                  className="inline-flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-amber-500/20 transition hover:bg-amber-600 disabled:opacity-60"
                >
                  <Send className="h-3.5 w-3.5" />
                  {resendingId === editResendLog._id ? "Retrying..." : "Resend SMS Now"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL: TECHNICAL LOG INSPECTOR
      ────────────────────────────────────────────────────────────────────────── */}
      {inspectLog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-xl rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-950">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-gray-800">
              <div className="flex items-center gap-2.5">
                <Info className="h-5 w-5 text-amber-500" />
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  SMS Log Technical Details
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectLog(null)}
                className="rounded-xl p-1.5 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              {/* Message Details Box */}
              <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-900">
                <div className="flex items-center justify-between text-gray-400">
                  <span className="font-bold uppercase tracking-wider">Message Payload</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(inspectLog.message);
                      toast.success("Message copied to clipboard");
                    }}
                    className="flex items-center gap-1 font-semibold text-amber-600 hover:underline dark:text-amber-400"
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </button>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-gray-900 dark:text-white">
                  {inspectLog.message}
                </p>
              </div>

              {/* Technical Key-Value Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-gray-100 p-3 dark:border-gray-800">
                  <div className="text-gray-400">Recipient Phone:</div>
                  <div className="mt-1 font-mono font-bold text-gray-900 dark:text-white">
                    {inspectLog.recipientPhone}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 p-3 dark:border-gray-800">
                  <div className="text-gray-400">Delivery Status:</div>
                  <div className="mt-1 font-bold capitalize text-emerald-600 dark:text-emerald-400">
                    {inspectLog.status}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 p-3 dark:border-gray-800">
                  <div className="text-gray-400">SMSC Message ID:</div>
                  <div className="mt-1 font-mono text-gray-700 dark:text-gray-300 truncate">
                    {inspectLog.messageId || "N/A (Pending/Failed)"}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 p-3 dark:border-gray-800">
                  <div className="text-gray-400">Encoding / Segments:</div>
                  <div className="mt-1 font-bold text-gray-700 dark:text-gray-300">
                    {inspectLog.encoding || "GSM-7"} ({inspectLog.segments || 1} Part)
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 p-3 dark:border-gray-800">
                  <div className="text-gray-400">Sender ID (Source):</div>
                  <div className="mt-1 font-mono font-bold text-gray-700 dark:text-gray-300">
                    {inspectLog.senderId || "FDRMC"}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 p-3 dark:border-gray-800">
                  <div className="text-gray-400">Gateway Latency:</div>
                  <div className="mt-1 font-bold text-gray-700 dark:text-gray-300">
                    {inspectLog.latencyMs ? `${inspectLog.latencyMs} ms` : "N/A"}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 p-3 dark:border-gray-800">
                  <div className="text-gray-400">Broadcast Batch ID:</div>
                  <div className="mt-1 font-mono text-gray-700 dark:text-gray-300 truncate">
                    {inspectLog.broadcastBatchId || "Single Dispatch"}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 p-3 dark:border-gray-800">
                  <div className="text-gray-400">Retry Attempts:</div>
                  <div className="mt-1 font-bold text-gray-700 dark:text-gray-300">
                    {inspectLog.retryCount || 0} times
                  </div>
                </div>
              </div>

              {/* Error Trace if any */}
              {inspectLog.errorDetails ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                  <div className="font-bold">Error Trace Details:</div>
                  <div className="mt-1 font-mono text-xs">{inspectLog.errorDetails}</div>
                </div>
              ) : null}

              {/* Dispatched by user */}
              <div className="flex items-center justify-between text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-800">
                <span>Dispatched by: {inspectLog.sentBy?.name || "System Automated"}</span>
                <span>{new Date(inspectLog.createdAt).toLocaleString()}</span>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  handleOpenEditResend(inspectLog);
                  setInspectLog(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-amber-500 px-4 py-2 text-xs font-bold text-white hover:bg-amber-600"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Edit & Resend
              </button>
              <button
                type="button"
                onClick={() => setInspectLog(null)}
                className="rounded-2xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
