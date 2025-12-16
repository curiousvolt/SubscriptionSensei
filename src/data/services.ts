export interface StreamingService {
  id: string;
  name: string;
  price: number;
  color: string;
  logo: string;
}

export const STREAMING_SERVICES: StreamingService[] = [
  { id: "netflix", name: "Netflix", price: 15.49, color: "netflix", logo: "🔴" },
  { id: "disney", name: "Disney+", price: 13.99, color: "disney", logo: "🏰" },
  { id: "hulu", name: "Hulu", price: 17.99, color: "hulu", logo: "🟢" },
  { id: "amazon", name: "Prime Video", price: 14.99, color: "amazon", logo: "📦" },
  { id: "hbo", name: "Max", price: 15.99, color: "hbo", logo: "🟣" },
  { id: "apple", name: "Apple TV+", price: 9.99, color: "apple", logo: "🍎" },
  { id: "paramount", name: "Paramount+", price: 11.99, color: "paramount", logo: "⛰️" },
  { id: "peacock", name: "Peacock", price: 7.99, color: "peacock", logo: "🦚" },
];

export const SERVICE_PRICES: Record<string, number> = STREAMING_SERVICES.reduce(
  (acc, service) => ({ ...acc, [service.id]: service.price }),
  {}
);

export const TOTAL_ALL_SERVICES = STREAMING_SERVICES.reduce(
  (sum, service) => sum + service.price,
  0
);
