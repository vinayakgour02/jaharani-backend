// scripts/flush.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Flushing tables...');

  await prisma.orderItem.deleteMany({});
  console.log('Deleted all OrderItems');

  await prisma.order.deleteMany({});
  console.log('Deleted all Orders');

  await prisma.otpVerification.deleteMany({});
  console.log('Deleted all OTP verifications');

  await prisma.address.deleteMany({});
  console.log('Deleted all Addresses');

  console.log('All specified tables flushed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
