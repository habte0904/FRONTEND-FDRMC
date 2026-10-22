import React, { useState, useEffect } from "react";
import PageMeta from "../components/common/PageMeta";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../hooks/useToast";
import { resolvePortalAssetUrl } from "../utils/resolvePortalAssetUrl";
import ProfileAvatarModal from "../components/UserProfile/ProfileAvatarModal";
import api from "../api/axios";
import { motion } from "framer-motion";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Building,
  Shield,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  RefreshCw,
  Check,
  CheckCircle2,
  AlertCircle,
  Copy,
  Clock,
  Layers,
  Sparkles,
  Camera,
  UserCheck,
  Award,
  Fingerprint,
  Save,
  RotateCcw,
  ShieldCheck,
  Briefcase,
  HelpCircle,
  Info,
} from "lucide-react";

const getHierarchyLabel = (level?: string) => {
  switch (level) {
    case "super_admin":
      return { title: "Super Administrator", badge: "bg-amber-100 text-amber-900 border-amber-300" };
    case "manager":
      return { title: "Commission Manager", badge: "bg-blue-100 text-blue-900 border-blue-300" };
    case "deputy":
      return { title: "Deputy Director", badge: "bg-indigo-100 text-indigo-900 border-indigo-300" };
    case "branch_admin":
      return { title: "Branch Administrator", badge: "bg-emerald-100 text-emerald-900 border-emerald-300" };
    case "directorate":
      return { title: "Directorate Lead", badge: "bg-purple-100 text-purple-900 border-purple-300" };
    case "sector_lead":
      return { title: "Sector Lead", badge: "bg-cyan-100 text-cyan-900 border-cyan-300" };
    case "team_leader":
      return { title: "Team Leader", badge: "bg-teal-100 text-teal-900 border-teal-300" };
    case "expert":
      return { title: "Disaster Risk Expert", badge: "bg-sky-100 text-sky-900 border-sky-300" };
    default:
      return { title: "Staff Member", badge: "bg-gray-100 text-gray-800 border-gray-300" };
  }
};

