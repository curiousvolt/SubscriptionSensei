import { WatchlistItem } from "@/data/sampleContent";
import { STREAMING_SERVICES, SERVICE_PRICES } from "@/data/services";

export interface OptimizedService {
  service: string;
  serviceName: string;
  cost: number;
  itemsToWatch: WatchlistItem[];
  valueDensity: number;
  color: string;
}

export interface MonthlyPlan {
  month: string;
  monthIndex: number;
  services: OptimizedService[];
  itemsToWatch: WatchlistItem[];
  monthlyCost: number;
  action: "subscribe" | "rotate" | "keep" | "cancel";
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

function getPriorityValue(priority: string): number {
  switch (priority) {
    case "high": return 3;
    case "medium": return 2;
    case "low": return 1;
    default: return 1;
  }
}

function getWatchTime(item: WatchlistItem): number {
  // Estimate watch time in hours
  if (item.type === "movie") {
    return 2; // Average movie length
  } else {
    // TV series - estimate based on episode count or default
    const episodes = item.episodeCount || 10;
    return episodes * 0.75; // 45 min per episode
  }
}

function calculateValueDensity(
  serviceId: string,
  watchlist: WatchlistItem[]
): { density: number; coveredItems: WatchlistItem[] } {
  const cost = SERVICE_PRICES[serviceId];
  const coveredItems = watchlist.filter((item) =>
    item.providers.includes(serviceId)
  );
  
  if (coveredItems.length === 0) return { density: 0, coveredItems: [] };
  
  const totalValue = coveredItems.reduce(
    (sum, item) => sum + getPriorityValue(item.priority) * (item.type === "tv" ? 1.5 : 1),
    0
  );
  
  return {
    density: totalValue / cost,
    coveredItems,
  };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Estimate how many months needed to watch all content on a service
function estimateMonthsNeeded(items: WatchlistItem[]): number {
  const totalHours = items.reduce((sum, item) => sum + getWatchTime(item), 0);
  // Assume average viewing of 15 hours per month
  const monthsNeeded = Math.ceil(totalHours / 15);
  return Math.max(1, monthsNeeded);
}

export function optimizeSubscriptions(
  watchlist: WatchlistItem[],
  budget: number
): OptimizationResult {
  const allServicesCost = STREAMING_SERVICES.reduce((sum, s) => sum + s.price, 0);
  
  // Calculate value density for each service
  const serviceAnalysis = STREAMING_SERVICES.map((service) => {
    const { density, coveredItems } = calculateValueDensity(service.id, watchlist);
    return {
      service: service.id,
      serviceName: service.name,
      cost: service.price,
      itemsToWatch: coveredItems,
      valueDensity: density,
      color: service.color,
    };
  })
    .filter((s) => s.itemsToWatch.length > 0)
    .sort((a, b) => b.valueDensity - a.valueDensity);

  // --- IMPROVED ROTATION ALGORITHM ---
  // Goal: Watch all content by rotating services optimally
  
  const currentMonth = new Date().getMonth();
  const rotationSchedule: MonthlyPlan[] = [];
  const watchedItems = new Set<string>();
  const remainingItems = new Map<string, WatchlistItem[]>();
  
  // Initialize remaining items per service
  serviceAnalysis.forEach(service => {
    remainingItems.set(service.service, [...service.itemsToWatch]);
  });

  // Calculate optimal service order based on:
  // 1. Priority of content
  // 2. Unique content (not available elsewhere)
  // 3. Cost efficiency
  const getServiceScore = (service: OptimizedService, watchedIds: Set<string>): number => {
    const unwatchedItems = service.itemsToWatch.filter(item => !watchedIds.has(item.id));
    if (unwatchedItems.length === 0) return -1;
    
    // Score = (priority sum * uniqueness factor) / cost
    const prioritySum = unwatchedItems.reduce((sum, item) => sum + getPriorityValue(item.priority), 0);
    
    // Check for exclusive content
    const exclusiveCount = unwatchedItems.filter(item => 
      item.providers.length === 1 || 
      item.providers.every(p => p === service.service || !serviceAnalysis.find(s => s.service === p))
    ).length;
    
    const uniquenessFactor = 1 + (exclusiveCount / unwatchedItems.length) * 0.5;
    
    return (prioritySum * uniquenessFactor) / service.cost;
  };

  // Build rotation schedule
  let monthOffset = 0;
  let activeServices: OptimizedService[] = [];
  let monthlyBudget = budget;

  while (true) {
    const monthIdx = (currentMonth + monthOffset) % 12;
    
    // Get services with remaining unwatched content
    const availableServices = serviceAnalysis
      .map(s => ({
        ...s,
        score: getServiceScore(s, watchedItems),
        unwatched: s.itemsToWatch.filter(item => !watchedItems.has(item.id))
      }))
      .filter(s => s.score > 0)
      .sort((a, b) => b.score - a.score);
    
    if (availableServices.length === 0) break;
    
    // Select services within budget, prioritizing by score
    const selectedServices: OptimizedService[] = [];
    let spent = 0;
    
    for (const service of availableServices) {
      if (spent + service.cost <= monthlyBudget) {
        selectedServices.push(service);
        spent += service.cost;
      }
    }
    
    if (selectedServices.length === 0) {
      // Budget too low - pick cheapest service with content
      const cheapest = availableServices.sort((a, b) => a.cost - b.cost)[0];
      if (cheapest) {
        selectedServices.push(cheapest);
        spent = cheapest.cost;
      }
    }
    
    // Determine which items to watch this month
    const itemsThisMonth: WatchlistItem[] = [];
    
    selectedServices.forEach(service => {
      const serviceItems = service.itemsToWatch.filter(item => !watchedItems.has(item.id));
      
      // Prioritize high priority items first
      const sortedItems = serviceItems.sort((a, b) => 
        getPriorityValue(b.priority) - getPriorityValue(a.priority)
      );
      
      // Estimate how many items can be watched in a month
      let monthHours = 15; // Available hours per month
      for (const item of sortedItems) {
        const itemHours = getWatchTime(item);
        if (monthHours >= itemHours) {
          itemsThisMonth.push(item);
          watchedItems.add(item.id);
          monthHours -= itemHours;
        }
      }
    });
    
    // Determine action type
    let action: "subscribe" | "rotate" | "keep" | "cancel" = "subscribe";
    if (monthOffset > 0) {
      const previousServices = rotationSchedule[monthOffset - 1]?.services || [];
      const prevIds = new Set(previousServices.map(s => s.service));
      const currIds = new Set(selectedServices.map(s => s.service));
      
      const sameServices = selectedServices.every(s => prevIds.has(s.service)) && 
                          previousServices.every(s => currIds.has(s.service));
      
      if (sameServices) {
        action = "keep";
      } else {
        action = "rotate";
      }
    }
    
    rotationSchedule.push({
      month: MONTHS[monthIdx],
      monthIndex: monthIdx,
      services: selectedServices,
      itemsToWatch: itemsThisMonth,
      monthlyCost: spent,
      action,
    });
    
    monthOffset++;
    
    // Safety limit
    if (monthOffset > 24) break;
  }

  // Calculate totals
  const totalMonthsNeeded = rotationSchedule.length;
  const totalRotationCost = rotationSchedule.reduce((sum, m) => sum + m.monthlyCost, 0);
  const averageMonthlyCost = totalMonthsNeeded > 0 ? totalRotationCost / totalMonthsNeeded : 0;

  // First month selection (for backward compatibility)
  const firstMonthServices = rotationSchedule[0]?.services || [];

  // Find deferred items (items not covered by any selected service)
  const allCoveredIds = new Set<string>();
  serviceAnalysis.forEach(s => s.itemsToWatch.forEach(item => allCoveredIds.add(item.id)));
  
  const deferredItems = watchlist
    .filter((item) => !allCoveredIds.has(item.id))
    .map((item) => ({
      item,
      reason: `Not available on any tracked streaming service.`,
    }));

  const coveragePercent = Math.round(
    (watchedItems.size / watchlist.length) * 100
  );

  const explanation = generateExplanation(firstMonthServices, deferredItems, budget, rotationSchedule);

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
  explanation += `You can watch all ${totalItems} items in ${schedule.length} month${schedule.length > 1 ? 's' : ''} by rotating services. `;
  
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
