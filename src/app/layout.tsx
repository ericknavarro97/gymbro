import type { Metadata, Viewport } from "next";
import { Archivo, Big_Shoulders } from "next/font/google";
import { ThemeScript } from "@/components/theme-script";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

/** Display: condensed industrial signage face (headings, big numbers). */
const display = Big_Shoulders({
  subsets: ["latin"],
  variable: "--font-big-shoulders",
  axes: ["opsz"],
  display: "swap",
  // next/font has no metrics for this family; skip the (failing) fallback generation.
  adjustFontFallback: false,
});

/** Body/UI: Archivo with width axis (labels use font-stretch). */
const sans = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  axes: ["wdth"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "GymBros", template: "%s · GymBros" },
  description: "Sigue el Pure Bodybuilding Program – Full Body y registra tus cargas semana a semana.",
  applicationName: "GymBros",
  appleWebApp: { capable: true, title: "GymBros", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "dark light",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0c0d0b" },
    { media: "(prefers-color-scheme: light)", color: "#f3f0e8" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-MX" className={`${display.variable} ${sans.variable}`} suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body>
        <ToastProvider>
          <div className="relative z-[1] flex min-h-dvh flex-col">{children}</div>
        </ToastProvider>
      </body>
    </html>
  );
}
