import {GameRepository} from '@src/repositories/game';
import {
  GameStatus,
  GameType,
  PlayerStatus,
  TableStatus,
  BuyInApprovalStatus,
  ApprovalType,
  ApprovalStatus,
} from '@src/entity/types';
import {getLogger} from '@src/utils/log';
import {Cache} from '@src/cache/index';
import {WaitListMgmt} from '@src/repositories/waitlist';
import {default as _} from 'lodash';
import {BuyIn} from '@src/repositories/buyin';
import {PokerGame} from '@src/entity/game';
import {fillSeats} from '@src/botrunner';
import {ClubRepository} from '@src/repositories/club';
import {getCurrentHandLog} from '@src/gameserver';
import {isHostOrManagerOrOwner} from './util';
import {processPendingUpdates} from '@src/repositories/pendingupdates';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const humanizeDuration = require('humanize-duration');

const logger = getLogger('game');

export async function configureGame(
  playerId: string,
  clubCode: string,
  game: any
) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const errors = new Array<string>();
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  try {
    logger.info(`Game type: ${game.gameType}`);
    const gameInfo = await GameRepository.createPrivateGame(
      clubCode,
      playerId,
      game
    );
    const ret: any = gameInfo as any;
    ret.gameType = GameType[gameInfo.gameType];
    ret.tableStatus = TableStatus[gameInfo.tableStatus];
    return ret;
  } catch (err) {
    logger.error(JSON.stringify(err));
    throw new Error(`Failed to create a new game. ${JSON.stringify(err)}`);
  }
}

export async function configureGameByPlayer(playerId: string, game: any) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const errors = new Array<string>();
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  try {
    const gameInfo = await GameRepository.createPrivateGameForPlayer(
      playerId,
      game
    );
    const ret: any = gameInfo as any;
    ret.gameType = GameType[gameInfo.gameType];
    return ret;
  } catch (err) {
    logger.error(JSON.stringify(err));
    throw new Error(`Failed to create a new game. ${JSON.stringify(err)}`);
  }
}

export async function endGame(playerId: string, gameCode: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const errors = new Array<string>();
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  try {
    const game = await Cache.getGame(gameCode);

    const isAuthorized = await isHostOrManagerOrOwner(playerId, game);
    if (!isAuthorized) {
      logger.error(
        `Player: ${playerId} is not a owner or a manager ${game.club.name}. Cannot end the game`
      );
      throw new Error(
        `Player: ${playerId} is not a owner or a manager ${game.club.name}. Cannot end the game`
      );
    }

    if (
      game.status === GameStatus.ACTIVE &&
      game.tableStatus === TableStatus.GAME_RUNNING
    ) {
      // the game will be stopped in the next hand
      GameRepository.endGameNextHand(game.id);
    } else {
      await Cache.removeAllObservers(game.gameCode);
      const status = await GameRepository.markGameEnded(game.id);
      return GameStatus[status];
    }
    return GameStatus[game.status];
  } catch (err) {
    logger.error(err.message);
    throw new Error('Failed to end the game. ' + err.message);
  }
}

export async function joinGame(
  playerUuid: string,
  gameCode: string,
  seatNo: number
) {
  if (!playerUuid) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.club) {
      const clubMember = await Cache.isClubMember(
        playerUuid,
        game.club.clubCode
      );
      if (!clubMember) {
        logger.error(
          `Player: ${playerUuid} is not authorized to play game ${gameCode} in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${playerUuid} is not authorized to play game ${gameCode}`
        );
      }
    }

    const player = await Cache.getPlayer(playerUuid);
    const status = await GameRepository.joinGame(player, game, seatNo);
    logger.info(
      `Player: ${player.name} isBot: ${player.bot} joined game: ${game.gameCode}`
    );
    // player is good to go
    const playerStatus = PlayerStatus[status];
    return playerStatus;
  } catch (err) {
    logger.error(JSON.stringify(err));
    console.log(err);
    throw new Error(
      `Player: ${playerUuid} Failed to join the game. ${JSON.stringify(err)}`
    );
  }
}

