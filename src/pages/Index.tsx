import { useState } from "react";
import { Sparkles, Zap } from "lucide-react";
import { Header } from "@/components/Header";
import { WatchlistInput } from "@/components/WatchlistInput";
import { BudgetSlider } from "@/components/BudgetSlider";
import { OptimizationResults } from "@/components/OptimizationResults";
import { SubscriptionTimeline } from "@/components/SubscriptionTimeline";
import { Button } from "@/components/ui/button";
import { WatchlistItem } from "@/data/sampleContent";
import { optimizeSubscriptions, OptimizationResult } from "@/lib/optimizer";

const Index = () => {
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [budget, setBudget] = useState(35);
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);

  const handleOptimize = async () => {
    if (watchlist.length === 0) return;

    setIsOptimizing(true);
    
    // Simulate AI processing time
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    const optimizationResult = optimizeSubscriptions(watchlist, budget);
    setResult(optimizationResult);
    setIsOptimizing(false);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Background gradient effect */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <Header />

      <main className="relative max-w-6xl mx-auto px-4 py-8">
        {/* Hero Section */}
        <section className="text-center mb-12">
          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
            Stop Overpaying for{" "}
            <span className="text-gradient-primary">Streaming</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            AI-powered optimization that tells you exactly which services to
            subscribe to based on your watchlist and budget.
          </p>
        </section>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left Column: Input */}
          <div className="space-y-8">
            <div className="glass rounded-2xl p-6">
              <WatchlistInput watchlist={watchlist} setWatchlist={setWatchlist} />
            </div>

            <div className="glass rounded-2xl p-6">
              <BudgetSlider budget={budget} setBudget={setBudget} />
            </div>

            <Button
              variant="gradient"
              size="xl"
              className="w-full"
              onClick={handleOptimize}
              disabled={watchlist.length === 0 || isOptimizing}
            >
              {isOptimizing ? (
                <>
                  <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Optimized Plan
                </>
              )}
            </Button>
          </div>

          {/* Right Column: Results */}
          <div className="space-y-6">
            {result ? (
              <>
                <OptimizationResults result={result} />
                <div className="glass rounded-2xl p-6">
                  <SubscriptionTimeline result={result} />
                </div>
              </>
            ) : (
              <div className="glass rounded-2xl p-8 text-center h-full flex flex-col items-center justify-center min-h-[400px]">
                <div className="w-16 h-16 rounded-2xl bg-gradient-primary/20 flex items-center justify-center mb-4">
                  <Zap className="w-8 h-8 text-primary" />
                </div>
                <h3 className="font-display text-xl font-semibold mb-2">
                  Your Plan Awaits
                </h3>
                <p className="text-muted-foreground text-sm max-w-xs">
                  Add items to your watchlist and set your budget, then click
                  "Generate Optimized Plan" to see your personalized
                  recommendation.
                </p>

                <div className="mt-8 grid grid-cols-3 gap-4 w-full max-w-sm">
                  <FeatureItem icon="📺" label="Smart Analysis" />
                  <FeatureItem icon="💰" label="Save Money" />
                  <FeatureItem icon="🎯" label="Prioritized" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Attribution */}
        <footer className="mt-16 text-center text-xs text-muted-foreground">
          <p>
            Data powered by{" "}
            <a
              href="https://www.themoviedb.org"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              TMDB
            </a>
            {" & "}
            <a
              href="https://www.justwatch.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
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
      <div className="text-2xl mb-1">{icon}</div>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

export default Index;
