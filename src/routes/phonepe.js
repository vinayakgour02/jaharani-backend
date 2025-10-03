const { StandardCheckoutClient, Env, StandardCheckoutPayRequest } = require('pg-sdk-node');

const clientId = 'SU2509302010389222215384';
const clientSecret = 'a6563f6f-14e0-4bf4-88b6-5cfd44220f1f';
const clientVersion = 1;
const env = Env.PRODUCTION;
const phonepeClient = StandardCheckoutClient.getInstance(
    clientId,
    clientSecret,
    clientVersion,
    env
);

const BASE_URL = 'https://jaharani.anextinfotech.com';
const DEVLOPEMENT_URL = 'http://192.168.29.166:5555';

async function phonepeRoutes(fastify, options) {
    // ------------------------
    // Initiate Payment
    // ------------------------
    fastify.post('/phonepe/initiate', async (request, reply) => {

        try {
            const { userId, addressId, amount, items, paymentMethod, coupon } =
                request.body;

            if (
                !userId ||
                !addressId ||
                !amount ||
                !items ||
                !Array.isArray(items) ||
                items.length === 0
            ) {
                return reply.status(400).send({
                    success: false,
                    error: 'Missing required parameters',
                });
            }

            // Coupon logic
            let couponId = null;
            let discount = 0;
            if (coupon && coupon.code) {
                const dbCoupon = await fastify.prisma.coupon.findUnique({
                    where: { code: coupon.code },
                });
                if (dbCoupon) {
                    couponId = dbCoupon.id;
                    discount = dbCoupon.discount || 0;
                }
            }

            // Calculate order totals
            const subtotal = items.reduce(
                (sum, item) => sum + item.price * item.quantity,
                0
            );
            const shipping = await fastify.prisma.shipping.findFirst();
            const deliveryCharges = shipping ? shipping.price : 0;
            const tax = 0;
            const total = subtotal + deliveryCharges + tax - discount;

            const orderNumber = `ORD-${Date.now()}-${Math.floor(
                Math.random() * 10000
            )}`;

            // Create order in DB
            const order = await fastify.prisma.order.create({
                data: {
                    orderNumber,
                    userId,
                    addressId,
                    subtotal,
                    deliveryCharges,
                    tax,
                    discount,
                    total,
                    status: 'PENDING',
                    paymentStatus: 'PENDING',
                    paymentMethod:
                        paymentMethod === 'cod'
                            ? 'COD'
                            : paymentMethod === 'upi'
                                ? 'UPI'
                                : 'ONLINE',
                    paymentGateway: 'phonepe',
                    couponId,
                    items: {
                        create: items.map((item) => ({
                            productId: item.productId,
                            quantity: item.quantity,
                            price: item.price,
                        })),
                    },
                },
                include: { items: true },
            });

            // Track coupon usage
            if (couponId) {
                await fastify.prisma.couponUsage.create({
                    data: {
                        userId,
                        couponId,
                        orderId: order.id,
                        discount,
                    },
                });
            }

            const redirectUrl = `jharanaiapp://verify-payment/${order.id}`;


            const PhonepeRequest = StandardCheckoutPayRequest.builder()
                .merchantOrderId(order.id)
                .amount(Math.round(total * 100)) // paise
                .redirectUrl(redirectUrl)
                .build();

            const response = await phonepeClient.pay(PhonepeRequest);

            return reply.send({
                success: true,
                paymentUrl: response.redirectUrl,
                orderId: order.id,
                merchantOrderId: order.id
            });
        } catch (error) {
            console.error('[PhonePe] Payment initiation error:', error);
            return reply.status(500).send({
                success: false,
                error: error.message || 'Failed to initiate payment',
            });
        }
    });

    // ------------------------
    // Verify Payment Status
    // ------------------------
    fastify.get('/phonepe/status/:orderId', async (request, reply) => {
        const { orderId } = request.params;
        console.log('>>> [STATUS] endpoint hit:', orderId, request.query);

        try {
            const phonepeResponse = await phonepeClient.getOrderStatus(orderId);
            console.log('>>> [STATUS] PhonePe response:', phonepeResponse);

            if (phonepeResponse?.state === 'COMPLETED') {
                await fastify.prisma.order.update({
                    where: { id: orderId },
                    data: { status: 'CONFIRMED', paymentStatus: 'PAID' },
                });
                console.log('>>> [STATUS] Payment SUCCESS for order:', orderId);
                return reply.send({ success: true, orderId: orderId });
            } else {
                await fastify.prisma.order.update({
                    where: { id: orderId },
                    data: { status: 'CANCELLED', paymentStatus: 'FAILED' },
                });
                console.log('>>> [STATUS] Payment FAILED for order:', orderId);
                return reply.send({ success: false, orderId: orderId, message: 'Payment failed or cancelled' });
            }
        } catch (error) {
            console.error('[PhonePe] Error checking status for order:', error);
            // Update order status to failed in case of error
            try {
                await fastify.prisma.order.update({
                    where: { id: orderId },
                    data: { status: 'CANCELLED', paymentStatus: 'FAILED' },
                });
            } catch (updateError) {
                console.error('[PhonePe] Error updating order status:', updateError);
            }
            return reply.send({ success: false, orderId: orderId, message: 'Error verifying payment status' });
        }
    });
}

module.exports = phonepeRoutes;