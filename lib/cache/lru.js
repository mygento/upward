const LRU = require('lru-cache');

const getClient = (options) => {
  return new LRU(options);
}

module.exports = { client: getClient };
