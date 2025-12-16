import { WatchlistItem } from "@/data/sampleContent";
import { STREAMING_SERVICES, SERVICE_PRICES } from "@/data/services";

// ------------------------------
// CONSTANTS AND ASSUMPTIONS
// ------------------------------
const DAILY_WATCH_HOURS = 2;
const DAYS_IN_MONTH = 30;
const MONTHLY_WATCH_LIMIT = DAILY_WATCH_HOURS * DAYS_IN_MONTH; // 60 hours

const PRIORITY_WEIGHT: Record<string, number> = {
  high: 1.0,
  medium: 0.6,
  low: 0.3,
};

// ------------------------------
// INTERFACES
// ------------------------------
export interface OptimizedService {
  service: string;
  serviceName: string;
  cost: number;
  itemsToWatch: WatchlistItem[];
  valueDensity: number;
  color: string;
  watchTime: number;
}

export interface ScheduledItem extends WatchlistItem {
  day: number;
  estimatedStartDate: Date;
  estimatedEndDate: Date;
  watchHours: number;
}

export interface MonthlyPlan {
  month: string;
  monthIndex: number;
  year: number;
  services: OptimizedService[];
  itemsToWatch: ScheduledItem[];
  monthlyCost: number;
  action: "subscribe" | "rotate" | "keep" | "cancel";
  totalWatchHours: number;
  isBudgetConstrained: boolean;
}

export interface OptimizationResult {
  subscribeThisMonth: OptimizedService[];
  deferredItems: { item: WatchlistItem; reason: string }[];
  totalCost: number;
  estimatedSavings: number;
  coveragePercent: number;
  explanation: string;
  rotationSchedule: MonthlyPlan[];
  totalMonthsNeeded: number;
  averageMonthlyCost: number;
}

// ------------------------------
// HELPER: Get Watch Time (in hours)
// ------------------------------
function getWatchTime(item: WatchlistItem): number {
  if (item.type === "movie") {
    return 2; // Average movie ~2 hours
  } else {
    // TV series: estimate based on episode count
    const episodes = item.episodeCount || 10;
    return episodes * 0.75; // ~45 min per episode
  }
}

// ------------------------------
// FUNCTION: Calculate Platform Watch Time
// ------------------------------
function calculatePlatformWatchTime(
  serviceId: string,
  watchlist: WatchlistItem[],
  watchedItems: Set<string>
): { watchTime: number; coveredItems: WatchlistItem[] } {
  const coveredItems = watchlist.filter(
    (item) => item.providers.includes(serviceId) && !watchedItems.has(item.id)
  );

  if (coveredItems.length === 0) {
    return { watchTime: 0, coveredItems: [] };
  }

  let totalTimeMinutes = 0;

  for (const item of coveredItems) {
    const durationHours = getWatchTime(item);
    const durationMinutes = durationHours * 60;
    const weight = PRIORITY_WEIGHT[item.priority] || PRIORITY_WEIGHT.low;
    const weightedDuration = durationMinutes * weight;
    totalTimeMinutes += weightedDuration;
  }

  const totalTimeHours = totalTimeMinutes / 60;
  // Cap at monthly watch limit
  const cappedTime = Math.min(totalTimeHours, MONTHLY_WATCH_LIMIT);

  return { watchTime: cappedTime, coveredItems };
}

// ------------------------------
// FUNCTION: Select Platforms
// ------------------------------
function selectPlatforms(
  watchlist: WatchlistItem[],
  userBudget: number,
  watchedItems: Set<string>
): OptimizedService[] {
  // Calculate value score for each platform
  const platformAnalysis = STREAMING_SERVICES.map((service) => {
    const { watchTime, coveredItems } = calculatePlatformWatchTime(
      service.id,
      watchlist,
      watchedItems
    );

    const valueScore = service.price > 0 ? watchTime / service.price : 0;

    return {
      service: service.id,
      serviceName: service.name,
      cost: service.price,
      itemsToWatch: coveredItems,
      valueDensity: valueScore,
      color: service.color,
      watchTime,
    };
  }).filter((p) => p.watchTime > 0);

  // Sort by best value first (descending)
  platformAnalysis.sort((a, b) => b.valueDensity - a.valueDensity);

  // Greedy selection within budget and time
  const selectedPlatforms: OptimizedService[] = [];
  let remainingBudget = userBudget;
  let remainingTime = MONTHLY_WATCH_LIMIT;

  for (const platform of platformAnalysis) {
    if (
      platform.cost <= remainingBudget &&
      platform.watchTime <= remainingTime
    ) {
      selectedPlatforms.push(platform);
      remainingBudget -= platform.cost;
      remainingTime -= platform.watchTime;
    }
  }

  // If nothing selected but we have platforms, pick the best value one
  if (selectedPlatforms.length === 0 && platformAnalysis.length > 0) {
    // Find cheapest platform with content
    const cheapest = [...platformAnalysis].sort((a, b) => a.cost - b.cost)[0];
    if (cheapest) {
      selectedPlatforms.push(cheapest);
    }
  }

  return selectedPlatforms;
}

