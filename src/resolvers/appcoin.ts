import {StoreType} from '@src/entity/player/appcoin';
import {AppleReceiptVerifyError, GoogleReceiptVerifyError} from '@src/errors';
import {Firebase} from '@src/firebase';
import {AppCoinRepository} from '@src/repositories/appcoin';
import {PlayerRepository} from '@src/repositories/player';
import {errToStr, getLogger} from '@src/utils/log';

const appleReceiptVerify = require('node-apple-receipt-verify');
appleReceiptVerify.config({
  verbose: true,
  environment: ['sandbox'],
});

const Verifier = require('google-play-billing-validator');
const options = {
  email:
    'in-app-verification@pc-api-8080417191390774237-892.iam.gserviceaccount.com',
  key: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7JT2trlvVuDpJ\n5o2oh5VrKGBpLhO5ltyN0hKbyGrq1GMbNQ8YWyEjfgIzK2wHJC6JxFZ8Wz+1KN87\n7dymHduoQbnJHUx3pNI45G858O8IeXdSqTi+2RLMHlyY/x9X2CC5x5FkIXIz4Apa\nz61q+6PD/lXYdZLgLAeAuxkWo2AGWtP3utYnI/00IuIMYEkiUR4/kU1KKxWdfj9r\nbo9wYkGI2QNyp3GUQHQ2KWZPY1oAqiLwaMVBMRrB7MabYn3s7MU1QtpHd41AgTe0\nTDfYsIQc01zmiQIB0MCJ+i5XSgpGf3fBEkJHtNn4WnAh9/IVxBwth1qyjjn09s0A\n+baQ4iitAgMBAAECggEAHxDUh0M9TWHykxfphgNTw2EFeBBFB/bKD+TCYAfJ78dn\n2DlbkyB1hM3DEblwilLwQsBL1wLStYDeZbVbflvQfcLDU2ZArk+28ejBqe2b0F1R\neHBM0il4nFeh6WfYTR28ePpu4R9INOJI9cApumuhSMSsfW0u/3VvnWfxhzeBliwu\n/htjyxP03A29XqZEhPmc0pIW0dEI0Qi22bhlXoeC6IXaUGVnnzEOGQ4ScOgZqRSq\nnZmvwDJ8xVICjXMqbViT9T71pBHXkAbMP5IeSabAnPm6He7Czs/EQRiql4K31FrM\nMcS05LfQWubWtqIIyxA2s0P/378kZCDGchn0Q8bpgQKBgQDcDg4AyZE1pGVeIoVu\nLOVfbzGB4aFJ8MypuwwhWtBLLZcR73CfRiP72jZt0m7QxAMyCRrbQSCX17buNhqM\nDw/fYW//+01qGLcys7AqeQ2zUmfPANsfJIEHhdreoN1RWI3dfhayj0stmHOObUZi\nrg824ZMcNgMU//I09IChlgF34QKBgQDZtwaz8I61xXjpKSPMmUSkAdbzA6NoFlyL\nWTG3sVockimRi4D+G1x4HwuevTsSBY6XzoS7/66w/oXzI+S3DJiyNAvTSM/O6lz9\nxP7XU7RdKbcKmVh/B7Oo5nNrqfgdjHwYtP7XGuw/kkFAgOIMeR6s+W+X45B7mBB2\nwSOVR8xaTQKBgQCFaK/sokc6sjQSYfNq3CUjOpJVH6lc3nP14sRz5E6rhTQ1V2h7\n51YhdiXRZuZwAqW9S+/QRSexZsIsoPhvOSJyVuxD0OMaE2ndfzqqRUGdGbR9txMh\nSkw/d1M97WC/1GQNiEfScTUuq2JDUtR9NvFaYF+Dlus/a/w3RpRFYl/5gQKBgFBY\npVaevmwCtn6Fujp1jclhDGyeuR1es0SR5DFAeFr27fRSoYYlntiNzIIGn9gkyNzp\nUD75OwUCyXhTlMKhGXEamAqfYmGgSDU3ED1zHKsNDAoTUX9/3iPE+G+RSInPILUV\nhr7npqxHU2F0rvefc1yuqSpKxzV1hw3sdS9QUfA5AoGAGiYiNmv74UUi7RQng765\nwLlChA8tqJkp9kckKhTjR7uOLp+b/IyNP0rPrJAMkZnnrMvni75DNQmzUx3d4X/A\n4MuqJrGPE1gdPRj8xdmXyUR7IAcTnyfO0Immb7W8k3Pzyhutu8bARZphuogKBPDs\nkbDSp9i1thu1jgFxOwyAclM=\n-----END PRIVATE KEY-----\n',
};
const googleVerifier = new Verifier(options);

const logger = getLogger('resolvers::appcoin');

