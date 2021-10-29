import {PokerGame} from '@src/entity/game/game';
import {Player} from '@src/entity/player/player';
import {errToStr, getLogger} from '@src/utils/log';
import * as firebase from 'firebase-admin';
import {ServiceAccount} from 'firebase-admin';

import {getRunProfile, getRunProfileStr, RunProfile} from '@src/server';
import {Club} from '@src/entity/player/club';
import {default as axios} from 'axios';
import {GoogleAuth} from 'google-auth-library';
import {threadId} from 'worker_threads';
import {GameType} from '@src/entity/types';
import {ClubRepository} from '@src/repositories/club';
import _ from 'lodash';
import {PlayerRepository} from '@src/repositories/player';

//import {default as google} from 'googleapis';
let CLUB_MESSAGE_BATCH_SIZE = 100;

const fs = require('fs');
const {google} = require('googleapis');

const DEV_FCM_API_KEY =
  'AAAAEcBqsEo:APA91bFkBAQryNKEy9r28_FR9T2bFRmULouNucAFK4DvEfODAKH-40jzjlaWN0kcQckqKNUSuDYC0vROKwXgQqYiGjhldBgbDbDdI4SOep8meNtnsKcbkUPDRO6ctv9L4KPHyVsM3Nyl';

const logger = getLogger('firebase');
const FETCH_INTERVAL = 1; // fetch every 60 minutes

export interface ClientFirebaseSettings {
  androidApiKey: string;
  iosApiKey: string;
  androidAppId: string;
  iosAppId: string;
  projectId: string;
  authDomain: string;
  databaseURL: string;
  storageBucket: string;
  messagingSenderId: string;
  measurementId: string | undefined;
}

export interface IapProduct {
  productId: string;
  coins: number;
}

export interface AppInfo {
  help: string;
  toc: string;
  tocUpdatedDate: Date;
  privacyPolicy: string;
  privacyPolicyUpdatedDate: Date;
  attributions: string;
}

export interface Asset {
  id: string;
  type: string;
  name: string;
  size: number;
  link: string;
  active: boolean;
  soundLink: string;
  previewLink: string;
  updatedDate: Date;
}

class FirebaseClass {
  private firebaseInitialized = false;
  private clientFirebaseSettings: ClientFirebaseSettings | undefined;
  private app: firebase.app.App | undefined;
  private serviceAccount: ServiceAccount | undefined;
  private serviceAccountFile = '';
  private productsFetchTime: Date | undefined = undefined;
  private iapProducts = new Array<IapProduct>();
  private assets = new Array<Asset>();
  private appInfo: AppInfo = {
    help: 'Help is not available',
    toc: 'Toc is not available',
    privacyPolicy: 'Privacy policy is not available',
    attributions: 'Attributions is not available',
    tocUpdatedDate: new Date(Date.now()),
    privacyPolicyUpdatedDate: new Date(Date.now()),
  };

  constructor() {}

