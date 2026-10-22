import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useSidebar } from "../context/SidebarContext";
import { ThemeToggleButton } from "../components/common/ThemeToggleButton";
import NotificationDropdown from "../components/header/NotificationDropdown";
import UserDropdown from "../components/header/UserDropdown";
import { HelpCenterModal } from "../components/header/HelpCenterModal";
import { usePortalContent } from "@/hooks/usePortalContent";
import { resolvePortalAssetUrl } from "@/utils/resolvePortalAssetUrl";
import { useAuth } from "../context/AuthContext";
import {
  HelpCircle,
  Search,
  FileText,
  Users,
  Settings,
  ArrowRight,
  ShieldAlert,
  Map,
  BarChart3,
  Flame,
  Menu,
  X,
  Compass,
  Building,
  Layers,
  FolderOpen,
  AlertCircle,
  ClipboardList,
} from "lucide-react";

interface SearchItem {
  title: string;
  category: string;
  path: string;
  icon: React.ReactNode;
  permission?: string;
  badge?: string;
}

const SEARCH_MODULES: SearchItem[] = [
  {
    title: "Executive Dashboard",
    category: "Monitoring",
    path: "/",
    icon: <BarChart3 className="w-4 h-4 text-brand-600" />,
    permission: "dashboard_view",
  },
  {
    title: "Live Operations & GIS Map",
    category: "Monitoring",
    path: "/live-dashboard",
    icon: <Compass className="w-4 h-4 text-emerald-600" />,
    permission: "woredaprofile_view|incidentreport_view|dashboard_view",
  },
  {
    title: "Incident Reports & Dispatch",
    category: "Emergency Operations",
    path: "/admin/incident-reports",
    icon: <Flame className="w-4 h-4 text-rose-600" />,
    permission: "incidentreport_view",
    badge: "INCIDENTS",
  },
  {
    title: "Woreda Hazard & Risk Profiles",
    category: "Risk Assessment",
    path: "/woreda-profiles",
    icon: <Map className="w-4 h-4 text-indigo-600" />,
    permission: "woredaprofile_view",
  },
  {
    title: "Woreda Geographic Risk Map",
    category: "Risk Assessment",
    path: "/woreda-profile-maps",
    icon: <Compass className="w-4 h-4 text-teal-600" />,
    permission: "woredaprofile_view",
  },
  {
    title: "Form Response Explorer",
    category: "Field Data",
    path: "/response-explorer",
    icon: <FileText className="w-4 h-4 text-sky-600" />,
    permission: "formresponse_view",
  },
  {
    title: "Organizations & Branches",
    category: "Organizational Structure",
    path: "/admin/organizations",
    icon: <Building className="w-4 h-4 text-blue-600" />,
    permission: "organization_view",
  },
  {
    title: "Sectors & Divisions",
    category: "Organizational Structure",
    path: "/admin/sectors",
    icon: <Layers className="w-4 h-4 text-cyan-600" />,
    permission: "sector_view",
  },
  {
    title: "Departments & Directorates",
    category: "Organizational Structure",
    path: "/admin/departments",
    icon: <FolderOpen className="w-4 h-4 text-indigo-600" />,
    permission: "department_view",
  },
  {
    title: "Teams & Units",
    category: "Organizational Structure",
    path: "/admin/teams",
    icon: <Users className="w-4 h-4 text-teal-600" />,
    permission: "team_view",
  },
  {
    title: "User Management Directory",
    category: "Administration & Security",
    path: "/admin/users",
    icon: <Users className="w-4 h-4 text-purple-600" />,
    permission: "user_view",
  },
  {
    title: "Security Roles Directory",
    category: "Administration & Security",
    path: "/admin/roles",
    icon: <ShieldAlert className="w-4 h-4 text-amber-600" />,
    permission: "role_view",
  },
  {
    title: "Permissions Directory",
    category: "Administration & Security",
    path: "/admin/permissions",
    icon: <ShieldAlert className="w-4 h-4 text-amber-600" />,
    permission: "permission_view",
  },
  {
    title: "Concern Reports",
    category: "Public Safety",
    path: "/admin/concern-reports",
    icon: <AlertCircle className="w-4 h-4 text-orange-600" />,
    permission: "concernreport_view",
  },
  {
    title: "Inspection Requests",
    category: "Field Operations",
    path: "/inspection",
    icon: <ClipboardList className="w-4 h-4 text-emerald-600" />,
    permission: "inspectionrequest_view",
  },
  {
    title: "My User Profile & Security",
    category: "Account Settings",
    path: "/profile",
    icon: <Settings className="w-4 h-4 text-gray-700 dark:text-gray-300" />,
    // Permitted to all authenticated users
  },
];

