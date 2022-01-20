import {AccessToken} from 'livekit-server-sdk';
//key and secret should come from the firebase
let key = 'APIgWkHqWZTFn9Y';
let secret = '0ZeAyeXdFjEMhZfEK14icDTr20JFOt30z5zKkqmi3AXB';
let ttl = '48h';
let url = 'wss://livekit.pokerclub.app';

interface LivekitConfig {
  url: string;
  key: string;
  secret: string;
}

class LivekitClass {
  private livekitUrls = new Array<LivekitConfig>();
  public init(urls: any) {
    this.livekitUrls = [];
    for (const url of urls) {
      this.livekitUrls.push({
        url: url['url'],
        key: url['apiKey'],
        secret: url['secret'],
      });
    }
  }

  public getToken(url: string, gameCode: string, playerId: number): string {
    if (this.livekitUrls.length === 0) {
      return '';
    }
    let server: LivekitConfig | undefined;
    for (const config of this.livekitUrls) {
      if ((config.url = url)) {
        server = config;
        break;
      }
    }
    if (!server) {
      return '';
    }

    const token = new AccessToken(server.key, server.secret, {
      ttl: ttl,
      identity: playerId.toString(),
    });
    token.addGrant({
      roomJoin: true,
      room: gameCode,
      canPublish: true,
      canSubscribe: true,
    });
    const jwt = token.toJwt();
    return jwt;
  }

  public getUrl(gameId: number): string {
    if (this.livekitUrls.length === 0) {
      return '';
    }
    const serverIdx = gameId % this.livekitUrls.length;
    const server = this.livekitUrls[serverIdx];
    return server.url;
  }
}

export const Livekit = new LivekitClass();
