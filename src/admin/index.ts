import {PromotionRepository} from '@src/repositories/promotion';
import {getLogger} from '@src/utils/log';
import {max} from 'lodash';

const logger = getLogger('admin_promotion');

export async function deleteAll(req: any, resp: any) {
  try {
    const result = await PromotionRepository.deleteAll();
    resp.status(200).send({result: result});
  } catch (error) {
    logger.error(error.message);
    resp.contentType('application/json');
    resp.status(501).send({error: error.message});
  }
}

export async function getAllPromotion(req: any, resp: any) {
  try {
    const result = await PromotionRepository.findAll();
    resp.status(200).send({result: result});
  } catch (error) {
    logger.error(error.message);
    resp.contentType('application/json');
    resp.status(501).send({error: error.message});
  }
}
export async function createPromotion(req: any, resp: any) {
  const name = req.body['name'];
  const code = req.body['code'];
  const expiresAt = req.body['expires-at'];
  const coins = req.body['coins'];
  const playerId = req.body['player-id'];
  const maxCount = req.body['max-count'];

  const errors = new Array<string>();
  if (!name) {
    errors.push('name is required');
  }
  if (!code) {
    errors.push('code is required');
  }
  if (!coins) {
    errors.push('coins is required');
  }

  if (!playerId && !maxCount && !expiresAt) {
    errors.push('expires-at is required');
  }
  if (playerId && maxCount) {
    errors.push('either player-id or max-count is only allowed');
  }
  if (errors.length >= 1) {
    resp.contentType('application/json');
    return resp.status(400).send(JSON.stringify({errors: errors}));
  }

  try {
    const result = await PromotionRepository.createPromotion(
      name,
      code,
      coins,
      playerId,
      maxCount,
      expiresAt
    );
    resp.status(200).send({result: result});
  } catch (error) {
    logger.error(error.message);
    resp.contentType('application/json');
    resp.status(501).send({error: error.message});
  }
}
