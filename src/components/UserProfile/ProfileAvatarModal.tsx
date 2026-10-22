import React, { useState, useRef } from "react";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import { Camera, Upload, Trash2, X, Check, Image as ImageIcon } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../hooks/useToast";
import { resolvePortalAssetUrl } from "../../utils/resolvePortalAssetUrl";
import api from "../../api/axios";

interface ProfileAvatarModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentImage?: string;
  userId: string;
}

export default function ProfileAvatarModal({
  isOpen,
  onClose,
  currentImage,
  userId,
}: ProfileAvatarModalProps) {
  const { refreshUser } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const resolvedCurrent = resolvePortalAssetUrl(currentImage) || "/images/user/users.png";

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select a valid image file (JPEG, PNG, WEBP).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file size must be less than 5MB.");
      return;
    }
    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleSave = async () => {
    if (!selectedFile) {
      onClose();
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("profileImage", selectedFile);

      await api.put(`/users/${userId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      await refreshUser();
      toast.success("Profile photo updated successfully!");
      handleClose();
    } catch (error: any) {
      console.error("Failed to update profile photo", error);
      toast.error(error.response?.data?.message || "Failed to update profile photo.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!currentImage) {
      toast.info("No custom photo to remove.");
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append("removeProfileImage", "true");

      await api.put(`/users/${userId}`, formData);
      await refreshUser();
      toast.success("Profile photo removed.");
      handleClose();
    } catch (error: any) {
      console.error("Failed to remove profile photo", error);
      toast.error(error.response?.data?.message || "Failed to remove profile photo.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    onClose();
  };

  const displayImage = previewUrl || resolvedCurrent;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} className="max-w-[560px] m-4">
      <div className="relative w-full rounded-2xl bg-white p-6 lg:p-8 shadow-xl border-2 border-gray-200 text-gray-900">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b-2 border-gray-200">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-50 border border-brand-200 text-brand-600">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-gray-900">
                Update Profile Photo
              </h3>
              <p className="text-xs font-semibold text-gray-600">
                Upload a professional headshot for official DRM systems
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-gray-500 rounded-lg hover:bg-gray-100 hover:text-gray-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="py-6 space-y-6">
          {/* Avatar Preview */}
          <div className="flex flex-col items-center justify-center">
            <div className="relative group">
              <div className="relative w-36 h-36 rounded-full overflow-hidden p-1 bg-gradient-to-tr from-brand-500 via-indigo-500 to-sky-400 shadow-xl">
                <div className="w-full h-full rounded-full overflow-hidden bg-white">
                  <img
                    src={displayImage}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              {previewUrl && (
                <span className="absolute bottom-1 right-1 flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500 text-white shadow-lg border-2 border-white">
                  <Check className="w-4 h-4 stroke-[3]" />
                </span>
              )}
            </div>
            <p className="mt-3 text-xs font-bold text-gray-700">
              {previewUrl ? "New photo preview (click Save Photo to apply)" : "Current profile avatar"}
            </p>
          </div>

          {/* Drag & Drop Box */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition-all ${
              isDragging
                ? "border-brand-600 bg-brand-50"
                : "border-gray-300 hover:border-brand-500 bg-gray-50/70"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/png, image/jpeg, image/jpg, image/webp"
              className="hidden"
            />
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white border border-gray-200 text-brand-600 shadow-xs">
                <Upload className="w-6 h-6" />
              </div>
              <div className="text-sm font-extrabold text-gray-800">
                <span className="text-brand-700 underline decoration-2">
                  Click to choose file
                </span>{" "}
                or drag and drop here
              </div>
              <p className="text-xs font-semibold text-gray-500">
                PNG, JPG, or WEBP (Max 5MB • 1:1 square ratio recommended)
              </p>
            </div>
          </div>

          {/* File selected indicator */}
          {selectedFile && (
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-brand-50 border-2 border-brand-200">
              <div className="flex items-center gap-3 overflow-hidden">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-brand-100 text-brand-700 shrink-0">
                  <ImageIcon className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <p className="text-xs font-bold text-gray-900 truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-[11px] font-semibold text-gray-500">
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedFile(null);
                  if (previewUrl) URL.revokeObjectURL(previewUrl);
                  setPreviewUrl(null);
                }}
                className="p-1 text-gray-500 hover:text-rose-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t-2 border-gray-200">
          <div>
            {currentImage && !previewUrl && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 text-xs font-extrabold text-rose-600 hover:text-rose-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remove photo
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={!selectedFile || isLoading}
            >
              {isLoading ? "Saving..." : "Save Photo"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
