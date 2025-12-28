import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  RefreshControl,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { messagesService, DMConversation, UserSearchResult } from '@/services/messages';
import { Conversation } from '@/services/messages';
import { useAuth } from '@/src/context/AuthContext';
import { useThemeColors } from '@/hooks';
import { SPACING, FONTS, BORDER_RADIUS } from '@/constants';

export default function MessagesListScreen() {
  const colors = useThemeColors();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Fetch listing-based conversations
  const { data: listingConversations = [], refetch: refetchListing, isRefetching: isRefetchingListing } = useQuery({
    queryKey: ['conversations'],
    queryFn: () => messagesService.getConversations(),
    enabled: !!user,
  });

  // Fetch DM conversations
  const { data: dmConversations = [], refetch: refetchDM, isRefetching: isRefetchingDM } = useQuery({
    queryKey: ['dm-conversations'],
    queryFn: () => messagesService.getDMConversations(),
    enabled: !!user,
  });

  // Search users with debounce
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await messagesService.searchUsers(searchQuery);
        // Filter out current user
        setSearchResults(results.filter(u => u.id !== user?.id));
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, user?.id]);

  const onRefresh = async () => {
    await Promise.all([refetchListing(), refetchDM()]);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString();
  };

  const renderSearchResult = ({ item }: { item: UserSearchResult }) => (
    <TouchableOpacity
      style={[styles.searchResultItem, { backgroundColor: colors.surface }]}
      onPress={() => {
        setShowSearch(false);
        setSearchQuery('');
        router.push(`/messages/dm/${item.id}`);
      }}
    >
      <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
        <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.searchResultInfo}>
        <Text style={[styles.searchResultName, { color: colors.text }]}>{item.name}</Text>
        {item.handle && (
          <Text style={[styles.searchResultHandle, { color: colors.textMuted }]}>@{item.handle}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderDMItem = ({ item }: { item: DMConversation }) => {
    const timeAgo = formatTimeAgo(item.last_message_at);

    return (
      <TouchableOpacity
        style={[styles.itemCard, { backgroundColor: colors.surface }]}
        onPress={() => router.push(`/messages/dm/${item.user_id}`)}
      >
        <View style={[styles.dmAvatar, { backgroundColor: colors.accent }]}>
          <Text style={styles.dmAvatarText}>{item.user_name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.itemInfo}>
          <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
            {item.user_name}
          </Text>
          {item.user_handle && (
            <Text style={[styles.itemHandle, { color: colors.textSecondary }]} numberOfLines={1}>
              @{item.user_handle}
            </Text>
          )}
          <Text style={[styles.lastMessage, { color: colors.textMuted }]} numberOfLines={1}>
            {item.last_message}
          </Text>
        </View>
        <View style={styles.messageRight}>
          <Text style={[styles.timeText, { color: colors.textMuted }]}>{timeAgo}</Text>
          {item.unread_count > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: colors.error }]}>
              <Text style={styles.unreadText}>{item.unread_count}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderListingItem = ({ item }: { item: Conversation }) => {
    const photo = item.listing_photos?.[0];
    const timeAgo = formatTimeAgo(item.last_message_at);

    return (
      <TouchableOpacity
        style={[styles.itemCard, { backgroundColor: colors.surface }]}
        onPress={() => router.push(`/messages/${item.listing_id}`)}
      >
        {photo ? (
          <Image source={{ uri: photo }} style={styles.itemImage} />
        ) : (
          <View style={[styles.itemImage, styles.placeholderImage, { backgroundColor: colors.border }]}>
            <Ionicons name="image-outline" size={24} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.itemInfo}>
          <Text style={[styles.itemTitle, { color: colors.text }]} numberOfLines={1}>
            {item.listing_title}
          </Text>
          <Text style={[styles.otherUser, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.other_user_name || item.curator_name}
          </Text>
          <Text style={[styles.lastMessage, { color: colors.textMuted }]} numberOfLines={1}>
            {item.last_message}
          </Text>
        </View>
        <View style={styles.messageRight}>
          <Text style={[styles.timeText, { color: colors.textMuted }]}>{timeAgo}</Text>
          {item.unread_count > 0 && (
            <View style={[styles.unreadBadge, { backgroundColor: colors.error }]}>
              <Text style={styles.unreadText}>{item.unread_count}</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.empty}>
      <Ionicons name="chatbubble-outline" size={64} color={colors.textMuted} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>No Messages Yet</Text>
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
        Start a conversation by tapping the compose button
      </Text>
    </View>
  );

  const hasConversations = dmConversations.length > 0 || listingConversations.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Messages</Text>
        <TouchableOpacity
          style={styles.composeButton}
          onPress={() => setShowSearch(!showSearch)}
        >
          <Ionicons
            name={showSearch ? 'close' : 'create-outline'}
            size={24}
            color={colors.text}
          />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      {showSearch && (
        <View style={[styles.searchContainer, { backgroundColor: colors.surface }]}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search by name or @handle..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            autoCapitalize="none"
            autoCorrect={false}
          />
          {isSearching && <ActivityIndicator size="small" color={colors.accent} />}
        </View>
      )}

      {/* Search Results */}
      {showSearch && searchQuery.length >= 2 && (
        <View style={styles.searchResults}>
          {searchResults.length > 0 ? (
            <FlatList
              data={searchResults}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderSearchResult}
              keyboardShouldPersistTaps="handled"
              style={{ maxHeight: 300 }}
            />
          ) : !isSearching ? (
            <View style={styles.noResults}>
              <Text style={[styles.noResultsText, { color: colors.textMuted }]}>
                No users found
              </Text>
            </View>
          ) : null}
        </View>
      )}

      {/* Conversations */}
      {!showSearch && (
        hasConversations ? (
          <FlatList
            data={[
              ...dmConversations.map(dm => ({ type: 'dm' as const, data: dm })),
              ...listingConversations.map(lc => ({ type: 'listing' as const, data: lc })),
            ].sort((a, b) => {
              const aTime = new Date(a.data.last_message_at).getTime();
              const bTime = new Date(b.data.last_message_at).getTime();
              return bTime - aTime;
            })}
            keyExtractor={(item, index) =>
              item.type === 'dm'
                ? `dm-${(item.data as DMConversation).user_id}`
                : `listing-${(item.data as Conversation).listing_id}`
            }
            renderItem={({ item }) =>
              item.type === 'dm'
                ? renderDMItem({ item: item.data as DMConversation })
                : renderListingItem({ item: item.data as Conversation })
            }
            contentContainerStyle={styles.list}
            refreshControl={
              <RefreshControl
                refreshing={isRefetchingListing || isRefetchingDM}
                onRefresh={onRefresh}
                tintColor={colors.accent}
              />
            }
          />
        ) : (
          renderEmpty()
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: FONTS.sizes.xl,
    fontWeight: 'bold',
  },
  composeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    paddingVertical: SPACING.xs,
  },
  searchResults: {
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.xs,
    gap: SPACING.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  searchResultHandle: {
    fontSize: FONTS.sizes.sm,
    marginTop: 2,
  },
  noResults: {
    padding: SPACING.lg,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: FONTS.sizes.md,
  },
  list: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    gap: SPACING.md,
  },
  itemImage: {
    width: 56,
    height: 56,
    borderRadius: BORDER_RADIUS.sm,
  },
  placeholderImage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  dmAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dmAvatarText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.xl,
    fontWeight: 'bold',
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  itemHandle: {
    fontSize: FONTS.sizes.sm,
    marginTop: 1,
  },
  otherUser: {
    fontSize: FONTS.sizes.sm,
    marginTop: 2,
  },
  lastMessage: {
    fontSize: FONTS.sizes.xs,
    marginTop: 2,
  },
  messageRight: {
    alignItems: 'flex-end',
    gap: SPACING.xs,
  },
  timeText: {
    fontSize: FONTS.sizes.xs,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.xs,
    fontWeight: 'bold',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: SPACING.xl,
  },
  emptyTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: 'bold',
    marginTop: SPACING.md,
  },
  emptyText: {
    fontSize: FONTS.sizes.md,
    textAlign: 'center',
    marginTop: SPACING.sm,
  },
});
