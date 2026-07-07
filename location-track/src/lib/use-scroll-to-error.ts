"use client";

import { type RefObject, useEffect, useRef } from "react";

export function useScrollToError<T extends HTMLElement>(
  ref: RefObject<T | null>,
  errorKey: string | null | undefined,
) {
  const lastErrorKey = useRef<string | null>(null);

  useEffect(() => {
    if (!errorKey) {
      lastErrorKey.current = null;
      return;
    }

    if (lastErrorKey.current === errorKey) {
      return;
    }

    lastErrorKey.current = errorKey;
    const element = ref.current;

    if (!element) {
      return;
    }

    window.requestAnimationFrame(() => {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.focus({ preventScroll: true });
    });
  }, [errorKey, ref]);
}
