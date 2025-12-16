import { WatchlistItem } from "@/data/sampleContent";
import { STREAMING_SERVICES } from "@/data/services";

// ------------------------------
// CONSTANTS AND ASSUMPTIONS
// ------------------------------
const DAILY_WATCH_HOURS = 2;
const DAYS_IN_MONTH = 30;
const MONTHLY_WATCH_LIMIT = DAILY_WATCH_HOURS * DAYS_IN_MONTH; // 60 hours

// Platform prices (USD) - as specified in algorithm
const PLATFORM_PRICES: Record<string, number> = {
  netflix: 7.99,
  disney: 9.99,
  hulu: 9.99,
  disney_hulu_bundle: 10.99,
  hbo: 10.99, // Max
  amazon: 8.99, // Prime Video
  paramount: 7.99,
  peacock: 8.99,
  apple: 12.99,
};

// Priority weights - higher weight = more effective time needed
const PRIORITY_WEIGHT: Record<string, number> = {
  high: 1.0,
  medium: 1.5,
  low: 2.0,
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
  remainingMinutes?: number;
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
// HELPER: Get Raw Watch Time (minutes)
// ------------------------------
function getRawWatchTimeMinutes(item: WatchlistItem): number {
  if (item.totalWatchTimeMinutes) {
    return item.totalWatchTimeMinutes;
  }
  
  if (item.type === "movie") {
    return 120; // Default movie ~2 hours
  } else {
    const episodes = item.episodeCount || 10;
    return episodes * 45; // ~45 min per episode
  }
}

// ------------------------------
// HELPER: Get Platform Price
// ------------------------------
function getPlatformPrice(serviceId: string): number {
  return PLATFORM_PRICES[serviceId] ?? STREAMING_SERVICES.find(s => s.id === serviceId)?.price ?? 9.99;
}

// ------------------------------
// HELPER: Get Platform Info
// ------------------------------
function getPlatformInfo(serviceId: string) {
  const service = STREAMING_SERVICES.find(s => s.id === serviceId);
  return {
    name: service?.name ?? serviceId,
    color: service?.color ?? "gray",
  };
}

// ------------------------------
// PREPROCESS: Calculate Effective Minutes
// ------------------------------
interface ContentState {
  item: WatchlistItem;
  rawMinutes: number;
  effMinutes: number;
  remainingMinutes: number;
}

function preprocessContent(watchlist: WatchlistItem[]): Map<string, ContentState> {
  const contentMap = new Map<string, ContentState>();
  
  for (const item of watchlist) {
    const rawMinutes = getRawWatchTimeMinutes(item);
    const weight = PRIORITY_WEIGHT[item.priority] ?? PRIORITY_WEIGHT.low;
    const effMinutes = rawMinutes * weight;
    
    contentMap.set(item.id, {
      item,
      rawMinutes,
      effMinutes,
      remainingMinutes: effMinutes,
    });
  }
  
  return contentMap;
}

// ------------------------------
// FUNCTION: Calculate Platform Potential
// ------------------------------
function calculatePlatformPotential(
  serviceId: string,
  watchlist: WatchlistItem[],
  contentState: Map<string, ContentState>
): { potentialHours: number; coveredItems: WatchlistItem[] } {
  const coveredItems = watchlist.filter(item => {
    const state = contentState.get(item.id);
    return item.providers.includes(serviceId) && state && state.remainingMinutes > 0;
  });
  
  if (coveredItems.length === 0) {
    return { potentialHours: 0, coveredItems: [] };
  }
  
  let totalRemainingMinutes = 0;
  for (const item of coveredItems) {
    const state = contentState.get(item.id);
    if (state) {
      totalRemainingMinutes += state.remainingMinutes;
    }
  }
  
  const potentialHours = Math.min(totalRemainingMinutes / 60, MONTHLY_WATCH_LIMIT);
  return { potentialHours, coveredItems };
}

// ------------------------------
// FUNCTION: Greedy Platform Selection (Knapsack-like)
// ------------------------------
function selectPlatformsForMonth(
  watchlist: WatchlistItem[],
  contentState: Map<string, ContentState>,
  userBudget: number
): OptimizedService[] {
  // Get unique platforms from watchlist that have remaining content
  const platformIds = new Set<string>();
  for (const item of watchlist) {
    const state = contentState.get(item.id);
    if (state && state.remainingMinutes > 0) {
      item.providers.forEach(p => platformIds.add(p));
    }
  }
  
  // Calculate value score for each platform
  const platformAnalysis: {
    serviceId: string;
    potentialHours: number;
    coveredItems: WatchlistItem[];
    cost: number;
    valueScore: number;
  }[] = [];
  
  for (const serviceId of platformIds) {
    const { potentialHours, coveredItems } = calculatePlatformPotential(
      serviceId,
      watchlist,
      contentState
    );
    
    if (potentialHours > 0) {
      const cost = getPlatformPrice(serviceId);
      const valueScore = potentialHours / cost; // hours per USD
      
      platformAnalysis.push({
        serviceId,
        potentialHours,
        coveredItems,
        cost,
        valueScore,
      });
    }
  }
  
  // Sort by value score descending
  platformAnalysis.sort((a, b) => b.valueScore - a.valueScore);
  
  // Greedy selection within budget and time constraints
  const selectedPlatforms: OptimizedService[] = [];
  let remainingBudget = userBudget;
  let remainingTimeHours = MONTHLY_WATCH_LIMIT;
  
  for (const platform of platformAnalysis) {
    // Check if platform fits budget
    if (platform.cost <= remainingBudget) {
      // Calculate actual usable time (capped by remaining time)
      const usableTime = Math.min(platform.potentialHours, remainingTimeHours);
      
      if (usableTime > 0) {
        const { name, color } = getPlatformInfo(platform.serviceId);
        
        selectedPlatforms.push({
          service: platform.serviceId,
          serviceName: name,
          cost: platform.cost,
          itemsToWatch: platform.coveredItems,
          valueDensity: platform.valueScore,
          color,
          watchTime: usableTime,
        });
        
        remainingBudget -= platform.cost;
        remainingTimeHours -= usableTime;
      }
    }
  }
  
  // If nothing selected but there are platforms, pick the best value one that fits budget
  if (selectedPlatforms.length === 0 && platformAnalysis.length > 0) {
    const affordable = platformAnalysis.filter(p => p.cost <= userBudget);
    if (affordable.length > 0) {
      const best = affordable[0];
      const { name, color } = getPlatformInfo(best.serviceId);
      selectedPlatforms.push({
        service: best.serviceId,
        serviceName: name,
        cost: best.cost,
        itemsToWatch: best.coveredItems,
        valueDensity: best.valueScore,
        color,
        watchTime: Math.min(best.potentialHours, MONTHLY_WATCH_LIMIT),
      });
    }
  }
  
  return selectedPlatforms;
}

// ------------------------------
// FUNCTION: Schedule Content for Month
// ------------------------------
function scheduleContentForMonth(
  selectedPlatforms: OptimizedService[],
  contentState: Map<string, ContentState>,
  monthStart: Date
): { scheduledItems: ScheduledItem[]; totalWatchedHours: number } {
  // Get all candidate content from selected platforms
  const candidateContent: ContentState[] = [];
  const addedIds = new Set<string>();
  
  for (const platform of selectedPlatforms) {
    for (const item of platform.itemsToWatch) {
      const state = contentState.get(item.id);
      if (state && state.remainingMinutes > 0 && !addedIds.has(item.id)) {
        candidateContent.push(state);
        addedIds.add(item.id);
      }
    }
  }
  
  // Sort: HIGH priority first, then MEDIUM, then LOW; Movies before Series
  const priorityOrder: Record<string, number> = { high: 3, medium: 2, low: 1 };
  candidateContent.sort((a, b) => {
    const priorityDiff = (priorityOrder[b.item.priority] || 1) - (priorityOrder[a.item.priority] || 1);
    if (priorityDiff !== 0) return priorityDiff;
    // Movies before series
    if (a.item.type === "movie" && b.item.type !== "movie") return -1;
    if (a.item.type !== "movie" && b.item.type === "movie") return 1;
    return 0;
  });
  
  const scheduledItems: ScheduledItem[] = [];
  let remainingTimeHours = MONTHLY_WATCH_LIMIT;
  let currentDay = 1;
  let dailyRemainingHours = DAILY_WATCH_HOURS;
  
  for (const state of candidateContent) {
    if (remainingTimeHours <= 0) break;
    
    const itemEffHours = state.remainingMinutes / 60;
    
    if (state.item.type === "movie") {
      // Movies must be watched in one sitting
      if (itemEffHours <= remainingTimeHours) {
        const startDate = new Date(monthStart);
        startDate.setDate(startDate.getDate() + currentDay - 1);
        
        scheduledItems.push({
          ...state.item,
          day: currentDay,
          estimatedStartDate: new Date(startDate),
          estimatedEndDate: new Date(startDate),
          watchHours: itemEffHours,
        });
        
        // Mark movie as fully watched
        state.remainingMinutes = 0;
        remainingTimeHours -= itemEffHours;
        
        // Move to next day after movie
        currentDay += 1;
        dailyRemainingHours = DAILY_WATCH_HOURS;
      }
      // If movie doesn't fit this month, skip it (will be scheduled next month)
    } else {
      // Series: can be split across days/months
      const availableMinutes = remainingTimeHours * 60;
      const toWatchMinutes = Math.min(state.remainingMinutes, availableMinutes);
      
      if (toWatchMinutes > 0) {
        const startDay = currentDay;
        const startDate = new Date(monthStart);
        startDate.setDate(startDate.getDate() + startDay - 1);
        
        // Simulate day-by-day watching for series
        let watchedMinutes = 0;
        const episodeDuration = state.rawMinutes / (state.item.episodeCount || 10);
        const effEpisodeDuration = episodeDuration * (PRIORITY_WEIGHT[state.item.priority] ?? PRIORITY_WEIGHT.low);
        
        while (watchedMinutes < toWatchMinutes && currentDay <= DAYS_IN_MONTH) {
          const episodeHours = effEpisodeDuration / 60;
          
          if (dailyRemainingHours < episodeHours) {
            currentDay += 1;
            dailyRemainingHours = DAILY_WATCH_HOURS;
          }
          
          const canWatch = Math.min(dailyRemainingHours * 60, toWatchMinutes - watchedMinutes);
          watchedMinutes += canWatch;
          dailyRemainingHours -= canWatch / 60;
        }
        
        const endDate = new Date(monthStart);
        endDate.setDate(endDate.getDate() + currentDay - 1);
        
        const watchedHours = toWatchMinutes / 60;
        
        scheduledItems.push({
          ...state.item,
          day: startDay,
          estimatedStartDate: new Date(startDate),
          estimatedEndDate: new Date(endDate),
          watchHours: watchedHours,
          remainingMinutes: state.remainingMinutes - toWatchMinutes,
        });
        
        state.remainingMinutes -= toWatchMinutes;
        remainingTimeHours -= watchedHours;
      }
    }
  }
  
  const totalWatchedHours = MONTHLY_WATCH_LIMIT - remainingTimeHours;
  return { scheduledItems, totalWatchedHours };
}

// ------------------------------
// MAIN OPTIMIZATION FUNCTION
// ------------------------------
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function optimizeSubscriptions(
  watchlist: WatchlistItem[],
  budget: number
): OptimizationResult {
  // Preprocess: calculate effective minutes for each item
  const contentState = preprocessContent(watchlist);
  
  // Calculate total effective minutes to determine max horizon
  let totalEffMinutes = 0;
  contentState.forEach(state => {
    totalEffMinutes += state.effMinutes;
  });
  
  const M_max = Math.ceil(totalEffMinutes / (MONTHLY_WATCH_LIMIT * 60)) + 3;
  
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  
  const rotationSchedule: MonthlyPlan[] = [];
  let monthOffset = 0;
  
  // Month-by-month simulation
  while (monthOffset < Math.min(M_max, 24)) {
    // Check if there's remaining content
    let hasRemainingContent = false;
    contentState.forEach(state => {
      if (state.remainingMinutes > 0) {
        hasRemainingContent = true;
      }
    });
    
    if (!hasRemainingContent) break;
    
    // Step A & B: Select platforms for this month
    const selectedPlatforms = selectPlatformsForMonth(watchlist, contentState, budget);
    
    if (selectedPlatforms.length === 0) break;
    
    const monthIdx = (currentMonth + monthOffset) % 12;
    const year = currentYear + Math.floor((currentMonth + monthOffset) / 12);
    const monthStart = new Date(year, monthIdx, 1);
    
    // Step C: Schedule content for this month
    const { scheduledItems, totalWatchedHours } = scheduleContentForMonth(
      selectedPlatforms,
      contentState,
      monthStart
    );
    
    const monthlyCost = selectedPlatforms.reduce((sum, p) => sum + p.cost, 0);
    const isBudgetConstrained = monthlyCost >= budget * 0.9;
    
    // Determine action type
    let action: "subscribe" | "rotate" | "keep" | "cancel" = "subscribe";
    if (monthOffset > 0) {
      const previousServices = rotationSchedule[monthOffset - 1]?.services || [];
      const prevIds = new Set(previousServices.map(s => s.service));
      const currIds = new Set(selectedPlatforms.map(s => s.service));
      
      const sameServices =
        selectedPlatforms.every(s => prevIds.has(s.service)) &&
        previousServices.every(s => currIds.has(s.service));
      action = sameServices ? "keep" : "rotate";
    }
    
    rotationSchedule.push({
      month: MONTHS[monthIdx],
      monthIndex: monthIdx,
      year,
      services: selectedPlatforms,
      itemsToWatch: scheduledItems,
      monthlyCost,
      action,
      totalWatchHours: totalWatchedHours,
      isBudgetConstrained,
    });
    
    monthOffset++;
  }
  
  // Check for infeasible items (content that couldn't be scheduled)
  const deferredItems: { item: WatchlistItem; reason: string }[] = [];
  contentState.forEach(state => {
    if (state.remainingMinutes > 0) {
      // Check if item is on any platform
      const onAnyPlatform = watchlist.some(item => 
        item.id === state.item.id && item.providers.length > 0
      );
      
      if (!onAnyPlatform) {
        deferredItems.push({
          item: state.item,
          reason: "Not available on any tracked streaming service.",
        });
      } else {
        const effHours = state.effMinutes / 60;
        if (effHours > MONTHLY_WATCH_LIMIT) {
          deferredItems.push({
            item: state.item,
            reason: `Content requires ${effHours.toFixed(1)} hours (exceeds monthly capacity of ${MONTHLY_WATCH_LIMIT}h). Consider increasing daily watch hours.`,
          });
        } else {
          deferredItems.push({
            item: state.item,
            reason: "Could not fit within budget constraints. Consider increasing budget.",
          });
        }
      }
    }
  });
  
  // Calculate results
  const totalMonthsNeeded = rotationSchedule.length;
  const totalRotationCost = rotationSchedule.reduce((sum, m) => sum + m.monthlyCost, 0);
  const averageMonthlyCost = totalMonthsNeeded > 0 ? totalRotationCost / totalMonthsNeeded : 0;
  
  const firstMonthServices = rotationSchedule[0]?.services || [];
  
  // Calculate coverage
  const totalItems = watchlist.length;
  const watchedItems = totalItems - deferredItems.length;
  const coveragePercent = totalItems > 0 ? Math.round((watchedItems / totalItems) * 100) : 0;
  
  // Calculate savings vs subscribing to all services
  const allServicesCost = Object.values(PLATFORM_PRICES).reduce((sum, price) => sum + price, 0);
  const estimatedSavings = (allServicesCost * totalMonthsNeeded) - totalRotationCost;
  
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
    estimatedSavings,
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
  if (selected.length === 0) {
    return "No platforms selected. Try increasing your budget or adding content to your watchlist.";
  }
  
  const serviceNames = selected.map(s => s.serviceName).join(", ");
  const totalItems = schedule.reduce((sum, m) => sum + m.itemsToWatch.length, 0);
  
  let explanation = `Based on your $${budget}/month budget, start with ${serviceNames}. `;
  explanation += `Watch ${totalItems} items in ${schedule.length} month${schedule.length > 1 ? "s" : ""} by rotating services. `;
  
  if (selected.length > 0) {
    const topService = selected[0];
    explanation += `${topService.serviceName} offers best value at $${topService.cost.toFixed(2)}/month. `;
  }
  
  if (deferred.length > 0) {
    explanation += `${deferred.length} item${deferred.length > 1 ? "s" : ""} couldn't be scheduled. `;
  }
  
  const totalCost = schedule.reduce((sum, m) => sum + m.monthlyCost, 0);
  explanation += `Total cost: $${totalCost.toFixed(2)}.`;
  
  return explanation;
}
