import { Calendar, Film, Tv, Clock } from "lucide-react";
import { OptimizationResult, MonthlyPlan, ScheduledItem } from "@/lib/optimizer";
import { STREAMING_SERVICES } from "@/data/services";
import { cn } from "@/lib/utils";
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

  if (rotationSchedule.length === 0) {
    return null;
  }

  const totalCost = rotationSchedule.reduce((sum, m) => sum + m.monthlyCost, 0);
  const allServicesMonthly = STREAMING_SERVICES.reduce((sum, s) => sum + s.price, 0);
  const potentialSavings = (allServicesMonthly * totalMonthsNeeded) - totalCost;

  return (
    <div className="space-y-8">
      {/* Summary Stats - Minimal */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-2xl font-display font-bold text-foreground">{totalMonthsNeeded}</p>
            <p className="text-xs text-muted-foreground">Months</p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div>
            <p className="text-2xl font-display font-bold text-success">${totalCost.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div>
            <p className="text-2xl font-display font-bold text-primary">${potentialSavings.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Saved</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="w-3.5 h-3.5" />
          <span>Schedule</span>
        </div>
      </div>

      {/* Timeline */}
      <div className="space-y-6">
        {rotationSchedule.map((plan, index) => (
          <TimelineMonth
            key={`${plan.month}-${plan.year}-${index}`}
            plan={plan}
            index={index}
            getServiceLogo={getServiceLogo}
            isFirst={index === 0}
          />
        ))}
      </div>

      {/* Pro Tip - Minimal */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-secondary/30 border border-border/50">
        <span className="text-sm">💡</span>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Set calendar reminders to rotate services at the end of each month.
        </p>
      </div>
    </div>
  );
}

interface TimelineMonthProps {
  plan: MonthlyPlan;
  index: number;
  getServiceLogo: (id: string) => string;
  isFirst: boolean;
}

function TimelineMonth({ plan, index, getServiceLogo, isFirst }: TimelineMonthProps) {
  const movieCount = plan.itemsToWatch.filter(i => i.type === "movie").length;
  const seriesCount = plan.itemsToWatch.filter(i => i.type === "tv").length;

  return (
    <div
      className="month-card p-5 animate-slide-up"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Month Header - Strongest Visual Element */}
      <div className="flex items-start justify-between mb-5">
        <div className="space-y-1">
          <div className="flex items-baseline gap-3">
            <h3 className="text-2xl font-display font-bold tracking-tight">
              {plan.month}
            </h3>
            <span className="text-lg text-muted-foreground font-medium">
              {plan.year}
            </span>
          </div>
          {isFirst && (
            <p className="text-xs text-primary font-medium">Start here</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xl font-display font-semibold">${plan.monthlyCost.toFixed(0)}</p>
          <p className="text-xs text-muted-foreground">this month</p>
        </div>
      </div>

      {/* Platform Pills - Second Priority */}
      <div className="flex flex-wrap gap-2 mb-5">
        {plan.services.map((service) => (
          <div
            key={service.service}
            className="platform-pill flex items-center gap-2 px-3 py-1.5"
          >
            <span className="text-base">{getServiceLogo(service.service)}</span>
            <span className="text-sm font-medium">{service.serviceName}</span>
          </div>
        ))}
      </div>

      {/* Content Cards - Third Priority */}
      {plan.itemsToWatch.length > 0 && (
        <div className="space-y-3">
          {/* Section Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {plan.totalWatchHours.toFixed(0)}h to watch
              </span>
            </div>
            <div className="flex gap-3 text-xs text-muted-foreground">
              {movieCount > 0 && (
                <span className="flex items-center gap-1">
                  <Film className="w-3 h-3" />
                  {movieCount}
                </span>
              )}
              {seriesCount > 0 && (
                <span className="flex items-center gap-1">
                  <Tv className="w-3 h-3" />
                  {seriesCount}
                </span>
              )}
            </div>
          </div>
          
          {/* Content Items */}
          <div className="space-y-2">
            {plan.itemsToWatch.map((item) => (
              <ScheduleItemCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface ScheduleItemCardProps {
  item: ScheduledItem;
}

function ScheduleItemCard({ item }: ScheduleItemCardProps) {
  const priorityDotClass = {
    high: "priority-dot-high",
    medium: "priority-dot-medium",
    low: "priority-dot-low",
  };

  return (
    <div className="content-card flex items-center gap-3 p-3">
      {/* Priority Dot */}
      <div 
        className={cn(
          "priority-dot",
          priorityDotClass[item.priority as keyof typeof priorityDotClass] || "priority-dot-low"
        )}
      />

      {/* Content Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{item.title}</p>
        <p className="text-xs text-muted-foreground">
          {item.type === "movie" ? "Movie" : `${item.episodeCount || "?"} eps`}
          <span className="mx-1.5">·</span>
          {item.watchHours.toFixed(1)}h
        </p>
      </div>

      {/* Date Range - Clean & Light */}
      <div className="text-right shrink-0">
        <p className="text-xs text-muted-foreground">
          {format(item.estimatedStartDate, "MMM d")}
          <span className="mx-1 opacity-50">→</span>
          {format(item.estimatedEndDate, "MMM d")}
        </p>
      </div>
    </div>
  );
}