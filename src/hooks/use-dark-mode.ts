import { useEffect, useState } from "react";

/**
 * Reactively tracks whether the `.dark` class is present on the <html> element.
 * Updates immediately when the theme toggle adds/removes the class.
 */
export function useDarkMode(): boolean {
  const [isDark, setIsDark] = useState<boolean>(() =>
    typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : true,
  );

  useEffect(() => {
    const html = document.documentElement;

    const observer = new MutationObserver(() => {
      setIsDark(html.classList.contains("dark"));
    });

    observer.observe(html, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // Sync once on mount in case the class changed before observer attached
    setIsDark(html.classList.contains("dark"));

    return () => observer.disconnect();
  }, []);

  return isDark;
}
