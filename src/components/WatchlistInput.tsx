import { useState, useEffect, useCallback } from "react";
import { Plus, X, Trash2, Search, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WatchlistItem, SAMPLE_WATCHLIST } from "@/data/sampleContent";
import { STREAMING_SERVICES, PROVIDER_MAP } from "@/data/services";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PlatformSelector } from "./PlatformSelector";

interface WatchlistInputProps {
  watchlist: WatchlistItem[];
  setWatchlist: (items: WatchlistItem[]) => void;
}

interface TMDBResult {
  id: string;
  title: string;
  type: "movie" | "tv";
  year: string;
  poster: string | null;
  overview: string;
  providers: Array<{
    id: number;
    name: string;
    logo: string;
  }>;
  episodeCount?: number;
  seasonCount?: number;
  totalWatchTimeMinutes?: number;
}

export function WatchlistInput({ watchlist, setWatchlist }: WatchlistInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchResults, setSearchResults] = useState<TMDBResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // Debounced TMDB search
  const searchTMDB = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("tmdb-search", {
        body: { query },
      });

      if (error) {
        console.error("TMDB search error:", error);
        toast.error("Search failed. Please try again.");
        return;
      }

      setSearchResults(data.results || []);
    } catch (err) {
      console.error("Search error:", err);
      toast.error("Search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }

    if (inputValue.length >= 2) {
      const timeout = setTimeout(() => {
        searchTMDB(inputValue);
      }, 300);
      setSearchTimeout(timeout);
    } else {
      setSearchResults([]);
    }

    return () => {
      if (searchTimeout) clearTimeout(searchTimeout);
    };
  }, [inputValue, searchTMDB]);

  const mapProviderToService = (providers: TMDBResult["providers"]): string[] => {
    const mappedProviders: string[] = [];
    
    for (const provider of providers) {
      const serviceId = PROVIDER_MAP[provider.id];
      if (serviceId && !mappedProviders.includes(serviceId)) {
        mappedProviders.push(serviceId);
      }
    }
    
    return mappedProviders;
  };

  const addFromTMDB = (result: TMDBResult) => {
    if (watchlist.some((item) => item.id === result.id)) {
      toast.info("This title is already in your watchlist");
      return;
    }

    const mappedProviders = mapProviderToService(result.providers);

    const newItem: WatchlistItem = {
      id: result.id,
      title: result.title,
      type: result.type,
      priority: "medium",
      providers: mappedProviders,
      poster: result.poster || undefined,
      year: parseInt(result.year) || undefined,
      episodeCount: result.episodeCount,
      seasonCount: result.seasonCount,
      totalWatchTimeMinutes: result.totalWatchTimeMinutes,
    };

    setWatchlist([...watchlist, newItem]);
    setInputValue("");
    setShowSuggestions(false);
    setSearchResults([]);
    
    if (mappedProviders.length === 0) {
      toast.info(`${result.title} added. No streaming providers found in the US.`);
    } else {
      toast.success(`${result.title} added to watchlist`);
    }
  };

  const removeItem = (id: string) => {
    setWatchlist(watchlist.filter((item) => item.id !== id));
  };

  const updatePriority = (id: string, priority: "high" | "medium" | "low") => {
    setWatchlist(
      watchlist.map((item) => (item.id === id ? { ...item, priority } : item))
    );
  };

  const updateUserSelectedProvider = (id: string, provider: string | null) => {
    setWatchlist(
      watchlist.map((item) => {
        if (item.id !== id) return item;
        if (provider === null) {
          // User chose "decide later"
          return { ...item, userSelectedProvider: undefined, pendingPlatformSelection: true };
        }
        return { ...item, userSelectedProvider: provider, pendingPlatformSelection: false };
      })
    );
  };

  // Check if item needs platform selection (no TMDB providers)
  const needsPlatformSelection = (item: WatchlistItem) => {
    return item.providers.length === 0 && !item.userSelectedProvider && !item.pendingPlatformSelection;
  };

  // Get effective providers for display (user-selected or TMDB)
  const getEffectiveProviders = (item: WatchlistItem): string[] => {
    if (item.userSelectedProvider) return [item.userSelectedProvider];
    return item.providers;
  };

  const loadSampleData = () => {
    setWatchlist(SAMPLE_WATCHLIST);
  };

  const clearAll = () => {
    setWatchlist([]);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-destructive/20 text-destructive border-destructive/30";
      case "medium":
        return "bg-warning/20 text-warning border-warning/30";
      case "low":
        return "bg-muted text-muted-foreground border-border";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  const getServiceName = (id: string) =>
    STREAMING_SERVICES.find((s) => s.id === id)?.name || id;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold">Your Watchlist</h2>
        {watchlist.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAll}>
            <Trash2 className="w-4 h-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Search Input */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 300)}
            placeholder="Search movies and TV shows..."
            className="w-full h-11 pl-10 pr-10 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          />
          {isSearching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground animate-spin" />
          )}
        </div>

        {/* Search Results Dropdown */}
        {showSuggestions && (inputValue.length >= 2) && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg overflow-hidden shadow-xl z-20 max-h-[400px] overflow-y-auto">
            {isSearching ? (
              <div className="p-4 text-center text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                Searching...
              </div>
            ) : searchResults.length > 0 ? (
              searchResults.map((result) => (
                <button
                  key={result.id}
                  className="w-full px-3 py-3 text-left hover:bg-secondary transition-colors flex gap-3 items-start border-b border-border/50 last:border-0"
                  onClick={() => addFromTMDB(result)}
                >
                  {result.poster ? (
                    <img
                      src={result.poster}
                      alt={result.title}
                      className="w-12 h-16 object-cover rounded"
                    />
                  ) : (
                    <div className="w-12 h-16 bg-muted rounded flex items-center justify-center text-xs text-muted-foreground">
                      No img
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{result.title}</span>
                      {result.year && (
                        <span className="text-xs text-muted-foreground">
                          ({result.year})
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-primary capitalize">
                      {result.type === "tv" ? "TV Series" : "Movie"}
                    </span>
                    {result.providers.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {result.providers.slice(0, 4).map((p) => (
                          <img
                            key={p.id}
                            src={p.logo}
                            alt={p.name}
                            title={p.name}
                            className="w-5 h-5 rounded"
                          />
                        ))}
                        {result.providers.length > 4 && (
                          <span className="text-xs text-muted-foreground">
                            +{result.providers.length - 4}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <Plus className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-1" />
                </button>
              ))
            ) : (
              <div className="p-4 text-center text-muted-foreground text-sm">
                No results found for "{inputValue}"
              </div>
            )}
          </div>
        )}
      </div>

      {/* Watchlist Items */}
      {watchlist.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No items in your watchlist yet.</p>
          <p className="text-sm mt-1">Search for movies/shows or click "Load Sample" to get started.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
          {watchlist.map((item, index) => (
            <div
              key={item.id}
              className="glass rounded-lg p-3 flex items-center gap-3 animate-slide-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {item.poster && (
                <img
                  src={item.poster}
                  alt={item.title}
                  className="w-10 h-14 object-cover rounded"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{item.title}</span>
                  {item.year && (
                    <span className="text-xs text-muted-foreground">
                      ({item.year})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {/* Show platform selector if no TMDB providers */}
                  {item.providers.length === 0 && !item.userSelectedProvider ? (
                    item.pendingPlatformSelection ? (
                      <span className="flex items-center gap-1 text-xs text-warning italic">
                        Pending selection
                        <button 
                          onClick={() => setWatchlist(watchlist.map(i => 
                            i.id === item.id ? { ...i, pendingPlatformSelection: false } : i
                          ))}
                          className="text-muted-foreground hover:text-primary ml-1"
                          title="Select platform"
                        >
                          (select)
                        </button>
                      </span>
                    ) : (
                      <PlatformSelector
                        itemId={item.id}
                        currentProvider={item.userSelectedProvider}
                        onSelect={updateUserSelectedProvider}
                      />
                    )
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      {item.userSelectedProvider ? (
                        <span className="flex items-center gap-1">
                          <span className="text-primary">{getServiceName(item.userSelectedProvider)}</span>
                          <button 
                            onClick={() => setWatchlist(watchlist.map(i => 
                              i.id === item.id ? { ...i, userSelectedProvider: undefined, pendingPlatformSelection: false } : i
                            ))}
                            className="text-muted-foreground hover:text-destructive ml-1"
                            title="Change platform"
                          >
                            (change)
                          </button>
                        </span>
                      ) : (
                        getEffectiveProviders(item).map(getServiceName).join(", ")
                      )}
                    </span>
                  )}
                </div>
              </div>

              {/* Priority Selector */}
              <div className="flex gap-1">
                {(["high", "medium", "low"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => updatePriority(item.id, p)}
                    className={cn(
                      "px-2 py-0.5 text-xs rounded border capitalize transition-all",
                      item.priority === p
                        ? getPriorityColor(p)
                        : "bg-transparent text-muted-foreground border-transparent hover:bg-secondary"
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>

              <button
                onClick={() => removeItem(item.id)}
                className="p-1 text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        {watchlist.length} items in watchlist • Powered by TMDB
      </p>
    </div>
  );
}
