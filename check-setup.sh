#!/bin/bash

echo "=== Corruptify Setup Check ==="
echo ""

# Check Node.js
echo "Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "✓ Node.js installed: $NODE_VERSION"
else
    echo "✗ Node.js not found"
    echo "  Install from: https://nodejs.org/"
    echo "  Or use: brew install node"
    exit 1
fi

# Check npm
echo "Checking npm..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "✓ npm installed: $NPM_VERSION"
else
    echo "✗ npm not found"
    exit 1
fi

# Check FFmpeg (optional)
echo "Checking FFmpeg (optional)..."
if command -v ffmpeg &> /dev/null; then
    FFMPEG_VERSION=$(ffmpeg -version 2>/dev/null | head -n 1)
    echo "✓ FFmpeg installed: $FFMPEG_VERSION"
else
    echo "⚠ FFmpeg not found (required for 2 corruption types)"
    echo "  Install with: brew install ffmpeg"
fi

echo ""
echo "=== Setup Check Complete ==="
echo ""
echo "Next steps:"
echo "1. Run: npm install"
echo "2. Run: npm run dev"
echo ""


