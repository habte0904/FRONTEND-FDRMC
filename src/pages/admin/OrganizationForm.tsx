import React, { useState, useEffect } from 'react';
import Button from "../../components/ui/button/Button";
import Input from "../../components/form/input/InputField";
import Label from "../../components/form/Label";
import { Organization, getOrganizations } from '../../api/organizationService';
import { getSubcities, getWoredas, Subcity, Woreda } from '../../api/locationService';
import { Building2, MapPin, Shield, AlertCircle, Sparkles } from 'lucide-react';

interface OrganizationFormProps {
    initialData?: Organization | null;
    isViewMode?: boolean;
    onSave: (data: any) => Promise<void>;
    onCancel: () => void;
}

export const OrganizationForm: React.FC<OrganizationFormProps> = ({ initialData, isViewMode = false, onSave, onCancel }) => {
    const [formData, setFormData] = useState({
        name: '',
        type: 'branch',
        parentId: '',
        subcity: '',
        subcityName: '',
        branchCode: '',
        phone: '',
        email: '',
        address: '',
        description: '',
        status: 'active'
    });

    const [loading, setLoading] = useState(false);
    const [organizations, setOrganizations] = useState<Organization[]>([]);
    const [subcities, setSubcities] = useState<Subcity[]>([]);
    const [branchWoredas, setBranchWoredas] = useState<Woreda[]>([]);
    const [loadingWoredas, setLoadingWoredas] = useState(false);

    useEffect(() => {
        fetchSubcities();
        fetchOrganizations();
    }, []);

    useEffect(() => {
        if (initialData) {
            const subId = typeof initialData.subcity === 'object' && initialData.subcity
                ? initialData.subcity._id
                : (initialData.subcity || '');

            setFormData({
                name: initialData.name || '',
                type: initialData.type || 'branch',
                parentId: (typeof initialData.parentId === 'object' && initialData.parentId ? (initialData.parentId as any)._id || (initialData.parentId as any).id : initialData.parentId) || '',
                subcity: subId,
                subcityName: initialData.subcityName || (typeof initialData.subcity === 'object' && initialData.subcity ? initialData.subcity.name : ''),
                branchCode: initialData.branchCode || '',
                phone: initialData.phone || '',
                email: initialData.email || '',
                address: initialData.address || '',
                description: initialData.description || '',
                status: initialData.status || 'active'
            });

            if (subId) {
                loadWoredasForSubcity(subId);
            }
        }
    }, [initialData]);

    const fetchSubcities = async () => {
        try {
            const data = await getSubcities();
            setSubcities(data);
        } catch (error) {
            console.error("Failed to fetch subcities", error);
        }
    };

    const fetchOrganizations = async () => {
        try {
            const data = await getOrganizations();
            setOrganizations(data);
        } catch (error) {
            console.error("Failed to fetch organizations", error);
        }
    };

    const loadWoredasForSubcity = async (subcityId: string) => {
        try {
            setLoadingWoredas(true);
            const woredas = await getWoredas(subcityId);
            setBranchWoredas(woredas);
        } catch (error) {
            console.error("Failed to load woredas for subcity", error);
        } finally {
            setLoadingWoredas(false);
        }
    };

    const handleSubcitySelect = (subcityId: string) => {
        const found = subcities.find(s => s._id === subcityId);
        const subName = found ? found.name : '';

        // Auto-generate name and branchCode if not manually edited or empty
        const shouldSuggestName = !formData.name || formData.name.endsWith('Branch');
        const shouldSuggestCode = !formData.branchCode || formData.branchCode.startsWith('BR-');

        const cleanCodePart = subName.toUpperCase().replace(/\s+/g, '').replace(/[^A-Z0-9]/g, '');

        setFormData(prev => ({
            ...prev,
            subcity: subcityId,
            subcityName: subName,
            name: shouldSuggestName && subName ? `${subName} Branch` : prev.name,
            branchCode: shouldSuggestCode && subName ? `BR-${cleanCodePart}` : prev.branchCode
        }));

        if (subcityId) {
            loadWoredasForSubcity(subcityId);
        } else {
            setBranchWoredas([]);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isViewMode) return;
        setLoading(true);
        try {
            const submissionData = {
                ...formData,
                parentId: formData.parentId === '' ? null : formData.parentId,
                subcity: formData.type === 'branch' ? formData.subcity || null : null,
                subcityName: formData.type === 'branch' ? formData.subcityName || null : null,
                branchCode: formData.branchCode ? formData.branchCode.toUpperCase().trim() : undefined
            };
            await onSave(submissionData);
        } catch (error) {
            console.error("Error submitting form", error);
        } finally {
            setLoading(false);
        }
    };

    const selectedSubcityObj = subcities.find(s => s._id === formData.subcity);

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 max-h-[80vh] overflow-y-auto px-1 pr-3">
            {/* Organization Type Selector */}
            <div>
                <Label className="mb-2">Organization Structure Type</Label>
                <div className="grid grid-cols-2 gap-3">
                    <button
                        type="button"
                        disabled={isViewMode}
                        onClick={() => setFormData(prev => ({ ...prev, type: 'head_office', subcity: '', subcityName: '', branchCode: '' }))}
                        className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all text-left ${
                            formData.type === 'head_office'
                                ? 'border-primary bg-primary/10 text-primary shadow-sm dark:bg-primary/20'
                                : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 bg-white/40 dark:bg-white/5 text-slate-700 dark:text-slate-300'
                        }`}
                    >
                        <div className={`p-2 rounded-xl ${formData.type === 'head_office' ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400'}`}>
                            <Building2 size={20} />
                        </div>
                        <div>
                            <div className="font-semibold text-sm">Head Office</div>
                            <div className="text-xs opacity-70">Central Headquarters</div>
                        </div>
                    </button>

                    <button
                        type="button"
                        disabled={isViewMode}
                        onClick={() => setFormData(prev => ({ ...prev, type: 'branch' }))}
                        className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all text-left ${
                            formData.type === 'branch'
                                ? 'border-primary bg-primary/10 text-primary shadow-sm dark:bg-primary/20'
                                : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 bg-white/40 dark:bg-white/5 text-slate-700 dark:text-slate-300'
                        }`}
                    >
                        <div className={`p-2 rounded-xl ${formData.type === 'branch' ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400'}`}>
                            <MapPin size={20} />
                        </div>
                        <div>
                            <div className="font-semibold text-sm">Branch (Subcity)</div>
                            <div className="text-xs opacity-70">Controls Subcity & Woredas</div>
                        </div>
                    </button>
                </div>
            </div>

            {/* Subcity Jurisdiction Linkage (Only for Branch type) */}
            {formData.type === 'branch' && (
                <div className="rounded-2xl border border-blue-200/80 bg-blue-50/50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20 space-y-3">
                    <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-semibold text-sm">
                        <MapPin size={18} className="text-blue-600 dark:text-blue-400" />
                        Subcity Territorial Assignment
                    </div>

                    <div>
                        <Label>Select Subcity Controlled by this Branch *</Label>
                        <select
                            name="subcity"
                            value={formData.subcity}
                            onChange={(e) => handleSubcitySelect(e.target.value)}
                            disabled={isViewMode}
                            required={formData.type === 'branch'}
                            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-gray-800 dark:text-white"
                        >
                            <option value="">-- Choose Subcity --</option>
                            {subcities.map(sub => (
                                <option key={sub._id} value={sub._id}>
                                    {sub.name} Subcity
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Live Preview of Jurisdiction and Woredas */}
                    {formData.subcity ? (
                        <div className="rounded-xl border border-blue-200 bg-white/80 p-3.5 dark:border-blue-800/40 dark:bg-gray-850 space-y-2.5">
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                                    <Shield size={14} className="text-emerald-500" />
                                    Controlled Woredas Jurisdiction ({branchWoredas.length} woredas)
                                </span>
                                <span className="text-[11px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 px-2 py-0.5 rounded-full font-medium">
                                    Territorial Isolation Active
                                </span>
                            </div>

                            {loadingWoredas ? (
                                <div className="text-xs text-slate-500 py-1 flex items-center gap-2">
                                    <span className="animate-spin">⏳</span> Loading woredas under {selectedSubcityObj?.name || formData.subcityName}...
                                </div>
                            ) : branchWoredas.length > 0 ? (
                                <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                                    {branchWoredas.map(w => (
                                        <span
                                            key={w._id}
                                            className="inline-flex items-center px-2 py-0.5 rounded-md bg-blue-100/80 text-blue-800 text-[11px] font-medium dark:bg-blue-900/40 dark:text-blue-200"
                                        >
                                            {w.name}
                                        </span>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-xs text-slate-500 italic">
                                    No woredas registered under this subcity yet. You can register them in Location Management.
                                </div>
                            )}

                            <div className="flex items-start gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                                <AlertCircle size={13} className="text-blue-500 shrink-0 mt-0.5" />
                                <span>Users assigned to this branch will only be able to view and manage data from <strong>{selectedSubcityObj?.name || formData.subcityName}</strong> and its woredas.</span>
                            </div>
                        </div>
                    ) : (
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                            <Sparkles size={14} className="text-amber-500" />
                            Selecting a subcity will automatically associate all underlying woredas to this branch.
                        </div>
                    )}
                </div>
            )}

            {/* Name and Branch Code */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label>Organization / Branch Name *</Label>
                    <Input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder={formData.type === 'branch' ? "e.g. Yeka Branch" : "e.g. DRM Central Commission"}
                        required
                        disabled={isViewMode}
                    />
                </div>

                <div>
                    <Label>Branch Code {formData.type === 'branch' && '*'}</Label>
                    <Input
                        type="text"
                        name="branchCode"
                        value={formData.branchCode}
                        onChange={handleChange}
                        placeholder={formData.type === 'branch' ? "e.g. BR-YEKA" : "e.g. HQ-01"}
                        disabled={isViewMode}
                    />
                </div>
            </div>

            {/* Parent Organization & Status */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label>Parent Organization (Optional)</Label>
                    <select
                        name="parentId"
                        value={formData.parentId}
                        onChange={handleChange}
                        disabled={isViewMode}
                        className="w-full rounded-xl border border-slate-200 bg-transparent px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-primary dark:border-slate-700 dark:bg-gray-800 dark:text-white"
                    >
                        <option value="">None (Top Level)</option>
                        {organizations
                            .filter(org => org.id !== initialData?.id && org._id !== initialData?.id)
                            .map(org => (
                                <option key={org.id || org._id} value={org.id || org._id}>
                                    {org.name} ({org.type?.replace('_', ' ')})
                                </option>
                            ))}
                    </select>
                </div>

                <div>
                    <Label>Operational Status</Label>
                    <select
                        name="status"
                        value={formData.status}
                        onChange={handleChange}
                        disabled={isViewMode}
                        className="w-full rounded-xl border border-slate-200 bg-transparent px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-primary dark:border-slate-700 dark:bg-gray-800 dark:text-white"
                    >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                    </select>
                </div>
            </div>

            {/* Contact Details (2 Columns) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label>Contact Phone</Label>
                    <Input
                        type="text"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder="+251 9..."
                        disabled={isViewMode}
                    />
                </div>
                <div>
                    <Label>Contact Email</Label>
                    <Input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder="branch@drmis.gov.et"
                        disabled={isViewMode}
                    />
                </div>
            </div>

            {/* Physical Address / Office Location */}
            <div>
                <Label>Office Address / Physical Location</Label>
                <Input
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    placeholder="e.g. Subcity Administration Building, Floor 3"
                    disabled={isViewMode}
                />
            </div>

            {/* Description */}
            <div>
                <Label>Description / Responsibilities</Label>
                <textarea
                    name="description"
                    rows={2}
                    value={formData.description}
                    onChange={handleChange}
                    disabled={isViewMode}
                    placeholder="Brief description about this branch and its disaster management operations..."
                    className="w-full rounded-xl border border-slate-200 bg-transparent px-4 py-2 text-sm text-slate-900 outline-none transition focus:border-primary dark:border-slate-700 dark:bg-gray-800 dark:text-white"
                />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-3 mt-3 justify-end pt-3 border-t border-slate-100 dark:border-white/10">
                <Button size="sm" variant="outline" onClick={onCancel} type="button">
                    {isViewMode ? 'Close' : 'Cancel'}
                </Button>
                {!isViewMode && (
                    <Button size="sm" type="submit" disabled={loading}>
                        {loading ? 'Saving Branch...' : initialData ? 'Update Organization' : 'Create Organization'}
                    </Button>
                )}
            </div>
        </form>
    );
};