// ------------------------------
// FUNCTION: Build Watch Timeline
// ------------------------------
function buildTimeline(
  selectedPlatforms: OptimizedService[],
  watchedItems: Set<string>,
  monthStart: Date
): { items: ScheduledItem[]; newlyWatched: Set<string> } {
  // Combine all content from selected platforms
  let allContent: WatchlistItem[] = [];
  for (const platform of selectedPlatforms) {
    for (const item of platform.itemsToWatch) {
      if (!watchedItems.has(item.id) && !allContent.find((c) => c.id === item.id)) {
        allContent.push(item);
      }
    }
  }

  // Sort: High priority first, then movies before series
  const priorityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
  allContent.sort((a, b) => {
    const priorityDiff = (priorityOrder[b.priority] || 1) - (priorityOrder[a.priority] || 1);
    if (priorityDiff !== 0) return priorityDiff;
    // Movies before series
    if (a.type === "movie" && b.type !== "movie") return -1;
    if (a.type !== "movie" && b.type === "movie") return 1;
    return 0;
  });

  const timeline: ScheduledItem[] = [];
  const newlyWatched = new Set<string>();
  let currentDay = 1;
  let dailyRemainingTime = DAILY_WATCH_HOURS;
  let totalHoursScheduled = 0;

  for (const item of allContent) {
    // Check if we can fit more this month
    if (totalHoursScheduled >= MONTHLY_WATCH_LIMIT) break;

    const itemHours = getWatchTime(item);

    if (item.type === "movie") {
      // Movies are watched in one sitting (one day)
      const startDate = new Date(monthStart);
      startDate.setDate(startDate.getDate() + currentDay - 1);

      const endDate = new Date(startDate);

      timeline.push({
        ...item,
        day: currentDay,
        estimatedStartDate: startDate,
        estimatedEndDate: endDate,
        watchHours: itemHours,
      });

      newlyWatched.add(item.id);
      totalHoursScheduled += itemHours;

      // Move to next day after movie
      currentDay += 1;
      dailyRemainingTime = DAILY_WATCH_HOURS;
    } else {
      // Series: spread episodes across days
      const episodes = item.episodeCount || 10;
      const episodeDurationHours = itemHours / episodes;

      const startDay = currentDay;
      const startDate = new Date(monthStart);
      startDate.setDate(startDate.getDate() + startDay - 1);

      for (let ep = 0; ep < episodes; ep++) {
        // If not enough time today, move to next day
        if (dailyRemainingTime < episodeDurationHours) {
          currentDay += 1;
          dailyRemainingTime = DAILY_WATCH_HOURS;
        }

        dailyRemainingTime -= episodeDurationHours;
        totalHoursScheduled += episodeDurationHours;
      }

      const endDate = new Date(monthStart);
      endDate.setDate(endDate.getDate() + currentDay - 1);

      timeline.push({
        ...item,
        day: startDay,
        estimatedStartDate: startDate,
        estimatedEndDate: endDate,
        watchHours: itemHours,
      });

      newlyWatched.add(item.id);
    }
  }

  return { items: timeline, newlyWatched };
}

