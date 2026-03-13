import { useState, useCallback } from "react";

export function useShare() {
  const [copied, setCopied] = useState(false);

  const share = useCallback(async (text: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ text });
      } catch {}
    } else {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  return { share, copied };
}
