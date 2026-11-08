type Props = {
  className?: string;
};

export default function DownloadAppButton({ className = "" }: Props) {
  return (
    <a
      href="/downloads/RepLoad.apk"
      download="RepLoad.apk"
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-lime-300/30 bg-lime-300/[0.08] px-4 py-2.5 text-sm font-bold text-lime-200 transition hover:border-lime-300/60 hover:bg-lime-300/[0.14] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300 ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="h-4 w-4"
      >
        <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 17v3h14v-3" />
      </svg>
      Pobierz plik
    </a>
  );
}
