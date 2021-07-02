import {PokerGame} from '@src/entity/game/game';
import {Player} from '@src/entity/player/player';
import {getLogger} from '@src/utils/log';
import * as firebase from 'firebase-admin';
import {ServiceAccount} from 'firebase-admin';
import {getRunProfile, getRunProfileStr, RunProfile} from '@src/server';
import {Club} from '@src/entity/player/club';
import {JWT} from 'google-auth-library';
import {default as axios} from 'axios';
import {GoogleAuth} from 'google-auth-library';

//import {default as google} from 'googleapis';

var fs = require('fs');
const {google} = require('googleapis');

const DEV_FCM_API_KEY =
  'AAAAEcBqsEo:APA91bFkBAQryNKEy9r28_FR9T2bFRmULouNucAFK4DvEfODAKH-40jzjlaWN0kcQckqKNUSuDYC0vROKwXgQqYiGjhldBgbDbDdI4SOep8meNtnsKcbkUPDRO6ctv9L4KPHyVsM3Nyl';

// var serviceAccountOld = {
//   type: 'service_account',
//   projectId: 'poker-club-app',
//   privateKeyId: '811278dd416bccf8abf0170f18f27dbfdc63a024',
//   privateKey:
//     '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDmKAF1gpHuajJS\nQdPCz5UwKtuob3jQhKxUre6gTYt+A5EcJik4YcQfAQN9j4TZfnAldCzDE8ZOX0f4\nDBKX6Z1EABHBXy4pjS8tD5gVJseYh0u0j4op/lRLmrXWLsJX1c04CGeIhgVseYza\n8X3TxDIYRN2A9CQL5knEBuJQc3BJRzgDWffAIkm+iSwBpUME4nwY4OROY30Hv3iR\n1ONm0JdP0sjiEdy2dmLK00H+0Kw2vzHPWVInr+HuiYSWoJ/J15lhnpA3OYJ08beP\n6dZaxF67wzWGUQDYbOJsG+r5j0C5dV6zcG7kuNg/6NWLZzKXIkwXNUDUfE6HCBCb\nOV+oScJ5AgMBAAECggEABpXZhkQenOLvNXNjqBBH9nlS4t3ag1pLUwOo4ZQcJUQl\nXE7dXG1hs4Kvl8Y8PWmZV8q3pLtsgh3GmH9vpcJQRIlviugRdb7UdA1K7GDd26fv\nqNlTSBuIAv8Rx4L7x+us+ttZRrz/Pc2Bitqgsac6JG1pbvEIzEnvzXZmP4xDLFT1\nMDhVP8cirI4rfQGPUT9qrwqXEDdU7q6WTHYIu9bc1hXNS41g9Swx5bwBOHgDQ4rC\nBLsgK6NLQkp/IJpUccdSIztqNkSHYeocTWioeNM2c+gjSh0BSwV0PTw5J2VIw+kI\ngIJCvyUW/0iU9MvXaECuGkcCW+ZquX5RbE4bHZFlXQKBgQD8gwmlncyoisLYf3Il\ncFp1g8JOJo5GlNzs2X2qRoE/5MI92wmZmY0eycupYpMNjSEmI9NZ/yZREcH0lqUU\nbvf/cBq5pMUlCxYpFwAPbs7FeJn1Cq+VtJTIFua+2EYZ06wRfnxGf4KL2XmjTLWc\nYLNI7c0MNrvaf2Ivy4Jd9PlytQKBgQDpVelZhnQrBdFjXWQgRgPLrgB+b/COFAym\nezKTMXqUb3BUFBSSbxmYEjmfUqsTy156NEmJ19vUHcgu4GOMANYQ7GSn4a+01BEI\nfBZ6tienajaM6ib8uIFkOlZ73bT2Jx1MRlQ/c2/6d1oicJcacbDodVTKkSJ98Jl2\nGptggnPXNQKBgDJ3VfQ9p2t/4BU4021cGRgnbywDVKgSlFzZ0t23HZnRdGi8YBzM\nrYGbvxJpWw54SEnBGzp/Xf8R13u0p+V/kB0DILQ9lBElOBaaPC7ZbIXW5p4sto7q\n+llLCm7V9pyuy1LrvpawYTzmCAN1D07jnLFUpYhtX/n5P3xh5fo1Pa2JAoGBAIRy\n+OeRk8WMIuRlcd2EAMmQNsWOoxzzMo8Z5YZ6EpvJehiv4VGR8RRKXB0dHvE4gqOZ\npJizSBxq32QEiV1CaEDo/uXxDPz3V8faMCRt26qDdv2cOI9B6GjNWKQtIHiNkWrn\njRELZOfm8eoUwSEIoiQB3iSyJ8MXXPUWe1ZYFot1AoGBAPAmyAdhweZyNi6BKisN\n8cB1065QrE55lMb7EpXYi/xrAdTikDkBoQVA/00asdCNb7cvOt3YAq5vf3eU1Oqj\n+01d2sHkr1/cKbiCV0IkNAhlZjUYbUKxYkqP620/IhLGTg92pvRkmu97iEFaFVeS\n+Skb+Wi1OY3tn5fhdMUbYtlz\n-----END PRIVATE KEY-----\n',
//   clientEmail: 'firebase-adminsdk-e4h53@poker-club-app.iam.gserviceaccount.com',
//   clientId: '101014893742098390947',
//   authUri: 'https://accounts.google.com/o/oauth2/auth',
//   tokenUri: 'https://oauth2.googleapis.com/token',
//   authProviderX509CertUrl: 'https://www.googleapis.com/oauth2/v1/certs',
//   clientX509CertUrl:
//     'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-e4h53%40poker-club-app.iam.gserviceaccount.com',
// }; //require("poker-club-app-firebase-adminsdk-e4h53-811278dd41.json");

