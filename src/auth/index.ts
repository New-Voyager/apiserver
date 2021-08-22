import * as jwt from 'jsonwebtoken';
import {Player} from '@src/entity/player/player';
import {getUserRepository} from '@src/repositories';
import {PlayerRepository} from '@src/repositories/player';
import {UserRegistrationPayload} from '@src/types';
import {getLogger} from '@src/utils/log';

const logger = getLogger('auth');
const JWT_EXPIRY_DAYS = 3;
const TOKEN_SECRET =
  'd8e07f8bb0006f07ea15fb94e6a4db7c3957722b0e1aa63e7cf024a05628ba7f8f319d8960060f0ea5df48c5d8f2e583b8e0686aaffb7ef505945840919a5a2f';

export function getJwtSecret(): string {
  let secret = '';
  if (process.env['TOKEN_SECRET']) {
    secret = process.env['TOKEN_SECRET'];
  }
  if (!secret) {
    secret = TOKEN_SECRET;
  }
  return secret;
}

/**
 * Login API
 * @param req
 * {
 *  "uuid": <player uuid>,
 *  "device-id": <uuid assigned in the device>,
 *  "email": "player email address",
 *  "password": "password"
 * }
 * The player can login using uuid/device-id or email/password.
 * @param resp
 */
export async function login(req: any, resp: any) {
  const payload = req.body;
  const errors = new Array<string>();
  const name = payload['name'];
  const uuid = payload['uuid'];
  const deviceId = payload['device-id'];
  const email = payload['email'];
  const password = payload['password'];

  try {
    const repository = getUserRepository(Player);
    let player;
    if (email && password) {
      // use email and password to login
    } else {
      if (name) {
        // in test mode only
        logger.info(`[test] Player ${name} tries to login using name`);
        player = await repository.findOne({where: {name: name}});
        if (!player) {
          logger.error(`[test] Player ${name} does not exist`);
          throw new Error(`${name} user is not found`);
        }
      } else {
        if (!uuid || !deviceId) {
          errors.push('uuid and deviceId should be specified to login');
        }
      }
    }

    if (errors.length) {
      resp.status(500).send(JSON.stringify({errors: errors}));
      return;
    }

    if (!player) {
      if (email) {
        player = await repository.findOne({where: {email: email}});
      } else {
        player = await repository.findOne({where: {uuid: uuid}});
      }
    }

    if (!player) {
      resp.status(401).send(JSON.stringify({errors: ['Player is not found']}));
      return;
    }

    if (!name) {
      if (email) {
        if (password !== player.password) {
          resp.status(401).send(JSON.stringify({errors: ['Invalid password']}));
          return;
        }
      } else {
        if (deviceId !== player.deviceId) {
          resp
            .status(401)
            .send(JSON.stringify({errors: ['Invalid device id']}));
          return;
        }
      }
    }

    const expiryTime = new Date();
    expiryTime.setDate(expiryTime.getDate() + JWT_EXPIRY_DAYS);
    const jwtClaims = {
      user: player.name,
      uuid: player.uuid,
      id: player.id,
      // iat: new Date(),
      // exp: expiryTime,
    };
    try {
      const jwt = generateAccessToken(jwtClaims);
      resp.status(200).send(JSON.stringify({jwt: jwt}));
      return;
    } catch (err) {
      logger.error(err.toString());
      resp.status(500).send({errors: ['JWT cannot be generated']});
      return;
    }
  } catch (err) {
    resp.status(500).send({error: err.message});
  }
}

/**
 * Signup API
 * @param req
 * {
 *  "device-id": <uuid assigned in the device>,
 *  "screen-name": "player screen name",
 *  "display-name": "player name",
 *  "email": "recovery email address"
 * }
 *
 * A player is registered to the system using signup api
 * @param resp
 * {
 *   "device-secret": "device secret created for the user"
 * }
 */
export async function signup(req: any, resp: any) {
  const payload = req.body;

  const name = payload['screen-name'];
  const deviceId = payload['device-id'];
  const email = payload['email'];
  const displayName = payload['display-name'];
  const bot = payload['bot'];

  const errors = new Array<string>();
  if (!name) {
    errors.push('screen-name field is required');
  }

  if (!deviceId) {
    errors.push('device-id field is required');
  }

  if (errors.length >= 1) {
    resp.status(400).send(JSON.stringify({errors: errors}));
    return;
  }

  const regPayload: UserRegistrationPayload = {
    name: name,
    deviceId: deviceId,
    email: email,
    displayName: displayName,
    bot: bot,
  };

  let player: Player;
  try {
    player = await PlayerRepository.registerUser(regPayload);
  } catch (err) {
    logger.error(err.toString());
    resp.status(500).send({errors: [err.toString()]});
    return;
  }

  try {
    const expiryTime = new Date();
    expiryTime.setDate(expiryTime.getDate() + JWT_EXPIRY_DAYS);
    const jwtClaims = {
      user: player.name,
      uuid: player.uuid,
      id: player.id,
    };
    const jwt = generateAccessToken(jwtClaims);
    const response = {
      'device-secret': player.deviceSecret,
      jwt: jwt,
      name: player.name,
      uuid: player.uuid,
      id: player.id,
    };
    resp.contentType('application/json');
    resp.status(200).send(JSON.stringify(response));
  } catch (err) {
    logger.error(err.toString());
    resp.status(500).send({errors: ['JWT cannot be generated']});
  }
}