export async function startGame(
  playerUuid: string,
  gameCode: string
): Promise<string> {
  if (!playerUuid) {
    throw new Error('Unauthorized');
  }
  try {
    let gameNum = 0;
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.club) {
      const clubMember = await Cache.getClubMember(
        playerUuid,
        game.club.clubCode
      );
      if (!clubMember) {
        logger.error(
          `Player: ${playerUuid} is not authorized to start the game ${gameCode} in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${playerUuid} is not authorized to start the game ${gameCode}`
        );
      }

      if (!(clubMember.isManager || clubMember.isOwner)) {
        // this player cannot start this game
        logger.error(
          `Player: ${playerUuid} is not manager or owner. The player is not authorized to start the game ${gameCode} in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${playerUuid} is not manager or owner. The player is not authorized to start the game ${gameCode}`
        );
      }

      gameNum = await ClubRepository.getNextGameNum(game.club.id);
    }

    let players = await GameRepository.getPlayersInSeats(game.id);
    if (game.botGame && players.length < game.maxPlayers) {
      // fill the empty seats with bots
      await fillSeats(game.club.clubCode, game.gameCode);
      await new Promise(r => setTimeout(r, 10000));
    }

    players = await GameRepository.getPlayersInSeats(game.id);
    // do we have enough players in the table
    // if (players.length <= 1) {
    //   throw new Error('We need more players to start the game');
    // }
    // let playersWithStack = 0;
    // for (const player of players) {
    //   if (player.status === PlayerStatus.PLAYING) {
    //     playersWithStack++;
    //   }
    // }

    // if (playersWithStack <= 1) {
    //   throw new Error('Not enough players with stack to start the game');
    // }

    const status = await GameRepository.markGameActive(game.id, gameNum);
    // game is started
    return GameStatus[status];
  } catch (err) {
    logger.error(JSON.stringify(err));
    throw new Error(`Failed to start the game. ${JSON.stringify(err)}`);
  }
}

export async function buyIn(
  playerUuid: string,
  gameCode: string,
  amount: number
) {
  if (!playerUuid) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.club) {
      const clubMember = await Cache.isClubMember(
        playerUuid,
        game.club.clubCode
      );
      if (!clubMember) {
        logger.error(
          `Player: ${playerUuid} is not authorized to play game ${gameCode} in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${playerUuid} is not authorized to play game ${gameCode}`
        );
      }
    }

    const player = await Cache.getPlayer(playerUuid);
    const buyin = new BuyIn(game, player);
    const status = await buyin.request(amount);
    // player is good to go
    return status;
  } catch (err) {
    logger.error(JSON.stringify(err));
    throw new Error(`Failed to update buyin. ${JSON.stringify(err)}`);
  }
}

export async function reload(
  playerUuid: string,
  gameCode: string,
  amount: number
) {
  if (!playerUuid) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.club) {
      const clubMember = await Cache.isClubMember(
        playerUuid,
        game.club.clubCode
      );
      if (!clubMember) {
        logger.error(
          `Player: ${playerUuid} is not authorized to play game ${gameCode} in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${playerUuid} is not authorized to play game ${gameCode}`
        );
      }
    }

    const player = await Cache.getPlayer(playerUuid);
    const buyin = new BuyIn(game, player);
    const status = await buyin.reloadRequest(amount);
    // player is good to go
    return status;
  } catch (err) {
    logger.error(JSON.stringify(err));
    throw new Error(`Failed to update reload. ${JSON.stringify(err)}`);
  }
}

export async function pendingApprovalsForClub(
  hostUuid: string,
  clubCode: string
) {
  if (!hostUuid) {
    throw new Error('Unauthorized');
  }
  try {
    const clubHost = await Cache.getClubMember(hostUuid, clubCode);
    if (!clubHost || !(clubHost.isManager || clubHost.isOwner)) {
      logger.error(
        `Player: ${hostUuid} is not authorized to approve buyIn in club ${clubCode}`
      );
      throw new Error(
        `Player: ${hostUuid} is not authorized to approve buyIn in club ${clubCode}`
      );
    }

    const player = await Cache.getPlayer(hostUuid);
    const club = await Cache.getClub(clubCode);

    const buyin = new BuyIn(new PokerGame(), player);
    const resp = await buyin.pendingApprovalsForClub(club);

    return resp;
  } catch (err) {
    logger.error(JSON.stringify(err));
    throw new Error(
      `Failed to fetch approval requests. ${JSON.stringify(err)}`
    );
  }
}

