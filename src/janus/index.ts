import {getLogger} from '@src/utils/log';
import {default as axios} from 'axios';
import {v4 as uuidv4} from 'uuid';

const AUDIO_BRIDGE = 'janus.plugin.audiobridge';
export const JANUS_APISECRET = 'janusrocks';
export const JANUS_TOKEN = '';
export const JANUS_SECRET = '';
const JANUS_HTTP_URL = 'http://139.59.57.29:8088/janus';

const logger = getLogger('Janus');

export class JanusSession {
  private _id = '';
  private _handleId = '';
  private _apiSecret = '';

  public static janusUrl(): string {
    if (process.env.JANUS_URL) {
      return process.env.JANUS_URL;
    } else {
      return JANUS_HTTP_URL;
      //return 'http://139.59.73.106:8088/janus';
    }
  }
  public static async create(apiSecret: string) {
    const tranId = uuidv4();
    const payload: any = {
      janus: 'create',
      transaction: tranId,
      apisecret: apiSecret,
    };
    if (apiSecret) {
      payload.withCredentials = true;
    }
    const resp = await axios.post(JanusSession.janusUrl(), payload);
    logger.info(JSON.stringify(resp.data));
    const session = new JanusSession();
    session._apiSecret = apiSecret;
    session._id = resp.data.data['id'];
    logger.info(`Janus Room ${session._id} is created`);
    return session;
  }

  public getId(): string {
    return this._id;
  }

  public getHandleId(): string {
    return this._id;
  }

  public static joinSession(id: string) {
    const session = new JanusSession();
    session._id = id;
    return session;
  }

  public async attachAudio() {
    const tranId = uuidv4();

    const payload: any = {
      janus: 'attach',
      plugin: AUDIO_BRIDGE,
      transaction: tranId,
      apisecret: this._apiSecret,
      withCredentials: true,
      session_id: this._id,
    };
    const url = `${JanusSession.janusUrl()}/${this._id}`;
    const resp = await axios.post(url, payload);
    //logger.info(JSON.stringify(resp.data));
    this._handleId = resp.data.data['id'];
  }

  public async attachAudioWithId(handleId: string) {
    this._handleId = handleId;
  }

  public async createRoom(roomId: number, pin: string) {
    if (roomId === 0) {
      return;
    }

    const tranId = uuidv4();

    const payload: any = {
      janus: 'message',
      transaction: tranId,
      apisecret: this._apiSecret,
      withCredentials: true,
      body: {
        request: 'create',
        room: roomId,
        pin: pin,
        is_private: true,
        audiolevel_event: true,
        audio_level_average: 60,
      },
    };
    const url = `${JanusSession.janusUrl()}/${this._id}/${this._handleId}`;
    const resp = await axios.post(url, payload);
    logger.info(`Created janus room: ${roomId}`);
    //logger.info(JSON.stringify(resp.data));
  }

  public async joinRoom(roomId: number) {
    const tranId = uuidv4();

    const payload: any = {
      janus: 'message',
      transaction: tranId,
      apisecret: this._apiSecret,
      withCredentials: true,
      body: {
        request: 'join',
        room: roomId,
      },
    };
    const url = `${JanusSession.janusUrl()}/${this._id}/${this._handleId}`;
    const resp = await axios.post(url, payload);
    //logger.info(JSON.stringify(resp.data));
  }

  public async leaveRoom(roomId: number) {
    const tranId = uuidv4();

    const payload: any = {
      janus: 'message',
      transaction: tranId,
      apisecret: this._apiSecret,
      withCredentials: true,
      body: {
        request: 'leave',
      },
    };
    const url = `${JanusSession.janusUrl()}/${this._id}/${this._handleId}`;
    const resp = await axios.post(url, payload);
    //logger.info(JSON.stringify(resp.data));
  }

  public async deleteRoom(roomId: number) {
    const tranId = uuidv4();

    const payload: any = {
      janus: 'message',
      transaction: tranId,
      apisecret: this._apiSecret,
      withCredentials: true,
      body: {
        request: 'delete',
        room: roomId,
      },
    };
    const url = `${JanusSession.janusUrl()}/${this._id}/${this._handleId}`;
    const resp = await axios.post(url, payload);
    //logger.info(JSON.stringify(resp.data));
  }
}
