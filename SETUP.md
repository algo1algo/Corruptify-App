# Quick Setup Guide

## Prerequisites Check

Run these commands to check if you have everything installed:

```bash
# Check Node.js
node --version

# Check npm
npm --version

# Check FFmpeg (optional but recommended)
ffmpeg -version
```

## Installation Steps

1. **Install Node.js** (if not installed):
   - Visit https://nodejs.org/ and download the LTS version
   - Or use Homebrew: `brew install node`

2. **Install FFmpeg** (required for "Short Container" and "Broken Index" corruption types):
   ```bash
   brew install ffmpeg
   ```

3. **Install project dependencies**:
   ```bash
   cd "/Users/shayb/My Cursor Apps/Corruptify App"
   npm install
   ```

4. **Run the app**:
   ```bash
   npm run dev
   ```

## Troubleshooting

- If you get "command not found: npm", Node.js is not installed or not in your PATH
- If FFmpeg errors occur, install FFmpeg (only needed for 2 of the 5 corruption types)
- If build fails, make sure all dependencies are installed: `npm install`

## Building for Distribution

```bash
# Build for current platform
npm run package

# Build for specific platform
npm run package:mac
npm run package:win
npm run package:linux
```


