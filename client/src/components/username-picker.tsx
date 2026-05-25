import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@/lib/user-context";
import { Button } from "@/components/ui/button";

const AVATARS = [
  "\u26BD", "\uD83C\uDFBE", "\uD83C\uDFCE\uFE0F", "\uD83C\uDFC0", "\u26BE", "\uD83C\uDFC8",
  "\uD83E\uDD4A", "\uD83C\uDFD2", "\u26F3", "\uD83C\uDFAF", "\uD83C\uDFC6", "\uD83E\uDD47",
  "\uD83E\uDD81", "\uD83D\uDC2F", "\uD83E\uDD8A", "\uD83D\uDC3A", "\uD83E\uDD85", "\uD83D\uDC09",
  "\uD83D\uDC51", "\u2B50", "\uD83D\uDD25", "\uD83D\uDC8E", "\u26A1", "\uD83C\uDF1F",
];

interface UsernamePickerProps {
  /** Override the signup-mode title (default: "Welcome to drapk.in") */
  signupTitle?: string;
  /** Override the signup-mode subtitle (default: "Pick a username & avatar to get started") */
  signupSubtitle?: string;
}

export function UsernamePicker({ signupTitle, signupSubtitle }: UsernamePickerProps = {}) {
  const { signup, login } = useUser();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [takenUsername, setTakenUsername] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setTakenUsername("");
    setSubmitting(true);

    const result =
      mode === "signup"
        ? await signup(username, avatar)
        : await login(username);

    if (!result.ok) {
      if (result.error === "Username taken") {
        setTakenUsername(username.trim());
      } else {
        setError(result.error || "Something went wrong");
      }
    }
    setSubmitting(false);
  };

  const handleLoginAsTaken = async () => {
    setTakenUsername("");
    setError("");
    setSubmitting(true);
    const result = await login(takenUsername);
    if (!result.ok) {
      setError(result.error || "Something went wrong");
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-full flex items-start sm:items-center justify-center px-4 pt-6 pb-[60vh] sm:pt-0 sm:pb-0">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm rounded-xl border border-border bg-card p-4 sm:p-6 shadow-2xl"
      >
        <div className="text-center mb-3 sm:mb-5">
          <h2 className="text-lg sm:text-xl font-bold text-foreground">
            {mode === "signup" ? (signupTitle ?? "Welcome to drapk.in") : "Welcome back"}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">
            {mode === "signup"
              ? (signupSubtitle ?? "Pick a username & avatar to get started")
              : "Enter your username to continue"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
          <div>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError("");
                setTakenUsername("");
              }}
              placeholder="Username"
              autoFocus
              maxLength={15}
              className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-foreground/30 focus:ring-1 focus:ring-foreground/10"
            />
          </div>

          <AnimatePresence mode="wait">
            {mode === "signup" && (
              <motion.div
                key="avatars"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
              >
                <p className="text-xs text-muted-foreground mb-1.5">Choose an avatar</p>
                <div className="grid grid-cols-8 gap-1">
                  {AVATARS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setAvatar(emoji)}
                      className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg text-base sm:text-lg flex items-center justify-center transition-all ${
                        avatar === emoji
                          ? "bg-foreground/15 ring-2 ring-foreground/30 scale-110"
                          : "hover:bg-foreground/10"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <p className="text-xs text-red-400 text-center">{error}</p>
          )}

          {takenUsername && (
            <div className="rounded-lg border border-border bg-background/50 p-3 text-center space-y-2">
              <p className="text-xs text-muted-foreground">
                <span className="font-bold text-foreground">{takenUsername}</span> already exists
              </p>
              <Button
                type="button"
                onClick={handleLoginAsTaken}
                disabled={submitting}
                className="w-full font-bold"
                size="sm"
              >
                {submitting ? "..." : `Log in as ${takenUsername}`}
              </Button>
            </div>
          )}

          {!takenUsername && (
            <Button
              type="submit"
              disabled={submitting || !username.trim()}
              className="w-full font-bold"
              size="lg"
            >
              {submitting
                ? "..."
                : mode === "signup"
                  ? `Claim ${avatar}`
                  : "Log in"}
            </Button>
          )}
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signup" ? "login" : "signup");
            setError("");
            setTakenUsername("");
          }}
          className="w-full mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
        >
          {mode === "signup"
            ? "Already have a username? Log in"
            : "New here? Create a username"}
        </button>
      </motion.div>
      </div>
    </div>
  );
}
