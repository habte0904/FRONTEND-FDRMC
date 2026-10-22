import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { Link, useNavigate } from "react-router";
import api from "@/api/axios";
import {
  connectDashboardSocket,
  getDashboardSocket,
} from "@/features/live-dashboard/socket/dashboardSocket";
import { useBranchSubcity, useIsBranchUser } from "@/context/HierarchyContext";
import {
  Bell,
  AlertTriangle,
  MessageSquareWarning,
  Check,
  CheckCheck,
  MapPin,
  Clock,
  ExternalLink,
  Flame,
  Droplets,
  HeartPulse,
  Car,
  Zap,
  RefreshCw,
  X,
  ShieldAlert,
  BellRing,
  ArrowRight,
  Wind,
  Waves,
  Building2,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface PublicReportNotification {
  _id: string;
  reportCode?: string;
  reportType?: "incident" | "concern";
  category?: string;
  concernCategory?: string | string[];
  severity?: "minor" | "moderate" | "critical" | string;
  details?: string;
  concernDetails?: string;
  location?: {
    addressLine?: string;
    city?: string;
    region?: string;
    subCity?: string;
    subcity?: string;
    woreda?: string;
    placeName?: string;
  };
  status?: string;
  isRead?: boolean;
  createdAt: string;
}

interface LiveToast {
  id: string;
  report: PublicReportNotification;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toCategoryText = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(toCategoryText).filter(Boolean).join(", ");
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const candidate = record.name ?? record.title ?? record.label ?? record.category;
    if (typeof candidate === "string") return candidate;
  }
  return "";
};

const toLowerText = (value: unknown) => toCategoryText(value).toLowerCase();

const normText = (s?: string | null) => (s || "").toLowerCase().replace(/\s+/g, "");

/**
 * Returns true if the report belongs to the user's branch.
 * Head Office and Super Admin users see all notifications.
 * Branch users ONLY see notifications for their assigned branch.
 */
const reportMatchesBranch = (
  report: PublicReportNotification,
  isBranchUser: boolean,
  branchSubcity: string | null
): boolean => {
  // Head office / Super admin sees everything
  if (!isBranchUser) return true;

  // Branch user with no identified branch should not see other branches' alerts
  if (!branchSubcity) return false;

  const branch = normText(branchSubcity);
  const loc = report.location || {};
  const candidates = [
    loc.subCity,
    loc.subcity,
    loc.addressLine,
    loc.placeName,
    loc.woreda,
    loc.city,
  ];

  return candidates.some((c) => {
    if (!c) return false;
    const nc = normText(c);
    return nc.includes(branch) || branch.includes(nc);
  });
};

const getCategoryIcon = (category: unknown, type: string | undefined, cls = "w-4 h-4") => {
  const c = toLowerText(category);
  if (c.includes("fire") || c.includes("arson")) return <Flame className={`${cls} text-rose-500`} />;
  if (c.includes("flood") || c.includes("water")) return <Droplets className={`${cls} text-sky-500`} />;
  if (c.includes("medical") || c.includes("health")) return <HeartPulse className={`${cls} text-emerald-500`} />;
  if (c.includes("traffic") || c.includes("accident")) return <Car className={`${cls} text-amber-500`} />;
  if (c.includes("power") || c.includes("electric")) return <Zap className={`${cls} text-yellow-500`} />;
  if (c.includes("wind") || c.includes("storm")) return <Wind className={`${cls} text-cyan-500`} />;
  if (c.includes("landslide") || c.includes("earthquake")) return <Waves className={`${cls} text-orange-500`} />;
  if (c.includes("structural") || c.includes("building")) return <Building2 className={`${cls} text-slate-500`} />;
  if (type === "concern") return <MessageSquareWarning className={`${cls} text-indigo-500`} />;
  return <AlertTriangle className={`${cls} text-orange-500`} />;
};

