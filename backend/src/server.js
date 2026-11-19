/**
 * Server Entrypoint
 * Starts the HTTP server on configured PORT.
 */

const app = require('./app');
const env = require('./config/env');

const server = app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`\n======================================================`);
  console.log(`🚀 AI Customer Support Agent Backend running on port ${env.PORT}`);
  console.log(`📡 URL: http://localhost:${env.PORT}`);
  console.log(`💡 Health Check: http://localhost:${env.PORT}/api/health`);
  console.log(`======================================================\n`);
});

// Graceful shutdown handling
function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Gracefully closing HTTP server...`);
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

module.exports = server;
