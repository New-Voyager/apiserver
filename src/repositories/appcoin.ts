import {CoinTransaction, PlayerCoin, StoreType} from '@src/entity/appcoin';
import {getManager, getRepository} from 'typeorm';
var crypto = require('crypto');

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
    return await getManager().transaction(async transactionEntityManager => {
      const coinTransactionRepo = transactionEntityManager.getRepository(
        CoinTransaction
      );
      const coinTrans = new CoinTransaction();
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
        if (existingTran != null) {
          // entry already found
          return true;
        }
      }
      coinTrans.receiptHash = receiptHash;

      coinTransactionRepo.save(coinTrans);

      const playerCoinRepo = transactionEntityManager.getRepository(PlayerCoin);
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
    });
  }

  public async availableCoins(playerUuid: string): Promise<number> {
    const playerCoinRepo = getRepository(PlayerCoin);
    const existingRow = await playerCoinRepo.findOne({playerUuid: playerUuid});
    if (existingRow == null) {
      return 0;
    } else {
      return existingRow.totalCoinsAvailable;
    }
  }

  public async consumeCoins(
    playerUuid: string,
    coinsConsumed: number
  ): Promise<number> {
    const playerCoinRepo = getRepository(PlayerCoin);
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
}

export const AppCoinRepository = new AppCoinRepositoryImpl();
