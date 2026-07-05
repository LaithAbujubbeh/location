"use client";

import { useEffect } from "react";
import { useMap } from "react-leaflet";

export function LeafletMapSizeSync() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const invalidateSize = () => map.invalidateSize({ animate: false });

    invalidateSize();
    const frame = window.requestAnimationFrame(invalidateSize);
    const timeout = window.setTimeout(invalidateSize, 150);
    const observer = new ResizeObserver(invalidateSize);

    observer.observe(container);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
      observer.disconnect();
    };
  }, [map]);

  return null;
}
