import axios from 'axios';
import {PORT_NUMBER} from './utils';

export const signUp = async ({screenName, deviceId, email}: any) => {
  const data = await axios.post(`http://localhost:${PORT_NUMBER}/auth/signup`, {
    email,
    'screen-name': screenName,
    'device-id': deviceId,
  });

  return data;
};
