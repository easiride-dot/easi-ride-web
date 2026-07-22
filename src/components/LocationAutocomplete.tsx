import React, { useState, useEffect, useRef } from "react";
import { MapPin, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { parseApiJson } from "@/lib/parseApiResponse";

export interface LocationSuggestion {
  address: string;
  lat: number;
  lon: number;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSelect: (location: LocationSuggestion) => void;
  placeholder?: string;
  id?: string;
}

export function LocationAutocomplete({ value, onChange, onSelect, placeholder = "Search location...", id }: Props) {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    let cancelled = false;

    const fetchSuggestions = async () => {
      if (!value || value.length < 3) {
        setSuggestions([]);
        return;
      }

      // If we just selected an item, don't search again immediately
      if (!showDropdown) return;

      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const res = await fetch(`/api/search-locations?query=${encodeURIComponent(value)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        if (cancelled) return;

        const { ok, data, error } = await parseApiJson<{ suggestions?: LocationSuggestion[]; error?: string }>(res);

        if (!ok) {
          if (error) console.error("Location search failed:", error);
          setSuggestions([]);
          return;
        }
        if (data?.suggestions) {
          setSuggestions(data.suggestions);
        }
      } catch (err) {
        if (!cancelled) console.error("Failed to fetch suggestions", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const timer = setTimeout(() => {
      fetchSuggestions();
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, showDropdown]);

  const handleSelect = (s: LocationSuggestion) => {
    onChange(s.address);
    onSelect(s);
    setShowDropdown(false);
  };

  return (
    <div className="relative flex-1" ref={wrapperRef}>
      <div className="relative flex items-center">
        <Input
          id={id}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setShowDropdown(true);
          }}
          placeholder={placeholder}
          className="h-8 border-0 bg-transparent px-0 text-base focus-visible:ring-0 w-full"
          autoComplete="off"
        />
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground absolute right-0" />}
      </div>
      
      {showDropdown && suggestions.length > 0 && (
        <div className="absolute z-50 mt-2 w-full left-0 rounded-xl border border-hairline bg-background/95 backdrop-blur-xl shadow-xl">
          <ul className="max-h-[250px] overflow-y-auto overscroll-contain touch-pan-y py-2 rounded-xl">
            {suggestions.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => handleSelect(s)}
                  className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-secondary/50 transition-colors"
                >
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <span className="text-sm line-clamp-2 leading-snug">{s.address}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
