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

export function UsernamePicker() {
  const { signup, login } = useUser();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [username, setUsername] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const result =
      mode === "signup"
        ? await signup(username, avatar)
        : await login(username);

    if (!result.ok) {
      setError(result.error || "Something went wrong");
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl"
      >
        <div className="text-center mb-5">
          <h2 className="text-xl font-bold text-foreground">
            {mode === "signup" ? "Welcome to drapk.in" : "Welcome back"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "signup"
              ? "Pick a username & avatar to get started"
              : "Enter your username to continue"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError("");
              }}
              placeholder="Username"
              autoFocus
              maxLength={16}
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
                <p className="text-xs text-muted-foreground mb-2">Choose an avatar</p>
                <div className="grid grid-cols-8 gap-1.5">
                  {AVATARS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setAvatar(emoji)}
                      className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${
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
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "signup" ? "login" : "signup");
            setError("");
          }}
          className="w-full mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
        >
          {mode === "signup"
            ? "Already have a username? Log in"
            : "New here? Create a username"}
        </button>
      </motion.div>
    </div>
  );
}
