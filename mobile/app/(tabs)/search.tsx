import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { curatorsService } from '@/services';
import { useThemeColors } from '@/hooks';
import { SPACING, FONTS, BORDER_RADIUS } from '@/constants';
import { Curator } from '@/types';

// Custom debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

function CuratorCard({ curator }: { curator: Curator }) {
  const colors = useThemeColors();

  return (
    <TouchableOpacity
      style={[styles.curatorCard, { backgroundColor: colors.surface }]}
      onPress={() => router.push(`/curator/${curator.id}`)}
    >
      {curator.avatarUrl || curator.profilePhoto ? (
        <Image
          source={{ uri: curator.avatarUrl || curator.profilePhoto || '' }}
          style={styles.avatarImage}
        />
      ) : (
        <View
          style={[
            styles.avatar,
            { backgroundColor: colors.accent },
          ]}
        >
          <Text style={[styles.avatarText, { color: colors.background }]}>
            {curator.name.charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={styles.curatorInfo}>
        <Text style={[styles.curatorName, { color: colors.text }]}>
          {curator.handle ? `@${curator.handle}` : curator.name}
        </Text>
        {curator.handle && (
          <Text style={[styles.curatorSecondaryName, { color: colors.textSecondary }]}>
            {curator.name}
          </Text>
        )}
        {(curator.totalSales > 0 || curator.rating > 0) && (
          <Text style={[styles.curatorStats, { color: colors.textMuted }]}>
            {[
              curator.totalSales > 0 && `${curator.totalSales} sales`,
              curator.rating > 0 && `${curator.rating.toFixed(1)} rating`
            ].filter(Boolean).join(' • ')}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

export default function SearchScreen() {
  const colors = useThemeColors();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Server-side search with debounce
  const { data: curators, isLoading, isFetching } = useQuery({
    queryKey: ['curators', debouncedSearch],
    queryFn: () => curatorsService.getCurators({
      limit: 50,
      search: debouncedSearch || undefined
    }),
  });

  const curatorList = curators?.curators || [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Search</Text>
      </View>

      <View style={styles.searchContainer}>
        <View
          style={[
            styles.searchBar,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search by name or @handle..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {isFetching && searchQuery && (
            <ActivityIndicator size="small" color={colors.accent} />
          )}
          {searchQuery && !isFetching && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <FlatList
        data={curatorList}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <CuratorCard curator={item} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            {searchQuery ? 'Search Results' : 'Popular Curators'}
          </Text>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {isLoading ? 'Loading curators...' : searchQuery ? 'No curators found' : 'No curators yet'}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  title: {
    fontSize: FONTS.sizes.xxxl,
    fontWeight: 'bold',
  },
  searchContainer: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FONTS.sizes.md,
  },
  list: {
    padding: SPACING.lg,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.md,
  },
  curatorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
  },
  curatorInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  curatorName: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  curatorSecondaryName: {
    fontSize: FONTS.sizes.sm,
    marginTop: 1,
  },
  curatorStats: {
    fontSize: FONTS.sizes.sm,
    marginTop: 2,
  },
  empty: {
    paddingVertical: SPACING.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FONTS.sizes.md,
  },
});
