import React, { createContext, useContext, useState, useEffect } from 'react';
import { getMyHierarchy } from '../api/hierarchyService';

interface HierarchyContextType {
    accessLevel: string;
    organizationType: string;
    subordinates: any[];
    managedDepartments: any[];
    managedTeams: any[];
    reportsTo: any;
    delegatedBy: any;
    delegatedAuthority: {
        canManageTeams: boolean;
        canManageDepartments: boolean;
        canApproveReports: boolean;
        expiresAt?: Date;
    };
    organization: any;
    department: any;
    team: any;
    loading: boolean;
    refreshHierarchy: () => Promise<void>;
}

const HierarchyContext = createContext<HierarchyContextType | null>(null);

export const HierarchyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [hierarchyData, setHierarchyData] = useState<HierarchyContextType>({
        accessLevel: 'expert',
        organizationType: 'branch',
        subordinates: [],
        managedDepartments: [],
        managedTeams: [],
        reportsTo: null,
        delegatedBy: null,
        delegatedAuthority: {
            canManageTeams: false,
            canManageDepartments: false,
            canApproveReports: false
        },
        organization: null,
        department: null,
        team: null,
        loading: true,
        refreshHierarchy: async () => { }
    });

    const fetchHierarchyData = async () => {
        try {
            const response = await getMyHierarchy();

            setHierarchyData({
                accessLevel: response.user.accessLevel || 'expert',
                organizationType: response.user.organizationType || 'branch',
                subordinates: response.subordinates || [],
                managedDepartments: response.user.managedDepartments || [],
                managedTeams: response.user.managedTeams || [],
                reportsTo: response.user.reportsTo || null,
                delegatedBy: response.user.delegatedBy || null,
                delegatedAuthority: response.user.delegatedAuthority || {
                    canManageTeams: false,
                    canManageDepartments: false,
                    canApproveReports: false
                },
                organization: response.user.organization || null,
                department: response.user.department || null,
                team: response.user.team || null,
                loading: false,
                refreshHierarchy: fetchHierarchyData
            });
        } catch (error) {
            console.error('Failed to fetch hierarchy data', error);
            setHierarchyData(prev => ({ ...prev, loading: false }));
        }
    };

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            fetchHierarchyData();
        } else {
            setHierarchyData(prev => ({ ...prev, loading: false }));
        }
    }, []);

    return (
        <HierarchyContext.Provider value={hierarchyData}>
            {children}
        </HierarchyContext.Provider>
    );
};

export const useHierarchy = () => {
    const context = useContext(HierarchyContext);
    if (!context) {
        throw new Error('useHierarchy must be used within HierarchyProvider');
    }
    return context;
};

// Helper hooks for common checks
export const useCanDelegate = () => {
    const { accessLevel } = useHierarchy();
    const allowedLevels = ['super_admin', 'manager', 'deputy', 'directorate', 'branch_admin'];
    return allowedLevels.includes(accessLevel);
};

export const useCanManageTeams = () => {
    const { accessLevel, delegatedAuthority } = useHierarchy();
    const allowedLevels = ['super_admin', 'manager', 'deputy', 'directorate', 'branch_admin'];
    return allowedLevels.includes(accessLevel) || delegatedAuthority.canManageTeams;
};

export const useCanManageDepartments = () => {
    const { accessLevel, delegatedAuthority } = useHierarchy();
    const allowedLevels = ['super_admin', 'manager', 'deputy', 'branch_admin'];
    return allowedLevels.includes(accessLevel) || delegatedAuthority.canManageDepartments;
};

export const useIsSuperAdmin = () => {
    const { accessLevel } = useHierarchy();
    return accessLevel === 'super_admin';
};

export const useIsManager = () => {
    const { accessLevel } = useHierarchy();
    return accessLevel === 'manager';
};

export const useIsHeadOffice = () => {
    const { organizationType } = useHierarchy();
    return organizationType === 'head_office';
};

const getStoredUser = () => {
    try {
        const stored = localStorage.getItem('user');
        if (stored) return JSON.parse(stored);
    } catch {
        // ignore
    }
    return null;
};

/**
 * Returns true if the logged-in user is assigned to a branch (subcity branch).
 * Head Office and Super Admin users return false.
 */
export const useIsBranchUser = () => {
    const { organizationType, accessLevel, loading } = useHierarchy();
    if (!loading) {
        if (accessLevel === 'super_admin') return false;
        return organizationType === 'branch';
    }
    const stored = getStoredUser();
    if (!stored) return false;
    if (stored.accessLevel === 'super_admin' || stored.organizationType === 'head_office') return false;
    return stored.organizationType === 'branch' || stored.organization?.type === 'branch';
};

/**
 * Returns the branch subcity name if the user is a branch user, or null otherwise.
 * Reads from organization.subcityName which is populated by the backend.
 */
export const useBranchSubcity = () => {
    const { organization, organizationType, accessLevel, loading } = useHierarchy();
    if (!loading) {
        if (accessLevel === 'super_admin' || organizationType === 'head_office') return null;
        if (organizationType === 'branch') {
            const name = (organization as any)?.subcityName ||
                ((organization as any)?.name ? (organization as any).name.replace(/\s+branch$/i, '').trim() : null);
            if (name) return name;
        }
    }
    const stored = getStoredUser();
    if (!stored) return null;
    if (stored.accessLevel === 'super_admin' || stored.organizationType === 'head_office') return null;
    const org = stored.organization;
    if (!org) return null;
    const name = org.subcityName || (org.name ? org.name.replace(/\s+branch$/i, '').trim() : null);
    return name || null;
};
