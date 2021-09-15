import * as winston from 'winston';
import {TransformableInfo} from 'logform';

function timeLog(info: any, opts: any) {
  info.time = new Date().toISOString();
  return info;
}
const timeLogFormat = winston.format(timeLog);

function formatter(info: TransformableInfo) {
  const {time, logger, level, message, ...other} = info;
  let otherStr = '';
  if (other) {
    otherStr = JSON.stringify(other);
  }
  return `[${time}] [${logger}] [${level}] : ${message}${otherStr}`;
}
const logFormatter = winston.format.printf(formatter);

// let logLevel = 'debug';
// export function setLogLevel(level: string) {
//   logLevel = level;
// }
let logLevel: string;
function getLogLevel() {
  if (logLevel !== undefined) {
    return logLevel;
  }
  if (process.env.LOG_LEVEL) {
    let level = process.env.LOG_LEVEL;
    level = level.toLowerCase();
    if (level === 'debug' || level == 'trace') {
      level = 'debug';
    } else if (level === 'info') {
      level = 'info';
    } else if (level === 'warn' || level === 'warning') {
      level = 'warn';
    } else if (level === 'error') {
      level = 'error';
    }
    logLevel = level;
    return level;
  } else {
    logLevel = 'info';
    return 'info';
  }
}

export function getLogger(name: string): winston.Logger {
  const logLevel = getLogLevel();

  return winston.createLogger({
    level: logLevel,
    format: winston.format.combine(
      winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss',
      }),
      winston.format.label({label: name}),
      winston.format.printf(({timestamp, label, level, message}) => {
        return `[${timestamp}] [${label}] [${level}]: ${message}`;
      })
    ),
    transports: [new winston.transports.Console()],
  });
}

export function errToLogString(e: Error, includeStack = true): string {
  if (!e) {
    return 'Error object is undefined';
  }
  let errStr = `Error(`;

  let name: string | undefined;
  if (e.name !== 'Error') {
    name = e.name;
  }
  if (name) {
    errStr = errStr + `name: ${name}, `;
  }

  if (e.message) {
    errStr = errStr + `message: ${e.message})`;
  } else {
    errStr = errStr + `toString: ${e.toString()})`;
  }

  if (includeStack) {
    errStr = errStr += `\n${e.stack}`;
  }

  return errStr;
}
