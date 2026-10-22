import { MapPin, Building, Lock, ShieldCheck } from "lucide-react";

interface User {
  id: string;
  fullname: string;
  email: string;
  phone?: string;
  status: string;
  subcity?: string;
  kebele?: string;
  roles?: { id: string; name: string }[];
  department?: { id: string; name: string };
  organization?: { id: string; name: string };
}

export default function UserAddressCard({ user }: { user: User }) {
  return (
    <div className="p-6 border border-gray-200 rounded-2xl bg-white shadow-xs">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="w-full">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-brand-600" />
              Administrative Duty Location
            </h4>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
              <Lock className="w-3.5 h-3.5 text-amber-600" />
              Admin Managed
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
            <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200">
              <p className="mb-1 text-xs font-bold text-gray-500 uppercase tracking-wider">
                Country
              </p>
              <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <span>🇪🇹</span> Ethiopia
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200">
              <p className="mb-1 text-xs font-bold text-gray-500 uppercase tracking-wider">
                City / Region
              </p>
              <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <Building className="w-4 h-4 text-gray-400" /> Addis Ababa
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200">
              <p className="mb-1 text-xs font-bold text-gray-500 uppercase tracking-wider">
                Subcity Assignment
              </p>
              <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-brand-600" />
                {user.subcity ? `${user.subcity} Subcity` : "City-wide / Head Office Jurisdiction"}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200">
              <p className="mb-1 text-xs font-bold text-gray-500 uppercase tracking-wider">
                Woreda / Kebele
              </p>
              <p className="text-sm font-bold text-gray-900">
                {user.kebele || "All Woredas in Subcity"}
              </p>
            </div>
          </div>

          {/* Locked Notice */}
          <div className="mt-4 flex items-start gap-2.5 p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              Administrative duty assignments are locked to safeguard your role-based data permissions. Subcity and Woreda updates must be executed by a Super Administrator or Branch Administrator.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
