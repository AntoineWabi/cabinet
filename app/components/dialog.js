"use client";
import { useLayoutEffect, useRef } from "react";
export function useDialog() {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    const viewport = window.visualViewport;
    const measure = () => {
      dialog.style.setProperty(
        "--visual-height",
        `${viewport?.height || window.innerHeight}px`,
      );
      dialog.style.setProperty("--visual-top", `${viewport?.offsetTop || 0}px`);
    };
    measure();
    viewport?.addEventListener("resize", measure);
    viewport?.addEventListener("scroll", measure);
    return () => {
      viewport?.removeEventListener("resize", measure);
      viewport?.removeEventListener("scroll", measure);
      dialog.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return ref;
}
export function isBackdrop(event) {
  if (event.target !== event.currentTarget) return false;
  const rect = event.currentTarget.getBoundingClientRect();
  return (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  );
}
