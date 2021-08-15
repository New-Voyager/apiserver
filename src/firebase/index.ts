import {PokerGame} from '@src/entity/game/game';
import {Player} from '@src/entity/player/player';
import {getLogger} from '@src/utils/log';
import * as firebase from 'firebase-admin';
import {ServiceAccount} from 'firebase-admin';
import {getRunProfile, getRunProfileStr, RunProfile} from '@src/server';
import {Club} from '@src/entity/player/club';
import {default as axios} from 'axios';
import {GoogleAuth} from 'google-auth-library';

//import {default as google} from 'googleapis';

const fs = require('fs');
const {google} = require('googleapis');

const DEV_FCM_API_KEY =
  'AAAAEcBqsEo:APA91bFkBAQryNKEy9r28_FR9T2bFRmULouNucAFK4DvEfODAKH-40jzjlaWN0kcQckqKNUSuDYC0vROKwXgQqYiGjhldBgbDbDdI4SOep8meNtnsKcbkUPDRO6ctv9L4KPHyVsM3Nyl';

const logger = getLogger('firebase');
const FETCH_INTERVAL = 1; // fetch every 60 minutes

export interface IapProduct {
  productId: string;
  coins: number;
}

export interface Asset {
  type: string;
  name: string;
  size: string;
  link: string;
  active: boolean;
  soundLink: string;
  previewLink: string;
  updatedDate: Date;
}

class FirebaseClass {
  private firebaseInitialized = false;
  private app: firebase.app.App | undefined;
  private serviceAccount: ServiceAccount | undefined;
  private serviceAccountFile = '';
  private productsFetchTime: Date | undefined = undefined;
  private iapProducts = new Array<IapProduct>();
  private assets = new Array<Asset>();

  constructor() {}

