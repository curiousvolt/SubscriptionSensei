import { Calendar, ChevronRight, Film, Tv, Clock, AlertTriangle } from "lucide-react";
import { OptimizationResult, MonthlyPlan, ScheduledItem } from "@/lib/optimizer";
import { STREAMING_SERVICES } from "@/data/services";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface SubscriptionTimelineProps {
  result: OptimizationResult;
}

export function SubscriptionTimeline({ result }: SubscriptionTimelineProps) {
  const { rotationSchedule, totalMonthsNeeded } = result;

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

  const totalCost = rotationSchedule.reduce((sum, m) => sum + m.monthlyCost, 0);
  const allServicesMonthly = STREAMING_SERVICES.reduce((sum, s) => sum + s.price, 0);
  const potentialSavings = (allServicesMonthly * totalMonthsNeeded) - totalCost;
  const isBudgetConstrained = rotationSchedule[0]?.isBudgetConstrained;

  return (
    <div className="space-y-6 animate-slide-up">
      {/* Budget Warning */}
      {isBudgetConstrained && (
        <div className="glass rounded-xl p-4 border border-warning/50 bg-warning/10">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-warning">Budget-Optimized Mode</p>
              <p className="text-sm text-muted-foreground mt-1">
                Your budget is limited. We've optimized for shorter content that can be completed faster, 
                prioritizing high-priority items with less watch time.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="glass rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-primary">{totalMonthsNeeded}</p>
          <p className="text-xs text-muted-foreground mt-1">Months to Complete</p>
        </div>
        <div className="glass rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-success">${totalCost.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground mt-1">Total Cost</p>
        </div>
        <div className="glass rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-warning">${potentialSavings.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground mt-1">You Save</p>
        </div>
      </div>

      {/* Timeline Header */}
      <h3 className="font-display text-lg font-semibold flex items-center gap-2 pt-2">
        <Calendar className="w-5 h-5 text-primary" />
        Your Monthly Watching Schedule
      </h3>

      {/* Timeline */}
      <div className="relative">
        <div className="absolute left-4 top-8 bottom-4 w-0.5 bg-border" />

        <div className="space-y-4">
          {rotationSchedule.map((plan, index) => (
            <TimelineMonth
              key={`${plan.month}-${plan.year}-${index}`}
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
      <div className="flex-1 glass rounded-xl p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-semibold text-xl">{plan.month} {plan.year}</span>
            <span className="text-sm text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded">
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

        {/* What to Watch This Month - Detailed Schedule */}
        {plan.itemsToWatch.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4" />
                <span className="font-medium">Watch this month ({plan.totalWatchHours.toFixed(0)}h total):</span>
              </div>
              <div className="flex gap-2">
                {movieCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    <Film className="w-3 h-3 mr-1" />
                    {movieCount} movie{movieCount > 1 ? "s" : ""}
                  </Badge>
                )}
                {seriesCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    <Tv className="w-3 h-3 mr-1" />
                    {seriesCount} series
                  </Badge>
                )}
              </div>
            </div>
            
            {/* Detailed Item Schedule */}
            <div className="space-y-2">
              {plan.itemsToWatch.map((item) => (
                <ScheduleItemCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}

        {index === 0 && (
          <p className="text-xs text-success font-medium pt-1">
            ▶ Start here! Begin your streaming journey today.
          </p>
        )}
      </div>

      {!isLast && (
        <ChevronRight className="absolute -bottom-3 left-3 w-4 h-4 text-muted-foreground" />
      )}
    </div>
  );
}

interface ScheduleItemCardProps {
  item: ScheduledItem;
}

function ScheduleItemCard({ item }: ScheduleItemCardProps) {
  const priorityColors = {
    high: "border-l-primary bg-primary/5",
    medium: "border-l-warning bg-warning/5",
    low: "border-l-muted-foreground bg-secondary/30",
  };

  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 rounded-lg border-l-4 transition-all hover:scale-[1.01]",
        priorityColors[item.priority as keyof typeof priorityColors] || priorityColors.low
      )}
    >
      <div className="flex items-center gap-3">
        <span className="text-lg">{item.type === "movie" ? "🎬" : "📺"}</span>
        <div>
          <p className="font-medium text-sm">{item.title}</p>
          <p className="text-xs text-muted-foreground">
            {item.watchHours.toFixed(1)}h • {item.type === "movie" ? "Movie" : `${item.episodeCount || "?"} episodes`}
          </p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-xs font-medium">
          {format(item.estimatedStartDate, "MMM d")} - {format(item.estimatedEndDate, "MMM d")}
        </p>
        <p className="text-xs text-muted-foreground">
          Complete by {format(item.estimatedEndDate, "EEEE")}
        </p>
      </div>
    </div>
  );
}