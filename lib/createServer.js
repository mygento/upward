const express = require('express');
const morgan = require('morgan');

const middleware = require('./middleware');

async function createServer({
  bind = false,
  port = 3000,
  host = '0.0.0.0',
}) {
  const app = express();
  const env = process.env;

  const upward = await middleware();

  if (env.NODE_ENV === 'production') {
    app.use(morgan('combined'));
  } else {
    app.use(morgan('dev'));
  }
  app.use(upward);

  if (!bind) {
    return { app };
  }
  return new Promise((resolve, reject) => {
    try {
      const server = require('http').createServer(app);
      server.listen(port, host);

      server.on('listening', () => {
        resolve({
          app,
          server,
          close() {
              return new Promise(resolve => {
                  server.on('close', resolve);
                  server.close();
              });
          }
        });
      });
    }
    catch (e) {
      reject(e);
    }
  });
}

module.exports = createServer;
