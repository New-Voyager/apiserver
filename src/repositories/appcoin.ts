import {
  CoinConsumeTransaction,
  CoinPurchaseTransaction,
  PlayerCoin,
  StoreType,
} from '@src/entity/player/appcoin';
import {Cache} from '@src/cache';
import {getGameManager, getUserManager, getUserRepository} from '.';
import {getLogger} from '@src/utils/log';
import {Player} from '@src/entity/player/player';
import {getAppSettings} from '@src/firebase';
import {GameUpdatesRepository} from './gameupdates';
import {GameRepository} from './game';
import {gameLogPrefix, PokerGame} from '@src/entity/game/game';
import {startTimer} from '@src/timer';
import {CHECK_AVAILABLE_COINS, GAME_COIN_CONSUME_TIME} from './types';
import {GameEndReason, GameStatus} from '@src/entity/types';
import {Nats} from '@src/nats';
const crypto = require('crypto');

const logger = getLogger('repositories::appcoins');
const useAppCoin = false;
class AppCoinRepositoryImpl {
  public async purchaseCoins(
    playerUuid: string,
    storeType: StoreType,
    productId: string,
    coinsPurchased: number,
    transactionId: string,
    purchaseDate: Date,
    receipt: string
  ): Promise<boolean> {
    logger.info(`Player: ${playerUuid} bought ${coinsPurchased}`);
    return await getUserManager().transaction(
      async transactionEntityManager => {
        const coinTransactionRepo = transactionEntityManager.getRepository(
          CoinPurchaseTransaction
        );
        const coinTrans = new CoinPurchaseTransaction();
        coinTrans.productId = productId;
        coinTrans.storeType = storeType;
        coinTrans.playerUuid = playerUuid;
        coinTrans.transactionId = transactionId;
        coinTrans.serverData = receipt;
        coinTrans.coinsPurchased = coinsPurchased;
        coinTrans.purchaseDate = purchaseDate;
        coinTrans.refunded = false;
        const receiptHash = crypto
          .createHash('md5')
          .update(receipt)
          .digest('hex');
        if (receiptHash) {
          const existingTran = await coinTransactionRepo.findOne({
            receiptHash: receiptHash,
          });
          if (existingTran) {
            // entry already found
            return true;
          }
        }
        coinTrans.receiptHash = receiptHash;
        await coinTransactionRepo.save(coinTrans);
        await this.addCoins(coinsPurchased, 0, playerUuid);
        return false;
      }
    );
  }

  public async addCoins(
    coinsPurchased: number,
    coinsRewarded: number,
    playerUuid: string
  ): Promise<number> {
    logger.info(
      `Player: ${playerUuid} bought ${coinsPurchased}, awarded: ${coinsRewarded}`
    );

    const repository = getUserRepository(PlayerCoin);
    const existingRow = await repository.findOne({
      where: {
        playerUuid: playerUuid,
      },
    });
    if (!existingRow) {
      const playerCoin: PlayerCoin = new PlayerCoin();
      playerCoin.playerUuid = playerUuid;
      playerCoin.totalCoinsAvailable = coinsPurchased + coinsRewarded;
      playerCoin.totalCoinsPurchased = coinsPurchased;
      await repository.save(playerCoin);
    } else {
      await repository
        .createQueryBuilder()
        .update()
        .set({
          totalCoinsAvailable: () =>
            `total_coins_available + ${coinsPurchased + coinsRewarded}`,
          totalCoinsPurchased: () =>
            `total_coins_purchased + ${coinsPurchased}`,
        })
        .where({
          playerUuid: playerUuid,
        })
        .execute();
    }
    const saved = await repository.findOne({
      where: {
        playerUuid: playerUuid,
      },
    });
    if (!saved) {
      throw new Error('Player coins not updated');
    }
    return saved.totalCoinsAvailable;
  }

  public async newUser(player: Player) {
    // new player, give free coins
    const freeCoins = getAppSettings().newUserFreeCoins;
    const playerCoinRepo = getUserRepository(PlayerCoin);
    const existingRow = await playerCoinRepo.findOne({playerUuid: player.uuid});
    if (existingRow == null) {
      const playerCoins = new PlayerCoin();
      playerCoins.playerUuid = player.uuid;
      playerCoins.totalCoinsAvailable = freeCoins;
      playerCoins.totalCoinsPurchased = 0;
      await playerCoinRepo.save(playerCoins);
    } else {
      await playerCoinRepo.update(
        {
          playerUuid: player.uuid,
        },
        {
          totalCoinsAvailable: existingRow.totalCoinsAvailable + freeCoins,
        }
      );
    }
  }

