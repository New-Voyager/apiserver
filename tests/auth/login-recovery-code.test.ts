import axios from 'axios';
import {signUp} from '../utils/auth.testutils';

import {EXTERNAL_PORT, resetDatabase, startGqlServer} from '../utils/utils';

describe('Login recovery code APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });

  test('Login recovery code without email', async () => {
    try {
      await axios.post(
        `http://localhost:${EXTERNAL_PORT}/auth/login-recovery-code`
      );
    } catch (error) {
      const expectedError = 'Email address is required';
      expect(error.response.data.error).toEqual(expectedError);
      expect(error.response.status).toEqual(403);
    }
  });

  test('Login recovery code without code', async () => {
    const email = 'test@example.com';
    try {
      await axios.post(
        `http://localhost:${EXTERNAL_PORT}/auth/login-recovery-code`,
        {
          email,
        }
      );
    } catch (error) {
      const expectedError = 'code is required';
      expect(error.response.data.error).toEqual(expectedError);
      expect(error.response.status).toEqual(403);
    }
  });

  test('Login recovery code without deviceId', async () => {
    const email = 'test@example.com';
    const code = 'test';
    try {
      await axios.post(
        `http://localhost:${EXTERNAL_PORT}/auth/login-recovery-code`,
        {
          email,
          code,
        }
      );
    } catch (error) {
      const expectedError = 'New device id is required';
      expect(error.response.data.error).toEqual(expectedError);
      expect(error.response.status).toEqual(403);
    }
  });

  test('Login recovery code with unregistered email', async () => {
    const email = 'test@example.com';
    const code = 'test';
    const deviceId = 'Test';
    try {
      await axios.post(
        `http://localhost:${EXTERNAL_PORT}/auth/login-recovery-code`,
        {
          email,
          code,
          'device-id': deviceId,
        }
      );
    } catch (error) {
      const expectedError = `${email} is not a registered email`;
      expect(error.response.data.error).toEqual(expectedError);
      expect(error.response.status).toEqual(400);
    }
  });

  test('Login recovery code with invalid code', async () => {
    const email = 'test@example.com';
    const code = 'test';
    const deviceId = 'Test';
    const screenName = 'Test1';

    await signUp({screenName, deviceId, email});
    try {
      await axios.post(
        `http://localhost:${EXTERNAL_PORT}/auth/login-recovery-code`,
        {
          email,
          code,
          'device-id': deviceId,
        }
      );
    } catch (error) {
      const expectedError = 'Recovery code does not match';
      expect(error.response.data.error).toEqual(expectedError);
      expect(error.response.status).toEqual(400);
    }
  });
});
