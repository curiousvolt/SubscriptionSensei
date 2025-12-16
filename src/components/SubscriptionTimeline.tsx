import { Calendar, ChevronRight, DollarSign, Film, Tv, Clock } from "lucide-react";
import { OptimizationResult, MonthlyPlan } from "@/lib/optimizer";
import { STREAMING_SERVICES } from "@/data/services";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface SubscriptionTimelineProps {
  result: OptimizationResult;
}

export function SubscriptionTimeline({ result }: SubscriptionTimelineProps) {
  const { rotationSchedule, totalMonthsNeeded, averageMonthlyCost } = result;

  const getServiceLogo = (serviceId: string) => {
    const service = STREAMING_SERVICES.find((s) => s.id === serviceId);
    return service?.logo || "📺";
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "subscribe":
        return "bg-success/20 border-success/50 text-success";
      case "rotate":
        return "bg-warning/20 border-warning/50 text-warning";
      case "keep":
        return "bg-primary/20 border-primary/50 text-primary";
      case "cancel":
        return "bg-destructive/20 border-destructive/50 text-destructive";
      default:
        return "bg-muted";
    }
  };

  if (rotationSchedule.length === 0) {
    return null;
  }

  // Calculate total cost and savings
  const totalCost = rotationSchedule.reduce((sum, m) => sum + m.monthlyCost, 0);
  const allServicesMonthly = STREAMING_SERVICES.reduce((sum, s) => sum + s.price, 0);
  const potentialSavings = (allServicesMonthly * totalMonthsNeeded) - totalCost;

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Pricing Overview */}
      <div className="glass rounded-xl p-4 border border-border/50">
        <h3 className="font-display text-base font-semibold mb-3 flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-primary" />
          Service Pricing
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {STREAMING_SERVICES.map((service) => (
            <div
              key={service.id}
              className="flex items-center gap-2 bg-secondary/30 rounded-lg px-3 py-2"
            >
              <span className="text-lg">{service.logo}</span>
              <div className="flex flex-col">
                <span className="text-xs font-medium truncate">{service.name}</span>
                <span className="text-xs text-muted-foreground">${service.price.toFixed(2)}/mo</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-primary">{totalMonthsNeeded}</p>
          <p className="text-xs text-muted-foreground">Months to Watch All</p>
        </div>
        <div className="glass rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-success">${totalCost.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground">Total Cost</p>
        </div>
        <div className="glass rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-warning">${potentialSavings.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground">You Save</p>
        </div>
      </div>

      {/* Timeline Header */}
      <h3 className="font-display text-lg font-semibold flex items-center gap-2">
        <Calendar className="w-5 h-5 text-primary" />
        Your Watching Schedule
      </h3>

      {/* Timeline */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-8 bottom-4 w-0.5 bg-border" />

        <div className="space-y-4">
          {rotationSchedule.map((plan, index) => (
            <TimelineMonth
              key={`${plan.month}-${index}`}
              plan={plan}
              index={index}
              getServiceLogo={getServiceLogo}
              getActionColor={getActionColor}
              isLast={index === rotationSchedule.length - 1}
            />
          ))}
        </div>
      </div>

      {/* Pro Tip */}
      <div className="glass rounded-xl p-4 border border-primary/20">
        <p className="text-sm font-medium mb-1">💡 Pro Tip</p>
        <p className="text-xs text-muted-foreground">
          Set calendar reminders to cancel and rotate services at the end of each month. 
          Most services allow easy re-subscription when you're ready!
        </p>
      </div>
    </div>
  );
}

interface TimelineMonthProps {
  plan: MonthlyPlan;
  index: number;
  getServiceLogo: (id: string) => string;
  getActionColor: (action: string) => string;
  isLast: boolean;
}

function TimelineMonth({ plan, index, getServiceLogo, getActionColor, isLast }: TimelineMonthProps) {
  const movieCount = plan.itemsToWatch.filter(i => i.type === "movie").length;
  const seriesCount = plan.itemsToWatch.filter(i => i.type === "tv").length;

  return (
    <div
      className="relative flex items-start gap-4 animate-slide-up"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Timeline dot */}
      <div
        className={cn(
          "relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 shrink-0",
          index === 0
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-card border-border"
        )}
      >
        {index + 1}
      </div>

      {/* Content */}
      <div className="flex-1 glass rounded-xl p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-lg">{plan.month}</span>
            <span className="text-sm text-muted-foreground">
              ${plan.monthlyCost.toFixed(2)}
            </span>
          </div>
          <span
            className={cn(
              "text-xs px-2 py-0.5 rounded-full border capitalize",
              getActionColor(plan.action)
            )}
          >
            {plan.action}
          </span>
        </div>

        {/* Active Services */}
        <div className="flex flex-wrap gap-2">
          {plan.services.map((service) => (
            <div
              key={service.service}
              className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-1.5"
            >
              <span className="text-lg">{getServiceLogo(service.service)}</span>
              <span className="text-sm font-medium">{service.serviceName}</span>
            </div>
          ))}
        </div>

        {/* What to Watch This Month */}
        {plan.itemsToWatch.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>Watch this month:</span>
              {movieCount > 0 && (
                <Badge variant="secondary" className="text-xs py-0">
                  <Film className="w-3 h-3 mr-1" />
                  {movieCount} movie{movieCount > 1 ? "s" : ""}
                </Badge>
              )}
              {seriesCount > 0 && (
                <Badge variant="secondary" className="text-xs py-0">
                  <Tv className="w-3 h-3 mr-1" />
                  {seriesCount} series
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {plan.itemsToWatch.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "text-xs px-2 py-1 rounded-md border",
                    item.priority === "high"
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : item.priority === "medium"
                      ? "bg-warning/10 border-warning/30 text-warning"
                      : "bg-secondary border-border text-foreground"
                  )}
                >
                  {item.type === "movie" ? "🎬" : "📺"} {item.title}
                </div>
              ))}
            </div>
          </div>
        )}

        {index === 0 && (
          <p className="text-xs text-success font-medium">
            ▶ Start here! Best time to begin your streaming journey.
          </p>
        )}
      </div>

      {!isLast && (
        <ChevronRight className="absolute -bottom-3 left-3 w-4 h-4 text-muted-foreground" />
      )}
    </div>
  );
}
