// These keys are used for dev only
// production keys will be injected via environment variables

import * as AWS from 'aws-sdk';
import * as fs from 'fs';

let apiKey = 'ODVR77D5X55UB3JVZUHU';
let apiSecret = 'HXF/WPIpuLOVuziKvVnFvWPCqKBzP/jAb+v1nUqCicQ';
let spaceName = 'assets-pokerclubapp';
let assetsUrl = 'https://assets-pokerclubapp.nyc3.digitaloceanspaces.com/';

//const HANDS_DO_SECRET = 'XO8QFOXXZ0/44o9FjYfASUe6Gfu7bFceY9/zAEPs810';
//const HANDS_DO_KEY = '7CNGQ5PO3RXTG5XDOBXZ';
let handsUrl = 'https://hands-pokerclub.nyc3.digitaloceanspaces.com/';
let handsBucket = 'hands-pokerclub';

class DigitalOceanImpl {
  private s3: AWS.S3 | null;

  constructor() {
    this.s3 = null;
  }

  public initialize() {
    AWS.config.update({
      accessKeyId: apiKey,
      secretAccessKey: apiSecret,
    });
    const endPoint = new AWS.Endpoint('nyc3.digitaloceanspaces.com');
    this.s3 = new AWS.S3({endpoint: endPoint});
  }

  public async uploadPlayerPic(
    playerUuid: string,
    data: Uint8Array
  ): Promise<string> {
    if (this.s3 === null) {
      throw new Error('Upload object is not initialized');
    }
    const path = `dev/players/${playerUuid}.jpeg`;
    //const data = fs.readFileSync(fileName);
    const resp = this.s3.putObject({
      Bucket: spaceName,
      Key: path,
      Body: data,
      ACL: 'public-read',
    });
    return resp
      .promise()
      .then(data => {
        return assetsUrl + path;
      })
      .catch(err => {
        throw new Error(`Failed to update player pic`);
      });
  }

  public async uploadClubPic(
    clubCode: string,
    data: Uint8Array
  ): Promise<string> {
    if (this.s3 === null) {
      throw new Error('Upload object is not initialized');
    }
    const now = Date.now();
    const nowInMins = Math.ceil(now / (60 * 1000));
    const path = `dev/clubs/${clubCode}-${nowInMins}.jpeg`;
    //const data = fs.readFileSync(fileName);
    const resp = this.s3.putObject({
      Bucket: spaceName,
      Key: path,
      Body: data,
      ACL: 'public-read',
    });
    return resp
      .promise()
      .then(data => {
        return assetsUrl + path;
      })
      .catch(err => {
        throw new Error('Failed to update club pic');
      });
  }

  public uploadHandData(gameCode: string, data: Uint8Array) {
    if (this.s3 === null) {
      throw new Error('Upload object is not initialized');
    }
    const path = `game/${gameCode}/hand.dat`;
    const resp = this.s3.putObject({
      Bucket: handsBucket,
      Key: path,
      Body: Buffer.from(data),
      ACL: 'public-read',
    });
    return resp
      .promise()
      .then(data => {
        return handsUrl + path;
      })
      .catch(err => {
        throw new Error('Failed to hand data');
      });
  }
}

export const DigitalOcean = new DigitalOceanImpl();
