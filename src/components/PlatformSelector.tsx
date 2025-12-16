import { STREAMING_SERVICES } from "@/data/services";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";

interface PlatformSelectorProps {
  itemId: string;
  currentProvider?: string;
  onSelect: (itemId: string, provider: string | null) => void;
}

export function PlatformSelector({ itemId, currentProvider, onSelect }: PlatformSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
      <Select
        value={currentProvider || ""}
        onValueChange={(value) => {
          if (value === "decide_later") {
            onSelect(itemId, null);
          } else {
            onSelect(itemId, value);
          }
        }}
      >
        <SelectTrigger className="h-7 text-xs w-[140px] bg-warning/10 border-warning/30">
          <SelectValue placeholder="Select platform" />
        </SelectTrigger>
        <SelectContent className="bg-card border-border z-50">
          {STREAMING_SERVICES.map((service) => (
            <SelectItem key={service.id} value={service.id}>
              <span className="flex items-center gap-2">
                <span>{service.logo}</span>
                <span>{service.name}</span>
              </span>
            </SelectItem>
          ))}
          <SelectItem value="decide_later">
            <span className="text-muted-foreground">Not available / Decide later</span>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
