import React, { useState, useEffect } from "react";
import { useModal } from "../../hooks/useModal";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../hooks/useToast";
import api from "../../api/axios";
import { User as UserIcon, Mail, Phone, Briefcase, Edit2 } from "lucide-react";

interface User {
  id: string;
  fullname: string;
  email: string;
  phone?: string;
  status: string;
  roles?: { id: string; name: string }[];
  department?: { id: string; name: string };
  organization?: { id: string; name: string };
}

export default function UserInfoCard({ user }: { user: User }) {
  const { isOpen, openModal, closeModal } = useModal();
  const { refreshUser } = useAuth();
  const toast = useToast();

  const [fullname, setFullname] = useState(user.fullname || "");
  const [email, setEmail] = useState(user.email || "");
  const [phone, setPhone] = useState(user.phone || "");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setFullname(user.fullname || "");
    setEmail(user.email || "");
    setPhone(user.phone || "");
  }, [user]);

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoading(true);
    try {
      const userId = user.id || (user as any)._id;
      const formData = new FormData();
      formData.append("fullname", fullname);
      formData.append("email", email);
      if (phone) formData.append("phone", phone);

      await api.put(`/users/${userId}`, formData);
      await refreshUser();
      toast.success("Profile information updated successfully!");
      closeModal();
    } catch (error: any) {
      console.error("Failed to update profile info", error);
      toast.error(error.response?.data?.message || "Failed to update profile info");
    } finally {
      setIsLoading(false);
    }
  };

  const nameParts = (user.fullname || "").split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "-";

  return (
    <div className="p-5 border border-gray-200 rounded-2xl bg-white dark:border-gray-800 dark:bg-gray-900 lg:p-6">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-brand-500" />
            Official Personal Credentials
          </h4>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-7 2xl:gap-x-24">
            <div>
              <p className="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                First Name
              </p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {firstName}
              </p>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
                Last Name
              </p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {lastName}
              </p>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" /> Email Address
              </p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {user.email}
              </p>
            </div>

            <div>
              <p className="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" /> Official Phone
              </p>
              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                {user.phone || "-"}
              </p>
            </div>

            <div className="sm:col-span-2">
              <p className="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Briefcase className="w-3.5 h-3.5" /> Assigned Operational Role
              </p>
              <p className="text-sm font-semibold text-brand-600 dark:text-brand-400">
                {user.roles && user.roles.length > 0
                  ? user.roles.map((r) => r.name).join(", ")
                  : "User"}
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={openModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 cursor-pointer shadow-xs shrink-0"
        >
          <Edit2 className="w-3.5 h-3.5 text-gray-500" />
          Edit Credentials
        </button>
      </div>

      <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[650px] m-4">
        <div className="relative w-full rounded-2xl bg-white p-6 dark:bg-gray-900 lg:p-8">
          <div className="pb-4 mb-5 border-b border-gray-100 dark:border-gray-800">
            <h4 className="text-lg font-bold text-gray-900 dark:text-white">
              Edit Personal Credentials
            </h4>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Update your name, email, and contact phone number.
            </p>
          </div>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <Label>Full Name</Label>
              <Input
                type="text"
                value={fullname}
                onChange={(e) => setFullname(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label>Email Address</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label>Official Phone</Label>
                <Input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+251 ..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              <Button size="sm" variant="outline" onClick={closeModal} type="button">
                Cancel
              </Button>
              <Button size="sm" type="submit" disabled={isLoading}>
                {isLoading ? "Saving..." : "Save Credentials"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
