const fastify = require('fastify')({
  logger: true,
});

const cors = require('@fastify/cors');
const multipart = require('@fastify/multipart');
fastify.register(require('./plugins/axios'));

// Register CORS (very important for React Native)
fastify.register(cors, {
  origin: true, // allow all origins OR set specific origin: 'http://localhost:19006'
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
});



// Register multipart (optional — for image upload support)
fastify.register(multipart);

fastify.register(require('./routes/categories'), { prefix: '/categories' });
fastify.register(require('./routes/products'), { prefix: '/products' });
fastify.register(require('./routes/coupons'), { prefix: '/coupons' });
fastify.register(require('./routes/offer'), { prefix: '/offers' });
fastify.register(require('./routes/banners'), { prefix: '/banners' });
fastify.register(require('./routes/admin'), { prefix: '/admin' });
fastify.register(require('./routes/auth'), { prefix: '/auth' });
fastify.register(require('./routes/user'), { prefix: '/user' });
fastify.register(require('./routes/cart'), { prefix: '/cart' });
fastify.register(require('./routes/orders'), { prefix: '/orders' });
fastify.register(require('./routes/phonepe'), { prefix: '/phonepe' });
fastify.register(require('./routes/shipping'), { prefix: '/shipping' });
fastify.register(require('./routes/analytics'), { prefix: '/analytics' });
fastify.register(require('./routes/deilvery'), { prefix: '/delivery' });
fastify.register(require('./routes/time'), { prefix: '/time' });


// Register JSON parser (Fastify already does this automatically)
fastify.register(require('@fastify/formbody'));

// Register Prisma plugin
fastify.register(require('./plugins/prisma'));

// Root route
fastify.get('/', async (request, reply) => {
  return { hello: 'world' };
});

const start = async () => {
  try {
    await fastify.listen({ port: 5555, host: '0.0.0.0' });
    console.log('🚀 Server running at http://localhost:5555');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();