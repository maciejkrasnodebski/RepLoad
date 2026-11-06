import { CalendarIcon, TrashIcon } from "./icons";
import type { Exercise } from "./types";

type WorkoutCardProps = {
  workout: {
    id: string;
    name: string;
    date: string;
    exercises: Pick<Exercise, "id" | "name">[];
  };
  onDelete: (id: string) => void;
};

export default function WorkoutCard({ workout, onDelete }: WorkoutCardProps) {
  const date = new Date(`${workout.date}T12:00:00`).toLocaleDateString(
    "pl-PL",
    { weekday: "short", day: "numeric", month: "long" },
  );

  return (
    <article className="rounded-2xl border border-white/10 bg-neutral-900/70 p-5 backdrop-blur-xl transition hover:border-lime-400/40">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold text-white">
            {workout.name}
          </h3>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-500">
            <CalendarIcon className="h-3.5 w-3.5" />
            {date}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onDelete(workout.id)}
          aria-label="Usuń trening"
          className="rounded-lg p-2 text-neutral-600 transition hover:bg-red-500/10 hover:text-red-400"
        >
          <TrashIcon className="h-4 w-4" />
        </button>
      </header>

      <ul className="space-y-2">
        {workout.exercises.map((exercise) => (
          <li
            key={exercise.id}
            className="rounded-xl bg-neutral-950/60 px-3 py-2.5 text-sm text-neutral-200"
          >
            {exercise.name}
          </li>
        ))}
      </ul>
    </article>
  );
}
