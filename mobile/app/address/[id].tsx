import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks';
import { SPACING, FONTS, BORDER_RADIUS } from '@/constants';
import { shippingService, ShippingAddress } from '@/services/shipping';

const COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'AU', name: 'Australia' },
  { code: 'JP', name: 'Japan' },
  { code: 'AE', name: 'United Arab Emirates' },
];

export default function AddressFormScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const colors = useThemeColors();

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [street1, setStreet1] = useState('');
  const [street2, setStreet2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');
  const [country, setCountry] = useState('US');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    if (!isNew) {
      loadAddress();
    }
  }, [id, isNew]);

  const loadAddress = async () => {
    try {
      const result = await shippingService.getAddress(parseInt(id!));
      const addr = result.address;
      setName(addr.name);
      setCompany(addr.company || '');
      setStreet1(addr.street1);
      setStreet2(addr.street2 || '');
      setCity(addr.city);
      setState(addr.state);
      setZip(addr.zip);
      setCountry(addr.country);
      setPhone(addr.phone || '');
      setEmail(addr.email || '');
      setIsDefault(addr.is_default);
    } catch (error) {
      console.error('Failed to load address:', error);
      Alert.alert('Error', 'Failed to load address');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validate required fields
    if (!name.trim() || !street1.trim() || !city.trim() || !state.trim() || !zip.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    setSaving(true);
    try {
      const addressData = {
        name: name.trim(),
        company: company.trim() || undefined,
        street1: street1.trim(),
        street2: street2.trim() || undefined,
        city: city.trim(),
        state: state.trim(),
        zip: zip.trim(),
        country,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        is_default: isDefault,
      };

      if (isNew) {
        await shippingService.createAddress({ ...addressData, validate: true });
      } else {
        await shippingService.updateAddress(parseInt(id!), addressData);
      }

      router.back();
    } catch (error: any) {
      // Check if it's a validation error with messages
      if (error.messages) {
        const messages = error.messages.map((m: any) => m.text).join('\n');
        Alert.alert('Address Validation Failed', messages);
      } else {
        Alert.alert('Error', error.message || 'Failed to save address');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen
        options={{
          headerShown: true,
          title: isNew ? 'Add Address' : 'Edit Address',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Name */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>
            Full Name <Text style={{ color: colors.error }}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            value={name}
            onChangeText={setName}
            placeholder="John Doe"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        {/* Company */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Company (optional)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            value={company}
            onChangeText={setCompany}
            placeholder="Company name"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        {/* Street 1 */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>
            Street Address <Text style={{ color: colors.error }}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            value={street1}
            onChangeText={setStreet1}
            placeholder="123 Main St"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        {/* Street 2 */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Apt, Suite, etc. (optional)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            value={street2}
            onChangeText={setStreet2}
            placeholder="Apt 4B"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        {/* City */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>
            City <Text style={{ color: colors.error }}>*</Text>
          </Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            value={city}
            onChangeText={setCity}
            placeholder="New York"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        {/* State & ZIP */}
        <View style={styles.row}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={[styles.label, { color: colors.text }]}>
              State/Province <Text style={{ color: colors.error }}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              value={state}
              onChangeText={setState}
              placeholder="NY"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
            />
          </View>
          <View style={[styles.field, { flex: 1, marginLeft: SPACING.md }]}>
            <Text style={[styles.label, { color: colors.text }]}>
              ZIP/Postal Code <Text style={{ color: colors.error }}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              value={zip}
              onChangeText={setZip}
              placeholder="10001"
              placeholderTextColor={colors.textMuted}
              keyboardType="default"
            />
          </View>
        </View>

        {/* Country */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Country</Text>
          <View style={styles.countryRow}>
            {COUNTRIES.slice(0, 4).map((c) => (
              <TouchableOpacity
                key={c.code}
                style={[
                  styles.countryOption,
                  {
                    backgroundColor: country === c.code ? colors.accent : colors.surface,
                    borderColor: country === c.code ? colors.accent : colors.border,
                  },
                ]}
                onPress={() => setCountry(c.code)}
              >
                <Text
                  style={[
                    styles.countryText,
                    { color: country === c.code ? '#FFFFFF' : colors.text },
                  ]}
                >
                  {c.code}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Phone */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Phone (optional)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            value={phone}
            onChangeText={setPhone}
            placeholder="+1 (555) 123-4567"
            placeholderTextColor={colors.textMuted}
            keyboardType="phone-pad"
          />
        </View>

        {/* Email */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>Email (optional)</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
            value={email}
            onChangeText={setEmail}
            placeholder="john@example.com"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        {/* Set as Default */}
        <TouchableOpacity
          style={[styles.defaultToggle, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => setIsDefault(!isDefault)}
        >
          <View style={[styles.checkbox, { borderColor: isDefault ? colors.accent : colors.border }]}>
            {isDefault && <Ionicons name="checkmark" size={16} color={colors.accent} />}
          </View>
          <Text style={[styles.defaultText, { color: colors.text }]}>Set as default shipping address</Text>
        </TouchableOpacity>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.accent }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>{isNew ? 'Add Address' : 'Save Changes'}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
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
    paddingBottom: 100,
  },
  field: {
    marginBottom: SPACING.md,
  },
  label: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '500',
    marginBottom: SPACING.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONTS.sizes.md,
  },
  row: {
    flexDirection: 'row',
  },
  countryRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  countryOption: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
  },
  countryText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
  },
  defaultToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    marginTop: SPACING.md,
    marginBottom: SPACING.lg,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.sm,
  },
  defaultText: {
    fontSize: FONTS.sizes.md,
  },
  saveButton: {
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: FONTS.sizes.md,
  },
});
