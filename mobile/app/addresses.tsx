import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router, Stack, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks';
import { SPACING, FONTS, BORDER_RADIUS } from '@/constants';
import { shippingService, ShippingAddress } from '@/services/shipping';

export default function AddressesScreen() {
  const colors = useThemeColors();
  const [addresses, setAddresses] = useState<ShippingAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAddresses = useCallback(async () => {
    try {
      const result = await shippingService.getAddresses();
      setAddresses(result.addresses);
    } catch (error) {
      console.error('Failed to load addresses:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  useFocusEffect(
    useCallback(() => {
      loadAddresses();
    }, [loadAddresses])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadAddresses();
  };

  const handleSetDefault = async (addressId: number) => {
    try {
      await shippingService.updateAddress(addressId, { is_default: true });
      loadAddresses();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to set default address');
    }
  };

  const handleDelete = async (addressId: number) => {
    Alert.alert(
      'Delete Address',
      'Are you sure you want to delete this address?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await shippingService.deleteAddress(addressId);
              loadAddresses();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete address');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Shipping Addresses',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          headerRight: () => (
            <TouchableOpacity onPress={() => router.push('/address/new')}>
              <Ionicons name="add-circle-outline" size={28} color={colors.accent} />
            </TouchableOpacity>
          ),
        }}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {addresses.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="location-outline" size={64} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No Addresses</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Add a shipping address to get started.
            </Text>
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: colors.accent }]}
              onPress={() => router.push('/address/new')}
            >
              <Ionicons name="add" size={20} color="#FFFFFF" />
              <Text style={styles.addButtonText}>Add Address</Text>
            </TouchableOpacity>
          </View>
        ) : (
          addresses.map((address) => (
            <View
              key={address.id}
              style={[
                styles.addressCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: address.is_default ? colors.accent : colors.border,
                  borderWidth: address.is_default ? 2 : 1,
                },
              ]}
            >
              <View style={styles.addressHeader}>
                <View style={styles.addressName}>
                  <Text style={[styles.name, { color: colors.text }]}>{address.name}</Text>
                  {address.is_default && (
                    <View style={[styles.defaultBadge, { backgroundColor: colors.accent }]}>
                      <Text style={styles.defaultBadgeText}>Default</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity onPress={() => router.push(`/address/${address.id}`)}>
                  <Ionicons name="create-outline" size={22} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {address.company && (
                <Text style={[styles.company, { color: colors.textSecondary }]}>{address.company}</Text>
              )}
              <Text style={[styles.street, { color: colors.text }]}>{address.street1}</Text>
              {address.street2 && (
                <Text style={[styles.street, { color: colors.text }]}>{address.street2}</Text>
              )}
              <Text style={[styles.cityStateZip, { color: colors.text }]}>
                {address.city}, {address.state} {address.zip}
              </Text>
              <Text style={[styles.country, { color: colors.textSecondary }]}>{address.country}</Text>
              {address.phone && (
                <Text style={[styles.phone, { color: colors.textMuted }]}>{address.phone}</Text>
              )}

              <View style={styles.addressActions}>
                {!address.is_default && (
                  <TouchableOpacity
                    style={[styles.actionButton, { borderColor: colors.border }]}
                    onPress={() => handleSetDefault(address.id)}
                  >
                    <Text style={[styles.actionButtonText, { color: colors.text }]}>Set as Default</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.actionButton, { borderColor: colors.error }]}
                  onPress={() => handleDelete(address.id)}
                >
                  <Ionicons name="trash-outline" size={16} color={colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: SPACING.lg,
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '600',
    marginTop: SPACING.md,
    marginBottom: SPACING.xs,
  },
  emptyText: {
    fontSize: FONTS.sizes.md,
    textAlign: 'center',
    marginBottom: SPACING.lg,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: FONTS.sizes.md,
    marginLeft: SPACING.xs,
  },
  addressCard: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
    marginBottom: SPACING.md,
  },
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  addressName: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
  },
  defaultBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: BORDER_RADIUS.sm,
    marginLeft: SPACING.sm,
  },
  defaultBadgeText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
  },
  company: {
    fontSize: FONTS.sizes.sm,
    marginBottom: 2,
  },
  street: {
    fontSize: FONTS.sizes.md,
  },
  cityStateZip: {
    fontSize: FONTS.sizes.md,
    marginTop: 2,
  },
  country: {
    fontSize: FONTS.sizes.sm,
    marginTop: 2,
  },
  phone: {
    fontSize: FONTS.sizes.sm,
    marginTop: SPACING.xs,
  },
  addressActions: {
    flexDirection: 'row',
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  actionButtonText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '500',
  },
});
