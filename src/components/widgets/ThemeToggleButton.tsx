import { Expand } from "@theme-toggles/react";
import clsx from "clsx";

type ThemeToggleButtonProps = {
  className?: string;
};

declare global {
  interface Window {
    __mahiroSetThemeTrigger?: (element?: Element | null) => void;
    __mahiroAnimateThemeControl?: (element?: Element | null) => void;
    __mahiroToggleTheme?: (options?: { animate?: boolean }) => void;
  }
}

export default function ThemeToggleButton({ className = "" }: ThemeToggleButtonProps) {
  const label = "Toggle theme";

  return (
    <Expand
      duration={520}
      title={label}
      aria-label={label}
      data-theme-toggle=""
      className={clsx(
        "theme-toggles-button btn btn-circle btn-md bg-transparent backdrop-blur-md shadow-sm hover:scale-110 inline-flex items-center justify-center text-[1.2rem] leading-none gpu-layer [&_svg]:block [&_svg]:h-[1.35rem] [&_svg]:w-[1.35rem]",
        className,
      )}
      onClick={(event) => {
        window.__mahiroSetThemeTrigger?.(event.currentTarget);
        window.__mahiroAnimateThemeControl?.(event.currentTarget);
        window.__mahiroToggleTheme?.({ animate: true });
      }}
    />
  );
}
