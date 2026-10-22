import { useState, useEffect, useMemo, useRef } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { getOrganizations } from "../../api/organizationService";
import { getDepartments, Department } from "../../api/departmentService";
import { getTeams, Team } from "../../api/teamService";
import api from "../../api/axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  Layers,
  Briefcase,
  Users,
  Search,
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Info,
  MapPin,
  Network,
  Maximize2,
  Minimize2,
  Download,
  Loader2,
} from "lucide-react";
import { toast } from "react-toastify";
import { toPng } from "html-to-image";

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

// Interfaces
interface Organization {
  id: string;
  name: string;
  type: string;
  parentId?: string | { id: string; name: string } | null;
  subcityName?: string;
  branchCode?: string;
}

interface Sector {
  id: string;
  name: string;
  organizationId: string;
}

interface TeamNode {
  type: "team";
  id: string;
  name: string;
  data: Team;
}

interface DeptNode {
  type: "department";
  id: string;
  name: string;
  data: Department;
  children: TeamNode[];
}

interface SectorNode {
  type: "sector";
  id: string;
  name: string;
  data: Sector;
  children: DeptNode[];
}

interface OrgNode {
  type: "organization";
  id: string;
  name: string;
  data: Organization;
  children: (OrgNode | SectorNode | DeptNode)[];
}

type TreeNodeType = OrgNode | SectorNode | DeptNode | TeamNode;

// Node Theme and Styling Configurations
const getNodeConfig = (type: TreeNodeType["type"], isHeadOffice = false) => {
  switch (type) {
    case "organization":
      if (isHeadOffice) {
        return {
          icon: <Building2 size={20} className="text-white" />,
          badge: "HEAD OFFICE",
          badgeClass: "bg-amber-400 text-slate-950 font-black",
          containerClass:
            "border-brand-500/50 bg-gradient-to-br from-slate-900 via-brand-900 to-indigo-950 text-white shadow-2xl shadow-brand-900/30",
          iconBox: "bg-white/15 text-white",
          labelClass: "text-amber-300 font-bold",
        };
      }
      return {
        icon: <Building2 size={18} className="text-blue-600 dark:text-blue-400" />,
        badge: "BRANCH ORG",
        badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200",
        containerClass:
          "border-blue-200/90 bg-white/90 text-slate-900 shadow-xl dark:border-blue-800/40 dark:bg-slate-900/90 dark:text-white",
        iconBox: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
        labelClass: "text-blue-600 dark:text-blue-400",
      };
    case "sector":
      return {
        icon: <Layers size={18} className="text-purple-600 dark:text-purple-400" />,
        badge: "SECTOR",
        badgeClass: "bg-purple-100 text-purple-800 dark:bg-purple-900/60 dark:text-purple-200",
        containerClass:
          "border-purple-200/90 bg-white/90 text-slate-900 shadow-lg dark:border-purple-800/40 dark:bg-slate-900/90 dark:text-white",
        iconBox: "bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400",
        labelClass: "text-purple-600 dark:text-purple-400",
      };
    case "department":
      return {
        icon: <Briefcase size={18} className="text-emerald-600 dark:text-emerald-400" />,
        badge: "DEPARTMENT",
        badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200",
        containerClass:
          "border-emerald-200/90 bg-white/90 text-slate-900 shadow-md dark:border-emerald-800/40 dark:bg-slate-900/90 dark:text-white",
        iconBox: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
        labelClass: "text-emerald-600 dark:text-emerald-400",
      };
    case "team":
      return {
        icon: <Users size={16} className="text-amber-600 dark:text-amber-400" />,
        badge: "TACTICAL TEAM",
        badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200",
        containerClass:
          "border-amber-200/90 bg-white/90 text-slate-900 shadow-sm hover:border-amber-400 dark:border-amber-800/40 dark:bg-slate-900/90 dark:text-white",
        iconBox: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
        labelClass: "text-amber-600 dark:text-amber-400",
      };
  }
};