export async function pendingApprovalsForGame(
  hostUuid: string,
  gameCode: string
) {
  if (!hostUuid) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.club) {
      const clubHost = await Cache.getClubMember(hostUuid, game.club.clubCode);
      if (!clubHost || !(clubHost.isManager || clubHost.isOwner)) {
        logger.error(
          `Player: ${hostUuid} is not authorized to approve buyIn in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${hostUuid} is not authorized to approve buyIn in club ${game.club.name}`
        );
      }
    }

    const player = await Cache.getPlayer(hostUuid);

    const buyin = new BuyIn(game, player);
    const resp = await buyin.pendingApprovalsForGame();

    return resp;
  } catch (err) {
    logger.error(JSON.stringify(err));
    throw new Error(`Failed to approve buyin. ${JSON.stringify(err)}`);
  }
}

export async function completedGame(playerId: string, gameCode: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    const player = await Cache.getPlayer(playerId);

    const resp = await GameRepository.getCompletedGame(gameCode, player.id);
    if (game.endedAt) {
      const runTime = resp.endedAt - resp.startedAt;
      resp.runTime = runTime;
      resp.runTimeStr = humanizeDuration(runTime, {round: true});
    }

    if (resp.sessionTime) {
      resp.sessionTimeStr = humanizeDuration(resp.sessionTime * 1000, {
        round: true,
      });
    }
    if (!resp.endedBy) {
      resp.endedBy = '';
    }

    resp.gameType = GameType[resp.gameType];
    return resp;
  } catch (err) {
    logger.error(JSON.stringify(err));
    throw new Error(`Failed to get game information. ${JSON.stringify(err)}`);
  }
}

export async function getGameResultTable(gameCode: string) {
  try {
    const resp = await GameRepository.getGameResultTable(gameCode);

    for (const r of resp) {
      if (r.sessionTime) {
        r.sessionTimeStr = getSessionTimeStr(r.sessionTime);
      }
    }

    return resp;
  } catch (err) {
    logger.error(JSON.stringify(err));
    throw new Error(`Failed to get game result table. ${JSON.stringify(err)}`);
  }
}

export async function getGamePlayers(gameCode: string) {
  try {
    const resp = await GameRepository.getGamePlayers(gameCode);
    return resp;
  } catch (err) {
    logger.error(JSON.stringify(err));
    throw new Error(
      `Failed to get game players information. ${JSON.stringify(err)}`
    );
  }
}

function getSessionTimeStr(totalSeconds: number): string {
  if (totalSeconds < 60) {
    // "## seconds"
    return humanizeDuration(totalSeconds * 1000);
  }
  if (totalSeconds < 3600) {
    // "## minutes"
    return humanizeDuration(totalSeconds * 1000, {units: ['m'], round: true});
  }
  // "## hours"
  return humanizeDuration(totalSeconds * 1000, {units: ['h'], round: true});
}

export async function approveRequest(
  hostUuid: string,
  playerUuid: string,
  gameCode: string,
  type: ApprovalType,
  status: ApprovalStatus
) {
  if (!hostUuid) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.club) {
      const clubMember = await Cache.getClubMember(
        playerUuid,
        game.club.clubCode
      );
      if (!clubMember) {
        logger.error(
          `Player: ${playerUuid} is not authorized to start the game ${gameCode} in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${playerUuid} is not authorized to start the game ${gameCode}`
        );
      }

      const clubHost = await Cache.getClubMember(hostUuid, game.club.clubCode);
      if (!clubHost || !(clubHost.isManager || clubHost.isOwner)) {
        logger.error(
          `Player: ${hostUuid} is not authorized to approve buyIn in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${hostUuid} is not authorized to approve buyIn in club ${game.club.name}`
        );
      }
    }

    const player = await Cache.getPlayer(playerUuid);
    const buyin = new BuyIn(game, player);
    const resp = await buyin.approve(type, status);
    // player is good to go
    return resp;
  } catch (err) {
    logger.error(JSON.stringify(err));
    throw new Error(`Failed to approve buyin. ${JSON.stringify(err)}`);
  }
}

export async function myGameState(playerUuid: string, gameCode: string) {
  if (!playerUuid) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.club) {
      const clubMember = await Cache.getClubMember(
        playerUuid,
        game.club.clubCode
      );
      if (!clubMember) {
        logger.error(
          `Player: ${playerUuid} is not authorized to start the game ${gameCode} in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${playerUuid} is not authorized to start the game ${gameCode}`
        );
      }
    }

    const player = await Cache.getPlayer(playerUuid);
    const data = await GameRepository.myGameState(player, game);

    const gameState = {
      playerUuid: player.uuid,
      buyIn: data.buyIn,
      stack: data.stack,
      status: PlayerStatus[data.status],
      buyInStatus: BuyInApprovalStatus[data.status],
      playingFrom: data.satAt,
      seatNo: data.seatNo,
    };

    return gameState;
  } catch (err) {
    logger.error(JSON.stringify(err));
    throw new Error(`Failed to get game state. ${JSON.stringify(err)}`);
  }
}