  private async getAccessToken(): Promise<string | null | undefined> {
    const auth = new GoogleAuth({
      keyFile: this.serviceAccountFile,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    const authClient = await auth.getClient();
    return auth.getAccessToken();
  }

  public async init() {
    const runProfile = getRunProfile();
    let serviceAccountFile = '';
    if (runProfile === RunProfile.DEV) {
      serviceAccountFile = `${__dirname}/../google-services/dev-poker-club-app.json`;
    } else {
      logger.error(
        `Run profile is not supported ${RunProfile[runProfile].toString()}`
      );
      return;
    }
    logger.info(`Using ${serviceAccountFile} to initialize firebase`);
    const serviceAccount = JSON.parse(
      fs.readFileSync(serviceAccountFile, 'utf8')
    );
    const account = serviceAccount as ServiceAccount;
    this.app = firebase.initializeApp({
      credential: firebase.credential.cert(account),
    });
    this.serviceAccount = serviceAccount;
    this.serviceAccountFile = serviceAccountFile;
    this.firebaseInitialized = false;
    logger.info('Firebase is initialized');
  }

  public async sendMessage(playerToken: string, data: any) {
    if (!this.firebaseInitialized) {
      return;
    }
    if (!this.app) {
      return;
    }

    const message: firebase.messaging.TokenMessage = {
      data: data,
      token: playerToken,
    };

    const ret = await this.app.messaging().send(message, false);
    logger.info(`message id: ${ret}`);
  }

  public async notifyBuyInRequest(
    game: PokerGame,
    requestingPlayer: Player,
    host: Player,
    amount: number
  ) {
    if (!this.firebaseInitialized) {
      return;
    }
    if (host.firebaseToken !== null && host.firebaseToken.length > 0) {
      const message: firebase.messaging.TokenMessage = {
        data: {
          amount: amount.toString(),
          gameCode: game.gameCode,
          playerName: requestingPlayer.name,
          playerUuid: requestingPlayer.uuid,
          type: 'BUYIN_REQUEST',
        },
        token: host.firebaseToken,
      };
      const ret = await firebase.messaging().send(message, false);
      logger.info(`message id: ${ret}`);
    }
  }

  public async notifyReloadRequest(
    game: PokerGame,
    requestingPlayer: Player,
    host: Player,
    amount: number
  ) {
    if (!this.firebaseInitialized) {
      return;
    }

    if (host.firebaseToken !== null && host.firebaseToken.length > 0) {
      const message: firebase.messaging.TokenMessage = {
        data: {
          amount: amount.toString(),
          gameCode: game.gameCode,
          playerName: requestingPlayer.name,
          playerUuid: requestingPlayer.uuid,
          type: 'RELOAD_REQUEST',
        },
        token: host.firebaseToken,
      };
      const ret = await firebase.messaging().send(message, false);
      logger.info(`message id: ${ret}`);
    }
  }

  public async newClubCreated(
    club: Club,
    owner: Player
  ): Promise<[string, string]> {
    if (!this.firebaseInitialized) {
      return ['', ''];
    }

    const profileStr = getRunProfileStr();
    const profile = getRunProfile();
    // register a new device group
    const groupName = `${profileStr}-${club.clubCode}`;
    //const accessToken = await this.getAccessToken();
    let apiKey: string | undefined;
    if (profile === RunProfile.DEV) {
      apiKey = DEV_FCM_API_KEY;
    }
    if (apiKey) {
      try {
        const url = 'https://fcm.googleapis.com/fcm/notification';
        const authToken = `key=${apiKey}`;
        const payload = {
          operation: 'create',
          notification_key_name: groupName,
          registration_ids: [owner.firebaseToken],
        };
        const resp = await axios.post(url, payload, {
          headers: {
            Authorization: authToken,
            project_id: '76242661450',
          },
        });
        const respData = resp.data;
        logger.info('${respData}');
        // return notification key
        return [groupName, respData['notification_key']];
      } catch (err) {
        logger.error(
          `Failed to create device group for club ${
            club.name
          }. Error: ${err.toString()}`
        );
        return ['', ''];
      }
    }
    return ['', ''];
  }

  public async sendClubMsg(club: Club, message: any) {
    if (!this.firebaseInitialized) {
      return;
    }

    if (!this.app) {
      logger.error('Firebase is not initialized');
      return;
    }
    try {
      await this.app
        .messaging()
        .sendToDeviceGroup(club.firebaseNotificationKey, {
          data: message,
        });
    } catch (err) {
      logger.error(`Sending to device group failed. ${err.toString()}`);
    }
  }

  public async sendPlayerMsg(player: Player, message: any) {
    if (!this.firebaseInitialized) {
      return;
    }
    if (!this.app) {
      logger.error('Firebase is not initialized');
      return;
    }
    try {
      await this.app.messaging().sendToDevice(player.firebaseToken, {
        data: message,
      });
    } catch (err) {
      logger.error(`Sending to device group failed. ${err.toString()}`);
    }
  }

  public async playerRenamed(host: Player, oldName: string, newName: string) {
    if (!this.firebaseInitialized) {
      return;
    }
    if (!this.app) {
      logger.error('Firebase is not initialized');
      return;
    }
    try {
      await this.app.messaging().sendToDevice(host.firebaseToken, {
        data: {
          message: `Player '${oldName}' changed name to '${newName}'`,
          type: 'PLAYER_RENAMED',
        },
      });
    } catch (err) {
      logger.error(`Sending to device group failed. ${err.toString()}`);
    }
  }

  public async fetchFromFirebase() {
    try {
      let fetch = false;
      if (!this.productsFetchTime) {
        fetch = true;
      } else {
        const now = new Date();
        const diff = now.getTime() - this.productsFetchTime.getTime();
        const diffInMins = diff / (60 * 1000);
        if (diffInMins > FETCH_INTERVAL) {
          logger.info('Fetch iap products');
          fetch = true;
        }
      }
      if (this.iapProducts.length === 0) {
        fetch = true;
      }

      if (fetch) {
        await this.fetchAssets();
        await this.fetchIapProducts();
        this.productsFetchTime = new Date();
      }
    } catch (err) {
      logger.error(
        `Cannot fetch data from the firebase database. Error: ${err.toString()}`
      );
    }
  }

  public async fetchAssets() {
    // get all the assets and cache it
    try {
      const assets = new Array<Asset>();
      const query = await this.app?.firestore().collection('assets'); //.where("isactive","==",true);
      const docs = await query?.listDocuments();

      if (!docs) {
        throw new Error('Could not get assets');
      }
      for (const doc of docs) {
        const d = await doc.get();
        const name = d.get('name');
        const size = d.get('size');
        const type = d.get('type');
        const link = d.get('link');
        const active = d.get('is_active');
        const soundLink = d.get('sound_link');
        const previewLink = d.get('preview_link');
        const updatedDate = d.get('updated_date');

        assets.push({
          link: link,
          name: name,
          soundLink: soundLink,
          type: type,
          active: active,
          previewLink: previewLink,
          size: size,
          updatedDate: updatedDate,
        });

        logger.info(
          `Name: ${name} Size: ${size} active: ${active} type: ${type} url: ${link}`
        );
      }
      this.assets = assets;
      return this.assets;
    } catch (err) {
      logger.error(
        `Could not get assets from the firestore. ${err.toString()}`
      );
      throw new Error('Could not fetch assets');
    }
  }

  public async fetchIapProducts() {
    try {
      const iapProducts = new Array<IapProduct>();
      const query = await this.app?.firestore().collection('products');
      const docs = await query?.listDocuments();
      if (!docs) {
        throw new Error('Could not get products');
      }
      for (const doc of docs) {
        const d = await doc.get();
        const id = d.get('id');
        const coins = d.get('coins');
        const active = d.get('active');
        if (active) {
          iapProducts.push({
            productId: id,
            coins: coins,
          });
        }
        logger.info(`Coin: ${id} coin: ${coins} active: ${active}`);
      }
      this.iapProducts = iapProducts;
      return this.iapProducts;
    } catch (err) {
      logger.error(
        `Could not get products from the firestore. ${err.toString()}`
      );
    }
    return this.iapProducts;
  }

  public async getAvailableProducts(): Promise<Array<IapProduct>> {
    try {
      await this.fetchFromFirebase();
      return this.iapProducts;
    } catch (err) {
      logger.error(
        `Could not get products from the firestore. ${err.toString()}`
      );
      throw new Error('Could not fetch products');
    }
  }

  public async getGameBackgroundAssets(): Promise<Array<Asset>> {
    try {
      await this.fetchFromFirebase();
      const ret = new Array<Asset>();
      for (const asset of this.assets) {
        if (asset.active && asset.type === 'game-background') {
          ret.push(asset);
        }
      }
      return ret;
    } catch (err) {
      logger.error(
        `Could not get assets from the firestore. ${err.toString()}`
      );
      throw new Error('Could not fetch assets');
    }
  }

  public async getTableAssets(): Promise<Array<Asset>> {
    try {
      await this.fetchFromFirebase();
      const ret = new Array<Asset>();
      for (const asset of this.assets) {
        if (asset.active && asset.type === 'table') {
          ret.push(asset);
        }
      }
      return ret;
    } catch (err) {
      logger.error(
        `Could not get assets from the firestore. ${err.toString()}`
      );
      throw new Error('Could not fetch assets');
    }
  }
}

export interface AppSettings {
  newUserFreeCoins: number;
  freeTime: number;
  agoraEnabled: boolean;
  janusEnabled: boolean;
  consumeTime: number;
  notifyHostTimeWindow: number; // notify host before time expires
  gameCoinsPerBlock: number;
  agoraCoinsPerBlock: number;
  compressHandData: boolean;
}

// get from firebase and update periodically
let settings: AppSettings = {
  newUserFreeCoins: 20,
  freeTime: 15 * 60, // seconds
  notifyHostTimeWindow: 5 * 60, // seconds
  agoraEnabled: true,
  janusEnabled: true,
  consumeTime: 15 * 60, // every 15 minutes
  gameCoinsPerBlock: 3, // 3 coins per 15 minutes
  agoraCoinsPerBlock: 3, // 3 coins per 15 minutes
  compressHandData: false,
};

export function getAppSettings(): AppSettings {
  return settings;
}

export function resetAppSettings() {
  settings = {
    newUserFreeCoins: 20,
    freeTime: 15 * 60, // seconds
    agoraEnabled: true,
    janusEnabled: true,
    consumeTime: 15 * 60, // every 15 minutes
    gameCoinsPerBlock: 3, // 3 coins per 15 minutes
    agoraCoinsPerBlock: 3, // 3 coins per 15 minutes
    notifyHostTimeWindow: 10 * 60,
    compressHandData: false,
  };
}

const Firebase = new FirebaseClass();
export {Firebase};
