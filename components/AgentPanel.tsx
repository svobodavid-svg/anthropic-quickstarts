'use client';

import { useRef, useState } from 'react';
import { Bot, Loader, Save, Square, Trash2 } from 'lucide-react';
import { useStudio } from '@/lib/store';
import { runAgent, type AgentEvent } from '@/lib/agent';

const DEFAULT_TEMPLATES = [
  {
    id: 'series',
    name: 'Série 5 záběrů',
    goal: 'Vytvoř sérii 5 obrázků jednoho fiktivního hrdiny v různých scénách se sjednoceným stylem.',
    maxImages: 5,
    maxVideos: 0,
  },
  {
    id: 'short',
    name: 'Krátký klip',
    goal: 'Vygeneruj 3 záběry fiktivní postavy, z nejlepšího udělej video, počkej na něj a otevři v editoru ve formátu Reels.',
    maxImages: 3,
    maxVideos: 1,
  },
];

const fieldClass =
  'px-3 py-2 bg-slate-900 border border-slate-600 rounded text-white focus:outline-none focus:border-blue-400 w-20';

export default function AgentPanel() {
  const { characterImageId, gems, lastImageCost, catalog, templates, saveTemplate, removeTemplate } = useStudio();
  const [confirming, setConfirming] = useState(false);
  const [goal, setGoal] = useState('');
  const [maxImages, setMaxImages] = useState(4);
  const [maxVideos, setMaxVideos] = useState(1);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [running, setRunning] = useState(false);
  const abort = useRef<AbortController | null>(null);

  // Rough ceiling: the real price of a video depends on its options.
  const voice = catalog?.video?.['v4-voice']?.gems;
  const videoCost = voice ? Math.min(...Object.values(voice).map((g) => g.base)) : null;
  const estimate =
    lastImageCost !== null && (maxVideos === 0 || videoCost !== null)
      ? Math.round(maxImages * lastImageCost + maxVideos * (videoCost ?? 0))
      : null;

  const start = async () => {
    if (!goal.trim() || running) return;
    setConfirming(false);
    setEvents([]);
    setRunning(true);
    abort.current = new AbortController();
    await runAgent(
      goal.trim() + (characterImageId ? '\n(Uživatel zvolil AI postavu: use_character=true je k dispozici.)' : ''),
      { maxImages, maxVideos },
      (e) => setEvents((prev) => [...prev, e]),
      abort.current.signal
    );
    setRunning(false);
  };

  return (
    <div className="max-w-3xl mx-auto bg-slate-800 border border-slate-700 rounded-lg p-6 space-y-4">
      <h2 className="text-lg font-bold text-white flex items-center gap-2">
        <Bot size={20} /> Autonomní agent (Grok)
      </h2>
      <p className="text-sm text-slate-400">
        Zadej cíl, agent sám vygeneruje obrázky a videa. Gemy: {gems}. Postava: {characterImageId ? 'zvolena' : 'žádná'}.
      </p>
      <textarea
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        disabled={running}
        placeholder="Např. Vytvoř sérii 3 obrázků fiktivní cestovatelky v horách při západu slunce a z nejlepšího udělej video."
        className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded text-white placeholder-slate-500 focus:outline-none focus:border-blue-400 resize-none h-28"
      />
      <div className="flex flex-wrap items-center gap-2">
        {[...DEFAULT_TEMPLATES, ...templates].map((t) => (
          <span key={t.id} className="flex items-center gap-1 px-2 py-1 rounded bg-slate-700 text-xs text-white">
            <button
              type="button"
              disabled={running}
              onClick={() => {
                setGoal(t.goal);
                setMaxImages(t.maxImages);
                setMaxVideos(t.maxVideos);
                setConfirming(false);
              }}
            >
              {t.name}
            </button>
            {templates.some((x) => x.id === t.id) && (
              <button type="button" onClick={() => removeTemplate(t.id)} aria-label={`Smazat ${t.name}`}>
                <Trash2 className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}
        <button
          type="button"
          disabled={!goal.trim() || running}
          onClick={() => {
            const name = window.prompt('Název šablony?');
            if (name?.trim()) saveTemplate({ id: `${Date.now()}`, name: name.trim(), goal: goal.trim(), maxImages, maxVideos });
          }}
          className="flex items-center gap-1 px-2 py-1 rounded border border-slate-600 text-xs text-slate-300 disabled:opacity-50"
        >
          <Save className="w-3 h-3" /> Uložit jako šablonu
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm text-slate-300">
        <label className="flex items-center gap-2">
          Max obrázků
          <input type="number" min={0} max={20} value={maxImages} onChange={(e) => setMaxImages(+e.target.value)} className={fieldClass} />
        </label>
        <label className="flex items-center gap-2">
          Max videí
          <input type="number" min={0} max={5} value={maxVideos} onChange={(e) => setMaxVideos(+e.target.value)} className={fieldClass} />
        </label>
        {running ? (
          <button onClick={() => abort.current?.abort()} className="ml-auto flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold px-4 py-2 rounded">
            <Square size={16} /> Zastavit
          </button>
        ) : (
          <button
            onClick={() => (confirming ? start() : setConfirming(true))}
            disabled={!goal.trim() || (estimate !== null && estimate > gems)}
            className="ml-auto flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded"
          >
            {confirming ? 'Potvrdit a spustit' : 'Spustit agenta'}
          </button>
        )}
      </div>

      {confirming && !running && (
        <p className="text-sm text-yellow-200 bg-yellow-900/30 rounded p-3">
          Limity: max {maxImages} obr. + {maxVideos} videí.{' '}
          {estimate !== null
            ? `Orientační strop ~${estimate} gemů (na účtu ${gems}).`
            : 'Cena zatím není známa (vygeneruj jeden obrázek), horní hranice se hlídá počtem kusů.'}{' '}
          Potvrď tlačítkem.
        </p>
      )}
      {estimate !== null && estimate > gems && (
        <p role="alert" className="text-sm text-red-300">Odhad {estimate} gemů převyšuje zůstatek {gems}. Sniž limity.</p>
      )}

      <div className="space-y-2">
        {events.map((e, i) => (
          <div
            key={i}
            className={`text-sm rounded p-3 whitespace-pre-wrap ${
              e.type === 'assistant'
                ? 'bg-slate-700 text-white'
                : e.type === 'tool'
                  ? 'bg-slate-900 border border-slate-700 text-slate-300 font-mono'
                  : 'bg-red-900/40 text-red-200'
            }`}
          >
            {e.type === 'assistant' && e.text}
            {e.type === 'tool' && `▶ ${e.name}(${JSON.stringify(e.args)})\n${e.result}`}
            {e.type === 'error' && e.text}
          </div>
        ))}
        {running && (
          <div className="flex items-center gap-2 text-slate-400 text-sm">
            <Loader className="animate-spin" size={16} /> Agent pracuje…
          </div>
        )}
      </div>
    </div>
  );
}