// var serviceAccount = {
//   type: 'service_account',
//   project_id: 'pokerclub-d6e60',
//   private_key_id: '495fedfca7b70affee17363a8e3b8c626867c3f9',
//   private_key:
//     '-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQCND4U8lrNObiEQ\nmzty04MEKOUCG1/NueINZyBicqfYvuMCFWLWGUeKHa2oAoshdLaGf2j0aI4gVz47\nJ2YQgGn9bs7x1bRMgqtA8fIOUrPAPf7jDHAraxXScikxH0j0EDzSZ/gLgfiGYPOm\nEBvUtn9MdGRQqOsG25hSQZ4CgCbMgN0c0WGU4jNnCMVsroV/T7gWiC1a52q1DcZo\n0tMAQp91ppliEQw7NZU+3zWMmxZZyMqTRD/4QyBO0AfNOZz2ik/4I8sHd5t2+sFe\n4+khMoZ3wfmfuSt7SNvmTXozbxRfepvfgtwuZslxDw+aNzR7T36hYKufpSpQns0U\n9K1IqUf/AgMBAAECggEAMrLB1dFqF4XAb4oDV1VK0Ptrt5KkH7ov01ZdztRbnCyb\nRVvvXnjOfAcHq4tiev9KPNPdIn7Tmi8RCEy0Q7kLnxEs4sFGoHsUVu6+a0RxI2aE\nzhDh3dEKkk0Cngua+lE9sve4MFahvpZo66X9grmmzhFFHrJfamMRf3ri8g4iI7yi\nYXqrdk0Q7y3qpfq4L+YP1n6OWrHv8b0z800AG+mw51/Eg20Gg97Ig3tt+lFjWGyI\ndXrfhLwTihXXNEGRhZwuhF5zjkQeX1xW4jz8cSTRlQmB7pUYH27O+03x6W9qJ4zs\ngO8fpx4ksZ+gnApwDXtU2xVhrbmaXzKfAD8ZAkBsjQKBgQC/jWs9joz11nl3LLGo\npSp2Qymj8vKDwdUCCmfwKc867nHqnt84biwABkVcdrIkFtJC7QeIi8aFn12G4mCI\nP5DlmuyIR7sRaA6x5AT2VJoUSxavgCK7zm6+sDKta+INNepALA8f+4/bwaEZEvZF\ni6z3rgH3lYq/Cp7GgFclkr2fewKBgQC8hTLMii7L3hi+eQ3ERwGbLgCK/XnEV9hn\n2fb4U1NWmuGVgfN+Ab749osa/StiFrVJv4kEqLJbPqJsuQpfH5YBlMq1NnSnc779\n8ABNN7Ci+ahAjYKuP/IiXJtZYUfxI02HGwQLg32m5XrnnXOtTBPQ2I4Taf9gm7bC\ndA1x30fwTQKBgQC6+O0untBUvk691vBq7x0tZo1krKWvmimy3jlqIUVX/ptPKlg0\nmsV0GKrngCyOMYB3NypdTCIxF8eQ+7LCC1oB5GDw/SNJ8Eo3tZxqXVYwbMLt96Lv\nsqZCl3Y/9MgnoPLQRLFWxJQ9Kxl2gh3E8HubH0xoQJ23sEQe+fMWh89ztQKBgQCO\nTkHFcr3WeMXW6kxBEJSezj/sq2CCnQkng7pRQ50SMAH/OMRUJv9AseLZsahQ9/FL\nRUEp+ioAhKxZQ+kXWyGB+g52ci/mw5G14LhpkZNNwwWGDQxLesvNsng2JSAIX+zD\nAtqv0kdEd8+qDQnoFBiVOxMshoQXKhPwf2gywChutQKBgQC/h4nDiO0/SCzCo6LS\nRog8vXd5QGd8IWkQ/qtWUDz9dapybJTEqn+S1zMlea4YsrtSqC1S9vCJzqeq86B5\nBVgKaO7biQLdgW8royOCJVwv2ITBncEcHHML7aVOBDCW3e0UyAvKd2kemdFojg2i\n42f537Aa8XHZU1Et3Vif66uPxg==\n-----END PRIVATE KEY-----\n',
//   client_email: 'apiserver-test@pokerclub-d6e60.iam.gserviceaccount.com',
//   client_id: '114199387966031288854',
//   auth_uri: 'https://accounts.google.com/o/oauth2/auth',
//   token_uri: 'https://oauth2.googleapis.com/token',
//   auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
//   client_x509_cert_url:
//     'https://www.googleapis.com/robot/v1/metadata/x509/apiserver-test%40pokerclub-d6e60.iam.gserviceaccount.com',
// };

const logger = getLogger('firebase');

class FirebaseClass {
  private app: firebase.app.App | undefined;
  private serviceAccount: ServiceAccount | undefined;
  private serviceAccountFile: string = '';

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
    let serviceAccountFile: string = '';
    if (runProfile === RunProfile.DEV) {
      serviceAccountFile = `${__dirname}/../google-services/dev-poker-club-app.json`;
    } else {
      throw new Error(
        `Run profile is not supported ${RunProfile[runProfile].toString()}`
      );
    }
    logger.info(`Using ${serviceAccountFile} to initialize firebase`);
    var serviceAccount = JSON.parse(
      fs.readFileSync(serviceAccountFile, 'utf8')
    );
    const account = serviceAccount as ServiceAccount;
    this.app = firebase.initializeApp({
      credential: firebase.credential.cert(account),
    });
    this.serviceAccount = serviceAccount;
    this.serviceAccountFile = serviceAccountFile;
    logger.info('Firebase is initialized');
  }

  public async sendMessage(playerToken: string, data: any) {
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
}

const Firebase = new FirebaseClass();
export {Firebase};
