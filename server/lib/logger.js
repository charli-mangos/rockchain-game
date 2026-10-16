// server/lib/logger.js
// El servidor usa console.log para trazas de depuración muy detalladas
// (inventarios, estados de ronda...). En producción solo se mantienen
// warn y error, salvo que LOG_LEVEL=debug.
const configureConsole = (env = process.env, target = console) => {
  const level = (env.LOG_LEVEL || (env.NODE_ENV === 'production' ? 'warn' : 'debug')).toLowerCase();
  if (level !== 'debug' && level !== 'info') {
    target.log = () => {};
    target.info = () => {};
    target.debug = () => {};
  } else if (level === 'info') {
    target.debug = () => {};
  }
  return level;
};

module.exports = { configureConsole };
