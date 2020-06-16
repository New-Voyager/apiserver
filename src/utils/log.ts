import * as winston from 'winston';
import { TransformableInfo } from 'logform';

function timeLog(info: any, opts: any) {
  info.time = new Date().toISOString();
  return info;
}
const timeLogFormat = winston.format(timeLog);


function formatter(info: TransformableInfo) {
  const { time, logger, level, message, ...other } = info;
  let otherStr = "";
  if(other) {
    otherStr = JSON.stringify(other);
  }
  return `[${time}] [${logger}] [${level}] : ${message}${otherStr}`;
}
const logFormatter = winston.format.printf(formatter);

export function getLogger(name: string): winston.Logger {
  return winston.createLogger({
    level: 'debug',
    format: winston.format.combine(timeLogFormat(), logFormatter),
    defaultMeta: { logger_name: name },
    transports: [new winston.transports.Console()],
    exitOnError: false,
  });
}
