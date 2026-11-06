type StatCardProps = {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
};

export default function StatCard({ label, value, hint, icon }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-neutral-900/70 p-5 backdrop-blur-xl">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-lime-400/10 text-lime-400">
        {icon}
      </div>
      <p className="text-sm text-neutral-400">{label}</p>
      <p className="mt-1 text-3xl font-extrabold tracking-tight text-white">
        {value}
      </p>
      {hint && <p className="mt-1 truncate text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}