import { Button } from "@/components/ui/button";
import { Home, RotateCcw, Share2 } from "lucide-react";

interface EndScreenActionsProps {
  onHome: () => void;
  onRestart: () => void;
  onShare: () => void;
  copied: boolean;
  primaryBtnClass: string;
  outlineBtnClass: string;
  shareBtnClass: string;
}

export function EndScreenActions({
  onHome,
  onRestart,
  onShare,
  copied,
  primaryBtnClass,
  outlineBtnClass,
  shareBtnClass,
}: EndScreenActionsProps) {
  return (
    <>
      {/* Mobile layout */}
      <div className="flex items-center justify-between gap-3 sm:hidden mb-3">
        <Button
          onClick={onHome}
          variant="outline"
          size="lg"
          className={`${outlineBtnClass} flex-1`}
          data-testid="button-home-end"
        >
          <Home className="w-5 h-5 mr-2" />
          Home
        </Button>
        <Button
          onClick={onShare}
          variant="outline"
          size="lg"
          className={`font-bold flex-1 ${shareBtnClass}`}
        >
          <Share2 className="w-5 h-5 mr-2" />
          {copied ? "Copied!" : "Share"}
        </Button>
      </div>
      <div className="flex justify-center sm:hidden">
        <Button
          onClick={onRestart}
          size="lg"
          className={`text-lg px-10 font-bold w-full ${primaryBtnClass}`}
          data-testid="button-restart"
        >
          <RotateCcw className="w-5 h-5 mr-2" />
          Play Again
        </Button>
      </div>

      {/* Desktop layout */}
      <div className="hidden sm:flex items-center justify-center gap-3">
        <Button
          onClick={onHome}
          variant="outline"
          size="lg"
          className={outlineBtnClass}
          data-testid="button-home-end"
        >
          <Home className="w-5 h-5 mr-2" />
          Home
        </Button>
        <Button
          onClick={onRestart}
          size="lg"
          className={`text-lg px-10 font-bold ${primaryBtnClass}`}
          data-testid="button-restart"
        >
          <RotateCcw className="w-5 h-5 mr-2" />
          Play Again
        </Button>
        <Button
          onClick={onShare}
          variant="outline"
          size="lg"
          className={`font-bold ${shareBtnClass}`}
        >
          <Share2 className="w-5 h-5 mr-2" />
          {copied ? "Copied!" : "Share"}
        </Button>
      </div>
    </>
  );
}
