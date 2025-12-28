#!/bin/bash

# Start Nafisa's Closet Mobile App
# Usage: ./start-mobile.sh

cd "$(dirname "$0")/mobile"

# Get local IP address
IP_ADDRESS=$(ipconfig getifaddr en0 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')

echo "=========================================="
echo "  Nafisa's Closet Mobile App"
echo "=========================================="
echo ""
echo "Metro Bundler: http://$IP_ADDRESS:8082"
echo ""
echo "Scan QR code with Expo Go, or press:"
echo "  i - Open iOS Simulator"
echo "  a - Open Android Emulator"
echo ""
echo "=========================================="
echo ""

npx expo start --port 8082
