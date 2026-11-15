/**
 * Autonomous agent: Grok (through /api/grok, key kept on the server) plans, and this
 * module executes its tool calls against the Promptchan API with the user's own key.
 * Hard per-run limits protect the Gems balance.
 */
import { useStudio } from './store';
import { createClient, describeError, type Aspect } from './promptchan-client';
import { supabase } from './supabase';

export interface AgentLimits {
  maxImages: number;
  maxVideos: number;
}

export type AgentEvent =
  | { type: 'assistant'; text: string }
  | { type: 'tool'; name: string; args: Record<string, unknown>; result: string }
  | { type: 'error'; text: string };

interface Msg {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: { id: string; type: 'function'; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}

const SYSTEM = `Jsi produkční agent Multimedia Studia. Uživatel zadá cíl; ty ho splníš voláním nástrojů.
Postup: stručně naplánuj, pak volej nástroje (nejdřív get_account, pokud jde o víc než jeden výstup), nakonec shrň, co vzniklo.
Pokud uživatel chce hotový střih, po vygenerování zavolej await_videos a jako POSLEDNÍ krok open_in_editor (otevře editor, další nástroje už nevolej).
Pravidla:
- Tvoř jen fiktivní/původní postavy. Nikdy neprosaď podobu skutečné osoby ani nezletilé postavy.
- Respektuj limity běhu; když je nástroj odmítne, neobcházej je, ale řekni to.
- Pro konzistenci osoby použij nástroje s postavou (use_character=true), pokud ji uživatel zvolil.
- Odpovídej česky, věcně, bez omáček.`;

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_account',
      description: 'Vrátí plán a zbývající gemy účtu.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_gallery',
      description: 'Posledních 10 obrázků v galerii (id uložených obrázků lze použít pro animaci nebo jako postavu).',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_image',
      description: 'Vygeneruje jeden obrázek a uloží ho do galerie.',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Anglický popis obrázku' },
          aspect: { type: 'string', enum: ['Portrait', 'Wide', 'Square'] },
          use_character: { type: 'boolean', description: 'Zachovat vybranou AI postavu' },
        },
        required: ['prompt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'generate_video',
      description:
        'Odešle generování videa (hotové se objeví v záložce Videa). Buď z textu, nebo z uloženého obrázku (image_id).',
      parameters: {
        type: 'object',
        properties: {
          prompt: { type: 'string', description: 'Anglický popis pohybu/scény' },
          image_id: { type: 'string', description: 'id uloženého obrázku k rozpohybování' },
          aspect: { type: 'string', enum: ['Portrait', 'Wide', 'Square'] },
          use_character: { type: 'boolean' },
        },
        required: ['prompt'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'await_videos',
      description: 'Počká (až 6 minut), než se dokončí videa odeslaná v tomto běhu, a vrátí jejich stav.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'open_in_editor',
      description:
        'POSLEDNÍ krok: otevře výsledek v editoru a nastaví formát. what=video otevře první hotové video z běhu, what=images všechny obrázky z běhu (složí se do videa).',
      parameters: {
        type: 'object',
        properties: {
          what: { type: 'string', enum: ['video', 'images'] },
          preset: { type: 'string', enum: ['reel', 'youtube', 'post', 'square'] },
        },
        required: ['what'],
      },
    },
  },
];

async function callGrok(messages: Msg[]) {
  const token = (await supabase?.auth.getSession())?.data.session?.access_token;
  const res = await fetch('/api/grok', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ messages, tools: TOOLS }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data.choices?.[0]?.message as Msg;
}

