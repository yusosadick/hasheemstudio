import { IconUploadCloud, IconCheckCircle } from "../components/Icons";

const stages = ["Uploading", "Inspecting", "Queued", "Processing", "Verifying", "Ready"];
const currentStageIndex = 1;

const recipes = [
  {
    id: "inspect",
    name: "Inspect only",
    description: "No transformation. Report only — fastest option.",
  },
  {
    id: "remux",
    name: "Compatible MP4 remux",
    description: "Copies supported streams into a compatible container. No re-encoding.",
    recommended: true,
  },
  {
    id: "encode",
    name: "H.264 / AAC compatibility encode",
    description: "Full re-encode for sources that aren't remux-compatible. Takes longer.",
  },
];

export default function UploadWizardPrototype() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-xs font-medium uppercase tracking-wide text-foreground-muted">
        Design prototype — not connected to a real upload yet
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Upload your video</h1>
      <p className="mt-2 text-sm text-foreground-muted">
        MP4 or MOV. Up to 100&nbsp;MB and 2 minutes on the Verified Free plan. Files are retained
        temporarily — see your retention countdown after upload.
      </p>

      <div className="mt-8 rounded-lg border-2 border-dashed border-border bg-surface1 p-10 text-center">
        <IconUploadCloud className="mx-auto text-accent" width={36} height={36} />
        <p className="mt-4 font-medium">Drag and drop your file here</p>
        <p className="mt-1 text-sm text-foreground-muted">or</p>
        <button
          type="button"
          className="mt-3 inline-flex min-h-touch items-center justify-center rounded-md border border-border px-5 text-sm font-medium hover:bg-surface2"
        >
          Choose a file
        </button>
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-medium">Recipe</h2>
        <p className="mt-1 text-sm text-foreground-muted">
          Choose how this file is prepared. We never silently switch from remux to a full
          re-encode.
        </p>
        <div className="mt-4 grid gap-3">
          {recipes.map((r) => (
            <label
              key={r.id}
              className="flex min-h-touch cursor-pointer items-start gap-3 rounded-lg border border-border p-4 has-[:checked]:border-accent has-[:checked]:bg-surface1"
            >
              <input
                type="radio"
                name="recipe"
                defaultChecked={r.recommended}
                className="mt-1 h-4 w-4 accent-accent"
              />
              <span>
                <span className="flex items-center gap-2 font-medium">
                  {r.name}
                  {r.recommended && (
                    <span className="rounded-full bg-surface2 px-2 py-0.5 text-xs text-foreground-muted">
                      Recommended
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-sm text-foreground-muted">
                  {r.description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-medium">Job status</h2>
        <ol className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-0">
          {stages.map((s, i) => {
            const done = i < currentStageIndex;
            const active = i === currentStageIndex;
            return (
              <li key={s} className="flex flex-1 items-center gap-2">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-medium ${
                    done
                      ? "border-success bg-success/10 text-success"
                      : active
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border text-foreground-muted"
                  }`}
                >
                  {done ? <IconCheckCircle width={16} height={16} /> : i + 1}
                </span>
                <span
                  className={`text-sm ${active ? "font-medium text-foreground" : "text-foreground-muted"}`}
                >
                  {s}
                  {active && (
                    <span className="ml-2 inline-block animate-pulse text-xs text-foreground-muted">
                      in progress…
                    </span>
                  )}
                </span>
                {i < stages.length - 1 && (
                  <span className="mx-2 hidden h-px flex-1 bg-border sm:block" aria-hidden="true" />
                )}
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-xs text-foreground-muted">
          No fake percentage or ETA is shown while duration can&apos;t be measured — activity is
          indicated, not invented.
        </p>
      </div>
    </div>
  );
}
