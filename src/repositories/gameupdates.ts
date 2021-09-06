import {PokerGame, PokerGameUpdates} from '@src/entity/game/game';
import {EntityManager, Repository} from 'typeorm';
import {Cache} from '@src/cache/index';
import {getGameManager, getGameRepository} from '.';
import {getLogger} from '@src/utils/log';
import {getAppSettings} from '@src/firebase';
import {GameType} from '@src/entity/types';

const logger = getLogger('repositories::gameupdates');
class GameUpdatesRepositoryImpl {
  public async create(
    gameId: number,
    gameCode: string,
    input: any,
    transactionEntityManager: EntityManager
  ) {
    // create a entry in PokerGameUpdates
    const gameUpdatesRepo = transactionEntityManager.getRepository(
      PokerGameUpdates
    );
    const gameUpdates = new PokerGameUpdates();
    gameUpdates.gameCode = gameCode;
    const appSettings = getAppSettings();
    gameUpdates.appcoinPerBlock = appSettings.gameCoinsPerBlock;

    if (input.useAgora) {
      gameUpdates.appcoinPerBlock += appSettings.agoraCoinsPerBlock;
    }
    if (input.bombPotEnabled) {
      // set current time as last bomb pot time
      gameUpdates.lastBombPotTime = new Date();

      // first hand is bomb pot hand
      gameUpdates.bombPotThisHand = true;
    }
    await gameUpdatesRepo.save(gameUpdates);
  }

  // YONG
  public async updateAppcoinNextConsumeTime(
    game: PokerGame,
    transactionManager?: EntityManager
  ) {
    if (!game.appCoinsNeeded) {
      return;
    }

    try {
      // update next consume time
      let gameUpdatesRepo: Repository<PokerGameUpdates>;
      if (transactionManager) {
        gameUpdatesRepo = transactionManager.getRepository(PokerGameUpdates);
      } else {
        gameUpdatesRepo = getGameRepository(PokerGameUpdates);
      }
      const gameUpdateRow = await gameUpdatesRepo.findOne({
        gameCode: game.gameCode,
      });
      if (!gameUpdateRow) {
        return;
      }
      if (!gameUpdateRow.nextCoinConsumeTime) {
        const freeTime = getAppSettings().freeTime;
        const now = new Date();
        const nextConsumeTime = new Date(now.getTime() + freeTime * 1000);
        await gameUpdatesRepo.update(
          {
            gameCode: game.gameCode,
          },
          {
            nextCoinConsumeTime: nextConsumeTime,
          }
        );
        gameUpdateRow.nextCoinConsumeTime = nextConsumeTime;
      }
      await this.get(game.gameCode, true, transactionManager);
      logger.info(
        `[${
          game.gameCode
        }] Next coin consume time: ${gameUpdateRow.nextCoinConsumeTime.toISOString()}`
      );
    } catch (err) {
      logger.error(
        `Failed to update appcoins next consumption time. Error: ${err.toString()}`
      );
    }
  }

  public async updateButtonPos(gameCode: string, buttonPos: number) {
    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error('Updating button position failed');
    }

    const ret = await getGameManager().transaction(
      async transactionEntityManager => {
        const pokerGameUpdates = transactionEntityManager.getRepository(
          PokerGameUpdates
        );
        await pokerGameUpdates.update(
          {
            gameCode: game.gameCode,
          },
          {
            buttonPos: buttonPos,
            calculateButtonPos: false,
          }
        );
      }
    );
    await GameUpdatesRepository.get(gameCode, true);
  }

  public async getRakeCollected(
    playerId: string,
    gameCode: string
  ): Promise<number> {
    // only club owner or game host can get the rake
    // verify it here

    const game = await Cache.getGame(gameCode);
    const gameUpdatesRepo = getGameRepository(PokerGameUpdates);
    const gameUpdate = await gameUpdatesRepo.findOne({
      where: {gameID: game.id},
    });
    if (!gameUpdate) {
      return 0;
    }
    return gameUpdate.rake;
  }

  public async updateLastIpCheckTime(game: PokerGame) {
    const lastIpCheckTime = new Date();
    await getGameRepository(PokerGameUpdates).update(
      {
        gameCode: game.gameCode,
      },
      {
        lastIpGpsCheckTime: lastIpCheckTime,
      }
    );

    await GameUpdatesRepository.get(game.gameCode, true);
  }

  public async updateNextGameType(game: PokerGame, gameType: GameType) {
    // update game type in the GameUpdates table
    const gameUpdatesRepo = getGameRepository(PokerGameUpdates);
    await gameUpdatesRepo.update(
      {
        gameCode: game.gameCode,
      },
      {
        gameType: gameType,
      }
    );
    await GameUpdatesRepository.get(game.gameCode, true);
  }

  public async updateCoinNextTime(
    game: PokerGame,
    nextCoinConsumeTime: Date,
    appCoinHostNotified: boolean
  ) {
    const gameUpdatesRepo = getGameRepository(PokerGameUpdates);
    await gameUpdatesRepo.update(
      {
        gameCode: game.gameCode,
      },
      {
        nextCoinConsumeTime: nextCoinConsumeTime,
        appCoinHostNotified: appCoinHostNotified,
      }
    );
    await GameUpdatesRepository.get(game.gameCode, true);
  }

  public async updateCoinsUsed(game: PokerGame, nextCoinConsumeTime: Date) {
    const gameUpdatesRepo = getGameRepository(PokerGameUpdates);
    const gameUpdates = await GameUpdatesRepository.get(game.gameCode, true);

    await gameUpdatesRepo
      .createQueryBuilder()
      .update()
      .set({
        coinsUsed: () => `coins_used + ${gameUpdates.appcoinPerBlock}`,
        nextCoinConsumeTime: nextCoinConsumeTime,
      })
      .where({
        gameID: game.id,
      })
      .execute();
    await GameUpdatesRepository.get(game.gameCode, true);
  }

  public async updateDealersChoiceSeat(game: PokerGame, playerId: number) {
    const gameUpdatesRepo = getGameRepository(PokerGameUpdates);

    await gameUpdatesRepo.update(
      {
        dealerChoiceSeat: playerId,
      },
      {
        gameCode: game.gameCode,
      }
    );
    await GameUpdatesRepository.get(game.gameCode, true);
  }

  public async updateHandResult(
    game: PokerGame,
    handNum: number,
    rake: number,
    transactionEntityManager: EntityManager
  ) {
    const gameUpdatesRepo = transactionEntityManager.getRepository(
      PokerGameUpdates
    );
    await gameUpdatesRepo
      .createQueryBuilder()
      .update()
      .set({
        lastResultProcessedHand: handNum,
        rake: () => `rake + ${rake}`,
      })
      .where({
        gameCode: game.gameCode,
      })
      .execute();
  }

  // YONG
  public async get(
    gameCode: string,
    update?: boolean,
    transactionEntityManager?: EntityManager
  ): Promise<PokerGameUpdates> {
    if (!update) {
      update = false;
    }
    return Cache.getGameUpdates(gameCode, update, transactionEntityManager);
  }
}

export const GameUpdatesRepository = new GameUpdatesRepositoryImpl();
