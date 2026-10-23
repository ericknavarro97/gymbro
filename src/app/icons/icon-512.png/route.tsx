import { ImageResponse } from "next/og";
import { AppIconArt } from "@/lib/app-icon";

/** Manifest icon (public path under /icons/*, prerendered at build). */
export function GET() {
  return new ImageResponse(<AppIconArt size={512} inset={0} />, { width: 512, height: 512 });
}