  private async getAccessToken(): Promise<string | null | undefined> {
    const auth = new GoogleAuth({
      keyFile: this.serviceAccountFile,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    const authClient = await auth.getClient();
    return auth.getAccessToken();
  }

  public getAppInfo(): AppInfo {
    return this.appInfo;
  }

  public async init() {
    const runProfile = getRunProfile();
    let serviceAccountFile = '';
    let clientConfigFile = '';
    const configDir = `${__dirname}/../google-services`;
    if (runProfile === RunProfile.DEV) {
      serviceAccountFile = `${configDir}/dev-poker-club-app.json`;
      clientConfigFile = `${configDir}/client-config-dev.json`;
    } else if (runProfile === RunProfile.PROD) {
      serviceAccountFile = `${configDir}/prod-poker-club-app.json`;
      clientConfigFile = `${configDir}/client-config-prod.json`;
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

    // Configuration served to the apps.
    const config = JSON.parse(fs.readFileSync(clientConfigFile, 'utf8'));
    this.clientFirebaseSettings = config as ClientFirebaseSettings;

    if (runProfile == RunProfile.DEV || runProfile == RunProfile.PROD) {
      await this.fetchFromFirebase();
      this.firebaseInitialized = true;
    }
    logger.info('Firebase is initialized');
  }

  public async getSettings(): Promise<ClientFirebaseSettings | undefined> {
    return this.clientFirebaseSettings;
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

    this.app
      .messaging()
      .send(message, false)
      .then(e => {
        logger.info('Message id: ${ret}');
      })
      .catch(e => {
        logger.error(`Sending message failed`);
      });
  }

  public async sendTestMessage(playerToken: string, data: any) {
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

  public async clubMemberJoinRequest(
    club: Club,
    host: Player,
    requestingPlayer: Player
  ) {
    if (!this.firebaseInitialized) {
      return;
    }

    if (host.firebaseToken !== null && host.firebaseToken.length > 0) {
      const message: firebase.messaging.TokenMessage = {
        data: {
          playerName: requestingPlayer.name,
          playerUuid: requestingPlayer.uuid,
          clubCode: club.clubCode,
          clubName: club.name,
          message: `Player '${requestingPlayer.name}' is requesting to join club '${club.name}'`,
          type: 'MEMBER_JOIN',
        },
        token: host.firebaseToken,
      };
      const ret = await firebase.messaging().send(message, false);
      logger.info(`message id: ${ret}`);
    }
  }

  public async clubMemberDeniedJoinRequest(
    club: Club,
    host: Player,
    requestingPlayer: Player
  ) {
    if (!this.firebaseInitialized) {
      return;
    }

    if (
      requestingPlayer.firebaseToken !== null &&
      requestingPlayer.firebaseToken.length > 0
    ) {
      const message: firebase.messaging.TokenMessage = {
        data: {
          playerName: requestingPlayer.name,
          playerUuid: requestingPlayer.uuid,
          clubCode: club.clubCode,
          clubName: club.name,
          message: `Club host denied request to joining club '${club.name}'`,
          type: 'MEMBER_DENIED',
        },
        token: requestingPlayer.firebaseToken,
      };
      const ret = await firebase.messaging().send(message, false);
      logger.info(`message id: ${ret}`);
    }
  }

  public async sendWaitlistNotification(
    messageId: string,
    game: PokerGame,
    player: Player,
    expTime: Date
  ) {
    if (!this.firebaseInitialized) {
      return;
    }
    if (player.firebaseToken !== null && player.firebaseToken.length > 0) {
      const message: firebase.messaging.TokenMessage = {
        data: {
          type: 'WAITLIST_SEATING',
          gameCode: game.gameCode,
          gameType: game.gameType.toString(),
          smallBlind: game.smallBlind.toString(),
          bigBlind: game.bigBlind.toString(),
          waitlistPlayerId: player.id.toString(),
          expTime: expTime.toISOString(),
          requestId: messageId,
        },
        token: player.firebaseToken,
      };
      const ret = await firebase.messaging().send(message, false);
      logger.info(`message id: ${ret}`);
    }
  }

  public newGame(
    club: Club,
    gameType: GameType,
    sb: number,
    bb: number,
    messageId: string
  ) {
    const message: any = {
      type: 'NEW_GAME',
      clubCode: club.clubCode,
      clubName: club.name,
      gameType: gameType,
      sb: sb.toString(),
      bb: bb.toString(),
      requestId: messageId,
    };
    this.sendClubMsg(club, message).catch(err => {
      logger.error(
        `Failed to send club firebase message: ${
          club.clubCode
        }, err: ${errToStr(err)}`
      );
    });
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
      const members = await ClubRepository.getClubMembersForFirebase(club);
      const chunks = _.chunk(members, CLUB_MESSAGE_BATCH_SIZE);
      for (const chunk of chunks) {
        const toks = _.map(chunk, e => e.firebaseToken);
        const firebaseMessage: firebase.messaging.MulticastMessage = {
          tokens: toks,
          data: message,
        };
        const resp: firebase.messaging.BatchResponse = await this.app
          .messaging()
          .sendMulticast(firebaseMessage);
        logger.info(
          `firebase club message: success count: ${resp.successCount} fail count: ${resp.failureCount}`
        );
        if (resp.failureCount > 0) {
          // find failed users and remove the firebase token
          for (let i = 0; i < resp.responses.length; i++) {
            const r = resp.responses[i];
            if (r.error) {
              try {
                await PlayerRepository.resetFirebaseToken(chunk[i].playerId);
              } catch (e) {
                logger.error(
                  'Resetting firebase token for player ${chunk[i].playerId} failed'
                );
              }
            }
          }
        }
      }
    } catch (err) {
      logger.error(`Sending message to club members failed. ${errToStr(err)}`);
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
      logger.error(`Sending to device group failed. ${errToStr(err)}`);
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
      logger.error(`Sending to device group failed. ${errToStr(err)}`);
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
          fetch = true;
        }
      }
      if (this.iapProducts.length === 0) {
        fetch = true;
      }

      if (fetch) {
        await this.fetchAssets();
        await this.fetchIapProducts();
        await this.fetchAppInfo();
        this.productsFetchTime = new Date();
      }
    } catch (err) {
      logger.error(
        `Cannot fetch data from the firebase database. Error: ${errToStr(err)}`
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
        let id = d.get('id');
        const name = d.get('name');
        if (!id) {
          id = name;
        }
        let size: number = d.get('size');
        const type = d.get('type');
        const link = d.get('link');
        let active: boolean = d.get('is_active');
        const soundLink = d.get('sound_link');
        let previewLink = d.get('preview_link');
        let updatedDate = d.get('updated_date');
        if (updatedDate) {
          updatedDate = updatedDate.toDate();
        }

        if (!size) {
          size = 0;
        }
        if (active === undefined) {
          active = true;
        }
        if (!previewLink) {
          previewLink = link;
        }

        assets.push({
          id: id,
          link: link,
          name: name,
          soundLink: soundLink,
          type: type,
          active: active,
          previewLink: previewLink,
          size: size,
          updatedDate: updatedDate,
        });

        logger.debug(
          `Name: ${name} Size: ${size} active: ${active} type: ${type} url: ${link}`
        );
      }
      this.assets = assets;
      return this.assets;
    } catch (err) {
      logger.error(`Could not get assets from the firestore. ${errToStr(err)}`);
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
        logger.debug(`Coin: ${id} coin: ${coins} active: ${active}`);
      }
      this.iapProducts = iapProducts;
      return this.iapProducts;
    } catch (err) {
      logger.error(
        `Could not get products from the firestore. ${errToStr(err)}`
      );
    }
    return this.iapProducts;
  }

