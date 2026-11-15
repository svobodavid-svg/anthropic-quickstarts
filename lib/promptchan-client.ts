import { supabase } from './supabase';

/**
 * Client for the Promptchan API v2.1.
 *
 * Images, chat, the catalog and the account live on one host; every video endpoint lives
 * on another (the relay picks the host). The same key works on both. The key the user
 * entered in Settings is sent per request and never stored on the server.
 */

// Promptchan sends no CORS headers, so browsers cannot call it directly. Requests go to the
// studio's own /api/pc relay, which forwards them (video endpoints to their own host).
const MAIN_HOST = '/api/pc';
const VIDEO_HOST = '/api/pc';

export type Aspect = 'Portrait' | 'Wide' | 'Square';
export type VideoModel = 'auto' | 'v4' | 'v4-voice';

export interface CatalogImageModel {
  name: string;
  engine: 'standard' | 'flame' | string;
  min_plan: string;
  allowed: boolean;
  available: boolean;
  qualities: string[];
  aspects: Aspect[];
  max_images: number;
  character_versions: string[];
  filters: string[];
}

export interface Catalog {
  plan: string;
  image_models: CatalogImageModel[];
  poses: Record<string, string[]>;
  emotions: string[];
  video: {
    models: VideoModel[];
    v4: { aspects: Aspect[]; qualities: string[]; loop: boolean };
    'v4-voice': {
      aspects: Aspect[];
      lengths: number[];
      fps: number[];
      resolutions: string[];
      camera_moves: string[];
      dialogue_speakers: string[];
      dialogue_tones: string[];
      dialogue_accents: string[];
      gems: Record<string, { base: number; fps_48: number; high_resolution: number }>;
      extend_gems: number;
    };
  };
  chat_models: string[];
}

export interface Account {
  plan: string;
  gems: number;
  limits?: { requests_at_once: number | null; video_submits_per_minute: number };
}

export interface ImageRequest {
  model: string;
  prompt: string;
  negative_prompt?: string;
  poses?: string[];
  filter?: string;
  emotion?: string;
  quality?: string;
  aspect?: Aspect;
  count?: number;
  seed?: number;
  save_to_gallery?: boolean;
  /** AI Character: one of the account's own saved images. */
  character_image_id?: string;
  character_version?: string;
}

export interface ImageResponse {
  image: string | null;
  images: string[];
  image_urls: string[];
  image_ids: string[];
  saved: boolean;
  model: string;
  seed: number;
  gems_cost: number;
  gems: number;
}

export interface VideoRequest {
  video_model: VideoModel;
  prompt?: string;
  aspect?: Aspect;
  model?: string;
  pose?: string;
  image_id?: string;
  /** From text: keep the look of a saved image's character. */
  character_image_id?: string;
  quality?: 'Standard' | 'High';
  loop?: boolean;
  audio?: boolean;
  dialogue?: string;
  dialogue_speaker?: string;
  dialogue_tone?: string;
  dialogue_accent?: string;
  camera_move?: string;
  length?: number;
  fps?: number;
  resolution?: string;
}

export interface ExtendRequest {
  video_id: string;
  mode?: 'continue' | 'change';
  pose?: string;
  motion_prompt?: string;
  dialogue?: string;
}

export interface VideoStatus {
  progress?: number; // 0 to 1
  initial_queue_length?: number;
  current_queue_length?: number;
  status?: string;
  failure_reason?: string;
}

export interface VideoResult {
  status: string; // "processing" | "success" | ...
  video?: string[];
  video_id?: string;
  gems?: number;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  message: string;
  isRoleplay: boolean;
  characterData: {
    name: string;
    personality: string;
    scenario: string;
    sexuality: string;
    openness: number;
    emotions: number;
    age?: number;
    gender?: string;
  };
  chatHistory?: ChatTurn[];
  userName?: string;
  redo?: boolean;
  model?: string;
}

export interface ChatResponse {
  message: string;
  chatHistory: ChatTurn[];
  gems: number;
  model: string;
}

