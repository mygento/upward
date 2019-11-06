const debug = require('debug')('upward:middleware');

class UpwardMiddleware {
  async load() {
    debug('routes loading should be here');
  }

  async getHandler() {
    return async (req, res, next) => {
      debug('LOGGED request');
      next();
    }
  }
}

async function RoutingMiddleware() {
    const middleware = new UpwardMiddleware();
    await middleware.load();
    return middleware.getHandler();
}

module.exports = RoutingMiddleware;
