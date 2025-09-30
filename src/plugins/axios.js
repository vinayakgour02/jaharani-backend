// plugins/axios.js
const fp = require('fastify-plugin');
const axios = require('axios');

async function axiosPlugin(fastify, options) {
  fastify.decorate('axios', axios);
}

module.exports = fp(axiosPlugin);
