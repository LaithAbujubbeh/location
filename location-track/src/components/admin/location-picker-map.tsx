"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useMemo, useState } from "react";
import L, { type LatLngExpression } from "leaflet";
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";

import { LeafletMapSizeSync } from "@/components/admin/leaflet-map-size-sync";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const AMMAN_CENTER: LatLngExpression = [31.9539, 35.9106];
const DEFAULT_ZOOM = 13;
const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";

type LocationPickerMapLabels = {
  currentLocationUnavailable: string;
  currentLocationUnsupported: string;
  defaultHint: string;
  noSearchResults: string;
  search: string;
  searchAttribution: string;
  searchError: string;
  searchPlaceholder: string;
  searchRequired: string;
  searchResultsLabel: string;
  searching: string;
  selectedLocation: string;
  useCurrentLocation: string;
};

type SearchResult = {
  display_name: string;
  lat: string;
  lon: string;
  place_id: number;
};

type LocationPickerMapProps = {
  labels: LocationPickerMapLabels;
  latitude: number | null;
  longitude: number | null;
  onLocationChange: (latitude: number, longitude: number) => void;
  radiusMeters: number;
};

function hasSelectedLocation(
  latitude: number | null,
  longitude: number | null,
) {
  return latitude !== null && longitude !== null;
}

function MapClickHandler({
  onLocationChange,
}: {
  onLocationChange: (latitude: number, longitude: number) => void;
}) {
  useMapEvents({
    click(event) {
      onLocationChange(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

function MapCenterSync({
  latitude,
  longitude,
}: {
  latitude: number | null;
  longitude: number | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (latitude !== null && longitude !== null) {
      map.setView([latitude, longitude], Math.max(map.getZoom(), DEFAULT_ZOOM));
      map.invalidateSize({ animate: false });
    }
  }, [latitude, longitude, map]);

  return null;
}

export function LocationPickerMap({
  labels,
  latitude,
  longitude,
  onLocationChange,
  radiusMeters,
}: LocationPickerMapProps) {
  const [locationError, setLocationError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const selectedCenter = hasSelectedLocation(latitude, longitude)
    ? ([latitude, longitude] as LatLngExpression)
    : null;
  const mapCenter = selectedCenter ?? AMMAN_CENTER;
  const safeRadiusMeters =
    Number.isFinite(radiusMeters) && radiusMeters > 0 ? radiusMeters : 0;
  const markerIcon = useMemo(
    () =>
      L.divIcon({
        className: "location-picker-marker",
        html: '<span class="location-picker-marker-dot"></span>',
        iconAnchor: [11, 11],
        iconSize: [22, 22],
      }),
    [],
  );

  async function searchLocations() {
    const query = searchQuery.trim();
    setSearchError(null);

    if (!query) {
      setSearchResults([]);
      setSearchError(labels.searchRequired);
      return;
    }

    setIsSearching(true);

    try {
      const searchParams = new URLSearchParams({
        format: "jsonv2",
        limit: "5",
        q: query,
      });
      const response = await fetch(
        `${NOMINATIM_SEARCH_URL}?${searchParams.toString()}`,
        {
          headers: {
            "Accept-Language": document.documentElement.lang || "en",
          },
        },
      );

      if (!response.ok) {
        throw new Error("Location search failed.");
      }

      const results = (await response.json()) as SearchResult[];
      setSearchResults(results);

      if (!results.length) {
        setSearchError(labels.noSearchResults);
      }
    } catch {
      setSearchResults([]);
      setSearchError(labels.searchError);
    } finally {
      setIsSearching(false);
    }
  }

  function selectSearchResult(result: SearchResult) {
    const nextLatitude = Number(result.lat);
    const nextLongitude = Number(result.lon);

    if (!Number.isFinite(nextLatitude) || !Number.isFinite(nextLongitude)) {
      setSearchError(labels.searchError);
      return;
    }

    setSearchError(null);
    setSearchResults([]);
    setSearchQuery(result.display_name);
    onLocationChange(nextLatitude, nextLongitude);
  }

  function useCurrentLocation() {
    setLocationError(null);

    if (!navigator.geolocation) {
      setLocationError(labels.currentLocationUnsupported);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        onLocationChange(position.coords.latitude, position.coords.longitude);
      },
      () => {
        setLocationError(labels.currentLocationUnavailable);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10_000,
      },
    );
  }

  return (
    <div className="grid min-w-0 gap-3">
      <div className="grid min-w-0 gap-2">
        <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
          <Input
            autoComplete="off"
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void searchLocations();
              }
            }}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={labels.searchPlaceholder}
            value={searchQuery}
          />
          <Button
            className="w-full sm:w-auto"
            disabled={isSearching}
            onClick={() => void searchLocations()}
            type="button"
          >
            {isSearching ? labels.searching : labels.search}
          </Button>
        </div>
        <p className="text-xs leading-5 text-text-muted">
          {labels.searchAttribution}
        </p>
        {searchError ? (
          <p className="text-sm leading-6 text-danger">{searchError}</p>
        ) : null}
        {searchResults.length ? (
          <div
            aria-label={labels.searchResultsLabel}
            className="grid max-h-56 gap-1 overflow-y-auto rounded-md border border-border bg-surface p-1"
          >
            {searchResults.map((result) => (
              <button
                className="min-w-0 rounded-md px-3 py-2 text-start text-sm leading-6 text-foreground transition-colors hover:bg-surface-subtle focus-visible:bg-surface-subtle"
                key={result.place_id}
                onClick={() => selectSearchResult(result)}
                type="button"
              >
                <span className="block truncate">{result.display_name}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="location-picker-map overflow-hidden rounded-md border border-border bg-surface-subtle">
        <MapContainer
          center={mapCenter}
          className="h-[300px] w-full sm:h-[360px] lg:h-[420px]"
          scrollWheelZoom
          zoom={DEFAULT_ZOOM}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <LeafletMapSizeSync />
          <MapClickHandler onLocationChange={onLocationChange} />
          <MapCenterSync latitude={latitude} longitude={longitude} />
          {selectedCenter ? (
            <>
              <Marker icon={markerIcon} position={selectedCenter} />
              {safeRadiusMeters ? (
                <Circle
                  center={selectedCenter}
                  pathOptions={{
                    color: "var(--primary)",
                    fillColor: "var(--primary)",
                    fillOpacity: 0.14,
                    weight: 2,
                  }}
                  radius={safeRadiusMeters}
                />
              ) : null}
            </>
          ) : null}
        </MapContainer>
      </div>
      <div className="grid gap-2 sm:flex sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-text-muted">
          {selectedCenter ? labels.selectedLocation : labels.defaultHint}
        </p>
        <Button
          className="w-full sm:w-auto"
          onClick={useCurrentLocation}
          type="button"
        >
          {labels.useCurrentLocation}
        </Button>
      </div>
      {locationError ? (
        <p className="text-sm leading-6 text-danger">{locationError}</p>
      ) : null}
    </div>
  );
}