// Tree Branch Component (Top-To-Bottom Recursive Org Chart)
interface TreeBranchProps {
  node: TreeNodeType;
  searchTerm: string;
  expandedMap: Record<string, boolean>;
  onToggle: (id: string) => void;
  onTeamClick: (team: Team) => void;
  level?: number;
}

const TreeBranch = ({
  node,
  searchTerm,
  expandedMap,
  onToggle,
  onTeamClick,
  level = 0,
}: TreeBranchProps) => {
  const children = "children" in node && Array.isArray(node.children) ? node.children : [];
  const hasChildren = children.length > 0;
  const isExpanded = expandedMap[node.id] !== false; // Default expanded unless collapsed

  const isHeadOffice =
    node.type === "organization" &&
    (node.data.type === "head_office" || !node.data.parentId);

  const config = getNodeConfig(node.type, isHeadOffice);

  // Check if current node matches search term
  const isMatch = useMemo(() => {
    if (!searchTerm.trim()) return false;
    const term = searchTerm.toLowerCase();
    return node.name.toLowerCase().includes(term);
  }, [node.name, searchTerm]);

  return (
    <div className="flex flex-col items-center">
      {/* Node Card */}
      <motion.div
        layout
        whileHover={{ scale: 1.02, y: -2 }}
        className={`relative z-10 w-64 min-w-[256px] rounded-2xl border p-4 backdrop-blur-2xl transition-all ${
          config.containerClass
        } ${
          isMatch
            ? "ring-4 ring-amber-400 ring-offset-2 shadow-2xl dark:ring-amber-500"
            : ""
        }`}
      >
        {/* Top Tag & Type */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <span
            className={`rounded-lg px-2 py-0.5 text-[9px] font-black tracking-wider uppercase ${config.badgeClass}`}
          >
            {config.badge}
          </span>

          {node.type === "organization" && node.data.subcityName && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-white/60">
              <MapPin size={10} className="text-primary" />
              {node.data.subcityName}
            </span>
          )}

          {node.type === "team" && (
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
              {node.data.members?.length || 0} members
            </span>
          )}
        </div>

        {/* Node Body */}
        <div className="flex items-center gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl shadow-sm ${config.iconBox}`}
          >
            {config.icon}
          </div>
          <div className="min-w-0 flex-1">
            <h4
              className={`text-sm font-black truncate ${
                isHeadOffice ? "text-white" : "text-slate-900 dark:text-white"
              }`}
              title={node.name}
            >
              {node.name}
            </h4>
            <p
              className={`text-[11px] font-medium truncate ${
                isHeadOffice ? "text-slate-300" : "text-slate-500 dark:text-white/60"
              }`}
            >
              {node.type === "team"
                ? node.data.teamLeader?.fullname
                  ? `Lead: ${node.data.teamLeader.fullname}`
                  : "No leader assigned"
                : node.type === "organization" && node.data.branchCode
                ? `Code: ${node.data.branchCode}`
                : `${children.length} sub-units`}
            </p>
          </div>
        </div>

        {/* Card Actions Footer */}
        <div className="mt-3 flex items-center justify-between border-t border-slate-200/50 pt-2 dark:border-white/10">
          {hasChildren ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggle(node.id);
              }}
              className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1 text-[11px] font-bold transition ${
                isHeadOffice
                  ? "bg-white/20 text-white hover:bg-white/30"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
              }`}
            >
              {isExpanded ? (
                <>
                  <ChevronUp size={13} />
                  <span>Collapse ({children.length})</span>
                </>
              ) : (
                <>
                  <ChevronDown size={13} />
                  <span>Expand ({children.length})</span>
                </>
              )}
            </button>
          ) : (
            <span className="text-[10px] font-medium text-slate-400">Tactical Leaf</span>
          )}

          {node.type === "team" && (
            <button
              type="button"
              onClick={() => onTeamClick(node.data)}
              className="flex items-center gap-1 rounded-xl bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm hover:bg-amber-600 active:scale-95"
            >
              <Info size={11} /> Details
            </button>
          )}
        </div>
      </motion.div>

      {/* Children Tree Branch with Top-To-Bottom Connectors */}
      <AnimatePresence>
        {hasChildren && isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-col items-center"
          >
            {/* Trunk line dropping down from parent node */}
            <div className="h-8 w-[2px] bg-slate-300 dark:bg-white/20" />

            {/* Horizontal Branch Junction & Children Container */}
            <div className="relative flex justify-center items-start pt-8">
              {children.map((child, idx) => {
                const isOnly = children.length === 1;
                const isFirst = idx === 0;
                const isLast = idx === children.length - 1;

                return (
                  <div key={child.id} className="relative flex flex-col items-center px-4">
                    {/* Horizontal Connector Line Segments */}
                    {!isOnly && (
                      <div
                        className="absolute -top-8 h-[2px] bg-slate-300 dark:bg-white/20"
                        style={{
                          left: isFirst ? "50%" : "0%",
                          right: isLast ? "50%" : "0%",
                        }}
                      />
                    )}

                    {/* Vertical Connector Line dropping into child card */}
                    <div className="absolute -top-8 h-8 w-[2px] bg-slate-300 dark:bg-white/20" />

                    {/* Child Recursive Node */}
                    <TreeBranch
                      node={child}
                      searchTerm={searchTerm}
                      expandedMap={expandedMap}
                      onToggle={onToggle}
                      onTeamClick={onTeamClick}
                      level={level + 1}
                    />
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Team Details Modal Component
const TeamDetailsModal = ({
  team,
  onClose,
}: {
  team: Team | null;
  onClose: () => void;
}) => {
  return (
    <AnimatePresence>
      {team && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/50 backdrop-blur-md"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-xl overflow-hidden rounded-[32px] border border-white/40 bg-white/90 p-8 shadow-2xl backdrop-blur-3xl dark:border-white/10 dark:bg-[#1C1C1E]/90"
          >
            <div className="mb-6 flex items-center justify-between border-b border-slate-100 pb-5 dark:border-white/10">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shadow-md">
                  <Users size={24} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                    {team.name}
                  </h3>
                  <p className="text-xs font-semibold text-slate-500 dark:text-white/50">
                    Tactical Team Structural Specification
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 transition-all hover:bg-slate-200 dark:bg-white/5 dark:text-white/40"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-6">
              {team.description && (
                <div className="rounded-2xl bg-slate-50 p-4 dark:bg-white/5">
                  <h4 className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Mission & Scope
                  </h4>
                  <p className="text-sm font-medium text-slate-700 dark:text-white/80">
                    {team.description}
                  </p>
                </div>
              )}

              <div>
                <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Team Leadership
                </h4>
                {team.teamLeader ? (
                  <div className="flex items-center gap-4 rounded-2xl border border-brand-200/80 bg-brand-50/60 p-4 dark:border-brand-500/20 dark:bg-brand-500/10">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white font-black shadow-md">
                      {team.teamLeader.fullname?.charAt(0) || "L"}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white">
                        {team.teamLeader.fullname}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-white/50">
                        {team.teamLeader.email}
                      </p>
                    </div>
                    <div className="ml-auto rounded-lg bg-brand-600 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-white">
                      Lead
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border-2 border-dashed border-slate-200 p-4 text-center text-xs text-slate-400 dark:border-white/10">
                    No leader assigned currently
                  </div>
                )}
              </div>

              <div>
                <h4 className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Deployed Members ({team.members?.length || 0})
                </h4>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 max-h-48 overflow-y-auto pr-1">
                  {team.members?.map((member: any) => (
                    <div
                      key={member.id || member._id}
                      className="flex items-center gap-3 rounded-xl border border-slate-200/70 bg-white/60 p-2.5 shadow-sm dark:border-white/10 dark:bg-white/5"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700 text-xs font-bold dark:bg-white/10 dark:text-white">
                        {member.fullname?.charAt(0) || "U"}
                      </div>
                      <div className="overflow-hidden min-w-0">
                        <p className="truncate text-xs font-bold text-slate-900 dark:text-white">
                          {member.fullname}
                        </p>
                        <p className="truncate text-[10px] text-slate-400">
                          {member.email}
                        </p>
                      </div>
                    </div>
                  ))}
                  {(!team.members || team.members.length === 0) && (
                    <div className="col-span-full py-4 text-center text-xs italic text-slate-400">
                      No team members currently registered
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button
                onClick={onClose}
                className="rounded-2xl bg-slate-900 px-6 py-2.5 text-xs font-bold text-white shadow-lg transition hover:bg-slate-800 active:scale-95 dark:bg-white dark:text-slate-900"
              >
                Close Details
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default function StructureGraph() {
  const [treeData, setTreeData] = useState<OrgNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  // Search & Controls
  const [searchTerm, setSearchTerm] = useState("");
  const [zoom, setZoom] = useState(1);
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});

  // Fullscreen & Export PNG states
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Refs for Canvas, Container, and PNG Export
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const treeExportRef = useRef<HTMLDivElement>(null);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        } else {
          setIsFullscreen(true);
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
        setIsFullscreen(false);
      }
    } catch {
      setIsFullscreen((prev) => !prev);
    }
  };

  // High-Resolution PNG Export Handler
  const handleDownloadPng = async () => {
    if (!treeExportRef.current) return;
    try {
      setDownloading(true);
      toast.info("Generating high-resolution PNG structure diagram...");

      // Short delay to ensure all DOM paints are complete
      await new Promise((resolve) => setTimeout(resolve, 150));

      const isDarkMode = document.documentElement.classList.contains("dark");
      const dataUrl = await toPng(treeExportRef.current, {
        quality: 1,
        pixelRatio: 3, // Ultra-sharp 3x resolution for crisp text & borders
        backgroundColor: isDarkMode ? "#080c14" : "#f8fafc",
        style: {
          transform: "scale(1)",
          transformOrigin: "top center",
          padding: "48px 64px",
        },
      });

      const link = document.createElement("a");
      const dateStr = new Date().toISOString().slice(0, 10);
      link.download = `IDRMIS-Office-Structure-Hierarchy-${dateStr}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("Structure diagram downloaded successfully in high quality!");
    } catch (err) {
      console.error("Failed to export PNG", err);
      toast.error("Failed to generate image. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  useEffect(() => {
    buildTree();
  }, []);

  const buildTree = async () => {
    setLoading(true);
    setError(null);
    try {
      const [orgsData, sectorsRes, deptsData, teamsData] = await Promise.all([
        getOrganizations(),
        api.get("/sectors"),
        getDepartments(),
        getTeams(),
      ]);

      const orgs: Organization[] = Array.isArray(orgsData)
        ? orgsData
        : (orgsData as any).data || [];
      const sectors: Sector[] = Array.isArray(sectorsRes.data) ? sectorsRes.data : [];
      const depts: Department[] = Array.isArray(deptsData) ? deptsData : [];
      const teams: Team[] = Array.isArray(teamsData) ? teamsData : [];

      const getId = (obj: any): string | null => {
        if (!obj) return null;
        if (typeof obj === "string") return obj;
        if (typeof obj === "object" && obj.id) return obj.id;
        if (typeof obj === "object" && obj._id) return obj._id;
        return null;
      };

      const buildDeptNode = (dept: Department): DeptNode => {
        const deptTeams = teams.filter((t) => getId(t.department) === dept.id);
        const teamNodes: TeamNode[] = deptTeams.map((t) => ({
          type: "team",
          id: t.id || (t as any)._id || Math.random().toString(),
          name: t.name,
          data: t,
        }));

        return {
          type: "department",
          id: dept.id || (dept as any)._id || Math.random().toString(),
          name: dept.name,
          data: dept,
          children: teamNodes,
        };
      };

      const buildOrgNode = (org: Organization): OrgNode => {
        // 1. Sub-Organizations
        const childOrgs = orgs.filter((o) => {
          const parentId = getId(o.parentId);
          return parentId === org.id;
        });
        const childOrgNodes = childOrgs.map((childOrg) => buildOrgNode(childOrg));

        // 2. Sectors
        const orgSectors = sectors.filter((s) => {
          const sAny = s as any;
          const sOrgId = getId(s.organizationId) || getId(sAny.organization);
          return sOrgId === org.id;
        });

        // 3. Sector nodes
        const sectorNodes: SectorNode[] = orgSectors.map((sector) => {
          const sectorDepts = depts.filter((d) => {
            const dAny = d as any;
            const sId = getId(dAny.sectorId) || getId(dAny.sector);
            return sId === sector.id;
          });

          const deptNodes: DeptNode[] = sectorDepts.map((dept) => buildDeptNode(dept));

          return {
            type: "sector",
            id: sector.id || (sector as any)._id || Math.random().toString(),
            name: sector.name,
            data: sector,
            children: deptNodes,
          };
        });

        // 4. Direct Departments
        const assignedDeptIds = new Set<string>();
        sectorNodes.forEach((s) => s.children.forEach((d) => assignedDeptIds.add(d.id)));

        const directDepts = depts.filter((d) => {
          const dAny = d as any;
          const orgId = getId(d.organizationId) || getId(dAny.organization);
          const hasSector = getId(dAny.sectorId) || getId(dAny.sector);
          return orgId === org.id && !hasSector;
        });

        const directDeptNodes: DeptNode[] = directDepts.map((dept) => buildDeptNode(dept));

        const children = [...sectorNodes, ...directDeptNodes, ...childOrgNodes];

        return {
          type: "organization",
          id: org.id || (org as any)._id || Math.random().toString(),
          name: org.name,
          data: org,
          children,
        };
      };

      // Root Organizations (Head Office)
      const rootOrgs = orgs.filter((o) => !getId(o.parentId));
      const rootNodes = rootOrgs.map((org) => buildOrgNode(org));

      setTreeData(rootNodes);
    } catch (err: any) {
      console.error("Failed to build organization tree", err);
      setError(err.message || "Failed to load hierarchy data");
    } finally {
      setLoading(false);
    }
  };

  // Node Toggle Handler
  const handleToggle = (id: string) => {
    setExpandedMap((prev) => ({
      ...prev,
      [id]: prev[id] === false ? true : false,
    }));
  };

  // Expand / Collapse All
  const handleExpandAll = () => {
    setExpandedMap({});
  };

  const handleCollapseAll = () => {
    const map: Record<string, boolean> = {};
    const traverse = (node: TreeNodeType) => {
      map[node.id] = false;
      if ("children" in node && Array.isArray(node.children)) {
        node.children.forEach(traverse);
      }
    };
    treeData.forEach(traverse);
    setExpandedMap(map);
  };

  // Stats Counters
  const hierarchyCounts = useMemo(() => {
    let orgsCount = 0;
    let sectorsCount = 0;
    let deptsCount = 0;
    let teamsCount = 0;

    const traverse = (node: TreeNodeType) => {
      if (node.type === "organization") orgsCount++;
      if (node.type === "sector") sectorsCount++;
      if (node.type === "department") deptsCount++;
      if (node.type === "team") teamsCount++;

      if ("children" in node && Array.isArray(node.children)) {
        node.children.forEach(traverse);
      }
    };

    treeData.forEach(traverse);
    return { orgsCount, sectorsCount, deptsCount, teamsCount };
  }, [treeData]);

  return (
    <>
      <PageMeta
        title="Organizational Structure Graph | IDRMIS"
        description="Top-to-bottom interactive organizational hierarchy tree branch map"
      />
      <PageBreadcrumb pageTitle="Organizational Structure Graph" />

      <div className="relative space-y-8 pb-10">
        <DiamondBackground />

        {/* 4-Card Summary Stats Bar (Users.tsx style) */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              title: "Organizations",
              value: hierarchyCounts.orgsCount,
              icon: <Building2 size={22} />,
              color: "from-blue-600 to-indigo-600 shadow-blue-500/20",
              description: "Head office & branches",
            },
            {
              title: "Strategic Sectors",
              value: hierarchyCounts.sectorsCount,
              icon: <Layers size={22} />,
              color: "from-purple-600 to-violet-600 shadow-purple-500/20",
              description: "Pillar coordination divisions",
            },
            {
              title: "Departments",
              value: hierarchyCounts.deptsCount,
              icon: <Briefcase size={22} />,
              color: "from-emerald-600 to-teal-600 shadow-emerald-500/20",
              description: "Operational working units",
            },
            {
              title: "Tactical Teams",
              value: hierarchyCounts.teamsCount,
              icon: <Users size={22} />,
              color: "from-amber-500 to-orange-600 shadow-amber-500/20",
              description: "Emergency field personnel",
            },
          ].map((card, i) => (
            <motion.div
              key={i}
              whileHover={{ scale: 1.02, y: -2 }}
              className="relative overflow-hidden rounded-3xl border border-white/40 bg-white/40 p-5 shadow-xl backdrop-blur-3xl dark:border-white/10 dark:bg-white/5"
            >
              <div className="flex items-center gap-3.5">
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${card.color} text-white shadow-lg`}
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

        {/* Main Canvas Container */}
        <div
          ref={containerRef}
          className={`transition-all duration-300 ${
            isFullscreen
              ? "fixed inset-0 z-50 flex flex-col overflow-hidden bg-slate-900/95 p-6 backdrop-blur-3xl dark:bg-[#0A0A0B]/98"
              : "rounded-3xl border border-white/40 bg-white/40 p-6 shadow-2xl backdrop-blur-3xl dark:border-white/10 dark:bg-white/5"
          }`}
        >
          {/* Header Row */}
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-2xl font-black text-slate-900 dark:text-white">
                  Hierarchical Structure Graph
                </h3>
                <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-bold text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                  Top-To-Bottom Tree
                </span>
                {isFullscreen && (
                  <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    Full Screen Active
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-500 dark:text-white/50">
                Visual top-down branch diagram from Federal Head Office through Subcity Branches, Sectors, Departments, and Teams
              </p>
            </div>

            {/* Toolbar Controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Search Bar */}
              <div className="relative min-w-[200px] sm:min-w-[240px]">
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/30"
                />
                <input
                  type="text"
                  placeholder="Find unit, branch, team..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-10 w-full rounded-2xl border border-white/30 bg-white/60 pl-10 pr-9 text-xs text-slate-900 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Expand / Collapse All */}
              <div className="flex items-center rounded-2xl border border-slate-200 bg-white/50 p-1 shadow-inner backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <button
                  type="button"
                  onClick={handleExpandAll}
                  className="flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold text-slate-600 transition hover:bg-white hover:text-slate-900 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <ChevronDown size={14} /> Expand All
                </button>
                <button
                  type="button"
                  onClick={handleCollapseAll}
                  className="flex h-8 items-center gap-1.5 rounded-xl px-2.5 text-xs font-bold text-slate-600 transition hover:bg-white hover:text-slate-900 dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <ChevronUp size={14} /> Collapse All
                </button>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center rounded-2xl border border-slate-200 bg-white/50 p-1 shadow-inner backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(1)))}
                  title="Zoom Out"
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-600 transition hover:bg-white hover:text-slate-900 dark:text-white/60 dark:hover:bg-white/10"
                >
                  <ZoomOut size={16} />
                </button>
                <span className="px-2 text-xs font-bold text-slate-700 dark:text-white/80">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(1)))}
                  title="Zoom In"
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-600 transition hover:bg-white hover:text-slate-900 dark:text-white/60 dark:hover:bg-white/10"
                >
                  <ZoomIn size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom(1)}
                  title="Reset Zoom"
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-600 transition hover:bg-white hover:text-slate-900 dark:text-white/60 dark:hover:bg-white/10"
                >
                  <RotateCcw size={14} />
                </button>
              </div>

              {/* Export High-Resolution PNG Button */}
              <button
                type="button"
                disabled={downloading || loading || treeData.length === 0}
                onClick={handleDownloadPng}
                title="Download high-resolution PNG image of the structure"
                className="flex h-10 items-center gap-2 rounded-2xl bg-brand-600 px-4 text-xs font-bold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-primary dark:shadow-primary/20"
              >
                {downloading ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Exporting...</span>
                  </>
                ) : (
                  <>
                    <Download size={15} />
                    <span>Download PNG</span>
                  </>
                )}
              </button>

              {/* Fullscreen Toggle Button */}
              <button
                type="button"
                onClick={toggleFullscreen}
                title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                className={`flex h-10 items-center gap-1.5 rounded-2xl border px-3 text-xs font-bold transition ${
                  isFullscreen
                    ? "border-primary bg-primary text-white shadow-lg shadow-primary/20"
                    : "border-slate-200 bg-white/50 text-slate-700 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-white/70 dark:hover:bg-white/10"
                }`}
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 size={16} />
                    <span className="hidden sm:inline">Exit Fullscreen</span>
                  </>
                ) : (
                  <>
                    <Maximize2 size={16} />
                    <span className="hidden sm:inline">Fullscreen</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Canvas Viewport */}
          {loading ? (
            <div className="flex h-96 flex-col items-center justify-center gap-3">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-xs font-bold text-slate-500">
                Synthesizing organizational tree branches...
              </p>
            </div>
          ) : error ? (
            <div className="rounded-3xl border border-rose-200 bg-rose-50/70 p-10 text-center dark:border-rose-900/40 dark:bg-rose-950/20">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-900/40 dark:text-rose-400">
                <X size={26} />
              </div>
              <h4 className="mt-4 text-base font-bold text-rose-900 dark:text-rose-300">
                Failed to Map Structure
              </h4>
              <p className="mt-1 text-xs text-rose-600 dark:text-rose-400/80">{error}</p>
              <button
                onClick={buildTree}
                className="mt-4 rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700"
              >
                Retry
              </button>
            </div>
          ) : treeData.length === 0 ? (
            <div className="flex h-80 flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 text-slate-400">
              <Network size={40} className="mb-3 text-slate-300" />
              <p className="text-sm font-bold text-slate-700 dark:text-white">
                No organizational units available
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Create organizations and departments to render the structure tree.
              </p>
            </div>
          ) : (
            <div
              ref={canvasRef}
              className={`relative w-full overflow-auto rounded-3xl border border-slate-200/80 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:24px_24px] bg-slate-50/50 p-10 dark:border-white/5 dark:bg-slate-950/40 custom-scrollbar ${
                isFullscreen ? "flex-1 min-h-0 max-h-none" : "min-h-[640px] max-h-[75vh]"
              }`}
            >
              {/* Scalable Canvas Content */}
              <div
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: "top center",
                  transition: "transform 0.15s ease-out",
                }}
                className="inline-flex min-w-full justify-center pb-16"
              >
                {/* Element targeted by toPng export */}
                <div
                  ref={treeExportRef}
                  className="flex flex-col items-center space-y-16 p-4"
                >
                  {treeData.map((rootOrg) => (
                    <TreeBranch
                      key={rootOrg.id}
                      node={rootOrg}
                      searchTerm={searchTerm}
                      expandedMap={expandedMap}
                      onToggle={handleToggle}
                      onTeamClick={setSelectedTeam}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <TeamDetailsModal team={selectedTeam} onClose={() => setSelectedTeam(null)} />
    </>
  );
}
