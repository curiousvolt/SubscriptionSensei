import { useState, useMemo } from "react";
import { Sparkles, Zap, AlertTriangle } from "lucide-react";
import { Header } from "@/components/Header";
import { WatchlistInput } from "@/components/WatchlistInput";
import { BudgetSlider } from "@/components/BudgetSlider";
import { OptimizationResults } from "@/components/OptimizationResults";
import { SubscriptionTimeline } from "@/components/SubscriptionTimeline";
import { Button } from "@/components/ui/button";
import { WatchlistItem } from "@/data/sampleContent";
import { optimizeSubscriptions, OptimizationResult, checkWatchlistReadiness } from "@/lib/optimizer";

const Index = () => {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [budget, setBudget] = useState(35);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);

  // Check if watchlist is ready for optimization
  const readiness = useMemo(() => checkWatchlistReadiness(watchlist), [watchlist]);

  const handleOptimize = async () => {
    if (watchlist.length === 0 || !readiness.isReady) return;

    setIsOptimizing(true);
    
    // Simulate AI processing time
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    const optimizationResult = optimizeSubscriptions(watchlist, budget);
    setResult(optimizationResult);
    setIsOptimizing(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Subtle background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/3 w-[600px] h-[600px] bg-primary/[0.03] rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-accent/[0.02] rounded-full blur-[100px]" />
      </div>

      <Header />

      <main className="relative max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Hero Section */}
        <section className="text-center mb-12 sm:mb-16">
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
            Stop Overpaying for{" "}
            <span className="text-gradient-primary">Streaming</span>
          </h1>
          <p className="text-muted-foreground text-base sm:text-lg max-w-xl mx-auto leading-relaxed">
            Smart optimization that tells you exactly which services to
            subscribe to based on your watchlist.
          </p>
        </section>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Left Column: Input */}
          <div className="space-y-5">
            <div className="surface-elevated rounded-2xl p-5 sm:p-6">
              <WatchlistInput watchlist={watchlist} setWatchlist={setWatchlist} />
            </div>

            <div className="surface-elevated rounded-2xl p-5 sm:p-6">
              <BudgetSlider budget={budget} setBudget={setBudget} />
            </div>

            {/* Warning for missing platform selections */}
            {!readiness.isReady && watchlist.length > 0 && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-warning/5 border border-warning/20">
                <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-warning">
                    Platform selection required
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {readiness.highPriorityMissingPlatform.length} high-priority item(s) need a streaming platform.
                  </p>
                </div>
              </div>
            )}

            <Button
              variant="gradient"
              size="xl"
              className="w-full"
              onClick={handleOptimize}
              disabled={watchlist.length === 0 || isOptimizing || !readiness.isReady}
            >
              {isOptimizing ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Analyzing...
                </>
              ) : !readiness.isReady && watchlist.length > 0 ? (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  Select Platforms First
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Plan
                </>
              )}
            </Button>
          </div>

          {/* Right Column: Results */}
          <div className="space-y-5">
            {result ? (
              <>
                <OptimizationResults result={result} />
                <div className="surface-elevated rounded-2xl p-5 sm:p-6">
                  <SubscriptionTimeline result={result} />
                </div>
              </>
            ) : (
              <div className="surface-elevated rounded-2xl p-8 sm:p-10 text-center h-full flex flex-col items-center justify-center min-h-[420px]">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                  <Zap className="w-7 h-7 text-primary" />
                </div>
                <h3 className="font-display text-xl font-semibold mb-2 tracking-tight">
                  Your Plan Awaits
                </h3>
                <p className="text-muted-foreground text-sm max-w-xs leading-relaxed">
                  Add shows to your watchlist and set your budget to get a personalized recommendation.
                </p>

                <div className="mt-10 flex items-center gap-8">
                  <FeatureItem icon="📺" label="Smart" />
                  <FeatureItem icon="💰" label="Savings" />
                  <FeatureItem icon="🎯" label="Priority" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Attribution */}
        <footer className="mt-16 sm:mt-20 text-center text-xs text-muted-foreground/60">
          <p>
            Powered by{" "}
            <a
              href="https://www.themoviedb.org"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-muted-foreground transition-colors"
            >
              TMDB
            </a>
            {" · "}
            <a
              href="https://www.justwatch.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-muted-foreground transition-colors"
            >
              JustWatch
            </a>
          </p>
        </footer>
      </main>
    </div>
  );
};

function FeatureItem({ icon, label }: { icon: string; label: string }) {
  return (
    <div className="text-center">
      <div className="text-xl mb-1.5">{icon}</div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
    </div>
  );
}

export default Index;