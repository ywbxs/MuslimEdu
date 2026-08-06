import { API_BASE_URL, absoluteUrl } from '../config/api';
import { cacheKeyFor, cacheThenNetwork } from '../utils/offlineCache';

const CACHE_PREFIX = '@chat_cache_v1';

export interface ChatThread {
  thread_id: number;
  user_id: number;
  name: string;
  photo: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
}

export interface ChatMessage {
  id: number;
  message: string;
  is_mine: boolean;
  created_at: string;
}

export interface ChatUser {
  user_id: number;
  name: string;
  photo: string | null;
}

// Same shape as the other admin*Service.ts files - JSON POST, longer
// timeout isn't needed here since chat never uploads files.
const DEFAULT_TIMEOUT_MS = 15000;

async function authedPost(path: string, token: string, body: Record<string, any> = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Request timed out. Check your connection and try again.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message ?? `Request failed (${response.status})`);
  }

  return data;
}

function normalizeThread(raw: any): ChatThread {
  return {
    thread_id: raw.thread_id,
    user_id: raw.user_id,
    name: raw.name ?? '',
    photo: absoluteUrl(raw.photo ?? null),
    last_message: raw.last_message ?? null,
    last_message_at: raw.last_message_at ?? null,
    unread_count: raw.unread_count ?? 0,
  };
}

/** POST /message_thread_list - every conversation the current user is in */
export async function fetchThreadList(token: string): Promise<ChatThread[]> {
  return cacheThenNetwork(cacheKeyFor(CACHE_PREFIX, token, 'threads'), async () => {
    const data = await authedPost('/message_thread_list', token, {});
    const rawList: any[] = data.threads ?? [];
    return rawList.map(normalizeThread);
  });
}

/** POST /message_thread_start - find-or-create a thread without sending yet */
export async function startThread(token: string, userId: number): Promise<number> {
  const data = await authedPost('/message_thread_start', token, { reciver_id: userId });
  return data.thread_id;
}

/**
 * POST /message_chat_list - full history, or only messages newer than
 * afterId when polling. Also marks anything addressed to me as read.
 */
// Only the full history load (no afterId) is cache-then-network - a polling
// delta fetch (afterId set) that fails offline should just no-op/retry next
// poll, not get served a stale delta pretending to be the newest messages.
export async function fetchChatMessages(
  token: string,
  threadId: number,
  afterId?: number,
): Promise<ChatMessage[]> {
  const load = async () => {
    const data = await authedPost('/message_chat_list', token, {
      thread_id: threadId,
      ...(afterId ? { after_id: afterId } : {}),
    });
    return data.chats ?? [];
  };
  if (afterId) return load();
  return cacheThenNetwork(cacheKeyFor(CACHE_PREFIX, token, 'messages', threadId), load);
}

/**
 * POST /message_chat_send - pass threadId once you have one, or userId to
 * find-or-create the thread on send (first message to someone new).
 */
export async function sendMessage(
  token: string,
  params: { threadId?: number; userId?: number; message: string },
): Promise<{ thread_id: number; chat: ChatMessage }> {
  const body: Record<string, any> = { message: params.message };
  if (params.threadId) body.thread_id = params.threadId;
  if (params.userId) body.reciver_id = params.userId;

  return authedPost('/message_chat_send', token, body);
}

/** POST /message_user_search - find someone in your school to message */
export async function searchUsers(token: string, query: string): Promise<ChatUser[]> {
  const data = await authedPost('/message_user_search', token, { query });
  const rawList: any[] = data.users ?? [];
  return rawList.map((u) => ({
    user_id: u.user_id,
    name: u.name ?? '',
    photo: absoluteUrl(u.photo ?? null),
  }));
}
