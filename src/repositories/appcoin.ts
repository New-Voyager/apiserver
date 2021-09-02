import {
  CoinConsumeTransaction,
  CoinPurchaseTransaction,
  PlayerCoin,
  StoreType,
} from '@src/entity/player/appcoin';
import {Cache} from '@src/cache';
import {getUserManager, getUserRepository} from '.';
import {getLogger} from '@src/utils/log';
import {Player} from '@src/entity/player/player';
import {getAppSettings} from '@src/firebase';
import {Nats} from '@src/nats';
import {GameUpdatesRepository} from './gameupdates';
const crypto = require('crypto');

const COIN_PURCHASE_NOTIFICATION_TIME = 10;
const logger = getLogger('appcoins');

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
          if (existingTran !== null) {
            // entry already found
            return true;
          }
        }
        coinTrans.receiptHash = receiptHash;

        coinTransactionRepo.save(coinTrans);

        const playerCoinRepo = transactionEntityManager.getRepository(
          PlayerCoin
        );
        const existingRow = await playerCoinRepo.findOne({
          playerUuid: playerUuid,
        });
        if (existingRow == null) {
          const playerCoin = new PlayerCoin();
          playerCoin.playerUuid = playerUuid;
          playerCoin.totalCoinsAvailable = coinsPurchased;
          playerCoin.totalCoinsPurchased = coinsPurchased;
          await playerCoinRepo.save(playerCoin);
        } else {
          await playerCoinRepo
            .createQueryBuilder()
            .update()
            .set({
              totalCoinsAvailable: () =>
                `total_coins_available + ${coinsPurchased}`,
              totalCoinsPurchased: () =>
                `total_coins_purchased + ${coinsPurchased}`,
            })
            .where({
              playerUuid: playerUuid,
            })
            .execute();
        }
        return false;
      }
    );
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
    playerCoinRepo.save(playerCoins);
    return;
  }

  public async consumeCoins(
    playerUuid: string,
    coinsConsumed: number
  ): Promise<number> {
    const playerCoinRepo = getUserRepository(PlayerCoin);
    const existingRow = await playerCoinRepo.findOne({playerUuid: playerUuid});
    if (existingRow == null) {
      return 0;
    } else {
      let totalCoinsAvailable = existingRow.totalCoinsAvailable - coinsConsumed;
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
      return totalCoinsAvailable;
    }
  }

  public async canGameContinue(gameCode: string) {
    // first get the game from cache
    const game = await Cache.getGame(gameCode);
    if (game === null || game === undefined) {
      return false;
    }

    const gameUpdates = await Cache.getGameUpdates(gameCode);
    if (gameUpdates === null || gameUpdates === undefined) {
      return false;
    }

    const settings = getAppSettings();
    // we may support public games in the future
    if (!gameUpdates.nextCoinConsumeTime) {
      if (game.appCoinsNeeded) {
        await GameUpdatesRepository.updateAppcoinNextConsumeTime(game);
      }
      return true;
    }

    const now = new Date();
    const diff = gameUpdates.nextCoinConsumeTime.getTime() - now.getTime();
    const diffInSecs = Math.ceil(diff / 1000);

    if (diffInSecs > 0 && diffInSecs < settings.notifyHostTimeWindow) {
      //logger.info(`[${game.gameCode}] app coin consumption time has not reached. Time remaining: ${diffInSecs} seconds`);
      return true;
    }
    if (diffInSecs > 0 && diffInSecs <= settings.notifyHostTimeWindow) {
      if (gameUpdates.appCoinHostNotified) {
        logger.info(
          `[${game.gameCode}] app coin consumption time has not reached. We notified the host. Time remaining: ${diffInSecs} seconds`
        );
        // we already notified the host
        return true;
      }
    }

    // get app coins from the host or club owner
    let appCoinPlayerId;
    let appCoinPlayerUuid;

    if (game.clubCode) {
      const club = await Cache.getClub(game.clubCode);
      if (!club || !club.owner) {
        logger.error(`Club [${game.clubCode}] is not found`);
        return false;
      }
      const owner: Player | undefined = await Promise.resolve(club.owner);
      if (!owner) {
        logger.error(`Club [${game.clubCode}]. Owner is not found`);
        return false;
      }
      appCoinPlayerId = owner.id;
      appCoinPlayerUuid = owner.uuid;
    } else {
      appCoinPlayerId = game.hostId;
      appCoinPlayerUuid = game.hostUuid;
    }

    const ret = await getUserManager().transaction(async tranManager => {
      // get player coins
      const coinRepo = tranManager.getRepository(PlayerCoin);
      const appCoin = await coinRepo.findOne({
        playerUuid: appCoinPlayerUuid,
      });
      let totalCoinsAvailable = 0;
      if (appCoin) {
        // no app coins available for the user
        totalCoinsAvailable = appCoin.totalCoinsAvailable;
      }

      if (
        diffInSecs <= settings.notifyHostTimeWindow &&
        !gameUpdates.appCoinHostNotified
      ) {
        if (totalCoinsAvailable < gameUpdates.appcoinPerBlock) {
          await Nats.notifyAppCoinShort(game);
          // notify the host and extend the game bit longer
          const nextCoinConsumeTime = new Date(
            now.getTime() + settings.notifyHostTimeWindow * 1000
          );
          await GameUpdatesRepository.updateCoinNextTime(
            game,
            nextCoinConsumeTime,
            true
          );
          logger.info(
            `[${game.gameCode}] Host is notified to make coin purchase`
          );
          return true;
        }
      }

      if (diffInSecs > 0) {
        return true;
      }

      // do we have enough coins ??
      // not enough coins, return false. pending updates: true, end the game
      if (totalCoinsAvailable < gameUpdates.appcoinPerBlock) {
        // notify the host that the game is ended due to low app coins
        logger.info(
          `[${game.gameCode}] app coin consumption time has reached. Not enough coins`
        );
        return false;
      }
      const appSettings = getAppSettings();
      // consume app coins
      const nextCoinConsumeTime = new Date(
        now.getTime() + appSettings.consumeTime * 1000
      );
      await GameUpdatesRepository.updateCoinsUsed(game, nextCoinConsumeTime);
      // subtract from user account
      await coinRepo
        .createQueryBuilder()
        .update()
        .set({
          totalCoinsAvailable: () =>
            `total_coins_available - ${gameUpdates.appcoinPerBlock}`,
        })
        .where({
          playerUuid: appCoinPlayerUuid,
        })
        .execute();

      // add an entry in transaction record
      const consumeCoinsRepo = tranManager.getRepository(
        CoinConsumeTransaction
      );
      const consumeCoins = new CoinConsumeTransaction();
      consumeCoins.playerId = appCoinPlayerId;
      consumeCoins.playerUuid = appCoinPlayerUuid;
      consumeCoins.gameCode = game.gameCode;
      consumeCoins.coinsSpent = gameUpdates.appcoinPerBlock;
      consumeCoins.purchaseDate = new Date();
      await consumeCoinsRepo.save(consumeCoins);
      logger.info(
        `[${game.gameCode}] subtracted ${
          consumeCoins.coinsSpent
        } from player: ${appCoinPlayerUuid} Next coin consumption time: ${nextCoinConsumeTime.toISOString()}`
      );
      return true;
    });

    return ret;
  }
}

export const AppCoinRepository = new AppCoinRepositoryImpl();
