import winston from 'winston';
import { format, transports } from 'winston';

// Define log format
const logFormat = format.printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} ${level}: ${stack || message}`;
});

const isServerlessEnvironment = process.env.VERCEL || process.env.NODE_ENV === 'production';

// Configure transports based on environment
const logTransports: winston.transport[] = [
  new transports.Console({
    format: format.combine(
      format.colorize(),
      logFormat
    )
  })
];

// Add file transports only for development environment
if (!isServerlessEnvironment) {
  logTransports.push(
    new transports.File({ filename: 'logs/error.log', level: 'error' }),
    new transports.File({ filename: 'logs/combined.log' })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.errors({ stack: true }),
    logFormat
  ),
  transports: logTransports
});

// Add exception and rejection handlers only in development
if (!isServerlessEnvironment) {
  logger.exceptions.handle(
    new transports.File({ filename: 'logs/exceptions.log' })
  );
  logger.rejections.handle(
    new transports.File({ filename: 'logs/rejections.log' })
  );
}

// Add colors for console output
winston.addColors({
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue'
});


export { logger };