/**
 * Login API
 * @param req
 * {
 *  "device-id": <uuid assigned in the device>,
 *  "device-secret": device secret assigned to the device,
 * }
 *
 * Logs in as the user and returns a JWT
 * @param resp
 * {
 *   "jwt": "jwt for auth header"
 * }
 */
export async function newlogin(req: any, resp: any) {
  const payload = req.body;

  const deviceId = payload['device-id'];
  const deviceSecret = payload['device-secret'];

  const errors = new Array<string>();
  if (!deviceId) {
    errors.push('device-id field is required');
  }

  if (!deviceSecret) {
    errors.push('device-secret field is required');
  }

  if (errors.length >= 1) {
    resp.status(400).send(JSON.stringify({errors: errors}));
    return;
  }

  let player: Player | null;
  try {
    player = await PlayerRepository.getPlayerUsingDeviceId(deviceId);
    if (!player) {
      resp
        .status(403)
        .send({errors: [`Player with device id ${deviceId} does not exist`]});
      return;
    }

    if (player.deviceSecret !== deviceSecret) {
      resp.status(403).send({
        errors: [`Login failed for ${deviceId}. Incorrect device secret.`],
      });
      return;
    }
  } catch (err) {
    logger.error(err.toString());
    resp.status(500).send({errors: ['Unexpected error']});
    return;
  }

  try {
    const expiryTime = new Date();
    expiryTime.setDate(expiryTime.getDate() + JWT_EXPIRY_DAYS);
    const jwtClaims = {
      user: player.name,
      uuid: player.uuid,
      id: player.id,
    };
    const jwt = generateAccessToken(jwtClaims);
    const response = {
      jwt: jwt,
      name: player.name,
      uuid: player.uuid,
      id: player.id,
    };
    resp.contentType('application/json');
    resp.status(200).send(JSON.stringify(response));
  } catch (err) {
    logger.error(err.toString());
    resp.status(500).send({errors: ['JWT cannot be generated']});
  }
}

/**
 * Logs in using recovery email address
 *
 * @param req
 * {
 *  "email": recovery email address,
 *  "code": generated code,
 *  "device-id": device id
 * }
 *
 * @param resp
 * {
 *   "device-secret": device secret,
 *   "jwt": jwt for the user
 * }
 */
export async function loginUsingRecoveryCode(req: any, resp: any) {
  const payload = req.body;

  const email = payload['email'];
  const code = payload['code'];
  const deviceId = payload['device-id'];

  if (!email) {
    resp.status(403).send({
      status: 'FAIL',
      error: 'Email address is required',
    });
    return;
  }
  if (!code) {
    resp.status(403).send({
      status: 'FAIL',
      error: 'code is required',
    });
    return;
  }
  if (!deviceId) {
    resp.status(403).send({
      status: 'FAIL',
      error: 'New device id is required',
    });
    return;
  }

  let player: Player | null;
  try {
    player = await PlayerRepository.loginUsingRecoveryCode(
      deviceId,
      email,
      code
    );
    if (!player) {
      resp.status(403).send({
        status: 'FAIL',
        error: 'Recovery email address is not found',
      });
      return;
    }
  } catch (err) {
    logger.error(err.toString());
    resp.status(400).send({error: err.message});
    return;
  }

  try {
    const expiryTime = new Date();
    expiryTime.setDate(expiryTime.getDate() + JWT_EXPIRY_DAYS);
    const jwtClaims = {
      user: player.name,
      uuid: player.uuid,
      id: player.id,
    };
    const jwt = generateAccessToken(jwtClaims);
    const response = {
      'device-secret': player.deviceSecret,
      name: player.name,
      uuid: player.uuid,
      id: player.id,
      jwt: jwt,
    };
    resp.status(200).send(JSON.stringify(response));
  } catch (err) {
    logger.error(err.toString());
    resp.status(500).send({errors: ['JWT cannot be generated']});
  }
}

/**
 * Get recovery code API
 * @param req
 * {
 *  "email": recovery email address,
 * }
 *
 * Sends a code to recovery email address
 * @param resp
 * {
 *   "status": "OK"
 * }
 */
export async function getRecoveryCode(req: any, resp: any) {
  const payload = req.body;

  const email = payload['email'];
  if (!email) {
    resp.status(403).send({
      status: 'FAIL',
      error: 'Email address is not found',
    });
    return;
  }

  try {
    const ret = await PlayerRepository.sendRecoveryCode(email);
    if (!ret) {
      resp.status(403).send({
        status: 'FAIL',
        error: 'Email address is not found',
      });
      return;
    }
    resp.status(200).send({status: 'OK'});
  } catch (err) {
    logger.error(err.toString());
    resp.status(500).send({status: 'FAIL', error: err.message});
    return;
  }
}

// username is in the form { username: "my cool username" }
// ^^the above object structure is completely arbitrary
function generateAccessToken(payload) {
  // expires after 3 days
  return jwt.sign(payload, getJwtSecret(), {expiresIn: `${JWT_EXPIRY_DAYS}d`});
}
