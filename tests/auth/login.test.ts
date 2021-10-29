import axios from 'axios';
import * as jwt from 'jsonwebtoken';
import {getJwtSecret} from '../../src/auth';
import {signUp} from '../utils/auth.testutils';

import {resetDatabase, startGqlServer} from '../utils/utils';

const PORT_NUMBER = 9501;

describe('Login APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });

  test('SignIn with empty payload', async () => {
    try {
      await axios.post(`http://localhost:${PORT_NUMBER}/auth/login`);
    } catch (error) {
      const expectedErrors = ['uuid and deviceId should be specified to login'];
      expect((error as any).response.data.errors).toEqual(
        expect.arrayContaining(expectedErrors)
      );
      expect((error as any).response.status).toEqual(500);
    }
  });

  test('SignIn with payload', async () => {
    const screenName = 'Test';
    const deviceId = 'Test';
    const {
      data: {uuid, id},
    } = await signUp({screenName, deviceId});

    const data = await axios.post(
      `http://localhost:${PORT_NUMBER}/auth/login`,
      {
        uuid,
        'device-id': deviceId,
      }
    );

    const payload = jwt.verify(data.data.jwt, getJwtSecret());
    expect(payload['user']).toEqual(screenName);
    expect(payload['uuid']).toEqual(uuid);
    expect(payload['id']).toEqual(id);
  });

  test('SignIn with invalid deviceId', async () => {
    const screenName = 'Test';
    const deviceId = 'Test';
    const {
      data: {uuid},
    } = await signUp({screenName, deviceId});

    try {
      await axios.post(`http://localhost:${PORT_NUMBER}/auth/login`, {
        uuid,
        'device-id': 'anotherDeviceId',
      });
    } catch (error) {
      const expectedErrors = ['Invalid device id'];
      expect((error as any).response.data.errors).toEqual(
        expect.arrayContaining(expectedErrors)
      );
      expect((error as any).response.status).toEqual(401);
    }
  });

  test('SignIn with invalid uuid', async () => {
    const deviceId = 'Test';

    try {
      await axios.post(`http://localhost:${PORT_NUMBER}/auth/login`, {
        uuid: 'test',
        'device-id': deviceId,
      });
    } catch (error) {
      const expectedErrors = ['Player is not found'];
      expect((error as any).response.data.errors).toEqual(
        expect.arrayContaining(expectedErrors)
      );
      expect((error as any).response.status).toEqual(401);
    }
  });

  test('SignIn with invalid name', async () => {
    try {
      await axios.post(`http://localhost:${PORT_NUMBER}/auth/login`, {
        name: 'test',
      });
    } catch (error) {
      const expectedError = 'test user is not found';
      expect((error as any).response.data.error).toEqual(expectedError);
      expect((error as any).response.status).toEqual(500);
    }
  });

  test('SignIn with invalid password', async () => {
    const screenName = 'Test3';
    const deviceId = 'Test3';

    const {
      data: {uuid},
    } = await signUp({screenName, deviceId, email: 'test3'});

    try {
      await axios.post(`http://localhost:${PORT_NUMBER}/auth/login`, {
        uuid,
        'device-id': deviceId,
        password: 'test',
        email: 'test3',
      });
    } catch (error) {
      const expectedErrors = ['Invalid password'];
      expect((error as any).response.data.errors).toEqual(
        expect.arrayContaining(expectedErrors)
      );
      expect((error as any).response.status).toEqual(401);
    }
  });
});
