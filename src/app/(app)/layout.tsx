import { Suspense } from "react";
import { TabBar, TabBarView } from "@/components/layout/tab-bar";

/**
 * Signed-in app shell: centered mobile column (the page's only <main> landmark;
 * pages and boundaries inside must not render their own) + fixed bottom tab bar (nav).
 * No session read here (it would block every child segment); each page reads
 * the user inside its own <Suspense> (see docs/UI.md).
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <main className="relative mx-auto flex w-full max-w-app flex-1 flex-col pl-safe pr-safe">{children}</main>
      <Suspense fallback={<TabBarView active={null} />}>
        <TabBar />
      </Suspense>
    </>
  );
}
