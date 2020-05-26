const Redis = require('ioredis');

const getClient = (options) => {
  return new Redis(options);
}

module.exports = { client: getClient };
