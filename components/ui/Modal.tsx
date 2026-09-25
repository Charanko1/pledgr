"use client";
import { useEffect, useRef, type ReactNode } from "react";

/** Native dialog supplies focus trapping, Escape handling and focus restoration. */
export default function Modal({ children, title, onClose }: { children: ReactNode; title: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    dialog?.showModal(); document.body.style.overflow = "hidden";
    return () => { dialog?.close(); document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <dialog ref={ref} aria-label={title} className="pledgr-dialog" onCancel={(event) => { event.preventDefault(); onClose(); }}>{children}</dialog>;
}
