import { useState, useEffect } from 'react';
import { useToast } from '../../hooks/useToast';
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { useModal } from "../../hooks/useModal";
import { Modal } from "../../components/ui/modal";
import { Organization, getOrganizations, createOrganization, updateOrganization, deleteOrganization } from '../../api/organizationService';
import { OrganizationForm } from './OrganizationForm';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, List, Search, Plus, Eye, Edit2, Trash2, Building2, MapPin } from 'lucide-react';

const DiamondBackground = () => (
    <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute inset-0 bg-slate-100 dark:bg-[#0A0A0B]" />
        {[...Array(10)].map((_, i) => (
            <motion.div
                key={i}
                initial={{
                    opacity: 0,
                    rotate: 45,
                    x: Math.random() * 100 + "%",
                    y: Math.random() * 100 + "%"
                }}
                animate={{
                    opacity: [0.15, 0.45, 0.15],
                    y: ["-20%", "120%"],
                    rotate: [45, 225],
                }}
                transition={{
                    duration: 20 + Math.random() * 20,
                    repeat: Infinity,
                    ease: "linear",
                    delay: i * -4
                }}
                className="absolute h-64 w-64 rounded-[48px] border border-white/40 bg-white/10 backdrop-blur-3xl dark:border-white/10 dark:bg-white/[0.04]"
                style={{
                    left: `${(i * 12) % 95}%`,
                }}
            />
        ))}
    </div>
);

export default function OrganizationList() {
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [editOrg, setEditOrg] = useState<Organization | null>(null);
    const [isViewMode, setIsViewMode] = useState(false);
    
    // UI State
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<'all' | 'head_office' | 'branch'>('all');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(10);

    const toast = useToast();
    const { isOpen, openModal, closeModal } = useModal();

    // Filter organizations based on search term and type
    const filteredOrganizations = organizations.filter(org => {
        const matchesType = typeFilter === 'all' || org.type === typeFilter;
        if (!matchesType) return false;

        const term = searchTerm.toLowerCase();
        const subName = org.subcityName || (typeof org.subcity === 'object' && org.subcity ? org.subcity.name : '');
        const parentName = typeof org.parentId === 'object' && org.parentId ? (org.parentId as any).name : '';

        return (
            org.name.toLowerCase().includes(term) ||
            org.type.toLowerCase().includes(term) ||
            (org.branchCode && org.branchCode.toLowerCase().includes(term)) ||
            subName.toLowerCase().includes(term) ||
            parentName.toLowerCase().includes(term)
        );
    });

    // Pagination logic
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentItems = filteredOrganizations.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(filteredOrganizations.length / itemsPerPage);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, typeFilter]);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const data = await getOrganizations();
            setOrganizations(data);
        } catch (error) {
            console.error("Failed to fetch organizations", error);
        }
    };

    const handleOpenModal = (org?: Organization, mode: 'create' | 'edit' | 'view' = 'create') => {
        setEditOrg(org || null);
        setIsViewMode(mode === 'view');
        openModal();
    };

    const handleSave = async (data: any) => {
        try {
            const orgId = editOrg ? (editOrg.id || editOrg._id) : null;
            if (orgId) {
                await updateOrganization(orgId, data);
            } else {
                await createOrganization(data);
            }
            closeModal();
            toast.success(editOrg ? 'Organization updated successfully' : 'Branch / Organization created successfully');
            fetchData();
        } catch (error: any) {
            console.error("Failed to save organization", error);
            const msg = error.response?.data?.errors?.join(', ') || error.response?.data?.message || "Failed to save organization";
            toast.error(msg);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure you want to delete this organization?")) {
            try {
                await deleteOrganization(id);
                toast.success('Organization deleted successfully');
                fetchData();
            } catch (error: any) {
                console.error("Failed to delete organization", error);
                const msg = error.response?.data?.message || "Failed to delete organization. Ensure it has no dependencies.";
                toast.error(msg);
            }
        }
    };

    const getSubcityName = (org: Organization) => {
        if (org.subcityName) return org.subcityName;
        if (typeof org.subcity === 'object' && org.subcity) return org.subcity.name;
        return null;
    };

    const getWoredasCount = (org: Organization) => {
        if (typeof org.woredasCount === 'number') return org.woredasCount;
        if (Array.isArray(org.woredas)) return org.woredas.length;
        return 0;
    };

    return (
        <>
            <PageMeta
                title="Organization & Branch Management | IDRMIS"
                description="Manage organizations structure and subcity branch hierarchy"
            />
            <PageBreadcrumb pageTitle="Organizations & Branches" />

            <div className="relative space-y-8 pb-10">
                <DiamondBackground />

                {/* Main Content Area */}
                <div className="rounded-3xl border border-white/40 bg-white/20 p-6 shadow-2xl backdrop-blur-3xl dark:border-white/10 dark:bg-white/5">
                    <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between mb-8">
                        <div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                                <Building2 className="text-primary" size={26} />
                                Branches & Organizations Directory
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-white/50">
                                Manage central head office and territorial subcity branches controlling woredas
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                            {/* Type filter tabs */}
                            <div className="flex items-center rounded-2xl border border-slate-200 bg-white/50 p-1 shadow-inner backdrop-blur-xl dark:border-white/10 dark:bg-white/5 text-xs font-semibold">
                                <button
                                    onClick={() => setTypeFilter('all')}
                                    className={`px-3 py-1.5 rounded-xl transition-all ${typeFilter === 'all' ? 'bg-slate-900 text-white shadow-md dark:bg-primary' : 'text-slate-500 hover:text-slate-900 dark:text-white/50'}`}
                                >
                                    All
                                </button>
                                <button
                                    onClick={() => setTypeFilter('head_office')}
                                    className={`px-3 py-1.5 rounded-xl transition-all ${typeFilter === 'head_office' ? 'bg-slate-900 text-white shadow-md dark:bg-primary' : 'text-slate-500 hover:text-slate-900 dark:text-white/50'}`}
                                >
                                    Head Office
                                </button>
                                <button
                                    onClick={() => setTypeFilter('branch')}
                                    className={`px-3 py-1.5 rounded-xl transition-all ${typeFilter === 'branch' ? 'bg-slate-900 text-white shadow-md dark:bg-primary' : 'text-slate-500 hover:text-slate-900 dark:text-white/50'}`}
                                >
                                    Branches
                                </button>
                            </div>

                            {/* Search Input */}
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-white/30" size={17} />
                                <input
                                    type="text"
                                    placeholder="Search by name, branch code, subcity..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="h-10 w-full rounded-2xl border border-white/20 bg-white/50 pl-10 pr-4 text-xs font-medium text-slate-900 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-white/10 dark:bg-white/5 dark:text-white min-w-[260px]"
                                />
                            </div>

                            {/* View Switcher */}
                            <div className="flex items-center rounded-2xl border border-slate-200 bg-white/50 p-1 shadow-inner backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`flex h-8 w-9 items-center justify-center rounded-xl transition-all ${viewMode === 'grid' ? 'bg-slate-900 text-white shadow-md scale-105 dark:bg-primary' : 'text-slate-500 hover:text-slate-900 dark:text-white/40'}`}
                                >
                                    <LayoutGrid size={16} />
                                </button>
                                <button
                                    onClick={() => setViewMode('table')}
                                    className={`flex h-8 w-9 items-center justify-center rounded-xl transition-all ${viewMode === 'table' ? 'bg-slate-900 text-white shadow-md scale-105 dark:bg-primary' : 'text-slate-500 hover:text-slate-900 dark:text-white/40'}`}
                                >
                                    <List size={16} />
                                </button>
                            </div>

                            <button
                                onClick={() => handleOpenModal()}
                                className="flex h-10 items-center gap-2 rounded-2xl bg-brand-600 px-5 text-xs font-semibold text-white shadow-lg shadow-brand-600/20 transition-all hover:bg-brand-700 hover:scale-[1.02] active:scale-[0.98] dark:bg-primary dark:shadow-primary/20"
                            >
                                <Plus size={16} />
                                Add Branch / Org
                            </button>
                        </div>
                    </div>

                    <div className="mb-4 text-xs font-medium text-slate-500 dark:text-white/40">
                        Showing {filteredOrganizations.length} {filteredOrganizations.length === 1 ? 'organization' : 'organizations'}
                    </div>

                    <AnimatePresence mode="wait">
                        {viewMode === 'grid' ? (
                            <motion.div
                                key="grid"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                            >
                                {currentItems.map((org) => {
                                    const subName = getSubcityName(org);
                                    const woredaCount = getWoredasCount(org);
                                    const orgId = org.id || org._id || '';

                                    return (
                                        <motion.div
                                            key={orgId}
                                            layout
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            whileHover={{ y: -5 }}
                                            className="group relative overflow-hidden rounded-3xl border border-white/30 bg-white/40 p-5 shadow-xl backdrop-blur-3xl transition-all hover:border-primary/30 hover:shadow-2xl dark:border-white/10 dark:bg-white/5"
                                        >
                                            <div className="relative z-10">
                                                <div className="mb-4 flex items-start justify-between">
                                                    <div className={`flex h-11 w-11 items-center justify-center rounded-2xl font-bold text-base transition-all duration-300 ${
                                                        org.type === 'branch'
                                                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                                            : 'bg-primary/10 text-primary'
                                                    }`}>
                                                        {org.type === 'branch' ? <MapPin size={22} /> : <Building2 size={22} />}
                                                    </div>
                                                    <div className="flex gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => handleOpenModal(org, 'view')} title="View" className="p-1.5 text-slate-400 hover:bg-white hover:shadow-md rounded-xl transition-all dark:hover:bg-gray-800">
                                                            <Eye size={15} />
                                                        </button>
                                                        <button onClick={() => handleOpenModal(org, 'edit')} title="Edit" className="p-1.5 text-slate-400 hover:bg-white hover:shadow-md rounded-xl transition-all dark:hover:bg-gray-800">
                                                            <Edit2 size={15} />
                                                        </button>
                                                        <button onClick={() => handleDelete(orgId)} title="Delete" className="p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all dark:hover:bg-red-950/30">
                                                            <Trash2 size={15} />
                                                        </button>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 mb-1">
                                                    <h4 className="text-base font-bold text-slate-900 dark:text-white truncate">
                                                        {org.name}
                                                    </h4>
                                                </div>

                                                <div className="flex flex-wrap gap-1.5 mb-3">
                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                                                        org.type === 'branch'
                                                            ? 'bg-blue-100/80 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                                                            : 'bg-emerald-100/80 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                                    }`}>
                                                        {org.type === 'branch' ? 'Subcity Branch' : org.type.replace('_', ' ')}
                                                    </span>

                                                    {org.branchCode && (
                                                        <span className="bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-300 text-[10px] font-semibold px-2 py-0.5 rounded-md">
                                                            {org.branchCode}
                                                        </span>
                                                    )}

                                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ml-auto ${
                                                        org.status === 'inactive'
                                                            ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                                                            : 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300'
                                                    }`}>
                                                        {org.status || 'active'}
                                                    </span>
                                                </div>

                                                {/* Territorial Jurisdiction */}
                                                {org.type === 'branch' && (
                                                    <div className="mb-3 rounded-xl bg-blue-50/70 p-2.5 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/30 text-xs space-y-1">
                                                        <div className="flex items-center justify-between text-blue-900 dark:text-blue-200 font-semibold text-[11px]">
                                                            <span className="flex items-center gap-1">
                                                                <MapPin size={12} className="text-blue-600" />
                                                                {subName ? `${subName} Subcity` : 'Subcity Unassigned'}
                                                            </span>
                                                            <span className="text-[10px] bg-blue-200/70 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200 px-1.5 py-0.2 rounded font-bold">
                                                                {woredaCount} Woredas
                                                            </span>
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                                            Territory: {subName ? `${subName} + all ${woredaCount} woredas` : 'N/A'}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="space-y-1.5 border-t border-slate-100 pt-3 dark:border-white/5 text-xs text-slate-600 dark:text-slate-400">
                                                    <div className="flex items-center justify-between">
                                                        <span>Parent Org</span>
                                                        <span className="font-medium text-slate-800 dark:text-white/80">
                                                            {typeof org.parentId === 'object' && org.parentId ? (org.parentId as any).name : '-'}
                                                        </span>
                                                    </div>
                                                    {org.phone && (
                                                        <div className="flex items-center justify-between">
                                                            <span>Phone</span>
                                                            <span className="font-medium text-slate-800 dark:text-white/80">{org.phone}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </motion.div>
                        ) : (
                            <motion.div
                                key="table"
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                className="overflow-hidden rounded-2xl border border-white/20 bg-white/40 dark:border-white/10 dark:bg-white/5"
                            >
                                <div className="max-w-full overflow-x-auto">
                                    <table className="w-full table-auto">
                                        <thead>
                                            <tr className="bg-slate-50/80 text-left dark:bg-white/5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-white/50">
                                                <th className="px-5 py-3.5">Organization / Branch</th>
                                                <th className="px-5 py-3.5">Type</th>
                                                <th className="px-5 py-3.5">Territorial Jurisdiction (Subcity & Woredas)</th>
                                                <th className="px-5 py-3.5">Parent Org</th>
                                                <th className="px-5 py-3.5">Status</th>
                                                <th className="px-5 py-3.5 text-center">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200/70 dark:divide-white/5 text-xs">
                                            {currentItems.map((org) => {
                                                const subName = getSubcityName(org);
                                                const woredaCount = getWoredasCount(org);
                                                const orgId = org.id || org._id || '';

                                                return (
                                                    <tr key={orgId} className="group hover:bg-slate-50 transition-colors dark:hover:bg-white/[0.02]">
                                                        <td className="px-5 py-3.5">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`h-9 w-9 flex-shrink-0 rounded-xl flex items-center justify-center font-bold uppercase transition-all group-hover:scale-105 ${
                                                                    org.type === 'branch'
                                                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                                                                        : 'bg-primary/10 text-primary'
                                                                }`}>
                                                                    {org.type === 'branch' ? <MapPin size={18} /> : <Building2 size={18} />}
                                                                </div>
                                                                <div>
                                                                    <div className="font-semibold text-slate-900 group-hover:text-primary transition-colors dark:text-white">
                                                                        {org.name}
                                                                    </div>
                                                                    {org.branchCode && (
                                                                        <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/10 px-1.5 py-0.2 rounded">
                                                                            {org.branchCode}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>

                                                        <td className="px-5 py-3.5">
                                                            <span className={`inline-flex rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                                                                org.type === 'branch'
                                                                    ? 'bg-blue-100/80 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300'
                                                                    : 'bg-emerald-100/80 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                                                            }`}>
                                                                {org.type === 'branch' ? 'Subcity Branch' : org.type.replace('_', ' ')}
                                                            </span>
                                                        </td>

                                                        <td className="px-5 py-3.5">
                                                            {org.type === 'branch' ? (
                                                                <div className="flex items-center gap-2">
                                                                    <span className="inline-flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-200">
                                                                        <MapPin size={13} className="text-blue-500" />
                                                                        {subName ? `${subName} Subcity` : 'Not linked'}
                                                                    </span>
                                                                    <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 px-2 py-0.5 text-[10px] font-bold">
                                                                        {woredaCount} Woredas
                                                                    </span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-slate-400 dark:text-white/40 italic">
                                                                    City-wide (All Subcities)
                                                                </span>
                                                            )}
                                                        </td>

                                                        <td className="px-5 py-3.5 text-slate-600 dark:text-white/60">
                                                            {typeof org.parentId === 'object' && org.parentId ? (org.parentId as any).name : '-'}
                                                        </td>

                                                        <td className="px-5 py-3.5">
                                                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                                                                org.status === 'inactive'
                                                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                                                                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                                            }`}>
                                                                {org.status || 'active'}
                                                            </span>
                                                        </td>

                                                        <td className="px-5 py-3.5">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <button onClick={() => handleOpenModal(org, 'view')} title="View" className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary rounded-lg transition-all dark:hover:bg-white/5">
                                                                    <Eye size={15} />
                                                                </button>
                                                                <button onClick={() => handleOpenModal(org, 'edit')} title="Edit" className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary rounded-lg transition-all dark:hover:bg-white/5">
                                                                    <Edit2 size={15} />
                                                                </button>
                                                                <button onClick={() => handleDelete(orgId)} title="Delete" className="p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-lg transition-all dark:hover:bg-red-500/10">
                                                                    <Trash2 size={15} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="mt-8 flex items-center justify-between border-t border-slate-100 pt-6 dark:border-white/5">
                            <div className="text-xs text-slate-500 dark:text-white/40">
                                Showing <span className="font-semibold text-slate-900 dark:text-white">{indexOfFirstItem + 1}</span> to <span className="font-semibold text-slate-900 dark:text-white">{Math.min(indexOfLastItem, filteredOrganizations.length)}</span> of <span className="font-semibold text-slate-900 dark:text-white">{filteredOrganizations.length}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <button
                                    className={`flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white/40 text-slate-500 transition-all hover:bg-white hover:text-primary dark:border-white/10 dark:bg-white/5 dark:text-white/40 ${currentPage === 1 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                >
                                    <LayoutGrid size={15} className="rotate-90" />
                                </button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((number) => (
                                    <button
                                        key={number}
                                        className={`flex h-9 w-9 items-center justify-center rounded-xl border text-xs font-semibold transition-all ${currentPage === number
                                            ? 'border-primary bg-slate-900 text-white shadow-md scale-105 dark:bg-primary'
                                            : 'border-slate-200 bg-white/40 text-slate-500 hover:bg-white hover:text-primary dark:border-white/10 dark:bg-white/5 dark:text-white/40'
                                            }`}
                                        onClick={() => setCurrentPage(number)}
                                    >
                                        {number}
                                    </button>
                                ))}
                                <button
                                    className={`flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white/40 text-slate-500 transition-all hover:bg-white hover:text-primary dark:border-white/10 dark:bg-white/5 dark:text-white/40 ${currentPage === totalPages ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                >
                                    <LayoutGrid size={15} className="-rotate-90" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[720px] m-4">
                <div className="no-scrollbar relative w-full max-w-[720px] overflow-y-auto rounded-3xl bg-white p-6 dark:bg-gray-900 lg:p-8">
                    <div className="px-1 pr-10 mb-5">
                        <h4 className="text-xl font-bold text-gray-800 dark:text-white/90 flex items-center gap-2">
                            <Building2 className="text-primary" size={22} />
                            {isViewMode ? 'Organization / Branch Overview' : editOrg ? 'Edit Branch / Organization' : 'Register New Branch / Organization'}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Configure territorial jurisdiction, subcity boundary, and operational credentials
                        </p>
                    </div>

                    <OrganizationForm
                        initialData={editOrg}
                        isViewMode={isViewMode}
                        onSave={handleSave}
                        onCancel={closeModal}
                    />
                </div>
            </Modal>
        </>
    );
}
