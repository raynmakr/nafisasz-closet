import { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { searchService } from '@/services';
import { useThemeColors } from '@/hooks';
import { SPACING, FONTS, BORDER_RADIUS } from '@/constants';
import { Listing, Curator } from '@/types';
import { AutocompleteSuggestion, ParsedQuery } from '@/services/search';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = (SCREEN_WIDTH - SPACING.lg * 3) / 2;

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

function ProductCard({ listing }: { listing: Listing }) {
  const colors = useThemeColors();
  const price = listing.currentHighBid || listing.startingBid;

  return (
    <TouchableOpacity
      style={[styles.productCard, { backgroundColor: colors.surface }]}
      onPress={() => router.push(`/listing/${listing.id}`)}
    >
      <Image
        source={{ uri: listing.photos[0] }}
        style={styles.productImage}
        resizeMode="cover"
      />
      <View style={styles.productInfo}>
        <Text style={[styles.productTitle, { color: colors.text }]} numberOfLines={2}>
          {listing.title}
        </Text>
        {listing.brand && (
          <Text style={[styles.productBrand, { color: colors.textSecondary }]} numberOfLines={1}>
            {listing.brand}
          </Text>
        )}
        <Text style={[styles.productPrice, { color: colors.accent }]}>
          ${price.toLocaleString()}
        </Text>
        {listing.tags && listing.tags.length > 0 && (
          <View style={styles.tagsRow}>
            {listing.tags.slice(0, 3).map((tag, idx) => (
              <View key={idx} style={[styles.tag, { backgroundColor: colors.border }]}>
                <Text style={[styles.tagText, { color: colors.textSecondary }]}>#{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
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
        <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
          <Text style={[styles.avatarText, { color: colors.background }]}>
            {(curator.handle || curator.name || '?').charAt(0).toUpperCase()}
          </Text>
        </View>
      )}
      <View style={styles.curatorInfo}>
        <Text style={[styles.curatorName, { color: colors.text }]}>
          {curator.handle ? `@${curator.handle}` : curator.name}
        </Text>
        {(curator.totalSales > 0 || curator.rating > 0) && (
          <Text style={[styles.curatorStats, { color: colors.textMuted }]}>
            {[
              curator.totalSales > 0 && `${curator.totalSales} sales`,
              curator.rating > 0 && `${curator.rating.toFixed(1)}★`
            ].filter(Boolean).join(' • ')}
          </Text>
        )}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

function SuggestionItem({
  suggestion,
  onPress,
  colors
}: {
  suggestion: AutocompleteSuggestion;
  onPress: () => void;
  colors: ReturnType<typeof useThemeColors>;
}) {
  const icon = suggestion.type === 'hashtag' ? 'pricetag' :
               suggestion.type === 'handle' ? 'at' : 'cube-outline';

  return (
    <TouchableOpacity style={styles.suggestionItem} onPress={onPress}>
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <Text style={[styles.suggestionText, { color: colors.text }]}>
        {suggestion.type === 'hashtag' ? `#${suggestion.value}` : suggestion.value}
      </Text>
      {suggestion.count && (
        <Text style={[styles.suggestionCount, { color: colors.textMuted }]}>
          ({suggestion.count})
        </Text>
      )}
    </TouchableOpacity>
  );
}

type TabType = 'products' | 'curators';

export default function SearchScreen() {
  const colors = useThemeColors();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('products');
  const [useAI, setUseAI] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const debouncedSearch = useDebounce(searchQuery, 300);
  const debouncedAutocomplete = useDebounce(searchQuery, 150);

  // Autocomplete suggestions
  const { data: suggestions = [] } = useQuery({
    queryKey: ['autocomplete', debouncedAutocomplete],
    queryFn: () => searchService.autocomplete(debouncedAutocomplete, 8),
    enabled: debouncedAutocomplete.length >= 2 && showSuggestions,
  });

  // Main search
  const { data: searchResults, isLoading, isFetching } = useQuery({
    queryKey: ['search', debouncedSearch, useAI],
    queryFn: () => searchService.search({
      query: debouncedSearch,
      type: 'all',
      limit: 30,
      useAI,
    }),
    enabled: debouncedSearch.length >= 2,
  });

  const listings = searchResults?.listings?.results || [];
  const curators = searchResults?.curators?.results || [];
  const listingsCount = searchResults?.listings?.total || 0;
  const curatorsCount = searchResults?.curators?.total || 0;
  const aiParsed = searchResults?.aiParsed;

  const handleSuggestionPress = useCallback((suggestion: AutocompleteSuggestion) => {
    const value = suggestion.type === 'hashtag' ? suggestion.value : suggestion.value.replace('@', '');
    setSearchQuery(value);
    setShowSuggestions(false);
    inputRef.current?.blur();
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setShowSuggestions(false);
  }, []);

  const renderProductItem = useCallback(({ item }: { item: Listing }) => (
    <ProductCard listing={item} />
  ), []);

  const renderCuratorItem = useCallback(({ item }: { item: Curator }) => (
    <CuratorCard curator={item} />
  ), []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Search</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View
          style={[
            styles.searchBar,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search products, curators..."
            placeholderTextColor={colors.textMuted}
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {isFetching && searchQuery && (
            <ActivityIndicator size="small" color={colors.accent} />
          )}
          {searchQuery && !isFetching && (
            <TouchableOpacity onPress={handleClearSearch}>
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {/* AI Toggle */}
        <TouchableOpacity
          style={[
            styles.aiToggle,
            {
              backgroundColor: useAI ? colors.accent : colors.surface,
              borderColor: useAI ? colors.accent : colors.border,
            }
          ]}
          onPress={() => setUseAI(!useAI)}
        >
          <Ionicons
            name="sparkles"
            size={16}
            color={useAI ? colors.background : colors.textMuted}
          />
          <Text style={[
            styles.aiToggleText,
            { color: useAI ? colors.background : colors.textMuted }
          ]}>
            AI
          </Text>
        </TouchableOpacity>
      </View>

      {/* Autocomplete Dropdown */}
      {showSuggestions && suggestions.length > 0 && searchQuery.length >= 2 && (
        <View style={[styles.suggestionsContainer, { backgroundColor: colors.surface }]}>
          {suggestions.map((suggestion, idx) => (
            <SuggestionItem
              key={`${suggestion.type}-${suggestion.value}-${idx}`}
              suggestion={suggestion}
              onPress={() => handleSuggestionPress(suggestion)}
              colors={colors}
            />
          ))}
        </View>
      )}

      {/* AI Parsed Info */}
      {aiParsed && useAI && debouncedSearch.length >= 2 && (
        <View style={[styles.aiParsedContainer, { backgroundColor: colors.surface }]}>
          <Ionicons name="sparkles" size={14} color={colors.accent} />
          <Text style={[styles.aiParsedText, { color: colors.textSecondary }]}>
            {aiParsed.keywords?.join(', ')}
            {aiParsed.maxPrice && ` • Under $${aiParsed.maxPrice}`}
            {aiParsed.brand && ` • ${aiParsed.brand}`}
          </Text>
        </View>
      )}

      {/* Tabs */}
      {debouncedSearch.length >= 2 && (
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'products' && { borderBottomColor: colors.accent, borderBottomWidth: 2 }
            ]}
            onPress={() => setActiveTab('products')}
          >
            <Text style={[
              styles.tabText,
              { color: activeTab === 'products' ? colors.text : colors.textMuted }
            ]}>
              Products ({listingsCount})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tab,
              activeTab === 'curators' && { borderBottomColor: colors.accent, borderBottomWidth: 2 }
            ]}
            onPress={() => setActiveTab('curators')}
          >
            <Text style={[
              styles.tabText,
              { color: activeTab === 'curators' ? colors.text : colors.textMuted }
            ]}>
              Curators ({curatorsCount})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Results */}
      {activeTab === 'products' ? (
        <FlatList
          data={listings}
          keyExtractor={(item) => item.id}
          renderItem={renderProductItem}
          numColumns={2}
          columnWrapperStyle={styles.productRow}
          contentContainerStyle={styles.productList}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {isLoading ? 'Searching...' :
                 debouncedSearch.length < 2 ? 'Search for products or curators' :
                 'No products found'}
              </Text>
              {useAI && debouncedSearch.length >= 2 && !isLoading && (
                <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
                  Try "red leather bag under $500"
                </Text>
              )}
            </View>
          }
        />
      ) : (
        <FlatList
          data={curators}
          keyExtractor={(item) => item.id}
          renderItem={renderCuratorItem}
          contentContainerStyle={styles.curatorList}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={48} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {isLoading ? 'Searching...' :
                 debouncedSearch.length < 2 ? 'Search for curators by @handle' :
                 'No curators found'}
              </Text>
            </View>
          }
        />
      )}
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
    paddingBottom: SPACING.sm,
  },
  title: {
    fontSize: FONTS.sizes.xxxl,
    fontWeight: 'bold',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  searchBar: {
    flex: 1,
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
  aiToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    gap: 4,
  },
  aiToggleText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
  },
  suggestionsContainer: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    overflow: 'hidden',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  suggestionText: {
    flex: 1,
    fontSize: FONTS.sizes.md,
  },
  suggestionCount: {
    fontSize: FONTS.sizes.sm,
  },
  aiParsedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.sm,
    gap: SPACING.xs,
  },
  aiParsedText: {
    fontSize: FONTS.sizes.sm,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  tab: {
    paddingVertical: SPACING.md,
    marginRight: SPACING.xl,
  },
  tabText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  productList: {
    padding: SPACING.lg,
  },
  productRow: {
    justifyContent: 'space-between',
  },
  productCard: {
    width: CARD_WIDTH,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.md,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: CARD_WIDTH * 1.2,
  },
  productInfo: {
    padding: SPACING.sm,
  },
  productTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    marginBottom: 2,
  },
  productBrand: {
    fontSize: FONTS.sizes.xs,
    marginBottom: 4,
  },
  productPrice: {
    fontSize: FONTS.sizes.md,
    fontWeight: 'bold',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    gap: 4,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 10,
  },
  curatorList: {
    padding: SPACING.lg,
  },
  curatorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
  curatorStats: {
    fontSize: FONTS.sizes.sm,
    marginTop: 2,
  },
  empty: {
    paddingVertical: SPACING.xxl * 2,
    alignItems: 'center',
    gap: SPACING.md,
  },
  emptyText: {
    fontSize: FONTS.sizes.md,
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: FONTS.sizes.sm,
    fontStyle: 'italic',
  },
});