// ------------------------------
// MAIN OPTIMIZATION FUNCTION
// ------------------------------
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function optimizeSubscriptions(
  watchlist: WatchlistItem[],
  budget: number
): OptimizationResult {
  const allServicesCost = STREAMING_SERVICES.reduce((sum, s) => sum + s.price, 0);
  const isBudgetConstrained = budget < allServicesCost * 0.5;

  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const rotationSchedule: MonthlyPlan[] = [];
  const watchedItems = new Set<string>();

  let monthOffset = 0;

  while (monthOffset < 24) {
    // Step 1: Select best platforms for this month
    const selectedPlatforms = selectPlatforms(watchlist, budget, watchedItems);

    if (selectedPlatforms.length === 0) break;

    // Calculate if there's unwatched content
    const hasUnwatchedContent = selectedPlatforms.some((p) =>
      p.itemsToWatch.some((item) => !watchedItems.has(item.id))
    );
    if (!hasUnwatchedContent) break;

    const monthIdx = (currentMonth + monthOffset) % 12;
    const year = currentYear + Math.floor((currentMonth + monthOffset) / 12);
    const monthStart = new Date(year, monthIdx, 1);

    // Step 2: Build watch timeline
    const { items, newlyWatched } = buildTimeline(
      selectedPlatforms,
      watchedItems,
      monthStart
    );

    // Mark items as watched
    newlyWatched.forEach((id) => watchedItems.add(id));

    const monthlyCost = selectedPlatforms.reduce((sum, p) => sum + p.cost, 0);
    const totalWatchHours = items.reduce((sum, i) => sum + i.watchHours, 0);

    // Determine action type
    let action: "subscribe" | "rotate" | "keep" | "cancel" = "subscribe";
    if (monthOffset > 0) {
      const previousServices = rotationSchedule[monthOffset - 1]?.services || [];
      const prevIds = new Set(previousServices.map((s) => s.service));
      const currIds = new Set(selectedPlatforms.map((s) => s.service));

      const sameServices =
        selectedPlatforms.every((s) => prevIds.has(s.service)) &&
        previousServices.every((s) => currIds.has(s.service));
      action = sameServices ? "keep" : "rotate";
    }

    rotationSchedule.push({
      month: MONTHS[monthIdx],
      monthIndex: monthIdx,
      year,
      services: selectedPlatforms,
      itemsToWatch: items,
      monthlyCost,
      action,
      totalWatchHours,
      isBudgetConstrained,
    });

    monthOffset++;
  }

  // Calculate results
  const totalMonthsNeeded = rotationSchedule.length;
  const totalRotationCost = rotationSchedule.reduce((sum, m) => sum + m.monthlyCost, 0);
  const averageMonthlyCost = totalMonthsNeeded > 0 ? totalRotationCost / totalMonthsNeeded : 0;

  const firstMonthServices = rotationSchedule[0]?.services || [];

  // Find deferred items
  const allCoveredIds = new Set<string>();
  STREAMING_SERVICES.forEach((service) => {
    watchlist.forEach((item) => {
      if (item.providers.includes(service.id)) {
        allCoveredIds.add(item.id);
      }
    });
  });

  const deferredItems = watchlist
    .filter((item) => !allCoveredIds.has(item.id))
    .map((item) => ({
      item,
      reason: "Not available on any tracked streaming service.",
    }));

  const coveragePercent = Math.round((watchedItems.size / watchlist.length) * 100);

  const explanation = generateExplanation(
    firstMonthServices,
    deferredItems,
    budget,
    rotationSchedule
  );

  return {
    subscribeThisMonth: firstMonthServices,
    deferredItems,
    totalCost: rotationSchedule[0]?.monthlyCost || 0,
    estimatedSavings: allServicesCost - (rotationSchedule[0]?.monthlyCost || 0),
    coveragePercent,
    explanation,
    rotationSchedule,
    totalMonthsNeeded,
    averageMonthlyCost,
  };
}

function generateExplanation(
  selected: OptimizedService[],
  deferred: { item: WatchlistItem; reason: string }[],
  budget: number,
  schedule: MonthlyPlan[]
): string {
  const serviceNames = selected.map((s) => s.serviceName).join(", ");
  const totalItems = schedule.reduce((sum, m) => sum + m.itemsToWatch.length, 0);

  let explanation = `Based on your watchlist and $${budget} budget, start with ${serviceNames}. `;
  explanation += `You can watch all ${totalItems} items in ${schedule.length} month${schedule.length > 1 ? "s" : ""} by rotating services. `;

  if (selected.length > 0) {
    const topService = selected[0];
    explanation += `${topService.serviceName} offers the best value with ${topService.itemsToWatch.length} items. `;
  }

  if (deferred.length > 0) {
    explanation += `${deferred.length} items aren't available on tracked services. `;
  }

  const totalCost = schedule.reduce((sum, m) => sum + m.monthlyCost, 0);
  const allServicesCost = STREAMING_SERVICES.reduce((sum, s) => sum + s.price, 0) * schedule.length;
  explanation += `Total cost: $${totalCost.toFixed(2)} vs $${allServicesCost.toFixed(2)} for all services.`;

  return explanation;
}
