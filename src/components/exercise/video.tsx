"use client";
/**
 * "Ver video": VideoSheet (youtube-nocookie embed, mounted only while open)
 * and VideoButton (button + sheet). Renders nothing when youtubeId is null.
 *
 * <VideoButton youtubeId={ex.youtubeId} title={ex.name} />
 * <VideoButton youtubeId={sub.youtubeId} title={sub.name} variant="chip" label="Video" />
 */
import { BottomSheet, useDisclosure } from "../ui/bottom-sheet";
import { Button, buttonStyles, type ButtonSize, type ButtonVariant } from "../ui/button";
import { Chip } from "../ui/badge";
import { Icon } from "../ui/icons";
import { youtubeEmbedUrl, youtubeWatchUrl } from "./shared";

export interface VideoSheetProps {
  youtubeId: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VideoSheet({ youtubeId, title, open, onOpenChange }: VideoSheetProps) {
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      eyebrow="Video del programa"
      footer={
        <a
          href={youtubeWatchUrl(youtubeId)}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonStyles({ variant: "secondary", block: true })}
        >
          <Icon.External />
          Abrir en YouTube
        </a>
      }
    >
      <div className="overflow-hidden rounded-lg border border-line bg-black">
        {open ? (
          <iframe
            src={youtubeEmbedUrl(youtubeId)}
            title={`Video: ${title}`}
            className="aspect-video w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            loading="lazy"
          />
        ) : (
          <div className="aspect-video w-full" />
        )}
      </div>
      <p className="mt-2 text-xs text-fg-subtle">
        Si no carga, ábrelo en la app de YouTube con el botón de abajo.
      </p>
    </BottomSheet>
  );
}

export interface VideoButtonProps {
  youtubeId: string | null | undefined;
  /** Exercise name (sheet title). */
  title: string;
  /** Button text. Default "Ver video". */
  label?: string;
  /** "button" (default) or compact "chip". */
  variant?: "button" | "chip";
  buttonVariant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
}

export function VideoButton({
  youtubeId,
  title,
  label = "Ver video",
  variant = "button",
  buttonVariant = "secondary",
  size = "sm",
  block,
  className,
}: VideoButtonProps) {
  const sheet = useDisclosure();
  if (!youtubeId) return null;
  const a11y = { "aria-haspopup": "dialog" as const, "aria-label": `${label}: ${title}` };
  return (
    <>
      {variant === "chip" ? (
        <Chip icon={<Icon.Video className="size-4" />} onClick={sheet.onOpen} className={className} {...a11y}>
          {label}
        </Chip>
      ) : (
        <Button
          variant={buttonVariant}
          size={size}
          block={block}
          icon={<Icon.Video />}
          onClick={sheet.onOpen}
          className={className}
          {...a11y}
        >
          {label}
        </Button>
      )}
      <VideoSheet youtubeId={youtubeId} title={title} open={sheet.open} onOpenChange={sheet.setOpen} />
    </>
  );
}
