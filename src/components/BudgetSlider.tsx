import { DollarSign } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { TOTAL_ALL_SERVICES } from "@/data/services";

interface BudgetSliderProps {
  budget: number;
  setBudget: (value: number) => void;
}

export function BudgetSlider({ budget, setBudget }: BudgetSliderProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Monthly Budget</h2>
        <div className="flex items-center gap-1 bg-gradient-primary text-primary-foreground px-3 py-1 rounded-full font-bold">
          <DollarSign className="w-4 h-4" />
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
          <span className="text-primary">
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
            className={`px-3 py-1 text-sm rounded-full border transition-all ${
              Math.abs(budget - amount) < 1
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:border-primary/50"
            }`}
          >
            ${amount}
          </button>
        ))}
      </div>
    </div>
  );
}
