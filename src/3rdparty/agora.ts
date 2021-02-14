import {RtcTokenBuilder, RtcRole} from 'agora-access-token';

// we may need to insert this via environment variable
const AGORA_APP_ID = 'd980328a1f1f4c32a7a3f44ed8a6ae83'; // created using soma.voyager account

const AGORA_APP_CERT = 'e55f38310d204e6aad4db6c570ca8d52';

export async function getAgoraToken(channelName: string, uid: number) {
  const expireTime = new Date().getTime() / 1000 + 600;
  const token = RtcTokenBuilder.buildTokenWithUid(
    AGORA_APP_ID,
    AGORA_APP_CERT,
    channelName,
    uid,
    RtcRole.PUBLISHER,
    expireTime
  );
  return token;
}