export async function runAgent(
  goal: string,
  limits: AgentLimits,
  emit: (e: AgentEvent) => void,
  signal: AbortSignal
) {
  const used = { images: 0, videos: 0 };
  const made = { imageUrls: [] as string[], videoIds: [] as string[] };
  const messages: Msg[] = [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: `${goal}\n\nLimity tohoto běhu: max ${limits.maxImages} obrázků, max ${limits.maxVideos} videí.` },
  ];

  const execute = async (name: string, args: any): Promise<string> => {
    const store = useStudio.getState();
    const client = createClient(store.apiKey);
    const character = args.use_character ? store.characterImageId : null;

    switch (name) {
      case 'get_account': {
        const acc = await client.getAccount();
        store.setAccount(acc);
        return JSON.stringify({ plan: acc.plan, gems: acc.gems });
      }
      case 'list_gallery':
        return JSON.stringify(
          store.images.slice(0, 10).map((i) => ({ image_id: i.imageId ?? null, prompt: i.prompt.slice(0, 80) }))
        );
      case 'generate_image': {
        if (used.images >= limits.maxImages) return 'ODMÍTNUTO: limit obrázků pro tento běh vyčerpán.';
        const model =
          store.catalog?.image_models?.find((m) => m.allowed && m.available) ?? null;
        const aspect: Aspect = model?.aspects.includes(args.aspect) ? args.aspect : model?.aspects[0] ?? 'Portrait';
        const useChar = character && model && model.character_versions.length > 0;
        const result = await client.generateImage({
          model: model?.name ?? 'Default',
          prompt: String(args.prompt),
          aspect,
          save_to_gallery: true,
          ...(useChar
            ? {
                character_image_id: character!,
                character_version: model!.character_versions.includes('v2') ? 'v2' : model!.character_versions[0],
              }
            : {}),
        });
        used.images++;
        if (typeof result.gems_cost === 'number') store.setLastImageCost(result.gems_cost);
        const urls = result.image_urls?.length
          ? result.image_urls
          : (result.images?.length ? result.images : result.image ? [result.image] : []).map(
              (d) => `data:image/jpeg;base64,${d}`
            );
        made.imageUrls.push(...urls);
        urls.forEach((url, i) =>
          store.addImage({
            id: `${Date.now()}-a${i}`,
            url,
            prompt: String(args.prompt),
            timestamp: Date.now(),
            params: { model: result.model, aspect, seed: result.seed, agent: true },
            imageId: result.image_ids?.[i],
            saved: result.saved,
          })
        );
        if (typeof result.gems === 'number') store.setGems(result.gems);
        return JSON.stringify({ ok: urls.length > 0, image_id: result.image_ids?.[0] ?? null, gems_left: result.gems });
      }
      case 'generate_video': {
        if (used.videos >= limits.maxVideos) return 'ODMÍTNUTO: limit videí pro tento běh vyčerpán.';
        const request = {
          video_model: 'auto' as const,
          prompt: String(args.prompt),
          ...(args.image_id
            ? { image_id: String(args.image_id) }
            : {
                aspect: (['Portrait', 'Wide', 'Square'].includes(args.aspect) ? args.aspect : 'Portrait') as Aspect,
                ...(character ? { character_image_id: character } : {}),
              }),
        };
        const r = await client.submitVideo(request);
        used.videos++;
        const vid = `${Date.now()}`;
        made.videoIds.push(vid);
        store.addVideo({
          id: vid,
          requestId: r.request_id,
          prompt: String(args.prompt),
          timestamp: Date.now(),
          status: 'pending',
          progress: 0,
          params: request,
        });
        return JSON.stringify({ queued: true, note: 'Video se objeví v záložce Videa.' });
      }
      case 'await_videos': {
        if (made.videoIds.length === 0) return 'V tomto běhu nebylo odesláno žádné video.';
        const deadline = Date.now() + 6 * 60_000;
        const state = () =>
          useStudio.getState().videos.filter((v) => made.videoIds.includes(v.id));
        while (Date.now() < deadline && !signal.aborted) {
          if (state().every((v) => v.status === 'completed' || v.status === 'failed')) break;
          await new Promise((r) => setTimeout(r, 5000));
        }
        return JSON.stringify(
          state().map((v) => ({ status: v.status, progress: v.progress ?? 0, ready: v.status === 'completed', failure: v.failureReason ?? null }))
        );
      }
      case 'open_in_editor': {
        const preset = ['reel', 'youtube', 'post', 'square'].includes(args.preset) ? args.preset : null;
        if (args.what === 'video') {
          const done = useStudio.getState().videos.find((v) => made.videoIds.includes(v.id) && v.status === 'completed' && v.urls?.length);
          if (!done) return 'Žádné hotové video z tohoto běhu.';
          store.openVideoInEditor(done.urls![0], preset);
          return 'Otevřeno v editoru.';
        }
        if (made.imageUrls.length === 0) return 'Žádné obrázky z tohoto běhu.';
        store.openImagesInEditor(made.imageUrls, preset);
        return 'Obrázky otevřeny v editoru.';
      }
      default:
        return `Neznámý nástroj ${name}`;
    }
  };

  for (let step = 0; step < 10; step++) {
    if (signal.aborted) return;
    let reply: Msg;
    try {
      reply = await callGrok(messages);
    } catch (e: any) {
      emit({ type: 'error', text: e.message ?? String(e) });
      return;
    }
    messages.push(reply);
    if (reply.content) emit({ type: 'assistant', text: reply.content });
    if (!reply.tool_calls?.length) return;

    for (const call of reply.tool_calls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || '{}');
      } catch {
        /* model sent malformed JSON: run with no arguments, the tool reports what is missing */
      }
      let result: string;
      try {
        result = await execute(call.function.name, args);
      } catch (e) {
        result = `CHYBA: ${describeError(e)}`;
      }
      emit({ type: 'tool', name: call.function.name, args, result });
      messages.push({ role: 'tool', tool_call_id: call.id, content: result });
    }
  }
  emit({ type: 'error', text: 'Agent dosáhl limitu 10 kroků.' });
}
