import { DollarSign } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { TOTAL_ALL_SERVICES } from "@/data/services";
import { cn } from "@/lib/utils";

interface BudgetSliderProps {
  budget: number;
  setBudget: (value: number) => void;
}

export function BudgetSlider({ budget, setBudget }: BudgetSliderProps) {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-base font-semibold tracking-tight">Monthly Budget</h2>
        <div className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-lg text-sm font-semibold border border-primary/20">
          <DollarSign className="w-3.5 h-3.5" />
          <span>{budget.toFixed(2)}</span>
        </div>
      </div>

      <div className="space-y-3">
        <Slider
          value={[budget]}
          onValueChange={(values) => setBudget(values[0])}
          min={0}
          max={TOTAL_ALL_SERVICES}
          step={1}
          className="cursor-pointer"
        />

        <div className="flex justify-between text-xs text-muted-foreground">
          <span>$0</span>
          <span>
            All services: ${TOTAL_ALL_SERVICES.toFixed(2)}/mo
          </span>
        </div>
      </div>

      {/* Quick budget buttons */}
      <div className="flex flex-wrap gap-2">
        {[15, 25, 35, 50, 75].map((amount) => (
          <button
            key={amount}
            onClick={() => setBudget(amount)}
            className={cn(
              "px-3 py-1.5 text-sm rounded-lg border transition-all duration-150",
              Math.abs(budget - amount) < 1
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
            )}
          >
            ${amount}
          </button>
        ))}
      </div>
    </div>
  );
}