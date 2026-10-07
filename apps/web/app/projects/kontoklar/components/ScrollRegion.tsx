"use client";

import { useEffect, useState, type ReactNode } from "react";

function useOverflow() {
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [overflowing, setOverflowing] = useState(false);
  useEffect(() => {
    if (!element) {
      setOverflowing(false);
      return;
    }
    const update = () => setOverflowing(element.scrollWidth > element.clientWidth + 1);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => observer.disconnect();
  }, [element]);
  return { ref: setElement, overflowing };
}

export function ScrollRegion({ label, hintTestId, testId, children }: { label: string; hintTestId?: string; testId?: string; children: ReactNode }) {
  const { ref, overflowing } = useOverflow();
  return (
    <>
      {overflowing && (
        <p className="mb-2 text-xs text-stone sm:hidden" data-testid={hintTestId}>
          Tabelle seitlich wischen
        </p>
      )}
      <div
        ref={ref}
        role="region"
        tabIndex={0}
        aria-label={label}
        className="scroll-shadow relative overflow-x-auto"
        data-overflowing={overflowing ? "true" : "false"}
        data-testid={testId}
      >
        {children}
      </div>
    </>
  );
}
