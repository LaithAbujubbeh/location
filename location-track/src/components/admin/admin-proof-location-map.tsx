"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useMemo } from "react";
import L, { type LatLngExpression } from "leaflet";
import {
  Circle,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
} from "react-leaflet";

import { LeafletMapSizeSync } from "@/components/admin/leaflet-map-size-sync";

const DEFAULT_ZOOM = 16;

type AdminProofLocationMapLabels = {
  ariaLabel: string;
};

type AdminProofLocationMapProps = {
  eventLatitude: number;
  eventLongitude: number;
  labels: AdminProofLocationMapLabels;
  proofAccuracyMeters: number;
  proofLatitude: number;
  proofLongitude: number;
  radiusMeters: number;
};

function MapBoundsSync({
  eventLatitude,
  eventLongitude,
  proofLatitude,
  proofLongitude,
}: {
  eventLatitude: number;
  eventLongitude: number;
  proofLatitude: number;
  proofLongitude: number;
}) {
  const map = useMap();

  useEffect(() => {
    const bounds = L.latLngBounds([
      [eventLatitude, eventLongitude],
      [proofLatitude, proofLongitude],
    ]);

    if (bounds.isValid()) {
      map.fitBounds(bounds.pad(0.35), {
        animate: false,
        maxZoom: DEFAULT_ZOOM,
      });
      map.invalidateSize({ animate: false });
    }
  }, [eventLatitude, eventLongitude, map, proofLatitude, proofLongitude]);

  return null;
}

export function AdminProofLocationMap({
  eventLatitude,
  eventLongitude,
  labels,
  proofAccuracyMeters,
  proofLatitude,
  proofLongitude,
  radiusMeters,
}: AdminProofLocationMapProps) {
  const eventCenter: LatLngExpression = [eventLatitude, eventLongitude];
  const proofCenter: LatLngExpression = [proofLatitude, proofLongitude];
  const safeRadiusMeters =
    Number.isFinite(radiusMeters) && radiusMeters > 0 ? radiusMeters : 0;
  const safeAccuracyMeters =
    Number.isFinite(proofAccuracyMeters) && proofAccuracyMeters > 0
      ? proofAccuracyMeters
      : 0;
  const eventIcon = useMemo(
    () =>
      L.divIcon({
        className: "location-picker-marker",
        html: '<span class="location-picker-marker-dot"></span>',
        iconAnchor: [11, 11],
        iconSize: [22, 22],
      }),
    [],
  );
  const proofIcon = useMemo(
    () =>
      L.divIcon({
        className: "attendance-proof-marker",
        html: '<span class="attendance-proof-marker-dot"></span>',
        iconAnchor: [11, 11],
        iconSize: [22, 22],
      }),
    [],
  );

  return (
    <div
      aria-label={labels.ariaLabel}
      className="location-picker-map overflow-hidden rounded-md border border-border bg-surface-subtle"
      role="img"
    >
      <MapContainer
        center={proofCenter}
        className="h-[240px] w-full sm:h-[280px]"
        dragging={false}
        scrollWheelZoom={false}
        zoom={DEFAULT_ZOOM}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LeafletMapSizeSync />
        <MapBoundsSync
          eventLatitude={eventLatitude}
          eventLongitude={eventLongitude}
          proofLatitude={proofLatitude}
          proofLongitude={proofLongitude}
        />
        <Marker icon={eventIcon} position={eventCenter} />
        <Marker icon={proofIcon} position={proofCenter} />
        {safeRadiusMeters ? (
          <Circle
            center={eventCenter}
            pathOptions={{
              color: "var(--primary)",
              fillColor: "var(--primary)",
              fillOpacity: 0.1,
              weight: 2,
            }}
            radius={safeRadiusMeters}
          />
        ) : null}
        {safeAccuracyMeters ? (
          <Circle
            center={proofCenter}
            pathOptions={{
              color: "var(--warning)",
              fillColor: "var(--warning)",
              fillOpacity: 0.12,
              weight: 2,
            }}
            radius={safeAccuracyMeters}
          />
        ) : null}
      </MapContainer>
    </div>
  );
}
