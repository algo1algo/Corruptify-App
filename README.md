# Corruptify

A desktop application for corrupting audio and video files in various ways. Built with Electron and TypeScript.

## Features

- Drag and drop file support
- Multiple corruption types:
  - **Truncated**: Simulates partial upload/incomplete download (first 50KB)
  - **Header Garbled**: Garbled container header/EBML (first 1KB randomized)
  - **Mid-stream Corrupt**: Decoding dies partway through (200 random bytes at 1MB offset)
  - **Short Container**: Container says longer than file (5s clip truncated to 100KB)
  - **Broken Index**: Broken index/seek table (copy without reindex, truncate last 4KB)
- Real-time progress indicators
- Success/error notifications with file location

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- FFmpeg (required for "Short Container" and "Broken Index" corruption types)

### Installing FFmpeg

- **macOS**: `brew install ffmpeg`
- **Windows**: Download from [ffmpeg.org](https://ffmpeg.org/download.html) or use `choco install ffmpeg`
- **Linux**: `sudo apt install ffmpeg` (Ubuntu/Debian) or `sudo yum install ffmpeg` (RHEL/CentOS)

## Installation

1. Clone or download this repository
2. Install dependencies:
```bash
npm install
```

## Development

Build and run the app:
```bash
npm run dev
```

Or build first, then run:
```bash
npm run build
npm start
```

## Building for Production

Build for your current platform:
```bash
npm run package
```

Build for specific platforms:
```bash
npm run package:mac    # macOS
npm run package:win    # Windows
npm run package:linux  # Linux
```

Built applications will be in the `release/` directory.

## Usage

1. Launch the application
2. Add files using the "Add Files" button or by dragging and dropping files
3. Select a corruption type
4. Click "Process Files"
5. Wait for processing to complete
6. View results and click on file locations to reveal them in your file manager

## Project Structure

```
corruptify-app/
├── src/
│   ├── main/           # Electron main process
│   ├── renderer/       # UI (HTML, CSS, TypeScript)
│   ├── preload/        # Preload script for IPC
│   └── corruption/     # Corruption engine
├── dist/               # Compiled JavaScript
└── release/            # Built applications
```

## License

MIT

