import winston from 'winston';
import { format, transports } from 'winston';

// Define log format
const logFormat = format.printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} ${level}: ${stack || message}`;
});

const isServerlessEnvironment = process.env.VERCEL || process.env.NODE_ENV === 'production';

// Create logger instance
const logger = winston.createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    logFormat
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
    new transports.File({ filename: 'logs/combined.log' })
  ],
  exceptionHandlers: [
    new transports.File({ filename: 'logs/exceptions.log' })
  ],
  rejectionHandlers: [
    new transports.File({ filename: 'logs/rejections.log' })
  ]
});

// Add colors for console output
winston.addColors({
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue'
});

// Add file transports only in development environment
if (!isServerlessEnvironment) {
  logger.add(new transports.File({ filename: 'logs/error.log', level: 'error' }));
  logger.add(new transports.File({ filename: 'logs/combined.log' }));
  
  // Add exception and rejection handlers for development
  logger.exceptions.handle(
    new transports.File({ filename: 'logs/exceptions.log' })
  );
  logger.rejections.handle(
    new transports.File({ filename: 'logs/rejections.log' })
  );
}

export { logger };