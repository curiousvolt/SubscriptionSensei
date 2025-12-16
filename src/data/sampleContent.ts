export interface WatchlistItem {
  id: string;
  title: string;
  type: "movie" | "tv";
  priority: "high" | "medium" | "low";
  providers: string[];
  poster?: string;
  year?: number;
  episodeCount?: number;
}

export const SAMPLE_WATCHLIST: WatchlistItem[] = [
  {
    id: "1",
    title: "Stranger Things",
    type: "tv",
    priority: "high",
    providers: ["netflix"],
    year: 2016,
    episodeCount: 34,
  },
  {
    id: "2",
    title: "The Bear",
    type: "tv",
    priority: "high",
    providers: ["hulu"],
    year: 2022,
    episodeCount: 28,
  },
  {
    id: "3",
    title: "The Mandalorian",
    type: "tv",
    priority: "high",
    providers: ["disney"],
    year: 2019,
    episodeCount: 24,
  },
  {
    id: "4",
    title: "Severance",
    type: "tv",
    priority: "high",
    providers: ["apple"],
    year: 2022,
    episodeCount: 9,
  },
  {
    id: "5",
    title: "Succession",
    type: "tv",
    priority: "medium",
    providers: ["hbo"],
    year: 2018,
    episodeCount: 39,
  },
  {
    id: "6",
    title: "Only Murders in the Building",
    type: "tv",
    priority: "medium",
    providers: ["hulu"],
    year: 2021,
    episodeCount: 30,
  },
  {
    id: "7",
    title: "The Boys",
    type: "tv",
    priority: "high",
    providers: ["amazon"],
    year: 2019,
    episodeCount: 32,
  },
  {
    id: "8",
    title: "Yellowjackets",
    type: "tv",
    priority: "medium",
    providers: ["paramount"],
    year: 2021,
    episodeCount: 19,
  },
  {
    id: "9",
    title: "Oppenheimer",
    type: "movie",
    priority: "high",
    providers: ["peacock"],
    year: 2023,
  },
  {
    id: "10",
    title: "Glass Onion",
    type: "movie",
    priority: "medium",
    providers: ["netflix"],
    year: 2022,
  },
];

export const POPULAR_TITLES = [
  "Stranger Things",
  "The Bear",
  "Succession",
  "The Mandalorian",
  "Severance",
  "Only Murders in the Building",
  "The Boys",
  "House of the Dragon",
  "Wednesday",
  "The Last of Us",
  "Yellowjackets",
  "Ted Lasso",
  "Shogun",
  "Baby Reindeer",
  "Fallout",
];
