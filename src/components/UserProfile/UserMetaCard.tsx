import { useState } from "react";
import { Camera, Edit2 } from "lucide-react";
import ProfileAvatarModal from "./ProfileAvatarModal";
import { resolvePortalAssetUrl } from "../../utils/resolvePortalAssetUrl";

interface User {
  id: string;
  fullname: string;
  email: string;
  phone?: string;
  status: string;
  roles?: { id: string; name: string }[];
  department?: { id: string; name: string };
  organization?: { id: string; name: string };
  profileImage?: string;
}

export default function UserMetaCard({ user }: { user: User }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const avatarUrl = resolvePortalAssetUrl(user.profileImage) || "/images/user/users.png";
  const userId = user.id || (user as any)._id;

  return (
    <>
      <div className="p-5 border border-gray-200 rounded-2xl bg-white dark:border-gray-800 dark:bg-gray-900 lg:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            <div className="relative group shrink-0">
              <div className="w-20 h-20 overflow-hidden border-2 border-brand-500/30 rounded-full shadow-md">
                <img
                  src={avatarUrl}
                  alt={user.fullname || "User"}
                  className="h-full w-full object-cover"
                />
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                title="Change Photo"
              >
                <Camera className="w-5 h-5" />
              </button>
            </div>

            <div>
              <h4 className="text-lg font-bold text-gray-900 dark:text-white">
                {user.fullname}
              </h4>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                <span className="font-semibold text-brand-600 dark:text-brand-400">
                  {user.roles && user.roles.length > 0 ? user.roles.map((r) => r.name).join(", ") : "User"}
                </span>
                <span>•</span>
                <span>{user.organization?.name || "Disaster Risk Commission"}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 cursor-pointer shadow-xs"
          >
            <Edit2 className="w-3.5 h-3.5 text-gray-500" />
            Edit Photo
          </button>
        </div>
      </div>

      <ProfileAvatarModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        currentImage={user.profileImage}
        userId={userId}
      />
    </>
  );
}
