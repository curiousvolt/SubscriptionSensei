import { useState } from "react";
import { Plus, X, Trash2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WatchlistItem, SAMPLE_WATCHLIST, POPULAR_TITLES } from "@/data/sampleContent";
import { STREAMING_SERVICES } from "@/data/services";
import { cn } from "@/lib/utils";

interface WatchlistInputProps {
  watchlist: WatchlistItem[];
  setWatchlist: (items: WatchlistItem[]) => void;
}

export function WatchlistInput({ watchlist, setWatchlist }: WatchlistInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filteredSuggestions = POPULAR_TITLES.filter(
    (title) =>
      title.toLowerCase().includes(inputValue.toLowerCase()) &&
      !watchlist.some((item) => item.title.toLowerCase() === title.toLowerCase())
  ).slice(0, 5);

  const addTitle = (title: string) => {
    const sampleItem = SAMPLE_WATCHLIST.find(
      (item) => item.title.toLowerCase() === title.toLowerCase()
    );

    if (sampleItem && !watchlist.some((item) => item.id === sampleItem.id)) {
      setWatchlist([...watchlist, sampleItem]);
    } else if (!sampleItem) {
      // Create a new item with random provider for demo
      const randomProviders = STREAMING_SERVICES.slice(0, Math.floor(Math.random() * 2) + 1).map(
        (s) => s.id
      );
      const newItem: WatchlistItem = {
        id: Date.now().toString(),
        title,
        type: "tv",
        priority: "medium",
        providers: randomProviders,
        year: 2024,
      };
      setWatchlist([...watchlist, newItem]);
    }

    setInputValue("");
    setShowSuggestions(false);
  };

  const removeItem = (id: string) => {
    setWatchlist(watchlist.filter((item) => item.id !== id));
  };

  const updatePriority = (id: string, priority: "high" | "medium" | "low") => {
    setWatchlist(
      watchlist.map((item) => (item.id === id ? { ...item, priority } : item))
    );
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
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={loadSampleData}>
            <Wand2 className="w-4 h-4 mr-1" />
            Load Sample
          </Button>
          {watchlist.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAll}>
              <Trash2 className="w-4 h-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setShowSuggestions(e.target.value.length > 0);
              }}
              onFocus={() => setShowSuggestions(inputValue.length > 0)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              placeholder="Add a show or movie..."
              className="w-full h-10 px-4 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              onKeyDown={(e) => {
                if (e.key === "Enter" && inputValue.trim()) {
                  addTitle(inputValue.trim());
                }
              }}
            />
            {showSuggestions && filteredSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg overflow-hidden shadow-xl z-10">
                {filteredSuggestions.map((title) => (
                  <button
                    key={title}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-secondary transition-colors"
                    onClick={() => addTitle(title)}
                  >
                    {title}
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button
            onClick={() => inputValue.trim() && addTitle(inputValue.trim())}
            disabled={!inputValue.trim()}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Watchlist Items */}
      {watchlist.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>No items in your watchlist yet.</p>
          <p className="text-sm mt-1">Add shows or click "Load Sample" to get started.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
          {watchlist.map((item, index) => (
            <div
              key={item.id}
              className="glass rounded-lg p-3 flex items-center gap-3 animate-slide-up"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{item.title}</span>
                  <span className="text-xs text-muted-foreground">
                    ({item.year})
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">
                    {item.providers.map(getServiceName).join(", ")}
                  </span>
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
        {watchlist.length} items in watchlist
      </p>
    </div>
  );
}
