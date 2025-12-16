import { Sparkles } from "lucide-react";

export function Header() {
  return (
    <header className="py-6 px-4 border-b border-border/50">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow-primary">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-gradient-primary">
              Subscription Sensei
            </h1>
            <p className="text-xs text-muted-foreground">AI-Powered Streaming Optimizer</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            Smart Optimization
          </span>
        </div>
      </div>
    </header>
  );
}