export async function tableGameState(playerUuid: string, gameCode: string) {
  if (!playerUuid) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.club) {
      const clubMember = await Cache.getClubMember(
        playerUuid,
        game.club.clubCode
      );
      if (!clubMember) {
        logger.error(
          `Player: ${playerUuid} is not authorized to start the game ${gameCode} in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${playerUuid} is not authorized to start the game ${gameCode}`
        );
      }
    }
    const player = await Cache.getPlayer(playerUuid);
    const gameState = await GameRepository.tableGameState(game);

    const tableGameState = new Array<any>();
    gameState.map(data => {
      const gameState = {
        playerUuid: data.player.uuid,
        buyIn: data.buyIn,
        stack: data.stack,
        status: PlayerStatus[data.status],
        buyInStatus: BuyInApprovalStatus[data.status],
        playingFrom: data.satAt,
        seatNo: data.seatNo,
      };
      tableGameState.push(gameState);
    });

    return tableGameState;
  } catch (err) {
    logger.error(JSON.stringify(err));
    throw new Error(`Failed to get game state. ${JSON.stringify(err)}`);
  }
}

async function getGameInfo(playerUuid: string, gameCode: string) {
  if (!playerUuid) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }
    let clubCode = '';
    let isHost = false;
    let isManager = false;
    let isOwner = false;
    if (game.club) {
      const clubMember = await Cache.getClubMember(
        playerUuid,
        game.club.clubCode
      );
      clubCode = game.club.clubCode;
      if (!clubMember) {
        logger.error(
          `Player: ${playerUuid} is not authorized to play game ${gameCode} in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${playerUuid} is not authorized to play game ${gameCode}`
        );
      }

      isOwner = clubMember.isOwner;
      isManager = clubMember.isManager;
    }

    const player = await Cache.getPlayer(playerUuid);

    const ret = _.cloneDeep(game) as any;

    if (ret.host) {
      if (ret.host.uuid == playerUuid) {
        isHost = true;
      }
    }

    if (ret.startedBy) {
      ret.startedBy = ret.startedBy.name;
    }
    ret.clubCode = clubCode;
    ret.gameType = GameType[game.gameType];
    ret.tableStatus = TableStatus[game.tableStatus];
    ret.status = GameStatus[game.status];

    const updates = await GameRepository.getGameUpdates(game.id);
    if (updates) {
      ret.rakeCollected = updates.rake;
      ret.lastHandNum = updates.lastHandNum;
    }

    ret.gameToPlayerChannel = `game.${game.gameCode}.player`;
    ret.playerToHandChannel = `player.${game.gameCode}.hand`;
    ret.handToAllChannel = `hand.${game.gameCode}.player.all`;
    ret.handToPlayerChannel = `hand.${game.gameCode}.player.${player.id}`;
    ret.gameChatChannel = `game.${game.gameCode}.chat`;

    // player's role
    ret.isManager = isManager;
    ret.isHost = isHost;
    ret.isOwner = isOwner;

    return ret;
  } catch (err) {
    logger.error(JSON.stringify(err));
    throw new Error(
      `Failed to get game information. Message: ${
        err.message
      } err: ${JSON.stringify(err)}`
    );
  }
}

async function getPlayerRole(playerUuid: string, gameCode: string) {
  if (!playerUuid) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }
    let clubCode = '';
    let isHost = false;
    let isManager = false;
    let isOwner = false;
    if (game.club) {
      const clubMember = await Cache.getClubMember(
        playerUuid,
        game.club.clubCode
      );
      clubCode = game.club.clubCode;
      if (!clubMember) {
        logger.error(
          `Player: ${playerUuid} is not authorized to play game ${gameCode} in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${playerUuid} is not authorized to play game ${gameCode}`
        );
      }

      isOwner = clubMember.isOwner;
      isManager = clubMember.isManager;
    }

    const player = await Cache.getPlayer(playerUuid);
    if (game.host) {
      if (game.host.uuid == playerUuid) {
        isHost = true;
      }
    }
    // player's role
    let ret: any = {};
    ret.isManager = isManager;
    ret.isHost = isHost;
    ret.isOwner = isOwner;

    return ret;
  } catch (err) {
    logger.error(JSON.stringify(err));
    throw new Error(
      `Failed to get game information. Message: ${
        err.message
      } err: ${JSON.stringify(err)}`
    );
  }
}

