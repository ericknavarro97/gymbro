import { Wordmark } from "@/components/layout/brand";

/** One-time onboarding shell (/bienvenida): no tab bar. */
export default function OnboardingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative mx-auto flex w-full max-w-app flex-1 flex-col px-4 pt-safe pb-safe">
      <header className="pt-6 pb-4">
        <Wordmark className="scale-90 origin-left" />
      </header>
      <main className="flex flex-1 flex-col pb-8">{children}</main>
    </div>
  );
}