  public async fetchAppInfo() {
    try {
      const query = await this.app?.firestore().collection('info');
      const docs = await query?.listDocuments();
      if (!docs) {
        throw new Error('Could not get app info');
      }
      for (const doc of docs) {
        const d = await doc.get();
        const id = d.id;
        if (id === 'attributions') {
          this.appInfo.attributions = d.get('content');
        } else if (id === 'toc') {
          this.appInfo.toc = d.get('content');
          this.appInfo.tocUpdatedDate = d.get('updated_date').toDate();
        } else if (id === 'privacy_policy') {
          this.appInfo.privacyPolicy = d.get('content');
          this.appInfo.privacyPolicyUpdatedDate = d
            .get('updated_date')
            .toDate();
        } else if (id === 'help') {
          this.appInfo.help = d.get('content');
        }
      }
    } catch (err) {
      logger.error(
        `Could not get products from the firestore. ${errToStr(err)}`
      );
    }
  }

  public async getAvailableProducts(): Promise<Array<IapProduct>> {
    try {
      await this.fetchFromFirebase();
      return this.iapProducts;
    } catch (err) {
      logger.error(
        `Could not get products from the firestore. ${errToStr(err)}`
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
      logger.error(`Could not get assets from the firestore. ${errToStr(err)}`);
      throw new Error('Could not fetch assets');
    }
  }

  public async getAllAssets(): Promise<Array<Asset>> {
    try {
      await this.fetchFromFirebase();
      const ret = new Array<Asset>();
      for (const asset of this.assets) {
        if (asset.active) {
          ret.push(asset);
        }
      }
      return ret;
    } catch (err) {
      logger.error(`Could not get assets from the firestore. ${errToStr(err)}`);
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
      logger.error(`Could not get assets from the firestore. ${errToStr(err)}`);
      throw new Error('Could not fetch assets');
    }
  }
}

export interface AppSettings {
  maxClubCount: number;
  newUserFreeCoins: number;
  clubHostFreeCoins: number;
  consumeTime: number;
  coinsAlertNotifyTime: number;
  notifyHostTimeWindow: number; // notify host before time expires
  gameCoinsPerBlock: number;
  compressHandData: boolean;
  ipGpsCheckInterval: number;
}

// get from firebase and update periodically
let settings: AppSettings;
resetAppSettings();

export function getAppSettings(): AppSettings {
  return settings;
}

export function resetAppSettingsTest() {
  settings = {
    maxClubCount: 5, // each user can create upto 25 clubs
    newUserFreeCoins: 10,
    clubHostFreeCoins: 0,
    consumeTime: 1 * 60, // every 1 minutes
    coinsAlertNotifyTime: 30, // every 30 seconds
    gameCoinsPerBlock: 5, // 5 coins per 1 minutes
    notifyHostTimeWindow: 2 * 60 * 60,
    compressHandData: false,
    ipGpsCheckInterval: 15 * 60,
  };
  return settings;
}

export function resetAppSettings() {
  settings = {
    maxClubCount: 20,
    newUserFreeCoins: 20,
    clubHostFreeCoins: 100,
    consumeTime: 30 * 60, // every 30 minutes
    coinsAlertNotifyTime: 15 * 60,
    gameCoinsPerBlock: 5, // 5 coins per 30 minutes
    notifyHostTimeWindow: 10 * 60,
    compressHandData: false,
    ipGpsCheckInterval: 15 * 60,
  };
  return settings;
}
const Firebase = new FirebaseClass();
export {Firebase};
