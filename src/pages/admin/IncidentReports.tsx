import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import api from "../../api/axios";
import { useBranchSubcity } from "@/context/HierarchyContext";
import {
  Archive,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Eye,
  RotateCcw,
  Trash2,
  Search,
  LayoutGrid,
  List,
  SlidersHorizontal,
  X,
  MapPin,
  Calendar,
  Clock,
  Flame,
  Check,
  CircleAlert,
  Paperclip,
  RefreshCw,
  FileWarning,
  Sparkles,
} from "lucide-react";
import { RowActionMenu } from "../../components/common/RowActionMenu";
import type { ReviewReport } from "./ReportReviewModal";
import { formatReportLocation } from "../../utils/formatReportLocation";
const ReportReviewModal = lazy(() =>
  import("./ReportReviewModal").then((m) => ({ default: m.ReportReviewModal }))
);

type IncidentReport = ReviewReport & {
  reportType?: "incident";
  category?: string;
  details?: string;
};

const STATUS_OPTIONS = [
  "all",
  "new",
  "submitted",
  "received",
  "dispatched",
  "not_solved",
  "solved",
  "closed",
  "archived",
] as const;

const ADDIS_SUBCITIES = [
  "Addis Ketema",
  "Akaky Kaliti",
  "Arada",
  "Bole",
  "Gullele",
  "Kirkos",
  "Kolfe Keranio",
  "Lideta",
  "Nifas Silk-Lafto",
  "Yeka",
  "Lemi Kura",
];

const SEVERITY_LEVELS = ["all", "critical", "high", "medium", "low"] as const;

const getStatusColor = (status: string) => {
  switch (status) {
    case "new":
      return "bg-blue-500/10 text-blue-600 border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-400";
    case "submitted":
      return "bg-slate-500/10 text-slate-600 border-slate-500/30 dark:bg-slate-500/20 dark:text-slate-300";
    case "received":
      return "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-400";
    case "dispatched":
      return "bg-orange-500/10 text-orange-600 border-orange-500/30 dark:bg-orange-500/20 dark:text-orange-400";
    case "not_solved":
      return "bg-rose-500/10 text-rose-600 border-rose-500/30 dark:bg-rose-500/20 dark:text-rose-400";
    case "solved":
      return "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-400";
    case "closed":
      return "bg-gray-500/10 text-gray-600 border-gray-500/30 dark:bg-gray-500/20 dark:text-gray-300";
    case "archived":
      return "bg-purple-500/10 text-purple-600 border-purple-500/30 dark:bg-purple-500/20 dark:text-purple-400";
    default:
      return "bg-slate-500/10 text-slate-600 border-slate-500/30 dark:bg-slate-500/20 dark:text-slate-300";
  }
};

const getSeverityBadge = (severity?: string) => {
  const s = String(severity || "").toLowerCase();
  switch (s) {
    case "critical":
      return {
        bg: "bg-red-500/10 text-red-600 border-red-500/30 dark:bg-red-500/20 dark:text-red-400",
        dot: "bg-red-500 animate-pulse",
        label: "Critical",
      };
    case "high":
      return {
        bg: "bg-orange-500/10 text-orange-600 border-orange-500/30 dark:bg-orange-500/20 dark:text-orange-400",
        dot: "bg-orange-500",
        label: "High",
      };
    case "medium":
      return {
        bg: "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-400",
        dot: "bg-amber-500",
        label: "Medium",
      };
    case "low":
      return {
        bg: "bg-blue-500/10 text-blue-600 border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-400",
        dot: "bg-blue-500",
        label: "Low",
      };
    default:
      return {
        bg: "bg-slate-500/10 text-slate-600 border-slate-500/30 dark:bg-slate-500/20 dark:text-slate-300",
        dot: "bg-slate-400",
        label: severity || "Normal",
      };
  }
};

const getAvailableStatuses = () => {
  const statuses = [
    "new",
    "submitted",
    "received",
    "dispatched",
    "not_solved",
    "solved",
    "closed",
    "archived",
  ];
  return statuses.map((status) => ({
    value: status,
    label: status.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase()),
  }));
};

