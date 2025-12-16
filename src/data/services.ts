export interface StreamingService {
  id: string;
  name: string;
  price: number;
  color: string;
  logo: string;
}

export const STREAMING_SERVICES: StreamingService[] = [
  { id: "netflix", name: "Netflix", price: 7.99, color: "netflix", logo: "🔴" },
  { id: "disney", name: "Disney+", price: 9.99, color: "disney", logo: "🏰" },
  { id: "hulu", name: "Hulu", price: 9.99, color: "hulu", logo: "🟢" },
  { id: "amazon", name: "Prime Video", price: 8.99, color: "amazon", logo: "📦" },
  { id: "hbo", name: "Max", price: 10.99, color: "hbo", logo: "🟣" },
  { id: "apple", name: "Apple TV+", price: 12.99, color: "apple", logo: "🍎" },
  { id: "paramount", name: "Paramount+", price: 7.99, color: "paramount", logo: "⛰️" },
  { id: "peacock", name: "Peacock", price: 8.99, color: "peacock", logo: "🦚" },
];

// TMDB Provider ID to our service ID mapping
export const PROVIDER_MAP: Record<number, string> = {
  8: "netflix",      // Netflix
  337: "disney",     // Disney+
  15: "hulu",        // Hulu
  9: "amazon",       // Amazon Prime Video
  119: "amazon",     // Amazon Prime Video (alternate)
  1899: "hbo",       // Max
  384: "hbo",        // HBO Max (legacy)
  350: "apple",      // Apple TV+
  531: "paramount",  // Paramount+
  386: "peacock",    // Peacock
};

export const SERVICE_PRICES: Record<string, number> = STREAMING_SERVICES.reduce(
  (acc, service) => ({ ...acc, [service.id]: service.price }),
  {}
);

export const TOTAL_ALL_SERVICES = STREAMING_SERVICES.reduce(
  (sum, service) => sum + service.price,
  0
);
