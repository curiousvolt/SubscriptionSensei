import { WatchlistItem } from "@/data/sampleContent";
import { STREAMING_SERVICES } from "@/data/services";

// ============================================
// CONSTANTS
// ============================================
const DAILY_WATCH_HOURS = 2;
const DAYS_IN_MONTH = 30;
const MONTHLY_WATCH_LIMIT = DAILY_WATCH_HOURS * DAYS_IN_MONTH; // 60 hours

const PLATFORM_PRICES: Record<string, number> = {
  netflix: 7.99,
  disney: 9.99,
  hulu: 9.99,
  disney_hulu_bundle: 10.99,
  hbo: 10.99,
  amazon: 8.99,
  paramount: 7.99,
  peacock: 8.99,
  apple: 12.99,
};

// Priority is ORDINAL only - no multipliers
const PRIORITY_ORDER: readonly string[] = ["high", "medium", "low"] as const;

// ============================================
// INTERFACES
// ============================================
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

// Internal state tracking - uses REAL minutes only
interface ContentState {
  item: WatchlistItem;
  realMinutes: number;        // Actual watch time from TMDB
  remainingMinutes: number;   // How much is left to watch
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get REAL watch time in minutes - NO MULTIPLIERS
 */
function getRealWatchTimeMinutes(item: WatchlistItem): number {
  if (item.totalWatchTimeMinutes) {
    return item.totalWatchTimeMinutes;
  }
  if (item.type === "movie") {
    return 120; // Default movie ~2 hours
  }
  const episodes = item.episodeCount || 10;
  return episodes * 45; // ~45 min per episode
}

function getPlatformPrice(serviceId: string): number {
  return PLATFORM_PRICES[serviceId] ?? STREAMING_SERVICES.find(s => s.id === serviceId)?.price ?? 9.99;
}

function getPlatformInfo(serviceId: string) {
  const service = STREAMING_SERVICES.find(s => s.id === serviceId);
  return {
    name: service?.name ?? serviceId,
    color: service?.color ?? "gray",
  };
}

function getEffectiveProviders(item: WatchlistItem): string[] {
  if (item.userSelectedProvider) {
    return [item.userSelectedProvider];
  }
  return item.providers;
}

function shouldScheduleItem(item: WatchlistItem): boolean {
  if (item.pendingPlatformSelection) return false;
  if (item.providers.length === 0 && !item.userSelectedProvider) return false;
  return true;
}

/**
 * Initialize content state with REAL watch times only
 */
function initializeContentState(watchlist: WatchlistItem[]): Map<string, ContentState> {
  const contentMap = new Map<string, ContentState>();
  
  for (const item of watchlist) {
    const realMinutes = getRealWatchTimeMinutes(item);
    contentMap.set(item.id, {
      item,
      realMinutes,
      remainingMinutes: realMinutes,
    });
  }
  
  return contentMap;
}

// ============================================
// STEP A: IDENTIFY ACTIVE PRIORITY BUCKET
// ============================================

/**
 * Find the highest priority level that still has unwatched content
 */
function getActivePriorityBucket(
  watchlist: WatchlistItem[],
  contentState: Map<string, ContentState>
): { priority: string; items: WatchlistItem[] } | null {
  
  for (const priority of PRIORITY_ORDER) {
    const items = watchlist.filter(item => {
      if (!shouldScheduleItem(item)) return false;
      const state = contentState.get(item.id);
      return (item.priority || "low") === priority && state && state.remainingMinutes > 0;
    });
    
    if (items.length > 0) {
      return { priority, items };
    }
  }
  
  return null;
}

// ============================================
// STEP B: MANDATORY PLATFORM INCLUSION (BUDGET-AWARE)
// ============================================

/**
 * Get the cheapest provider for a single item
 */
function getCheapestProvider(item: WatchlistItem): { provider: string; cost: number } | null {
  const providers = getEffectiveProviders(item);
  if (providers.length === 0) return null;
  
  let cheapest = providers[0];
  let cheapestPrice = getPlatformPrice(providers[0]);
  
  for (const p of providers) {
    const price = getPlatformPrice(p);
    if (price < cheapestPrice) {
      cheapest = p;
      cheapestPrice = price;
    }
  }
  
  return { provider: cheapest, cost: cheapestPrice };
}

/**
 * Calculate total cost for a set of platforms
 */
function calculatePlatformsCost(platformIds: Set<string>): number {
  let total = 0;
  for (const id of platformIds) {
    total += getPlatformPrice(id);
  }
  return total;
}

/**
 * Select items that can fit within budget for a priority bucket
 * Returns items that can be scheduled this month without exceeding budget
 */
function selectItemsWithinBudget(
  items: WatchlistItem[],
  budget: number
): { selectedItems: WatchlistItem[]; deferredItems: WatchlistItem[] } {
  // Group items by their cheapest platform
  const itemsByPlatform = new Map<string, WatchlistItem[]>();
  
  for (const item of items) {
    const cheapest = getCheapestProvider(item);
    if (!cheapest) continue;
    
    const existing = itemsByPlatform.get(cheapest.provider) || [];
    existing.push(item);
    itemsByPlatform.set(cheapest.provider, existing);
  }
  
  // Sort platforms by cost (cheapest first)
  const platformsWithCosts = Array.from(itemsByPlatform.keys()).map(p => ({
    platform: p,
    cost: getPlatformPrice(p),
    items: itemsByPlatform.get(p) || [],
  }));
  platformsWithCosts.sort((a, b) => a.cost - b.cost);
  
  // Greedily select platforms within budget
  const selectedPlatforms = new Set<string>();
  const selectedItems: WatchlistItem[] = [];
  const deferredItems: WatchlistItem[] = [];
  let currentCost = 0;
  
  for (const { platform, cost, items: platformItems } of platformsWithCosts) {
    if (currentCost + cost <= budget) {
      selectedPlatforms.add(platform);
      currentCost += cost;
      selectedItems.push(...platformItems);
    } else {
      // Budget exceeded - defer these items
      deferredItems.push(...platformItems);
    }
  }
  
  return { selectedItems, deferredItems };
}

/**
 * Select platforms for the month with HARD BUDGET CAP
 * Budget is non-negotiable - if high-priority content exceeds budget, split across months
 */
function selectPlatformsForMonth(
  activeBucket: { priority: string; items: WatchlistItem[] },
  watchlist: WatchlistItem[],
  contentState: Map<string, ContentState>,
  budget: number,
  previousPlatforms: Set<string>
): { platforms: OptimizedService[]; itemsToSchedule: WatchlistItem[] } {
  
  // Filter items that still have remaining watch time
  const activeItems = activeBucket.items.filter(item => {
    const state = contentState.get(item.id);
    return state && state.remainingMinutes > 0;
  });
  
  // Select items within budget
  const { selectedItems, deferredItems } = selectItemsWithinBudget(activeItems, budget);
  
  // Get unique platforms needed for selected items
  const selectedPlatformIds = new Set<string>();
  for (const item of selectedItems) {
    const cheapest = getCheapestProvider(item);
    if (cheapest) {
      selectedPlatformIds.add(cheapest.provider);
    }
  }
  
  // VALIDATION: Ensure we don't exceed budget (should never happen due to selectItemsWithinBudget)
  let totalCost = calculatePlatformsCost(selectedPlatformIds);
  if (totalCost > budget) {
    console.warn(`Budget validation failed: $${totalCost} > $${budget}. This should not happen.`);
  }
  
  // OPTIONAL: If budget allows, add platforms for lower priority items
  const lowerPriorityItems = watchlist.filter(item => {
    if (!shouldScheduleItem(item)) return false;
    const state = contentState.get(item.id);
    const itemPriority = item.priority || "low";
    const priorityIdx = PRIORITY_ORDER.indexOf(itemPriority);
    const activePriorityIdx = PRIORITY_ORDER.indexOf(activeBucket.priority);
    return priorityIdx > activePriorityIdx && state && state.remainingMinutes > 0;
  });
  
  // Try to add platforms for lower priority items if budget allows
  for (const item of lowerPriorityItems) {
    const cheapest = getCheapestProvider(item);
    if (!cheapest) continue;
    
    if (selectedPlatformIds.has(cheapest.provider)) {
      // Platform already selected, item can be scheduled
      selectedItems.push(item);
      continue;
    }
    
    if (totalCost + cheapest.cost <= budget) {
      // Prefer previously used platforms
      if (previousPlatforms.has(cheapest.provider)) {
        selectedPlatformIds.add(cheapest.provider);
        totalCost += cheapest.cost;
        selectedItems.push(item);
      }
    }
  }
  
  // FINAL VALIDATION: Ensure budget is respected
  if (totalCost > budget) {
    console.error(`CRITICAL: Monthly cost $${totalCost} exceeds budget $${budget}`);
  }
  
  // Build OptimizedService array
  const selectedPlatforms: OptimizedService[] = [];
  
  for (const serviceId of selectedPlatformIds) {
    // Get items this platform can serve (from selected items only)
    const coveredItems = selectedItems.filter(item => {
      const cheapest = getCheapestProvider(item);
      return cheapest && cheapest.provider === serviceId;
    });
    
    let totalWatchHours = 0;
    for (const item of coveredItems) {
      const state = contentState.get(item.id);
      if (state) {
        totalWatchHours += state.remainingMinutes / 60;
      }
    }
    
    const cost = getPlatformPrice(serviceId);
    const { name, color } = getPlatformInfo(serviceId);
    
    selectedPlatforms.push({
      service: serviceId,
      serviceName: name,
      cost,
      itemsToWatch: coveredItems,
      valueDensity: totalWatchHours / cost,
      color,
      watchTime: Math.min(totalWatchHours, MONTHLY_WATCH_LIMIT),
    });
  }
  
  // Sort by items count (most content first)
  selectedPlatforms.sort((a, b) => b.itemsToWatch.length - a.itemsToWatch.length);
  
  return { platforms: selectedPlatforms, itemsToSchedule: selectedItems };
}

// ============================================
// STEP C & D: FAIR SCHEDULING
// ============================================

/**
 * Schedule content for a month with FAIR progress
 * 
 * Rules:
 * - Process one priority bucket at a time
 * - Within a bucket, ALL items progress together (fair share)
 * - Movies are scheduled in single sittings before series
 * - Leftover time redistributed to items that need more
 * - Only move to lower priority if current bucket exhausted AND time remains
 */
function scheduleContentForMonth(
  selectedPlatforms: OptimizedService[],
  contentState: Map<string, ContentState>,
  watchlist: WatchlistItem[],
  monthStart: Date
): { scheduledItems: ScheduledItem[]; totalWatchedHours: number } {
  
  // Get all schedulable content from selected platforms
  const availablePlatformIds = new Set(selectedPlatforms.map(p => p.service));
  const candidateItems: ContentState[] = [];
  const addedIds = new Set<string>();
  
  for (const item of watchlist) {
    if (!shouldScheduleItem(item)) continue;
    const state = contentState.get(item.id);
    if (!state || state.remainingMinutes <= 0) continue;
    if (addedIds.has(item.id)) continue;
    
    // Check if item's platform is selected this month
    const providers = getEffectiveProviders(item);
    const hasSelectedPlatform = providers.some(p => availablePlatformIds.has(p));
    if (!hasSelectedPlatform) continue;
    
    candidateItems.push(state);
    addedIds.add(item.id);
  }
  
  // Group by priority
  const buckets: Record<string, ContentState[]> = { high: [], medium: [], low: [] };
  for (const state of candidateItems) {
    const priority = state.item.priority || "low";
    buckets[priority].push(state);
  }
  
  const scheduledItems: ScheduledItem[] = [];
  let remainingCapacityMinutes = MONTHLY_WATCH_LIMIT * 60;
  let currentDay = 1;
  
  // Process priority buckets in order
  for (const priority of PRIORITY_ORDER) {
    const bucket = buckets[priority];
    if (bucket.length === 0) continue;
    if (remainingCapacityMinutes <= 0) break;
    
    // Separate movies and series
    const movies = bucket.filter(s => s.item.type === "movie" && s.remainingMinutes > 0);
    const series = bucket.filter(s => s.item.type !== "movie" && s.remainingMinutes > 0);
    
    // STEP D: Movies first - must be watched in one sitting
    for (const movieState of movies) {
      if (remainingCapacityMinutes <= 0) break;
      
      const movieMinutes = movieState.remainingMinutes;
      
      // Movie must fit entirely in remaining capacity
      if (movieMinutes <= remainingCapacityMinutes) {
        const startDate = new Date(monthStart);
        startDate.setDate(startDate.getDate() + currentDay - 1);
        
        scheduledItems.push({
          ...movieState.item,
          day: currentDay,
          estimatedStartDate: new Date(startDate),
          estimatedEndDate: new Date(startDate),
          watchHours: movieMinutes / 60,
          remainingMinutes: 0,
        });
        
        movieState.remainingMinutes = 0;
        remainingCapacityMinutes -= movieMinutes;
        currentDay += 1;
      }
      // Movies that don't fit are pushed to next month automatically
    }
    
    // STEP C: Series with FAIR allocation
    const activeSeries = series.filter(s => s.remainingMinutes > 0);
    if (activeSeries.length === 0 || remainingCapacityMinutes <= 0) continue;
    
    // Calculate FAIR share: 60h / |R| per item
    const equalShareMinutes = Math.floor(remainingCapacityMinutes / activeSeries.length);
    
    // Track allocations and surplus
    const allocations = new Map<string, number>();
    let surplusMinutes = 0;
    
    // First pass: allocate equal shares
    for (const state of activeSeries) {
      const needed = state.remainingMinutes;
      const allocated = Math.min(needed, equalShareMinutes);
      allocations.set(state.item.id, allocated);
      
      // If item finishes early, track surplus for redistribution
      if (needed < equalShareMinutes) {
        surplusMinutes += equalShareMinutes - needed;
      }
    }
    
    // Second pass: redistribute surplus to items that need more
    if (surplusMinutes > 0) {
      const needsMore = activeSeries.filter(s => {
        const alloc = allocations.get(s.item.id) || 0;
        return s.remainingMinutes > alloc;
      });
      
      while (surplusMinutes > 0 && needsMore.length > 0) {
        const extraPerItem = Math.floor(surplusMinutes / needsMore.length);
        if (extraPerItem === 0) {
          // Distribute 1 minute at a time for remainder
          for (let i = 0; i < needsMore.length && surplusMinutes > 0; i++) {
            const state = needsMore[i];
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
        for (const state of activeSeries) {
          const alloc = allocations.get(state.item.id) || 0;
          if (state.remainingMinutes > alloc) {
            needsMore.push(state);
          }
        }
      }
    }
    
    // Schedule series with their allocated time
    for (const state of activeSeries) {
      const allocatedMinutes = allocations.get(state.item.id) || 0;
      if (allocatedMinutes <= 0) continue;
      
      const startDay = currentDay;
      const startDate = new Date(monthStart);
      startDate.setDate(startDate.getDate() + startDay - 1);
      
      // Calculate end day based on daily watch capacity
      const daysNeeded = Math.ceil(allocatedMinutes / (DAILY_WATCH_HOURS * 60));
      const endDay = Math.min(startDay + daysNeeded - 1, DAYS_IN_MONTH);
      
      const endDate = new Date(monthStart);
      endDate.setDate(endDate.getDate() + endDay - 1);
      
      const watchHours = allocatedMinutes / 60;
      const newRemaining = state.remainingMinutes - allocatedMinutes;
      
      scheduledItems.push({
        ...state.item,
        day: startDay,
        estimatedStartDate: new Date(startDate),
        estimatedEndDate: new Date(endDate),
        watchHours,
        remainingMinutes: newRemaining,
      });
      
      // Update content state
      state.remainingMinutes = newRemaining;
      remainingCapacityMinutes -= allocatedMinutes;
    }
    
    // Move current day forward
    currentDay = Math.min(currentDay + Math.ceil(activeSeries.length / 2), DAYS_IN_MONTH);
  }
  
  // STEP E: Lower priority fill already handled by processing all buckets
  
  const totalWatchedHours = (MONTHLY_WATCH_LIMIT * 60 - remainingCapacityMinutes) / 60;
  return { scheduledItems, totalWatchedHours };
}

// ============================================
// MAIN OPTIMIZATION FUNCTION
// ============================================
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function optimizeSubscriptions(
  watchlist: WatchlistItem[],
  budget: number
): OptimizationResult {
  // Initialize with REAL watch times only
  const contentState = initializeContentState(watchlist);
  
  // Calculate max months needed (real hours / 60h per month)
  let totalRealMinutes = 0;
  contentState.forEach(state => {
    if (shouldScheduleItem(state.item)) {
      totalRealMinutes += state.realMinutes;
    }
  });
  
  const M_max = Math.ceil(totalRealMinutes / (MONTHLY_WATCH_LIMIT * 60)) + 3;
  
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  
  const rotationSchedule: MonthlyPlan[] = [];
  let monthOffset = 0;
  let previousPlatforms = new Set<string>();
  
  // Month-by-month simulation
  while (monthOffset < Math.min(M_max, 24)) {
    // STEP A: Find active priority bucket
    const activeBucket = getActivePriorityBucket(watchlist, contentState);
    
    if (!activeBucket) break; // All content watched
    
    // STEP B: Select platforms with HARD BUDGET CAP
    const { platforms: selectedPlatforms, itemsToSchedule } = selectPlatformsForMonth(
      activeBucket,
      watchlist,
      contentState,
      budget,
      previousPlatforms
    );
    
    if (selectedPlatforms.length === 0) break;
    
    // BUDGET VALIDATION CHECKPOINT: Ensure monthly cost <= budget
    const monthlyCost = selectedPlatforms.reduce((sum, p) => sum + p.cost, 0);
    if (monthlyCost > budget) {
      console.error(`BUDGET VIOLATION: Month cost $${monthlyCost.toFixed(2)} exceeds budget $${budget}. Regenerating...`);
      // This should never happen due to selectItemsWithinBudget, but as a safety net
      break;
    }
    
    previousPlatforms = new Set(selectedPlatforms.map(p => p.service));
    
    const monthIdx = (currentMonth + monthOffset) % 12;
    const year = currentYear + Math.floor((currentMonth + monthOffset) / 12);
    const monthStart = new Date(year, monthIdx, 1);
    
    // STEP C & D: Schedule content fairly (only for items selected within budget)
    const { scheduledItems, totalWatchedHours } = scheduleContentForMonth(
      selectedPlatforms,
      contentState,
      watchlist,
      monthStart
    );
    
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
  
  // Build deferred items list
  const deferredItems: { item: WatchlistItem; reason: string }[] = [];
  
  // Items with pending platform selection
  for (const item of watchlist) {
    if (item.pendingPlatformSelection) {
      deferredItems.push({
        item,
        reason: "Pending platform selection - marked as 'decide later'.",
      });
    }
  }
  
  // Items that couldn't be scheduled
  contentState.forEach(state => {
    if (deferredItems.some(d => d.item.id === state.item.id)) return;
    
    if (state.remainingMinutes > 0) {
      const providers = getEffectiveProviders(state.item);
      
      if (providers.length === 0) {
        deferredItems.push({
          item: state.item,
          reason: "No streaming platform available. Please select a platform manually.",
        });
      } else {
        deferredItems.push({
          item: state.item,
          reason: "Could not fit within budget constraints. Consider increasing budget.",
        });
      }
    }
  });
  
  // Calculate results
  const totalMonthsNeeded = rotationSchedule.length;
  const totalRotationCost = rotationSchedule.reduce((sum, m) => sum + m.monthlyCost, 0);
  const averageMonthlyCost = totalMonthsNeeded > 0 ? totalRotationCost / totalMonthsNeeded : 0;
  
  const firstMonthServices = rotationSchedule[0]?.services || [];
  
  // Coverage calculation
  const totalItems = watchlist.length;
  const watchedItems = totalItems - deferredItems.length;
  const coveragePercent = totalItems > 0 ? Math.round((watchedItems / totalItems) * 100) : 0;
  
  // Savings vs subscribing to all services
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

// ============================================
// WATCHLIST READINESS CHECK
// ============================================
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
    if (item.pendingPlatformSelection) {
      pendingPlatformSelection.push(item);
      continue;
    }
    
    const hasProvider = item.providers.length > 0 || !!item.userSelectedProvider;
    if (!hasProvider) {
      if (item.priority === "high") {
        highPriorityMissingPlatform.push(item);
      } else {
        otherMissingPlatform.push(item);
      }
    }
  }
  
  const isReady = highPriorityMissingPlatform.length === 0;
  
  return {
    isReady,
    highPriorityMissingPlatform,
    otherMissingPlatform,
    pendingPlatformSelection,
  };
}
