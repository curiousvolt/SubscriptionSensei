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

export interface OptimizationResult {
  subscribeThisMonth: OptimizedService[];
  deferredItems: { item: WatchlistItem; reason: string }[];
  totalCost: number;
  estimatedSavings: number;
  coveragePercent: number;
  explanation: string;
}

function getPriorityValue(priority: string): number {
  switch (priority) {
    case "high": return 3;
    case "medium": return 2;
    case "low": return 1;
    default: return 1;
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
    (sum, item) => sum + getPriorityValue(item.priority),
    0
  );
  
  return {
    density: totalValue / cost,
    coveredItems,
  };
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

  // Greedy selection within budget
  const selected: OptimizedService[] = [];
  let spent = 0;
  const coveredItemIds = new Set<string>();

  for (const service of serviceAnalysis) {
    if (spent + service.cost <= budget) {
      selected.push(service);
      spent += service.cost;
      service.itemsToWatch.forEach((item) => coveredItemIds.add(item.id));
    }
  }

  // Find deferred items
  const deferredItems = watchlist
    .filter((item) => !coveredItemIds.has(item.id))
    .map((item) => {
      const providers = item.providers
        .map((p) => STREAMING_SERVICES.find((s) => s.id === p)?.name)
        .filter(Boolean)
        .join(", ");
      return {
        item,
        reason: `Only available on ${providers}. Wait for more content to accumulate.`,
      };
    });

  const coveragePercent = Math.round(
    (coveredItemIds.size / watchlist.length) * 100
  );

  const explanation = generateExplanation(selected, deferredItems, budget, spent);

  return {
    subscribeThisMonth: selected,
    deferredItems,
    totalCost: spent,
    estimatedSavings: allServicesCost - spent,
    coveragePercent,
    explanation,
  };
}

function generateExplanation(
  selected: OptimizedService[],
  deferred: { item: WatchlistItem; reason: string }[],
  budget: number,
  spent: number
): string {
  const serviceNames = selected.map((s) => s.serviceName).join(", ");
  const totalItems = selected.reduce((sum, s) => sum + s.itemsToWatch.length, 0);
  
  let explanation = `Based on your watchlist and $${budget} budget, I recommend subscribing to ${serviceNames}. `;
  explanation += `This covers ${totalItems} items from your watchlist. `;
  
  if (selected.length > 0) {
    const topService = selected[0];
    explanation += `${topService.serviceName} offers the best value density at ${topService.valueDensity.toFixed(2)} value per dollar. `;
  }
  
  if (deferred.length > 0) {
    explanation += `${deferred.length} items are deferred as they don't fit within your budget or provide lower value density. `;
  }
  
  explanation += `You'll save $${(STREAMING_SERVICES.reduce((sum, s) => sum + s.price, 0) - spent).toFixed(2)} compared to subscribing to all services.`;
  
  return explanation;
}