  public async availableCoins(playerUuid: string): Promise<number> {
    const playerCoinRepo = getUserRepository(PlayerCoin);
    const existingRow = await playerCoinRepo.findOne({playerUuid: playerUuid});
    if (existingRow == null) {
      return 0;
    } else {
      return existingRow.totalCoinsAvailable;
    }
  }

  // this is a unit-test method
  public async buyCoins(playerUuid: string, amount: number): Promise<void> {
    const playerCoinRepo = getUserRepository(PlayerCoin);
    let playerCoins = await playerCoinRepo.findOne({playerUuid: playerUuid});
    if (playerCoins == null) {
      playerCoins = new PlayerCoin();
      playerCoins.playerUuid = playerUuid;
      playerCoins.totalCoinsAvailable = 0;
      playerCoins.totalCoinsPurchased = 0;
    }
    playerCoins.totalCoinsAvailable += amount;
    playerCoins.totalCoinsPurchased += amount;
    await playerCoinRepo.save(playerCoins);
    return;
  }

  public async consumeCoins(
    playerUuid: string,
    coinsConsumed: number,
    gameCode: string,
    noOfDiamonds: number
  ): Promise<number> {
    const player = await Cache.getPlayer(playerUuid);
    return await getUserManager().transaction(
      async transactionEntityManager => {
        const playerCoinRepo =
          transactionEntityManager.getRepository(PlayerCoin);
        const consumeCoinRepo = transactionEntityManager.getRepository(
          CoinConsumeTransaction
        );
        const existingRow = await playerCoinRepo.findOne({
          playerUuid: playerUuid,
        });
        if (existingRow == null) {
          return 0;
        } else {
          // NOTE: Enable coins later
          const settings = getAppSettings();
          if (!settings.useAppCoins) {
            return existingRow.totalCoinsAvailable;
          }

          let totalCoinsAvailable =
            existingRow.totalCoinsAvailable - coinsConsumed;
          if (totalCoinsAvailable < 0) {
            totalCoinsAvailable = 0;
          }
          await playerCoinRepo
            .createQueryBuilder()
            .update()
            .set({
              totalCoinsAvailable: () => `${totalCoinsAvailable}`,
            })
            .where({
              playerUuid: playerUuid,
            })
            .execute();
          const trans = new CoinConsumeTransaction();
          trans.playerId = player.id;
          trans.playerUuid = player.uuid;
          trans.gameCode = gameCode;
          trans.diamonds = noOfDiamonds;
          trans.coinsSpent = coinsConsumed;
          trans.purchaseDate = new Date();
          await consumeCoinRepo.save(trans);
          return totalCoinsAvailable;
        }
      }
    );
  }

  public async enoughCoinsForGame(gameCode: string): Promise<boolean> {
    // for v1, we won't deduct any coins
    if (!useAppCoin) {
      return true;
    }

    const game = await Cache.getGame(gameCode);
    if (!game) {
      throw new Error(`Game: ${gameCode} is not found`);
    }
    let playerUuid = game.hostUuid;
    if (game.clubCode) {
      // this is a club game, charge the club owner
      const club = await Cache.getClub(game.clubCode);
      const owner: Player | undefined = await Promise.resolve(club.owner);
      if (!owner) {
        throw new Error('Unexpected. There is no owner for the club');
      }
      playerUuid = owner.uuid;
    }

    const availableCoins = await this.availableCoins(playerUuid);
    const appSettings = getAppSettings();
    if (availableCoins >= appSettings.gameCoinsPerBlock) {
      return true;
    }
    return false;
  }

