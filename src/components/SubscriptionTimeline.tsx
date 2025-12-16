import { Calendar, ChevronRight } from "lucide-react";
import { OptimizationResult } from "@/lib/optimizer";
import { STREAMING_SERVICES } from "@/data/services";
import { cn } from "@/lib/utils";

interface SubscriptionTimelineProps {
  result: OptimizationResult;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function SubscriptionTimeline({ result }: SubscriptionTimelineProps) {
  const currentMonth = new Date().getMonth();
  
  // Generate a rotation schedule based on services and content
  const generateSchedule = () => {
    const services = result.subscribeThisMonth;
    if (services.length === 0) return [];

    // Sort by items count to prioritize services with most content first
    const sortedServices = [...services].sort(
      (a, b) => b.itemsToWatch.length - a.itemsToWatch.length
    );

    const schedule: Array<{
      month: string;
      monthIndex: number;
      services: typeof services;
      action: "subscribe" | "rotate" | "keep";
    }> = [];

    // First month: subscribe to top services within budget
    schedule.push({
      month: MONTHS[currentMonth],
      monthIndex: currentMonth,
      services: sortedServices.slice(0, Math.min(2, sortedServices.length)),
      action: "subscribe",
    });

    // Generate 5 more months of rotation
    for (let i = 1; i <= 5; i++) {
      const monthIdx = (currentMonth + i) % 12;
      const serviceIdx = i % sortedServices.length;
      const nextService = sortedServices[serviceIdx];
      
      // Alternate between keeping and rotating
      if (i % 2 === 0 && sortedServices.length > 2) {
        schedule.push({
          month: MONTHS[monthIdx],
          monthIndex: monthIdx,
          services: [sortedServices[(serviceIdx + 1) % sortedServices.length]],
          action: "rotate",
        });
      } else {
        schedule.push({
          month: MONTHS[monthIdx],
          monthIndex: monthIdx,
          services: [nextService],
          action: "keep",
        });
      }
    }

    return schedule;
  };

  const schedule = generateSchedule();

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
      default:
        return "bg-muted";
    }
  };

  if (schedule.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 animate-slide-up">
      <h3 className="font-display text-lg font-semibold flex items-center gap-2">
        <Calendar className="w-5 h-5 text-primary" />
        Subscription Timeline
      </h3>
      
      <p className="text-sm text-muted-foreground">
        Rotate services to save money while watching everything on your list.
      </p>

      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-8 bottom-4 w-0.5 bg-border" />

        <div className="space-y-4">
          {schedule.map((item, index) => (
            <div
              key={`${item.month}-${index}`}
              className="relative flex items-start gap-4 animate-slide-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Timeline dot */}
              <div
                className={cn(
                  "relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2",
                  index === 0 ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border"
                )}
              >
                {index + 1}
              </div>

              {/* Content */}
              <div className="flex-1 glass rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">{item.month}</span>
                  <span
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full border capitalize",
                      getActionColor(item.action)
                    )}
                  >
                    {item.action}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {item.services.map((service) => (
                    <div
                      key={service.service}
                      className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-1.5"
                    >
                      <span className="text-lg">{getServiceLogo(service.service)}</span>
                      <span className="text-sm font-medium">{service.serviceName}</span>
                      <span className="text-xs text-muted-foreground">
                        ${service.cost.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                {index === 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Start here! Watch {item.services.reduce((acc, s) => acc + s.itemsToWatch.length, 0)} items this month.
                  </p>
                )}
              </div>

              {index < schedule.length - 1 && (
                <ChevronRight className="absolute -bottom-3 left-3 w-4 h-4 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="glass rounded-xl p-4 mt-4">
        <p className="text-sm font-medium mb-1">💡 Pro Tip</p>
        <p className="text-xs text-muted-foreground">
          By rotating subscriptions monthly, you could save up to ${((result.totalCost * 0.4) * 12).toFixed(0)}/year while still watching everything on your list!
        </p>
      </div>
    </div>
  );
}
