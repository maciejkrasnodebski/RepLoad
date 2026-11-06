"use client";

import {
  BoltIcon,
  DumbbellIcon,
  FlameIcon,
  TargetIcon,
  TrashIcon,
  TrophyIcon,
} from "./icons";
import { getTemplateTheme, trackingLabel, type WorkoutTemplate } from "./types";

type Props = {
  template: WorkoutTemplate;
  onEdit: (t: WorkoutTemplate) => void;
  onStart: (t: WorkoutTemplate) => void;
  onDelete: (id: string) => void;
  isDeleting?: boolean;
};

function exerciseSettingsSummary(
  exercise: WorkoutTemplate["exercises"][number],
) {
  const { settings } = exercise;
  const summary: string[] = [];
  if (settings.sets !== null) summary.push(`${settings.sets} ser.`);
  if (settings.reps !== null) summary.push(`${settings.reps} powt.`);
  if (settings.weight !== null) {
    summary.push(
      `${settings.weight} kg ${
        exercise.exerciseType === "assisted"
          ? "wspomagania"
          : exercise.exerciseType === "bodyweight_load"
            ? "dodatkowo"
            : ""
      }`.trim(),
    );
  }
  if (settings.durationSeconds !== null) {
    summary.push(`${settings.durationSeconds} sek.`);
  }
  if (settings.distance !== null) summary.push(`${settings.distance} km`);
  return summary.join(" · ");
}

export default function TemplateCard({
  template,
  onEdit,
  onStart,
  onDelete,
  isDeleting = false,
}: Props) {
  const theme = getTemplateTheme(template.color, template.icon);

  const TemplateIcon =
    theme.icon === "bolt"
      ? BoltIcon
      : theme.icon === "target"
        ? TargetIcon
        : theme.icon === "flame"
          ? FlameIcon
          : theme.icon === "trophy"
            ? TrophyIcon
            : DumbbellIcon;

  return (
    <article
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.06] bg-[var(--surface)] p-4 transition duration-200 hover:bg-[var(--surface-raised)] sm:p-5"
      style={{ borderLeftWidth: 3, borderLeftColor: theme.color }}
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              backgroundColor: `${theme.color}18`,
              color: theme.color,
            }}
          >
            <TemplateIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold text-white sm:text-lg">
              {template.name}
            </h3>
            <p className="mt-1 text-xs text-neutral-500">
              {template.exercises.length}{" "}
              {template.exercises.length === 1 ? "ćwiczenie" : "ćwiczeń"}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Usunąć szablon „${template.name}”?`)) {
                onDelete(template.id);
              }
            }}
            disabled={isDeleting}
            aria-label={isDeleting ? "Usuwanie szablonu" : "Usuń szablon"}
            className="cursor-pointer rounded-lg p-2 text-neutral-600 transition hover:bg-red-500/10 hover:text-red-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300 disabled:cursor-wait disabled:opacity-50"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </header>

      <ul className="mb-5 space-y-2 border-t border-white/[0.06] pt-4 text-sm">
        {template.exercises.slice(0, 4).map((e, index) => (
          <li
            key={`${e.id}-${index}`}
            className="flex items-center justify-between gap-3 text-neutral-300"
          >
            <span className="flex min-w-0 items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white/[0.04] text-[10px] font-semibold text-neutral-500">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="truncate">{e.name}</span>
            </span>
            <span className="shrink-0 text-right text-[11px] text-neutral-500">
              {e.muscleGroup ?? "Mięśnie"}
              <span className="block text-neutral-600">
                {trackingLabel(e.exerciseType)}
              </span>
              <span className="block text-neutral-500">
                {exerciseSettingsSummary(e)}
              </span>
            </span>
          </li>
        ))}
        {template.exercises.length > 4 && (
          <li className="text-xs text-neutral-500">
            +{template.exercises.length - 4} więcej…
          </li>
        )}
      </ul>

      <div className="mt-auto grid grid-cols-[1fr_auto] gap-2">
        <button
          type="button"
          onClick={() => onStart(template)}
          className="min-h-12 cursor-pointer rounded-xl bg-lime-400 px-4 text-sm font-extrabold text-neutral-950 transition hover:bg-lime-300 active:scale-[0.99]"
        >
          Rozpocznij
        </button>
        <button
          type="button"
          onClick={() => onEdit(template)}
          aria-label={`Edytuj szablon ${template.name}`}
          className="flex min-h-12 min-w-12 items-center justify-center rounded-xl bg-[var(--surface-raised)] px-3 text-sm font-semibold text-neutral-200 transition hover:text-lime-300"
        >
          <TemplateIcon className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}