  public async gameCheckAvailableCoins(game: PokerGame) {
    // for v1, we won't deduct any coins
    if (useAppCoin) {
      return true;
    }

    if (game.lobbyGame) {
      return true;
    }

    let playerUuid = game.hostUuid;
    const host = await Cache.getPlayer(game.hostUuid);
    let clubOwnedByBot = false;

    if (game.clubCode) {
      // this is a club game, charge the club owner
      const club = await Cache.getClub(game.clubCode);
      const owner: Player | undefined = await Promise.resolve(club.owner);
      if (!owner) {
        throw new Error('Unexpected. There is no owner for the club');
      }
      if (owner.bot) {
        clubOwnedByBot = true;
      }
      playerUuid = owner.uuid;
      if (clubOwnedByBot) {
        return;
      }
    } else {
      if (host.bot) {
        return;
      }
    }
    logger.info(`Game: ${game.gameCode} consume coins to continue game`);
    if (game.status === GameStatus.ENDED) {
      logger.info(`Game: ${game.gameCode} Game ended.`);
      return;
    }
    const availableCoins = await this.availableCoins(playerUuid);
    const appSettings = getAppSettings();
    if (availableCoins >= appSettings.gameCoinsPerBlock) {
      return;
    }
    logger.info(
      `Game: ${game.gameCode} will run out of coins to continue. Notifying the host`
    );
    // notify the player that there are enough coins to continue
    Nats.notifyAppCoinShort(game).catch(err => {
      logger.error(`Failed to notify host (${game.gameCode}) coin shortage`);
    });
    return;
  }

  public async consumeGameCoins(game: PokerGame): Promise<boolean> {
    if (game.lobbyGame) {
      return true;
    }

    // consume coins
    let playerUuid = game.hostUuid;
    const host = await Cache.getPlayer(game.hostUuid);
    let clubOwnedByBot = false;

    if (game.clubCode) {
      // this is a club game, charge the club owner
      const club = await Cache.getClub(game.clubCode);
      const owner: Player | undefined = await Promise.resolve(club.owner);
      if (!owner) {
        throw new Error('Unexpected. There is no owner for the club');
      }
      if (owner.bot) {
        clubOwnedByBot = true;
      }
      playerUuid = owner.uuid;
      if (clubOwnedByBot) {
        return true;
      }
    } else {
      if (host.bot) {
        return true;
      }
    }

    logger.info(`Game: ${game.gameCode} consume coins to continue game`);
    if (game.status === GameStatus.ENDED) {
      logger.info(`Game: ${game.gameCode} Game ended.`);
      return false;
    }

    if (!(await this.enoughCoinsForGame(game.gameCode))) {
      logger.info(
        `Game: ${game.gameCode} cannot continue game. Not enough coins`
      );
      // end the game
      await GameRepository.endGame(
        null,
        game,
        GameEndReason.NOT_ENOUGH_COINS,
        false
      );
      return false;
    }

    const appSettings = getAppSettings();
    await this.consumeCoins(
      playerUuid,
      appSettings.gameCoinsPerBlock,
      game.gameCode,
      0
    );

    const nextConsumeTime = new Date();
    let now = new Date();
    nextConsumeTime.setSeconds(
      nextConsumeTime.getSeconds() + appSettings.consumeTime
    );

    logger.info(
      `Game: ${game.gameCode} Game block time: ${
        appSettings.consumeTime
      } now: ${now.toISOString()} next consume coins time ${nextConsumeTime.toISOString()}`
    );

    // update and start next timer
    await GameUpdatesRepository.updateAppcoinConsumeTime(game, nextConsumeTime);

    // start a timer
    startTimer(game.id, 0, GAME_COIN_CONSUME_TIME, nextConsumeTime).catch(e => {
      logger.error(
        `${gameLogPrefix(game)} Start timer (GAME_COIN_CONSUME_TIME) failed`
      );
    });

    const nextCoinsCheckTime = new Date();
    now = new Date();
    nextCoinsCheckTime.setSeconds(
      nextCoinsCheckTime.getSeconds() + appSettings.coinsAlertNotifyTime
    );

    // start a timer to notify if not enough coins
    startTimer(game.id, 0, CHECK_AVAILABLE_COINS, nextCoinsCheckTime).catch(
      e => {
        logger.error(
          `${gameLogPrefix(game)} Start timer (CHECK_AVAILABLE_COINS) failed`
        );
      }
    );
    return true;
  }
}

export const AppCoinRepository = new AppCoinRepositoryImpl();
