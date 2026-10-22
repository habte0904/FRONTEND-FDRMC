import React, { useState, useEffect, useMemo, useRef } from "react";
import { useBranchSubcity } from "@/context/HierarchyContext";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import api from "../../api/axios";
import { toast } from "react-toastify";
import {
  Mail,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Send,
  FileSpreadsheet,
  RotateCcw,
  Info,
  X,
  Users,
  Copy,
  Clock,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  MapPin,
  BookmarkPlus,
  Bookmark,
  Check,
  BarChart3,
  AtSign,
  PieChart,
  Eye,
  Plus,
} from "lucide-react";
import { formatAlertCategory, ALERT_CATEGORY_LABELS, ALERT_HAZARD_GROUPS } from "@/constants/alertCategories";
import { connectDashboardSocket } from "@/features/live-dashboard/socket/dashboardSocket";

type EmailLog = {
  _id: string;
  recipient: string;
  recipientName?: string;
  subject: string;
  body?: string;
  template?: string;
  category?: string;
  severity?: string;
  broadcastBatchId?: string;
  status: "pending" | "sent" | "failed" | "read" | "unread";
  messageId?: string;
  error?: string;
  retryCount?: number;
  type?: string;
  folder?: "inbox" | "sent" | "draft" | "trash";
  openedAt?: string;
  createdAt: string;
};

type EmailStats = {
  total: number;
  sent: number;
  failed: number;
  pending: number;
  read: number;
  todayCount: number;
  totalBatches: number;
  deliveryRate: number;
  categoryBreakdown: Array<{ category: string; count: number }>;
};

type EmailTemplate = {
  id: string;
  title: string;
  category: string;
  severity: string;
  subject: string;
  body: string;
  isCustom?: boolean;
};

