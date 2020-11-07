import * as nats from 'nats';
import {getLogger} from '@src/utils/log';

let natsEnabled = false;
let natsAddr = 'nats://localhost:4222';
let nc: nats.Client;
//natsEnabled = true;
const logger = getLogger('nats');

export function initializeNats() {
  if (process.env.NATS_ADDR) {
    natsAddr = process.env.NATS_ADDR;
  }

  if (process.env.USE_NATS === '1') {
    natsEnabled = true;
  }

  if (natsEnabled) {
    try {
      logger.info(`Connecting to nats server: ${natsAddr}`);
      const opts: nats.ClientOpts = {
        json: true,
      };
      nc = nats.connect(natsAddr, opts);
      logger.info(`Connecting to nats server: ${natsAddr} succeeded`);
    } catch (err) {
      logger.info(
        `Connecting to nats server: ${natsAddr} failed. Error: ${err.toString()}`
      );
    }
  }
}

export function publishNewGame(gameServer: number, game: any) {
  if (!natsEnabled) {
    return;
  }

  const message = {
    type: 'NewGame',
    gameServer: gameServer,
    clubId: game.club.id,
    gameId: game.id,
    clubCode: game.club.clubCode,
    gameCode: game.gameCode,
    gameType: game.gameType,
    title: game.title,
    game: {
      smallBlind: game.smallBlind,
      bigBlind: game.bigBlind,
      straddleBet: game.straddleBet,
      utgStraddleBetAllowed: game.utgStraddleBetAllowed,
      minPlayers: game.minPlayers,
      maxPlayers: game.maxPlayers,
      gameLength: game.gameLength,
      rakePercentage: game.rakePercentage,
      rakeCap: game.rakeCap,
      buyInMin: game.buyInMin,
      buyInMax: game.buyInMax,
      actionTime: game.actionTime,
      privateGame: game.privateRoom,
      startedBy: game.startedBy.name,
      startedByUuid: game.startedBy.uuid,
      breakLength: game.breakLength,
      autoKickAfterBreak: game.autoKickAfterBreak,
    },
  };

  nc.publish('apiserver.gameserver', message);
}
