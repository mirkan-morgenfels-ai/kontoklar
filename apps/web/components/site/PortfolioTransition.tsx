"use client";

import { type CSSProperties, useEffect, useRef, useState } from "react";
import { PORTFOLIO_TRANSITION_MS, type TransitionDestination, transitionDestination } from "./transition";

const RESET_MS = 8000;

interface Target extends TransitionDestination {
  x: number;
  y: number;
}

export function PortfolioTransition() {
  const [target, setTarget] = useState<Target | null>(null);
  const passThrough = useRef(false);

  useEffect(() => {
    let leaveTimer = 0;
    let resetTimer = 0;

    function clearTimers() {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(resetTimer);
    }

    function onClick(event: MouseEvent) {
      if (passThrough.current || event.defaultPrevented) return;
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || (link.target && link.target !== "_self")) return;
      const destination = transitionDestination(link.href);
      if (!destination || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      event.preventDefault();
      const box = link.getBoundingClientRect();
      setTarget({ ...destination, x: box.left + box.width / 2, y: box.top + box.height / 2 });
      clearTimers();
      leaveTimer = window.setTimeout(() => {
        passThrough.current = true;
        link.click();
        passThrough.current = false;
      }, PORTFOLIO_TRANSITION_MS);
      resetTimer = window.setTimeout(() => setTarget(null), RESET_MS);
    }

    function onPageShow(event: PageTransitionEvent) {
      if (!event.persisted) return;
      clearTimers();
      setTarget(null);
    }

    document.addEventListener("click", onClick);
    window.addEventListener("pageshow", onPageShow);
    document.documentElement.dataset.transitionReady = "";
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener("pageshow", onPageShow);
      delete document.documentElement.dataset.transitionReady;
      clearTimers();
    };
  }, []);

  if (!target) return null;
  return (
    <div
      aria-hidden="true"
      data-portfolio-transition={target.host}
      className="portfolio-transition surface-navy"
      style={{ "--x": `${Math.round(target.x)}px`, "--y": `${Math.round(target.y)}px` } as CSSProperties}
    >
      <div className="relative flex flex-col items-center px-6 text-center">
        <p className="portfolio-transition-eyebrow eyebrow">{target.eyebrow}</p>
        <p className="portfolio-transition-name display mt-4 text-[clamp(2.75rem,9vw,5rem)] leading-none text-ivory">
          {target.title}
          {target.accent ? (
            <>
              {" "}
              <em className="text-gold-light italic">{target.accent}</em>
            </>
          ) : null}
        </p>
        <span className="portfolio-transition-line mt-7 block h-px w-56 bg-linear-to-r from-gold/0 via-gold to-gold/0" />
        <p className="portfolio-transition-host mt-5 text-sm tracking-[0.04em] text-navy-300">{target.host}</p>
      </div>
    </div>
  );
}
