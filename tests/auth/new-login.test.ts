import axios from 'axios';
import * as jwt from 'jsonwebtoken';
import {getJwtSecret} from '../../src/auth';
import {signUp} from '../utils/auth.testutils';

import {EXTERNAL_PORT, resetDatabase, startGqlServer} from '../utils/utils';

describe('New login APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });

  test('New login with empty payload', async () => {
    try {
      await axios.post(`http://localhost:${EXTERNAL_PORT}/auth/new-login`);
    } catch (error) {
      const expectedErrors = [
        'device-secret field is required',
        'device-id field is required',
      ];
      expect((error as any).response.data.errors).toEqual(
        expect.arrayContaining(expectedErrors)
      );
      expect((error as any).response.status).toEqual(400);
    }
  });

  test('New login with invalid deviceId', async () => {
    const deviceId = 'doesNotExists';
    try {
      await axios.post(`http://localhost:${EXTERNAL_PORT}/auth/new-login`, {
        'device-id': deviceId,
        'device-secret': 'test',
      });
    } catch (error) {
      const expectedErrors = [
        `Player with device id ${deviceId} does not exist`,
      ];
      expect((error as any).response.data.errors).toEqual(
        expect.arrayContaining(expectedErrors)
      );
      expect((error as any).response.status).toEqual(403);
    }
  });

  test('New login with invalid device secret', async () => {
    const deviceId = 'Test';
    const screenName = 'Test';
    await signUp({screenName, deviceId});

    try {
      await axios.post(`http://localhost:${EXTERNAL_PORT}/auth/new-login`, {
        'device-id': deviceId,
        'device-secret': 'test',
      });
    } catch (error) {
      const expectedErrors = [
        `Login failed for ${deviceId}. Incorrect device secret.`,
      ];
      expect((error as any).response.data.errors).toEqual(
        expect.arrayContaining(expectedErrors)
      );
      expect((error as any).response.status).toEqual(403);
    }
  });

  test('New login with valid payload', async () => {
    const deviceId = 'Test';
    const screenName = 'Test';
    const response = await signUp({screenName, deviceId});

    const data = await axios.post(
      `http://localhost:${EXTERNAL_PORT}/auth/new-login`,
      {
        'device-id': deviceId,
        'device-secret': response.data['device-secret'],
      }
    );

    const payload = jwt.verify(data.data.jwt, getJwtSecret());
    expect(payload['user']).toEqual(screenName);
    expect(payload['uuid']).toEqual(response.data.uuid);
    expect(payload['id']).toEqual(response.data.id);
  });

  test('Jwt token validation', async () => {
    const deviceId = 'Test';
    const screenName = 'Test';
    const response = await signUp({screenName, deviceId});

    const data = await axios.post(
      `http://localhost:${EXTERNAL_PORT}/auth/new-login`,
      {
        'device-id': deviceId,
        'device-secret': response.data['device-secret'],
      }
    );

    const payload = jwt.verify(data.data.jwt, getJwtSecret());
    expect(payload['user']).toEqual(screenName);
    expect(payload['uuid']).toEqual(response.data.uuid);
    expect(payload['id']).toEqual(response.data.id);

    try {
      await axios.post(
        `http://localhost:${EXTERNAL_PORT}/auth/new-login`,
        {
          'device-id': deviceId,
          'device-secret': response.data['device-secret'],
        },
        {
          headers: {
            authorization: 'jwt test',
          },
        }
      );
    } catch (error) {
      const expectedError = 'Invalid JWT. Unauthorized';
      expect((error as any).response.status).toEqual(401);
      expect((error as any).response.data).toEqual(expectedError);
    }
  });
});
