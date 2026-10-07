import { cx } from "./cx";

export function HeroBackdrop({ rule = true, className }: { rule?: boolean; className?: string }) {
  return (
    <>
      <div
        aria-hidden="true"
        className={cx(
          "pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(70%_90%_at_92%_-10%,rgb(62_106_158/0.22),transparent_62%),radial-gradient(40%_50%_at_8%_110%,rgb(62_106_158/0.10),transparent_70%)]",
          className,
        )}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.35] [background-image:linear-gradient(rgb(143_155_176/0.07)_1px,transparent_1px),linear-gradient(90deg,rgb(143_155_176/0.07)_1px,transparent_1px)] [background-size:72px_72px] [mask-image:radial-gradient(80%_70%_at_75%_30%,#000,transparent_75%)]"
      />
      {rule ? (
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-gold/0 via-gold/45 to-gold/0" />
      ) : null}
    </>
  );
}
