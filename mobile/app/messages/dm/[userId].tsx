import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors } from '@/hooks';
import { SPACING, FONTS, BORDER_RADIUS } from '@/constants';
import { messagesService, Message } from '@/services/messages';
import { api } from '@/services/api';
import { useAuth } from '@/src/context/AuthContext';

interface UserInfo {
  id: number;
  name: string;
  handle?: string;
  avatarUrl?: string;
  profilePhoto?: string;
}

export default function DMChatScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const colors = useThemeColors();
  const { user } = useAuth();
  const flatListRef = useRef<FlatList>(null);

  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [otherUser, setOtherUser] = useState<UserInfo | null>(null);

  // Load user info and messages
  const loadData = useCallback(async () => {
    if (!userId) return;

    try {
      // Get other user's info
      const userResponse = await api.get<{ user: UserInfo }>('/users/profile', { userId });
      setOtherUser(userResponse.user);

      // Get DM messages
      const response = await messagesService.getDMMessages(userId);
      setMessages(response.messages || []);

      // Mark as read
      messagesService.markDMAsRead(userId).catch(console.error);
    } catch (error) {
      console.error('Failed to load DM:', error);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();

    // Poll for new messages every 5 seconds
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleSend = async () => {
    if (!messageText.trim() || !userId || sending) return;

    const text = messageText.trim();
    setMessageText('');
    setSending(true);

    try {
      const newMessage = await messagesService.sendDM(userId, text);

      // Add to local messages
      setMessages(prev => [...prev, {
        ...newMessage,
        senderName: user?.name,
      }]);

      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error: any) {
      console.error('Failed to send DM:', error);
      setMessageText(text); // Restore text on error
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.senderId === user?.id;

    return (
      <View style={[
        styles.messageContainer,
        isMe ? styles.myMessage : styles.theirMessage,
      ]}>
        <View style={[
          styles.messageBubble,
          isMe
            ? { backgroundColor: colors.accent }
            : { backgroundColor: colors.surface },
        ]}>
          <Text style={[
            styles.messageText,
            { color: isMe ? '#FFFFFF' : colors.text },
          ]}>
            {item.text}
          </Text>
          <Text style={[
            styles.messageTime,
            { color: isMe ? 'rgba(255,255,255,0.7)' : colors.textMuted },
          ]}>
            {new Date(item.createdAt).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Text>
        </View>
      </View>
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
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          {otherUser?.profilePhoto ? (
            <Image source={{ uri: otherUser.profilePhoto }} style={styles.avatarImage} />
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
              <Text style={styles.avatarText}>
                {(otherUser?.handle || otherUser?.name)?.charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
              @{otherUser?.handle || 'user'}
            </Text>
          </View>
        </View>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Start a conversation with @{otherUser?.handle || 'user'}
            </Text>
          </View>
        }
      />

      {/* Input */}
      <View style={[styles.inputContainer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: colors.background, color: colors.text, borderColor: colors.border },
          ]}
          placeholder="Type a message..."
          placeholderTextColor={colors.textMuted}
          value={messageText}
          onChangeText={setMessageText}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            { backgroundColor: messageText.trim() ? colors.accent : colors.surface },
          ]}
          onPress={handleSend}
          disabled={!messageText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons
              name="send"
              size={20}
              color={messageText.trim() ? '#FFFFFF' : colors.textMuted}
            />
          )}
        </TouchableOpacity>
      </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 50,
    paddingBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.lg,
    fontWeight: 'bold',
  },
  headerText: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: FONTS.sizes.sm,
  },
  messagesList: {
    padding: SPACING.md,
    flexGrow: 1,
  },
  messageContainer: {
    marginBottom: SPACING.sm,
  },
  myMessage: {
    alignItems: 'flex-end',
  },
  theirMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    padding: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: BORDER_RADIUS.lg,
  },
  messageText: {
    fontSize: FONTS.sizes.md,
    lineHeight: 22,
  },
  messageTime: {
    fontSize: FONTS.sizes.xs,
    marginTop: SPACING.xs,
    alignSelf: 'flex-end',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyText: {
    fontSize: FONTS.sizes.md,
    textAlign: 'center',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: SPACING.md,
    paddingBottom: SPACING.lg,
    borderTopWidth: 1,
    gap: SPACING.sm,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    borderWidth: 1,
    borderRadius: BORDER_RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONTS.sizes.md,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
