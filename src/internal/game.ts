import {GameStatus, GameType, TableStatus} from '@src/entity/types';
import {GameRepository} from '@src/repositories/game';
import {processPendingUpdates} from '@src/repositories/pendingupdates';
import {errToLogString, getLogger} from '@src/utils/log';
import {Cache} from '@src/cache/index';
import {PokerGame} from '@src/entity/game/game';
import {PlayerStatus} from '@src/entity/types';
import _ from 'lodash';
import {delay} from '@src/utils';
import {getGameManager, getGameRepository} from '@src/repositories';
import {GameReward} from '@src/entity/game/reward';
import {NextHandProcess} from '@src/repositories/nexthand';
import {GameSettingsRepository} from '@src/repositories/gamesettings';
import {PlayersInGameRepository} from '@src/repositories/playersingame';
import {Aggregation} from '@src/repositories/aggregate';

const logger = getLogger('internal::game');

/**
 * These APIs are only available for game server.
 */
class GameAPIs {
  public async updatePlayerGameState(req: any, resp: any) {
    const gameID = req.body.gameId;
    if (!gameID) {
      const res = {error: 'Invalid game id'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }
    const gameStatus = req.body.status;
    if (!gameStatus) {
      const res = {error: 'Invalid game status'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }
    const playerID = req.body.playerId;
    if (!playerID) {
      const res = {error: 'Invalid player id'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }
    try {
      await GameRepository.markPlayerGameState(playerID, gameID, gameStatus);
      resp.status(200).send({status: 'OK'});
    } catch (err) {
      logger.error(
        `Error while updating player game state for game ${gameID}, player ${playerID}: ${errToLogString(
          err
        )}`
      );
      resp.status(500).send({error: err.message});
    }
  }

  public async updateGameStatus(req: any, resp: any) {
    const gameID = req.body.gameId;
    if (!gameID) {
      const res = {error: 'Invalid game id'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }
    const gameStatus = req.body.status;
    if (!gameStatus) {
      const res = {error: 'Invalid game status'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }

    try {
      await GameRepository.markGameStatus(gameID, gameStatus);
      resp.status(200).send({status: 'OK'});
    } catch (err) {
      logger.error(
        `Error while updating game status for game ${gameID} to ${gameStatus}: ${errToLogString(
          err
        )}`
      );
      resp.status(500).send({error: err.message});
    }
  }

  public async updateTableStatus(req: any, resp: any) {
    const gameID = req.body.gameId;
    if (!gameID) {
      const res = {error: 'Invalid game id'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }
    let tableStatus: TableStatus;
    if (typeof req.body.status === 'number') {
      tableStatus = req.body.status;
    } else {
      tableStatus = TableStatus[req.body.status] as unknown as TableStatus;
    }
    if (!tableStatus) {
      const res = {error: 'Invalid table status'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }

    try {
      await GameRepository.markTableStatus(gameID, tableStatus);
      resp.status(200).send({status: 'OK'});
    } catch (err) {
      logger.error(
        `Error while updating table status for game ${gameID} to ${tableStatus}: ${errToLogString(
          err
        )}`
      );
      resp.status(500).send(JSON.stringify({error: err.message}));
    }
  }

  public async anyPendingUpdates(req: any, resp: any) {
    const gameID = req.params.gameId;
    if (!gameID) {
      const res = {error: 'Invalid game id'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }
    try {
      const pendingUpdates = await GameRepository.anyPendingUpdates(gameID);
      resp.status(200).send({pendingUpdates: pendingUpdates});
    } catch (err) {
      logger.error(
        `Error while checking for any pending updates for game ${gameID}: ${errToLogString(
          err
        )}`
      );
      resp.status(500).send(JSON.stringify({error: err.message}));
    }
  }

  public async processPendingUpdates(req: any, resp: any) {
    const gameIDStr = req.params.gameId;
    if (!gameIDStr) {
      const res = {error: 'Invalid game id'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }
    const gameID = parseInt(gameIDStr);
    if (!gameID) {
      const res = {error: `Invalid game id ${gameIDStr}`};
      resp.status(500).send(JSON.stringify(res));
      return;
    }
    try {
      await processPendingUpdates(gameID);
      resp.status(200).send({status: 'OK'});
    } catch (err) {
      logger.error(
        `Error while processing pending updates for game ${gameID}: ${errToLogString(
          err
        )}`
      );
      resp.status(500).send(JSON.stringify({error: err.message}));
    }
  }

  public async getGame(req: any, resp: any) {
    const clubID = req.params.clubID;
    if (!clubID) {
      const res = {error: 'Invalid club id'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }
    const gameNum = req.params.gameNum;
    if (!gameNum) {
      const res = {error: 'Invalid game num'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }

    resp.status(200).send({status: 'OK'});
  }

  public async getGameInfo(req: any, resp: any) {
    const gameCode = req.params.gameCode;
    if (!gameCode) {
      const res = {error: 'Invalid game code'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }

    let retryCount = 10;
    let gameFound = false;
    while (retryCount > 0 && !gameFound) {
      try {
        retryCount--;

        const ret = await getGameManager().transaction(
          async transactionEntityManager => {
            const game: PokerGame = await Cache.getGame(
              gameCode,
              false,
              transactionEntityManager
            );
            if (!game) {
              throw new Error(`Game ${gameCode} is not found`);
            }
            const gameSettings = await GameSettingsRepository.get(
              game.gameCode,
              false,
              transactionEntityManager
            );
            const playersInSeats =
              await PlayersInGameRepository.getPlayersInSeats(
                game.id,
                transactionEntityManager
              );
            const players = new Array<any>();
            for (const playerInSeat of playersInSeats) {
              const player = playerInSeat as any;
              player.status = PlayerStatus[player.status];
              player.buyInExpTime = player.buyInExpAt;
              player.breakExpTime = player.breakTimeExpAt;
              players.push(player);
            }

            const takenSeats = players.map(x => x.seatNo);
            const availableSeats: Array<number> = [];
            for (let seatNo = 1; seatNo <= game.maxPlayers; seatNo++) {
              if (takenSeats.indexOf(seatNo) === -1) {
                availableSeats.push(seatNo);
              }
            }
            const gameRewardRepository =
              transactionEntityManager.getRepository(GameReward);
            const gameRewards: GameReward[] = await gameRewardRepository.find({
              where: {
                gameId: game.id,
              },
            });
            const rewardTrackingIds = gameRewards.map(
              r => r.rewardTrackingId.id
            );
            const ret: any = {
              clubId: game.clubId,
              gameId: game.id,
              gameCode: game.gameCode,
              gameType: game.gameType,
              title: game.title,
              status: game.status,
              tableStatus: game.tableStatus,
              smallBlind: game.smallBlind,
              bigBlind: game.bigBlind,
              straddleBet: game.straddleBet,
              utgStraddleAllowed: game.utgStraddleAllowed,
              maxPlayers: game.maxPlayers,
              gameLength: game.gameLength,
              rakePercentage: game.rakePercentage,
              rakeCap: game.rakeCap,
              buyInMin: game.buyInMin,
              buyInMax: game.buyInMax,
              actionTime: game.actionTime,
              privateGame: game.privateGame,
              startedBy: game.hostName,
              startedByUuid: game.hostUuid,
              breakLength: gameSettings.breakLength,
              autoKickAfterBreak: game.autoKickAfterBreak,
              rewardTrackingIds: rewardTrackingIds,
              seatInfo: {
                playersInSeats: playersInSeats,
                availableSeats: availableSeats,
              },
            };
            return ret;
          }
        );

        resp.status(200).send(JSON.stringify(ret));
        gameFound = true;
        break;
      } catch (err) {
        logger.error(
          `Error while getting game info for game [${gameCode}]: ${errToLogString(
            err
          )}`
        );
        if (retryCount === 0) {
          resp.status(500).send(JSON.stringify({error: err.message}));
          return;
        }
      }
      await delay(1000);
    }
  }

  public async startGame(req: any, resp: any) {
    const clubID = parseInt(req.param('club-id'));
    if (!clubID) {
      const res = {error: 'Invalid club id'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }
    const gameID = parseInt(req.param('game-id'));
    if (!gameID) {
      const res = {error: 'Invalid game id'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }
    try {
      await GameRepository.markGameStatus(gameID, GameStatus.ACTIVE);
      resp.status(200).send({status: 'OK'});
    } catch (err) {
      logger.error(
        `Error while starting game ${gameID}: ${errToLogString(err)}`
      );
      resp.status(500).send({error: err.message});
    }
  }

  public async moveToNextHand(req: any, resp: any) {
    if (!req.params?.gameCode) {
      const res = {
        error: `Invalid game code [${req.params?.gameCode}] in moveToNextHand`,
      };
      resp.status(500).send(JSON.stringify(res));
      return;
    }
    if (!req.params?.currentHandNum) {
      const res = {
        error: `Invalid current hand number [${req.params?.currentHandNum}] in moveToNextHand`,
      };
      resp.status(500).send(JSON.stringify(res));
      return;
    }
    const gameCode = req.params.gameCode;
    const gameServerHandNum = parseInt(req.params.currentHandNum, 10);
    logger.debug(
      `moveToNextHand called for game: ${gameCode} game server current hand number: ${gameServerHandNum}`
    );
    if (gameServerHandNum < 0) {
      const res = {
        error: `Invalid hand number [${gameServerHandNum}] in moveToNextHand. Must be a positive number`,
      };
      resp.status(500).send(JSON.stringify(res));
      return;
    }

    try {
      const nextHandProcess = new NextHandProcess(gameCode, gameServerHandNum);
      const ret = await nextHandProcess.moveToNextHand();
      resp.status(200).send(JSON.stringify(ret));
    } catch (err) {
      logger.error(
        `Error while moving game ${gameCode} to next hand: ${errToLogString(
          err
        )}`
      );
      resp.status(500).send({error: err.message});
    }
  }

  //
  // WARNING
  //
  //
  // AS THE FUNCTION NAME SUGGESTS, THIS IS A 'GETTER' FUNCTION.
  // WHEN GAME SERVER CALLS THIS FUNCTION MORE THAN ONCE DUE TO A
  // CRASH-RESTART, IT IS IMPORTANT THAT THIS FUNCTION RETURNS THE SAME DATA.
  // WE SHOULD TRY NOT TO HAVE ANY SIDE EFFECTS IN THIS FUNCTION
  // THAT WILL ALTER THE RETURNED DATA IN THE SUBSEQUENT CALLS.
  // USE moveToNextHand FUNCTION INSTEAD FOR ANY MUTATIONS. THAT
  // FUNCTION HAS A GUARD AGAINST EXECUTING MULTIPLE TIMES WHEN
  // CALLED FROM THE GAME SERVER.
  //
  public async getNextHandInfo(req: any, resp: any) {
    const gameCode = req.params.gameCode;
    if (!gameCode) {
      const res = {error: 'Invalid game code'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }
    logger.debug(`New hand info: ${gameCode}`);

    try {
      const nextHandProcess = new NextHandProcess(gameCode, -1);
      const ret = await nextHandProcess.getNextHandInfo();
      resp.status(200).send(JSON.stringify(ret));
    } catch (err) {
      logger.error(
        `Error while getting next hand info for game ${gameCode}: ${errToLogString(
          err
        )}`
      );
      resp.status(500).send({error: err.message});
    }
  }

  public async aggregateGameData(req: any, resp: any) {
    try {
      const ret = await Aggregation.postProcessGames();
      resp.status(200).send(JSON.stringify(ret));
    } catch (err) {
      logger.error(`Error while aggregating game data: ${errToLogString(err)}`);
      resp.status(500).send({error: err.message});
    }
  }

  public async endExpiredGames(req: any, resp: any) {
    try {
      const res = await GameRepository.endExpireGames();
      resp.status(200).send(JSON.stringify({expired: res.numExpired}));
    } catch (err) {
      logger.error(`Unable to end all expired games: ${errToLogString(err)}`);
      const response = {
        error: err.message,
      };
      resp.status(500).send(JSON.stringify(response));
    }
  }

  public async endGameInternal(req: any, resp: any) {
    try {
      const gameCode = req.params.gameCode;
      if (!gameCode) {
        const res = {error: `Invalid game code: ${gameCode}`};
        resp.status(500).json(res);
        return;
      }

      const force: boolean = req.params.force === '1';

      logger.info(
        `Processing internal request to end game: ${gameCode} force: ${force}`
      );

      const res = await GameRepository.endGameInternal(gameCode, force);
      resp.status(200).json({status: GameStatus[res]});
    } catch (err) {
      logger.error(`Unable to end game: ${errToLogString(err)}`);
      const response = {
        error: errToLogString(err, false),
      };
      resp.status(500).json(response);
    }
  }
}

export const GameAPI = new GameAPIs();
