const debug = require('debug')('upward:cache');

const CACHE_BAN = ['cart', 'wishlist', 'customer', 'customerOrders', 'currency'];
const CACHE_TIME = 1000 * 60 * 60 * 6;
const CACHE_OPTIONS = { maxAge: CACHE_TIME };

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
        return require('./cache/redis').client({ host: redisHost });
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

const appendToKey = (client, key, value) => {

}

module.exports = { canCache, getClient, getKey, hasKey, setKey, appendToKey };
