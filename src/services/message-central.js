const axios = require('axios');

const MESSAGE_CENTRAL_API = 'https://cpaas.messagecentral.com';

async function validateOtp(verificationId, code) {
  try {
    const response = await axios.get(`${MESSAGE_CENTRAL_API}/verification/v3/validateOtp`, {
      params: {
        verificationId,
        code,
      },
      headers: {
        'authToken': process.env.MESSAGE_CENTRAL_AUTHTOKEN,
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error validating OTP:', error.response ? error.response.data : error.message);
    throw new Error('Could not validate OTP');
  }
}

module.exports = {
  validateOtp,
}; 