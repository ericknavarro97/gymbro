/**
 * Applies the saved theme preference before first paint (see Next guide
 * "Preventing flash before hydration"). Render once inside <head>.
 * Preference lives in localStorage["gb-theme"]: "dark" | "light" | "system".
 */
export const THEME_STORAGE_KEY = "gb-theme";

const script = `(function(){try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");var c=document.documentElement.classList;c.remove("dark","light");if(p==="dark"||p==="light")c.add(p);}catch(e){}})();`;

export function ThemeScript() {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}
