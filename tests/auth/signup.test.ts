import axios from 'axios';
import * as jwt from 'jsonwebtoken';
import {getJwtSecret} from '../../src/auth';
import {signUp} from '../utils/auth.testutils';

import {resetDatabase, startGqlServer} from '../utils/utils';

describe('Auth APIs', () => {
  beforeAll(async done => {
    await resetDatabase();
    done();
  });

  afterAll(async done => {
    done();
  });

  test('SignUp with empty payload', async () => {
    try {
      await signUp({screenName: undefined, deviceId: undefined});
    } catch (error) {
      const expectedErrors = [
        'screen-name field is required',
        'device-id field is required',
      ];
      expect((error as any).response.data.errors).toEqual(
        expect.arrayContaining(expectedErrors)
      );
      expect((error as any).response.status).toEqual(400);
    }
  });

  test('SignUp with right payload', async () => {
    const screenName = 'Test';
    const deviceId = 'Test';

    const data = await signUp({screenName, deviceId});

    expect(data.status).toEqual(200);
    expect(data.data.name).toEqual(screenName);

    const payload = jwt.verify(data.data.jwt, getJwtSecret());
    expect(payload['user']).toEqual(screenName);
    expect(payload['uuid']).toEqual(data.data.uuid);
    expect(payload['id']).toEqual(data.data.id);
  });

  test('SignUp with duplicate email', async () => {
    const screenName = 'Test1';
    const deviceId = 'Test1';
    const email = 'testemail';

    await signUp({screenName, deviceId, email});

    const anotherName = 'Test2';
    const anotherDeviceId = 'Test2';

    try {
      await signUp({screenName: anotherName, deviceId: anotherDeviceId, email});
    } catch (error) {
      const expectedErrors = [
        'Error: Another device is registered with this recovery email address',
      ];
      expect((error as any).response.data.errors).toEqual(
        expect.arrayContaining(expectedErrors)
      );
      expect((error as any).response.status).toEqual(500);
    }
  });
});