const DEFAULT_EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "flood-en",
    title: "Flood Emergency Bulletin (English)",
    category: "floods",
    severity: "urgent",
    subject: "URGENT FLOOD ALERT: Rising Water Levels Detected in Your Zone",
    body: `URGENT FLOOD EARLY WARNING NOTICE\n\nNational Disaster Risk Management Commission (FDRMC)\n\nAttention Residents:\nRising water levels and flash flood hazards have been detected in your catchment area within the last few hours.\n\nRecommended Actions:\n1. Move immediately to higher ground.\n2. Do not attempt to walk or drive through flooded roads or bridges.\n3. Secure livestock, vital documentation, and emergency provisions.\n4. Call 939 for emergency response and rescue services.\n\nIssued by IDRMIS Emergency Operations Center.`,
  },
  {
    id: "flood-am",
    title: "የጎርፍ ማስጠንቀቂያ መግለጫ (Amharic)",
    category: "floods",
    severity: "urgent",
    subject: "አስቸኳይ የጎርፍ አደጋ ማስጠንቀቂያ፡ በአካባቢዎ የውሃ መጠን በከፍተኛ ሁኔታ እየጨመረ ነው",
    body: `አስቸኳይ የጎርፍ አደጋ ማስጠንቀቂያ መግለጫ\n\nየኢትዮጵያ አደጋ ስጋት አመራር ኮሚሽን (FDRMC)\n\nውድ ነዋሪዎች፡\nበአካባቢዎ ባሉ ወንዞችና የውሃ ተፋሰሶች ላይ የውሃ መጠን በከፍተኛ ሁኔታ እየጨመረ በመሆኑ የአደጋ ስጋት ተደቅኗል።\n\nየሚወሰዱ ጥንቃቄዎች፡\n1. በአፋጣኝ ወደ ከፍታ ቦታዎች ይውጡ።\n2. የጎርፍ ውሀ የሞላባቸውን መንገዶችና ድልድዮች በፍጹም አያቋርጡ።\n3. ለአደጋ ጊዜ እርዳታ በ939 በነጻ የስልክ መስመር ይደውሉ።\n\nየብሔራዊ ቅድመ ማስጠንቀቂያ ማዕከል`,
  },
  {
    id: "fire-en",
    title: "Fire Evacuation Advisory (English)",
    category: "structural_fire",
    severity: "critical",
    subject: "CRITICAL FIRE ALERT: Immediate Evacuation Order",
    body: `CRITICAL FIRE EVACUATION NOTICE\n\nA major wildfire / structural fire emergency has been detected in the vicinity. Evacuate immediately following local emergency service routes. Avoid smoke inhalation and keep emergency lines clear.\n\nEmergency Helpline: 939 - FDRMC`,
  },
  {
    id: "weather-en",
    title: "Severe Weather Advisory",
    category: "drought",
    severity: "high",
    subject: "SEVERE WEATHER ADVISORY: Upcoming Adverse Conditions",
    body: `METEOROLOGICAL EARLY WARNING NOTICE\n\nSevere weather and extreme temperature fluctuations are projected over the next 24 to 48 hours. Communities and agricultural sectors are urged to take preventative measures.\n\n- FDRMC Operations`,
  },
  {
    id: "system-test",
    title: "Gateway System Test Notice",
    category: "other",
    severity: "normal",
    subject: "SYSTEM VERIFICATION: IDRMIS National Early Warning Gateway Test",
    body: `This is a routine system verification broadcast from the National Disaster Risk Early Warning System (FDRMC). No action is required. All communication channels are functioning nominally.`,
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

export default function EmailLogs() {
  const branchSubcity = useBranchSubcity();
  const [branchLocked, setBranchLocked] = useState<string | null>(null);
  const [logs, setLogs] = useState<EmailLog[]>([]);
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
  const [folderFilter, setFolderFilter] = useState("sent");
  const [sortBy] = useState("createdAt");
  const [sortOrder] = useState<"desc" | "asc">("desc");

  // Selection for bulk operations
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkResending, setBulkResending] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);

  // View toggle for Report Analysis
  const [showAnalysis, setShowAnalysis] = useState(true);

  // Stats
  const [stats, setStats] = useState<EmailStats>({
    total: 0,
    sent: 0,
    failed: 0,
    pending: 0,
    read: 0,
    todayCount: 0,
    totalBatches: 0,
    deliveryRate: 0,
    categoryBreakdown: [],
  });

  // Modal States
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [inspectLog, setInspectLog] = useState<EmailLog | null>(null);
  const [editResendLog, setEditResendLog] = useState<EmailLog | null>(null);

  // Custom Template State
  const [savedTemplates, setSavedTemplates] = useState<EmailTemplate[]>([]);
  const [showCreateTemplateModal, setShowCreateTemplateModal] = useState(false);
  const [newTemplateForm, setNewTemplateForm] = useState({
    title: "",
    category: "floods",
    severity: "urgent",
    subject: "",
    body: "",
  });

  // Broadcast Form State
  const [broadcastForm, setBroadcastForm] = useState({
    audienceType: "subscribers" as "custom" | "subscribers",
    emails: "",
    audienceStatus: "active",
    hazardGroup: "all",
    subscriberCategory: "all",
    region: "all",
    city: "all",
    subCity: "all",
    woreda: "all",
    locationFilter: "",
    emailChannelOnly: true,
    category: "floods",
    severity: "high",
    subject: "",
    body: "",
  });

  // Compose Manual Form State
  const [composeForm, setComposeForm] = useState({
    to: "",
    recipientName: "",
    subject: "",
    body: "",
    category: "general",
    severity: "normal",
    action: "send" as "send" | "draft",
  });

  // Edit & Resend Form State
  const [resendForm, setResendForm] = useState({
    to: "",
    recipientName: "",
    subject: "",
    body: "",
    category: "general",
    severity: "normal",
  });

  // Subscriber Preview
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewSample, setPreviewSample] = useState<Array<{ name: string; email: string; region: string; city: string; subCity: string; woreda: string; status: string }>>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [broadcasting, setBroadcasting] = useState(false);
  const [composing, setComposing] = useState(false);
  const previewDebounceRef = useRef<any>(null);

  // Active Email Broadcast Background Progress Monitor
  const [activeBroadcast, setActiveBroadcast] = useState<{
    batchId: string;
    total: number;
    sent: number;
    failed: number;
    percent: number;
  } | null>(null);

  // WebSocket listeners for real-time email broadcast progress and completion
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
      fetchStats();
    };

    const handleCompleted = (data: any) => {
      toast.success(
        `Emergency Email Broadcast ${data.batchId || ""} finished: ${data.sent || 0} delivered, ${data.failed || 0} failed.`
      );
      fetchLogs();
      fetchStats();
      setTimeout(() => {
        setActiveBroadcast(null);
      }, 7000);
    };

    socket.on("email:broadcast:progress", handleProgress);
    socket.on("email:broadcast:completed", handleCompleted);

    return () => {
      socket.off("email:broadcast:progress", handleProgress);
      socket.off("email:broadcast:completed", handleCompleted);
    };
  }, []);

  // Load custom templates
  useEffect(() => {
    try {
      const stored = localStorage.getItem("IDRMIS_SAVED_EMAIL_TEMPLATES");
      if (stored) {
        setSavedTemplates(JSON.parse(stored));
      }
    } catch (_) {}
  }, []);

  const allTemplates = useMemo(() => {
    return [...DEFAULT_EMAIL_TEMPLATES, ...savedTemplates];
  }, [savedTemplates]);

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [page, limit, statusFilter, categoryFilter, typeFilter, folderFilter, sortBy, sortOrder]);

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

  // Debounced Subscriber Preview
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
    broadcastForm.emailChannelOnly,
  ]);

  const fetchSubscriberPreview = async () => {
    setPreviewLoading(true);
    try {
      const response = await api.post("/email-logs/preview-subscribers", {
        audienceStatus: broadcastForm.audienceStatus,
        subscriberCategory: broadcastForm.subscriberCategory,
        hazardGroup: broadcastForm.hazardGroup,
        region: broadcastForm.region,
        city: broadcastForm.city,
        subCity: broadcastForm.subCity,
        woreda: broadcastForm.woreda,
        locationFilter: broadcastForm.locationFilter,
        emailChannelOnly: broadcastForm.emailChannelOnly,
      });
      setPreviewCount(response.data?.totalCount ?? 0);
      setPreviewSample(response.data?.sample || []);
      if (response.data?.branchLocked) setBranchLocked(response.data.branchLocked);
    } catch (err) {
      console.error("Failed to preview email subscribers", err);
      setPreviewCount(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get("/email-logs/stats");
      if (response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error("Failed to fetch email statistics", error);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params: any = {
        page,
        limit,
        folder: folderFilter,
        sortBy,
        sortOrder,
      };
      if (statusFilter !== "all") params.status = statusFilter;
      if (categoryFilter !== "all") params.category = categoryFilter;
      if (typeFilter !== "all") params.type = typeFilter;
      if (searchTerm.trim()) params.search = searchTerm.trim();

      const response = await api.get("/email-logs", { params });
      setLogs(response.data?.logs || []);
      setTotal(response.data?.total || 0);
      setTotalPages(response.data?.totalPages || 1);
      if (response.data?.branchLocked) setBranchLocked(response.data.branchLocked);
    } catch (error) {
      console.error("Failed to fetch email logs", error);
      toast.error("Failed to fetch email logs");
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
    setFolderFilter("sent");
    setPage(1);
  };

  // Quick Resend
  const handleQuickResend = async (id: string) => {
    setResendingId(id);
    try {
      const response = await api.post(`/email-logs/${id}/resend`);
      if (response.data?.success) {
        toast.success(response.data?.message || "Email resent successfully");
      } else {
        toast.error(response.data?.message || "Failed to resend email");
      }
      fetchLogs();
      fetchStats();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to resend email");
    } finally {
      setResendingId(null);
    }
  };

  // Open Edit & Resend Modal
  const handleOpenEditResend = (log: EmailLog) => {
    setEditResendLog(log);
    setResendForm({
      to: log.recipient,
      recipientName: log.recipientName || "",
      subject: log.subject,
      body: log.body || "",
      category: log.category || "general",
      severity: log.severity || "normal",
    });
  };

  // Submit Edit & Resend
  const handleSubmitEditResend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editResendLog) return;
    setResendingId(editResendLog._id);
    try {
      const response = await api.post(`/email-logs/${editResendLog._id}/resend`, resendForm);
      if (response.data?.success) {
        toast.success(response.data?.message || "Email resent successfully");
        setEditResendLog(null);
      } else {
        toast.error(response.data?.message || "Failed to resend email");
      }
      fetchLogs();
      fetchStats();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to resend email");
    } finally {
      setResendingId(null);
    }
  };

  // Bulk Resend Failed
  const handleBulkResendFailed = async (onlySelected = false) => {
    const ids = onlySelected ? selectedIds : [];
    const count = onlySelected ? ids.length : stats.failed;
    if (count === 0) {
      toast.info("No failed emails to retry.");
      return;
    }

    if (!window.confirm(`Are you sure you want to retry sending ${count} failed email(s)?`)) {
      return;
    }

    setBulkResending(true);
    try {
      const payload: any = onlySelected ? { ids } : { allFailed: true };
      const response = await api.post("/email-logs/bulk-resend", payload);
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

  // Delete Single
  const handleDelete = async (id: string) => {
    if (!window.confirm("Permanently delete this email log record?")) return;
    try {
      await api.delete(`/email-logs/${id}`);
      setLogs((prev) => prev.filter((item) => item._id !== id));
      setTotal((prev) => Math.max(0, prev - 1));
      toast.success("Email log deleted");
      fetchStats();
    } catch (error) {
      toast.error("Failed to delete email log");
    }
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedIds.length} selected email log(s)?`)) return;

    setBulkDeleting(true);
    try {
      await api.delete("/email-logs/bulk-delete", { data: { ids: selectedIds } });
      toast.success("Selected logs deleted");
      setSelectedIds([]);
      fetchLogs();
      fetchStats();
    } catch (error) {
      toast.error("Failed to delete selected logs");
    } finally {
      setBulkDeleting(false);
    }
  };

  // Submit Broadcast
  const handleBroadcastSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastForm.subject.trim() || !broadcastForm.body.trim()) {
      toast.warning("Please enter email subject and message body");
      return;
    }
    if (broadcastForm.audienceType === "custom" && !broadcastForm.emails.trim()) {
      toast.warning("Please enter at least one recipient email address");
      return;
    }
    if (broadcastForm.audienceType === "subscribers" && previewCount === 0) {
      toast.error("No subscribers found matching the selected filters.");
      return;
    }

    setBroadcasting(true);
    try {
      const response = await api.post("/email-logs/broadcast", broadcastForm);
      if (response.data?.success) {
        if (response.data?.isAsync) {
          setActiveBroadcast({
            batchId: response.data.batchId,
            total: response.data.totalCount || 0,
            sent: 0,
            failed: 0,
            percent: 0,
          });
          toast.info(response.data?.message || "Email broadcast running in background with TPS throttle.");
        } else {
          toast.success(response.data?.message || "Broadcast dispatch completed!");
        }
        setShowBroadcastModal(false);
        fetchLogs();
        fetchStats();
      } else {
        toast.error(response.data?.message || "Broadcast failed");
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to dispatch email broadcast");
    } finally {
      setBroadcasting(false);
    }
  };

  // Submit Manual Compose
  const handleComposeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!composeForm.to.trim() || !composeForm.subject.trim() || !composeForm.body.trim()) {
      toast.warning("Please complete recipient, subject, and body");
      return;
    }

    const val = validateEmailClient(composeForm.to);
    if (!val.isValid) {
      toast.error(val.error || "Invalid recipient email address");
      return;
    }

    setComposing(true);
    try {
      await api.post("/email-logs/manual", composeForm);
      toast.success(composeForm.action === "draft" ? "Draft saved successfully" : "Email sent successfully");
      setShowComposeModal(false);
      setComposeForm({
        to: "",
        recipientName: "",
        subject: "",
        body: "",
        category: "general",
        severity: "normal",
        action: "send",
      });
      fetchLogs();
      fetchStats();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to send email");
    } finally {
      setComposing(false);
    }
  };

  // Save Custom Template
  const handleSaveCustomTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateForm.title.trim() || !newTemplateForm.subject.trim() || !newTemplateForm.body.trim()) {
      toast.warning("Please fill all template fields");
      return;
    }

    const created: EmailTemplate = {
      id: `custom-email-${Date.now()}`,
      title: newTemplateForm.title.trim(),
      category: newTemplateForm.category,
      severity: newTemplateForm.severity,
      subject: newTemplateForm.subject.trim(),
      body: newTemplateForm.body.trim(),
      isCustom: true,
    };

    const updated = [...savedTemplates, created];
    setSavedTemplates(updated);
    try {
      localStorage.setItem("IDRMIS_SAVED_EMAIL_TEMPLATES", JSON.stringify(updated));
    } catch (_) {}

    toast.success("Custom email template saved!");
    setShowCreateTemplateModal(false);
    setNewTemplateForm({ title: "", category: "floods", severity: "urgent", subject: "", body: "" });
  };

  const handleDeleteCustomTemplate = (id: string) => {
    const updated = savedTemplates.filter((t) => t.id !== id);
    setSavedTemplates(updated);
    try {
      localStorage.setItem("IDRMIS_SAVED_EMAIL_TEMPLATES", JSON.stringify(updated));
    } catch (_) {}
    toast.success("Template deleted");
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (logs.length === 0) {
      toast.info("No logs to export");
      return;
    }

    const headers = ["Recipient", "Recipient Name", "Subject", "Status", "Category", "Severity", "Type", "Batch ID", "Message ID", "Date"];
    const rows = logs.map((log) => [
      `"${log.recipient || ""}"`,
      `"${log.recipientName || ""}"`,
      `"${(log.subject || "").replace(/"/g, '""')}"`,
      `"${log.status}"`,
      `"${log.category || "general"}"`,
      `"${log.severity || "normal"}"`,
      `"${log.type || "Alert"}"`,
      `"${log.broadcastBatchId || ""}"`,
      `"${log.messageId || ""}"`,
      `"${new Date(log.createdAt).toISOString()}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `IDRMIS_Email_Logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Email logs exported to CSV");
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

  const validateEmailClient = (email: string): { isValid: boolean; error?: string } => {
    if (!email || !email.trim()) return { isValid: false, error: "Email cannot be empty." };
    const trimmed = email.trim().toLowerCase();
    const regex = /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i;
    if (!regex.test(trimmed)) return { isValid: false, error: `Invalid email address format: "${email}"` };
    const parts = trimmed.split("@");
    if (parts.length !== 2) return { isValid: false, error: "Missing or duplicate @ symbol." };
    const domainParts = parts[1].split(".");
    if (domainParts.length < 2) return { isValid: false, error: `Missing domain extension in "${parts[1]}".` };
    const lastPart = domainParts[domainParts.length - 1];
    const KNOWN_TYPO_TLDS = new Set([
      "coms", "comm", "con", "cm", "coom", "xom", "cpm", "vom",
      "orgs", "og", "orgg", "nett", "ne", "nt", "gmaill", "gmai", "gmil", "ets", "ett"
    ]);
    if (KNOWN_TYPO_TLDS.has(lastPart)) {
      return { isValid: false, error: `Typo in domain extension ".${lastPart}". Did you mean ".com" or ".et"?` };
    }
    return { isValid: true };
  };

  const parsedEmailCount = useMemo(() => {
    if (broadcastForm.audienceType !== "custom") return 0;
    const list = broadcastForm.emails
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter((s) => validateEmailClient(s).isValid);
    return new Set(list).size;
  }, [broadcastForm.emails, broadcastForm.audienceType]);

  return (
    <>
      <PageMeta
        title="Email Broadcast & Logs | IDRMIS"
        description="Emergency Email Broadcast Dispatcher, Delivery Tracking, and SMTP Audit Logs"
      />
      <PageBreadcrumb pageTitle="Email Broadcast & Audit Logs" />

      <div className="space-y-6">
        {/* Branch Jurisdiction Banner */}
        {branchSubcity && (
          <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 dark:border-blue-800/50 dark:bg-blue-900/20 dark:text-blue-300">
            <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500" />
            <div>
              <span className="font-semibold">Branch Jurisdiction — {branchLocked || branchSubcity} Subcity</span>
              <p className="mt-0.5 text-xs text-blue-600/80 dark:text-blue-400/80">
                You are viewing and broadcasting email logs scoped to your branch subcity only. Head office users can see all logs city-wide.
              </p>
            </div>
          </div>
        )}

        {/* Live Active Emergency Email Broadcast Monitor */}
        {activeBroadcast && (
          <div className="relative overflow-hidden rounded-3xl border border-blue-400/80 bg-gradient-to-r from-blue-500/[0.08] via-indigo-500/[0.06] to-blue-500/[0.04] p-5 shadow-lg shadow-blue-500/5 dark:border-blue-500/30 dark:from-blue-950/40 dark:to-slate-950/40">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-widest text-blue-700 dark:text-blue-300">
                      ⚡ Active Emergency Email Broadcast Dispatch
                    </span>
                    <span className="font-mono text-[11px] font-bold text-gray-500">
                      #{activeBroadcast.batchId}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Dispatching with SMTP TPS rate limiting & responsive FDRMC disaster alert templates.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-auto">
                <span className="text-base font-black font-mono text-blue-600 dark:text-blue-400">
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
                className="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 h-full rounded-full transition-all duration-300 shadow-sm"
                style={{ width: `${Math.min(100, Math.max(3, activeBroadcast.percent))}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 font-medium mt-2.5">
              <span>
                Delivered / Sent: <strong className="text-emerald-600 font-bold">{activeBroadcast.sent}</strong>
              </span>
              {activeBroadcast.failed > 0 && (
                <span className="text-rose-600 font-bold">
                  Failed / Bounced: {activeBroadcast.failed}
                </span>
              )}
              <span className="font-mono text-[11px] text-gray-400">
                SMTP TPS Throttle Active
              </span>
            </div>
          </div>
        )}

        {/* Top Hero Banner & Actions */}
        <div className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-slate-950/40">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/20">
                <Mail className="h-7 w-7" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    Email Broadcast & Dispatch Center
                  </h3>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    SMTP Active
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Targeted emergency email broadcasts by hazard category, location, and subscriber status with delivery auditing.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setShowBroadcastModal(true)}
                className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 active:scale-95"
              >
                <Send className="h-4 w-4" />
                Broadcast Email
              </button>

              <button
                type="button"
                onClick={() => setShowComposeModal(true)}
                className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs font-bold text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <Plus className="h-4 w-4 text-blue-600" />
                Compose Direct
              </button>

              {stats.failed > 0 ? (
                <button
                  type="button"
                  onClick={() => handleBulkResendFailed(false)}
                  disabled={bulkResending}
                  className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-xs font-bold text-rose-800 transition hover:bg-rose-100 disabled:opacity-50 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
                >
                  <RotateCcw className={`h-3.5 w-3.5 ${bulkResending ? "animate-spin" : ""}`} />
                  {bulkResending ? "Retrying..." : `Retry Failed (${stats.failed})`}
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => setShowAnalysis(!showAnalysis)}
                className={`inline-flex items-center gap-1.5 rounded-2xl border px-3.5 py-2.5 text-xs font-bold transition shadow-sm ${
                  showAnalysis
                    ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
                }`}
                title="Toggle Report Analytics"
              >
                <BarChart3 className="h-4 w-4" />
                Analytics
              </button>

              <button
                type="button"
                onClick={handleExportCSV}
                className="inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs font-bold text-gray-700 shadow-sm transition hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                title="Export logs as CSV"
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
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-blue-600" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {/* ── REPORT ANALYSIS PANEL (KPI Cards & Category Breakdown) ────────── */}
        {showAnalysis && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-slate-950/40">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Total Emails Dispatched
                  </span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
                    <Mail className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-gray-900 dark:text-white">
                    {stats.total.toLocaleString()}
                  </span>
                  <span className="text-xs font-medium text-gray-400">
                    ({stats.totalBatches} batches)
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
                    Delivery Success Rate
                  </span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-2xl font-black text-gray-900 dark:text-white">
                    {(stats.sent + stats.read).toLocaleString()}
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
                    Failed Deliveries
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
                  <span className="text-gray-400">SMTP bounces / timeouts</span>
                  {stats.failed > 0 ? (
                    <button
                      type="button"
                      onClick={() => handleBulkResendFailed(false)}
                      className="font-bold text-rose-600 hover:underline"
                    >
                      Retry Now →
                    </button>
                  ) : (
                    <span className="font-semibold text-emerald-600">All healthy</span>
                  )}
                </div>
              </div>

              {/* Hazard Volume Breakdown */}
              <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-slate-950/40">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                    Top Hazard Channels
                  </span>
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-300">
                    <PieChart className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {stats.categoryBreakdown.length > 0 ? (
                    stats.categoryBreakdown.slice(0, 4).map((c, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-xl bg-gray-50 px-2 py-0.5 text-[10px] font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                      >
                        {formatAlertCategory(c.category)}: <strong>{c.count}</strong>
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-gray-400">No category breakdown yet</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── FILTER & SEARCH SECTION ───────────────────────────────────────── */}
        <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-slate-950/40">
          <div className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <form onSubmit={handleSearchSubmit} className="relative flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by recipient email, name, subject, message body, batch ID, or error..."
                  className="w-full rounded-2xl border border-gray-200 bg-white py-2.5 pl-10 pr-24 text-xs text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                />
                <button
                  type="submit"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-xl bg-gray-900 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-gray-800 dark:bg-white dark:text-gray-950"
                >
                  Search
                </button>
              </form>

              {/* Status Tabs */}
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
                        ? "bg-blue-600 text-white shadow-sm shadow-blue-500/20"
                        : "bg-gray-50 text-gray-600 hover:bg-gray-100 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800"
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sub-Filters */}
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

              {/* Email Type Filter */}
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300"
              >
                <option value="all">All Message Types</option>
                <option value="Alert">Alert Warnings</option>
                <option value="Manual">Manual Dispatches</option>
                <option value="Verification">Verification Codes</option>
                <option value="Welcome">Welcome Onboarding</option>
                <option value="PasswordReset">Password Resets</option>
                <option value="Other">Other / Automated</option>
              </select>

              {(statusFilter !== "all" ||
                categoryFilter !== "all" ||
                typeFilter !== "all" ||
                searchTerm) && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="rounded-xl px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                >
                  Clear all filters
                </button>
              )}

              {/* Bulk Selected Actions */}
              {selectedIds.length > 0 && (
                <div className="ml-auto flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-1 text-xs font-bold text-blue-900 dark:bg-blue-500/10 dark:text-blue-200">
                  <span>{selectedIds.length} selected</span>
                  <button
                    type="button"
                    onClick={() => handleBulkResendFailed(true)}
                    className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] text-white hover:bg-blue-700"
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

          {/* Table */}
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
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
                    <th className="px-4 py-3.5">Recipient</th>
                    <th className="px-4 py-3.5">Subject & Content Preview</th>
                    <th className="px-4 py-3.5">Category & Urgency</th>
                    <th className="px-4 py-3.5">Type</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Dispatched At</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-sm text-gray-500">
                        <RefreshCw className="mx-auto mb-2 h-6 w-6 animate-spin text-blue-600" />
                        Loading email logs...
                      </td>
                    </tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-sm text-gray-500">
                        <Mail className="mx-auto mb-2 h-8 w-8 text-gray-300 dark:text-gray-700" />
                        No email logs found matching the active filter.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log) => {
                      const isSelected = selectedIds.includes(log._id);

                      return (
                        <tr
                          key={log._id}
                          className={`transition hover:bg-gray-50/60 dark:hover:bg-slate-900/30 ${
                            isSelected ? "bg-blue-50/40 dark:bg-blue-500/5" : ""
                          }`}
                        >
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectId(log._id)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                          </td>

                          {/* Recipient */}
                          <td className="px-4 py-3 font-semibold text-gray-900 dark:text-white">
                            <div className="flex items-center gap-1.5">
                              <AtSign className="h-3.5 w-3.5 text-gray-400" />
                              <span className="font-mono text-xs">{log.recipient}</span>
                            </div>
                            {log.recipientName ? (
                              <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                                {log.recipientName}
                              </div>
                            ) : null}
                          </td>

                          {/* Subject & Preview */}
                          <td className="max-w-md px-4 py-3">
                            <div
                              onClick={() => setInspectLog(log)}
                              className="cursor-pointer font-bold text-gray-900 hover:text-blue-600 dark:text-white dark:hover:text-blue-400 line-clamp-1"
                              title="Click to inspect email"
                            >
                              {log.subject}
                            </div>
                            <div className="mt-0.5 line-clamp-1 text-[11px] text-gray-500 dark:text-gray-400">
                              {log.body}
                            </div>

                            {log.error ? (
                              <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-rose-500">
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                <span className="truncate">{log.error}</span>
                              </div>
                            ) : null}
                          </td>

                          {/* Category & Severity */}
                          <td className="px-4 py-3">
                            <div className="space-y-1">
                              <span className="inline-flex items-center rounded-lg bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                {formatAlertCategory(log.category || "general")}
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

                          {/* Type */}
                          <td className="px-4 py-3 font-medium text-gray-700 dark:text-gray-300">
                            {log.type || "Alert"}
                            {log.retryCount && log.retryCount > 0 ? (
                              <div className="text-[10px] text-amber-600 font-bold">
                                Retried {log.retryCount}x
                              </div>
                            ) : null}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${
                                log.status === "sent" || log.status === "read"
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                                  : log.status === "failed"
                                    ? "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300"
                                    : "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  log.status === "sent" || log.status === "read"
                                    ? "bg-emerald-500 animate-pulse"
                                    : log.status === "failed"
                                      ? "bg-rose-500"
                                      : "bg-amber-500 animate-ping"
                                }`}
                              />
                              {log.status}
                            </span>
                          </td>

                          {/* Time */}
                          <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                            <div>{new Date(log.createdAt).toLocaleDateString()}</div>
                            <div className="text-[11px] text-gray-400">
                              {new Date(log.createdAt).toLocaleTimeString()}
                            </div>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleOpenEditResend(log)}
                                className="rounded-xl border border-blue-200 bg-blue-50 p-2 text-blue-700 shadow-sm transition hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300"
                                title="Edit & Resend Email"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleQuickResend(log._id)}
                                disabled={resendingId === log._id}
                                className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
                                title="Quick Resend"
                              >
                                <RefreshCw
                                  className={`h-3.5 w-3.5 ${
                                    resendingId === log._id ? "animate-spin text-blue-600" : ""
                                  }`}
                                />
                              </button>

                              <button
                                type="button"
                                onClick={() => setInspectLog(log)}
                                className="rounded-xl p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
                                title="View Email Details"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>

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

            {/* Pagination */}
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
          MODAL: EMERGENCY EMAIL BROADCAST DISPATCHER
      ────────────────────────────────────────────────────────────────────────── */}
      {showBroadcastModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-3xl rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-950 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-gray-800">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
                  <Send className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">
                    Emergency Email Broadcast Dispatcher
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Send multi-subscriber bulletins filtered by disaster hazard, audience status, and geographic zones.
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
              {/* Target Toggle */}
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
                        ? "border-blue-600 bg-blue-50 text-blue-900 shadow-sm dark:bg-blue-500/10 dark:text-blue-200"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Users className="h-4 w-4 text-blue-600" />
                      <div className="text-left">
                        <div className="font-bold">Subscribed Alert Clients</div>
                        <div className="text-[10px] font-normal opacity-80">Filter by category, status & location</div>
                      </div>
                    </div>
                    {broadcastForm.audienceType === "subscribers" && (
                      <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setBroadcastForm({ ...broadcastForm, audienceType: "custom" })}
                    className={`flex items-center justify-between rounded-2xl border p-3.5 text-xs font-bold transition ${
                      broadcastForm.audienceType === "custom"
                        ? "border-blue-600 bg-blue-50 text-blue-900 shadow-sm dark:bg-blue-500/10 dark:text-blue-200"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <AtSign className="h-4 w-4 text-amber-500" />
                      <div className="text-left">
                        <div className="font-bold">Manual Email List</div>
                        <div className="text-[10px] font-normal opacity-80">Paste custom list ({parsedEmailCount} valid)</div>
                      </div>
                    </div>
                    {broadcastForm.audienceType === "custom" && (
                      <Check className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    )}
                  </button>
                </div>
              </div>

              {/* Subscribed Filters */}
              {broadcastForm.audienceType === "subscribers" ? (
                <div className="rounded-3xl border border-gray-200 bg-gray-50/70 p-4.5 space-y-4 dark:border-gray-800 dark:bg-gray-900/60">
                  <div className="flex items-center justify-between border-b border-gray-200/70 pb-2.5 dark:border-gray-800">
                    <div className="flex items-center gap-2 text-xs font-bold text-gray-900 dark:text-white">
                      <SlidersHorizontal className="h-4 w-4 text-blue-600" />
                      <span>Subscriber Targeting Criteria (Matching /admin/alert-subscriptions)</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                        {previewLoading ? (
                          <RefreshCw className="h-3 w-3 animate-spin text-blue-600" />
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
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                        Audience Status
                      </label>
                      <select
                        value={broadcastForm.audienceStatus}
                        onChange={(e) => setBroadcastForm({ ...broadcastForm, audienceStatus: e.target.value })}
                        className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-900 outline-none dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                      >
                        <option value="active">Active Subscribers (Recommended)</option>
                        <option value="paused">Paused Subscribers</option>
                        <option value="unsubscribed">Unsubscribed</option>
                        <option value="all">All Registered Audiences</option>
                      </select>
                    </div>

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
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Location Grid */}
                  <div className="grid gap-3 sm:grid-cols-4">
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
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>

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

                    <div>
                      <label className="mb-1 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                        <span>Sub-City</span>
                        {(branchLocked || branchSubcity) && (
                          <span className="text-[10px] font-normal text-blue-600 dark:text-blue-400">
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
                            ? "border-blue-200 bg-blue-50/50 text-blue-900 cursor-not-allowed dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300"
                            : "border-gray-200 bg-white text-gray-900 dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                        }`}
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                        Woreda
                      </label>
                      <input
                        type="text"
                        value={broadcastForm.woreda === "all" ? "" : broadcastForm.woreda}
                        onChange={(e) => setBroadcastForm({ ...broadcastForm, woreda: e.target.value || "all" })}
                        placeholder="e.g. Woreda 05"
                        className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 outline-none dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Free-text location keyword & email toggle */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <div className="flex-1 min-w-[240px]">
                      <div className="relative">
                        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                        <input
                          type="text"
                          value={broadcastForm.locationFilter}
                          onChange={(e) => setBroadcastForm({ ...broadcastForm, locationFilter: e.target.value })}
                          placeholder="Search address keyword..."
                          className="w-full rounded-2xl border border-gray-200 bg-white py-1.5 pl-8 pr-3 text-xs text-gray-900 outline-none dark:border-gray-800 dark:bg-gray-950 dark:text-white"
                        />
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={broadcastForm.emailChannelOnly}
                        onChange={(e) => setBroadcastForm({ ...broadcastForm, emailChannelOnly: e.target.checked })}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Only subscribers with Email channel opted-in</span>
                    </label>
                  </div>

                  {/* Sample preview */}
                  {previewSample.length > 0 && (
                    <div className="pt-2 border-t border-gray-200/60 dark:border-gray-800">
                      <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5">
                        Sample Target Recipients:
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {previewSample.map((s, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 rounded-xl bg-white px-2.5 py-1 text-[10px] font-medium text-gray-700 border border-gray-200 shadow-2xs dark:bg-gray-950 dark:border-gray-800 dark:text-gray-300"
                          >
                            <strong>{s.name}</strong> ({s.email})
                            {s.region ? <span className="text-gray-400">• {s.region}</span> : null}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                      Recipient Email Addresses
                    </label>
                    <span className="text-[11px] text-gray-400">
                      Separate by comma, space or newline (e.g. alert@fmo.gov.et, info@drpc.gov.et)
                    </span>
                  </div>
                  <textarea
                    rows={3}
                    value={broadcastForm.emails}
                    onChange={(e) => setBroadcastForm({ ...broadcastForm, emails: e.target.value })}
                    placeholder="alert@disaster.gov.et&#10;zone.lead@oromia.gov.et"
                    className="w-full rounded-2xl border border-gray-200 bg-white p-3 font-mono text-xs text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                    required
                  />
                </div>
              )}

              {/* Emergency Presets Selector */}
              <div className="rounded-3xl border border-gray-200 bg-gray-50/50 p-4 dark:border-gray-800 dark:bg-gray-900/40">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900 dark:text-white">
                    <Bookmark className="h-4 w-4 text-blue-600" />
                    <span>Emergency Email Presets & Templates</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowCreateTemplateModal(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    <BookmarkPlus className="h-3.5 w-3.5" />
                    + Save Current as New Template
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
                  {allTemplates.map((tmpl) => (
                    <div
                      key={tmpl.id}
                      className="group inline-flex items-center rounded-xl border border-gray-200 bg-white text-[11px] font-semibold text-gray-700 transition hover:border-blue-400 hover:bg-blue-50 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setBroadcastForm({
                            ...broadcastForm,
                            subject: tmpl.subject,
                            body: tmpl.body,
                            category: tmpl.category,
                            severity: tmpl.severity,
                          })
                        }
                        className="px-2.5 py-1 text-left"
                      >
                        {tmpl.title}
                        {tmpl.isCustom && (
                          <span className="ml-1 text-[9px] text-blue-600 font-bold">(Custom)</span>
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

              {/* Subject & Body */}
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Email Subject Line
                </label>
                <input
                  type="text"
                  value={broadcastForm.subject}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, subject: e.target.value })}
                  placeholder="e.g. URGENT FLOOD WARNING - Sector 4 Evacuation Advisory"
                  className="w-full rounded-2xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs font-bold text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Email Message Body
                </label>
                <textarea
                  rows={6}
                  value={broadcastForm.body}
                  onChange={(e) => setBroadcastForm({ ...broadcastForm, body: e.target.value })}
                  placeholder="Type the full disaster bulletin or advisory..."
                  className="w-full rounded-2xl border border-gray-200 bg-white p-3.5 text-xs leading-relaxed text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                  required
                />
              </div>

              {/* Category & Severity */}
              <div className="grid gap-3 sm:grid-cols-2">
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
                    Urgency / Severity
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
              </div>

              {/* Submit */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-800">
                <div className="text-xs text-gray-500">
                  {broadcastForm.audienceType === "subscribers" ? (
                    <span>
                      Target: <strong>{previewCount !== null ? previewCount : "..."}</strong> subscribers
                    </span>
                  ) : (
                    <span>
                      Target: <strong>{parsedEmailCount}</strong> recipient(s)
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
                    className="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700 disabled:opacity-60"
                  >
                    <Send className={`h-4 w-4 ${broadcasting ? "animate-bounce" : ""}`} />
                    {broadcasting ? "Transmitting Batch..." : "Transmit Email Broadcast"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL: COMPOSE DIRECT EMAIL
      ────────────────────────────────────────────────────────────────────────── */}
      {showComposeModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-950">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-gray-800">
              <div className="flex items-center gap-2.5">
                <Mail className="h-5 w-5 text-blue-600" />
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Compose Direct Email
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowComposeModal(false)}
                className="rounded-xl p-1.5 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleComposeSubmit} className="mt-4 space-y-3.5">
              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  To (Recipient Email)
                </label>
                <input
                  type="email"
                  value={composeForm.to}
                  onChange={(e) => setComposeForm({ ...composeForm, to: e.target.value })}
                  placeholder="recipient@domain.com"
                  className="w-full rounded-2xl border border-gray-200 bg-white px-3.5 py-2.5 text-xs text-gray-900 outline-none focus:border-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Recipient Name (Optional)
                </label>
                <input
                  type="text"
                  value={composeForm.recipientName}
                  onChange={(e) => setComposeForm({ ...composeForm, recipientName: e.target.value })}
                  placeholder="e.g. Zone Coordinator"
                  className="w-full rounded-2xl border border-gray-200 bg-white px-3.5 py-2 text-xs text-gray-900 outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Subject
                </label>
                <input
                  type="text"
                  value={composeForm.subject}
                  onChange={(e) => setComposeForm({ ...composeForm, subject: e.target.value })}
                  placeholder="Email subject..."
                  className="w-full rounded-2xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-bold text-gray-900 outline-none focus:border-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Message Body
                </label>
                <textarea
                  rows={5}
                  value={composeForm.body}
                  onChange={(e) => setComposeForm({ ...composeForm, body: e.target.value })}
                  placeholder="Write email text here..."
                  className="w-full rounded-2xl border border-gray-200 bg-white p-3 text-xs leading-relaxed text-gray-900 outline-none focus:border-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowComposeModal(false)}
                  className="rounded-2xl border border-gray-200 px-4 py-2 text-xs font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={composing}
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"
                >
                  <Send className="h-3.5 w-3.5" />
                  {composing ? "Sending..." : "Send Email"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL: EDIT & RESEND EMAIL
      ────────────────────────────────────────────────────────────────────────── */}
      {editResendLog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-950">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-gray-800">
              <div className="flex items-center gap-2.5">
                <RotateCcw className="h-5 w-5 text-blue-600" />
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Edit & Resend Email
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
                  Recipient Email
                </label>
                <input
                  type="email"
                  value={resendForm.to}
                  onChange={(e) => setResendForm({ ...resendForm, to: e.target.value })}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-3.5 py-2 font-mono text-xs text-gray-900 outline-none focus:border-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Subject Line
                </label>
                <input
                  type="text"
                  value={resendForm.subject}
                  onChange={(e) => setResendForm({ ...resendForm, subject: e.target.value })}
                  className="w-full rounded-2xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-bold text-gray-900 outline-none focus:border-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Email Message Body
                </label>
                <textarea
                  rows={5}
                  value={resendForm.body}
                  onChange={(e) => setResendForm({ ...resendForm, body: e.target.value })}
                  className="w-full rounded-2xl border border-gray-200 bg-white p-3 text-xs leading-relaxed text-gray-900 outline-none focus:border-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                  required
                />
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
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"
                >
                  <Send className="h-3.5 w-3.5" />
                  {resendingId === editResendLog._id ? "Resending..." : "Resend Email Now"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* ──────────────────────────────────────────────────────────────────────────
          MODAL: SAVE CUSTOM TEMPLATE
      ────────────────────────────────────────────────────────────────────────── */}
      {showCreateTemplateModal ? (
        <div className="fixed inset-0 z-60 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-950">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <BookmarkPlus className="h-5 w-5 text-blue-600" />
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Save Custom Email Template
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
                  placeholder="e.g. Drought Alert - Afar Region"
                  className="w-full rounded-2xl border border-gray-200 bg-white px-3.5 py-2 text-xs text-gray-900 outline-none focus:border-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Subject Line
                </label>
                <input
                  type="text"
                  value={newTemplateForm.subject}
                  onChange={(e) => setNewTemplateForm({ ...newTemplateForm, subject: e.target.value })}
                  placeholder="Email subject..."
                  className="w-full rounded-2xl border border-gray-200 bg-white px-3.5 py-2 text-xs text-gray-900 outline-none focus:border-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300">
                  Body Content
                </label>
                <textarea
                  rows={4}
                  value={newTemplateForm.body}
                  onChange={(e) => setNewTemplateForm({ ...newTemplateForm, body: e.target.value })}
                  placeholder="Type bulletin text..."
                  className="w-full rounded-2xl border border-gray-200 bg-white p-3 text-xs leading-relaxed text-gray-900 outline-none focus:border-blue-500 dark:border-gray-800 dark:bg-gray-900 dark:text-white"
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
                  className="inline-flex items-center gap-1.5 rounded-2xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"
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
          MODAL: TECHNICAL EMAIL INSPECTOR
      ────────────────────────────────────────────────────────────────────────── */}
      {inspectLog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-xl rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl dark:border-gray-800 dark:bg-gray-950">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4 dark:border-gray-800">
              <div className="flex items-center gap-2.5">
                <Info className="h-5 w-5 text-blue-600" />
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Email Log Technical Details
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
              <div className="rounded-2xl bg-gray-50 p-4 dark:bg-gray-900">
                <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                  Subject
                </div>
                <div className="mt-1 text-sm font-bold text-gray-900 dark:text-white">
                  {inspectLog.subject}
                </div>
                <div className="mt-3 flex items-center justify-between text-gray-400">
                  <span className="font-bold uppercase tracking-wider text-[11px]">Message Content</span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(inspectLog.body || "");
                      toast.success("Email body copied to clipboard");
                    }}
                    className="flex items-center gap-1 font-semibold text-blue-600 hover:underline dark:text-blue-400"
                  >
                    <Copy className="h-3 w-3" />
                    Copy
                  </button>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                  {inspectLog.body || "No preview body content available."}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-gray-100 p-3 dark:border-gray-800">
                  <div className="text-gray-400">Recipient Email:</div>
                  <div className="mt-1 font-mono font-bold text-gray-900 dark:text-white truncate">
                    {inspectLog.recipient}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 p-3 dark:border-gray-800">
                  <div className="text-gray-400">Status:</div>
                  <div className="mt-1 font-bold capitalize text-emerald-600 dark:text-emerald-400">
                    {inspectLog.status}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 p-3 dark:border-gray-800">
                  <div className="text-gray-400">SMTP Message ID:</div>
                  <div className="mt-1 font-mono text-gray-700 dark:text-gray-300 truncate">
                    {inspectLog.messageId || "N/A"}
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-100 p-3 dark:border-gray-800">
                  <div className="text-gray-400">Broadcast Batch ID:</div>
                  <div className="mt-1 font-mono text-gray-700 dark:text-gray-300 truncate">
                    {inspectLog.broadcastBatchId || "Direct Single"}
                  </div>
                </div>
              </div>

              {inspectLog.error ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                  <div className="font-bold">Error Trace:</div>
                  <div className="mt-1 font-mono text-xs">{inspectLog.error}</div>
                </div>
              ) : null}

              <div className="flex items-center justify-between text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-800">
                <span>Dispatched: {new Date(inspectLog.createdAt).toLocaleString()}</span>
                {inspectLog.retryCount ? <span>Retried: {inspectLog.retryCount} times</span> : null}
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  handleOpenEditResend(inspectLog);
                  setInspectLog(null);
                }}
                className="inline-flex items-center gap-1.5 rounded-2xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
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
