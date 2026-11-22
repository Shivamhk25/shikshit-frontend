import { useEffect, useMemo, useState } from 'react';
import { Check, Palette, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { ACCENT_PALETTE, appearanceFromBrand, createTheme, PRESET_LABELS, type Appearance, type Preset } from '@shikshit/shared/tokens';
import { Button, Card, PageHeader, cx, useTheme } from '../../design-system';
import { useAccessState } from '../../shell/AccessProvider';
import { useAuth } from '../../shell/AuthProvider';
import { API_BASE } from '../../shell/web-session';
import { createAppearanceApi } from './appearanceApi';

/** FND-11 / decision 0005: the institute picks a design style and an accent colour. Every change previews live across
 * the whole app before it is saved; saving repaints everyone's app on their next request. */

const PRESETS: Preset[] = ['classic', 'modern', 'contrast'];
const ACCENT_NAMES: Record<string, string> = { navy: 'Navy', indigo: 'Indigo', teal: 'Teal', forest: 'Forest', maroon: 'Maroon', slate: 'Slate', ochre: 'Ochre' };
const HEX = /^#[0-9A-Fa-f]{6}$/;

/** A small sample of a look, drawn from its own tokens so it is right even before it is applied. */
function PresetSample({ preset, accent, mode }: { preset: Preset; accent: string; mode: 'light' | 'dark' }) {
  const t = createTheme(mode, accent, preset);
  return (
    <div aria-hidden="true" className="overflow-hidden border" style={{ background: t.color.bg.canvas, borderColor: t.color.border.subtle, borderRadius: t.radius.lg }}>
      <div className="space-y-2 p-3.5" style={{ background: t.color.bg.surface }}>
        <p className="text-lg font-semibold leading-none" style={{ fontFamily: t.font.display, color: t.color.text.primary }}>
          Aa Term report
        </p>
        <p className="text-[11px] leading-snug" style={{ color: t.color.text.secondary }}>
          Class 8 A · 32 students
        </p>
        <div className="flex items-center gap-1.5 pt-1">
          <span className="px-2.5 py-1 text-[11px] font-medium" style={{ background: t.color.accent.default, color: t.color.text.onAccent, borderRadius: t.radius.md }}>
            Save
          </span>
          <span className="border px-2.5 py-1 text-[11px]" style={{ borderColor: t.color.border.default, color: t.color.text.primary, borderRadius: t.radius.md }}>
            Cancel
          </span>
        </div>
      </div>
    </div>
  );
}

export function AppearancePage() {
  const { session } = useAuth();
  const api = useMemo(() => createAppearanceApi(session, API_BASE), [session]);
  const access = useAccessState();
  const canManage = access.phase === 'ready' && access.access.can('iam.appearance.manage');
  const theme = useTheme();

  const [saved, setSaved] = useState<Appearance | null>(null);
  const [draft, setDraft] = useState<Appearance | null>(null);
  const [error, setError] = useState('');
  const [hexInput, setHexInput] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setError('');
    try {
      const a = await api.get();
      setSaved(a);
      setDraft(a);
      setHexInput(a.accent);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void load(), [api]);

  const dirty = !!saved && !!draft && (saved.accent !== draft.accent || saved.preset !== draft.preset);
  // Preview whatever differs from the look the shell is painting. Right after a save the shell still has the old look
  // until its access payload reloads, so the preview stays on until they match and nothing flashes.
  const live = appearanceFromBrand(access.phase === 'ready' ? access.payload.tenant?.brand : undefined);
  const differsFromLive = !!draft && (draft.accent !== live.accent || draft.preset !== live.preset);
  const { preview } = theme;
  useEffect(() => {
    preview(differsFromLive && draft ? draft : null);
  }, [differsFromLive, draft, preview]);
  useEffect(() => () => preview(null), [preview]);

  const pick = (next: Partial<Appearance>) => {
    if (!draft) return;
    setDraft({ ...draft, ...next });
    if (next.accent) setHexInput(next.accent);
  };

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const a = await api.set(draft);
      setSaved(a);
      setDraft(a);
      toast.success('Appearance saved. Everyone sees it on their next page.');
      // any request now carries the new access version, which makes the shell reload its payload and the new look
      void api.get().catch(() => undefined);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <section className="space-y-4">
        <PageHeader title="Appearance" />
        <div role="alert" className="space-y-3 rounded-lg border border-danger-line bg-surface p-6 shadow-soft">
          <p className="text-fg">{error}</p>
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      </section>
    );
  }
  if (!draft) {
    return (
      <section aria-busy="true" className="space-y-4">
        <PageHeader title="Appearance" />
      </section>
    );
  }

  const paletteValues = Object.values(ACCENT_PALETTE).map((h) => h.toUpperCase());
  const custom = !paletteValues.includes(draft.accent.toUpperCase());

  return (
    <section className="space-y-8">
      <PageHeader
        title="Appearance"
        description={canManage ? 'The colour and style of your school on every screen, on the web and in the app. Changes preview straight away; save to share them.' : 'The colour and style your school uses. Only administrators can change them.'}
        actions={
          canManage ? (
            <>
              <Button variant="secondary" disabled={!dirty || saving} onClick={() => saved && pick(saved)}>
                <RotateCcw aria-hidden="true" className="size-4" />
                Undo changes
              </Button>
              <Button loading={saving} disabled={!dirty} onClick={() => void save()}>
                Save
              </Button>
            </>
          ) : undefined
        }
      />

      <div className="space-y-3">
        <h2 id="style-heading" className="font-display text-lg font-semibold text-fg">Design style</h2>
        <div role="radiogroup" aria-labelledby="style-heading" className="grid gap-4 md:grid-cols-3">
          {PRESETS.map((p) => {
            const selected = draft.preset === p;
            return (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={!canManage}
                onClick={() => pick({ preset: p })}
                className={cx(
                  'group flex flex-col gap-3 rounded-lg border bg-surface p-3 text-left shadow-soft transition-[border-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-subtle disabled:cursor-default',
                  selected ? 'border-accent ring-1 ring-accent' : 'border-line-subtle enabled:hover:border-line-strong',
                )}
              >
                <PresetSample preset={p} accent={draft.accent} mode={theme.mode} />
                <span className="flex items-start justify-between gap-2 px-1 pb-1">
                  <span>
                    <span className="block font-medium text-fg">{PRESET_LABELS[p].name}</span>
                    <span className="block text-xs text-fg-muted">{PRESET_LABELS[p].description}</span>
                  </span>
                  {selected ? (
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
                      <Check aria-hidden="true" className="size-3" />
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <Card className="space-y-4 p-6">
        <div>
          <h2 id="colour-heading" className="font-display text-lg font-semibold text-fg">Accent colour</h2>
          <p className="text-sm text-fg-muted">Used for buttons, links and highlights. Text on it is adjusted to stay readable in light and dark.</p>
        </div>
        <div role="radiogroup" aria-labelledby="colour-heading" className="flex flex-wrap gap-3">
          {Object.entries(ACCENT_PALETTE).map(([name, hex]) => {
            const selected = draft.accent.toUpperCase() === hex.toUpperCase();
            const label = ACCENT_NAMES[name] ?? name.charAt(0).toUpperCase() + name.slice(1);
            return (
              <button
                key={name}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={label}
                title={label}
                disabled={!canManage}
                onClick={() => pick({ accent: hex.toUpperCase() })}
                className={cx(
                  'flex size-10 items-center justify-center rounded-full border-2 transition-transform duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-subtle enabled:hover:scale-105 disabled:cursor-default',
                  selected ? 'border-fg' : 'border-transparent',
                )}
                style={{ background: hex }}
              >
                {selected ? <Check aria-hidden="true" className="size-4 text-white" /> : null}
              </button>
            );
          })}
        </div>
        {canManage ? (
          <div className="flex flex-wrap items-end gap-3 border-t border-line-subtle pt-4">
            <label className="flex items-center gap-2 text-sm text-fg">
              <input
                type="color"
                aria-label="Pick your own colour"
                value={draft.accent.toLowerCase()}
                onChange={(e) => pick({ accent: e.target.value.toUpperCase() })}
                className="size-10 cursor-pointer rounded-md border border-line bg-surface p-1"
              />
              <span className="flex items-center gap-1.5">
                <Palette aria-hidden="true" className="size-4 text-fg-subtle" />
                Your own colour
              </span>
            </label>
            <label className="text-sm text-fg">
              <span className="sr-only">Colour code</span>
              <input
                aria-label="Colour code"
                value={hexInput}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  setHexInput(v);
                  if (HEX.test(v)) setDraft({ ...draft, accent: v.toUpperCase() });
                }}
                aria-invalid={!HEX.test(hexInput)}
                placeholder="#1F3A5F"
                className="h-10 w-32 rounded-md border border-line bg-surface px-3 font-mono text-sm text-fg shadow-soft focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-subtle aria-[invalid=true]:border-danger"
              />
            </label>
            {custom ? <p className="text-xs text-fg-subtle">A colour of your own. It is darkened or lightened where needed so text stays readable.</p> : null}
          </div>
        ) : null}
      </Card>

      <p className="text-sm text-fg-muted">
        Light or dark is each person&apos;s own choice, on their <Link to="/profile" className="font-medium text-accent-fg hover:underline">Profile</Link>.
      </p>
    </section>
  );
}
