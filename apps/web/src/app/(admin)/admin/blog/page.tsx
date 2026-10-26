'use client';

import { useEffect, useState } from 'react';
import { CATEGORIES, cityBySlug, type BlogPostDto, type CityGuideDto, type PlatformSettings } from '@companio/types';
import { Badge, Button, Callout, Card, Field, Input, Modal, Select, Tabs, Textarea, Toggle, cn, toneBg } from '@companio/ui';
import { ErrorBox, Loading, PageTitle } from '@/admin/components/ui';
import { useToast } from '@/admin/components/toast';
import { errMsg, refreshPublicPages, useAdmin, useLoad } from '@/admin/lib/api';
import { dtIST } from '@/admin/lib/format';
import { PostBody, blocksToText, textToBlocks } from '@/components/post-body';

const MODELS = ['Haiku (cheapest)', 'Sonnet (recommended)', 'Opus (best)'];
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TONES = ['sky', 'pink', 'lime', 'sunny', 'lavender'] as const;
const modelName = (id: string | null) => (id?.includes('haiku') ? 'Haiku' : id?.includes('opus') ? 'Opus' : id?.includes('sonnet') ? 'Sonnet' : null);

type Draft = { id?: string; title: string; excerpt: string; emoji: string; tone: string; text: string };

/** Blog: AI drafts every week, an admin reviews, edits and publishes. Nothing goes live without Publish. */
export default function BlogAdmin() {
  const { api, token } = useAdmin();
  const toast = useToast();
  const [tab, setTab] = useState<'DRAFT' | 'PUBLISHED' | 'BUILTIN' | 'GUIDES'>('DRAFT');
  // emails about new city guides link to ?tab=guides
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('tab') === 'guides') setTab('GUIDES');
  }, []);
  const { data, error, reload } = useLoad(() => api.admin.content.posts(), []);
  const [edit, setEdit] = useState<Draft | null>(null);
  const [preview, setPreview] = useState<BlogPostDto | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [topic, setTopic] = useState('');

  const run = async (key: string, fn: () => Promise<unknown>, ok: string, publicChange = false) => {
    setBusy(key);
    try {
      await fn();
      if (publicChange) await refreshPublicPages(token);
      toast(ok);
      reload();
      return true;
    } catch (e) {
      toast(errMsg(e), 'error');
      return false;
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    if (!edit) return;
    const input = { title: edit.title, excerpt: edit.excerpt, emoji: edit.emoji, tone: edit.tone, body: textToBlocks(edit.text) };
    const live = data?.items.find((p) => p.id === edit.id)?.status === 'PUBLISHED';
    if (
      await run(
        'save',
        () => (edit.id ? api.admin.content.updatePost(edit.id, input) : api.admin.content.createPost(input)),
        live ? 'Saved — live post updated' : 'Draft saved',
        live,
      )
    )
      setEdit(null);
  };

  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  const drafts = data.items.filter((p) => p.status === 'DRAFT');
  const published = data.items.filter((p) => p.status === 'PUBLISHED');
  const list = tab === 'DRAFT' ? drafts : published;

  return (
    <>
      <PageTitle
        title="📝 Blog & city guides"
        subtitle="AI drafts new posts every week, and local text for each new city with a live host. Read, edit and publish what you like — nothing goes live until you click Publish."
        actions={
          <Button variant="white" onClick={() => setEdit({ title: '', excerpt: '', emoji: '📝', tone: 'sky', text: '' })}>
            + Write a post
          </Button>
        }
      />
      <AutoSettings />

      <Card className="mb-6 flex flex-wrap items-end gap-3 p-4">
        <Field label="Need a post now? (optional topic)" className="min-w-[16rem] flex-1">
          <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Best weekend plans in Bengaluru with a buddy" maxLength={200} />
        </Field>
        <Button
          loading={busy === 'draft'}
          onClick={() =>
            run(
              'draft',
              async () => {
                await api.admin.content.draftPost(topic.trim() || undefined);
                setTopic('');
                setTab('DRAFT');
              },
              'Draft written — it’s in Drafts',
            )
          }
        >
          ✨ Write a draft now
        </Button>
        <p className="w-full text-xs text-ink-mute">Takes about 20–60 seconds. Costs a few rupees on your AI account.</p>
      </Card>

      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'DRAFT', label: `Drafts (${drafts.length})` },
          { value: 'PUBLISHED', label: `Published (${published.length})` },
          { value: 'BUILTIN', label: `Built-in (${data.builtIn.length})` },
          { value: 'GUIDES', label: '🗺️ City guides' },
        ]}
      />

      {tab === 'GUIDES' ? (
        <CityGuides />
      ) : tab === 'BUILTIN' ? (
        <Card className="divide-y-2 divide-ink/10 p-2">
          {data.builtIn.map((p) => (
            <a
              key={p.slug}
              href={`/blog/${p.slug}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm hover:bg-paper"
            >
              <span className="font-semibold">{p.title}</span>
              <span className="shrink-0 text-xs text-ink-mute">{p.date} ↗</span>
            </a>
          ))}
          <p className="px-3 py-2 text-xs text-ink-mute">These posts ship with the site and are always live.</p>
        </Card>
      ) : list.length === 0 ? (
        <Card className="p-8 text-center text-ink-mute">
          {tab === 'DRAFT' ? 'No drafts waiting. New ones arrive on your draft day — or write one now.' : 'Nothing published from here yet.'}
        </Card>
      ) : (
        <div className="space-y-3">
          {list.map((p) => (
            <Card key={p.id} className="flex flex-wrap items-center gap-4 p-4">
              <span className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-ink text-3xl', toneBg[p.tone])}>
                {p.emoji}
              </span>
              <div className="min-w-[14rem] flex-1">
                <p className="font-display text-lg font-extrabold leading-tight">{p.title}</p>
                <p className="mt-0.5 line-clamp-2 text-sm text-ink-soft">{p.excerpt}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-ink-mute">
                  <Badge tone={p.source === 'AI' ? 'lavender' : 'white'}>
                    {p.source === 'AI' ? `✨ AI · ${modelName(p.model) ?? 'draft'}` : '✍️ Written in admin'}
                  </Badge>
                  <span>{p.status === 'PUBLISHED' && p.publishedAt ? `published ${dtIST(p.publishedAt)}` : `drafted ${dtIST(p.createdAt)}`}</span>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button size="sm" variant="white" onClick={() => setPreview(p)}>
                  Read
                </Button>
                <Button
                  size="sm"
                  variant="white"
                  onClick={() => setEdit({ id: p.id, title: p.title, excerpt: p.excerpt, emoji: p.emoji, tone: p.tone, text: blocksToText(p.body) })}
                >
                  Edit
                </Button>
                {p.status === 'DRAFT' ? (
                  <>
                    <Button
                      size="sm"
                      variant="lime"
                      loading={busy === `pub-${p.id}`}
                      onClick={() => run(`pub-${p.id}`, () => api.admin.content.publishPost(p.id, true), 'Published — live on the blog', true)}
                    >
                      Publish
                    </Button>
                    <Button
                      size="sm"
                      variant="white"
                      onClick={() => confirm(`Delete “${p.title}”?`) && run(`del-${p.id}`, () => api.admin.content.deletePost(p.id), 'Draft deleted')}
                    >
                      Delete
                    </Button>
                  </>
                ) : (
                  <>
                    <a href={`/blog/${p.slug}`} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="white">
                        View live ↗
                      </Button>
                    </a>
                    <Button
                      size="sm"
                      variant="white"
                      loading={busy === `pub-${p.id}`}
                      onClick={() => run(`pub-${p.id}`, () => api.admin.content.publishPost(p.id, false), 'Unpublished — back in Drafts', true)}
                    >
                      Unpublish
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!preview} onClose={() => setPreview(null)} title="Preview">
        {preview && (
          <div className="max-h-[70vh] overflow-y-auto pr-1">
            <p className="text-4xl">{preview.emoji}</p>
            <h1 className="mt-2 text-2xl font-extrabold leading-tight">{preview.title}</h1>
            <p className="mb-5 mt-1 text-sm text-ink-mute">{preview.excerpt}</p>
            <PostBody body={preview.body} />
          </div>
        )}
      </Modal>

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit?.id ? 'Edit post' : 'New post'}
        footer={
          <Button
            loading={busy === 'save'}
            disabled={!edit || edit.title.trim().length < 8 || edit.excerpt.trim().length < 20 || textToBlocks(edit.text).length < 3}
            onClick={save}
          >
            Save
          </Button>
        }
      >
        {edit && (
          <div className="space-y-3">
            <Field label="Title">
              <Input value={edit.title} maxLength={140} onChange={(e) => setEdit({ ...edit, title: e.target.value })} />
            </Field>
            <Field label="Summary (shown on the blog list and in Google)" hint={`${edit.excerpt.length}/300`}>
              <Textarea rows={2} value={edit.excerpt} maxLength={300} onChange={(e) => setEdit({ ...edit, excerpt: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Emoji">
                <Input value={edit.emoji} maxLength={8} onChange={(e) => setEdit({ ...edit, emoji: e.target.value })} />
              </Field>
              <Field label="Card colour">
                <Select value={edit.tone} onChange={(e) => setEdit({ ...edit, tone: e.target.value })}>
                  {TONES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Text" hint="Blank line between paragraphs · ## for a heading · - for a bullet · **bold** · [link text](/explore/coffee-chat/delhi)">
              <Textarea rows={16} value={edit.text} onChange={(e) => setEdit({ ...edit, text: e.target.value })} className="font-mono text-sm" />
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}

/** The weekly AI drafts: on/off, how many, which day, which model. */
function AutoSettings() {
  const { api } = useAdmin();
  const toast = useToast();
  const [s, setS] = useState<PlatformSettings | null>(null);
  useEffect(() => {
    api.admin
      .settings()
      .then(setS)
      .catch(() => {});
  }, [api]);
  if (!s) return null;
  const save = async (patch: Partial<PlatformSettings>) => {
    try {
      setS(await api.admin.updateSettings({ ...s, ...patch }));
      toast('Saved');
    } catch (e) {
      toast(errMsg(e), 'error');
    }
  };
  return (
    <Callout tone={s.blogAutoEnabled ? 'lime' : 'white'} className="mb-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
        <label className="flex cursor-pointer items-center gap-2 font-bold">
          <Toggle checked={s.blogAutoEnabled === 1} onChange={(v) => save({ blogAutoEnabled: v ? 1 : 0 })} label="Weekly AI drafts" />
          Weekly AI drafts
        </label>
        <label className="flex items-center gap-2 whitespace-nowrap">
          <span className="w-20">
            <Select
              value={s.blogDraftsPerWeek}
              onChange={(e) => save({ blogDraftsPerWeek: Number(e.target.value) })}
              className="h-9"
              aria-label="Drafts per week"
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </span>
          drafts every
        </label>
        <span className="w-40">
          <Select value={s.blogDraftDay} onChange={(e) => save({ blogDraftDay: Number(e.target.value) })} className="h-9" aria-label="Day">
            {DAYS.map((d, i) => (
              <option key={d} value={i + 1}>
                {d}
              </option>
            ))}
          </Select>
        </span>
        <label className="flex items-center gap-2 whitespace-nowrap">
          written by
          <span className="w-60">
            <Select value={s.blogModel} onChange={(e) => save({ blogModel: Number(e.target.value) })} className="h-9" aria-label="AI model">
              {MODELS.map((m, i) => (
                <option key={m} value={i}>
                  {m}
                </option>
              ))}
            </Select>
          </span>
        </label>
      </div>
    </Callout>
  );
}

type GuideDraft = { city: string; intro: string; faqs: string; spots: Record<string, string> };
const faqsToText = (f: { q: string; a: string }[]) => f.map((x) => `Q: ${x.q}\nA: ${x.a}`).join('\n\n');
const textToFaqs = (t: string) =>
  t
    .split(/\n\s*\n/)
    .map((b) => ({ q: b.match(/^Q:\s*(.+)$/m)?.[1]?.trim() ?? '', a: b.match(/^A:\s*([\s\S]+)$/m)?.[1]?.trim() ?? '' }))
    .filter((x) => x.q && x.a);
const cityName = (slug: string) => cityBySlug(slug)?.name ?? slug;

/** Local text for city pages: drafts for new cities (AI or written here), approve to publish. */
function CityGuides() {
  const { api, token } = useAdmin();
  const toast = useToast();
  const { data, error, reload } = useLoad(() => api.admin.content.guides(), []);
  const [edit, setEdit] = useState<GuideDraft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (key: string, fn: () => Promise<unknown>, ok: string, publicChange = false) => {
    setBusy(key);
    try {
      await fn();
      if (publicChange) await refreshPublicPages(token);
      toast(ok);
      reload();
      return true;
    } catch (e) {
      toast(errMsg(e), 'error');
      return false;
    } finally {
      setBusy(null);
    }
  };
  const open = (g: CityGuideDto) => setEdit({ city: g.city, intro: g.intro.join('\n\n'), faqs: faqsToText(g.faqs), spots: { ...g.spots } });
  const save = async () => {
    if (!edit) return;
    const live = data?.items.find((g) => g.city === edit.city)?.status === 'PUBLISHED';
    const body = {
      intro: edit.intro
        .split(/\n\s*\n/)
        .map((x) => x.trim())
        .filter(Boolean),
      faqs: textToFaqs(edit.faqs),
      spots: edit.spots,
    };
    if (await run('save', () => api.admin.content.saveGuide(edit.city, body), live ? 'Saved — live pages updated' : 'Saved', live)) setEdit(null);
  };

  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  return (
    <div className="space-y-5">
      {data.missing.length > 0 && (
        <Card tone="sunny" className="p-4">
          <p className="font-bold">Cities with live hosts but no local text yet</p>
          <p className="mb-3 text-sm text-ink-soft">A draft is written automatically within the hour — or write one now.</p>
          <div className="flex flex-wrap gap-2">
            {data.missing.map((c) => (
              <Button
                key={c}
                size="sm"
                variant="white"
                loading={busy === `d-${c}`}
                onClick={() => run(`d-${c}`, () => api.admin.content.draftGuide(c), `Draft written for ${cityName(c)}`)}
              >
                ✨ Draft {cityName(c)}
              </Button>
            ))}
          </div>
        </Card>
      )}
      {data.items.length === 0 ? (
        <Card className="p-6 text-center text-ink-mute">No city guides drafted here yet.</Card>
      ) : (
        <div className="space-y-3">
          {data.items.map((g) => (
            <Card key={g.city} className="flex flex-wrap items-center gap-4 p-4">
              <div className="min-w-[14rem] flex-1">
                <p className="flex flex-wrap items-center gap-2 font-display text-lg font-extrabold">
                  🗺️ {cityName(g.city)}
                  <Badge tone={g.status === 'PUBLISHED' ? 'lime' : 'sunny'}>{g.status === 'PUBLISHED' ? 'Live' : 'Draft'}</Badge>
                  {g.source === 'AI' && <Badge tone="lavender">✨ AI</Badge>}
                </p>
                <p className="mt-0.5 line-clamp-2 text-sm text-ink-soft">{g.intro[0]}</p>
                <p className="mt-1 text-xs text-ink-mute">
                  {Object.keys(g.spots).length} activit{Object.keys(g.spots).length === 1 ? 'y' : 'ies'} · {g.faqs.length} local question
                  {g.faqs.length === 1 ? '' : 's'} · updated {dtIST(g.updatedAt)}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button size="sm" variant="white" onClick={() => open(g)}>
                  Read & edit
                </Button>
                {g.status === 'DRAFT' ? (
                  <Button
                    size="sm"
                    variant="lime"
                    loading={busy === `p-${g.city}`}
                    onClick={() => run(`p-${g.city}`, () => api.admin.content.publishGuide(g.city, true), `${cityName(g.city)} guide is live`, true)}
                  >
                    Approve & publish
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="white"
                    loading={busy === `p-${g.city}`}
                    onClick={() => run(`p-${g.city}`, () => api.admin.content.publishGuide(g.city, false), 'Unpublished', true)}
                  >
                    Unpublish
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="white"
                  onClick={() =>
                    confirm(`Delete the ${cityName(g.city)} guide?`) &&
                    run(`x-${g.city}`, () => api.admin.content.deleteGuide(g.city), 'Deleted', g.status === 'PUBLISHED')
                  }
                >
                  Delete
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <Card className="p-4 text-sm text-ink-soft">
        <b>Built-in guides</b> (always live): {data.builtIn.map(cityName).join(', ')}. A guide published here for one of these cities replaces the built-in
        text.
      </Card>

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit ? `${cityName(edit.city)} — city guide` : ''}
        footer={
          <Button loading={busy === 'save'} disabled={!edit?.intro.trim()} onClick={save}>
            Save
          </Button>
        }
      >
        {edit && (
          <div className="max-h-[65vh] space-y-3 overflow-y-auto pr-1">
            <Field label={`“Meeting people in ${cityName(edit.city)}” (blank line between paragraphs)`}>
              <Textarea rows={7} value={edit.intro} onChange={(e) => setEdit({ ...edit, intro: e.target.value })} />
            </Field>
            {Object.keys(edit.spots).map((a) => (
              <Field key={a} label={`Where people meet for ${CATEGORIES.find((c) => c.slug === a)?.name.toLowerCase() ?? a}`}>
                <Textarea rows={3} value={edit.spots[a]} onChange={(e) => setEdit({ ...edit, spots: { ...edit.spots, [a]: e.target.value } })} />
              </Field>
            ))}
            <Field label="Local questions" hint="Q: question, A: answer — blank line between pairs">
              <Textarea rows={6} value={edit.faqs} onChange={(e) => setEdit({ ...edit, faqs: e.target.value })} className="font-mono text-sm" />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
