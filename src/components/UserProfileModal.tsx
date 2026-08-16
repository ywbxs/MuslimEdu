import React, { useCallback, useEffect, useState } from 'react';
import { Modal, View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { X } from 'lucide-react-native';
import UserAvatar from './UserAvatar';
import RoleTag from './RoleTag';
import PostCard from './PostCard';
import { useAuth } from '../context/AuthContext';
import {
  Post,
  PostAuthor,
  PostPrivacy,
  fetchUserProfile,
  toggleLike,
  repost as repostApi,
  deletePost,
  updatePostPrivacy,
} from '../services/postService';

import { COLORS } from '../theme/glass';

const EMERALD = COLORS.emerald;
const INK = COLORS.ink;
const SUBTLE = COLORS.subtle;
const HAIRLINE = COLORS.border;

function CloseIcon() {
  return <X color={INK} size={22} strokeWidth={2} />;
}

/**
 * The "stalk someone's profile" surface: tap an avatar anywhere in the app
 * (feed, comments, messages) and this comes up over everything else. Shows
 * who they are and their posts INCLUDING their reposts - reposts are
 * deliberately excluded from the main feed (see PostController::feed) so
 * this modal is the only place another person's reposts are visible.
 */
export default function UserProfileModal({
  userId,
  visible,
  onClose,
  onOpenComments,
  onOpenProfile,
}: {
  userId: number | null;
  visible: boolean;
  onClose: () => void;
  onOpenComments?: (post: Post) => void;
  onOpenProfile?: (userId: number) => void;
}) {
  const { token } = useAuth();
  const navigation = useNavigation();
  const [profile, setProfile] = useState<PostAuthor | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token || !userId) return;
    setLoading(true);
    try {
      const res = await fetchUserProfile(token, userId);
      setProfile(res.profile);
      setPosts(res.posts);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [token, userId]);

  useEffect(() => {
    if (visible) load();
    else {
      setPosts([]);
      setProfile(null);
    }
  }, [visible, load]);

  const handleToggleLike = async (post: Post) => {
    setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, is_liked: !p.is_liked, likes_count: p.likes_count + (p.is_liked ? -1 : 1) } : p)));
    if (!token) return;
    try {
      await toggleLike(token, post.id);
    } catch {
      load();
    }
  };

  const handleRepost = async (post: Post) => {
    if (!token) return;
    try {
      await repostApi(token, post.id);
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, reposts_count: p.reposts_count + 1 } : p)));
    } catch {
      // silent - the repost composer flow (if any) handles its own errors
    }
  };

  const handleDelete = async (post: Post) => {
    if (!token) return;
    setPosts((prev) => prev.filter((p) => p.id !== post.id));
    try {
      await deletePost(token, post.id);
    } catch {
      load();
    }
  };

  const handleEdit = (post: Post) => {
    onClose();
    (navigation as any).navigate('CreatePost', { editPost: post });
  };

  const handleChangePrivacy = async (post: Post, privacy: PostPrivacy) => {
    if (!token) return;
    const previousPrivacy = post.privacy;
    setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, privacy } : p)));
    try {
      await updatePostPrivacy(token, post.id, privacy);
    } catch {
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, privacy: previousPrivacy } : p)));
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View style={styles.flex}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <CloseIcon />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centerFill}>
            <ActivityIndicator color={EMERALD} />
          </View>
        ) : (
          <FlatList
            data={posts}
            keyExtractor={(item) => String(item.id)}
            ListHeaderComponent={
              <View style={styles.profileCard}>
                <UserAvatar name={profile?.name ?? '?'} photo={profile?.photo} size={84} dotColor={null} />
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{profile?.name ?? 'Unknown'}</Text>
                  <RoleTag role={profile?.role} />
                </View>
                <Text style={styles.subtitle}>{posts.length} post{posts.length === 1 ? '' : 's'}</Text>
              </View>
            }
            renderItem={({ item }) => (
              <PostCard
                post={item}
                onToggleLike={handleToggleLike}
                onPressComment={(p) => onOpenComments?.(p)}
                onPressRepost={handleRepost}
                onDelete={handleDelete}
                onEdit={handleEdit}
                onChangePrivacy={handleChangePrivacy}
                onPressAuthor={(id) => onOpenProfile?.(id)}
                onPressImage={(images, index) =>
                  (navigation as any).navigate('ImageViewer', { images, initialIndex: index })
                }
              />
            )}
            ListEmptyComponent={
              <View style={styles.centerFill}>
                <Text style={styles.emptyText}>No posts yet.</Text>
              </View>
            }
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: COLORS.canvas },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: HAIRLINE,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: INK },
  centerFill: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  emptyText: { color: SUBTLE, fontSize: 14 },
  profileCard: { alignItems: 'center', paddingVertical: 28, backgroundColor: COLORS.surface, borderBottomWidth: 8, borderBottomColor: COLORS.canvas },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  name: { fontSize: 19, fontWeight: '700', color: INK },
  subtitle: { fontSize: 13, color: SUBTLE, marginTop: 4 },
});
