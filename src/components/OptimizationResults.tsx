import { useState } from "react";
import {
  TrendingDown,
  Tv,
  Clock,
  ChevronDown,
  ChevronUp,
  Info,
  Check,
} from "lucide-react";
import { OptimizationResult, OptimizedService } from "@/lib/optimizer";
import { STREAMING_SERVICES } from "@/data/services";
import { cn } from "@/lib/utils";

interface OptimizationResultsProps {
  result: OptimizationResult;
}

export function OptimizationResults({ result }: OptimizationResultsProps) {
  const [expandedService, setExpandedService] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  const getServiceColor = (serviceId: string) => {
    const service = STREAMING_SERVICES.find((s) => s.id === serviceId);
    return service?.color || "primary";
  };

  const getServiceLogo = (serviceId: string) => {
    const service = STREAMING_SERVICES.find((s) => s.id === serviceId);
    return service?.logo || "📺";
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Hero Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard
          icon={<TrendingDown className="w-5 h-5 text-success" />}
          label="Monthly Savings"
          value={`$${result.estimatedSavings.toFixed(2)}`}
          highlight
        />
        <MetricCard
          icon={<Tv className="w-5 h-5 text-primary" />}
          label="Coverage"
          value={`${result.coveragePercent}%`}
        />
        <MetricCard
          icon={<Check className="w-5 h-5 text-primary" />}
          label="Services"
          value={result.subscribeThisMonth.length.toString()}
        />
        <MetricCard
          icon={<Clock className="w-5 h-5 text-warning" />}
          label="Total Cost"
          value={`$${result.totalCost.toFixed(2)}`}
        />
      </div>

      {/* Subscribe This Month */}
      <div className="space-y-3">
        <h3 className="font-display text-lg font-semibold flex items-center gap-2">
          <span className="text-2xl">📺</span> Subscribe This Month
        </h3>

        {result.subscribeThisMonth.length === 0 ? (
          <div className="glass rounded-xl p-6 text-center text-muted-foreground">
            <p>No services fit within your budget.</p>
            <p className="text-sm mt-1">Try increasing your budget.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {result.subscribeThisMonth.map((service, index) => (
              <ServiceCard
                key={service.service}
                service={service}
                index={index}
                isExpanded={expandedService === service.service}
                onToggle={() =>
                  setExpandedService(
                    expandedService === service.service ? null : service.service
                  )
                }
                logo={getServiceLogo(service.service)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Deferred Items */}
      {result.deferredItems.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-display text-lg font-semibold flex items-center gap-2">
            <span className="text-2xl">⏭️</span> Parking Lot (Defer)
          </h3>

          <div className="glass rounded-xl p-4 space-y-2">
            {result.deferredItems.map(({ item, reason }) => (
              <div
                key={item.id}
                className="flex items-start gap-3 py-2 border-b border-border/50 last:border-0"
              >
                <div className="flex-1">
                  <p className="font-medium text-sm">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {reason}
                  </p>
                </div>
                <span
                  className={cn(
                    "text-xs px-2 py-0.5 rounded capitalize",
                    item.priority === "high" &&
                      "bg-destructive/20 text-destructive",
                    item.priority === "medium" && "bg-warning/20 text-warning",
                    item.priority === "low" && "bg-muted text-muted-foreground"
                  )}
                >
                  {item.priority}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Explanation */}
      <div className="space-y-2">
        <button
          onClick={() => setShowExplanation(!showExplanation)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Info className="w-4 h-4" />
          <span>Why This Plan?</span>
          {showExplanation ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {showExplanation && (
          <div className="glass rounded-xl p-4 text-sm text-muted-foreground animate-slide-up">
            {result.explanation}
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  highlight = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "glass rounded-xl p-4 text-center",
        highlight && "ring-1 ring-success/50 glow-success"
      )}
    >
      <div className="flex justify-center mb-2">{icon}</div>
      <p
        className={cn(
          "font-display text-xl font-bold",
          highlight && "text-success"
        )}
      >
        {value}
      </p>
      <p className="text-xs text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function ServiceCard({
  service,
  index,
  isExpanded,
  onToggle,
  logo,
}: {
  service: OptimizedService;
  index: number;
  isExpanded: boolean;
  onToggle: () => void;
  logo: string;
}) {
  return (
    <div
      className="glass rounded-xl overflow-hidden animate-slide-up"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center gap-3 hover:bg-secondary/50 transition-colors"
      >
        <span className="text-2xl">{logo}</span>
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{service.serviceName}</span>
            <span className="text-sm text-muted-foreground">
              ${service.cost.toFixed(2)}/mo
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {service.itemsToWatch.length} items • Value density:{" "}
            {service.valueDensity.toFixed(2)}
          </p>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 pt-2 border-t border-border/50 animate-slide-up">
          <p className="text-xs text-muted-foreground mb-2">Items to watch:</p>
          <div className="space-y-1">
            {service.itemsToWatch.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 text-sm py-1"
              >
                <Check className="w-4 h-4 text-success" />
                <span>{item.title}</span>
                {item.episodeCount && (
                  <span className="text-xs text-muted-foreground">
                    ({item.episodeCount} episodes)
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
