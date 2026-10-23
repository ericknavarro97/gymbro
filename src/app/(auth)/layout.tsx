import { Wordmark } from "@/components/layout/brand";

/** Signed-out shell (/login, /registro): brand header + centered form column. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative mx-auto flex w-full max-w-app flex-1 flex-col px-4 pt-safe pb-safe">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-24 h-72 bg-[radial-gradient(60%_60%_at_50%_40%,color-mix(in_oklab,var(--gb-accent)_30%,transparent),transparent)] opacity-60"
      />
      <header className="relative pt-10 pb-8">
        <Wordmark />
      </header>
      <main className="relative flex flex-1 flex-col pb-8">{children}</main>
    </div>
  );
}
