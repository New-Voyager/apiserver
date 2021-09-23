import axios from 'axios';
import {EXTERNAL_PORT} from './utils';

export const signUp = async ({screenName, deviceId, email}: any) => {
  const data = await axios.post(
    `http://localhost:${EXTERNAL_PORT}/auth/signup`,
    {
      email,
      'screen-name': screenName,
      'device-id': deviceId,
    }
  );

  return data;
};
