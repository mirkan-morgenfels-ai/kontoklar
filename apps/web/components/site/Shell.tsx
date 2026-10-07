import type { ReactNode } from "react";
import { cx } from "./cx";

export const SHELL_CLASS = "mx-auto w-full max-w-[76rem] px-5 sm:px-8 lg:px-10";

export function Shell({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx(SHELL_CLASS, className)}>{children}</div>;
}
