/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
class Logger {
  info(message: string, ...args: any[]) {
    console.log(`[INFO] ${message}`, ...args);
  }

  success(message: string, ...args: any[]) {
    console.log(`[SUCCESS] ${message}`, ...args);
  }

  warn(message: string, ...args: any[]) {
    console.warn(`[WARN] ${message}`, ...args);
  }

  error(message: string, ...args: any[]) {
    console.error(`[ERROR] ${message}`, ...args);
  }

  debug(message: string, ...args: any[]) {
    console.debug(`[DEBUG] ${message}`, ...args);
  }
}

export const logger = new Logger();
