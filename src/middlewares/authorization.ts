import * as jwt from 'jsonwebtoken';
import {getLogger} from '@src/utils/log';
import {getJwtSecret} from '@src/auth';

const logger = getLogger('middleware::authorization');

export function authReq(req, res): boolean {
  if (req.headers.authorization) {
    const toks: string[] = req.headers.authorization.split(' ');
    if (toks[0] === 'Bearer') {
      // set the context of the current user who is making this call
      req.playerId = toks[1];
    } else {
      // handle other service requests
      if (toks[0] === 'jwt') {
        // verify JWT and get the player id
        const secret = getJwtSecret();
        try {
          const decoded = jwt.verify(toks[1], secret);
          req.playerId = decoded['uuid'];
        } catch (err) {
          logger.error('Invalid JWT');
          res.status(401).send('Invalid JWT. Unauthorized');
          return false;
        }
      }
    }
  } else {
    res.status(401).send('Unauthorized');
    return false;
  }

  return true;
}

export async function authorize(req, res, next) {
  const ok = authReq(req, res);
  if (!ok) {
    return;
  }

  if (
    process.env.TRACE_REQ_HEADERS === '1' ||
    process.env.TRACE_REQ_HEADERS === 'true'
  ) {
    logger.info(`Req.headers: ${JSON.stringify(req.headers)}`);
  }

  if (req.headers['x-realip']) {
    req.userIp = req.headers['x-realip'];
  } else if (req.headers['x-real-ip']) {
    req.userIp = req.headers['x-real-ip'];
  } else if (req.headers['x-forwarded-for']) {
    req.userIp = req.headers['x-forwarded-for'];
  } else {
    const ip = req.ip.replace('::ffff:', '');
    req.userIp = ip;
    // logger.info(`IP: ${req.userIp}`);
    // if (req.body) {
    //   logger.info(`body: ${JSON.stringify(req.body)}`);
    // }
  }
  next();
}
