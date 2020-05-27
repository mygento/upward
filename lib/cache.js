const debug = require('debug')('upward:cache');

const CACHE_BAN = ['cart', 'wishlist', 'customer', 'customerOrders', 'currency'];
const CACHE_TIME = 1000 * 60 * 60 * 6;
const CACHE_OPTIONS = {
  maxAge: CACHE_TIME
};

const canCache = (query, ctx, auth = false) => {
  if (auth !== false) {
    return false;
  }
  const mutations = query.definitions.filter((d) => d.operation === 'mutation');
  if (mutations.length > 0) {
    return false;
  }

  const operation = ctx.request.body.operationName;
  if (CACHE_BAN.includes(operation)) {
    return false;
  }

  return true;
};

const getClientType = () => {
  return process.env.CACHE_STORAGE || 'lru';
};

const getClient = (options = {}) => {
  switch (getClientType()) {
    case 'redis':
      const redisHost = process.env.REDIS_HOST || '127.0.0.1';
      return require('./cache/redis').client({
        host: redisHost
      });
    default:
      return require('./cache/lru').client(CACHE_OPTIONS);
  }
}

const getKey = (client, key) => {
  debug('fetch key', key);
  switch (getClientType()) {
    case 'redis':
      return client.get(key).then(value => JSON.parse(value));
    default:
      return client.get(key);
  }
}

const hasKey = (client, key) => {
  debug('check key', key);
  switch (getClientType()) {
    case 'redis':
      return client.exists(key);
    default:
      return client.has(key);
  }
}

const setKey = (client, key, value) => {
  debug('set key', key, value, 'expire', CACHE_TIME / 1000);
  switch (getClientType()) {
    case 'redis':
      return client.set(key, JSON.stringify(value), 'ex', CACHE_TIME / 1000);
    default:
      return client.set(key, value);
  }
}

const purge = (client, key) {
  debug('purge key', key);
  switch (getClientType()) {
    default:
      client.reset();
  }
}

const purgeAll = (client) {
  debug('purge all');
  switch (getClientType()) {
    case 'redis':
      client.flushdb();
      break;
    default:
      client.reset();
  }
}

const appendCacheTags = (client, key, hash) => {
  debug('append', key, hash, 'expire', CACHE_TIME / 1000);

  switch (getClientType()) {
    case 'redis':
      (async () => {
        const current = await client.smembers('tag_' + key) || [];
        debug('current', current);
        client.sadd('tag_' + key, hash);
        debug('new', await client.smembers('tag_' + key));
      })();
      break;
    default:
      const current = client.get('tag_' + key) || [];
      debug('current', current);
      debug('new', [...(client.get('tag_' + key) || []), hash]);
      return client.set('tag_' + key, [...(client.get('tag_' + key) || []), hash]);
  }
}

module.exports = {
  canCache,
  getClient,
  getKey,
  hasKey,
  setKey,
  appendCacheTags,
  purge,
  purgeAll
};
