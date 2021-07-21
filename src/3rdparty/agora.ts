import {RtcTokenBuilder, RtcRole} from 'agora-access-token';

// we need to inject these via environment variables
const AGORA_APP_ID = 'e25000bdccc24765a9464555c65d430b'; // created using soma.voyager account (Dev project)
const AGORA_APP_CERT = '9dceeb98b8b548bc87116a9827047e32';

export async function getAgoraToken(channelName: string, uid: number) {
  const expireTime = new Date().getTime() / 1000 + 600;
  const token = RtcTokenBuilder.buildTokenWithUid(
    AGORA_APP_ID,
    AGORA_APP_CERT,
    channelName,
    uid,
    RtcRole.PUBLISHER,
    0
  );
  return token;
}

export function getAgoraAppId() {
  return AGORA_APP_ID;
}
