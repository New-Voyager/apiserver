import axios from 'axios';
import {signUp} from '../utils/auth.testutils';

import {EXTERNAL_PORT, resetDatabase, startGqlServer} from '../utils/utils';

describe('Recovery code APIs', () => {
  let stop;

  beforeAll(async done => {
    const testServer = await startGqlServer();
    stop = testServer.stop;
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    stop();
    done();
  });

  test('get recovery code without email', async () => {
    try {
      await axios.post(`http://localhost:${EXTERNAL_PORT}/auth/recovery-code`);
    } catch (error) {
      const expectedError = 'Email address is not found';
      expect(error.response.data.error).toEqual(expectedError);
      expect(error.response.status).toEqual(403);
    }
  });

  test('get recovery code with invalid email', async () => {
    const email = 'test@example.com';
    try {
      await axios.post(`http://localhost:${EXTERNAL_PORT}/auth/recovery-code`, {
        email,
      });
    } catch (error) {
      const expectedError = `${email} is not a registered email`;
      expect(error.response.data.error).toEqual(expectedError);
      expect(error.response.status).toEqual(500);
    }
  });

  test('get recovery code with valid email', async () => {
    const screenName = 'Test1';
    const deviceId = 'Test1';
    const email = 'test@example.com';

    await signUp({screenName, deviceId, email});

    const data = await axios.post(
      `http://localhost:${EXTERNAL_PORT}/auth/recovery-code`,
      {
        email,
      }
    );
    expect(data.status).toEqual(200);
    expect(data.data.status).toEqual('OK');
  });
});
