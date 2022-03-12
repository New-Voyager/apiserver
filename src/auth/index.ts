import * as jwt from 'jsonwebtoken';
import {Player} from '@src/entity/player/player';
import {getUserRepository} from '@src/repositories';
import {PlayerRepository} from '@src/repositories/player';
import {UserRegistrationPayload} from '@src/types';
import {errToStr, getLogger} from '@src/utils/log';
import {LocationCheck} from '@src/repositories/locationcheck';

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
      logger.error(`Failed to generate JWT token. ${errToStr(err)}`);
      resp.status(500).send({errors: ['JWT cannot be generated']});
      return;
    }
  } catch (err) {
    logger.error(`Failed to authenticate user. ${errToStr(err)}`);
    resp.status(500).send({error: errToStr(err)});
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
  const deviceModel = payload['device-model'];
  const deviceOs = payload['device-os'];
  const attribsUsed = payload['attribs-used'];
  const physicalDimension = payload['physical-dimension'];
  const screenDimension = payload['screen-dimension'];
  const appVersion = payload['app-version'];
  // "device-model": DeviceInfo.model,
  // "device-os": DeviceInfo.version,
  // "attribs-used": attribs.name,
  // "physcial-dimension": Screen.physicalSize.toString(),
  // "screen-dimension": Screen.size.toString(),

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
    deviceModel: deviceModel,
    deviceOS: deviceOs,
    physicalDimension: physicalDimension,
    screenDimension: screenDimension,
    attribsUsed: attribsUsed,
    appVersion: appVersion,
  };

  let player: Player;
  try {
    player = await PlayerRepository.registerUser(regPayload);
  } catch (err) {
    logger.error(`Failed to register user. ${errToStr(err)}`);
    resp.status(500).send({errors: [errToStr(err)]});
    return;
  }

  try {
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
    const geodata = LocationCheck.getCity(req.userIp);
    if (geodata) {
      await PlayerRepository.updatePlayerGeoData(
        player.uuid,
        geodata.continent,
        geodata.country,
        geodata.state,
        geodata.city,
        geodata.postalCode
      );
    }
  } catch (err) {}

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
    logger.error(`Failed to register user. ${errToStr(err)}`);
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
    logger.error(`Failed to login user ${deviceId}. ${errToStr(err)}`);
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

    // update last active date
    await PlayerRepository.updateLastActiveDate(player.uuid);
    resp.contentType('application/json');
    resp.status(200).send(JSON.stringify(response));
  } catch (err) {
    logger.error(`Failed to login user ${deviceId}. ${errToStr(err)}`);
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
    logger.error(
      `Failed to send recovery code for user ${deviceId}. ${errToStr(err)}`
    );
    resp.status(400).send({error: errToStr(err)});
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
    logger.error(
      `Failed to login user using recovery code ${deviceId}. ${errToStr(err)}`
    );
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
    logger.error(
      `Failed to send recovery code for user ${email}. ${errToStr(err)}`
    );
    resp.status(500).send({status: 'FAIL', error: errToStr(err)});
    return;
  }
}

// username is in the form { username: "my cool username" }
// ^^the above object structure is completely arbitrary
function generateAccessToken(payload) {
  // expires after 3 days
  return jwt.sign(payload, getJwtSecret(), {expiresIn: `${JWT_EXPIRY_DAYS}d`});
}

/**
 * Logs in using bot name
 * @param resp
 * {
 *   "device-secret": device secret,
 *   "jwt": jwt for the user
 * }
 */
export async function loginBot(req: any, resp: any) {
  try {
    const botName = req.params.botName;
    if (!botName) {
      const res = {error: 'Bot name should be specified'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }

    let player: Player | null;
    try {
      player = await PlayerRepository.loginBot(botName);
      if (!player) {
        resp.status(403).send({
          status: 'FAIL',
          error: `Bot ${botName} is not found`,
        });
        return;
      }
    } catch (err) {
      logger.error(`Failed to login bot ${botName}. ${errToStr(err)}`);
      resp.status(400).send({error: errToStr(err)});
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
      logger.error(`Failed to login bot ${botName}. ${errToStr(err)}`);
      resp.status(500).send({errors: ['JWT cannot be generated']});
    }
  } catch (e) {
    resp.status(500).send({errors: errToStr(e)});
  }
}

/**
 * Logs in using bot name
 * @param resp
 * {
 *   "device-secret": device secret,
 *   "jwt": jwt for the user
 * }
 */
export async function loginPlayer(req: any, resp: any) {
  try {
    const playerId = req.params.playerId;
    if (!playerId) {
      const res = {error: 'Player id should be specified'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }

    let player: Player | null;
    try {
      player = await PlayerRepository.loginPlayer(playerId);
      if (!player) {
        resp.status(403).send({
          status: 'FAIL',
          error: `Player ${playerId} is not found`,
        });
        return;
      }
    } catch (err) {
      logger.error(`Failed to login player ${playerId}. ${errToStr(err)}`);
      resp.status(400).send({error: errToStr(err)});
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
      logger.error(`Failed to login player ${playerId}. ${errToStr(err)}`);
      resp.status(500).send({errors: ['JWT cannot be generated']});
    }
  } catch (e) {
    resp.status(500).send({errors: errToStr(e)});
  }
}
