import {GameStatus, GameType, TableStatus} from '@src/entity/types';
import {GameRepository} from '@src/repositories/game';
import {
  markDealerChoiceNextHand,
  processPendingUpdates,
} from '@src/repositories/pendingupdates';
import {getLogger} from '@src/utils/log';
import {Cache} from '@src/cache/index';
import {PokerGame, PokerGameUpdates} from '@src/entity/game';
import {PlayerStatus} from '@src/entity/types';
import {GameReward} from '@src/entity/reward';
import {getManager, getRepository} from 'typeorm';
import {NewHandInfo, PlayerInSeat} from '@src/repositories/types';
import _ from 'lodash';
import {delay} from '@src/utils';
import {Player} from '@src/entity/player';

const logger = getLogger('GameAPIs');

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
    await GameRepository.markPlayerGameState(playerID, gameID, gameStatus);
    resp.status(200).send({status: 'OK'});
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

    await GameRepository.markGameStatus(gameID, gameStatus);
    resp.status(200).send({status: 'OK'});
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
      logger.error(err.message);
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
    const pendingUpdates = await GameRepository.anyPendingUpdates(gameID);
    resp.status(200).send({pendingUpdates: pendingUpdates});
  }

  public async processPendingUpdates(req: any, resp: any) {
    const gameIDStr = req.params.gameId;
    if (!gameIDStr) {
      const res = {error: 'Invalid game id'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }
    const gameID = parseInt(gameIDStr);
    await processPendingUpdates(gameID);
    resp.status(200).send({status: 'OK'});
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
        delay(1000);
        retryCount--;

        const ret = await getManager().transaction(
          async transactionEntityManager => {
            const game: PokerGame = await Cache.getGame(
              gameCode,
              false,
              transactionEntityManager
            );
            if (!game) {
              throw new Error(`Game ${gameCode} is not found`);
            }
            const playersInSeats = await GameRepository.getPlayersInSeats(
              game.id,
              transactionEntityManager
            );
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
              clubId: game.club.id,
              gameId: game.id,
              clubCode: game.club.clubCode,
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
              startedBy: game.startedBy.name,
              startedByUuid: game.startedBy.uuid,
              breakLength: game.breakLength,
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
        if (retryCount === 0) {
          resp.status(500).send(JSON.stringify({error: err.message}));
          return;
        }
      }
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
      resp.status(500).send({error: err.message});
    }
  }

  public async getNextHandInfo(req: any, resp: any) {
    const gameCode = req.params.gameCode;
    const gameServerHandNum = req.params.handNum;
    if (!gameCode) {
      const res = {error: 'Invalid game code'};
      resp.status(500).send(JSON.stringify(res));
      return;
    }
    logger.info(`New hand info: ${gameCode}`);

    const ret = await getManager().transaction(
      async transactionEntityManager => {
        const game: PokerGame = await Cache.getGame(
          gameCode,
          false,
          transactionEntityManager
        );
        if (!game) {
          const res = {error: `Game code: ${gameCode} not found`};
          resp.status(500).send(JSON.stringify(res));
        }

        const gameUpdatesRepo =
          transactionEntityManager.getRepository(PokerGameUpdates);
        const gameUpdates = await gameUpdatesRepo.find({
          gameID: game.id,
        });
        if (gameUpdates.length === 0) {
          const res = {error: 'GameUpdates not found'};
          resp.status(500).send(JSON.stringify(res));
          return;
        }
        const playersInSeats = await GameRepository.getPlayersInSeats(
          game.id,
          transactionEntityManager
        );
        const takenSeats = _.keyBy(playersInSeats, 'seatNo');

        for (let seatNo = 1; seatNo <= game.maxPlayers; seatNo++) {
          const playerSeat = takenSeats[seatNo];
          if (
            playerSeat &&
            playerSeat['stack'] === 0 &&
            playerSeat['status'] == PlayerStatus.PLAYING
          ) {
            const player = await Cache.getPlayerById(playerSeat['playerId']);
            // if player balance is 0, we need to mark this player to add buyin
            await GameRepository.startBuyinTimer(game, player, {
              status: PlayerStatus.WAIT_FOR_BUYIN,
            });
            playerSeat['status'] = PlayerStatus.WAIT_FOR_BUYIN;
          }
        }

        const seats = new Array<PlayerInSeat>();
        const occupiedSeats = new Array<number>();
        // dealer
        occupiedSeats.push(0);
        for (let seatNo = 1; seatNo <= game.maxPlayers; seatNo++) {
          const playerSeat = takenSeats[seatNo];

          if (!playerSeat) {
            occupiedSeats.push(0);
            seats.push({
              seatNo: seatNo,
              openSeat: true,
              status: PlayerStatus.NOT_PLAYING,
              gameToken: '',
              runItTwicePrompt: false,
              muckLosingHand: false,
            });
          } else {
            if (playerSeat.status == PlayerStatus.PLAYING) {
              occupiedSeats.push(playerSeat.playerId);
            } else {
              occupiedSeats.push(0);
            }
            let buyInExpTime = '';
            let breakTimeExp = '';
            if (playerSeat.buyInExpTime) {
              buyInExpTime = playerSeat.buyInExpTime.toISOString();
            }
            if (playerSeat.breakTimeExp) {
              breakTimeExp = playerSeat.breakTimeExp.toISOString();
            }
            // player is in a seat
            seats.push({
              seatNo: seatNo,
              openSeat: false,
              playerId: playerSeat.playerId,
              playerUuid: playerSeat.playerUuid,
              name: playerSeat.name,
              stack: playerSeat.stack,
              buyIn: playerSeat.buyIn,
              status: playerSeat.status,
              buyInTimeExpAt: buyInExpTime,
              breakTimeExpAt: breakTimeExp,
              gameToken: '',
              runItTwicePrompt: playerSeat.runItTwicePrompt,
              muckLosingHand: playerSeat.muckLosingHand,
            });
          }
        }

        const gameUpdate = gameUpdates[0];
        const prevGameType = gameUpdate.gameType;
        let announceGameType = false;
        if (gameServerHandNum !== gameUpdate.handNum) {
          // determine button pos
          const lastButtonPos = gameUpdate.buttonPos;
          let buttonPassedDealer = false;
          let buttonPos = gameUpdate.buttonPos;
          let maxPlayers = game.maxPlayers;
          while (maxPlayers > 0) {
            buttonPos++;
            if (buttonPos > maxPlayers) {
              buttonPassedDealer = true;
              buttonPos = 1;
            }
            if (occupiedSeats[buttonPos] !== 0) {
              break;
            }
            maxPlayers--;
          }
          gameUpdate.handNum++;
          gameUpdate.buttonPos = buttonPos;
          // determine new game type (ROE)
          if (game.gameType === GameType.ROE) {
            if (gameUpdate.handNum !== 1) {
              if (buttonPassedDealer) {
                // button passed dealer
                const roeGames = game.roeGames.split(',');
                const gameTypeStr = GameType[gameUpdate.gameType];
                let index = roeGames.indexOf(gameTypeStr.toString());
                index++;
                if (index >= roeGames.length) {
                  index = 0;
                }
                gameUpdate.gameType = GameType[roeGames[index]];
              }
            } else {
              const roeGames = game.roeGames.split(',');
              gameUpdate.gameType = GameType[roeGames[0]];
            }
          } else if (game.gameType === GameType.DEALER_CHOICE) {
            if (gameUpdate.handNum === 1) {
              const dealerChoiceGames = game.dealerChoiceGames.split(',');
              gameUpdate.gameType = GameType[dealerChoiceGames[0]];
            }
          } else {
            gameUpdate.gameType = game.gameType;
          }

          if (game.gameType === GameType.ROE) {
            if (gameUpdate.gameType !== prevGameType) {
              announceGameType = true;
            }
          }

          if (game.gameType === GameType.DEALER_CHOICE) {
            announceGameType = true;
          }

          // update button pos and gameType
          await gameUpdatesRepo
            .createQueryBuilder()
            .update()
            .set({
              gameType: gameUpdate.gameType,
              buttonPos: gameUpdate.buttonPos,
              handNum: gameUpdate.handNum,
            })
            .where({
              gameID: game.id,
            })
            .execute();
        }

        const nextHandInfo: NewHandInfo = {
          gameCode: gameCode,
          gameType: gameUpdate.gameType,
          announceGameType: announceGameType,
          playersInSeats: seats,
          smallBlind: game.smallBlind,
          bigBlind: game.bigBlind,
          maxPlayers: game.maxPlayers,
          buttonPos: gameUpdate.buttonPos,
          handNum: gameUpdate.handNum,
        };

        if (game.gameType === GameType.DEALER_CHOICE) {
          // if the game is dealer's choice, then prompt the user for next hand
          await markDealerChoiceNextHand(game, transactionEntityManager);
        }

        if (prevGameType !== gameUpdate.gameType) {
          // announce the new game type
          logger.info(
            `Game type is changed. New game type: ${gameUpdate.gameType}`
          );
        }
        return nextHandInfo;
      }
    );

    resp.status(200).send(JSON.stringify(ret));
  }
}

export const GameAPI = new GameAPIs();
