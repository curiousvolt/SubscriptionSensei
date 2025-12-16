import { Sparkles } from "lucide-react";

export function Header() {
  return (
    <header className="py-5 px-4 border-b border-border/30">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-lg font-bold tracking-tight">
              Subscription Sensei
            </h1>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
              Streaming Optimizer
            </p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-success" />
          <span>Smart Optimization</span>
        </div>
      </div>
    </header>
  );
}