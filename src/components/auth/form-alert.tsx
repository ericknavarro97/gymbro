import { Icon } from "../ui/icons";

export function FormAlert({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger-soft px-3.5 py-3 text-sm font-medium text-fg">
      <Icon.Alert className="mt-0.5 size-4.5 shrink-0 text-danger" />
      <p>{message}</p>
    </div>
  );
}
