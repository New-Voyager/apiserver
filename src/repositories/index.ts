import {
  Connection,
  EntitySchema,
  getConnection,
  getManager,
  getRepository,
  ObjectType,
  Repository,
} from 'typeorm';

export function getUserRepository<Entity>(
  entityClass: ObjectType<Entity> | EntitySchema<Entity> | string,
  connectionName?: string
): Repository<Entity> {
  return getRepository(entityClass, 'users');
}

export function getHistoryRepository<Entity>(
  entityClass: ObjectType<Entity> | EntitySchema<Entity> | string,
  connectionName?: string
): Repository<Entity> {
  return getRepository(entityClass, 'history');
}

export function getGameRepository<Entity>(
  entityClass: ObjectType<Entity> | EntitySchema<Entity> | string,
  connectionName?: string
): Repository<Entity> {
  return getRepository(entityClass, 'livegames');
}

export function getDebugRepository<Entity>(
  entityClass: ObjectType<Entity> | EntitySchema<Entity> | string,
  connectionName?: string
): Repository<Entity> {
  return getRepository(entityClass, 'debug');
}

export function getUserManager() {
  return getManager('users');
}

export function getGameManager() {
  return getManager('livegames');
}

export function getHistoryManager() {
  return getManager('history');
}

export function getUserConnection(): Connection {
  return getConnection('users');
}

export function getHistoryConnection(): Connection {
  return getConnection('history');
}

export function getGameConnection(): Connection {
  return getConnection('livegames');
}
