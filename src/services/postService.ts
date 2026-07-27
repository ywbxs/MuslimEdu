import { API_BASE_URL, absoluteUrl } from '../config/api';

export type PostPrivacy = 'public' | 'school' | 'private';

export interface PostAuthor {
  id: number;
  name: string;
  photo: string | null;
  /** Present when the backend includes it; drives the Teacher/Admin tag next to the name. */
  role?: string | null;
}

export interface PostComment {
  id: number;
  parent_id: number | null;
  content: string;
  created_at: string;
  author: PostAuthor | null;
  likes_count: number;
  is_liked: boolean;
  replies: PostComment[];
}

export interface UserProfile {
  profile: PostAuthor | null;
  posts: Post[];
  nextBeforeId: number | null;
  hasMore: boolean;
}

export interface RepostOf {
  id: number;
  content: string | null;
  created_at: string;
  author: PostAuthor | null;
  images: string[];
}

export interface Post {
  id: number;
  content: string | null;
  privacy: PostPrivacy;
  created_at: string;
  author: PostAuthor | null;
  images: string[];
  likes_count: number;
  comments_count: number;
  reposts_count: number;
  is_liked: boolean;
  is_mine: boolean;
  repost_of: RepostOf | null;
}

export interface PickedImage {
  uri: string;
  fileName?: string | null;
  type?: string | null;
}

const DEFAULT_TIMEOUT_MS = 15000;
const UPLOAD_TIMEOUT_MS = 45000;

async function authedPost(path: string, token: string, body: FormData | Record<string, any> = {}) {
  const isFormData = body instanceof FormData;
  const controller = new AbortController();
  const timeoutMs = isFormData ? UPLOAD_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        Authorization: `Bearer ${token}`,
      },
      body: isFormData ? body : JSON.stringify(body),
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

// Backend returns image paths relative to the public asset base - resolve
// them the same way every other screen in the app does before rendering.
function normalizePost(raw: any): Post {
  return {
    ...raw,
    images: (raw.images ?? []).map((p: string) => absoluteUrl(p)).filter(Boolean),
    author: raw.author
      ? { ...raw.author, photo: absoluteUrl(raw.author.photo) }
      : null,
    repost_of: raw.repost_of
      ? {
          ...raw.repost_of,
          images: (raw.repost_of.images ?? []).map((p: string) => absoluteUrl(p)).filter(Boolean),
          author: raw.repost_of.author
            ? { ...raw.repost_of.author, photo: absoluteUrl(raw.repost_of.author.photo) }
            : null,
        }
      : null,
  };
}

function normalizeComment(raw: any): PostComment {
  return {
    ...raw,
    likes_count: raw.likes_count ?? 0,
    is_liked: !!raw.is_liked,
    author: raw.author ? { ...raw.author, photo: absoluteUrl(raw.author.photo) } : null,
    replies: (raw.replies ?? []).map(normalizeComment),
  };
}

/** POST /post_feed - pass beforeId to load the next older page */
export async function fetchFeed(
  token: string,
  beforeId?: number,
): Promise<{ posts: Post[]; nextBeforeId: number | null; hasMore: boolean }> {
  const data = await authedPost('/post_feed', token, beforeId ? { before_id: beforeId } : {});
  return {
    posts: (data.posts ?? []).map(normalizePost),
    nextBeforeId: data.next_before_id ?? null,
    hasMore: !!data.has_more,
  };
}

/** POST /post_create (multipart) - content and/or up to 6 images */
export async function createPost(
  token: string,
  fields: { content?: string; privacy: PostPrivacy },
  images: PickedImage[] = [],
): Promise<Post> {
  const form = new FormData();
  if (fields.content) form.append('content', fields.content);
  form.append('privacy', fields.privacy);

  images.forEach((img, index) => {
    // @ts-ignore - React Native's FormData accepts this shape for file uploads
    form.append('images[]', {
      uri: img.uri,
      name: img.fileName ?? `photo_${index}.jpg`,
      type: img.type ?? 'image/jpeg',
    });
  });

  const data = await authedPost('/post_create', token, form);
  return normalizePost(data.post);
}

/** POST /post_delete - author only */
export async function deletePost(token: string, postId: number): Promise<void> {
  await authedPost('/post_delete', token, { post_id: postId });
}

/** POST /post_update - author only. Edits a post's text and/or privacy. */
export async function updatePost(
  token: string,
  postId: number,
  fields: { content?: string; privacy?: PostPrivacy },
): Promise<Post> {
  const data = await authedPost('/post_update', token, { post_id: postId, ...fields });
  return normalizePost(data.post);
}

/** POST /post_update - author only. Changes just the privacy of a post. */
export async function updatePostPrivacy(
  token: string,
  postId: number,
  privacy: PostPrivacy,
): Promise<Post> {
  const data = await authedPost('/post_update', token, { post_id: postId, privacy });
  return normalizePost(data.post);
}

/** POST /post_like_toggle - re-tapping removes the heart */
export async function toggleLike(
  token: string,
  postId: number,
): Promise<{ isLiked: boolean; likesCount: number }> {
  const data = await authedPost('/post_like_toggle', token, { post_id: postId });
  return { isLiked: !!data.is_liked, likesCount: data.likes_count ?? 0 };
}

/** POST /post_comment_list */
export async function fetchComments(token: string, postId: number): Promise<PostComment[]> {
  const data = await authedPost('/post_comment_list', token, { post_id: postId });
  return (data.comments ?? []).map(normalizeComment);
}

/** POST /post_comment_create - pass parentId to reply to a top-level comment */
export async function addComment(
  token: string,
  postId: number,
  content: string,
  parentId?: number,
): Promise<{ comment: PostComment; commentsCount: number; parentId: number | null }> {
  const data = await authedPost('/post_comment_create', token, {
    post_id: postId,
    content,
    ...(parentId ? { parent_id: parentId } : {}),
  });
  return {
    comment: normalizeComment(data.comment),
    commentsCount: data.comments_count ?? 0,
    parentId: data.parent_id ?? null,
  };
}

/** POST /post_comment_delete - author only */
export async function deleteComment(token: string, commentId: number): Promise<void> {
  await authedPost('/post_comment_delete', token, { comment_id: commentId });
}

/** POST /post_comment_like_toggle - re-tapping removes the heart */
export async function toggleCommentLike(
  token: string,
  commentId: number,
): Promise<{ isLiked: boolean; likesCount: number }> {
  const data = await authedPost('/post_comment_like_toggle', token, { comment_id: commentId });
  return { isLiked: !!data.is_liked, likesCount: data.likes_count ?? 0 };
}

/**
 * POST /profile_feed - a user's own posts + reposts (reposts never show in
 * the main feed - this is the only place they appear, same as "check their
 * profile to see what they reposted").
 */
export async function fetchUserProfile(
  token: string,
  userId: number,
  beforeId?: number,
): Promise<UserProfile> {
  const data = await authedPost('/profile_feed', token, {
    user_id: userId,
    ...(beforeId ? { before_id: beforeId } : {}),
  });
  return {
    profile: data.profile ? { ...data.profile, photo: absoluteUrl(data.profile.photo) } : null,
    posts: (data.posts ?? []).map(normalizePost),
    nextBeforeId: data.next_before_id ?? null,
    hasMore: !!data.has_more,
  };
}

/** POST /post_repost - optional quote text + optional privacy override */
export async function repost(
  token: string,
  postId: number,
  content?: string,
  privacy: PostPrivacy = 'school',
): Promise<Post> {
  const data = await authedPost('/post_repost', token, { post_id: postId, content, privacy });
  return normalizePost(data.post);
}
