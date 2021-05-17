import {getLogger} from '@src/utils/log';
import {default as axios} from 'axios';
import {v4 as uuidv4} from 'uuid';
const Janus = require('janus-gateway-js');

const JANUS_URL = '143.110.189.156';
const JANUS_HTTP_URL = 'http://143.110.189.156:8088/janus';
const AUDIO_BRIDGE = 'janus.plugin.audiobridge';
export const JANUS_APISECRET = 'janusrocks';

var janus = new Janus.Client(`ws://${JANUS_URL}:8188`, {
  apisecret: 'janusrocks',
  keepalive: 'true',
});

var conn;

export async function getAudioSession(roomId: number, pin: string) {
  const id = `${roomId}`;
  if (conn == null) {
    conn = await janus.createConnection();
  }
  const session = await conn.createSession(); //{keepalive: true});
  const plugin = await session.attachPlugin(AUDIO_BRIDGE);
  const sessionId = session.getId();
  const pluginId = plugin.getId();
  try {
    const room = await plugin.create(roomId, {pin: pin});
    //const join = await plugin.join(roomId, {id: 1, pin: '1234'});
  } catch (e) {
    // if room already exists, ignore it
  }
  plugin.detach();
  return [sessionId, pluginId];
}

export async function closeAudioSession(
  roomId: number,
  sessionId: number,
  pluginId: number
) {
  //const conn = await janus.createConnection();
  const session = Janus.Session.create(conn, sessionId);
  const plugin = await session.attachPlugin(AUDIO_BRIDGE);
  //  const plugin = Janus.Plugin.create(session, '', pluginId);
  plugin.destroy(roomId);
  plugin.detach();
  session.cleanup();
}

export async function getAudioSessionHttp(roomId: number, pin: string) {}
const logger = getLogger('Janus');

export class JanusSession {
  private _id: string = '';
  private _handleId: string = '';
  private _apiSecret: string = '';

  public static async create(apiSecret: string) {
    const tranId = uuidv4();
    const payload: any = {
      janus: 'create',
      transaction: tranId,
      apisecret: apiSecret,
      withCredentials: true,
    };
    const resp = await axios.post(JANUS_HTTP_URL, payload);
    logger.info(JSON.stringify(resp.data));
    const session = new JanusSession();
    session._apiSecret = apiSecret;
    session._id = resp.data.data['id'];
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
    const url = `${JANUS_HTTP_URL}/${this._id}`;
    const resp = await axios.post(url, payload);
    logger.info(JSON.stringify(resp.data));
    this._handleId = resp.data.data['id'];
  }

  public async attachAudioWithId(handleId: string) {
    this._handleId = handleId;
  }

  public async createRoom(roomId: number, pin: string) {
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
      },
    };
    const url = `${JANUS_HTTP_URL}/${this._id}/${this._handleId}`;
    const resp = await axios.post(url, payload);
    logger.info(JSON.stringify(resp.data));
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
    const url = `${JANUS_HTTP_URL}/${this._id}/${this._handleId}`;
    const resp = await axios.post(url, payload);
    logger.info(JSON.stringify(resp.data));
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
    const url = `${JANUS_HTTP_URL}/${this._id}/${this._handleId}`;
    const resp = await axios.post(url, payload);
    logger.info(JSON.stringify(resp.data));
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
    const url = `${JANUS_HTTP_URL}/${this._id}/${this._handleId}`;
    const resp = await axios.post(url, payload);
    logger.info(JSON.stringify(resp.data));
  }
}
