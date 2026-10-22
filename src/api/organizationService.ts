import api from './axios';

export interface Organization {
    id: string; // or _id
    _id?: string;
    name: string;
    type: 'head_office' | 'branch' | 'subcity' | 'woreda' | string;
    parentId?: string | { id?: string; _id?: string; name: string; type?: string } | null;
    subcity?: string | { _id: string; name: string } | null;
    subcityName?: string;
    branchCode?: string;
    phone?: string;
    email?: string;
    address?: string;
    description?: string;
    status?: 'active' | 'inactive';
    woredasCount?: number;
    woredas?: Array<{ _id: string; name: string }>;
    createdAt?: string;
    updatedAt?: string;
}

export interface OrganizationInput {
    name: string;
    type: string;
    parentId?: string | null;
    subcity?: string | null;
    subcityName?: string;
    branchCode?: string;
    phone?: string;
    email?: string;
    address?: string;
    description?: string;
    status?: string;
}

export const getOrganizations = async () => {
    const response = await api.get('/organizations');
    return response.data;
};

export const getOrganizationById = async (id: string) => {
    const response = await api.get(`/organizations/${id}`);
    return response.data;
};

export const createOrganization = async (data: OrganizationInput) => {
    const response = await api.post('/organizations', data);
    return response.data;
};

export const updateOrganization = async (id: string, data: OrganizationInput) => {
    const response = await api.put(`/organizations/${id}`, data);
    return response.data;
};

export const deleteOrganization = async (id: string) => {
    const response = await api.delete(`/organizations/${id}`);
    return response.data;
};
