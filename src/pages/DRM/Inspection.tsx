import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays,
  FileSearch,
  ShieldCheck,
  Search,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Columns,
  X,
  RefreshCw,
  MapPin,
  Calendar,
  Clock,
  User,
  CheckCircle2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { toast } from "react-toastify";

import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { useBranchSubcity } from "@/context/HierarchyContext";
import {
  inspectionRequestService,
  type InspectionRequest,
  type InspectionStatus,
} from "@/api/inspectionRequestService";

const STATUS_OPTIONS: InspectionStatus[] = [
  "Submitted",
  "Under Review",
  "Assigned",
  "Scheduled",
  "Completed",
  "Rejected",
];

const INSPECTION_TYPES = [
  { value: "all", label: "All Types" },
  { value: "building_safety", label: "Building Safety" },
  { value: "fire_safety", label: "Fire Safety" },
  { value: "electrical", label: "Electrical" },
  { value: "sanitation", label: "Sanitation" },
  { value: "structural", label: "Structural" },
  { value: "occupancy", label: "Occupancy" },
  { value: "other", label: "Other" },
];

const getStatusBadgeStyle = (status: InspectionStatus) => {
  switch (status) {
    case "Submitted":
      return "bg-blue-500/10 text-blue-600 border-blue-500/30 dark:bg-blue-500/20 dark:text-blue-400";
    case "Under Review":
      return "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:bg-amber-500/20 dark:text-amber-400";
    case "Assigned":
      return "bg-purple-500/10 text-purple-600 border-purple-500/30 dark:bg-purple-500/20 dark:text-purple-400";
    case "Scheduled":
      return "bg-indigo-500/10 text-indigo-600 border-indigo-500/30 dark:bg-indigo-500/20 dark:text-indigo-400";
    case "Completed":
      return "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-400";
    case "Rejected":
      return "bg-rose-500/10 text-rose-600 border-rose-500/30 dark:bg-rose-500/20 dark:text-rose-400";
    default:
      return "bg-slate-500/10 text-slate-600 border-slate-500/30 dark:bg-slate-500/20 dark:text-slate-300";
  }
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

const Inspection = () => {
  const branchSubcity = useBranchSubcity();
  const [requests, setRequests] = useState<InspectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [certificateFilter, setCertificateFilter] = useState<string>("all"); // 'all' | 'certified' | 'pending'
  const [inspectorFilter, setInspectorFilter] = useState<string>("all"); // 'all' | 'assigned' | 'unassigned'
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // View Mode: 'split' (Workspace) | 'table' | 'grid'
  const [viewMode, setViewMode] = useState<"split" | "table" | "grid">("split");
  const [selected, setSelected] = useState<InspectionRequest | null>(null);

  // Pagination for table/grid
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const loadRequests = async () => {
    try {
      setLoading(true);
      const data = await inspectionRequestService.list();
      setRequests(data);
      if (selected) {
        const refreshed = data.find((item) => item._id === selected._id) || null;
        setSelected(refreshed);
      } else if (data.length > 0 && !selected) {
        setSelected(data[0]);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to load inspection requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  // Multi-facet Search & Filter Engine
  const filteredRequests = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return requests.filter((req) => {
      // 1. Status Filter
      if (statusFilter !== "all" && req.status !== statusFilter) {
        return false;
      }

      // 2. Inspection Type Filter
      if (typeFilter !== "all" && req.inspectionType !== typeFilter) {
        return false;
      }

      // 3. Certificate Filter
      if (certificateFilter === "certified" && !req.certificateUrl) {
        return false;
      }
      if (certificateFilter === "pending" && req.certificateUrl) {
        return false;
      }

      // 4. Inspector Filter
      if (inspectorFilter === "assigned" && !req.assignedInspector) {
        return false;
      }
      if (inspectorFilter === "unassigned" && req.assignedInspector) {
        return false;
      }

      // 5. Full-text search
      if (term) {
        const haystack = [
          req.trackingNumber,
          req.propertyAddress,
          req.inspectionTypeLabel,
          req.inspectionType,
          req.requesterName,
          req.requesterPhone,
          req.requesterEmail,
          req.assignedInspector,
          req.assignedInspectorContact,
          req.adminNotes,
          req.additionalNotes,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(term)) return false;
      }

      return true;
    });
  }, [requests, searchTerm, statusFilter, typeFilter, certificateFilter, inspectorFilter]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, typeFilter, certificateFilter, inspectorFilter, itemsPerPage]);

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / itemsPerPage));
  const paginatedRequests = useMemo(() => {
    return filteredRequests.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );
  }, [filteredRequests, currentPage, itemsPerPage]);

  // Stats calculation
  const stats = useMemo(() => {
    const total = requests.length;
    const open = requests.filter((r) =>
      ["Submitted", "Under Review"].includes(r.status)
    ).length;
    const scheduled = requests.filter((r) =>
      ["Assigned", "Scheduled"].includes(r.status)
    ).length;
    const completed = requests.filter((r) => r.status === "Completed").length;
    return { total, open, scheduled, completed };
  }, [requests]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (typeFilter !== "all") count++;
    if (certificateFilter !== "all") count++;
    if (inspectorFilter !== "all") count++;
    return count;
  }, [typeFilter, certificateFilter, inspectorFilter]);

  const resetAllFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setTypeFilter("all");
    setCertificateFilter("all");
    setInspectorFilter("all");
  };

  const handleSave = async () => {
    if (!selected) return;
    try {
      setSaving(true);
      const updated = await inspectionRequestService.update(selected._id, {
        status: selected.status,
        assignedInspector: selected.assignedInspector || "",
        assignedInspectorContact: selected.assignedInspectorContact || "",
        certificateUrl: selected.certificateUrl || "",
        adminNotes: selected.adminNotes || "",
      });
      setSelected(updated);
      setRequests((current) =>
        current.map((item) => (item._id === updated._id ? updated : item))
      );
      toast.success("Inspection request updated successfully");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update inspection request");
    } finally {
      setSaving(false);
    }
  };

  const handleCertificateUpload = async (file: File) => {
    if (!selected) return;
    try {
      setSaving(true);
      const url = await inspectionRequestService.uploadCertificate(file);
      setSelected((current) => (current ? { ...current, certificateUrl: url } : current));
      toast.success("Certificate uploaded successfully");
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to upload certificate");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageMeta
        title="Inspection Management | IDRMIS"
        description="Public disaster safety inspection requests and certification dispatcher"
      />
      <PageBreadcrumb pageTitle="Inspection Management" />

      <div className="relative space-y-8 pb-10">
        <DiamondBackground />

        {/* Branch Scope Banner */}
        {branchSubcity && (
          <div className="flex items-center justify-between rounded-2xl border border-blue-200 bg-blue-50/80 px-4 py-3 text-sm text-blue-900 shadow-sm backdrop-blur-xl dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-200">
            <div className="flex items-center gap-2.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-600 animate-pulse" />
              <span>
                <strong>Branch Jurisdiction:</strong> Showing inspection requests for{" "}
                <strong>{branchSubcity} Branch</strong>.
              </span>
            </div>
            <span className="rounded-lg bg-blue-100 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-blue-800 dark:bg-blue-900/60 dark:text-blue-300">
              {branchSubcity} Branch
            </span>
          </div>
        )}

        {/* 4 Stats Metric Cards (Users.tsx style) */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: "Total Requests",
              value: stats.total,
              icon: <FileSearch size={22} />,
              color: "from-blue-600 to-indigo-600 shadow-blue-500/20",
              description: "All submitted cases",
              action: () => setStatusFilter("all"),
            },
            {
              title: "Open / In Review",
              value: stats.open,
              icon: <Clock size={22} />,
              color: "from-amber-500 to-orange-500 shadow-amber-500/20",
              description: "Awaiting inspection",
              action: () => setStatusFilter("Submitted"),
            },
            {
              title: "Scheduled",
              value: stats.scheduled,
              icon: <CalendarDays size={22} />,
              color: "from-purple-500 to-indigo-600 shadow-purple-500/20",
              description: "Inspector assigned",
              action: () => setStatusFilter("Scheduled"),
            },
            {
              title: "Completed",
              value: stats.completed,
              icon: <ShieldCheck size={22} />,
              color: "from-emerald-500 to-teal-600 shadow-emerald-500/20",
              description: "Certified & closed",
              action: () => setStatusFilter("Completed"),
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

        {/* Main Glassmorphic Panel */}
        <div className="rounded-3xl border border-white/40 bg-white/40 p-6 shadow-2xl backdrop-blur-3xl dark:border-white/10 dark:bg-white/5">
          {/* Header Row */}
          <div className="mb-6 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                  Safety Inspection Operations
                </h3>
                <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                  Verification Center
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-white/50">
                Process citizen inspection requests, schedule inspectors, and dispatch certificates
              </p>
            </div>

            {/* Toolbar Actions */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative min-w-[260px] sm:min-w-[320px]">
                <Search
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30"
                />
                <input
                  type="text"
                  placeholder="Search tracking #, address, requester, inspector..."
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
                className={`flex h-11 items-center gap-2 rounded-2xl border px-4 text-xs font-bold transition-all ${
                  showAdvancedFilters || activeFilterCount > 0
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

              {/* View Switcher: Split / Table / Grid */}
              <div className="flex items-center rounded-2xl border border-slate-200 bg-white/50 p-1 shadow-inner backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <button
                  type="button"
                  onClick={() => setViewMode("split")}
                  title="Workspace View"
                  className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                    viewMode === "split"
                      ? "bg-slate-900 text-white shadow-lg dark:bg-primary"
                      : "text-slate-500 hover:text-slate-900 dark:text-white/40 dark:hover:text-white"
                  }`}
                >
                  <Columns size={17} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  title="Table View"
                  className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                    viewMode === "table"
                      ? "bg-slate-900 text-white shadow-lg dark:bg-primary"
                      : "text-slate-500 hover:text-slate-900 dark:text-white/40 dark:hover:text-white"
                  }`}
                >
                  <List size={17} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  title="Grid View"
                  className={`flex h-9 w-9 items-center justify-center rounded-xl transition-all ${
                    viewMode === "grid"
                      ? "bg-slate-900 text-white shadow-lg dark:bg-primary"
                      : "text-slate-500 hover:text-slate-900 dark:text-white/40 dark:hover:text-white"
                  }`}
                >
                  <LayoutGrid size={17} />
                </button>
              </div>

              {/* Refresh Button */}
              <button
                type="button"
                onClick={loadRequests}
                disabled={loading}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white/50 text-slate-700 transition hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
                title="Refresh inspection requests"
              >
                <RefreshCw size={17} className={loading ? "animate-spin text-primary" : ""} />
              </button>
            </div>
          </div>

          {/* Status Quick Pill Bar */}
          <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200/60 pb-5 dark:border-white/5">
            {["all", ...STATUS_OPTIONS].map((status) => {
              const count =
                status === "all"
                  ? requests.length
                  : requests.filter((r) => r.status === status).length;
              const isActive = statusFilter === status;

              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    isActive
                      ? "border-primary bg-primary text-white shadow-md shadow-primary/20 scale-105"
                      : "border-slate-200/80 bg-white/40 text-slate-600 hover:border-slate-300 hover:bg-white/70 dark:border-white/10 dark:bg-white/5 dark:text-white/60 dark:hover:bg-white/10"
                  }`}
                >
                  <span>{status === "all" ? "All Requests" : status}</span>
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                      isActive ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-white/70"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Collapsible Advanced Filters */}
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
                      <Sparkles size={14} className="text-primary" /> Advanced Inspection Filters
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

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {/* Inspection Type */}
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/50">
                        Inspection Type
                      </label>
                      <select
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-primary dark:border-white/10 dark:bg-gray-900 dark:text-white"
                      >
                        {INSPECTION_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Certificate Status */}
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/50">
                        Certificate Document
                      </label>
                      <select
                        value={certificateFilter}
                        onChange={(e) => setCertificateFilter(e.target.value)}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-primary dark:border-white/10 dark:bg-gray-900 dark:text-white"
                      >
                        <option value="all">All Records</option>
                        <option value="certified">Certificate Uploaded</option>
                        <option value="pending">Pending Certificate</option>
                      </select>
                    </div>

                    {/* Inspector Assignment */}
                    <div>
                      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/50">
                        Inspector Assignment
                      </label>
                      <select
                        value={inspectorFilter}
                        onChange={(e) => setInspectorFilter(e.target.value)}
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 outline-none focus:border-primary dark:border-white/10 dark:bg-gray-900 dark:text-white"
                      >
                        <option value="all">All Assignments</option>
                        <option value="assigned">Inspector Assigned</option>
                        <option value="unassigned">Unassigned</option>
                      </select>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results Summary */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs font-medium text-slate-500 dark:text-white/40">
            <div className="flex items-center gap-2">
              <span>
                Showing <strong>{filteredRequests.length}</strong> of {requests.length} inspection
                requests
              </span>
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} applied
                </span>
              )}
            </div>

            {viewMode !== "split" && (
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <select
                  value={itemsPerPage}
                  onChange={(e) => setItemsPerPage(Number(e.target.value))}
                  className="rounded-lg border border-slate-200 bg-transparent px-2 py-1 text-xs outline-none dark:border-white/10"
                >
                  <option value={6}>6</option>
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
            )}
          </div>

          {/* Views */}
          {loading ? (
            <div className="flex h-64 flex-col items-center justify-center gap-3">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-xs font-semibold text-slate-500">Loading inspection requests...</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300/80 bg-white/20 p-8 text-center backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-100 text-slate-400 dark:bg-white/10 dark:text-white/40">
                <FileSearch size={32} />
              </div>
              <h4 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
                No matching inspection requests
              </h4>
              <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-white/50">
                We couldn't find any inspection records matching your filters or search term.
              </p>
              <button
                onClick={resetAllFilters}
                className="mt-5 rounded-2xl bg-brand-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700"
              >
                Clear All Filters
              </button>
            </div>
          ) : viewMode === "split" ? (
            /* Split Workspace View */
            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              {/* Left Requests List */}
              <div className="space-y-3 max-h-[780px] overflow-y-auto pr-1">
                {filteredRequests.map((request) => {
                  const isSelected = selected?._id === request._id;

                  return (
                    <motion.div
                      key={request._id}
                      whileHover={{ scale: 1.01 }}
                      onClick={() => setSelected(request)}
                      className={`cursor-pointer rounded-2xl border p-4.5 transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10 shadow-lg dark:border-primary/50 dark:bg-primary/15"
                          : "border-slate-200/80 bg-white/70 hover:border-slate-300 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-black uppercase tracking-wider text-slate-500 dark:text-white/60">
                          {request.trackingNumber}
                        </span>
                        <span
                          className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${getStatusBadgeStyle(
                            request.status
                          )}`}
                        >
                          {request.status}
                        </span>
                      </div>

                      <h4 className="mt-2 text-sm font-black text-slate-900 line-clamp-1 dark:text-white">
                        {request.propertyAddress}
                      </h4>

                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-white/70">
                        <span className="rounded-lg bg-slate-100 px-2 py-0.5 font-semibold text-slate-800 dark:bg-white/10 dark:text-white">
                          {request.inspectionTypeLabel}
                        </span>
                        <span>·</span>
                        <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-white/50">
                          <Calendar size={12} />
                          {request.preferredDate
                            ? new Date(request.preferredDate).toLocaleDateString()
                            : "Flexible"}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500 dark:border-white/5 dark:text-white/40">
                        <span className="flex items-center gap-1">
                          <User size={12} /> {request.requesterName || "Citizen"}
                        </span>
                        {request.assignedInspector ? (
                          <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                            Inspector: {request.assignedInspector}
                          </span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400">Unassigned</span>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Right Detail & Assignment Panel */}
              <div className="rounded-3xl border border-white/60 bg-white/80 p-6 shadow-xl backdrop-blur-2xl dark:border-white/10 dark:bg-white/5">
                {selected ? (
                  <div className="space-y-5">
                    {/* Header */}
                    <div className="flex items-start justify-between border-b border-slate-100 pb-4 dark:border-white/5">
                      <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          Active Request Workflow
                        </span>
                        <h3 className="mt-1 text-2xl font-black text-slate-900 dark:text-white">
                          {selected.trackingNumber}
                        </h3>
                        <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-white/60">
                          <MapPin size={13} className="text-primary flex-shrink-0" />
                          {selected.propertyAddress}
                        </p>
                      </div>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusBadgeStyle(
                          selected.status
                        )}`}
                      >
                        {selected.status}
                      </span>
                    </div>

                    {/* Requester Contact Info Card */}
                    <div className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 text-xs dark:border-white/5 dark:bg-white/5">
                      <div className="mb-2 font-bold uppercase tracking-wider text-slate-400">
                        Requester Information
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        <div>
                          <span className="text-slate-500 dark:text-white/40">Name:</span>
                          <div className="font-bold text-slate-900 dark:text-white">
                            {selected.requesterName || "N/A"}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-white/40">Phone:</span>
                          <div className="font-bold text-slate-900 dark:text-white">
                            {selected.requesterPhone || "N/A"}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-500 dark:text-white/40">Email:</span>
                          <div className="font-bold text-slate-900 truncate dark:text-white">
                            {selected.requesterEmail || "N/A"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Workflow Form Inputs */}
                    <div className="space-y-4">
                      {/* Status Selector */}
                      <div>
                        <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-white/80">
                          Workflow Status
                        </label>
                        <select
                          value={selected.status}
                          onChange={(e) =>
                            setSelected((curr) =>
                              curr
                                ? { ...curr, status: e.target.value as InspectionStatus }
                                : curr
                            )
                          }
                          className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-xs font-bold outline-none focus:border-primary dark:border-white/10 dark:bg-gray-900 dark:text-white"
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Inspector Assignment */}
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-white/80">
                            Assigned Inspector
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Inspector Abebe"
                            value={selected.assignedInspector || ""}
                            onChange={(e) =>
                              setSelected((curr) =>
                                curr ? { ...curr, assignedInspector: e.target.value } : curr
                              )
                            }
                            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-xs text-slate-900 outline-none focus:border-primary dark:border-white/10 dark:bg-gray-900 dark:text-white"
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-white/80">
                            Inspector Contact
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. +251 91 123 4567"
                            value={selected.assignedInspectorContact || ""}
                            onChange={(e) =>
                              setSelected((curr) =>
                                curr ? { ...curr, assignedInspectorContact: e.target.value } : curr
                              )
                            }
                            className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-xs text-slate-900 outline-none focus:border-primary dark:border-white/10 dark:bg-gray-900 dark:text-white"
                          />
                        </div>
                      </div>

                      {/* Admin Notes */}
                      <div>
                        <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-white/80">
                          Internal DRM Notes & Observations
                        </label>
                        <textarea
                          rows={3}
                          placeholder="Record inspection schedule, hazards discovered, compliance status..."
                          value={selected.adminNotes || ""}
                          onChange={(e) =>
                            setSelected((curr) =>
                              curr ? { ...curr, adminNotes: e.target.value } : curr
                            )
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-xs text-slate-900 outline-none focus:border-primary dark:border-white/10 dark:bg-gray-900 dark:text-white"
                        />
                      </div>

                      {/* Certificate Upload / URL */}
                      <div>
                        <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-white/80">
                          Safety Inspection Certificate (PDF / Image)
                        </label>

                        {selected.certificateUrl ? (
                          <div className="mb-2 flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-900 dark:border-emerald-800/40 dark:bg-emerald-950/20 dark:text-emerald-300">
                            <span className="flex items-center gap-2 font-bold truncate">
                              <ShieldCheck size={16} className="text-emerald-600 flex-shrink-0" />
                              Certificate is attached
                            </span>
                            <a
                              href={selected.certificateUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1 font-bold text-white shadow-sm hover:bg-emerald-700"
                            >
                              <ExternalLink size={12} /> View
                            </a>
                          </div>
                        ) : (
                          <div className="mb-2 text-[11px] text-amber-600 dark:text-amber-400">
                            No certificate uploaded yet.
                          </div>
                        )}

                        <div className="flex flex-col gap-2">
                          <input
                            type="file"
                            accept=".pdf,.png,.jpg,.jpeg"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) void handleCertificateUpload(file);
                            }}
                            className="block w-full rounded-2xl border border-dashed border-slate-300 bg-white p-2 text-xs text-slate-700 file:mr-3 file:rounded-xl file:border-0 file:bg-brand-50 file:px-3 file:py-1 file:text-xs file:font-bold file:text-brand-600 hover:file:bg-brand-100 dark:border-white/10 dark:bg-gray-900 dark:text-white"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Save Button */}
                    <button
                      type="button"
                      disabled={saving}
                      onClick={handleSave}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 px-6 text-sm font-bold text-white shadow-lg shadow-brand-600/20 transition-all hover:bg-brand-700 hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70 dark:bg-primary dark:shadow-primary/20"
                    >
                      {saving ? (
                        <>
                          <RefreshCw size={16} className="animate-spin" /> Saving Changes...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={16} /> Save Request Changes
                        </>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="flex min-h-[460px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 p-8 text-center text-slate-400">
                    <FileSearch size={36} className="text-slate-300 mb-2" />
                    <p className="text-sm font-bold text-slate-700 dark:text-white">
                      No request selected
                    </p>
                    <p className="text-xs text-slate-500 max-w-xs mt-1">
                      Choose an inspection request from the left list to review its workflow, assign an inspector, and deliver certificates.
                    </p>
                  </div>
                )}
              </div>
            </div>
          ) : viewMode === "grid" ? (
            /* Full Grid Cards View */
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
              {paginatedRequests.map((request) => (
                <motion.div
                  key={request._id}
                  whileHover={{ y: -4 }}
                  className="flex flex-col justify-between rounded-3xl border border-white/50 bg-white/70 p-5 shadow-lg backdrop-blur-2xl transition-all hover:shadow-2xl dark:border-white/10 dark:bg-white/5"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-black uppercase tracking-wider text-slate-500 dark:text-white/50">
                        {request.trackingNumber}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${getStatusBadgeStyle(
                          request.status
                        )}`}
                      >
                        {request.status}
                      </span>
                    </div>

                    <h4 className="mt-3 text-base font-black text-slate-900 line-clamp-1 dark:text-white">
                      {request.propertyAddress}
                    </h4>

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-lg bg-slate-100 px-2 py-0.5 font-bold text-slate-800 dark:bg-white/10 dark:text-white">
                        {request.inspectionTypeLabel}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-white/50">
                        <Calendar size={12} />
                        {request.preferredDate
                          ? new Date(request.preferredDate).toLocaleDateString()
                          : "Flexible"}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50/80 px-3 py-2 text-xs font-medium text-slate-700 dark:bg-white/5 dark:text-white/80">
                      <User size={13} className="text-primary flex-shrink-0" />
                      <span className="truncate">Requester: {request.requesterName || "Citizen"}</span>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-xs">
                      {request.assignedInspector ? (
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          Inspector: {request.assignedInspector}
                        </span>
                      ) : (
                        <span className="text-amber-600 dark:text-amber-400 font-medium">Unassigned</span>
                      )}

                      {request.certificateUrl && (
                        <span className="flex items-center gap-1 font-bold text-emerald-600 text-[11px]">
                          <ShieldCheck size={14} /> Certified
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-3 dark:border-white/5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(request);
                        setViewMode("split");
                      }}
                      className="flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-brand-600 text-xs font-bold text-white shadow-sm hover:bg-brand-700"
                    >
                      Manage Workflow
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            /* Table View */
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/60 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
              <div className="max-w-full overflow-x-auto">
                <table className="w-full table-auto">
                  <thead className="border-b border-slate-200/60 bg-slate-50/50 text-[11px] font-black uppercase tracking-wider text-slate-500 dark:border-white/5 dark:bg-white/5 dark:text-white/40">
                    <tr>
                      <th className="px-5 py-3.5 text-left">Tracking #</th>
                      <th className="px-4 py-3.5 text-left">Property Address</th>
                      <th className="px-4 py-3.5 text-left">Inspection Type</th>
                      <th className="px-4 py-3.5 text-left">Requester</th>
                      <th className="px-4 py-3.5 text-left">Scheduled Date</th>
                      <th className="px-4 py-3.5 text-left">Inspector</th>
                      <th className="px-4 py-3.5 text-left">Status</th>
                      <th className="px-4 py-3.5 text-left">Certificate</th>
                      <th className="px-5 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm dark:divide-white/5">
                    {paginatedRequests.map((request) => (
                      <tr
                        key={request._id}
                        className="transition-colors hover:bg-slate-50/80 dark:hover:bg-white/[0.03]"
                      >
                        <td className="px-5 py-4 font-mono text-xs font-bold text-slate-900 dark:text-white">
                          {request.trackingNumber}
                        </td>
                        <td className="px-4 py-4 text-xs font-semibold text-slate-900 max-w-xs truncate dark:text-white">
                          {request.propertyAddress}
                        </td>
                        <td className="px-4 py-4">
                          <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:bg-white/10 dark:text-white">
                            {request.inspectionTypeLabel}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-600 dark:text-white/70">
                          {request.requesterName || "Citizen"}
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-500 dark:text-white/50">
                          {request.preferredDate
                            ? new Date(request.preferredDate).toLocaleDateString()
                            : "Flexible"}
                        </td>
                        <td className="px-4 py-4 text-xs">
                          {request.assignedInspector ? (
                            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                              {request.assignedInspector}
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400">Unassigned</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${getStatusBadgeStyle(
                              request.status
                            )}`}
                          >
                            {request.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-xs">
                          {request.certificateUrl ? (
                            <a
                              href={request.certificateUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 font-bold text-emerald-600 hover:underline"
                            >
                              <ShieldCheck size={14} /> Attached
                            </a>
                          ) : (
                            <span className="text-slate-400">Pending</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelected(request);
                              setViewMode("split");
                            }}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3 py-1 text-xs font-bold text-white shadow-sm hover:bg-brand-700"
                          >
                            Manage
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pagination Footer (for table and grid view) */}
          {viewMode !== "split" && totalPages > 1 && (
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
                      className={`h-9 w-9 rounded-xl text-xs font-bold transition ${
                        currentPage === pageNum
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
    </>
  );
};

export default Inspection;
