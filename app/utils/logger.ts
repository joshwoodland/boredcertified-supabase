import fs from 'fs';
import path from 'path';

// Create a logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir);
}

const logFilePath = path.join(logsDir, 'auth-flow.log');

export function logToFile(message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ${message}\n`;
  
  // Append to log file
  fs.appendFileSync(logFilePath, logMessage);
  
  // Also log to console
  console.log(message);
}

export function clearLogFile(): void {
  fs.writeFileSync(logFilePath, '');
}