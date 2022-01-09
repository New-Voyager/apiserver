import {PokerGame, PokerGameUpdates} from '@src/entity/game/game';
import {EntityManager, Repository} from 'typeorm';
import {Cache} from '@src/cache/index';
import {getGameManager, getGameRepository} from '.';
import {errToStr, getLogger} from '@src/utils/log';
import {getAppSettings} from '@src/firebase';
import {GameType} from '@src/entity/types';
import {GameNotFoundError} from '@src/errors';

const logger = getLogger('repositories::gameupdates');
class GameUpdatesRepositoryImpl {
  public async create(
    gameId: number,
    gameCode: string,
    input: any,
    transactionEntityManager: EntityManager
  ) {
    // create a entry in PokerGameUpdates
    const gameUpdatesRepo =
      transactionEntityManager.getRepository(PokerGameUpdates);
    const gameUpdates = new PokerGameUpdates();
    gameUpdates.gameCode = gameCode;
    const appSettings = getAppSettings();
    gameUpdates.appcoinPerBlock = appSettings.gameCoinsPerBlock;

    if (input.bombPotEnabled) {
      // set current time as last bomb pot time
      gameUpdates.lastBombPotTime = new Date();

      // first hand is bomb pot hand
      gameUpdates.bombPotThisHand = true;
      const gameTypeStr: string = input['bombPotGameType'];

      if (input.bombPotGameType) {
        const gameType: GameType = GameType[gameTypeStr];
        gameUpdates.bombPotGameType = gameType;
      } else {
        const gameTypeStr: string = input['bombPotGameType'];
        const gameType: GameType = GameType[gameTypeStr];
        gameUpdates.bombPotGameType = input.gameType;
      }
    }

    gameUpdates.dealerChoiceOrbit = input.dealerChoiceOrbit;
    await gameUpdatesRepo.save(gameUpdates);
  }

  public async updateAppcoinConsumeTime(
    game: PokerGame,
    nextConsumeTime: Date,
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
      await gameUpdatesRepo.update(
        {
          gameCode: game.gameCode,
        },
        {
          nextCoinConsumeTime: nextConsumeTime,
        }
      );
      await this.get(game.gameCode, true, transactionManager);
      logger.info(
        `[${
          game.gameCode
        }] Coins consumed. Next Consume time: ${gameUpdateRow.nextCoinConsumeTime.toISOString()}`
      );
    } catch (err) {
      logger.error(
        `Failed to update appcoins next consumption time. Error: ${errToStr(
          err
        )}`
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
        const pokerGameUpdates =
          transactionEntityManager.getRepository(PokerGameUpdates);
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
    if (!game) {
      throw new GameNotFoundError(gameCode);
    }

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

  public async updateDealersChoiceSeat(
    game: PokerGame,
    playerId: number,
    handNum: number,
    seat: number
  ) {
    const gameUpdatesRepo = getGameRepository(PokerGameUpdates);

    await gameUpdatesRepo.update(
      {
        gameCode: game.gameCode,
      },
      {
        dealerChoiceSeat: playerId,
        orbitPos: seat,
        orbitHandNum: handNum,
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
    const gameUpdatesRepo =
      transactionEntityManager.getRepository(PokerGameUpdates);
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
