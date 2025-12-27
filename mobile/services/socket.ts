import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '@/constants';
import { BidEvent, AuctionExtendedEvent, AuctionEndedEvent } from '@/types';

type SocketEventCallback<T> = (data: T) => void;

class SocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<SocketEventCallback<unknown>>> = new Map();

  connect(): void {
    if (this.socket?.connected) return;

    this.socket = io(SOCKET_URL, {
      transports: ['websocket'],
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      console.log('Socket connected:', this.socket?.id);
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    // Set up event forwarding
    this.socket.on('bid:new', (data: BidEvent) => {
      this.emit('bid:new', data);
    });

    this.socket.on('auction:extended', (data: AuctionExtendedEvent) => {
      this.emit('auction:extended', data);
    });

    this.socket.on('auction:ended', (data: AuctionEndedEvent) => {
      this.emit('auction:ended', data);
    });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.listeners.clear();
  }

  subscribeToListing(listingId: string): void {
    this.socket?.emit('listing:subscribe', { listingId });
  }

  unsubscribeFromListing(listingId: string): void {
    this.socket?.emit('listing:unsubscribe', { listingId });
  }

  on<T>(event: string, callback: SocketEventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as SocketEventCallback<unknown>);

    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(callback as SocketEventCallback<unknown>);
    };
  }

  private emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach((callback) => callback(data));
  }
}

export const socketService = new SocketService();