/*
Google receipt
const purchaseData = {
  "orderId": "GPA.3376-3692-0959-48601",
  "packageName": "com.voyagerent.pokerclubtest",
  "productId": "chips",
  "purchaseTime": 1620786934751,
  "purchaseState": 0,
  "purchaseToken": "bgpadgfnalfpgnkijafdaboi.AO-J1OwKmLXbbIzfB5NxsJwzhqtv0AZcT-k4nCV_7TZk7k0BrXDmb_jpkZbTYp9eIW6BYgHIGyJRkK0rgvAG1cWVtOUYPrjHAggxa3EF9RDdYYrpgNopFXA",
  "acknowledged": false
}

Apple receipt (returned products)
{
    bundleId:'com.voyagerent.pokerclubtest'
    expirationDate:0
    originalTransactionId:'1000000811288683'
    productId:'chips'
    purchaseDate:1620762475000
    quantity:1
    transactionId:'1000000811288683'
  }
*/

interface Purchase {
  storeType: StoreType;
  productId: string;
  coinsPurchased?: number;
  transactionId: string;
  purchaseDate: Date;
  receipt: string;
}

async function verifyAppleReceipt(
  playerId: string,
  receipt: string
): Promise<Purchase> {
  // Promise version
  let productId = '';
  let orderId = '';
  try {
    const products = await appleReceiptVerify.validate({receipt: receipt});
    const product = products[0];
    productId = product['productId'];
    orderId = product['transactionId'];
    const purchaseDate = new Date(product['purchaseDate']);
    return {
      storeType: StoreType.IOS_APP_STORE,
      productId: product['productId'],
      purchaseDate: purchaseDate,
      receipt: receipt,
      transactionId: product['transactionId'],
    };
  } catch (e) {
    if (e instanceof appleReceiptVerify.EmptyError) {
      // todo
    } else if (e instanceof appleReceiptVerify.ServiceUnavailableError) {
      // todo
    }
    logger.error(`Verifying apple recepit failed ${errToStr(e)}`);
    throw new AppleReceiptVerifyError(productId, orderId);
  }
}

async function verifyGoogleReceipt(
  playerUuid: string,
  receipt: string
): Promise<Purchase> {
  let productId = '';
  let orderId = '';
  try {
    const receiptJson = JSON.parse(receipt);
    productId = receiptJson['productId'];
    orderId = receiptJson['orderId'];
    await googleVerifier.verifyINAPP(receiptJson);
    const purchaseDate = new Date(receiptJson['purchaseTime']);
    return {
      storeType: StoreType.IOS_APP_STORE,
      productId: receiptJson['productId'],
      purchaseDate: purchaseDate,
      receipt: receipt,
      transactionId: receiptJson['orderId'],
    };
  } catch (err) {
    logger.error(`Verifying google recepit failed ${errToStr(err)}`);
    throw new GoogleReceiptVerifyError(productId, orderId);
  }
}

const resolvers: any = {
  Query: {
    availableAppCoins: async (parent, args, ctx, info) => {
      const availableCoins = await AppCoinRepository.availableCoins(
        ctx.req.playerId
      );
      return availableCoins;
    },
  },
  Mutation: {
    buyDiamonds: async (parent, args, ctx, info) => {
      if (!ctx.req.playerId) {
        throw new Error('Unauthorized');
      }
      logger.info(
        `Player: ${ctx.req.playerId} used ${args.coinsUsed} for diamonds`
      );
      try {
        const availableCoins = await AppCoinRepository.availableCoins(
          ctx.req.playerId
        );
        if (availableCoins < args.coinsUsed) {
          throw new Error('Not enough coins available');
        }
        const ret = await AppCoinRepository.consumeCoins(
          ctx.req.playerId,
          args.coinsUsed,
          '',
          args.diamonds
        );
        return ret;
      } catch (err) {
        logger.error(
          `Buying diamonds failed. Player Id: ctx.req.playerId. Error: ${errToStr(
            err
          )}`
        );
        return false;
      }
    },

    appCoinPurchase: async (parent, args, ctx, info) => {
      let purchase: Purchase;
      try {
        if (!ctx.req.playerId) {
          throw new Error('Unauthorized');
        }
        const storeType: StoreType =
          StoreType[args.storeType as keyof typeof StoreType];
        logger.info(
          `Verifying purchase receipt from player: ${ctx.req.playerId}`
        );
        if (storeType == StoreType.IOS_APP_STORE) {
          purchase = await verifyAppleReceipt(ctx.req.playerId, args.receipt);
        } else if (storeType == StoreType.GOOGLE_PLAY_STORE) {
          purchase = await verifyGoogleReceipt(ctx.req.playerId, args.receipt);
        } else {
          throw new Error(`Store type: ${args.storeType} is unsupported`);
        }

        // updated app coins
        let coinsPurchased = args.coinsPurchased;
        const availableProducts = await Firebase.getAvailableProducts();
        for (const product of availableProducts) {
          if (product.productId === purchase.productId) {
            coinsPurchased = product.coins;
          }
        }

        if (coinsPurchased === null) {
          coinsPurchased = 0;
        }

        const duplicate = await AppCoinRepository.purchaseCoins(
          ctx.req.playerId,
          storeType,
          purchase.productId,
          coinsPurchased,
          purchase.transactionId,
          purchase.purchaseDate,
          purchase.receipt
        );
        return {
          valid: true,
          duplicate: duplicate,
        };
      } catch (err) {
        logger.error(`Verifying purchase failed: ${errToStr(err)}`);
        return {
          valid: false,
        };
      }
    },
  },
};

export function getResolvers() {
  return resolvers;
}