export async function leaveGame(playerUuid: string, gameCode: string) {
  if (!playerUuid) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await GameRepository.getGameByCode(gameCode);

    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.club) {
      const clubMember = await Cache.getClubMember(
        playerUuid,
        game.club.clubCode
      );
      if (!clubMember) {
        logger.error(
          `Player: ${playerUuid} is not authorized to start the game ${gameCode} in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${playerUuid} is not authorized to start the game ${gameCode}`
        );
      }
    }
    const player = await Cache.getPlayer(playerUuid);
    const status = await GameRepository.leaveGame(player, game);
    return status;
  } catch (err) {
    logger.error(JSON.stringify(err));
    throw new Error(`Failed to leave game. ${JSON.stringify(err)}`);
  }
}

export async function takeBreak(playerUuid: string, gameCode: string) {
  if (!playerUuid) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.club) {
      const clubMember = await Cache.getClubMember(
        playerUuid,
        game.club.clubCode
      );
      if (!clubMember) {
        logger.error(
          `Player: ${playerUuid} is not authorized to start the game ${gameCode} in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${playerUuid} is not authorized to start the game ${gameCode}`
        );
      }
    }
    const player = await Cache.getPlayer(playerUuid);
    const status = await GameRepository.takeBreak(player, game);
    return status;
  } catch (err) {
    logger.error(JSON.stringify(err));
    throw new Error(`Failed to take break. ${JSON.stringify(err)}`);
  }
}

export async function sitBack(playerUuid: string, gameCode: string) {
  if (!playerUuid) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await GameRepository.getGameByCode(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.club) {
      const clubMember = await Cache.getClubMember(
        playerUuid,
        game.club.clubCode
      );
      if (!clubMember) {
        logger.error(
          `Player: ${playerUuid} is not authorized to start the game ${gameCode} in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${playerUuid} is not authorized to start the game ${gameCode}`
        );
      }
    }
    const player = await Cache.getPlayer(playerUuid);
    const status = await GameRepository.sitBack(player, game);
    return status;
  } catch (err) {
    logger.error(err);
    throw new Error(`Failed to take break. ${JSON.stringify(err)}`);
  }
}

export async function kickOutPlayer(
  requestUser: string,
  gameCode: string,
  kickedOutPlayer: string
): Promise<boolean> {
  if (!requestUser) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.club) {
      // club game
      const clubMember = await Cache.getClubMember(
        requestUser,
        game.club.clubCode
      );
      if (!clubMember) {
        logger.error(
          `Player: ${requestUser} is not a club member in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${requestUser} is not authorized to kick out a user`
        );
      }

      if (!(clubMember.isOwner || clubMember.isManager)) {
        // player is not a owner or a manager
        // did this user start the game?
        if (game.startedBy.uuid !== requestUser) {
          logger.error(
            `Player: ${requestUser} cannot kick out a player in ${gameCode}`
          );
          throw new Error(
            `Player: ${requestUser} cannot kick out a player in ${gameCode}`
          );
        }
      }
    } else {
      // hosted by individual user
      if (game.startedBy.uuid !== requestUser) {
        logger.error(
          `Player: ${requestUser} cannot kick out a player in ${gameCode}`
        );
        throw new Error(
          `Player: ${requestUser} cannot kick out a player in ${gameCode}`
        );
      }
    }

    const player = await Cache.getPlayer(kickedOutPlayer);
    await GameRepository.kickOutPlayer(gameCode, player);
    return true;
  } catch (err) {
    logger.error(JSON.stringify(err));
    throw new Error('Failed to kick out player');
  }
}

export async function addToWaitingList(playerId: string, gameCode: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.club) {
      // club game
      const clubMember = await Cache.getClubMember(
        playerId,
        game.club.clubCode
      );
      if (!clubMember) {
        logger.error(
          `Player: ${playerId} is not a club member in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${playerId} is not authorized to kick out a user`
        );
      }
    }
    const waitlistMgmt = new WaitListMgmt(game);
    await waitlistMgmt.addToWaitingList(playerId);
    return true;
  } catch (err) {
    logger.error(JSON.stringify(err));
    throw new Error('Failed to add player to waiting list');
  }
}

