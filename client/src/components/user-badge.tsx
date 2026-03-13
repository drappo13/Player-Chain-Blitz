import { useState } from "react";
import { useUser } from "@/lib/user-context";
import { LogOut } from "lucide-react";

export function UserBadge() {
  const { user, logout } = useUser();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  return (
    <div className="fixed top-3 right-3 z-40">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-card border border-border text-sm hover:bg-muted transition-colors shadow-sm"
      >
        <span className="text-base">{user.avatar}</span>
        <span className="text-foreground font-medium text-xs max-w-[80px] truncate">
          {user.username}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1.5 z-50 rounded-lg border border-border bg-card shadow-lg py-1 min-w-[120px]">
            <button
              onClick={() => {
                logout();
                setOpen(false);
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Log out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
