import { useState } from "react";
import {
  TrendingDown,
  Tv,
  Clock,
  ChevronDown,
  ChevronUp,
  Info,
  Check,
  Layers,
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

  const getServiceLogo = (serviceId: string) => {
    const service = STREAMING_SERVICES.find((s) => s.id === serviceId);
    return service?.logo || "📺";
  };

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Hero Metrics - Refined */}
      <div className="grid grid-cols-4 gap-3">
        <MetricCard
          icon={<TrendingDown className="w-4 h-4" />}
          label="Savings"
          value={`$${result.estimatedSavings.toFixed(0)}`}
          variant="success"
        />
        <MetricCard
          icon={<Tv className="w-4 h-4" />}
          label="Coverage"
          value={`${result.coveragePercent}%`}
          variant="default"
        />
        <MetricCard
          icon={<Layers className="w-4 h-4" />}
          label="Services"
          value={result.subscribeThisMonth.length.toString()}
          variant="default"
        />
        <MetricCard
          icon={<Clock className="w-4 h-4" />}
          label="Cost"
          value={`$${result.totalCost.toFixed(0)}`}
          variant="muted"
        />
      </div>

      {/* Subscribe This Month */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground tracking-wide uppercase">
          This Month
        </h3>

        {result.subscribeThisMonth.length === 0 ? (
          <div className="surface-elevated rounded-xl p-6 text-center text-muted-foreground">
            <p>No services fit within your budget.</p>
            <p className="text-sm mt-1">Try increasing your budget.</p>
          </div>
        ) : (
          <div className="space-y-2">
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
          <h3 className="text-sm font-medium text-muted-foreground tracking-wide uppercase">
            Deferred
          </h3>

          <div className="surface-elevated rounded-xl divide-y divide-border/50">
            {result.deferredItems.map(({ item, reason }) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-3 first:rounded-t-xl last:rounded-b-xl"
              >
                {/* Priority Dot */}
                <div 
                  className={cn(
                    "priority-dot",
                    item.priority === "high" && "priority-dot-high",
                    item.priority === "medium" && "priority-dot-medium",
                    item.priority === "low" && "priority-dot-low"
                  )}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{item.title}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {reason}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Explanation */}
      <div>
        <button
          onClick={() => setShowExplanation(!showExplanation)}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors duration-150"
        >
          <Info className="w-3.5 h-3.5" />
          <span>Why this plan?</span>
          {showExplanation ? (
            <ChevronUp className="w-3.5 h-3.5" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
        </button>

        {showExplanation && (
          <div className="mt-3 surface-elevated rounded-xl p-4 text-sm text-muted-foreground animate-fade-in">
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
  variant = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  variant?: "default" | "success" | "muted";
}) {
  return (
    <div className="surface-elevated rounded-xl p-3 text-center">
      <div className={cn(
        "flex justify-center mb-1.5",
        variant === "success" && "text-success",
        variant === "muted" && "text-muted-foreground",
        variant === "default" && "text-primary"
      )}>
        {icon}
      </div>
      <p
        className={cn(
          "font-display text-lg font-bold",
          variant === "success" && "text-success",
          variant === "muted" && "text-foreground",
          variant === "default" && "text-foreground"
        )}
      >
        {value}
      </p>
      <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">{label}</p>
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
      className="surface-elevated rounded-xl overflow-hidden animate-slide-up"
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <button
        onClick={onToggle}
        className="w-full p-3.5 flex items-center gap-3 hover:bg-secondary/30 transition-colors duration-150"
      >
        <span className="text-xl">{logo}</span>
        <div className="flex-1 text-left">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-sm">{service.serviceName}</span>
            <span className="text-xs text-muted-foreground">
              ${service.cost.toFixed(2)}/mo
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            {service.itemsToWatch.length} items
          </p>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="px-3.5 pb-3.5 pt-2 border-t border-border/30 animate-fade-in">
          <div className="space-y-1">
            {service.itemsToWatch.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 text-sm py-1.5"
              >
                <Check className="w-3.5 h-3.5 text-success shrink-0" />
                <span className="truncate">{item.title}</span>
                {item.episodeCount && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {item.episodeCount} eps
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