export async function removeFromWaitingList(
  playerId: string,
  gameCode: string
) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.club) {
      // club game
      const clubMember = await Cache.getClubMember(
        playerId,
        game.club.clubCode
      );
      if (!clubMember) {
        logger.error(
          `Player: ${playerId} is not a club member in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${playerId} is not authorized to kick out a user`
        );
      }
    }
    const waitlistMgmt = new WaitListMgmt(game);
    await waitlistMgmt.removeFromWaitingList(playerId);
    return true;
  } catch (err) {
    logger.error(JSON.stringify(err));
    throw new Error('Failed to remove player from waiting list');
  }
}

export async function waitingList(
  playerId: string,
  gameCode: string
): Promise<Array<any>> {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.club) {
      // club game
      const clubMember = await Cache.getClubMember(
        playerId,
        game.club.clubCode
      );
      if (!clubMember) {
        logger.error(
          `Player: ${playerId} is not a club member in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${playerId} is not authorized to kick out a user`
        );
      }
    }
    const waitlistMgmt = new WaitListMgmt(game);
    return waitlistMgmt.getWaitingListUsers();
  } catch (err) {
    logger.error(JSON.stringify(err));
    throw new Error('Failed to kick out player');
  }
}

export async function applyWaitlistOrder(
  hostUuid: string,
  gameCode: string,
  players: Array<string>
): Promise<boolean> {
  if (!hostUuid) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.club) {
      // club game
      const clubMember = await Cache.getClubMember(
        hostUuid,
        game.club.clubCode
      );
      if (!clubMember) {
        logger.error(
          `Player: ${hostUuid} is not a club member in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${hostUuid} is not authorized to kick out a user`
        );
      }

      if (!(clubMember.isOwner || clubMember.isManager)) {
        // player is not a owner or a manager
        // did this user start the game?
        if (game.startedBy.uuid !== hostUuid) {
          logger.error(
            `Player: ${hostUuid} cannot change waitlist order in ${gameCode}`
          );
          throw new Error(
            `Player: ${hostUuid} cannot change waitlist order in ${gameCode}`
          );
        }
      }
    } else {
      // hosted by individual user
      if (game.startedBy.uuid !== hostUuid) {
        logger.error(
          `Player: ${hostUuid} cannot change waitlist order in ${gameCode}`
        );
        throw new Error(
          `Player: ${hostUuid} cannot change waitlist order in ${gameCode}`
        );
      }
    }

    const waitlistMgmt = new WaitListMgmt(game);
    await waitlistMgmt.applyWaitlistOrder(players);
    return true;
  } catch (err) {
    logger.error(JSON.stringify(err));
    throw new Error('Failed to change waitlist order');
  }
}

export async function declineWaitlistSeat(playerId: string, gameCode: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.club) {
      // club game
      const clubMember = await Cache.getClubMember(
        playerId,
        game.club.clubCode
      );
      if (!clubMember) {
        logger.error(
          `Player: ${playerId} is not a club member in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${playerId} is not authorized to kick out a user`
        );
      }
    }
    const waitlistMgmt = new WaitListMgmt(game);
    const player = await Cache.getPlayer(playerId);
    await waitlistMgmt.declineWaitlistSeat(player);
    return true;
  } catch (err) {
    logger.error(JSON.stringify(err));
    throw new Error('Failed to add player to waiting list');
  }
}

export async function pauseGame(playerId: string, gameCode: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const errors = new Array<string>();
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  try {
    const game = await Cache.getGame(gameCode);

    const isAuthorized = await isHostOrManagerOrOwner(playerId, game);
    if (!isAuthorized) {
      logger.error(
        `Player: ${playerId} is not a owner or a manager ${game.club.name}. Cannot pause game`
      );
      throw new Error(
        `Player: ${playerId} is not a owner or a manager ${game.club.name}. Cannot pause game`
      );
    }

    if (
      game.status === GameStatus.ACTIVE &&
      game.tableStatus === TableStatus.GAME_RUNNING
    ) {
      // the game will be stopped in the next hand
      GameRepository.pauseGameNextHand(game.id);
    } else {
      const status = await GameRepository.markGameStatus(
        game.id,
        GameStatus.PAUSED
      );
      return GameStatus[status];
    }
    return GameStatus[game.status];
  } catch (err) {
    logger.error(err.message);
    throw new Error('Failed to pause the game. ' + err.message);
  }
}

