"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import TemplateCard from "./TemplateCard";
import type { WorkoutTemplate } from "./types";

type Props = {
  templates: WorkoutTemplate[];
  deletingTemplateId: string | null;
  onEdit: (template: WorkoutTemplate) => void;
  onStart: (template: WorkoutTemplate) => void;
  onDuplicate: (template: WorkoutTemplate) => void;
  onDelete: (id: string) => void;
};

export default function TemplateCarousel({
  templates,
  deletingTemplateId,
  onEdit,
  onStart,
  onDuplicate,
  onDelete,
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);

  const updateScrollButtons = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setCanScrollBack(track.scrollLeft > 2);
    setCanScrollForward(
      track.scrollLeft + track.clientWidth < track.scrollWidth - 2,
    );
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    updateScrollButtons();
    const resizeObserver = new ResizeObserver(updateScrollButtons);
    resizeObserver.observe(track);
    for (const card of track.children) resizeObserver.observe(card);
    return () => resizeObserver.disconnect();
  }, [templates.length, updateScrollButtons]);

  const scroll = (direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector<HTMLElement>("[data-template-card]");
    const distance = card
      ? card.getBoundingClientRect().width + 16
      : track.clientWidth * 0.8;
    track.scrollBy({ left: direction * distance, behavior: "smooth" });
  };

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        aria-label="Poprzednie szablony"
        onClick={() => scroll(-1)}
        disabled={!canScrollBack}
        className="absolute top-1/2 left-2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-neutral-900/95 text-lg text-neutral-300 shadow-lg transition hover:border-lime-300/40 hover:text-lime-300 disabled:pointer-events-none disabled:opacity-30 md:flex"
      >
        ‹
      </button>
      <div
        ref={trackRef}
        onScroll={updateScrollButtons}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-1 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {templates.map((template) => (
          <div
            key={template.id}
            data-template-card
            className="w-[84%] max-w-[23rem] shrink-0 snap-start sm:w-[min(70%,23rem)] md:w-[min(48%,23rem)]"
          >
            <TemplateCard
              template={template}
              onStart={onStart}
              onEdit={onEdit}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              isDeleting={deletingTemplateId === template.id}
            />
          </div>
        ))}
      </div>
      <button
        type="button"
        aria-label="Kolejne szablony"
        onClick={() => scroll(1)}
        disabled={!canScrollForward}
        className="absolute top-1/2 right-2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-neutral-900/95 text-lg text-neutral-300 shadow-lg transition hover:border-lime-300/40 hover:text-lime-300 disabled:pointer-events-none disabled:opacity-30 md:flex"
      >
        ›
      </button>
    </div>
  );
}
