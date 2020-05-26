const debug = require('debug')('upward:rabbit');
const QUEUE_NAME = process.env.QUEUE_NAME || 'magento.cache';
const QUEUE_CONNECTION = process.env.QUEUE_CONNECTION || 'amqp://localhost';

const connectToQueue = (callback) => {
  const consumer = require('amqplib');
  consumer.connect(QUEUE_CONNECTION)
    .then(conn => conn.createChannel())
    .then(ch => ch.assertQueue(QUEUE_NAME)
      .then(ok => ch.consume(QUEUE_NAME, msg => {
        if (msg !== null) {
          debug(msg.content.toString());
          callback(msg.content);
          ch.ack(msg);
        }
      })))
    .catch(debug);
}

module.exports = {
  connectToQueue
};