const DiamondBackground = () => (
  <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
    <div className="absolute inset-0 bg-slate-50 dark:bg-[#0A0A0B]" />
    {[...Array(8)].map((_, i) => (
      <motion.div
        key={i}
        initial={{
          opacity: 0,
          rotate: 45,
          x: Math.random() * 100 + "%",
          y: Math.random() * 100 + "%",
        }}
        animate={{
          opacity: [0.12, 0.35, 0.12],
          y: ["-20%", "120%"],
          rotate: [45, 225],
        }}
        transition={{
          duration: 22 + Math.random() * 18,
          repeat: Infinity,
          ease: "linear",
          delay: i * -4,
        }}
        className="absolute h-64 w-64 rounded-[48px] border border-white/40 bg-white/10 backdrop-blur-3xl dark:border-white/10 dark:bg-white/[0.03]"
        style={{
          left: `${(i * 14) % 95}%`,
        }}
      />
    ))}
  </div>
);

export default function IncidentReports() {
  const branchSubcity = useBranchSubcity();
  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingReportId, setSavingReportId] = useState<string | null>(null);

  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [subcityFilter, setSubcityFilter] = useState<string>("all");
  const [hasMediaOnly, setHasMediaOnly] = useState<boolean>(false);
  const [dateFilter, setDateFilter] = useState<string>("all"); // 'all' | 'today' | 'week' | 'month'

  // View state & UI
  const [viewMode, setViewMode] = useState<"grid" | "table">("table");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedReport, setSelectedReport] = useState<IncidentReport | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(12);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const response = await api.get("/incident-reports", {
        params: { reportType: "incident" },
      });
      setReports(response.data || []);
    } catch (error) {
      console.error("Failed to fetch incident reports", error);
    } finally {
      setLoading(false);
    }
  };

  // Extract unique categories from dataset
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    reports.forEach((r) => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set).sort();
  }, [reports]);

  // Comprehensive Search & Filter Engine
  const filteredReports = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const now = new Date();

    return reports.filter((report) => {
      // 1. Status Filter
      if (statusFilter === "all") {
        if (report.status === "archived") return false;
      } else if (report.status !== statusFilter) {
        return false;
      }

      // 2. Severity Filter
      if (severityFilter !== "all") {
        if (String(report.severity).toLowerCase() !== severityFilter.toLowerCase()) {
          return false;
        }
      }

      // 3. Category Filter
      if (categoryFilter !== "all") {
        if (report.category !== categoryFilter) {
          return false;
        }
      }

      // 4. Subcity Filter
      if (subcityFilter !== "all") {
        const sub = (report.location?.subCity || "").toLowerCase();
        if (!sub.includes(subcityFilter.toLowerCase())) {
          return false;
        }
      }

      // 5. Has Media Only
      if (hasMediaOnly) {
        if (!report.attachments || report.attachments.length === 0) {
          return false;
        }
      }

      // 6. Date Filter
      if (dateFilter !== "all" && report.createdAt) {
        const reportDate = new Date(report.createdAt);
        const diffMs = now.getTime() - reportDate.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        if (dateFilter === "today" && diffDays > 1) return false;
        if (dateFilter === "week" && diffDays > 7) return false;
        if (dateFilter === "month" && diffDays > 30) return false;
      }

      // 7. Multi-field Full-Text Search
      if (term) {
        const haystack = [
          report.reportCode,
          report.category,
          report.severity,
          report.details,
          report.status,
          report.contact?.phone,
          report.contact?.email,
          report.location?.subCity,
          report.location?.woreda,
          report.location?.placeName,
          report.location?.addressLine,
          report.location?.city,
          report.location?.region,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(term)) return false;
      }

      return true;
    });
  }, [
    reports,
    searchTerm,
    statusFilter,
    severityFilter,
    categoryFilter,
    subcityFilter,
    hasMediaOnly,
    dateFilter,
  ]);

  // Reset page on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [
    searchTerm,
    statusFilter,
    severityFilter,
    categoryFilter,
    subcityFilter,
    hasMediaOnly,
    dateFilter,
    itemsPerPage,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredReports.length / itemsPerPage));
  const paginatedReports = useMemo(() => {
    return filteredReports.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  }, [filteredReports, currentPage, itemsPerPage]);

  // Stats calculation
  const activeReports = useMemo(() => reports.filter((r) => r.status !== "archived"), [reports]);
  const stats = useMemo(() => {
    const total = activeReports.length;
    const open = activeReports.filter((r) => !["solved", "closed"].includes(r.status)).length;
    const critical = activeReports.filter((r) =>
      ["critical", "high"].includes(String(r.severity).toLowerCase())
    ).length;
    const resolved = activeReports.filter((r) => ["solved", "closed"].includes(r.status)).length;
    const notSolved = activeReports.filter((r) => r.status === "not_solved").length;
    return { total, open, critical, resolved, notSolved };
  }, [activeReports]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (severityFilter !== "all") count++;
    if (categoryFilter !== "all") count++;
    if (subcityFilter !== "all") count++;
    if (hasMediaOnly) count++;
    if (dateFilter !== "all") count++;
    return count;
  }, [severityFilter, categoryFilter, subcityFilter, hasMediaOnly, dateFilter]);

  const resetAllFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setSeverityFilter("all");
    setCategoryFilter("all");
    setSubcityFilter("all");
    setHasMediaOnly(false);
    setDateFilter("all");
  };

  const handleStatusChange = async (id: string, status: IncidentReport["status"]) => {
    try {
      await api.put(`/incident-reports/${id}`, { status, reportType: "incident" });
      setReports((prev) => prev.map((item) => (item._id === id ? { ...item, status } : item)));
      setSelectedReport((prev) => (prev?._id === id ? { ...prev, status } : prev));
    } catch (error) {
      console.error("Failed to update report status", error);
      const message = axios.isAxiosError(error) ? error.response?.data?.message : undefined;
      alert(message || "Failed to update report status");
    }
  };

  const handleDeleteReport = async (id: string) => {
    if (
      !window.confirm(
        "Are you sure you want to permanently delete this incident report? This action cannot be undone."
      )
    ) {
      return;
    }
    try {
      await api.delete(`/incident-reports/${id}`);
      setReports((prev) => prev.filter((item) => item._id !== id));
      if (selectedReport?._id === id) {
        setSelectedReport(null);
      }
    } catch (error) {
      console.error("Failed to delete incident report", error);
      alert("Failed to delete incident report");
    }
  };

  const handleSaveReport = async (id: string, updates: Partial<ReviewReport>) => {
    setSavingReportId(id);
    try {
      const response = await api.put(`/incident-reports/${id}`, {
        ...updates,
        reportType: "incident",
      });
      const updated = response.data as IncidentReport;
      setReports((prev) => prev.map((item) => (item._id === id ? updated : item)));
      setSelectedReport((prev) => (prev?._id === id ? updated : prev));
    } catch (error) {
      console.error("Failed to save report details", error);
      alert("Failed to save report details");
    } finally {
      setSavingReportId(null);
    }
  };

  return (
    <>
      <PageMeta
        title="Incident Reports | IDRMIS"
        description="Public disaster and community incident reports dispatch center"
      />
      <PageBreadcrumb pageTitle="Incident Reports" />

      <div className="relative space-y-8 pb-10">
        <DiamondBackground />

        {/* Branch Scope Banner */}
        {branchSubcity && (
          <div className="flex items-center justify-between rounded-2xl border border-blue-200 bg-blue-50/80 px-4 py-3 text-sm text-blue-900 shadow-sm backdrop-blur-xl dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200">
            <div className="flex items-center gap-2.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-600 animate-pulse" />
              <span>
                <strong>Branch Jurisdiction:</strong> Showing incidents scoped to{" "}
                <strong>{branchSubcity} Branch</strong>.
              </span>
            </div>
            <span className="rounded-lg bg-blue-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
              {branchSubcity} Branch
            </span>
          </div>
        )}

        {/* 5-Card Stats Overview (Users.tsx style) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            {
              title: "Total Incidents",
              value: stats.total,
              icon: <FileWarning size={22} />,
              color: "from-blue-600 to-indigo-600 shadow-blue-500/20",
              description: "Active records",
              action: () => setStatusFilter("all"),
            },
            {
              title: "Open Cases",
              value: stats.open,
              icon: <Clock size={22} />,
              color: "from-amber-500 to-orange-500 shadow-amber-500/20",
              description: "Needs follow-up",
              action: () => setStatusFilter("new"),
            },
            {
              title: "Critical / High",
              value: stats.critical,
              icon: <Flame size={22} />,
              color: "from-rose-500 to-red-600 shadow-rose-500/20",
              description: "Urgent hazards",
              action: () => {
                setSeverityFilter("critical");
                setShowAdvancedFilters(true);
              },
            },
            {
              title: "Solved / Closed",
              value: stats.resolved,
              icon: <CheckCircle2 size={22} />,
              color: "from-emerald-500 to-teal-600 shadow-emerald-500/20",
              description: "Resolved cases",
              action: () => setStatusFilter("solved"),
            },
            {
              title: "Not Solved",
              value: stats.notSolved,
              icon: <CircleAlert size={22} />,
              color: "from-purple-500 to-pink-600 shadow-purple-500/20",
              description: "Pending resolution",
              action: () => setStatusFilter("not_solved"),
            },
          ].map((card, i) => (
            <motion.div
              key={i}
              whileHover={{ scale: 1.02, y: -2 }}
              onClick={card.action}
              className="group relative cursor-pointer overflow-hidden rounded-3xl border border-white/40 bg-white/40 p-5 shadow-xl backdrop-blur-3xl transition-all dark:border-white/10 dark:bg-white/5"
            >
              <div className="flex items-center gap-3.5">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${card.color} text-white shadow-lg transition-transform group-hover:scale-105`}
                >
                  {card.icon}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-white/50">
                    {card.title}
                  </p>
                  <div className="flex items-baseline gap-2">
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                      {card.value}
                    </h3>
                    <span className="text-[10px] text-slate-500 dark:text-white/40">
                      {card.description}
                    </span>
                  </div>
                </div>
              </div>
              {/* Subtle animated light bar */}
              <div className="mt-3.5 h-[2px] w-full overflow-hidden bg-slate-100 dark:bg-white/5">
                <motion.div
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: "linear", delay: i * 0.4 }}
                  className="h-full w-1/3 bg-gradient-to-r from-transparent via-primary/30 to-transparent"
                />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Main Glassmorphic Container */}
        <div className="rounded-3xl border border-white/40 bg-white/40 p-6 shadow-2xl backdrop-blur-3xl dark:border-white/10 dark:bg-white/5">
          {/* Header Row */}
          <div className="mb-6 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                  Incident Reports Directory
                </h3>
                <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                  Live Dispatch
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-white/50">
                Community incident reporting, hazard classification, triage, and verification
              </p>
            </div>

            {/* Top Toolbar Actions */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Search Bar */}
              <div className="relative min-w-[260px] sm:min-w-[320px]">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30"
                />
                <input
                  type="text"
                  placeholder="Search by ID, category, location, details..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-11 w-full rounded-2xl border border-white/30 bg-white/60 pl-11 pr-10 text-sm text-slate-900 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Advanced Filter Toggle */}
              <button
                type="button"
                onClick={() => setShowAdvancedFilters((prev) => !prev)}
                className={`flex h-11 items-center gap-2 rounded-2xl border px-4 text-xs font-bold transition-all ${showAdvancedFilters || activeFilterCount > 0
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-slate-200 bg-white/50 text-slate-700 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
                  }`}
              >
                <SlidersHorizontal size={15} />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* View Mode Switcher (Grid / Table) */}
              <div className="flex items-center rounded-2xl border border-slate-200 bg-white/50 p-1 shadow-inner backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  title="Table View"
                  className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${viewMode === "table"
                      ? "bg-slate-900 text-white shadow-lg dark:bg-primary"
                      : "text-slate-500 hover:text-slate-900 dark:text-white/40 dark:hover:text-white"
                    }`}
                >
                  <List size={18} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  title="Grid View"
                  className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${viewMode === "grid"
                      ? "bg-slate-900 text-white shadow-lg dark:bg-primary"
                      : "text-slate-500 hover:text-slate-900 dark:text-white/40 dark:hover:text-white"
                    }`}
                >
                  <LayoutGrid size={18} />
                </button>
              </div>

              {/* Refresh Button */}
              <button
                type="button"
                onClick={fetchReports}
                disabled={loading}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white/50 text-slate-700 transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
                title="Refresh reports"
              >
                <RefreshCw size={17} className={loading ? "animate-spin text-primary" : ""} />
              </button>
            </div>
          </div>

          {/* Quick Status Pill Bar */}
          <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200/60 pb-5 dark:border-white/5">
            {STATUS_OPTIONS.map((status) => {
              const count =
                status === "all"
                  ? reports.filter((r) => r.status !== "archived").length
                  : reports.filter((r) => r.status === status).length;
              const isActive = statusFilter === status;

              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition-all ${isActive
                      ? "border-primary bg-primary text-white shadow-md shadow-primary/20 scale-105"
                      : "border-slate-200/80 bg-white/40 text-slate-600 hover:border-slate-300 hover:bg-white/70 dark:border-white/10 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/10"
                    }`}
                >
                  <span>
                    {status === "all"
                      ? "All Active"
                      : status.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                  </span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${isActive ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-white/70"
                      }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Collapsible Advanced Filter Drawer */}
          <AnimatePresence>
            {showAdvancedFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-6"
              >
                <div className="rounded-2xl border border-slate-200/80 bg-white/60 p-5 shadow-sm dark:border-white/10 dark:bg-white/5">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-white/80">
                      <Sparkles size={14} className="text-primary" /> Advanced Search Filters
                    </span>
                    {activeFilterCount > 0 && (
                      <button
                        onClick={resetAllFilters}
                        className="text-xs font-semibold text-rose-600 hover:underline dark:text-rose-400"
                      >
                        Reset All Filters
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
                    {/* Severity Filter */}
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/50">
                        Severity Level
                      </label>
                      <select
                        value={severityFilter}
                        onChange={(e) => setSeverityFilter(e.target.value)}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-primary dark:border-white/10 dark:bg-gray-900 dark:text-white"
                      >
                        <option value="all">All Severities</option>
                        {SEVERITY_LEVELS.filter((s) => s !== "all").map((s) => (
                          <option key={s} value={s}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Category Filter */}
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/50">
                        Hazard Category
                      </label>
                      <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-primary dark:border-white/10 dark:bg-gray-900 dark:text-white"
                      >
                        <option value="all">All Categories</option>
                        {uniqueCategories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Subcity Filter */}
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/50">
                        Subcity Jurisdiction
                      </label>
                      <select
                        value={subcityFilter}
                        onChange={(e) => setSubcityFilter(e.target.value)}
                        disabled={Boolean(branchSubcity)}
                        className={`h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-primary dark:border-white/10 dark:bg-gray-900 dark:text-white ${branchSubcity ? "cursor-not-allowed opacity-60" : ""
                          }`}
                      >
                        <option value="all">All Subcities</option>
                        {ADDIS_SUBCITIES.map((sub) => (
                          <option key={sub} value={sub}>
                            {sub}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Date Timeframe */}
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/50">
                        Date Range
                      </label>
                      <select
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-primary dark:border-white/10 dark:bg-gray-900 dark:text-white"
                      >
                        <option value="all">All Time</option>
                        <option value="today">Past 24 Hours</option>
                        <option value="week">Past 7 Days</option>
                        <option value="month">Past 30 Days</option>
                      </select>
                    </div>

                    {/* Media Attachments Toggle */}
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/50">
                        Media & Evidence
                      </label>
                      <button
                        type="button"
                        onClick={() => setHasMediaOnly((prev) => !prev)}
                        className={`flex h-10 w-full items-center justify-between rounded-xl border px-3 text-xs font-medium transition ${hasMediaOnly
                            ? "border-primary bg-primary/10 text-primary font-bold"
                            : "border-slate-200 bg-white text-slate-700 dark:border-white/10 dark:bg-gray-900 dark:text-white"
                          }`}
                      >
                        <span className="flex items-center gap-2">
                          <Paperclip size={14} /> Has Attachments
                        </span>
                        {hasMediaOnly && <Check size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Result Count and Active Filters Chips */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs font-medium text-slate-500 dark:text-white/40">
            <div className="flex items-center gap-2">
              <span>
                Showing <strong>{filteredReports.length}</strong> of {reports.length} reports
              </span>
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} applied
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => setItemsPerPage(Number(e.target.value))}
                className="rounded-lg border border-slate-200 bg-transparent px-2 py-1 text-xs outline-none dark:border-white/10"
              >
                <option value={9}>9</option>
                <option value={12}>12</option>
                <option value={24}>24</option>
                <option value={48}>48</option>
              </select>
            </div>
          </div>

          {/* Main Content: Table or Grid */}
          {loading ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-xs font-semibold text-slate-500">Loading incident reports...</p>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300/80 bg-white/20 p-8 text-center backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-400 dark:bg-white/10 dark:text-white/40">
                <FileWarning size={32} />
              </div>
              <h4 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
                No matching incident reports
              </h4>
              <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-white/50">
                We couldn't find any incident reports matching your active filters or search term.
              </p>
              <button
                onClick={resetAllFilters}
                className="mt-5 rounded-2xl bg-brand-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700"
              >
                Clear All Filters
              </button>
            </div>
          ) : viewMode === "grid" ? (
            /* Grid View */
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {paginatedReports.map((report) => {
                const sev = getSeverityBadge(report.severity);

                return (
                  <motion.div
                    key={report._id}
                    whileHover={{ y: -4 }}
                    className="flex flex-col justify-between rounded-3xl border border-white/50 bg-white/70 p-5 shadow-lg backdrop-blur-2xl transition-all hover:shadow-2xl dark:border-white/10 dark:bg-white/5"
                  >
                    <div>
                      {/* Card Header: Code & Status */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-black uppercase tracking-wider text-slate-500 dark:text-white/50">
                          {report.reportCode || "REPORT"}
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${sev.bg}`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
                            {sev.label}
                          </span>
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${getStatusColor(
                              report.status
                            )}`}
                          >
                            {report.status.replace("_", " ")}
                          </span>
                        </div>
                      </div>

                      {/* Category Title */}
                      <div className="mt-3">
                        <h4 className="text-base font-black text-slate-900 line-clamp-1 dark:text-white">
                          {report.category || "General Incident"}
                        </h4>
                        <p className="mt-1 text-xs text-slate-600 line-clamp-2 dark:text-white/70">
                          {report.details || "No additional incident description provided."}
                        </p>
                      </div>

                      {/* Location Badge */}
                      <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50/80 px-3 py-2 text-xs font-medium text-slate-700 dark:bg-white/5 dark:text-white/80">
                        <MapPin size={14} className="flex-shrink-0 text-primary" />
                        <span className="line-clamp-1">{formatReportLocation(report.location)}</span>
                      </div>

                      {/* Meta stats */}
                      <div className="mt-3 flex flex-wrap items-center justify-between text-[11px] text-slate-500 dark:text-white/40">
                        <span className="flex items-center gap-1">
                          <Calendar size={13} />
                          {report.createdAt
                            ? new Date(report.createdAt).toLocaleDateString()
                            : "Recent"}
                        </span>
                        {(report.attachments?.length || 0) > 0 ? (
                          <span className="flex items-center gap-1 font-semibold text-primary">
                            <Paperclip size={13} />
                            {report.attachments?.length} attachment{report.attachments!.length > 1 ? "s" : ""}
                          </span>
                        ) : (
                          <span>No attachments</span>
                        )}
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-white/5">
                      <select
                        className={`rounded-xl border px-2.5 py-1 text-xs font-semibold outline-none transition ${getStatusColor(
                          report.status
                        )}`}
                        value={report.status}
                        onChange={(e) =>
                          handleStatusChange(report._id, e.target.value as IncidentReport["status"])
                        }
                      >
                        {getAvailableStatuses().map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedReport(report)}
                          className="flex h-8 items-center gap-1.5 rounded-xl bg-brand-600 px-3 text-xs font-bold text-white shadow-sm hover:bg-brand-700"
                        >
                          <Eye size={13} /> Review
                        </button>

                        <RowActionMenu
                          actions={[
                            {
                              label: "Edit details",
                              icon: <Edit3 size={15} />,
                              onClick: () => setSelectedReport(report),
                            },
                            {
                              label: "Mark as solved",
                              icon: <CheckCircle2 size={15} />,
                              onClick: () => handleStatusChange(report._id, "solved"),
                              hidden: ["solved", "closed", "archived"].includes(report.status),
                            },
                            {
                              label: "Archive report",
                              icon: <Archive size={15} />,
                              onClick: () => handleStatusChange(report._id, "archived"),
                              hidden: report.status === "archived",
                            },
                            {
                              label: "Restore / Unarchive",
                              icon: <RotateCcw size={15} />,
                              onClick: () => handleStatusChange(report._id, "new"),
                              hidden: report.status !== "archived",
                            },
                            {
                              label: "Delete permanently",
                              icon: <Trash2 size={15} className="text-red-500" />,
                              onClick: () => handleDeleteReport(report._id),
                            },
                          ]}
                        />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            /* Table View */
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/60 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
              <div className="max-w-full overflow-x-auto">
                <table className="w-full table-auto">
                  <thead className="border-b border-slate-200/60 bg-slate-50/50 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:border-white/5 dark:bg-white/5 dark:text-white/40">
                    <tr>
                      <th className="px-5 py-3.5 text-left">Report ID</th>
                      <th className="px-4 py-3.5 text-left">Category</th>
                      <th className="px-4 py-3.5 text-left">Severity</th>
                      <th className="px-4 py-3.5 text-left">Location</th>
                      <th className="px-4 py-3.5 text-left">Status</th>
                      <th className="px-4 py-3.5 text-left">Media</th>
                      <th className="px-4 py-3.5 text-right">Updated</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm dark:divide-white/5">
                    {paginatedReports.map((report) => {
                      const sev = getSeverityBadge(report.severity);

                      return (
                        <tr
                          key={report._id}
                          className="transition-colors hover:bg-slate-50/80 dark:hover:bg-white/[0.03]"
                        >
                          <td className="px-5 py-4 font-mono text-xs font-bold text-slate-900 dark:text-white">
                            {report.reportCode || "—"}
                          </td>
                          <td className="px-4 py-4">
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {report.category || "—"}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${sev.bg}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${sev.dot}`} />
                              {sev.label}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-xs text-slate-600 dark:text-white/70">
                            <div className="flex items-center gap-1.5 max-w-xs">
                              <MapPin size={13} className="flex-shrink-0 text-primary" />
                              <span className="truncate">{formatReportLocation(report.location)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <select
                              className={`rounded-xl border px-2.5 py-1 text-xs font-semibold outline-none transition ${getStatusColor(
                                report.status
                              )}`}
                              value={report.status}
                              onChange={(e) =>
                                handleStatusChange(
                                  report._id,
                                  e.target.value as IncidentReport["status"]
                                )
                              }
                            >
                              {getAvailableStatuses().map((s) => (
                                <option key={s.value} value={s.value}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-4 py-4 text-xs text-slate-600 dark:text-white/70">
                            {(report.attachments?.length || 0) > 0 ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-primary">
                                <Paperclip size={13} /> {report.attachments?.length}
                              </span>
                            ) : (
                              <span className="text-slate-400">None</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-right text-xs text-slate-500 dark:text-white/40">
                            {report.updatedAt
                              ? new Date(report.updatedAt).toLocaleDateString()
                              : "—"}
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="inline-flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedReport(report)}
                                title="Review incident details"
                                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 shadow-sm transition hover:border-primary hover:text-primary dark:border-white/10 dark:bg-white/5 dark:text-white"
                              >
                                <Eye size={13} /> Review
                              </button>
                              <RowActionMenu
                                actions={[
                                  {
                                    label: "Edit details",
                                    icon: <Edit3 size={15} />,
                                    onClick: () => setSelectedReport(report),
                                  },
                                  {
                                    label: "Mark as solved",
                                    icon: <CheckCircle2 size={15} />,
                                    onClick: () => handleStatusChange(report._id, "solved"),
                                    hidden: ["solved", "closed", "archived"].includes(report.status),
                                  },
                                  {
                                    label: "Archive report",
                                    icon: <Archive size={15} />,
                                    onClick: () => handleStatusChange(report._id, "archived"),
                                    hidden: report.status === "archived",
                                  },
                                  {
                                    label: "Restore / Unarchive",
                                    icon: <RotateCcw size={15} />,
                                    onClick: () => handleStatusChange(report._id, "new"),
                                    hidden: report.status !== "archived",
                                  },
                                  {
                                    label: "Delete permanently",
                                    icon: <Trash2 size={15} className="text-red-500" />,
                                    onClick: () => handleDeleteReport(report._id),
                                  },
                                ]}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination Footer */}
          {totalPages > 1 && (
            <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-slate-100 pt-5 sm:flex-row dark:border-white/5">
              <span className="text-xs font-medium text-slate-500 dark:text-white/40">
                Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-white"
                >
                  <ChevronLeft size={16} />
                </button>

                {Array.from({ length: Math.min(5, totalPages) }, (_, idx) => {
                  let pageNum = idx + 1;
                  if (totalPages > 5 && currentPage > 3) {
                    pageNum = currentPage - 2 + idx;
                    if (pageNum > totalPages) pageNum = totalPages - 4 + idx;
                  }
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => setCurrentPage(pageNum)}
                      className={`h-9 w-9 rounded-xl text-xs font-bold transition ${currentPage === pageNum
                          ? "bg-slate-900 text-white shadow-md dark:bg-primary"
                          : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-white"
                        }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-white"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <Suspense fallback={null}>
        <ReportReviewModal
          open={!!selectedReport}
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onSave={handleSaveReport}
          saving={savingReportId === selectedReport?._id}
        />
      </Suspense>
    </>
  );
}
