import React, { useState, useEffect } from 'react';
import { useToast } from '../../hooks/useToast';
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import { useModal } from "../../hooks/useModal";
import { Modal } from "../../components/ui/modal";
import Button from "../../components/ui/button/Button";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import { Can } from '../../components/auth/PermissionGuard';
import { LayoutGrid, List, Search, Plus, Eye, Edit2, Trash2, KeyRound, Building2, MapPin, Shield, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { UserCard } from '../../components/admin/UserCard';
import { UserStats } from '../../components/admin/UserStats';

interface User {
    id: string;
    fullname: string;
    email: string;
    phone?: string;
    roles?: { id: string; name: string }[];
    department?: { id: string; name: string };
    organization?: { id: string; name: string; type?: string; subcityName?: string; subcity?: any };
    sector?: { id: string; name: string };
    team?: { id: string; name: string };
    status: string;
    profileImage?: string;
    accessLevel: string;
    organizationType: string;
}

interface RoleOption {
    id?: string;
    _id?: string;
    name: string;
    description?: string;
}

interface OrganizationOption {
    id?: string;
    _id?: string;
    name: string;
    type?: string;
    subcityName?: string;
    subcity?: any;
    branchCode?: string;
}

const getStatusColor = (status: string) => {
    switch (status) {
        case 'active': return 'bg-emerald-500';
        case 'pending': return 'bg-amber-500';
        case 'suspended': return 'bg-rose-500';
        default: return 'bg-slate-500';
    }
};

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

export default function Users() {
    const { user } = useAuth();

    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<RoleOption[]>([]);
    const [allOrganizations, setAllOrganizations] = useState<OrganizationOption[]>([]);

    const [loading, setLoading] = useState(true);
    const [editUser, setEditUser] = useState<User | null>(null);
    const [isViewMode, setIsViewMode] = useState(false);
    const [selectedUserForRoles, setSelectedUserForRoles] = useState<User | null>(null);
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);

    // Form State (Cleaned up: No Sectors, Departments, or Teams)
    const [formData, setFormData] = useState({
        fullname: '',
        email: '',
        phone: '',
        roles: [] as string[],
        organizationType: 'branch', // head_office | branch
        organization: '',
        status: 'active',
        profileImage: null as File | null,
        accessLevel: 'expert'
    });

    const [viewMode, setViewMode] = useState<'grid' | 'table'>('table');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const toast = useToast();
    const { isOpen, openModal, closeModal } = useModal();

    useEffect(() => {
        fetchData();
        fetchOptions();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await api.get('/users');
            setUsers(res.data);
        } catch (error) {
            console.error("Failed to fetch users", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchOptions = async () => {
        try {
            const [roleRes, orgRes] = await Promise.all([
                api.get('/roles'),
                api.get('/organizations')
            ]);
            setRoles(roleRes.data || []);
            setAllOrganizations(orgRes.data || []);
        } catch (e) {
            console.error("Failed to fetch options", e);
        }
    };

    const handleOpenRoleModal = (userItem: User) => {
        setSelectedUserForRoles(userItem);
        setFormData(prev => ({
            ...prev,
            roles: userItem.roles?.map((r: any) => r._id || r.id) || []
        }));
        setIsRoleModalOpen(true);
    };

    const handleUpdateRoles = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedUserForRoles) return;

        try {
            const userId = selectedUserForRoles.id || (selectedUserForRoles as any)._id;
            await api.put(`/users/${userId}`, { roles: formData.roles });
            toast.success('User roles updated successfully');
            setIsRoleModalOpen(false);
            fetchData();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to update roles');
        }
    };

    const headOffices = allOrganizations.filter(o => o.type === 'head_office');
    const branches = allOrganizations.filter(o => o.type === 'branch');

    const handleOpenModal = (userItem?: User, mode: 'create' | 'edit' | 'view' = 'create') => {
        setIsViewMode(mode === 'view');

        const isBranchAdmin = user?.accessLevel === 'branch_admin' ||
            user?.roles?.some((r: any) => ['Branch Admin', 'branch_admin'].includes(r.name));
        const isSuperAdmin = user?.accessLevel === 'super_admin' ||
            user?.roles?.some((r: any) => ['Super Admin', 'super_admin'].includes(r.name));

        let userOrgId = '';
        if (isBranchAdmin && !isSuperAdmin && user?.organization) {
            userOrgId = typeof user.organization === 'object' ? (user.organization as any)._id || (user.organization as any).id : user.organization;
        }

        const getOptionId = (val: any) => {
            if (!val) return '';
            if (typeof val === 'string') return val;
            return val.id || val._id || '';
        };

        if (userItem) {
            setEditUser(userItem);
            const userOrgType = userItem.organizationType || (
                userItem.organization && typeof userItem.organization === 'object' && userItem.organization.type === 'head_office'
                    ? 'head_office'
                    : 'branch'
            );

            setFormData({
                fullname: userItem.fullname || '',
                email: userItem.email || '',
                phone: userItem.phone || '',
                roles: userItem.roles?.map((r: any) => typeof r === 'string' ? r : (r.id || r._id || '')) || [],
                organizationType: userOrgType,
                organization: getOptionId(userItem.organization),
                status: userItem.status || 'active',
                profileImage: null,
                accessLevel: userItem.accessLevel || 'expert'
            });
        } else {
            setEditUser(null);
            // Default setup for new user
            const defaultType: 'head_office' | 'branch' = isBranchAdmin ? 'branch' : 'head_office';
            const defaultOrg = userOrgId || (defaultType === 'head_office' && headOffices.length > 0 ? (headOffices[0].id || headOffices[0]._id || '') : '');

            setFormData({
                fullname: '',
                email: '',
                phone: '',
                roles: [],
                organizationType: defaultType,
                organization: defaultOrg,
                status: 'active',
                profileImage: null,
                accessLevel: isBranchAdmin ? 'expert' : 'expert'
            });
        }
        openModal();
    };

    const handleOrgTypeChange = (type: 'head_office' | 'branch') => {
        let defaultOrgId = '';
        if (type === 'head_office') {
            const hq = headOffices[0];
            defaultOrgId = hq ? (hq.id || hq._id || '') : '';
        } else {
            const firstBranch = branches[0];
            defaultOrgId = firstBranch ? (firstBranch.id || firstBranch._id || '') : '';
        }

        setFormData(prev => ({
            ...prev,
            organizationType: type,
            organization: defaultOrgId
        }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isViewMode) return;

        if (!formData.organization) {
            toast.error(formData.organizationType === 'head_office' ? 'Please select a Head Office organization.' : 'Please select a Branch for this user.');
            return;
        }

        try {
            const data = new FormData();
            data.append('fullname', formData.fullname);
            data.append('email', formData.email);
            data.append('phone', formData.phone);
            data.append('accessLevel', formData.accessLevel);
            data.append('organizationType', formData.organizationType);
            data.append('organization', formData.organization);
            data.append('status', formData.status);

            // Clear legacy hierarchy fields
            data.append('sector', '');
            data.append('department', '');
            data.append('team', '');

            if (formData.roles.length === 0) {
                data.append('roles', '');
            } else {
                formData.roles.forEach(role => data.append('roles', role));
            }

            if (formData.profileImage) {
                data.append('profileImage', formData.profileImage);
            }

            const userId = editUser ? (editUser.id || (editUser as any)._id) : null;

            if (editUser && userId) {
                await api.put(`/users/${userId}`, data);
                closeModal();
                toast.success('User updated successfully');
            } else {
                await api.post('/users', data);
                closeModal();
                toast.success('User created successfully');
            }
            fetchData();
        } catch (error: any) {
            console.error("Failed to save user", error);
            const errorMsg = error.response?.data?.message;
            const validationErrors = error.response?.data?.errors;

            if (validationErrors && Array.isArray(validationErrors)) {
                toast.error(validationErrors.join(', '));
            } else {
                toast.error(errorMsg || 'Failed to save user. Please verify input fields.');
            }
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure you want to delete this user?")) {
            try {
                await api.delete(`/users/${id}`);
                toast.success('User deleted successfully');
                fetchData();
            } catch (error: any) {
                console.error("Failed to delete user", error);
                toast.error('Failed to delete user');
            }
        }
    };

    const selectedOrg = allOrganizations.find(o => (o.id || o._id) === formData.organization);
    const subcityName = selectedOrg?.subcityName || (typeof selectedOrg?.subcity === 'object' && selectedOrg?.subcity ? selectedOrg.subcity.name : '');

    const filteredUsers = users
        .filter(u => (statusFilter === 'all' || u.status === statusFilter))
        .filter(u => {
            const term = searchTerm.toLowerCase();
            const orgName = u.organization?.name || '';
            const rolesNames = u.roles?.map(r => r.name).join(' ') || '';
            return u.fullname.toLowerCase().includes(term) ||
                u.email.toLowerCase().includes(term) ||
                orgName.toLowerCase().includes(term) ||
                rolesNames.toLowerCase().includes(term) ||
                u.accessLevel.toLowerCase().includes(term);
        });

    return (
        <>
            <PageMeta
                title="User Management | IDRMIS"
                description="Manage system users and RBAC permissions"
            />
            <PageBreadcrumb pageTitle="Users" />

            <div className="relative space-y-8 pb-10">
                <DiamondBackground />
                {/* Stats Overview */}
                <UserStats users={users} />

                {/* Main Content Area */}
                <div className="rounded-3xl border border-white/40 bg-white/20 p-6 shadow-2xl backdrop-blur-3xl dark:border-white/10 dark:bg-white/5">
                    <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between mb-8">
                        <div>
                            <h3 className="text-2xl font-bold text-slate-900 dark:text-white">
                                User Directory
                            </h3>
                            <p className="text-sm text-slate-500 dark:text-white/50">Manage system access, branches, and RBAC permissions</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-4">
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 dark:text-white/30" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search by name, email, branch, role..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="h-11 w-full rounded-2xl border border-white/20 bg-white/40 pl-11 pr-4 text-sm text-slate-900 outline-none transition-all focus:border-primary focus:ring-4 focus:ring-primary/10 dark:border-white/10 dark:bg-white/5 dark:text-white min-w-[280px]"
                                />
                            </div>

                            {/* View Switcher */}
                            <div className="flex items-center rounded-2xl border border-slate-200 bg-white/40 p-1 shadow-inner backdrop-blur-xl dark:border-white/10 dark:bg-white/5">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`flex h-9 w-10 items-center justify-center rounded-xl transition-all ${viewMode === 'grid' ? 'bg-slate-900 text-white shadow-xl scale-105' : 'text-slate-500 hover:text-slate-900 dark:text-white/40 dark:hover:text-white'}`}
                                >
                                    <LayoutGrid size={18} />
                                </button>
                                <button
                                    onClick={() => setViewMode('table')}
                                    className={`flex h-9 w-10 items-center justify-center rounded-xl transition-all ${viewMode === 'table' ? 'bg-slate-900 text-white shadow-xl scale-105' : 'text-slate-500 hover:text-slate-900 dark:text-white/40 dark:hover:text-white'}`}
                                >
                                    <List size={18} />
                                </button>
                            </div>

                            <Can resource="User" action="create">
                                <button
                                    onClick={() => handleOpenModal()}
                                    className="flex h-11 items-center gap-2 rounded-2xl bg-brand-600 px-6 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition-all hover:bg-brand-700 hover:scale-[1.02] active:scale-[0.98] dark:bg-primary dark:shadow-primary/20"
                                >
                                    <Plus size={18} />
                                    Add User
                                </button>
                            </Can>
                        </div>
                    </div>

                    {/* Filters Strip */}
                    <div className="mb-6 flex flex-wrap gap-3 border-b border-slate-200 pb-5 dark:border-white/5">
                        {['all', 'active', 'pending', 'suspended'].map((status) => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={`rounded-xl border px-4 py-1.5 text-xs font-semibold transition-all ${statusFilter === status
                                    ? 'border-primary/50 bg-primary/20 text-primary'
                                    : 'border-white/20 bg-white/20 text-slate-600 hover:border-white/40 hover:bg-white/40 dark:border-white/5 dark:bg-white/5 dark:text-white/50 dark:hover:border-white/10 dark:hover:text-white'}`}
                            >
                                {status.charAt(0).toUpperCase() + status.slice(1)}
                            </button>
                        ))}
                    </div>

                    <div className="mb-4 text-xs font-medium text-slate-500 dark:text-white/40">
                        Showing {filteredUsers.length} users
                    </div>

                    {/* Users Content */}
                    {loading ? (
                        <div className="flex h-64 items-center justify-center">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                        </div>
                    ) : (
                        <AnimatePresence mode="wait">
                            {viewMode === 'grid' ? (
                                <motion.div
                                    key="grid"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"
                                >
                                    {filteredUsers.map((u) => (
                                        <UserCard
                                            key={u.id}
                                            user={u}
                                            onEdit={() => handleOpenModal(u, 'edit')}
                                            onView={() => handleOpenModal(u, 'view')}
                                            onManageRoles={() => handleOpenRoleModal(u)}
                                            onDelete={handleDelete}
                                            onStatusToggle={async (userItem) => {
                                                const userId = userItem.id || (userItem as any)._id;
                                                const newStatus = userItem.status === 'active' ? 'suspended' : 'active';
                                                if (confirm(`Change status to ${newStatus}?`)) {
                                                    try {
                                                        await api.put(`/users/${userId}`, { status: newStatus });
                                                        toast.success(`User marked as ${newStatus}`);
                                                        fetchData();
                                                    } catch (error) { toast.error('Failed to update status'); }
                                                }
                                            }}
                                        />
                                    ))}
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="table"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className="max-w-full overflow-x-auto rounded-2xl border border-white/5"
                                >
                                    <table className="w-full table-auto">
                                        <thead>
                                            <tr className="bg-white/40 text-left dark:bg-white/5 text-[11px] uppercase font-bold text-slate-500 dark:text-white/50 tracking-wider">
                                                <th className="px-6 py-4">User</th>
                                                <th className="px-6 py-4">Workplace (Head Office / Branch)</th>
                                                <th className="px-6 py-4">Assigned Roles (RBAC)</th>
                                                <th className="px-6 py-4">Access Level</th>
                                                <th className="px-6 py-4">Status</th>
                                                <th className="px-6 py-4 text-center">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 dark:divide-white/5 text-xs">
                                            {filteredUsers.map((u) => {
                                                const isHq = u.organizationType === 'head_office' || (u.organization && (u.organization as any).type === 'head_office');

                                                return (
                                                    <tr key={u.id} className="group hover:bg-white/60 transition-colors dark:hover:bg-white/[0.02]">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-3">
                                                                <div className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold">
                                                                    {u.profileImage ? (
                                                                        <img src={u.profileImage} alt={u.fullname} className="h-full w-full object-cover" />
                                                                    ) : (
                                                                        u.fullname.charAt(0)
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <div className="font-semibold text-slate-900 group-hover:text-primary transition-colors dark:text-white">{u.fullname}</div>
                                                                    <div className="text-slate-500 dark:text-white/40">{u.email}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            {isHq ? (
                                                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/30">
                                                                    <Building2 size={13} />
                                                                    Head Office (Central DRM)
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/30">
                                                                    <MapPin size={13} />
                                                                    {u.organization?.name || 'Branch Assigned'}
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex flex-wrap gap-1 max-w-[220px]">
                                                                {u.roles && u.roles.length > 0 ? (
                                                                    u.roles.map(r => (
                                                                        <span key={r.id || (r as any)._id} className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 dark:bg-white/10 dark:text-slate-300">
                                                                            {r.name}
                                                                        </span>
                                                                    ))
                                                                ) : (
                                                                    <span className="text-slate-400 italic">No roles</span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className="inline-flex rounded-lg bg-slate-200 px-2.5 py-1 text-[10px] font-bold text-slate-700 uppercase tracking-tight dark:bg-white/10 dark:text-white/70">
                                                                {u.accessLevel?.replace('_', ' ')}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <div className={`h-2 w-2 rounded-full ${getStatusColor(u.status)} shadow-sm`} />
                                                                <span className="text-xs font-medium text-slate-700 dark:text-white/70 uppercase">
                                                                    {u.status}
                                                                </span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <div className="flex items-center justify-center gap-1">
                                                                <button onClick={() => handleOpenModal(u, 'view')} title="View Details" className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary rounded-lg transition-all dark:text-white/40 dark:hover:bg-white/5 dark:hover:text-white">
                                                                    <Eye size={16} />
                                                                </button>
                                                                <button onClick={() => handleOpenModal(u, 'edit')} title="Edit User" className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary rounded-lg transition-all dark:text-white/40 dark:hover:bg-white/5 dark:hover:text-white">
                                                                    <Edit2 size={16} />
                                                                </button>
                                                                <button onClick={() => handleOpenRoleModal(u)} title="Manage Roles" className="p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary rounded-lg transition-all dark:text-white/40 dark:hover:bg-white/5 dark:hover:text-white">
                                                                    <KeyRound size={16} />
                                                                </button>
                                                                <button onClick={() => handleDelete(u.id)} title="Delete User" className="p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-lg transition-all dark:text-white/40 dark:hover:bg-red-500/10 dark:hover:text-red-400">
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    )}
                </div>

                {/* Create/Edit/View User Modal */}
                <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[850px] m-4">
                    <div className="no-scrollbar relative w-full overflow-hidden rounded-[2rem] bg-white shadow-2xl dark:bg-slate-900 border border-white/20">
                        {/* Header */}
                        <div className="relative h-28 bg-gradient-to-r from-brand-600 to-brand-700 px-8 flex items-center dark:from-brand-900 dark:to-brand-950 overflow-hidden">
                            <div className="absolute inset-0 opacity-20 pointer-events-none">
                                <div className="absolute top-0 right-0 w-64 h-64 bg-white/20 rounded-full blur-3xl -mr-20 -mt-20" />
                                <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/20 rounded-full blur-2xl -ml-16 -mb-16" />
                            </div>
                            <div className="relative z-10 flex items-center gap-5">
                                <div className="h-14 w-14 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white">
                                    <Plus size={28} />
                                </div>
                                <div>
                                    <h4 className="text-2xl font-bold text-white tracking-tight">
                                        {isViewMode ? 'User Profile Overview' : editUser ? 'Modify User & RBAC' : 'Add User Account'}
                                    </h4>
                                    <p className="text-brand-100 text-xs opacity-80 mt-0.5">
                                        Assign Head Office or Branch workplace and configure Role-Based Access Control
                                    </p>
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleSave} className="flex flex-col">
                            <div className="custom-scrollbar max-h-[72vh] overflow-y-auto px-8 py-8">
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                                    
                                    {/* Left Column: Personal Information */}
                                    <div className="lg:col-span-5 space-y-6">
                                        <div className="rounded-3xl border border-slate-200 bg-slate-50/50 p-6 dark:border-white/10 dark:bg-white/[0.02]">
                                            <div className="flex items-center gap-2 mb-5 text-slate-900 dark:text-white pb-3 border-b border-slate-200 dark:border-white/10">
                                                <div className="h-2 w-2 rounded-full bg-brand-500" />
                                                <h5 className="text-xs font-bold uppercase tracking-widest">Personal Details</h5>
                                            </div>

                                            <div className="space-y-4">
                                                <div className="flex flex-col items-center mb-4">
                                                    <div className="relative group/avatar cursor-pointer">
                                                        <div className="h-20 w-20 rounded-3xl bg-slate-200 dark:bg-white/5 border-2 border-dashed border-slate-300 dark:border-white/10 flex items-center justify-center overflow-hidden transition-all group-hover:border-primary">
                                                            {(formData.profileImage || editUser?.profileImage) ? (
                                                                <img
                                                                    src={
                                                                        formData.profileImage instanceof File
                                                                            ? URL.createObjectURL(formData.profileImage)
                                                                            : editUser?.profileImage
                                                                    }
                                                                    alt="Profile"
                                                                    className="h-full w-full object-cover"
                                                                    key={formData.profileImage ? 'new' : 'old'}
                                                                />
                                                            ) : (
                                                                <div className="text-slate-400 group-hover:text-primary transition-colors flex flex-col items-center">
                                                                    <Plus size={20} />
                                                                    <span className="text-[9px] mt-0.5 font-bold">AVATAR</span>
                                                                </div>
                                                            )}
                                                            {!isViewMode && (
                                                                <input
                                                                    type="file"
                                                                    accept="image/*"
                                                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                                                    onChange={(e) => {
                                                                        if (e.target.files && e.target.files[0]) {
                                                                            setFormData({ ...formData, profileImage: e.target.files[0] });
                                                                        }
                                                                    }}
                                                                />
                                                            )}
                                                        </div>
                                                        {!isViewMode && (
                                                            <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-xl bg-white dark:bg-slate-800 shadow-md border border-slate-200 dark:border-white/10 flex items-center justify-center text-primary">
                                                                <Edit2 size={11} />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                <div>
                                                    <Label className="text-xs font-bold uppercase tracking-wider opacity-60">Full Legal Name *</Label>
                                                    <Input
                                                        type="text"
                                                        value={formData.fullname}
                                                        onChange={(e) => setFormData({ ...formData, fullname: e.target.value })}
                                                        placeholder="e.g. Abebe Bikila"
                                                        required
                                                        disabled={isViewMode}
                                                    />
                                                </div>

                                                <div>
                                                    <Label className="text-xs font-bold uppercase tracking-wider opacity-60">Email Address *</Label>
                                                    <Input
                                                        type="email"
                                                        value={formData.email}
                                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                        placeholder="user@drmis.gov.et"
                                                        required
                                                        disabled={isViewMode}
                                                    />
                                                </div>

                                                <div>
                                                    <Label className="text-xs font-bold uppercase tracking-wider opacity-60">Phone Number</Label>
                                                    <Input
                                                        type="text"
                                                        value={formData.phone}
                                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                                        placeholder="+251 9..."
                                                        disabled={isViewMode}
                                                    />
                                                </div>

                                                <div>
                                                    <Label className="text-xs font-bold uppercase tracking-wider opacity-60">Account Status</Label>
                                                    <select
                                                        value={formData.status}
                                                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                                        className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-4 text-xs font-medium outline-none transition focus:border-primary dark:border-white/10 dark:bg-white/5 dark:text-white"
                                                        disabled={isViewMode}
                                                    >
                                                        <option value="active">Active</option>
                                                        <option value="pending">Pending Verification</option>
                                                        <option value="suspended">Suspended</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Column: Workplace Organization & Pure RBAC */}
                                    <div className="lg:col-span-7 space-y-6">
                                        
                                        {/* Card 1: Workplace Selection */}
                                        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.03] space-y-4">
                                            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-white/5">
                                                <Building2 className="text-brand-600 dark:text-brand-400" size={20} />
                                                <div>
                                                    <h5 className="text-sm font-bold text-slate-900 dark:text-white">Workplace Assignment</h5>
                                                    <p className="text-[11px] text-slate-500">Select whether user operates at Head Office or a Subcity Branch</p>
                                                </div>
                                            </div>

                                            {/* Segmented Type Toggle */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    type="button"
                                                    disabled={isViewMode || (user?.accessLevel === 'branch_admin' && !user?.roles?.some((r: any) => ['Super Admin', 'super_admin'].includes(r.name)))}
                                                    onClick={() => handleOrgTypeChange('head_office')}
                                                    className={`flex items-center gap-2.5 p-3 rounded-2xl border transition-all text-left ${
                                                        formData.organizationType === 'head_office'
                                                            ? 'border-emerald-500 bg-emerald-50/80 text-emerald-900 dark:border-emerald-500/50 dark:bg-emerald-950/30 dark:text-emerald-300 shadow-sm'
                                                            : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                                                    }`}
                                                >
                                                    <div className={`p-2 rounded-xl ${formData.organizationType === 'head_office' ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-white/10 text-slate-500'}`}>
                                                        <Building2 size={18} />
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-xs">Head Office</div>
                                                        <div className="text-[10px] opacity-75">Central DRM Headquarters</div>
                                                    </div>
                                                </button>

                                                <button
                                                    type="button"
                                                    disabled={isViewMode}
                                                    onClick={() => handleOrgTypeChange('branch')}
                                                    className={`flex items-center gap-2.5 p-3 rounded-2xl border transition-all text-left ${
                                                        formData.organizationType === 'branch'
                                                            ? 'border-blue-500 bg-blue-50/80 text-blue-900 dark:border-blue-500/50 dark:bg-blue-950/30 dark:text-blue-300 shadow-sm'
                                                            : 'border-slate-200 hover:border-slate-300 bg-slate-50/50 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                                                    }`}
                                                >
                                                    <div className={`p-2 rounded-xl ${formData.organizationType === 'branch' ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-white/10 text-slate-500'}`}>
                                                        <MapPin size={18} />
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-xs">Subcity Branch</div>
                                                        <div className="text-[10px] opacity-75">Territorial Branch Office</div>
                                                    </div>
                                                </button>
                                            </div>

                                            {/* Organization Dropdown */}
                                            {formData.organizationType === 'head_office' ? (
                                                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5 dark:border-emerald-900/40 dark:bg-emerald-950/20 text-xs space-y-2">
                                                    <div className="flex items-center justify-between font-semibold text-emerald-900 dark:text-emerald-300">
                                                        <span className="flex items-center gap-1.5">
                                                            <CheckCircle2 size={14} className="text-emerald-600" />
                                                            Head Office Assigned: {selectedOrg?.name || headOffices[0]?.name || 'Central Head Office'}
                                                        </span>
                                                        <span className="text-[10px] bg-emerald-200/80 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-200 px-2 py-0.5 rounded-full font-bold">
                                                            City-Wide Scope
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                                                        Users assigned to Head Office have city-wide administrative reach across all subcities and branches according to their assigned RBAC role.
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="space-y-3">
                                                    <div>
                                                        <Label className="text-xs font-bold uppercase tracking-wider opacity-60">Select Branch *</Label>
                                                        <select
                                                            value={formData.organization}
                                                            onChange={(e) => setFormData({ ...formData, organization: e.target.value })}
                                                            disabled={isViewMode || (user?.accessLevel === 'branch_admin' && !user?.roles?.some((r: any) => ['Super Admin', 'super_admin'].includes(r.name)) && !!formData.organization)}
                                                            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-4 text-xs font-semibold outline-none transition focus:border-primary dark:border-white/10 dark:bg-gray-800 dark:text-white"
                                                            required
                                                        >
                                                            <option value="">-- Choose Branch --</option>
                                                            {branches.map(b => (
                                                                <option key={b.id || b._id} value={b.id || b._id}>
                                                                    {b.name} {b.subcityName ? `(${b.subcityName} Subcity)` : ''}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </div>

                                                    {formData.organization && (
                                                        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-3.5 dark:border-blue-900/40 dark:bg-blue-950/20 text-xs space-y-1.5">
                                                            <div className="flex items-center justify-between font-semibold text-blue-900 dark:text-blue-300">
                                                                <span className="flex items-center gap-1.5">
                                                                    <MapPin size={14} className="text-blue-600" />
                                                                    Branch Territory: {subcityName ? `${subcityName} Subcity` : selectedOrg?.name}
                                                                </span>
                                                                <span className="text-[10px] bg-blue-200 text-blue-900 dark:bg-blue-900 dark:text-blue-200 px-2 py-0.5 rounded-full font-bold">
                                                                    Territorial Scope
                                                                </span>
                                                            </div>
                                                            <p className="text-[11px] text-slate-600 dark:text-slate-400">
                                                                This user is strictly restricted to viewing and managing assessments, incidents, and data belonging to this branch's subcity and woredas.
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Card 2: Pure RBAC & Access Control */}
                                        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.03] space-y-4">
                                            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100 dark:border-white/5">
                                                <Shield className="text-brand-600 dark:text-brand-400" size={20} />
                                                <div>
                                                    <h5 className="text-sm font-bold text-slate-900 dark:text-white">Role-Based Access Control (RBAC)</h5>
                                                    <p className="text-[11px] text-slate-500">Access and permissions are governed solely by assigned roles</p>
                                                </div>
                                            </div>

                                            <div>
                                                <Label className="text-xs font-bold uppercase tracking-wider opacity-60">System Security Level</Label>
                                                <select
                                                    value={formData.accessLevel}
                                                    onChange={(e) => setFormData({ ...formData, accessLevel: e.target.value })}
                                                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 px-4 text-xs font-semibold outline-none transition focus:border-primary dark:border-white/10 dark:bg-gray-800 dark:text-white"
                                                    disabled={isViewMode}
                                                >
                                                    <option value="expert">🎓 Expert / Specialist</option>
                                                    <option value="branch_admin">🛡️ Branch Admin</option>
                                                    <option value="team_leader">👥 Team Leader</option>
                                                    <option value="directorate">🏢 Directorate Lead</option>
                                                    <option value="deputy">🏛️ Deputy Director</option>
                                                    <option value="manager">⚙️ Manager</option>
                                                    <option value="super_admin">👑 Super Admin</option>
                                                    <option value="public">🌍 Public User</option>
                                                </select>
                                            </div>

                                            {/* Roles multi-select */}
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <Label className="text-xs font-bold uppercase tracking-wider opacity-60">Assigned Roles</Label>
                                                    <span className="text-[10px] text-slate-400 font-semibold">{formData.roles.length} selected</span>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2 max-h-44 overflow-y-auto pr-1 custom-scrollbar">
                                                    {roles.map(r => {
                                                        const roleId = r._id || r.id || '';
                                                        const isSelected = formData.roles.includes(roleId);

                                                        return (
                                                            <label
                                                                key={roleId}
                                                                className={`flex items-start gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                                                                    isSelected
                                                                        ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
                                                                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-slate-300 dark:bg-white/5 dark:border-white/10 dark:text-slate-300'
                                                                } ${isViewMode ? 'pointer-events-none opacity-80' : ''}`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    checked={isSelected}
                                                                    onChange={() => {
                                                                        setFormData(prev => ({
                                                                            ...prev,
                                                                            roles: isSelected
                                                                                ? prev.roles.filter(id => id !== roleId)
                                                                                : [...prev.roles, roleId]
                                                                        }));
                                                                    }}
                                                                    className="mt-0.5 rounded text-brand-600"
                                                                    disabled={isViewMode}
                                                                />
                                                                <div className="flex flex-col">
                                                                    <span className="font-semibold text-[11px] leading-tight">{r.name}</span>
                                                                    {r.description && (
                                                                        <span className={`text-[9px] mt-0.5 line-clamp-1 ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                                                                            {r.description}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-between px-8 py-5 bg-slate-50/50 dark:bg-white/[0.02] border-t border-slate-200 dark:border-white/10">
                                <div>
                                    {!isViewMode && (
                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                                            <span className="text-red-500">*</span> Required fields are strictly monitored
                                        </p>
                                    )}
                                </div>
                                <div className="flex items-center gap-3">
                                    <Button 
                                        variant="outline" 
                                        onClick={closeModal} 
                                        type="button"
                                        className="rounded-xl px-6"
                                    >
                                        {isViewMode ? 'Close' : 'Cancel'}
                                    </Button>
                                    {!isViewMode && (
                                        <Button 
                                            type="submit"
                                            className="rounded-xl px-8 shadow-lg shadow-brand-600/20"
                                        >
                                            {editUser ? 'Save Account Changes' : 'Register User'}
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </form>
                    </div>
                </Modal>

                {/* Role Management Modal */}
                <Modal isOpen={isRoleModalOpen} onClose={() => setIsRoleModalOpen(false)} className="max-w-md">
                    <div className="overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
                        <div className="bg-gradient-to-r from-brand-600 to-brand-700 px-6 py-6 text-white">
                            <div className="flex items-center gap-4">
                                <div className="h-11 w-11 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center">
                                    <KeyRound size={22} />
                                </div>
                                <div>
                                    <h4 className="text-lg font-bold">Manage User Roles</h4>
                                    <p className="text-xs text-brand-100 opacity-80">{selectedUserForRoles?.fullname}</p>
                                </div>
                            </div>
                        </div>

                        <form onSubmit={handleUpdateRoles} className="p-6">
                            <div className="space-y-4">
                                <Label className="text-xs font-bold uppercase tracking-wider opacity-60">Selected Roles</Label>
                                <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {roles.map(r => (
                                        <label
                                            key={r._id || r.id}
                                            className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                                                formData.roles.includes(r._id || r.id || '')
                                                ? 'bg-brand-50 border-brand-200 text-brand-700 dark:bg-brand-900/20 dark:border-brand-800 dark:text-brand-300'
                                                : 'bg-white border-slate-100 text-slate-600 hover:border-brand-200 dark:bg-white/5 dark:border-white/10 dark:text-white/40'
                                            }`}
                                        >
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold">{r.name}</span>
                                                {r.description && <span className="text-[10px] opacity-60">{r.description}</span>}
                                            </div>
                                            <input
                                                type="checkbox"
                                                checked={formData.roles.includes(r._id || r.id || '')}
                                                onChange={() => {
                                                    const roleId = r._id || r.id || '';
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        roles: prev.roles.includes(roleId)
                                                            ? prev.roles.filter(id => id !== roleId)
                                                            : [...prev.roles, roleId]
                                                    }));
                                                }}
                                                className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                                            />
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-6 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsRoleModalOpen(false)}
                                    className="flex-1 rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-white/50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 rounded-xl bg-brand-600 py-2.5 text-xs font-bold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </Modal>
            </div>
        </>
    );
}
