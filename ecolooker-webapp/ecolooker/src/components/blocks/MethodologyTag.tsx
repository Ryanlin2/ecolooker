import { FlaskConical } from "lucide-react";

const placeholder = (
  <>
    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
    tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
    veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea
    commodo consequat.
  </>
);

export function MethodologyTag({
  title = "Methodology",
  children,
}: {
  title?: string;
  children?: React.ReactNode;
}) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        aria-label={`Methodology behind ${title}`}
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-accent/40 bg-surface-2 text-accent transition-colors hover:bg-accent hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <FlaskConical size={12} strokeWidth={2.25} />
      </button>

      <div
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-72 origin-top-left scale-95 rounded-xl border bg-surface p-3 text-left opacity-0 shadow-lg transition duration-150 group-hover:scale-100 group-hover:opacity-100 group-focus-within:scale-100 group-focus-within:opacity-100"
      >
        <p className="text-xs font-semibold text-accent">{title}</p>
        <p className="mt-1 text-xs leading-5 text-foreground/90">
          {children ?? placeholder}
        </p>
      </div>
    </span>
  );
}