/** Every API failure has the same shape; `code` is the stable part. */
export class PromptchanError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean,
    public status: number,
    public retryAfterSeconds?: number,
    public gems?: number
  ) {
    super(message);
    this.name = 'PromptchanError';
  }
}

const CZECH_MESSAGES: Record<string, string> = {
  missing_api_key: 'Chybí API klíč.',
  invalid_api_key: 'API klíč není platný.',
  insufficient_gems: 'Nemáte dost gemů.',
  plan_restricted: 'Tohle váš tarif nezahrnuje.',
  subscription_inactive: 'Předplatné není aktivní.',
  content_blocked: 'Zadání bylo odmítnuto kontrolou obsahu.',
  restricted_image: 'Obrázek nelze uložit ani použít (kontrola obsahu).',
  character_image_restricted: 'Tento obrázek nelze použít jako postavu.',
  rate_limited: 'Video lze odeslat jen jednou za minutu.',
  too_many_requests: 'Běží příliš mnoho generování najednou.',
  model_warming: 'Model se právě spouští, zkuste to za chvíli.',
  model_unavailable: 'Model teď není dostupný.',
  queue_full: 'Fronta je plná, zkuste to později.',
  generation_backend_failed: 'Generování selhalo na straně služby, gemy byly vráceny.',
  network: 'Službu se nepodařilo kontaktovat. Zkontrolujte připojení.',
};

/** A message for people: Czech where the code is known, the service's own text otherwise. */
export const describeError = (error: unknown): string => {
  if (error instanceof PromptchanError) {
    const base = CZECH_MESSAGES[error.code] ?? error.message;
    return error.retryAfterSeconds ? `${base} Zkuste to za ${error.retryAfterSeconds} s.` : base;
  }
  return error instanceof Error ? error.message : 'Neznámá chyba';
};

export class PromptchanClient {
  constructor(private apiKey: string) {}

  private async request<T>(host: string, path: string, body?: unknown, query?: string): Promise<T> {
    let response: Response;
    try {
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      response = await fetch(`${host}${path}${query ?? ''}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: {
          'x-api-key': this.apiKey,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new PromptchanError('Network error', 'network', true, 0);
    }

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      const retryAfter = Number(response.headers.get('Retry-After')) || data?.seconds;
      throw new PromptchanError(
        data?.error ?? `HTTP ${response.status}`,
        data?.code ?? 'unknown',
        !!data?.retryable,
        response.status,
        retryAfter || undefined,
        data?.gems
      );
    }
    return data as T;
  }

  /** Models, poses, filters and video options as this account sees them. */
  getCatalog() {
    return this.request<Catalog>(MAIN_HOST, '/api/external/catalog');
  }

  getAccount() {
    return this.request<Account>(MAIN_HOST, '/api/external/account');
  }

  generateImage(params: ImageRequest) {
    return this.request<ImageResponse>(MAIN_HOST, '/api/external/create', params);
  }

  submitVideo(params: VideoRequest) {
    return this.request<{ request_id: string; video_model: string }>(
      VIDEO_HOST,
      '/api/external/video_v4/submit',
      params
    );
  }

  extendVideo(params: ExtendRequest) {
    return this.request<{ request_id: string }>(VIDEO_HOST, '/api/external/video_v4/extend', params);
  }

  getVideoStatus(requestId: string) {
    return this.request<VideoStatus>(
      VIDEO_HOST,
      `/api/external/video_v4/status_with_logs/${encodeURIComponent(requestId)}`
    );
  }

  getVideoResult(requestId: string) {
    return this.request<VideoResult>(
      VIDEO_HOST,
      `/api/external/video_v4/result/${encodeURIComponent(requestId)}`
    );
  }

  chat(params: ChatRequest) {
    return this.request<ChatResponse>(MAIN_HOST, '/api/external/chat', params);
  }
}

export const createClient = (apiKey: string) => new PromptchanClient(apiKey);
