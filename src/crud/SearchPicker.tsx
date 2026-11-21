import { useEffect, useId, useRef, useState } from "react";

export interface PickerOption {
  value: string;
  label: string;
}

/**
 * Picks one record out of a list too long to load whole (students, guardians). The person types, the list is fetched
 * from the server as they type, and the chosen record keeps its label so the form can show who was picked.
 */
export function SearchPicker({
  label,
  required,
  hint,
  error,
  value,
  onChange,
  search,
  describe,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  value: string;
  onChange: (v: string) => void;
  /** Finds records matching the typed text. */
  search: (q: string) => Promise<PickerOption[]>;
  /** Names the record that is already chosen, when the form opens on an existing row. */
  describe: (id: string) => Promise<PickerOption | null>;
}) {
  const id = useId();
  const [q, setQ] = useState("");
  const [options, setOptions] = useState<PickerOption[]>([]);
  const [chosen, setChosen] = useState<PickerOption | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const seq = useRef(0);
  // The callers pass fresh functions on every render; the latest are kept here so the effects below depend only on the text and the value.
  const searchRef = useRef(search);
  const describeRef = useRef(describe);
  searchRef.current = search;
  describeRef.current = describe;

  useEffect(() => {
    if (!value || chosen?.value === value) return;
    let live = true;
    describeRef.current(value)
      .then((o) => live && setChosen(o))
      .catch(() => live && setChosen(null));
    return () => {
      live = false;
    };
  }, [value, chosen]);

  useEffect(() => {
    const n = ++seq.current;
    setState("loading");
    const t = setTimeout(() => {
      searchRef.current(q.trim())
        .then((r) => {
          if (n !== seq.current) return;
          setOptions(r);
          setState("idle");
        })
        .catch(() => n === seq.current && setState("error"));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const shown =
    chosen && !options.some((o) => o.value === chosen.value)
      ? [chosen, ...options]
      : options;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={`${id}-q`} className="text-sm font-medium text-fg">
        {required ? `${label} *` : label}
      </label>
      <input
        id={`${id}-q`}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={
          chosen
            ? `Chosen: ${chosen.label}. Type to search again`
            : "Type to search"
        }
        className={
          "h-10 w-full rounded-md border bg-surface px-3 text-base text-fg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring " +
          (error ? "border-danger" : "border-line")
        }
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-e` : undefined}
      />
      <select
        aria-label={`${label} results`}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setChosen(options.find((o) => o.value === e.target.value) ?? chosen);
        }}
        className="h-10 w-full rounded-md border border-line bg-surface px-3 text-base text-fg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
      >
        <option value="" disabled={required}>
          {state === "loading"
            ? "Searching…"
            : shown.length === 0
              ? "No match"
              : "Choose…"}
        </option>
        {shown.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {state === "error" ? (
        <p role="alert" className="text-sm text-danger">
          The list could not be loaded. Try again.
        </p>
      ) : null}
      {hint ? <p className="text-sm text-fg-muted">{hint}</p> : null}
      {error ? (
        <p id={`${id}-e`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
