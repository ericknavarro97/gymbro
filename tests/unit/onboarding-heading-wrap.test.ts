/**
 * Regression for R2-3: on /bienvenida a long unbroken first name (no spaces) made the h1 overflow
 * horizontally (document scrollWidth ~2149px at a 390px viewport). The heading must allow breaking
 * inside long words.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: () => {}, push: () => {} }) }));
vi.mock("@/components/ui/toast", () => ({ useToast: () => ({ success: () => {}, error: () => {} }) }));
vi.mock("@/server/actions/settings.actions", () => ({ completeOnboardingAction: async () => ({ ok: true }) }));

const { OnboardingForm } = await import("@/components/onboarding/onboarding-form");

describe("OnboardingForm heading", () => {
  const longName = "Maximiliano".repeat(10);
  const html = renderToStaticMarkup(
    createElement(OnboardingForm, {
      firstName: longName,
      weakPoints: [],
      defaultUnit: "kg",
      defaultWeakPointKey: null,
      today: "2026-10-23",
    }),
  );
  const h1 = /<h1 class="([^"]*)"[^>]*>([\s\S]*?)<\/h1>/.exec(html);

  it("renders the greeting with the first name", () => {
    expect(h1?.[2]).toContain(`Hola, ${longName}.`);
  });

  it("lets long unbroken names wrap instead of overflowing the viewport", () => {
    const classes = h1?.[1].split(/\s+/) ?? [];
    expect(classes).toContain("break-words");
    expect(classes).toContain("[overflow-wrap:anywhere]");
  });
});
