import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';

function getLogDir(): string {
  return path.join(app.getPath('userData'), 'logs');
}

function getLogFile(): string {
  return path.join(getLogDir(), `corruptify-${new Date().toISOString().split('T')[0]}.log`);
}

// Ensure log directory exists
async function ensureLogDir(): Promise<void> {
  try {
    await fs.mkdir(getLogDir(), { recursive: true });
  } catch (error) {
    console.error('Failed to create log directory:', error);
  }
}

// Write log entry
export async function log(level: 'INFO' | 'WARN' | 'ERROR', message: string, data?: any): Promise<void> {
  try {
    await ensureLogDir();
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [${level}] ${message}${data ? ' ' + JSON.stringify(data) : ''}\n`;
    await fs.appendFile(getLogFile(), logEntry);
    console.log(logEntry.trim());
  } catch (error) {
    console.error('Failed to write log:', error);
  }
}

// Get log file path
export function getLogFilePath(): string {
  return getLogFile();
}

// Get all log files
export async function getLogFiles(): Promise<string[]> {
  try {
    await ensureLogDir();
    const logDir = getLogDir();
    const files = await fs.readdir(logDir);
    return files
      .filter(f => f.startsWith('corruptify-') && f.endsWith('.log'))
      .map(f => path.join(logDir, f))
      .sort()
      .reverse(); // Most recent first
  } catch (error) {
    console.error('Failed to read log directory:', error);
    return [];
  }
}

// Read log file
export async function readLogFile(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read log file: ${error}`);
  }
}