export default function UserProfiles() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();

  const [activeTab, setActiveTab] = useState<"info" | "access" | "security">("info");
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Editable Form fields (Personal credentials ONLY)
  const [fullname, setFullname] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isSavingInfo, setIsSavingInfo] = useState(false);
  const [hasInfoChanges, setHasInfoChanges] = useState(false);

  // Security / Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [isChangingPass, setIsChangingPass] = useState(false);

  // Search & Copy
  const [permissionSearch, setPermissionSearch] = useState("");
  const [copiedId, setCopiedId] = useState(false);

  // Sync state from user object
  useEffect(() => {
    if (user) {
      setFullname(user.fullname || "");
      setEmail(user.email || "");
      setPhone(user.phone || "");
      setHasInfoChanges(false);
    }
  }, [user]);

  const handleInfoChange = (field: string, value: string) => {
    if (field === "fullname") setFullname(value);
    if (field === "email") setEmail(value);
    if (field === "phone") setPhone(value);
    setHasInfoChanges(true);
  };

  const handleResetInfo = () => {
    if (user) {
      setFullname(user.fullname || "");
      setEmail(user.email || "");
      setPhone(user.phone || "");
      setHasInfoChanges(false);
    }
  };

  const handleSaveInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!fullname.trim()) {
      toast.error("Full Name is required.");
      return;
    }
    if (!email.trim()) {
      toast.error("Email Address is required.");
      return;
    }

    setIsSavingInfo(true);
    try {
      const userId = user.id || (user as any)._id;
      const formData = new FormData();
      formData.append("fullname", fullname.trim());
      formData.append("email", email.trim().toLowerCase());
      formData.append("phone", phone.trim());
      // NOTE: subcity and kebele are intentionally excluded to protect data-scope permissions

      await api.put(`/users/${userId}`, formData);
      await refreshUser();
      setHasInfoChanges(false);
      toast.success("Profile credentials updated successfully!");
    } catch (error: any) {
      console.error("Failed to update profile", error);
      toast.error(error.response?.data?.message || "Failed to update profile information.");
    } finally {
      setIsSavingInfo(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (!currentPassword) {
      toast.error("Please enter your current password.");
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      toast.error("New password must be at least 6 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }

    setIsChangingPass(true);
    try {
      const userId = user.id || (user as any)._id;
      await api.put(`/users/${userId}`, {
        currentPassword,
        newPassword,
      });

      toast.success("Password updated successfully! Please keep it secure.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Failed to update password", error);
      toast.error(error.response?.data?.message || "Failed to change password. Check your current password.");
    } finally {
      setIsChangingPass(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshUser();
      toast.info("Profile data refreshed.");
    } catch {
      toast.error("Could not refresh profile.");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCopyId = () => {
    const userId = user?.id || (user as any)?._id || "";
    if (userId) {
      navigator.clipboard.writeText(userId);
      setCopiedId(true);
      toast.info("User ID copied to clipboard.");
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-white rounded-2xl border border-gray-200">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-semibold text-gray-700">Loading user profile...</p>
        </div>
      </div>
    );
  }

  const userId = user.id || (user as any)._id;
  const avatarUrl = resolvePortalAssetUrl(user.profileImage) || "/images/user/users.png";
  const hierarchy = getHierarchyLabel(user.accessLevel);

  // Compute password strength
  const passLengthOk = newPassword.length >= 6;
  const passHasNumberOrSpecial = /[0-9!@#$%^&*(),.?":{}|<>]/.test(newPassword);
  const passHasUpperAndLower = /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword);
  const passMatch = newPassword && newPassword === confirmPassword;

  let passScore = 0;
  if (passLengthOk) passScore++;
  if (passHasNumberOrSpecial) passScore++;
  if (passHasUpperAndLower) passScore++;

  // Permissions filter
  const permissionsList = user.permissions || [];
  const filteredPermissions = permissionsList.filter((perm) =>
    perm.toLowerCase().includes(permissionSearch.toLowerCase())
  );

  return (
    <>
      <PageMeta
        title={`${user.fullname || "User"} Profile | IDRMIS`}
        description="IDRMIS Government Disaster Risk Management System - User Profile & Security Center"
      />
      <PageBreadcrumb pageTitle="User Profile" />

      {/* Main Container - Crisp White Theme */}
      <div className="space-y-6 bg-white p-4 sm:p-6 lg:p-8 rounded-3xl border border-gray-200 shadow-sm text-gray-900">
        {/* ========================================================= */}
        {/* HERO BANNER CARD (Clean Light Background with Dark Text) */}
        {/* ========================================================= */}
        <div className="relative overflow-hidden rounded-2xl border-2 border-gray-200 bg-white shadow-sm">
          {/* Light Header Cover Strip */}
          <div className="relative h-36 w-full bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-100 border-b border-gray-200 sm:h-44">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(59,130,246,0.12),transparent_70%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_60%,rgba(99,102,241,0.1),transparent_60%)]" />

            {/* Verification Badge */}
            <div className="absolute top-4 right-4 sm:top-5 sm:right-6 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-gray-300 text-gray-800 text-xs font-bold shadow-xs">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Official IDRMIS Account</span>
            </div>
          </div>

          {/* Profile Identity Bar */}
          <div className="relative px-6 pb-6 sm:px-8 bg-white">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              {/* Avatar + Main Details */}
              <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 -mt-16 sm:-mt-20">
                {/* Avatar with Camera Trigger */}
                <div className="relative group shrink-0">
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full p-1 bg-white shadow-lg ring-4 ring-gray-100 border-2 border-gray-300">
                    <div className="w-full h-full rounded-full overflow-hidden bg-gray-100">
                      <img
                        src={avatarUrl}
                        alt={user.fullname || "User Avatar"}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </div>
                  </div>

                  {/* Active Status Dot */}
                  <span
                    className={`absolute bottom-2 right-2 w-4 h-4 rounded-full border-2 border-white shadow-xs ${
                      user.status === "active"
                        ? "bg-emerald-500"
                        : user.status === "pending"
                        ? "bg-amber-500"
                        : "bg-rose-500"
                    }`}
                    title={`Status: ${user.status || "active"}`}
                  />

                  {/* Camera overlay button */}
                  <button
                    type="button"
                    onClick={() => setIsAvatarModalOpen(true)}
                    className="absolute inset-0 rounded-full bg-gray-900/60 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    title="Change profile photo"
                  >
                    <Camera className="w-5 h-5 mb-0.5 text-white" />
                    <span className="text-[10px] font-bold text-white">
                      Change Photo
                    </span>
                  </button>
                </div>

                {/* Name, Roles, Organization */}
                <div className="text-center sm:text-left space-y-1.5">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">
                      {user.fullname || "IDRMIS Official"}
                    </h1>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
                      {user.status?.toUpperCase() || "ACTIVE"}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-y-1 gap-x-2 text-sm text-gray-700 font-medium">
                    <span className="inline-flex items-center gap-1.5 font-bold text-brand-700">
                      <Briefcase className="w-4 h-4 text-brand-600" />
                      {user.roles && user.roles.length > 0
                        ? user.roles.map((r) => r.name).join(" • ")
                        : "System User"}
                    </span>
                    <span className="hidden sm:inline text-gray-400">•</span>
                    <span className="inline-flex items-center gap-1 text-gray-800 font-semibold">
                      <Building className="w-4 h-4 text-gray-500" />
                      {user.organization?.name || "Disaster Risk Management Commission"}
                    </span>
                  </div>

                  {/* Badges Bar */}
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold border ${hierarchy.badge}`}
                    >
                      <Award className="w-3.5 h-3.5" />
                      {hierarchy.title}
                    </span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 border border-slate-300">
                      <Layers className="w-3.5 h-3.5 text-slate-600" />
                      {user.organizationType === "head_office"
                        ? "Head Office (National Command)"
                        : "Subcity Territorial Branch"}
                    </span>
                    {user.subcity && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-sky-100 text-sky-900 border border-sky-300">
                        <MapPin className="w-3.5 h-3.5 text-sky-700" />
                        {user.subcity} Subcity
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-center sm:justify-end gap-3 shrink-0 pt-2 md:pt-0">
                <button
                  type="button"
                  onClick={() => setIsAvatarModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-gray-300 bg-white text-xs font-bold text-gray-800 shadow-xs hover:bg-gray-50 hover:border-gray-400 transition-all cursor-pointer"
                >
                  <Camera className="w-4 h-4 text-brand-600" />
                  Edit Photo
                </button>

                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-gray-300 bg-white text-xs font-bold text-gray-800 shadow-xs hover:bg-gray-50 hover:border-gray-400 transition-all cursor-pointer disabled:opacity-50"
                  title="Reload fresh data from server"
                >
                  <RefreshCw
                    className={`w-4 h-4 text-gray-600 ${
                      isRefreshing ? "animate-spin text-brand-600" : ""
                    }`}
                  />
                  <span>Refresh</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* EXECUTIVE QUICK METRIC CARDS (High Contrast White) */}
        {/* ========================================================= */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Hierarchy Rank */}
          <div className="p-5 rounded-2xl bg-white border-2 border-gray-200 shadow-xs flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-indigo-50 border-2 border-indigo-200 text-indigo-700 shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Hierarchy Tier
              </p>
              <p className="text-sm font-extrabold text-gray-900 truncate mt-0.5">
                {hierarchy.title}
              </p>
              <p className="text-xs font-semibold text-indigo-700 capitalize">
                Level: {user.accessLevel?.replace("_", " ") || "Default"}
              </p>
            </div>
          </div>

          {/* Card 2: Operating Unit */}
          <div className="p-5 rounded-2xl bg-white border-2 border-gray-200 shadow-xs flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-sky-50 border-2 border-sky-200 text-sky-700 shrink-0">
              <Building className="w-6 h-6" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Operating Unit
              </p>
              <p className="text-sm font-extrabold text-gray-900 truncate mt-0.5">
                {user.department?.name || user.organization?.name || "General Directorate"}
              </p>
              <p className="text-xs font-semibold text-sky-700">
                {user.organizationType === "head_office" ? "National Command" : "Field Branch"}
              </p>
            </div>
          </div>

          {/* Card 3: Auth Security */}
          <div className="p-5 rounded-2xl bg-white border-2 border-gray-200 shadow-xs flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-50 border-2 border-emerald-200 text-emerald-700 shrink-0">
              <KeyRound className="w-6 h-6" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Authentication
              </p>
              <p className="text-sm font-extrabold text-gray-900 truncate mt-0.5 capitalize">
                {user.authProvider || "Local Password"}
              </p>
              <p className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Encrypted Session
              </p>
            </div>
          </div>

          {/* Card 4: Last Activity */}
          <div className="p-5 rounded-2xl bg-white border-2 border-gray-200 shadow-xs flex items-center gap-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-amber-50 border-2 border-amber-200 text-amber-700 shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                Last Activity
              </p>
              <p className="text-sm font-extrabold text-gray-900 truncate mt-0.5">
                {user.lastLogin
                  ? new Date(user.lastLogin).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Active Now"}
              </p>
              <p className="text-xs font-semibold text-amber-800">
                {user.createdAt ? `Joined ${new Date(user.createdAt).getFullYear()}` : "IDRMIS System"}
              </p>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* HIGH-CONTRAST TAB CONTROLS */}
        {/* ========================================================= */}
        <div className="flex items-center gap-3 border-b-2 border-gray-200 pb-px">
          <button
            type="button"
            onClick={() => setActiveTab("info")}
            className={`relative flex items-center gap-2 px-5 py-3.5 text-sm font-extrabold transition-all cursor-pointer ${
              activeTab === "info"
                ? "text-brand-600 border-b-4 border-brand-600 bg-brand-50/50 rounded-t-xl"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-t-xl"
            }`}
          >
            <User className="w-4 h-4" />
            <span>Personal & Location</span>
            {hasInfoChanges && (
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" title="Unsaved changes" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("access")}
            className={`relative flex items-center gap-2 px-5 py-3.5 text-sm font-extrabold transition-all cursor-pointer ${
              activeTab === "access"
                ? "text-brand-600 border-b-4 border-brand-600 bg-brand-50/50 rounded-t-xl"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-t-xl"
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Organization & Privileges</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("security")}
            className={`relative flex items-center gap-2 px-5 py-3.5 text-sm font-extrabold transition-all cursor-pointer ${
              activeTab === "security"
                ? "text-brand-600 border-b-4 border-brand-600 bg-brand-50/50 rounded-t-xl"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-t-xl"
            }`}
          >
            <Lock className="w-4 h-4" />
            <span>Security & Password</span>
          </button>
        </div>

        {/* ========================================================= */}
        {/* TAB 1: PERSONAL & CONTACT INFORMATION */}
        {/* ========================================================= */}
        {activeTab === "info" && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Main Form (2 Columns) */}
            <div className="lg:col-span-2 rounded-2xl border-2 border-gray-200 bg-white p-6 lg:p-8 shadow-xs">
              <div className="flex items-center justify-between pb-4 mb-6 border-b border-gray-200">
                <div>
                  <h3 className="text-xl font-extrabold text-gray-900">
                    Edit Personal Information
                  </h3>
                  <p className="text-xs font-semibold text-gray-600 mt-0.5">
                    Update your official name and contact telephone credentials.
                  </p>
                </div>
                {hasInfoChanges && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" /> Unsaved Changes
                  </span>
                )}
              </div>

              <form onSubmit={handleSaveInfo} className="space-y-6">
                {/* Full Name */}
                <div>
                  <label className="block text-xs font-extrabold text-gray-900 uppercase tracking-wider mb-2">
                    Full Official Name <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={fullname}
                      onChange={(e) => handleInfoChange("fullname", e.target.value)}
                      required
                      placeholder="e.g. Abebe Kebede"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-gray-300 bg-white text-sm font-bold text-gray-900 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 transition-all outline-hidden"
                    />
                  </div>
                </div>

                {/* Email & Phone Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-extrabold text-gray-900 uppercase tracking-wider mb-2">
                      Email Address <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                        <Mail className="w-4 h-4" />
                      </div>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => handleInfoChange("email", e.target.value)}
                        required
                        placeholder="user@drm.gov.et"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-gray-300 bg-white text-sm font-bold text-gray-900 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 transition-all outline-hidden"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-gray-900 uppercase tracking-wider mb-2">
                      Official Phone Number
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                        <Phone className="w-4 h-4" />
                      </div>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => handleInfoChange("phone", e.target.value)}
                        placeholder="+251 91 123 4567"
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-gray-300 bg-white text-sm font-bold text-gray-900 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 transition-all outline-hidden"
                      />
                    </div>
                  </div>
                </div>

                {/* ========================================================= */}
                {/* ADMINISTRATIVE DUTY LOCATION (ALL DISABLED & LOCKED) */}
                {/* ========================================================= */}
                <div className="pt-6 border-t-2 border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-extrabold uppercase tracking-wider text-gray-900 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-brand-600" /> Administrative Duty Location
                    </h4>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                      <Lock className="w-3.5 h-3.5 text-amber-700" /> Admin Restricted
                    </span>
                  </div>

                  {/* Lock Advisory Notice */}
                  <div className="mb-5 flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 border-2 border-amber-200 text-amber-950 text-xs font-medium leading-relaxed">
                    <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-extrabold text-amber-900">
                        Territorial Jurisdiction is Locked by System Policy
                      </p>
                      <p className="mt-0.5 text-amber-800">
                        Administrative duty location fields are strictly configured by <strong>Super Administrators</strong> or <strong>Branch Administrators</strong>. Modifying subcity or woreda assignments directly would invalidate your role-based data scope and granted permissions.
                      </p>
                    </div>
                  </div>

                  {/* Disabled Administrative Inputs Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    {/* Subcity (Disabled) */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-extrabold text-gray-700">
                          Subcity Assignment
                        </label>
                        <span className="text-[11px] font-bold text-gray-500 flex items-center gap-1">
                          <Lock className="w-3 h-3 text-gray-500" /> Read-only
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          disabled
                          readOnly
                          value={user.subcity ? `${user.subcity} Subcity` : "City-wide / Head Office Jurisdiction"}
                          className="w-full px-3.5 py-2.5 rounded-xl border-2 border-gray-200 bg-gray-100 text-sm font-bold text-gray-800 cursor-not-allowed select-none outline-hidden"
                        />
                      </div>
                    </div>

                    {/* Woreda / Kebele (Disabled) */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-extrabold text-gray-700">
                          Woreda / Kebele
                        </label>
                        <span className="text-[11px] font-bold text-gray-500 flex items-center gap-1">
                          <Lock className="w-3 h-3 text-gray-500" /> Read-only
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          disabled
                          readOnly
                          value={user.kebele || "All Woredas in Subcity"}
                          className="w-full px-3.5 py-2.5 rounded-xl border-2 border-gray-200 bg-gray-100 text-sm font-bold text-gray-800 cursor-not-allowed select-none outline-hidden"
                        />
                      </div>
                    </div>

                    {/* Country (Disabled) */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-extrabold text-gray-700">
                          Country
                        </label>
                        <span className="text-[11px] font-bold text-gray-500 flex items-center gap-1">
                          <Lock className="w-3 h-3 text-gray-500" /> Read-only
                        </span>
                      </div>
                      <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border-2 border-gray-200 bg-gray-100 text-sm font-bold text-gray-800 cursor-not-allowed select-none">
                        <span className="text-base">🇪🇹</span>
                        <span>Ethiopia</span>
                      </div>
                    </div>

                    {/* City (Disabled) */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-extrabold text-gray-700">
                          Command Center City
                        </label>
                        <span className="text-[11px] font-bold text-gray-500 flex items-center gap-1">
                          <Lock className="w-3 h-3 text-gray-500" /> Read-only
                        </span>
                      </div>
                      <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border-2 border-gray-200 bg-gray-100 text-sm font-bold text-gray-800 cursor-not-allowed select-none">
                        <Building className="w-4 h-4 text-gray-500" />
                        <span>Addis Ababa</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Form Action Buttons */}
                <div className="flex items-center justify-between pt-5 border-t-2 border-gray-200">
                  <button
                    type="button"
                    onClick={handleResetInfo}
                    disabled={!hasInfoChanges || isSavingInfo}
                    className="inline-flex items-center gap-1.5 text-xs font-extrabold text-gray-600 hover:text-gray-900 disabled:opacity-40 cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset Changes
                  </button>

                  <button
                    type="submit"
                    disabled={isSavingInfo || !hasInfoChanges}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-extrabold shadow-md hover:bg-brand-700 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    {isSavingInfo ? "Saving Changes..." : "Save Personal Info"}
                  </button>
                </div>
              </form>
            </div>

            {/* Sidebar Cards (1 Column) */}
            <div className="space-y-6">
              {/* Summary Card */}
              <div className="rounded-2xl border-2 border-gray-200 bg-white p-6 shadow-xs">
                <h4 className="text-sm font-extrabold text-gray-900 mb-4 flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-brand-600" /> Official Identity Summary
                </h4>
                <div className="space-y-3 text-xs">
                  <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                    <span className="font-bold text-gray-600">Account ID</span>
                    <div className="flex items-center gap-1.5 font-mono font-bold text-gray-900">
                      <span>{userId ? `${userId.slice(0, 10)}...` : "-"}</span>
                      <button
                        type="button"
                        onClick={handleCopyId}
                        className="p-1 text-gray-500 hover:text-brand-600 cursor-pointer"
                        title="Copy full ID"
                      >
                        {copiedId ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600 font-bold" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                    <span className="font-bold text-gray-600">Assigned Commission</span>
                    <span className="font-extrabold text-gray-900 text-right truncate max-w-[170px]">
                      {user.organization?.name || "DRM Commission"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                    <span className="font-bold text-gray-600">Department</span>
                    <span className="font-extrabold text-gray-900 text-right truncate max-w-[170px]">
                      {user.department?.name || "General Assessment"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pb-2 border-b border-gray-200">
                    <span className="font-bold text-gray-600">Territory</span>
                    <span className="font-extrabold text-brand-700 text-right truncate max-w-[170px]">
                      {user.subcity ? `${user.subcity} Subcity` : "City-wide Head Office"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-600">Account Status</span>
                    <span className="inline-flex items-center gap-1.5 font-extrabold text-emerald-800">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                      Active & Verified
                    </span>
                  </div>
                </div>
              </div>

              {/* Update Photo Quick Card */}
              <div className="rounded-2xl border-2 border-brand-200 bg-brand-50/40 p-6 shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-xl bg-brand-600 text-white shrink-0">
                    <Camera className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-gray-900">
                      Profile Headshot
                    </h4>
                    <p className="text-xs font-semibold text-gray-700 mt-1 leading-relaxed">
                      Your headshot is visible across emergency assessment forms, incident tracking logs, and administrative review consoles.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsAvatarModalOpen(true)}
                      className="mt-3.5 inline-flex items-center gap-1.5 text-xs font-extrabold text-brand-700 hover:text-brand-800 underline decoration-2 cursor-pointer"
                    >
                      Update Profile Photo <Sparkles className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: ORGANIZATION & PRIVILEGES */}
        {/* ========================================================= */}
        {activeTab === "access" && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="space-y-6"
          >
            {/* Structural Assignment Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Commission Card */}
              <div className="rounded-2xl border-2 border-gray-200 bg-white p-5 shadow-xs space-y-2">
                <div className="flex items-center gap-2 text-brand-700 font-extrabold text-sm">
                  <Building className="w-5 h-5 text-brand-600" />
                  <h4>Assigned Commission</h4>
                </div>
                <p className="text-base font-extrabold text-gray-900">
                  {user.organization?.name || "Federal DRM Commission"}
                </p>
                <p className="text-xs font-semibold text-gray-600">
                  Structure:{" "}
                  {user.organizationType === "head_office"
                    ? "Head Office (National Command)"
                    : "Subcity Territorial Branch"}
                </p>
              </div>

              {/* Department Card */}
              <div className="rounded-2xl border-2 border-gray-200 bg-white p-5 shadow-xs space-y-2">
                <div className="flex items-center gap-2 text-indigo-700 font-extrabold text-sm">
                  <Layers className="w-5 h-5 text-indigo-600" />
                  <h4>Directorate & Sector</h4>
                </div>
                <p className="text-base font-extrabold text-gray-900">
                  {user.department?.name || "Disaster Risk Assessment Directorate"}
                </p>
                <p className="text-xs font-semibold text-gray-600">
                  Sector: {user.sector?.name || "Emergency Preparedness & Early Warning"}
                </p>
              </div>

              {/* Hierarchy Rank Card */}
              <div className="rounded-2xl border-2 border-gray-200 bg-white p-5 shadow-xs space-y-2">
                <div className="flex items-center gap-2 text-emerald-800 font-extrabold text-sm">
                  <Award className="w-5 h-5 text-emerald-600" />
                  <h4>Hierarchy Rank</h4>
                </div>
                <p className="text-base font-extrabold text-gray-900">
                  {hierarchy.title}
                </p>
                <p className="text-xs font-semibold text-gray-600">
                  Authority Scope:{" "}
                  {user.organizationType === "head_office" ? "City-Wide Access" : "Subcity Branch Jurisdiction"}
                </p>
              </div>
            </div>

            {/* Assigned RBAC Roles */}
            <div className="rounded-2xl border-2 border-gray-200 bg-white p-6 shadow-xs">
              <h3 className="text-base font-extrabold text-gray-900 mb-1 flex items-center gap-2">
                <Shield className="w-5 h-5 text-brand-600" />
                Assigned RBAC Security Roles
              </h3>
              <p className="text-xs font-semibold text-gray-600 mb-5">
                Roles define your authority to view, create, edit, approve, and audit disaster management datasets.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {user.roles && user.roles.length > 0 ? (
                  user.roles.map((role) => (
                    <div
                      key={role.id || role.name}
                      className="p-4 rounded-xl border-2 border-gray-200 bg-gray-50 flex items-start gap-3"
                    >
                      <div className="p-2 rounded-lg bg-brand-100 text-brand-700 shrink-0">
                        <ShieldCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-gray-900">
                          {role.name}
                        </h4>
                        <p className="text-xs font-semibold text-gray-600 mt-0.5">
                          Operational security role assigned by Commission Administrator.
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs font-semibold text-gray-500 italic">No specific roles assigned.</p>
                )}
              </div>
            </div>

            {/* Granted System Permissions */}
            <div className="rounded-2xl border-2 border-gray-200 bg-white p-6 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-gray-200">
                <div>
                  <h3 className="text-base font-extrabold text-gray-900 flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-amber-600" />
                    Granted Operational Permissions ({permissionsList.length})
                  </h3>
                  <p className="text-xs font-semibold text-gray-600">
                    Granular system capabilities permitted for your account.
                  </p>
                </div>

                {permissionsList.length > 0 && (
                  <div className="w-full sm:w-64">
                    <input
                      type="text"
                      placeholder="Filter permissions..."
                      value={permissionSearch}
                      onChange={(e) => setPermissionSearch(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs font-bold rounded-xl border-2 border-gray-300 bg-white text-gray-900 outline-hidden focus:border-brand-600"
                    />
                  </div>
                )}
              </div>

              <div className="pt-5">
                {filteredPermissions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {filteredPermissions.map((perm) => (
                      <span
                        key={perm}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-50 text-gray-900 border-2 border-gray-200"
                      >
                        <Check className="w-3.5 h-3.5 text-brand-600 stroke-[3]" />
                        <span className="font-mono text-[11px]">{perm}</span>
                      </span>
                    ))}
                  </div>
                ) : permissionsList.length > 0 ? (
                  <p className="text-xs font-bold text-gray-500 italic">
                    No permissions matching "{permissionSearch}"
                  </p>
                ) : (
                  <p className="text-xs font-bold text-gray-500 italic">
                    Standard viewer privileges.
                  </p>
                )}
              </div>

              <div className="mt-6 flex items-start gap-2.5 p-3.5 rounded-xl bg-blue-50 border-2 border-blue-200 text-blue-950 text-xs font-medium">
                <HelpCircle className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                <p>
                  To request additional permissions or adjust administrative branch jurisdiction, please submit a formal request to your IDRMIS Super Administrator.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: SECURITY & PASSWORD */}
        {/* ========================================================= */}
        {activeTab === "security" && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          >
            {/* Password Form (2 Columns) */}
            <div className="lg:col-span-2 rounded-2xl border-2 border-gray-200 bg-white p-6 lg:p-8 shadow-xs">
              <div className="pb-4 mb-6 border-b-2 border-gray-200">
                <h3 className="text-xl font-extrabold text-gray-900 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-brand-600" /> Change Account Password
                </h3>
                <p className="text-xs font-semibold text-gray-600 mt-1">
                  Ensure your account uses a secure password to prevent unauthorized access to sensitive disaster response data.
                </p>
              </div>

              <form onSubmit={handlePasswordChange} className="space-y-5">
                {/* Current Password */}
                <div>
                  <label className="block text-xs font-extrabold text-gray-900 uppercase tracking-wider mb-2">
                    Current Password <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                      <KeyRound className="w-4 h-4" />
                    </div>
                    <input
                      type={showCurrentPass ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      placeholder="Enter current password"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border-2 border-gray-300 bg-white text-sm font-bold text-gray-900 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 transition-all outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPass(!showCurrentPass)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-500 hover:text-gray-800 cursor-pointer"
                    >
                      {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* New Password & Confirm Password */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-extrabold text-gray-900 uppercase tracking-wider mb-2">
                      New Password <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showNewPass ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        placeholder="At least 6 characters"
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl border-2 border-gray-300 bg-white text-sm font-bold text-gray-900 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 transition-all outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-500 hover:text-gray-800 cursor-pointer"
                      >
                        {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-extrabold text-gray-900 uppercase tracking-wider mb-2">
                      Confirm New Password <span className="text-rose-600">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                        <Lock className="w-4 h-4" />
                      </div>
                      <input
                        type={showConfirmPass ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        placeholder="Re-type new password"
                        className="w-full pl-10 pr-10 py-2.5 rounded-xl border-2 border-gray-300 bg-white text-sm font-bold text-gray-900 focus:border-brand-600 focus:ring-2 focus:ring-brand-500/20 transition-all outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPass(!showConfirmPass)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-500 hover:text-gray-800 cursor-pointer"
                      >
                        {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Password Strength Indicator */}
                {newPassword && (
                  <div className="p-4 rounded-xl bg-gray-50 border-2 border-gray-200 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-gray-800">
                      <span>Password Strength</span>
                      <span
                        className={`font-extrabold ${
                          passScore >= 3
                            ? "text-emerald-700"
                            : passScore === 2
                            ? "text-amber-700"
                            : "text-rose-700"
                        }`}
                      >
                        {passScore >= 3 ? "Strong" : passScore === 2 ? "Moderate" : "Weak"}
                      </span>
                    </div>

                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          passScore >= 3
                            ? "w-full bg-emerald-500"
                            : passScore === 2
                            ? "w-2/3 bg-amber-500"
                            : "w-1/3 bg-rose-500"
                        }`}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 text-xs font-bold">
                      <div
                        className={`flex items-center gap-1.5 ${
                          passLengthOk ? "text-emerald-700" : "text-gray-500"
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" /> Minimum 6 characters
                      </div>
                      <div
                        className={`flex items-center gap-1.5 ${
                          passHasNumberOrSpecial ? "text-emerald-700" : "text-gray-500"
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" /> Number or symbol
                      </div>
                      <div
                        className={`flex items-center gap-1.5 ${
                          passHasUpperAndLower ? "text-emerald-700" : "text-gray-500"
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" /> Upper & lowercase
                      </div>
                      <div
                        className={`flex items-center gap-1.5 ${
                          passMatch ? "text-emerald-700" : "text-gray-500"
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" /> Passwords match
                      </div>
                    </div>
                  </div>
                )}

                {/* Submit Action */}
                <div className="flex items-center justify-end pt-5 border-t-2 border-gray-200">
                  <button
                    type="submit"
                    disabled={isChangingPass || !currentPassword || !newPassword || !confirmPassword}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-extrabold shadow-md hover:bg-brand-700 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <KeyRound className="w-4 h-4" />
                    {isChangingPass ? "Updating Password..." : "Update Password"}
                  </button>
                </div>
              </form>
            </div>

            {/* Security Overview (1 Column) */}
            <div className="space-y-6">
              <div className="rounded-2xl border-2 border-gray-200 bg-white p-6 shadow-xs">
                <h4 className="text-sm font-extrabold text-gray-900 mb-4 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" /> Account Security Status
                </h4>

                <div className="space-y-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-emerald-50 border-2 border-emerald-200 text-emerald-950">
                    <p className="font-extrabold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Account Protected
                    </p>
                    <p className="mt-1 text-xs font-semibold text-emerald-900">
                      Your identity is secured with verified sessions and strict role-based data isolation.
                    </p>
                  </div>

                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between font-bold text-gray-600">
                      <span>Auth Provider</span>
                      <span className="font-extrabold text-gray-900 capitalize">
                        {user.authProvider || "Local DB"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between font-bold text-gray-600">
                      <span>Created On</span>
                      <span className="font-extrabold text-gray-900">
                        {user.createdAt
                          ? new Date(user.createdAt).toLocaleDateString()
                          : "Verified"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between font-bold text-gray-600">
                      <span>Verification State</span>
                      <span className="font-extrabold text-emerald-700">
                        Active & Verified
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Guidelines */}
              <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5 text-xs text-amber-950 space-y-2">
                <div className="flex items-center gap-2 font-extrabold text-amber-900">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>Security Notice</span>
                </div>
                <p className="text-xs font-semibold leading-relaxed text-amber-900">
                  Official disaster management accounts must not share credentials across unmonitored devices. Always sign out after finishing incident response shifts.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Avatar Modal */}
      <ProfileAvatarModal
        isOpen={isAvatarModalOpen}
        onClose={() => setIsAvatarModalOpen(false)}
        currentImage={user.profileImage}
        userId={userId}
      />
    </>
  );
}
