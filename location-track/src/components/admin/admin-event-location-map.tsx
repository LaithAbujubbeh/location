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

const DEFAULT_ZOOM = 15;

type AdminEventLocationMapProps = {
  latitude: number;
  longitude: number;
  radiusMeters: number;
};

function MapCenterSync({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  const map = useMap();

  useEffect(() => {
    map.setView([latitude, longitude], Math.max(map.getZoom(), DEFAULT_ZOOM));
  }, [latitude, longitude, map]);

  return null;
}

export function AdminEventLocationMap({
  latitude,
  longitude,
  radiusMeters,
}: AdminEventLocationMapProps) {
  const center: LatLngExpression = [latitude, longitude];
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

  return (
    <div className="location-picker-map overflow-hidden rounded-md border border-border bg-surface-subtle">
      <MapContainer
        center={center}
        className="h-[300px] w-full sm:h-[340px]"
        dragging={false}
        scrollWheelZoom={false}
        zoom={DEFAULT_ZOOM}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapCenterSync latitude={latitude} longitude={longitude} />
        <Marker icon={markerIcon} position={center} />
        {safeRadiusMeters ? (
          <Circle
            center={center}
            pathOptions={{
              color: "var(--primary)",
              fillColor: "var(--primary)",
              fillOpacity: 0.14,
              weight: 2,
            }}
            radius={safeRadiusMeters}
          />
        ) : null}
      </MapContainer>
    </div>
  );
}