export async function resumeGame(playerId: string, gameCode: string) {
  if (!playerId) {
    throw new Error('Unauthorized');
  }
  const errors = new Array<string>();
  if (errors.length > 0) {
    throw new Error(errors.join('\n'));
  }
  try {
    const game = await Cache.getGame(gameCode);

    const isAuthorized = await isHostOrManagerOrOwner(playerId, game);
    if (!isAuthorized) {
      logger.error(
        `Player: ${playerId} is not a owner or a manager ${game.club.name}. Cannot resume game`
      );
      throw new Error(
        `Player: ${playerId} is not a owner or a manager ${game.club.name}. Cannot resume game`
      );
    }

    if (game.status === GameStatus.PAUSED) {
      logger.info(`Resume game: ${gameCode}`);
      const status = await GameRepository.markGameStatus(
        game.id,
        GameStatus.ACTIVE
      );
      await processPendingUpdates(game.id);
      return GameStatus[status];
    }
    return GameStatus[game.status];
  } catch (err) {
    logger.error(err.message);
    throw new Error(
      `Failed to resume game:  ${err.message}. Game code: ${gameCode}`
    );
  }
}

export async function switchSeat(
  playerUuid: string,
  gameCode: string,
  seatNo: number
) {
  if (!playerUuid) {
    throw new Error('Unauthorized');
  }
  try {
    // get game using game code
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game ${gameCode} is not found`);
    }

    if (game.club) {
      const clubMember = await Cache.isClubMember(
        playerUuid,
        game.club.clubCode
      );
      if (!clubMember) {
        logger.error(
          `Player: ${playerUuid} is not authorized to play game ${gameCode} in club ${game.club.name}`
        );
        throw new Error(
          `Player: ${playerUuid} is not authorized to play game ${gameCode}`
        );
      }
    }

    const player = await Cache.getPlayer(playerUuid);
    const status = await GameRepository.switchSeat(player, game, seatNo);
    logger.info(
      `Player: ${player.name} isBot: ${player.bot} switched seat game: ${game.gameCode}`
    );
    // player is good to go
    const playerStatus = PlayerStatus[status];
    return playerStatus;
  } catch (err) {
    logger.error(JSON.stringify(err));
    console.log(err);
    throw new Error(
      `Player: ${playerUuid} Failed to join the game. ${JSON.stringify(err)}`
    );
  }
}

const resolvers: any = {
  Query: {
    gameById: async (parent, args, ctx, info) => {
      const game = await Cache.getGame(args.gameCode);
      return {
        id: game.id,
      };
    },
    myGameState: async (parent, args, ctx, info) => {
      return myGameState(ctx.req.playerId, args.gameCode);
    },
    tableGameState: async (parent, args, ctx, info) => {
      return tableGameState(ctx.req.playerId, args.gameCode);
    },
    gameInfo: async (parent, args, ctx, info) => {
      return await getGameInfo(ctx.req.playerId, args.gameCode);
    },
    playerRole: async (parent, args, ctx, info) => {
      return await getPlayerRole(ctx.req.playerId, args.gameCode);
    },
    waitingList: async (parent, args, ctx, info) => {
      return await waitingList(ctx.req.playerId, args.gameCode);
    },
    pendingApprovalsForClub: async (parent, args, ctx, info) => {
      return await pendingApprovalsForClub(ctx.req.playerId, args.clubCode);
    },
    pendingApprovalsForGame: async (parent, args, ctx, info) => {
      return await pendingApprovalsForGame(ctx.req.playerId, args.gameCode);
    },
    completedGame: async (parent, args, ctx, info) => {
      return await completedGame(ctx.req.playerId, args.gameCode);
    },
    currentHandLog: async (parent, args, ctx, info) => {
      const game = await Cache.getGame(args.gameCode);
      logger.info(`Getting current hand log for ${args.gameCode}`);
      return getCurrentHandLog(game.id);
    },
    gameResultTable: async (parent, args, ctx, info) => {
      return await getGameResultTable(args.gameCode);
    },
    gamePlayers: async (parent, args, ctx, info) => {
      return await getGamePlayers(args.gameCode);
    },
  },
  GameInfo: {
    seatInfo: async (parent, args, ctx, info) => {
      const game = await Cache.getGame(parent.gameCode);
      const playersInSeats = await GameRepository.getPlayersInSeats(game.id);
      for (const player of playersInSeats) {
        player.status = PlayerStatus[player.status];
      }

      const takenSeats = playersInSeats.map(x => x.seatNo);
      const availableSeats: Array<number> = [];
      for (let seatNo = 1; seatNo <= game.maxPlayers; seatNo++) {
        if (takenSeats.indexOf(seatNo) === -1) {
          availableSeats.push(seatNo);
        }
      }
      return {
        playersInSeats: playersInSeats,
        availableSeats: availableSeats,
      };
    },
    gameToken: async (parent, args, ctx, info) => {
      const game = await Cache.getGame(parent.gameCode);
      let playerState = ctx['playerState'];
      if (!playerState) {
        // get player's game state
        playerState = await GameRepository.getGamePlayerState(
          game.id,
          ctx.req.playerId
        );
        ctx['playerState'] = playerState;
      }
      if (playerState) {
        return playerState.gameToken;
      }
      return null;
    },
    playerGameStatus: async (parent, args, ctx, info) => {
      const game = await Cache.getGame(parent.gameCode);
      let playerState = ctx['playerState'];
      if (!playerState) {
        // get player's game state
        playerState = await GameRepository.getGamePlayerState(
          game.id,
          ctx.req.playerId
        );
        ctx['playerState'] = playerState;
      }
      if (playerState) {
        return PlayerStatus[playerState.playerStatus];
      }
      return PlayerStatus[PlayerStatus.NOT_PLAYING];
    },
  },
  CompletedGame: {
    stackStat: async (parent, args, ctx, info) => {
      if (parent.hand_stack) {
        const stack = JSON.parse(parent.hand_stack);
        return stack.map(x => {
          return {
            handNum: x.hand,
            before: x.playerStack.before,
            after: x.playerStack.after,
          };
        });
      } else {
        return [];
      }
    },
  },
  Mutation: {
    configureGame: async (parent, args, ctx, info) => {
      return configureGame(ctx.req.playerId, args.clubCode, args.game);
    },
    configureFriendsGame: async (parent, args, ctx, info) => {
      return configureGameByPlayer(ctx.req.playerId, args.game);
    },
    joinGame: async (parent, args, ctx, info) => {
      return joinGame(ctx.req.playerId, args.gameCode, args.seatNo);
    },
    endGame: async (parent, args, ctx, info) => {
      return endGame(ctx.req.playerId, args.gameCode);
    },
    pauseGame: async (parent, args, ctx, info) => {
      return pauseGame(ctx.req.playerId, args.gameCode);
    },
    resumeGame: async (parent, args, ctx, info) => {
      return resumeGame(ctx.req.playerId, args.gameCode);
    },
    buyIn: async (parent, args, ctx, info) => {
      const status = await buyIn(ctx.req.playerId, args.gameCode, args.amount);
      return status;
    },
    reload: async (parent, args, ctx, info) => {
      return reload(ctx.req.playerId, args.gameCode, args.amount);
    },
    approveRequest: async (parent, args, ctx, info) => {
      return approveRequest(
        ctx.req.playerId,
        args.playerUuid,
        args.gameCode,
        args.type,
        args.status
      );
    },
    startGame: async (parent, args, ctx, info) => {
      return startGame(ctx.req.playerId, args.gameCode);
    },
    takeBreak: async (parent, args, ctx, info) => {
      return takeBreak(ctx.req.playerId, args.gameCode);
    },
    sitBack: async (parent, args, ctx, info) => {
      return sitBack(ctx.req.playerId, args.gameCode);
    },
    leaveGame: async (parent, args, ctx, info) => {
      return leaveGame(ctx.req.playerId, args.gameCode);
    },
    kickOut: async (parent, args, ctx, info) => {
      return kickOutPlayer(ctx.req.playerId, args.gameCode, args.playerUuid);
    },
    addToWaitingList: async (parent, args, ctx, info) => {
      return addToWaitingList(ctx.req.playerId, args.gameCode);
    },
    removeFromWaitingList: async (parent, args, ctx, info) => {
      return removeFromWaitingList(ctx.req.playerId, args.gameCode);
    },
    applyWaitlistOrder: async (parent, args, ctx, info) => {
      return applyWaitlistOrder(
        ctx.req.playerId,
        args.gameCode,
        args.playerUuid
      );
    },
    declineWaitlistSeat: async (parent, args, ctx, info) => {
      return declineWaitlistSeat(ctx.req.playerId, args.gameCode);
    },
    switchSeat: async (parent, args, ctx, info) => {
      return switchSeat(ctx.req.playerId, args.gameCode, args.seatNo);
    },
  },
};

export function getResolvers() {
  return resolvers;
}
