import { useState, useEffect, useCallback } from 'react';

interface TimerState {
  timeLeft: number;
  isEnding: boolean;
  isExpired: boolean;
  formatted: string;
}

export function useListingTimer(auctionEnd: string | null): TimerState {
  const [timeLeft, setTimeLeft] = useState(0);

  const calculateTimeLeft = useCallback((): number => {
    if (!auctionEnd) return 0;
    const end = new Date(auctionEnd).getTime();
    const now = Date.now();
    return Math.max(0, end - now);
  }, [auctionEnd]);

  useEffect(() => {
    setTimeLeft(calculateTimeLeft());

    const interval = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [calculateTimeLeft]);

  const formatTime = (ms: number): string => {
    if (ms <= 0) return '00:00:00';

    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return {
    timeLeft,
    isEnding: timeLeft > 0 && timeLeft <= 2 * 60 * 1000, // Last 2 minutes
    isExpired: timeLeft <= 0,
    formatted: formatTime(timeLeft),
  };
}