const formatTimeAgo = (dateStr: string) => {
  if (!dateStr) return "recently";
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  new:        { label: "New",        color: "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300" },
  submitted:  { label: "Submitted",  color: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300" },
  received:   { label: "Received",   color: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300" },
  dispatched: { label: "Dispatched", color: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300" },
  solved:     { label: "Solved",     color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" },
  closed:     { label: "Closed",     color: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400" },
  archived:   { label: "Archived",   color: "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500" },
  not_solved: { label: "Unresolved", color: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300" },
};

const getStatusMeta = (status?: string) =>
  STATUS_META[status?.toLowerCase() ?? ""] ?? { label: status ?? "Unknown", color: "bg-slate-100 text-slate-500" };

// ─── Modern Redesigned Live Alert Toast ───────────────────────────────────────
function LiveAlertToast({
  toast,
  onDismiss,
  onView,
}: {
  toast: LiveToast;
  onDismiss: () => void;
  onView: () => void;
}) {
  const { report } = toast;
  const isCritical = toLowerText(report.severity) === "critical";
  const isConcern = report.reportType === "concern";
  const categoryName =
    toCategoryText(report.category) ||
    toCategoryText(report.concernCategory) ||
    (isConcern ? "Public Concern" : "Incident Alert");

  const locationText = [
    report.location?.subCity || report.location?.subcity,
    report.location?.woreda,
    report.location?.addressLine || report.location?.placeName,
  ]
    .filter(Boolean)
    .join(" · ");

  const snippet = report.details || report.concernDetails || "";

  useEffect(() => {
    const timer = setTimeout(onDismiss, 8000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className={`
        group relative overflow-hidden rounded-2xl border p-4 transition-all duration-300
        bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl shadow-2xl
        ${
          isCritical
            ? "border-rose-400/80 dark:border-rose-500/60 shadow-rose-500/10"
            : isConcern
            ? "border-indigo-300/80 dark:border-indigo-500/50 shadow-indigo-500/10"
            : "border-slate-200/90 dark:border-slate-800 shadow-slate-900/10"
        }
      `}
      style={{
        animation: "toastSlideIn 0.38s cubic-bezier(0.16, 1, 0.3, 1) forwards",
      }}
    >
      {/* Left glowing accent highlight */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1.5 ${
          isCritical
            ? "bg-gradient-to-b from-rose-500 via-red-600 to-rose-700 shadow-[0_0_12px_rgba(244,63,94,0.7)]"
            : isConcern
            ? "bg-gradient-to-b from-indigo-500 via-indigo-600 to-purple-600 shadow-[0_0_12px_rgba(99,102,241,0.6)]"
            : "bg-gradient-to-b from-blue-500 via-sky-500 to-blue-600 shadow-[0_0_12px_rgba(59,130,246,0.5)]"
        }`}
      />

      <div className="pl-1">
        {/* Header row: Live indicator + Badge + Code + Dismiss */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                isCritical
                  ? "bg-rose-500 text-white shadow-sm shadow-rose-500/30"
                  : isConcern
                  ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/80 dark:text-indigo-300"
                  : "bg-blue-100 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300"
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isCritical ? "bg-white" : isConcern ? "bg-indigo-500" : "bg-blue-500"
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isCritical ? "bg-white" : isConcern ? "bg-indigo-600" : "bg-blue-600"
                  }`}
                />
              </span>
              <span>
                {isCritical
                  ? "Critical Alert"
                  : isConcern
                  ? "New Concern"
                  : "Citizen Incident"}
              </span>
            </span>

            {report.reportCode && (
              <span className="font-mono text-[10.5px] font-bold text-slate-400 dark:text-slate-500">
                #{report.reportCode}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <span className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-0.5 font-medium">
              <Clock className="w-2.5 h-2.5" />
              {formatTimeAgo(report.createdAt)}
            </span>
            <button
              onClick={onDismiss}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition ml-1"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content row: Icon + Title + Location + Snippet */}
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm mt-0.5 border ${
              isCritical
                ? "bg-rose-50 dark:bg-rose-950/70 border-rose-200 dark:border-rose-800/80"
                : isConcern
                ? "bg-indigo-50 dark:bg-indigo-950/70 border-indigo-200 dark:border-indigo-800/80"
                : "bg-blue-50 dark:bg-blue-950/70 border-blue-200 dark:border-blue-800/80"
            }`}
          >
            {getCategoryIcon(categoryName, report.reportType, "w-5 h-5")}
          </div>

          <div className="flex-1 min-w-0">
            <h6 className="text-[13px] font-black text-slate-900 dark:text-white leading-snug truncate">
              {categoryName}
            </h6>

            {locationText && (
              <div className="flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                <span className="truncate">{locationText}</span>
              </div>
            )}

            {snippet && (
              <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 mt-1 leading-relaxed">
                {snippet}
              </p>
            )}
          </div>
        </div>

        {/* Action row */}
        <div className="flex items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
          <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
            Click to view and mark as reviewed
          </span>

          <button
            onClick={onView}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white shadow-sm transition-all duration-150 transform hover:scale-[1.02] active:scale-[0.98] ${
              isCritical
                ? "bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-700 hover:to-red-700 shadow-rose-500/25"
                : isConcern
                ? "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-indigo-500/25"
                : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/25"
            }`}
          >
            <span>View Report</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Progress countdown bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 overflow-hidden bg-slate-100 dark:bg-slate-800">
        <div
          className={`h-full ${
            isCritical
              ? "bg-gradient-to-r from-rose-500 to-red-600"
              : isConcern
              ? "bg-gradient-to-r from-indigo-500 to-purple-600"
              : "bg-gradient-to-r from-blue-500 to-sky-500"
          }`}
          style={{ animation: "toastProgress 8s linear forwards" }}
        />
      </div>
    </div>
  );
}

// ─── Notification Item Component ──────────────────────────────────────────────
function NotificationItem({
  report,
  onItemClick,
  onMarkRead,
}: {
  report: PublicReportNotification;
  onItemClick: (r: PublicReportNotification) => void;
  onMarkRead: (id: string, e: React.MouseEvent) => void;
}) {
  const isUnread = !report.isRead;
  const isConcern = report.reportType === "concern";
  const isCritical = toLowerText(report.severity) === "critical";
  const isModerate = toLowerText(report.severity) === "moderate";

  const categoryName =
    toCategoryText(report.category) ||
    toCategoryText(report.concernCategory) ||
    (isConcern ? "Public Concern" : "Incident");

  const detailsText = report.details || report.concernDetails || "No additional description provided.";
  const locationParts = [
    report.location?.addressLine,
    report.location?.subCity || report.location?.subcity,
    report.location?.woreda,
    report.location?.city,
  ].filter(Boolean);
  const locationText = locationParts.join(", ");

  const statusMeta = getStatusMeta(report.status);

  return (
    <div
      onClick={() => onItemClick(report)}
      className={`relative flex items-start gap-3 px-4 py-3.5 cursor-pointer transition-all duration-150 group border-b border-slate-100/80 dark:border-slate-800/60 last:border-0 ${
        isUnread
          ? "bg-blue-500/[0.04] dark:bg-blue-500/[0.07] hover:bg-blue-500/[0.08] dark:hover:bg-blue-500/[0.12]"
          : "hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
      }`}
    >
      {/* Unread accent bar */}
      {isUnread && (
        <div
          className={`absolute left-0 top-3.5 bottom-3.5 w-[3px] rounded-r-full ${
            isCritical ? "bg-rose-500" : isConcern ? "bg-indigo-400" : "bg-blue-500"
          }`}
        />
      )}

      {/* Category icon */}
      <div
        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border shadow-sm mt-0.5 ${
          isCritical
            ? "bg-rose-100 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800"
            : isConcern
            ? "bg-indigo-100 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800"
            : isModerate
            ? "bg-amber-100 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800"
            : "bg-sky-100 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800"
        }`}
      >
        {getCategoryIcon(categoryName, report.reportType)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Top row: type badge + code + time */}
        <div className="flex items-center justify-between gap-1 mb-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                isConcern
                  ? "bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300"
                  : "bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300"
              }`}
            >
              {isConcern ? "Concern" : "Incident"}
            </span>

            {report.reportCode && (
              <span className="font-mono text-[9px] font-bold text-slate-400 dark:text-slate-500">
                #{report.reportCode}
              </span>
            )}

            {report.severity && !isConcern && (
              <span
                className={`px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase ${
                  isCritical
                    ? "bg-rose-600 text-white animate-pulse"
                    : isModerate
                    ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                    : "bg-sky-500/20 text-sky-700 dark:text-sky-300"
                }`}
              >
                {report.severity}
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-400 shrink-0 font-medium flex items-center gap-0.5">
            <Clock className="w-2.5 h-2.5" />
            {formatTimeAgo(report.createdAt)}
          </span>
        </div>

        {/* Title */}
        <h6
          className={`text-[12.5px] font-bold truncate ${
            isUnread ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-300"
          }`}
        >
          {categoryName}
        </h6>

        {/* Details */}
        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5 leading-relaxed">
          {detailsText}
        </p>

        {/* Footer: location + status */}
        <div className="flex items-center justify-between gap-2 mt-1.5">
          {locationText ? (
            <div className="flex items-center gap-1 text-[10px] text-slate-400 truncate">
              <MapPin className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate">{locationText}</span>
            </div>
          ) : (
            <span />
          )}
          {report.status && (
            <span
              className={`shrink-0 px-1.5 py-0.5 rounded-md text-[9px] font-bold ${statusMeta.color}`}
            >
              {statusMeta.label}
            </span>
          )}
        </div>
      </div>

      {/* Right: unread dot + mark-read */}
      <div className="flex flex-col items-center justify-between self-stretch shrink-0 gap-1 pl-0.5">
        {isUnread && (
          <span
            className={`w-2 h-2 rounded-full mt-1.5 ring-2 ${
              isCritical
                ? "bg-rose-500 ring-rose-200 dark:ring-rose-900"
                : "bg-blue-500 ring-blue-200 dark:ring-blue-900"
            }`}
            title="Unread"
          />
        )}
        {isUnread && (
          <button
            type="button"
            onClick={(e) => onMarkRead(report._id, e)}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-300 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-all duration-150"
            title="Mark as read"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main NotificationDropdown Component ──────────────────────────────────────
export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [reports, setReports] = useState<PublicReportNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "incident" | "concern" | "unread">("all");
  const [hasNewAlertAnimation, setHasNewAlertAnimation] = useState(false);
  const [liveToasts, setLiveToasts] = useState<LiveToast[]>([]);
  const [badgePop, setBadgePop] = useState(false);

  const knownReportIds = useRef<Set<string>>(new Set());
  const notificationsHydrated = useRef(false);
  const navigate = useNavigate();

  // Branch context: branch users only see their branch; head office / super admin see all
  const isBranchUser = useIsBranchUser();
  const branchSubcity = useBranchSubcity();

  // ── Fetch notifications (branch-scoped by backend via applyScopeFilter) ──
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/incident-reports/unread");
      if (res.data) {
        const nextReports: PublicReportNotification[] = res.data.reports || [];
        const newReports = notificationsHydrated.current
          ? nextReports.filter((r) => !knownReportIds.current.has(r._id))
          : [];

        setReports(nextReports);
        setUnreadCount(res.data.unreadCount ?? 0);

        // Show live toast for new incoming polled reports
        if (newReports.length > 0) {
          const scopedNewReports = newReports.filter((r) =>
            reportMatchesBranch(r, isBranchUser, branchSubcity)
          );

          if (scopedNewReports.length > 0) {
            setLiveToasts((prev) =>
              [
                ...scopedNewReports.slice(0, 3).map((r) => ({
                  id: `poll-${r._id}-${Date.now()}`,
                  report: { ...r, isRead: false },
                })),
                ...prev,
              ].slice(0, 3)
            );
            triggerBadgeAnimation();
          }
        }

        nextReports.forEach((r) => knownReportIds.current.add(r._id));
        notificationsHydrated.current = true;
      }
    } catch (err) {
      console.error("Failed to fetch notification reports:", err);
    } finally {
      setLoading(false);
    }
  }, [isBranchUser, branchSubcity]);

  const triggerBadgeAnimation = () => {
    setBadgePop(true);
    setHasNewAlertAnimation(true);
    setTimeout(() => setBadgePop(false), 500);
    setTimeout(() => setHasNewAlertAnimation(false), 5000);
  };

  // ── Initial load + polling ──
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // ── WebSocket real-time events ──
  useEffect(() => {
    const socket = connectDashboardSocket();

    const handleNewNotification = (data: any) => {
      const payload: PublicReportNotification = data.payload || data;
      if (!payload || !payload._id) return;

      // ── Branch scoping: ignore if this report does not belong to branch user's branch ──
      if (!reportMatchesBranch(payload, isBranchUser, branchSubcity)) {
        return;
      }

      knownReportIds.current.add(payload._id);

      setReports((prev) => {
        if (prev.some((r) => r._id === payload._id)) return prev;
        return [{ ...payload, isRead: false }, ...prev];
      });

      // Increment branch count
      setUnreadCount((prev) => prev + 1);
      triggerBadgeAnimation();

      // Show live toast popup (max 3 stacked)
      const toastId = `${payload._id}-${Date.now()}`;
      setLiveToasts((prev) => [{ id: toastId, report: payload }, ...prev].slice(0, 3));
    };

    const handleIncidentUpdated = (data: any) => {
      const payload = data.payload || data;
      if (!payload || !payload._id) return;
      setReports((prev) =>
        prev.map((r) => (r._id === payload._id ? { ...r, ...payload } : r))
      );
    };

    // Listen only to notification:new (incident:created is for charts to avoid duplicate triggers)
    socket.on("notification:new", handleNewNotification);
    socket.on("incident:updated", handleIncidentUpdated);

    return () => {
      const s = getDashboardSocket();
      s.off("notification:new", handleNewNotification);
      s.off("incident:updated", handleIncidentUpdated);
    };
  }, [isBranchUser, branchSubcity]);

  // ── Mark single as read → optimistically decrement badge ──
  const markAsRead = useCallback(
    async (id: string, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();

      const report = reports.find((r) => r._id === id);
      const wasUnread = report && !report.isRead;

      // Optimistic update
      setReports((prev) => prev.map((r) => (r._id === id ? { ...r, isRead: true } : r)));
      if (wasUnread) setUnreadCount((prev) => Math.max(0, prev - 1));

      try {
        await api.patch(`/incident-reports/${id}/read`);
      } catch (err) {
        console.error("Failed to mark report as read:", err);
        // Rollback
        setReports((prev) => prev.map((r) => (r._id === id ? { ...r, isRead: false } : r)));
        if (wasUnread) setUnreadCount((prev) => prev + 1);
      }
    },
    [reports]
  );

  // ── Mark all as read → zero badge ──
  const markAllAsRead = useCallback(async () => {
    setReports((prev) => prev.map((r) => ({ ...r, isRead: true })));
    setUnreadCount(0);
    try {
      await api.patch("/incident-reports/mark-all-read");
    } catch (err) {
      console.error("Failed to mark all as read:", err);
      fetchNotifications();
    }
  }, [fetchNotifications]);

  // ── Click notification: mark read + navigate ──
  const handleItemClick = useCallback(
    (report: PublicReportNotification) => {
      if (!report.isRead) markAsRead(report._id);
      setIsOpen(false);
      navigate(
        report.reportType === "concern" ? "/admin/concern-reports" : "/admin/incident-reports"
      );
    },
    [markAsRead, navigate]
  );

  const handleBellClick = useCallback(() => {
    setIsOpen((prev) => {
      if (!prev) setHasNewAlertAnimation(false);
      return !prev;
    });
  }, []);

  const dismissToast = useCallback((id: string) => {
    setLiveToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // ── Filtered list ──
  const filteredReports = useMemo(() => {
    return reports.filter((r) => {
      if (activeFilter === "unread") return !r.isRead;
      if (activeFilter === "incident") return r.reportType !== "concern";
      if (activeFilter === "concern") return r.reportType === "concern";
      return true;
    });
  }, [reports, activeFilter]);

  const counts = useMemo(() => {
    const unread = reports.filter((r) => !r.isRead).length;
    const incidents = reports.filter((r) => r.reportType !== "concern").length;
    const concerns = reports.filter((r) => r.reportType === "concern").length;
    return { all: reports.length, unread, incidents, concerns };
  }, [reports]);

  const FILTERS = [
    { id: "all",      label: "All",       count: counts.all },
    { id: "unread",   label: "Unread",    count: counts.unread },
    { id: "incident", label: "Incidents", count: counts.incidents },
    { id: "concern",  label: "Concerns",  count: counts.concerns },
  ] as const;

  return (
    <>
      {/* CSS animations */}
      <style>{`
        @keyframes toastSlideIn {
          from {
            transform: translateX(120%) scale(0.95);
            opacity: 0;
          }
          to {
            transform: translateX(0) scale(1);
            opacity: 1;
          }
        }
        @keyframes toastProgress {
          from { width: 100%; }
          to   { width: 0%; }
        }
        @keyframes badgePop {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.6); }
          70%  { transform: scale(0.9); }
          100% { transform: scale(1); }
        }
        @keyframes bellRing {
          0%,100% { transform: rotate(0deg); }
          15%     { transform: rotate(14deg); }
          30%     { transform: rotate(-10deg); }
          45%     { transform: rotate(8deg); }
          60%     { transform: rotate(-5deg); }
          75%     { transform: rotate(3deg); }
        }
        .badge-pop { animation: badgePop 0.45s cubic-bezier(0.34,1.56,0.64,1); }
        .bell-ring { animation: bellRing 0.7s ease infinite; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 9999px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; }
      `}</style>

      {/* Modern Live Toast Notification Stack */}
      <div className="fixed top-20 right-4 sm:right-6 z-[99999] flex flex-col gap-3 w-[350px] sm:w-[410px] pointer-events-none">
        {liveToasts.map((t) => (
          <div key={t.id} className="pointer-events-auto relative">
            <LiveAlertToast
              toast={t}
              onDismiss={() => dismissToast(t.id)}
              onView={() => {
                dismissToast(t.id);
                handleItemClick(t.report);
              }}
            />
          </div>
        ))}
      </div>

      {/* Bell Trigger Button */}
      <div className="relative">
        <button
          onClick={handleBellClick}
          id="notification-bell-btn"
          className={`
            relative flex items-center justify-center transition-all duration-200
            bg-white border rounded-full h-11 w-11 shadow-theme-xs
            ${
              isOpen
                ? "text-blue-600 bg-blue-50/80 border-blue-200 dark:text-blue-400 dark:bg-slate-800 dark:border-blue-800"
                : "text-gray-500 border-gray-200 hover:text-blue-600 hover:bg-blue-50/60 hover:border-blue-200 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-blue-400"
            }
          `}
          aria-label="Notifications"
          title={isBranchUser ? `${branchSubcity || "Branch"} Notifications` : "All Public Reports"}
        >
          {hasNewAlertAnimation ? (
            <BellRing className="w-5 h-5 text-blue-500 bell-ring" />
          ) : (
            <Bell className="w-5 h-5" />
          )}

          {unreadCount > 0 && (
            <span
              className={`absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white ring-2 ring-white dark:ring-gray-900 shadow-sm ${
                badgePop ? "badge-pop" : ""
              }`}
            >
              {unreadCount > 99 ? "99+" : unreadCount}
              {hasNewAlertAnimation && (
                <span className="absolute -inset-1 rounded-full bg-rose-400 opacity-60 animate-ping" />
              )}
            </span>
          )}
        </button>

        {/* Notification Panel */}
        <Dropdown
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          className="absolute -right-[230px] sm:-right-4 mt-2.5 flex h-[580px] w-[370px] sm:w-[440px] flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700/60 dark:bg-slate-900 overflow-hidden z-50"
        >
          {/* Panel Header */}
          <div className="relative px-5 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-gradient-to-br from-blue-600/[0.05] via-transparent to-indigo-600/[0.03] dark:from-blue-500/10 dark:to-indigo-500/8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md shadow-blue-500/25">
                  <ShieldAlert className="w-4 h-4 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h5 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
                      Public Reports
                    </h5>
                    {unreadCount > 0 && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white shadow-sm">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-1">
                    {isBranchUser ? (
                      <>
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        <span>{branchSubcity ? `${branchSubcity} Branch` : "Your Branch"}</span>
                      </>
                    ) : (
                      <>
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500" />
                        <span>Head Office · All Branches</span>
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Mark read</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={fetchNotifications}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                  title="Refresh"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-blue-500" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 shrink-0 no-scrollbar">
            {FILTERS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id as typeof activeFilter)}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                  activeFilter === tab.id
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30"
                    : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`min-w-[18px] text-center px-1 py-0.5 rounded-full text-[10px] font-black ${
                    activeFilter === tab.id
                      ? "bg-white/25 text-white"
                      : tab.id === "unread" && tab.count > 0
                      ? "bg-rose-500 text-white"
                      : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Items List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loading && reports.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 p-10 text-slate-400">
                <div className="w-10 h-10 rounded-full border-2 border-blue-200 dark:border-blue-800 border-t-blue-500 animate-spin" />
                <p className="text-xs font-medium">Loading notifications…</p>
              </div>
            ) : filteredReports.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 p-10">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center shadow-inner">
                  <Bell className="w-7 h-7 text-slate-300 dark:text-slate-600" />
                </div>
                <div className="text-center">
                  <p className="text-[13px] font-bold text-slate-600 dark:text-slate-400">
                    {activeFilter === "unread" ? "All caught up!" : "No reports found"}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {activeFilter === "unread"
                      ? "You've reviewed all reports in your scope"
                      : "No reports found in this category"}
                  </p>
                </div>
              </div>
            ) : (
              filteredReports.map((report) => (
                <NotificationItem
                  key={report._id}
                  report={report}
                  onItemClick={handleItemClick}
                  onMarkRead={markAsRead}
                />
              ))
            )}
          </div>

          {/* Panel Footer */}
          <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/60 flex items-center gap-2 shrink-0">
            <Link
              to="/admin/incident-reports"
              onClick={() => setIsOpen(false)}
              className="flex-1 py-2 px-3 rounded-xl text-[11px] font-bold text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700 hover:border-blue-200 dark:hover:border-blue-800 transition-all shadow-sm flex items-center justify-center gap-1.5 group"
            >
              <AlertTriangle className="w-3.5 h-3.5 group-hover:text-blue-500 transition" />
              <span>Incident Manager</span>
              <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-blue-400 transition ml-auto" />
            </Link>
            <Link
              to="/admin/concern-reports"
              onClick={() => setIsOpen(false)}
              className="flex-1 py-2 px-3 rounded-xl text-[11px] font-bold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50/80 dark:hover:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 transition-all shadow-sm flex items-center justify-center gap-1.5 group"
            >
              <MessageSquareWarning className="w-3.5 h-3.5 transition" />
              <span>Concern Reports</span>
              <ExternalLink className="w-3 h-3 text-indigo-400 transition ml-auto" />
            </Link>
          </div>
        </Dropdown>
      </div>
    </>
  );
}
