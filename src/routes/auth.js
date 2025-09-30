const { validateOtp } = require('../services/message-central');
const axios = require('axios');// adjust import as needed
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';

async function authRoutes(fastify, options) {
  fastify.post('/send-otp', {
    schema: {
      body: {
        type: 'object',
        required: ['mobileNumber'],
        properties: {
          mobileNumber: { type: 'string' },
          countryCode: { type: 'string', default: '91' },
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { mobileNumber, countryCode } = request.body;

      // 🔹 Skip sending OTP for dummy test number
      if (mobileNumber === '1234567891') {
        return reply.code(200).send({
          message: 'Dummy OTP always works',
          verificationId: 'dummy-verification-id'
        });
      }

      const response = await fastify.axios.post(
        'https://cpaas.messagecentral.com/verification/v3/send',
        null, // no body
        {
          params: {
            countryCode,
            flowType: 'SMS',
            mobileNumber,
            otpLength: 6
          },
          headers: {
            authToken: process.env.MESSAGE_CENTRAL_AUTHTOKEN,
          },
        }
      );

      return reply.code(200).send(response.data);
    } catch (error) {
      reply.status(500).send({ error: error.message });
    }
  });

  fastify.post('/validate-otp', {
    schema: {
      body: {
        type: 'object',
        required: ['verificationId', 'code'],
        properties: {
          verificationId: { type: 'string' },
          code: { type: 'string' },
        }
      }
    }
  }, async (request, reply) => {
    try {
      const { verificationId, code } = request.body;

      // 🔹 Dummy login bypass
      if (verificationId === 'dummy-verification-id' && code === '123456') {
        let user = await fastify.prisma.user.findUnique({ where: { phone: '1234567891' } });
        if (!user) {
          user = await fastify.prisma.user.create({
            data: { phone: '1234567891', name: 'Test User', phoneVerified: true }
          });
        }

        const token = jwt.sign(
          { userId: user.id, phone: user.phone },
          JWT_SECRET,
          { expiresIn: '30d' }
        );
        return reply.send({ success: true, user, token, verificationStatus: "VERIFICATION_COMPLETED" });

      }

      // 🔹 Normal OTP flow
      const result = await validateOtp(verificationId, code);
      if (
        result.data &&
        result.data.verificationStatus === "VERIFICATION_COMPLETED" &&
        result.data.mobileNumber
      ) {
        let user = await fastify.prisma.user.findUnique({ where: { phone: result.data.mobileNumber } });
        if (!user) {
          user = await fastify.prisma.user.create({
            data: { phone: result.data.mobileNumber, name: '', phoneVerified: true }
          });
        }

        const token = jwt.sign(
          { userId: user.id, phone: user.phone },
          JWT_SECRET,
          { expiresIn: '30d' }
        );
        reply.send({ success: true, user, token, verificationStatus: result.data.verificationStatus });
      } else {
        reply.send({ success: false, error: result.data?.errorMessage || 'Invalid OTP' });
      }
    } catch (error) {
      reply.status(500).send({ error: error.message });
    }
  });

  fastify.post('/generate-token', async (request, reply) => {
    try {
      const response = await axios.get(`https://cpaas.messagecentral.com/auth/v1/authentication/token`, {
        params: {
          customerId: process.env.MESSAGE_CENTRAL_CUSTOMER_ID,
          key: Buffer.from(process.env.MESSAGE_CENTRAL_KEY).toString('base64'),
          scope: 'NEW',
        },
        headers: {
          'accept': '*/*',
        }
      });
      return reply.code(200).send(response.data);
    } catch (error) {
      reply.status(500).send({ error: error.message });
    }
  });
}

module.exports = authRoutes;
