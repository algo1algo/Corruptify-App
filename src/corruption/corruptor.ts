import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export type CorruptionType = 
  | 'truncated'
  | 'header_garbled'
  | 'midstream_corrupt'
  | 'short_container'
  | 'no_reindex'
  | 'av_desync'
  | 'bitflip_scatter'
  | 'metadata_mangle'
  | 'freeze_frame'
  | 'surprise_corrupt';

export interface CorruptionResult {
  outputPath: string;
  diagnostics?: string;
}

export async function corruptFile(
  inputPath: string,
  corruptionType: CorruptionType,
  outputDir: string,
  level: number = 5
): Promise<CorruptionResult> {
  // Clamp level between 1-10
  level = Math.max(1, Math.min(10, level));
  
  // Check if input file exists
  try {
    await fs.access(inputPath);
  } catch {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  const base = path.basename(inputPath);
  const name = path.parse(base).name;
  const ext = path.parse(base).ext;

  let outputPath: string;

  switch (corruptionType) {
    case 'truncated':
      outputPath = await createTruncated(inputPath, outputDir, name, ext, level);
      break;
    case 'header_garbled':
      outputPath = await createHeaderGarbled(inputPath, outputDir, name, ext, level);
      break;
    case 'midstream_corrupt':
      outputPath = await createMidstreamCorrupt(inputPath, outputDir, name, ext, level);
      break;
    case 'short_container':
      outputPath = await createShortContainer(inputPath, outputDir, name, ext, level);
      break;
    case 'no_reindex':
      outputPath = await createNoReindex(inputPath, outputDir, name, ext, level);
      break;
    case 'av_desync':
      outputPath = await createAVDesync(inputPath, outputDir, name, ext, level);
      break;
    case 'bitflip_scatter':
      outputPath = await createBitflipScatter(inputPath, outputDir, name, ext, level);
      break;
    case 'metadata_mangle':
      outputPath = await createMetadataMangle(inputPath, outputDir, name, ext, level);
      break;
    case 'freeze_frame':
      outputPath = await createFreezeFrame(inputPath, outputDir, name, ext, level);
      break;
    case 'surprise_corrupt':
      outputPath = await createSurpriseCorrupt(inputPath, outputDir, name, ext, level);
      break;
    default:
      throw new Error(`Unknown corruption type: ${corruptionType}`);
  }

  // Get diagnostics
  const diagnostics = await getDiagnostics(outputPath, corruptionType);

  return { outputPath, diagnostics };
}

// 1) Truncated (simulates partial upload/incomplete download)
// Level 1: Keep 80% of file, Level 10: Keep only 5KB
async function createTruncated(
  inputPath: string,
  outputDir: string,
  name: string,
  ext: string,
  level: number
): Promise<string> {
  const outputPath = path.join(outputDir, `${name}.truncated_L${level}${ext}`);
  const buffer = await fs.readFile(inputPath);
  const fileSize = buffer.length;
  
  // Calculate how much to keep based on level
  // Level 1: 80% of file, Level 10: min(5KB, 5% of file)
  let keepBytes: number;
  if (level <= 3) {
    // Mild: keep 80% - 50% of file
    const percentage = 0.8 - ((level - 1) * 0.1);
    keepBytes = Math.floor(fileSize * percentage);
  } else if (level <= 7) {
    // Medium: keep 40% - 10% of file
    const percentage = 0.4 - ((level - 4) * 0.075);
    keepBytes = Math.floor(fileSize * percentage);
  } else {
    // Severe: keep 5% - 1% or min 5KB
    const percentage = 0.05 - ((level - 8) * 0.015);
    keepBytes = Math.max(5000, Math.floor(fileSize * percentage));
  }
  
  keepBytes = Math.max(1000, Math.min(keepBytes, fileSize - 1000));
  
  const truncated = buffer.slice(0, keepBytes);
  await fs.writeFile(outputPath, truncated);
  return outputPath;
}

// 2) Header-smashed (garbled container header/EBML)
// Level 1: 256 bytes, Level 10: 16KB
async function createHeaderGarbled(
  inputPath: string,
  outputDir: string,
  name: string,
  ext: string,
  level: number
): Promise<string> {
  const outputPath = path.join(outputDir, `${name}.header_garbled_L${level}${ext}`);
  await fs.copyFile(inputPath, outputPath);
  
  // Calculate bytes to corrupt based on level
  // Level 1: 256 bytes, Level 10: 16KB
  const corruptBytes = Math.floor(256 * Math.pow(2, (level - 1) * 0.6));
  
  const randomBytes = Buffer.alloc(corruptBytes);
  for (let i = 0; i < randomBytes.length; i++) {
    randomBytes[i] = Math.floor(Math.random() * 256);
  }
  
  const fileHandle = await fs.open(outputPath, 'r+');
  await fileHandle.write(randomBytes, 0, randomBytes.length, 0);
  await fileHandle.close();
  
  return outputPath;
}

// 3) Mid-stream byte flips (decoding dies partway through)
// Level 1: 100 bytes at 1 location, Level 10: 2000 bytes at 30 locations
async function createMidstreamCorrupt(
  inputPath: string,
  outputDir: string,
  name: string,
  ext: string,
  level: number
): Promise<string> {
  const outputPath = path.join(outputDir, `${name}.midstream_corrupt_L${level}${ext}`);
  await fs.copyFile(inputPath, outputPath);
  
  const stats = await fs.stat(outputPath);
  const fileSize = stats.size;
  
  // Calculate corruption parameters based on level
  // Number of corruption points: level 1 = 1, level 10 = 30
  const numCorruptionPoints = Math.floor(1 + (level - 1) * 3.2);
  
  // Bytes per corruption - scale based on file size to always work
  // Base: level 1 = 100, level 10 = 2000, but cap at 10% of file size
  const baseBytesPerCorruption = Math.floor(100 + (level - 1) * 210);
  const maxBytesPerCorruption = Math.floor(fileSize * 0.1);
  const bytesPerCorruption = Math.max(10, Math.min(baseBytesPerCorruption, maxBytesPerCorruption));
  
  const fileHandle = await fs.open(outputPath, 'r+');
  
  // Skip the first 5% of the file (header protection)
  const headerSize = Math.floor(fileSize * 0.05);
  const startOffset = Math.max(100, headerSize);
  
  // Calculate available range for corruption
  const availableRange = fileSize - startOffset - 10; // Leave some bytes at end
  
  if (availableRange > 0 && fileSize > 100) {
    for (let i = 0; i < numCorruptionPoints; i++) {
      // Distribute corruption points throughout the file
      let offset: number;
      if (numCorruptionPoints === 1) {
        offset = startOffset + Math.floor(availableRange * 0.5);
      } else {
        // Evenly distribute with some randomness
        const segment = availableRange / numCorruptionPoints;
        const baseOffset = startOffset + Math.floor(segment * i);
        const jitter = Math.floor(Math.random() * (segment * 0.5));
        offset = Math.min(fileSize - bytesPerCorruption - 1, baseOffset + jitter);
      }
      
      // Ensure offset is valid
      offset = Math.max(startOffset, Math.min(offset, fileSize - bytesPerCorruption - 1));
      
      const actualBytes = Math.min(bytesPerCorruption, fileSize - offset);
      if (actualBytes > 0) {
        const randomBytes = Buffer.alloc(actualBytes);
        for (let j = 0; j < randomBytes.length; j++) {
          randomBytes[j] = Math.floor(Math.random() * 256);
        }
        
        await fileHandle.write(randomBytes, 0, randomBytes.length, offset);
      }
    }
  } else if (fileSize > 10) {
    // Very small file - just corrupt some bytes in the middle
    const offset = Math.floor(fileSize * 0.3);
    const bytes = Math.min(Math.floor(fileSize * 0.4), 50);
    const randomBytes = Buffer.alloc(bytes);
    for (let j = 0; j < randomBytes.length; j++) {
      randomBytes[j] = Math.floor(Math.random() * 256);
    }
    await fileHandle.write(randomBytes, 0, randomBytes.length, offset);
  }
  
  await fileHandle.close();
  
  return outputPath;
}

// Get FFmpeg path (bundled or system)
function getFFmpegPath(): string {
  const fsSync = require('fs');
  const pathModule = require('path');
  
  // Check for bundled FFmpeg in various locations
  const bundledPaths = [
    // Packaged app - extraResources go to Resources folder
    pathModule.join((process as any).resourcesPath || '', 'ffmpeg'),
    // Development - ffmpeg folder in project root
    pathModule.join(process.cwd(), 'ffmpeg', 'ffmpeg'),
    pathModule.join(__dirname, '../../ffmpeg/ffmpeg'),
    pathModule.join(__dirname, '../../../ffmpeg/ffmpeg'),
  ];
  
  for (const bundledPath of bundledPaths) {
    try {
      if (fsSync.existsSync(bundledPath)) {
        console.log('Found FFmpeg at:', bundledPath);
        return bundledPath;
      }
    } catch (e) {
      // Continue
    }
  }
  
  console.log('FFmpeg not found in bundled paths, falling back to system ffmpeg');
  // Fallback to system FFmpeg
  return 'ffmpeg';
}

// Check if FFmpeg is available
async function checkFFmpeg(): Promise<boolean> {
  try {
    const ffmpegPath = getFFmpegPath();
    await execAsync(`"${ffmpegPath}" -version`);
    return true;
  } catch {
    return false;
  }
}

// 4) Lying length (container says longer than file)
// Level 1: 200KB output, Level 10: 10KB output
async function createShortContainer(
  inputPath: string,
  outputDir: string,
  name: string,
  ext: string,
  level: number
): Promise<string> {
  const hasFFmpeg = await checkFFmpeg();
  if (!hasFFmpeg) {
    throw new Error('FFmpeg is not available. This corruption type requires FFmpeg.');
  }

  const tempPath = path.join(outputDir, `${name}.temp${ext}`);
  const outputPath = path.join(outputDir, `${name}.short_container_L${level}${ext}`);
  
  // Duration to extract: level 1 = 10s, level 10 = 2s
  const duration = Math.max(2, 10 - (level - 1) * 0.9);
  
  // Output size: level 1 = 200KB, level 10 = 10KB
  const outputSize = Math.floor(200 * 1024 - (level - 1) * 21 * 1024);
  
  try {
    const ffmpegPath = getFFmpegPath();
    await execAsync(
      `"${ffmpegPath}" -loglevel error -y -i "${inputPath}" -c copy -t ${duration} "${tempPath}"`
    );
    
    const buffer = await fs.readFile(tempPath);
    const truncated = buffer.slice(0, Math.min(outputSize, buffer.length));
    await fs.writeFile(outputPath, truncated);
    
    await fs.unlink(tempPath).catch(() => {});
    
    return outputPath;
  } catch (error: any) {
    await fs.unlink(tempPath).catch(() => {});
    if (error.message && error.message.includes('command not found')) {
      throw new Error('FFmpeg is not available. This corruption type requires FFmpeg.');
    }
    throw new Error(`FFmpeg error: ${error.message}`);
  }
}

// Get diagnostics using ffmpeg (ffprobe is not bundled)
async function getDiagnostics(filePath: string, corruptionType: CorruptionType): Promise<string | undefined> {
  const hasFFmpeg = await checkFFmpeg();
  if (!hasFFmpeg) return undefined;

  try {
    const ffmpegPath = getFFmpegPath();
    // Use ffmpeg to analyze the file — reads input and discards output
    const probeCommand = `"${ffmpegPath}" -v error -i "${filePath}" -f null - 2>&1`;

    try {
      const { stdout, stderr } = await execAsync(probeCommand);
      const output = (stdout || '') + (stderr || '');
      if (output.trim().length === 0) {
        return `Diagnostics: File decoded without errors. Corruption type: ${corruptionType} — corruption may be subtle or structural.`;
      }
      const corruptionKeywords = ['Invalid', 'truncated', 'moov', 'broken', 'error', 'corrupt', 'missing', 'failed'];
      const isCorrupted = corruptionKeywords.some(kw => output.toLowerCase().includes(kw.toLowerCase()));
      if (isCorrupted) {
        return `Diagnostics: Corruption confirmed! ${corruptionType} caused:\n${output.substring(0, 400)}`;
      }
      return `Diagnostics: ${output.substring(0, 400)}`;
    } catch (error: any) {
      const errorMsg = (error.stderr || '') + (error.stdout || '') + (error.message || '');
      const corruptionKeywords = ['Invalid', 'truncated', 'moov', 'broken', 'error', 'corrupt', 'missing'];
      const isCorrupted = corruptionKeywords.some(kw => errorMsg.toLowerCase().includes(kw.toLowerCase()));
      if (isCorrupted) {
        return `Diagnostics: Corruption confirmed! ${corruptionType} caused:\n${errorMsg.substring(0, 400)}`;
      }
      return `Diagnostics: File validation result:\n${errorMsg.substring(0, 400)}`;
    }
  } catch {
    return undefined;
  }
}

// 6) AV Desync / Drop Segments
async function createAVDesync(inputPath: string, outputDir: string, name: string, ext: string, level: number): Promise<string> {
  const hasFFmpeg = await checkFFmpeg();
  if (!hasFFmpeg) throw new Error('FFmpeg is not available. This corruption type requires FFmpeg.');
  const outputPath = path.join(outputDir, `${name}.av_desync_L${level}${ext}`);
  const dropSegments = level >= 7;
  try {
    const ffmpegPath = getFFmpegPath();
    if (dropSegments) {
      const tempPath = path.join(outputDir, `${name}.temp${ext}`);
      await execAsync(`"${ffmpegPath}" -loglevel error -y -i "${inputPath}" -t 5 -c copy "${tempPath}" 2>&1 || echo "extracted"`);
      const buffer = await fs.readFile(tempPath);
      const truncated = buffer.slice(0, Math.floor(buffer.length * 0.6));
      await fs.writeFile(outputPath, truncated);
      await fs.unlink(tempPath).catch(() => {});
    } else {
      await fs.copyFile(inputPath, outputPath);
      const buffer = await fs.readFile(outputPath);
      const corruptBytes = Math.floor(100 * level);
      const startOffset = Math.min(1000, Math.floor(buffer.length * 0.01));
      for (let i = 0; i < corruptBytes && (startOffset + i) < buffer.length; i++) {
        buffer[startOffset + i] = (buffer[startOffset + i] + Math.floor(Math.random() * 50)) % 256;
      }
      await fs.writeFile(outputPath, buffer);
    }
    return outputPath;
  } catch (error: any) {
    if (error.message && error.message.includes('command not found')) {
      throw new Error('FFmpeg is not available. This corruption type requires FFmpeg.');
    }
    throw new Error(`FFmpeg error: ${error.message}`);
  }
}

// 7) Bitflip Scatter
async function createBitflipScatter(inputPath: string, outputDir: string, name: string, ext: string, level: number): Promise<string> {
  const outputPath = path.join(outputDir, `${name}.bitflip_scatter_L${level}${ext}`);
  await fs.copyFile(inputPath, outputPath);
  const stats = await fs.stat(outputPath);
  const fileSize = stats.size;
  const bitflipPercentage = 0.001 + ((level - 1) * 0.0005);
  const numBitflips = Math.floor(fileSize * 8 * bitflipPercentage);
  const fileHandle = await fs.open(outputPath, 'r+');
  const buffer = Buffer.alloc(1);
  for (let i = 0; i < numBitflips; i++) {
    const byteOffset = Math.floor(Math.random() * fileSize);
    const bitPosition = Math.floor(Math.random() * 8);
    await fileHandle.read(buffer, 0, 1, byteOffset);
    buffer[0] ^= (1 << bitPosition);
    await fileHandle.write(buffer, 0, 1, byteOffset);
  }
  await fileHandle.close();
  return outputPath;
}

// 8) Metadata Mangle
async function createMetadataMangle(inputPath: string, outputDir: string, name: string, ext: string, level: number): Promise<string> {
  const hasFFmpeg = await checkFFmpeg();
  const outputPath = path.join(outputDir, `${name}.metadata_mangle_L${level}${ext}`);
  if (hasFFmpeg && level >= 7) {
    try {
      const ffmpegPath = getFFmpegPath();
      await execAsync(`"${ffmpegPath}" -loglevel error -y -i "${inputPath}" -map_metadata -1 -c copy "${outputPath}"`);
      return outputPath;
    } catch (error: any) {}
  }
  await fs.copyFile(inputPath, outputPath);
  const buffer = await fs.readFile(outputPath);
  const metadataSize = Math.min(10240, Math.floor(buffer.length * 0.1));
  const corruptBytes = Math.floor(metadataSize * (level / 10));
  for (let i = 0; i < corruptBytes; i++) {
    const offset = Math.floor(Math.random() * metadataSize);
    buffer[offset] = Math.floor(Math.random() * 256);
  }
  await fs.writeFile(outputPath, buffer);
  return outputPath;
}

// 9) Freeze Frame / Duplicate GOPs
async function createFreezeFrame(inputPath: string, outputDir: string, name: string, ext: string, level: number): Promise<string> {
  const hasFFmpeg = await checkFFmpeg();
  if (!hasFFmpeg) throw new Error('FFmpeg is not available. This corruption type requires FFmpeg.');
  const outputPath = path.join(outputDir, `${name}.freeze_frame_L${level}${ext}`);
  const numFreezes = Math.floor(1 + (level - 1) * 0.5);
  try {
    await fs.copyFile(inputPath, outputPath);
    const buffer = await fs.readFile(outputPath);
    const fileSize = buffer.length;
    const corruptPoints = Math.min(numFreezes, 10);
    for (let i = 0; i < corruptPoints; i++) {
      const offset = Math.floor((fileSize / (corruptPoints + 1)) * (i + 1));
      const corruptSize = Math.floor(100 * level);
      if (offset + corruptSize < fileSize) {
        const segment = buffer.slice(offset, offset + corruptSize);
        const insertOffset = Math.min(offset + corruptSize, fileSize - corruptSize);
        segment.copy(buffer, insertOffset);
      }
    }
    await fs.writeFile(outputPath, buffer);
    return outputPath;
  } catch (error: any) {
    await fs.copyFile(inputPath, outputPath);
    const buffer = await fs.readFile(outputPath);
    const midPoint = Math.floor(buffer.length / 2);
    const segment = buffer.slice(midPoint - 1000, midPoint);
    segment.copy(buffer, midPoint);
    await fs.writeFile(outputPath, buffer);
    return outputPath;
  }
}

// 10) Surprise Corrupt - Random combination
async function createSurpriseCorrupt(inputPath: string, outputDir: string, name: string, ext: string, level: number): Promise<string> {
  const types: CorruptionType[] = ['truncated', 'header_garbled', 'midstream_corrupt', 'bitflip_scatter', 'metadata_mangle'];
  const numTypes = Math.floor(2 + Math.random() * 2);
  const selectedTypes: CorruptionType[] = [];
  for (let i = 0; i < numTypes; i++) {
    const randomType = types[Math.floor(Math.random() * types.length)];
    if (!selectedTypes.includes(randomType)) selectedTypes.push(randomType);
  }
  let currentPath = inputPath;
  const tempDir = outputDir;
  const extParsed = path.parse(inputPath).ext;
  for (let i = 0; i < selectedTypes.length; i++) {
    const type = selectedTypes[i];
    const isLast = i === selectedTypes.length - 1;
    const tempName = isLast ? name : `${name}.surprise_${i}`;
    const adjustedLevel = Math.max(1, Math.floor(level * (0.7 + Math.random() * 0.3)));
    let resultPath: string;
    switch (type) {
      case 'truncated': resultPath = await createTruncated(currentPath, tempDir, tempName, extParsed, adjustedLevel); break;
      case 'header_garbled': resultPath = await createHeaderGarbled(currentPath, tempDir, tempName, extParsed, adjustedLevel); break;
      case 'midstream_corrupt': resultPath = await createMidstreamCorrupt(currentPath, tempDir, tempName, extParsed, adjustedLevel); break;
      case 'bitflip_scatter': resultPath = await createBitflipScatter(currentPath, tempDir, tempName, extParsed, adjustedLevel); break;
      case 'metadata_mangle': resultPath = await createMetadataMangle(currentPath, tempDir, tempName, extParsed, adjustedLevel); break;
      default: continue;
    }
    if (!isLast && currentPath !== inputPath) await fs.unlink(currentPath).catch(() => {});
    currentPath = resultPath;
  }
  const finalPath = path.join(outputDir, `${name}.surprise_corrupt_L${level}${extParsed}`);
  await fs.copyFile(currentPath, finalPath);
  if (currentPath !== inputPath) await fs.unlink(currentPath).catch(() => {});
  return finalPath;
}

// 5) Broken index/seek table (copy without reindex, then truncate slightly)
// Level 1: Truncate 2KB, Level 10: Truncate 64KB
async function createNoReindex(
  inputPath: string,
  outputDir: string,
  name: string,
  ext: string,
  level: number
): Promise<string> {
  const hasFFmpeg = await checkFFmpeg();
  if (!hasFFmpeg) {
    throw new Error('FFmpeg is not available. This corruption type requires FFmpeg.');
  }

  const tempPath = path.join(outputDir, `${name}.temp${ext}`);
  const outputPath = path.join(outputDir, `${name}.no_reindex_L${level}${ext}`);
  
  // Truncation amount: level 1 = 2KB, level 10 = 64KB
  const truncateBytes = Math.floor(2048 * Math.pow(2, (level - 1) * 0.5));
  
  try {
    const ffmpegPath = getFFmpegPath();
    await execAsync(
      `"${ffmpegPath}" -loglevel error -y -i "${inputPath}" -c copy "${tempPath}"`
    );
    
    const stats = await fs.stat(tempPath);
    const newSize = Math.max(1000, stats.size - truncateBytes);
    
    const buffer = await fs.readFile(tempPath);
    const truncated = buffer.slice(0, newSize);
    await fs.writeFile(outputPath, truncated);
    
    await fs.unlink(tempPath).catch(() => {});
    
    return outputPath;
  } catch (error: any) {
    await fs.unlink(tempPath).catch(() => {});
    if (error.message && error.message.includes('command not found')) {
      throw new Error('FFmpeg is not available. This corruption type requires FFmpeg.');
    }
    throw new Error(`FFmpeg error: ${error.message}`);
  }
}
