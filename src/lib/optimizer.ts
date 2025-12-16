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
// HELPER: Get Effective Providers (user-selected overrides TMDB)
// ------------------------------
function getEffectiveProviders(item: WatchlistItem): string[] {
  // User-selected provider takes precedence
  if (item.userSelectedProvider) {
    return [item.userSelectedProvider];
  }
  return item.providers;
}

// ------------------------------
// HELPER: Check if item should be scheduled
// ------------------------------
function shouldScheduleItem(item: WatchlistItem): boolean {
  // Skip items with pending platform selection
  if (item.pendingPlatformSelection) {
    return false;
  }
  // Skip items with no providers (and no user selection)
  if (item.providers.length === 0 && !item.userSelectedProvider) {
    return false;
  }
  return true;
}

// ------------------------------
// HELPER: Check if all priorities are the same (degenerate state)
// ------------------------------
function isUniformPriority(watchlist: WatchlistItem[], contentState: Map<string, ContentState>): boolean {
  const priorities = new Set<string>();
  
  for (const item of watchlist) {
    if (!shouldScheduleItem(item)) continue;
    const state = contentState.get(item.id);
    if (state && state.remainingMinutes > 0) {
      priorities.add(item.priority || "low");
    }
  }
  
  return priorities.size <= 1;
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
    if (!shouldScheduleItem(item)) return false;
    const state = contentState.get(item.id);
    const effectiveProviders = getEffectiveProviders(item);
    return effectiveProviders.includes(serviceId) && state && state.remainingMinutes > 0;
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
// FUNCTION: Secondary Optimization - Platform Selection for Uniform Priority
// ------------------------------
function selectPlatformsUniformPriority(
  watchlist: WatchlistItem[],
  contentState: Map<string, ContentState>,
  userBudget: number,
  previousPlatforms: Set<string>
): OptimizedService[] {
  // Get all remaining schedulable content
  const remainingContent = watchlist.filter(item => {
    if (!shouldScheduleItem(item)) return false;
    const state = contentState.get(item.id);
    return state && state.remainingMinutes > 0;
  });

  if (remainingContent.length === 0) return [];

  // Build platform -> content mapping with coverage stats
  const platformStats = new Map<string, {
    coveredItems: WatchlistItem[];
    totalMinutes: number;
    cost: number;
    wasPreviouslyUsed: boolean;
  }>();

  const allPlatforms = new Set<string>();
  for (const item of remainingContent) {
    const providers = getEffectiveProviders(item);
    providers.forEach(p => allPlatforms.add(p));
  }

  for (const platformId of allPlatforms) {
    const { coveredItems } = calculatePlatformPotential(platformId, watchlist, contentState);
    let totalMinutes = 0;
    for (const item of coveredItems) {
      const state = contentState.get(item.id);
      if (state) totalMinutes += state.remainingMinutes;
    }
    
    platformStats.set(platformId, {
      coveredItems,
      totalMinutes,
      cost: getPlatformPrice(platformId),
      wasPreviouslyUsed: previousPlatforms.has(platformId),
    });
  }

  // Greedy selection with secondary optimization rules
  const selectedPlatformIds = new Set<string>();
  const coveredItemIds = new Set<string>();
  let currentCost = 0;

  // Rule 1: Prefer platforms from previous month (minimize switches)
  // Rule 2: Among those, prefer lowest cost
  // Rule 3 & 4: Will be handled in scheduling phase

  // Sort platforms by: 
  // 1. Previously used (minimize switches)
  // 2. Coverage (more content = fewer platforms needed)
  // 3. Cost efficiency (coverage / cost)
  const sortedPlatforms = Array.from(platformStats.entries())
    .filter(([, stats]) => stats.coveredItems.length > 0)
    .sort((a, b) => {
      const [, statsA] = a;
      const [, statsB] = b;
      
      // Rule 1: Previously used platforms first
      if (statsA.wasPreviouslyUsed && !statsB.wasPreviouslyUsed) return -1;
      if (!statsA.wasPreviouslyUsed && statsB.wasPreviouslyUsed) return 1;
      
      // Rule 2: Higher coverage first (minimize total platforms needed)
      const coverageA = statsA.totalMinutes;
      const coverageB = statsB.totalMinutes;
      if (coverageA !== coverageB) return coverageB - coverageA;
      
      // Rule 2 continued: Lower cost
      return statsA.cost - statsB.cost;
    });

  // Select platforms greedily until all content is covered or budget exceeded
  for (const [platformId, stats] of sortedPlatforms) {
    // Check if this platform covers any uncovered content
    const newlyCovered = stats.coveredItems.filter(item => !coveredItemIds.has(item.id));
    if (newlyCovered.length === 0) continue;

    // Check budget constraint
    if (currentCost + stats.cost > userBudget) continue;

    selectedPlatformIds.add(platformId);
    currentCost += stats.cost;
    newlyCovered.forEach(item => coveredItemIds.add(item.id));

    // Check if all content is covered
    const allCovered = remainingContent.every(item => coveredItemIds.has(item.id));
    if (allCovered) break;
  }

  // Build OptimizedService array
  const selectedPlatforms: OptimizedService[] = [];
  
  for (const serviceId of selectedPlatformIds) {
    const { potentialHours, coveredItems } = calculatePlatformPotential(
      serviceId,
      watchlist,
      contentState
    );
    
    const cost = getPlatformPrice(serviceId);
    const { name, color } = getPlatformInfo(serviceId);
    
    selectedPlatforms.push({
      service: serviceId,
      serviceName: name,
      cost,
      itemsToWatch: coveredItems,
      valueDensity: potentialHours / cost,
      color,
      watchTime: Math.min(potentialHours, MONTHLY_WATCH_LIMIT),
    });
  }

  // Sort by coverage (more items first)
  selectedPlatforms.sort((a, b) => b.itemsToWatch.length - a.itemsToWatch.length);

  return selectedPlatforms;
}

// ------------------------------
// FUNCTION: Priority-Driven Platform Selection
// ------------------------------
function selectPlatformsForMonth(
  watchlist: WatchlistItem[],
  contentState: Map<string, ContentState>,
  userBudget: number,
  previousPlatforms: Set<string> = new Set()
): OptimizedService[] {
  // Check for degenerate priority state (all same priority)
  if (isUniformPriority(watchlist, contentState)) {
    return selectPlatformsUniformPriority(watchlist, contentState, userBudget, previousPlatforms);
  }

  const selectedPlatformIds = new Set<string>();
  
  // PRIORITY-FIRST: Process content by priority level (HIGH → MEDIUM → LOW)
  const priorityLevels = ["high", "medium", "low"];
  
  for (const priority of priorityLevels) {
    // Get remaining content at this priority level (only schedulable items)
    const contentAtPriority = watchlist.filter(item => {
      if (!shouldScheduleItem(item)) return false;
      const state = contentState.get(item.id);
      return item.priority === priority && state && state.remainingMinutes > 0;
    });
    
    if (contentAtPriority.length === 0) continue;
    
    // For each content item at this priority, ensure its platform is selected
    for (const item of contentAtPriority) {
      const effectiveProviders = getEffectiveProviders(item);
      
      // Find the cheapest platform that hosts this item (among its providers)
      let bestPlatform: string | null = null;
      let bestCost = Infinity;
      
      for (const provider of effectiveProviders) {
        // Prefer already-selected platforms (no extra cost)
        if (selectedPlatformIds.has(provider)) {
          bestPlatform = provider;
          bestCost = 0;
          break;
        }
        
        const cost = getPlatformPrice(provider);
        if (cost < bestCost) {
          bestCost = cost;
          bestPlatform = provider;
        }
      }
      
      // Add the platform if not already selected and fits budget
      if (bestPlatform && !selectedPlatformIds.has(bestPlatform)) {
        const currentCost = Array.from(selectedPlatformIds).reduce(
          (sum, id) => sum + getPlatformPrice(id), 0
        );
        const platformCost = getPlatformPrice(bestPlatform);
        
        // For HIGH priority: FORCE inclusion even if over budget (priority > cost)
        // For MEDIUM/LOW: respect budget constraint
        if (priority === "high" || currentCost + platformCost <= userBudget) {
          selectedPlatformIds.add(bestPlatform);
        }
      }
    }
  }
  
  // Build OptimizedService array from selected platforms
  const selectedPlatforms: OptimizedService[] = [];
  
  for (const serviceId of selectedPlatformIds) {
    const { potentialHours, coveredItems } = calculatePlatformPotential(
      serviceId,
      watchlist,
      contentState
    );
    
    const cost = getPlatformPrice(serviceId);
    const { name, color } = getPlatformInfo(serviceId);
    
    selectedPlatforms.push({
      service: serviceId,
      serviceName: name,
      cost,
      itemsToWatch: coveredItems,
      valueDensity: potentialHours / cost,
      color,
      watchTime: Math.min(potentialHours, MONTHLY_WATCH_LIMIT),
    });
  }
  
  // Sort by priority of content they cover (platforms with HIGH priority content first)
  selectedPlatforms.sort((a, b) => {
    const aHasHigh = a.itemsToWatch.some(i => i.priority === "high");
    const bHasHigh = b.itemsToWatch.some(i => i.priority === "high");
    if (aHasHigh && !bHasHigh) return -1;
    if (!aHasHigh && bHasHigh) return 1;
    return 0;
  });
  
  return selectedPlatforms;
}

// ------------------------------
// FUNCTION: Schedule Content for Month (Fair/Proportional within Priority Buckets)
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
  
  // Group content by priority buckets
  const priorityBuckets: Record<string, ContentState[]> = {
    high: [],
    medium: [],
    low: [],
  };
  
  for (const state of candidateContent) {
    const priority = state.item.priority || "low";
    priorityBuckets[priority].push(state);
  }
  
  // Within each bucket, sort: 
  // 1. Movies before Series (movies need single sitting)
  // 2. For uniform priority (tie-breaker): longest-content-first (Rule 4)
  for (const priority of Object.keys(priorityBuckets)) {
    priorityBuckets[priority].sort((a, b) => {
      // Movies before series
      if (a.item.type === "movie" && b.item.type !== "movie") return -1;
      if (a.item.type !== "movie" && b.item.type === "movie") return 1;
      // Tie-breaker: longest remaining content first (Rule 4)
      return b.remainingMinutes - a.remainingMinutes;
    });
  }
  
  const scheduledItems: ScheduledItem[] = [];
  let remainingTimeHours = MONTHLY_WATCH_LIMIT;
  let currentDay = 1;
  let dailyRemainingHours = DAILY_WATCH_HOURS;
  
  // Track scheduled hours per item for this month
  const scheduledHoursThisMonth = new Map<string, number>();
  
  // Process priority buckets in order: HIGH → MEDIUM → LOW
  const priorityOrder = ["high", "medium", "low"];
  
  for (const priority of priorityOrder) {
    const bucket = priorityBuckets[priority];
    if (bucket.length === 0) continue;
    if (remainingTimeHours <= 0) break;
    
    // Separate movies and series
    const movies = bucket.filter(s => s.item.type === "movie");
    const series = bucket.filter(s => s.item.type !== "movie");
    
    // FAIR ALLOCATION: Equal share for all items in this priority bucket
    // Movies get scheduled first only if they fit within their fair share
    const allActiveItems = bucket.filter(s => s.remainingMinutes > 0);
    const itemCount = allActiveItems.length;
    
    if (itemCount === 0) continue;
    
    // Calculate equal share per item (INTRA-MONTH FAIRNESS)
    const availableMinutes = remainingTimeHours * 60;
    const equalShareMinutes = Math.floor(availableMinutes / itemCount);
    
    // Track allocations for redistribution
    const allocations = new Map<string, number>();
    let surplusMinutes = 0;
    
    // First pass: allocate equal shares, track surplus from items that finish early
    for (const state of allActiveItems) {
      const neededMinutes = state.remainingMinutes;
      const allocated = Math.min(neededMinutes, equalShareMinutes);
      allocations.set(state.item.id, allocated);
      
      // If item needs less than equal share, track surplus
      if (neededMinutes < equalShareMinutes) {
        surplusMinutes += equalShareMinutes - neededMinutes;
      }
    }
    
    // Second pass: redistribute surplus to items that can use more
    if (surplusMinutes > 0) {
      const needsMore = allActiveItems.filter(s => {
        const alloc = allocations.get(s.item.id) || 0;
        return s.remainingMinutes > alloc;
      });
      
      while (surplusMinutes > 0 && needsMore.length > 0) {
        const extraPerItem = Math.floor(surplusMinutes / needsMore.length);
        if (extraPerItem === 0) {
          // Distribute remaining 1 minute at a time
          for (const state of needsMore) {
            if (surplusMinutes <= 0) break;
            const currentAlloc = allocations.get(state.item.id) || 0;
            const canUse = state.remainingMinutes - currentAlloc;
            if (canUse > 0) {
              allocations.set(state.item.id, currentAlloc + 1);
              surplusMinutes -= 1;
            }
          }
          break;
        }
        
        let redistributed = 0;
        for (const state of needsMore) {
          const currentAlloc = allocations.get(state.item.id) || 0;
          const canUse = Math.min(extraPerItem, state.remainingMinutes - currentAlloc);
          if (canUse > 0) {
            allocations.set(state.item.id, currentAlloc + canUse);
            redistributed += canUse;
          }
        }
        
        surplusMinutes -= redistributed;
        if (redistributed === 0) break;
        
        // Update needsMore list
        needsMore.length = 0;
        for (const state of allActiveItems) {
          const alloc = allocations.get(state.item.id) || 0;
          if (state.remainingMinutes > alloc) {
            needsMore.push(state);
          }
        }
      }
    }
    
    // Schedule movies first (single sitting requirement)
    // But only if their full duration fits within their allocation
    for (const state of movies) {
      if (remainingTimeHours <= 0) break;
      
      const movieEffHours = state.remainingMinutes / 60;
      const allocatedMinutes = allocations.get(state.item.id) || 0;
      
      // Movie must fit entirely within allocation (can't partially watch a movie)
      if (state.remainingMinutes <= allocatedMinutes && movieEffHours <= remainingTimeHours) {
        const startDate = new Date(monthStart);
        startDate.setDate(startDate.getDate() + currentDay - 1);
        
        scheduledItems.push({
          ...state.item,
          day: currentDay,
          estimatedStartDate: new Date(startDate),
          estimatedEndDate: new Date(startDate),
          watchHours: movieEffHours,
        });
        
        state.remainingMinutes = 0;
        remainingTimeHours -= movieEffHours;
        scheduledHoursThisMonth.set(state.item.id, movieEffHours);
        
        currentDay += 1;
        dailyRemainingHours = DAILY_WATCH_HOURS;
      }
      // Movies that don't fit will be scheduled next month
    }
    
    // Schedule series with their fair allocated time
    const activeSeries = series.filter(s => s.remainingMinutes > 0);
    
    for (const state of activeSeries) {
      const allocatedMinutes = allocations.get(state.item.id) || 0;
      if (allocatedMinutes <= 0 || remainingTimeHours <= 0) continue;
      
      const startDay = currentDay;
      const startDate = new Date(monthStart);
      startDate.setDate(startDate.getDate() + startDay - 1);
      
      // Simulate day-by-day watching
      let watchedMinutes = 0;
      const episodeDuration = state.rawMinutes / (state.item.episodeCount || 10);
      const effEpisodeDuration = episodeDuration * (PRIORITY_WEIGHT[state.item.priority] ?? PRIORITY_WEIGHT.low);
      
      while (watchedMinutes < allocatedMinutes && currentDay <= DAYS_IN_MONTH) {
        const episodeHours = effEpisodeDuration / 60;
        
        if (dailyRemainingHours < episodeHours && dailyRemainingHours < 0.5) {
          currentDay += 1;
          dailyRemainingHours = DAILY_WATCH_HOURS;
        }
        
        const canWatch = Math.min(dailyRemainingHours * 60, allocatedMinutes - watchedMinutes);
        watchedMinutes += canWatch;
        dailyRemainingHours -= canWatch / 60;
        
        if (dailyRemainingHours <= 0) {
          currentDay += 1;
          dailyRemainingHours = DAILY_WATCH_HOURS;
        }
      }
      
      const endDate = new Date(monthStart);
      endDate.setDate(endDate.getDate() + Math.max(currentDay - 1, startDay));
      
      const watchedHours = allocatedMinutes / 60;
      
      scheduledItems.push({
        ...state.item,
        day: startDay,
        estimatedStartDate: new Date(startDate),
        estimatedEndDate: new Date(endDate),
        watchHours: watchedHours,
        remainingMinutes: state.remainingMinutes - allocatedMinutes,
      });
      
      state.remainingMinutes -= allocatedMinutes;
      remainingTimeHours -= watchedHours;
      scheduledHoursThisMonth.set(
        state.item.id,
        (scheduledHoursThisMonth.get(state.item.id) || 0) + watchedHours
      );
    }
  }
  
  // DISPLAY ORDER: Sort scheduled items deterministically for consistent display
  // This does NOT affect scheduling logic, only the order items appear in the UI
  const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  
  scheduledItems.sort((a, b) => {
    // 1. Priority (high > medium > low)
    const priorityA = priorityRank[a.priority] ?? 2;
    const priorityB = priorityRank[b.priority] ?? 2;
    if (priorityA !== priorityB) return priorityA - priorityB;
    
    // 2. Larger remaining effective watch time first
    const remainingA = a.remainingMinutes ?? 0;
    const remainingB = b.remainingMinutes ?? 0;
    if (remainingA !== remainingB) return remainingB - remainingA;
    
    // 3. Item that completes earlier first
    const endA = a.estimatedEndDate.getTime();
    const endB = b.estimatedEndDate.getTime();
    if (endA !== endB) return endA - endB;
    
    // 4. Stable deterministic fallback: alphabetical by title
    return a.title.localeCompare(b.title);
  });

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
  
  // Track previous month's platforms for minimizing switches
  let previousPlatforms = new Set<string>();

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
    
    // Step A & B: Select platforms for this month (pass previous platforms for switch minimization)
    const selectedPlatforms = selectPlatformsForMonth(watchlist, contentState, budget, previousPlatforms);
    
    if (selectedPlatforms.length === 0) break;
    
    // Update previous platforms for next iteration
    previousPlatforms = new Set(selectedPlatforms.map(p => p.service));
    
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
  
  // First, add items with pending platform selection
  watchlist.forEach(item => {
    if (item.pendingPlatformSelection) {
      deferredItems.push({
        item,
        reason: "Pending platform selection - marked as 'decide later'.",
      });
    }
  });
  
  contentState.forEach(state => {
    // Skip items already in deferred (pending platform selection)
    if (deferredItems.some(d => d.item.id === state.item.id)) return;
    
    if (state.remainingMinutes > 0) {
      const effectiveProviders = getEffectiveProviders(state.item);
      
      if (effectiveProviders.length === 0) {
        deferredItems.push({
          item: state.item,
          reason: "No streaming platform available. Please select a platform manually.",
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

// ------------------------------
// HELPER: Check if watchlist is ready for optimization
// ------------------------------
export interface WatchlistReadiness {
  isReady: boolean;
  highPriorityMissingPlatform: WatchlistItem[];
  otherMissingPlatform: WatchlistItem[];
  pendingPlatformSelection: WatchlistItem[];
}

export function checkWatchlistReadiness(watchlist: WatchlistItem[]): WatchlistReadiness {
  const highPriorityMissingPlatform: WatchlistItem[] = [];
  const otherMissingPlatform: WatchlistItem[] = [];
  const pendingPlatformSelection: WatchlistItem[] = [];
  
  for (const item of watchlist) {
    // Items explicitly marked as "decide later"
    if (item.pendingPlatformSelection) {
      pendingPlatformSelection.push(item);
      continue;
    }
    
    // Items with no provider (TMDB or user-selected)
    const hasProvider = item.providers.length > 0 || !!item.userSelectedProvider;
    if (!hasProvider) {
      if (item.priority === "high") {
        highPriorityMissingPlatform.push(item);
      } else {
        otherMissingPlatform.push(item);
      }
    }
  }
  
  // Ready if no HIGH-priority items are missing platforms
  const isReady = highPriorityMissingPlatform.length === 0;
  
  return {
    isReady,
    highPriorityMissingPlatform,
    otherMissingPlatform,
    pendingPlatformSelection,
  };
}