const AppHeader: React.FC = () => {
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isSearchPaletteOpen, setIsSearchPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);

  const { portalContent } = usePortalContent();
  const { user } = useAuth();
  const navigate = useNavigate();

  const logoUrl =
    resolvePortalAssetUrl(portalContent?.branding?.logoUrl) || "/images/logo/logo.png";
  const orgName =
    portalContent?.branding?.orgName ||
    portalContent?.branding?.portalName ||
    "IDRMIS";

  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();

  const handleToggle = () => {
    if (window.innerWidth >= 1024) {
      toggleSidebar();
    } else {
      toggleMobileSidebar();
    }
  };

  // Sticky Scroll Elevation Effect
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 8);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Keyboard shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setIsSearchPaletteOpen(true);
      }
      if (event.key === "Escape") {
        setIsSearchPaletteOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Permission check for search items
  const checkPermission = (permission?: string) => {
    if (!user) return false;

    // Super Admin has all permissions
    const isSuperAdmin =
      user.accessLevel === "super_admin" ||
      user.roles?.some((r) =>
        ["superadmin", "super admin", "super_admin"].includes(
          (r.name || "").toLowerCase()
        )
      );
    if (isSuperAdmin) return true;

    // No permission specified means accessible to all logged-in users (e.g. My Profile)
    if (!permission) return true;

    // Normalize user permissions array
    const userPerms =
      user.permissions?.map((p: any) =>
        (typeof p === "string" ? p : p?.name || "").toLowerCase()
      ) || [];

    if (permission.includes("|")) {
      const perms = permission.split("|").map((p) => p.trim().toLowerCase());
      return perms.some((p) => userPerms.includes(p));
    }

    return userPerms.includes(permission.toLowerCase());
  };

  // Filter modules strictly based on user permissions
  const permittedModules = SEARCH_MODULES.filter((item) =>
    checkPermission(item.permission)
  );

  // Filter permitted modules by query
  const filteredSearchItems = permittedModules.filter(
    (item) =>
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectModule = (path: string) => {
    setIsSearchPaletteOpen(false);
    setSearchQuery("");
    navigate(path);
  };

  return (
    <>
      <header
        className={`sticky top-0 z-40 flex w-full transition-all duration-200 ${
          isScrolled
            ? "bg-white/95 dark:bg-gray-900/95 backdrop-blur-md shadow-xs border-b border-gray-200 dark:border-gray-800"
            : "bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800"
        }`}
      >
        <div className="flex items-center justify-between w-full h-16 px-3 sm:px-5 lg:px-6 min-w-0">
          {/* ========================================================= */}
          {/* LEFT: Sidebar Toggle & Compact Responsive Search */}
          {/* ========================================================= */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
            {/* Sidebar toggle button */}
            <button
              onClick={handleToggle}
              className="flex items-center justify-center w-10 h-10 text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 hover:text-gray-900 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 shadow-2xs transition-colors cursor-pointer shrink-0"
              aria-label="Toggle Navigation Sidebar"
              title="Toggle Sidebar"
            >
              {isMobileOpen ? (
                <X className="w-5 h-5 text-gray-700 dark:text-gray-200" />
              ) : (
                <Menu className="w-5 h-5 text-gray-700 dark:text-gray-200" />
              )}
            </button>

            {/* Mobile Brand Logo */}
            <Link to="/" className="lg:hidden flex items-center gap-2 shrink-0">
              <img className="h-8 w-8 object-contain" src={logoUrl} alt="Logo" />
              <span className="text-sm font-extrabold text-gray-900 dark:text-white truncate max-w-[120px] sm:max-w-[160px]">
                {orgName}
              </span>
            </Link>

            {/* Simple, Beautiful Search Bar (Auto-fits comfortably) */}
            <div className="hidden sm:block">
              <button
                type="button"
                onClick={() => setIsSearchPaletteOpen(true)}
                className="flex items-center justify-between w-48 md:w-60 lg:w-72 h-10 px-3 text-xs font-medium text-gray-500 bg-gray-50 hover:bg-gray-100/80 border border-gray-200 rounded-xl dark:bg-gray-800/50 dark:border-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 transition-all cursor-pointer group shadow-2xs"
              >
                <div className="flex items-center gap-2 min-w-0 truncate text-gray-500 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200">
                  <Search className="w-4 h-4 text-gray-400 group-hover:text-brand-600 dark:group-hover:text-brand-400 shrink-0" />
                  <span className="font-semibold text-gray-600 dark:text-gray-300 truncate">
                    Search permitted modules...
                  </span>
                </div>
                <div className="flex items-center gap-0.5 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 shadow-2xs shrink-0">
                  <span>⌘</span>
                  <span>K</span>
                </div>
              </button>
            </div>
          </div>

          {/* ========================================================= */}
          {/* RIGHT: Essential Controls (Guaranteed Visible & Anchored) */}
          {/* ========================================================= */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 ml-2">
            {/* Mobile Search Icon Button */}
            <button
              onClick={() => setIsSearchPaletteOpen(true)}
              className="sm:hidden flex items-center justify-center w-10 h-10 text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 shadow-2xs cursor-pointer"
              title="Search Modules"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Help Center Button */}
            <button
              onClick={() => setIsHelpOpen(true)}
              className="flex items-center justify-center w-10 h-10 text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-blue-400 shadow-2xs transition-colors cursor-pointer"
              title="Help & Knowledge Base"
              aria-label="Open Help Center"
            >
              <HelpCircle className="w-4 h-4" />
            </button>

            {/* Theme Toggle (Dark / Light) */}
            <ThemeToggleButton />

            {/* Notification Bell */}
            <NotificationDropdown />

            {/* Subtle Divider */}
            <div className="h-6 w-px bg-gray-200 dark:bg-gray-800 mx-0.5 sm:mx-1" />

            {/* User Profile Dropdown (Never hidden, safely anchored) */}
            <div className="shrink-0">
              <UserDropdown />
            </div>
          </div>
        </div>
      </header>

      {/* ========================================================= */}
      {/* SEARCH COMMAND PALETTE (PERMITTED MODULES ONLY) */}
      {/* ========================================================= */}
      {isSearchPaletteOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/50 backdrop-blur-xs">
          <div
            className="fixed inset-0"
            onClick={() => setIsSearchPaletteOpen(false)}
          />
          <div className="relative w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 shadow-2xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150">
            {/* Search Input Bar */}
            <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-200 dark:border-gray-800">
              <Search className="w-5 h-5 text-gray-400 shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder="Search modules you have permission to view..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-transparent text-sm font-bold text-gray-900 dark:text-white placeholder:text-gray-400 outline-hidden"
              />
              <button
                onClick={() => setIsSearchPaletteOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-gray-100 dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-700">
                  ESC
                </kbd>
              </button>
            </div>

            {/* Filtered Permitted Results */}
            <div className="max-h-80 overflow-y-auto p-2 space-y-1">
              {filteredSearchItems.length > 0 ? (
                filteredSearchItems.map((item) => (
                  <button
                    key={item.path}
                    onClick={() => handleSelectModule(item.path)}
                    className="flex items-center justify-between w-full px-3.5 py-2.5 rounded-xl text-left hover:bg-brand-50/70 dark:hover:bg-brand-950/40 transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 group-hover:bg-white dark:group-hover:bg-gray-700 shadow-2xs shrink-0">
                        {item.icon}
                      </div>
                      <div className="min-w-0 truncate">
                        <p className="text-xs font-bold text-gray-900 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-400 truncate">
                          {item.title}
                        </p>
                        <p className="text-[10px] font-medium text-gray-500 dark:text-gray-400">
                          {item.category}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {item.badge && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300 border border-rose-300">
                          {item.badge}
                        </span>
                      )}
                      <ArrowRight className="w-3.5 h-3.5 text-gray-400 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-6 text-center text-xs font-semibold text-gray-500">
                  {searchQuery
                    ? `No permitted modules matching "${searchQuery}"`
                    : "No permitted modules available for your account"}
                </div>
              )}
            </div>

            {/* Command Palette Footer */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-800 text-[11px] text-gray-500 font-medium">
              <span className="text-[10px]">Showing only modules authorized for your role</span>
              <span className="font-bold text-brand-600">IDRMIS Portal</span>
            </div>
          </div>
        </div>
      )}

      {/* Interactive Help Center Modal */}
      <HelpCenterModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </>
  );
};

export default AppHeader;
