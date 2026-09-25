import {
  MoreVertical,
  Copy,
  Check,
  LogOut,
  Trash2,
} from "lucide-react";

interface Props {
  menuOpen: boolean;
  setMenuOpen: (v: boolean) => void;
  copied: boolean;
  code: string;
  copyCode: () => void;
  exitOrganization: () => void;
  deleteOrganization: () => void;
}

export default function OrganizationMenu({
  menuOpen,
  setMenuOpen,
  copied,
  code,
  copyCode,
  exitOrganization,
  deleteOrganization,
}: Props) {
  return (
    <div className="absolute top-5 right-5">
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="w-10 h-10 rounded-full bg-white/15 border border-white/20 flex items-center justify-center"
      >
        <MoreVertical size={18} />
      </button>

      {menuOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-none shadow-xl border overflow-hidden z-50 shadow-brutal">
          <button
            onClick={() => {
              copyCode();
              setMenuOpen(false);
            }}
            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50"
          >
            {copied ? (
              <Check size={18} className="text-green-600" />
            ) : (
              <Copy size={18} className="text-primary" />
            )}

            <div className="text-left">
              <p className="text-xs text-gray-500">Invitation Code</p>
              <p className="font-semibold text-gray-900">{code}</p>
            </div>
          </button>

          <div className="border-t" />

          <button
            onClick={exitOrganization}
            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-orange-50"
          >
            <LogOut size={18} className="text-orange-600" />
            Exit Organization
          </button>

          <div className="border-t" />

          <button
            onClick={deleteOrganization}
            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-red-50 text-red-600"
          >
            <Trash2 size={18} />
            Delete Organization
          </button>
        </div>
      )}
    </div>
  );
}