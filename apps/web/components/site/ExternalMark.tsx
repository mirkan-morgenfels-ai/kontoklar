export function ExternalMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false" className={className ?? "ml-1 inline-block h-[0.7em] w-[0.7em] align-baseline"}>
      <path d="M3.5 2.5h6v6M9.5 2.5 2.5 9.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 12" aria-hidden="true" focusable="false" className={className ?? "ml-2 inline-block h-[0.75em] w-[1em]"}>
      <path d="M1 6h13M9.5 1.5 14 6l-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
