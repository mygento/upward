const CACHE_BAN = ['cart', 'wishlist', 'customer', 'customerOrders', 'currency'];
const CACHE_OPTIONS = { maxAge: 1000 * 60 * 60 * 6 };

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

          break;
      default:
          return require('./cache/lru').client(CACHE_OPTIONS);
  }
}

const getKey = (client, key) => {
    switch (getClientType()) {
        case 'redis':
            break;
        default:
            return client.get(key);
    }
}

const hasKey = (client, key) => {
    switch (getClientType()) {
        case 'redis':
            break;
        default:
            return client.has(key);
    }
}

const setKey = (client, key, value) => {
    switch (getClientType()) {
        case 'redis':
            break;
        default:
            return client.set(key, value);
    }
}

const appendToKey = (client, key, value) => {

}

module.exports = { canCache, getClient, getKey, hasKey, setKey, appendToKey };
