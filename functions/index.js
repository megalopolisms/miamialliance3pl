/**
 * Miami Alliance 3PL - Firebase Functions for Stripe Payments
 *
 * Setup:
 * 1. Install Firebase CLI: npm install -g firebase-tools
 * 2. Login: firebase login
 * 3. Init functions: firebase init functions (select existing project)
 * 4. cd functions && npm install stripe
 * 5. Set Stripe secret key: firebase functions:config:set stripe.secret="sk_live_xxx"
 * 6. Deploy: firebase deploy --only functions
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const stripe = require('stripe')(functions.config().stripe?.secret || process.env.STRIPE_SECRET_KEY);

// Twilio SMS Configuration
const twilioAccountSid = functions.config().twilio?.account_sid || process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = functions.config().twilio?.auth_token || process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = functions.config().twilio?.phone_number || process.env.TWILIO_PHONE_NUMBER;

let twilioClient = null;
if (twilioAccountSid && twilioAuthToken) {
    const twilio = require('twilio');
    twilioClient = twilio(twilioAccountSid, twilioAuthToken);
}

/**
 * Create Stripe Checkout Session for invoice payment
 */
exports.createCheckoutSession = functions.https.onCall(async (data, context) => {
    // Verify authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }

    const { invoiceId, successUrl, cancelUrl } = data;

    if (!invoiceId) {
        throw new functions.https.HttpsError('invalid-argument', 'Invoice ID required');
    }

    // Get invoice from Firestore
    const invoiceDoc = await admin.firestore().collection('invoices').doc(invoiceId).get();

    if (!invoiceDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Invoice not found');
    }

    const invoice = invoiceDoc.data();

    // Verify user owns this invoice
    if (invoice.customer_id !== context.auth.uid) {
        throw new functions.https.HttpsError('permission-denied', 'Not your invoice');
    }

    // Calculate amount due
    const amountDue = Math.round((invoice.total - (invoice.amount_paid || 0)) * 100); // cents

    if (amountDue <= 0) {
        throw new functions.https.HttpsError('failed-precondition', 'Invoice already paid');
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        customer_email: invoice.customer_email,
        line_items: [{
            price_data: {
                currency: 'usd',
                product_data: {
                    name: `Invoice ${invoice.invoice_number}`,
                    description: `Billing period: ${invoice.billing_period_start} to ${invoice.billing_period_end}`,
                },
                unit_amount: amountDue,
            },
            quantity: 1,
        }],
        metadata: {
            invoice_id: invoiceId,
            customer_id: invoice.customer_id,
        },
        success_url: successUrl || `https://megalopolisms.github.io/miamialliance3pl/portal/billing.html?payment=success&invoice=${invoiceId}`,
        cancel_url: cancelUrl || `https://megalopolisms.github.io/miamialliance3pl/portal/billing.html?payment=cancelled`,
    });

    return { sessionId: session.id, url: session.url };
});

/**
 * Stripe Webhook to handle successful payments
 */
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = functions.config().stripe?.webhook_secret;

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Handle successful payment
    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const invoiceId = session.metadata?.invoice_id;

        if (invoiceId) {
            // Update invoice to paid
            await admin.firestore().collection('invoices').doc(invoiceId).update({
                status: 'paid',
                amount_paid: session.amount_total / 100,
                paid_at: new Date().toISOString(),
                stripe_session_id: session.id,
                stripe_payment_intent: session.payment_intent,
            });

            console.log(`Invoice ${invoiceId} marked as paid`);
        }
    }

    res.json({ received: true });
});

/**
 * Create Stripe Payment Link for an invoice
 * (Alternative to Checkout - creates a reusable link)
 */
exports.createPaymentLink = functions.https.onCall(async (data, context) => {
    // Verify admin
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }

    const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
    const userData = userDoc.data();

    if (userData?.role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Admin only');
    }

    const { invoiceId } = data;
    const invoiceDoc = await admin.firestore().collection('invoices').doc(invoiceId).get();
    const invoice = invoiceDoc.data();

    const amountDue = Math.round((invoice.total - (invoice.amount_paid || 0)) * 100);

    // Create a product and price
    const product = await stripe.products.create({
        name: `Invoice ${invoice.invoice_number}`,
        description: `Miami Alliance 3PL - ${invoice.billing_period_start} to ${invoice.billing_period_end}`,
    });

    const price = await stripe.prices.create({
        product: product.id,
        unit_amount: amountDue,
        currency: 'usd',
    });

    // Create payment link
    const paymentLink = await stripe.paymentLinks.create({
        line_items: [{ price: price.id, quantity: 1 }],
        metadata: { invoice_id: invoiceId },
        after_completion: {
            type: 'redirect',
            redirect: {
                url: `https://megalopolisms.github.io/miamialliance3pl/portal/billing.html?payment=success&invoice=${invoiceId}`,
            },
        },
    });

    // Save payment link to invoice
    await admin.firestore().collection('invoices').doc(invoiceId).update({
        stripe_payment_link: paymentLink.url,
    });

    return { url: paymentLink.url };
});

// =============================================================================
// SMS NOTIFICATION FUNCTIONS
// =============================================================================

/**
 * SMS Status Messages
 */
const SMS_TEMPLATES = {
    received: (tracking) => `📦 Miami Alliance 3PL: Your shipment ${tracking} has been RECEIVED at our facility. We'll notify you when it ships.`,
    processing: (tracking) => `⚙️ Miami Alliance 3PL: Shipment ${tracking} is being PROCESSED. Your order is being picked and packed.`,
    shipped: (tracking, carrier) => `🚚 Miami Alliance 3PL: Shipment ${tracking} has SHIPPED via ${carrier || 'carrier'}! Track: https://miamialliance3pl.com/track/${tracking}`,
    out_for_delivery: (tracking) => `📍 Miami Alliance 3PL: Shipment ${tracking} is OUT FOR DELIVERY today!`,
    delivered: (tracking) => `✅ Miami Alliance 3PL: Shipment ${tracking} has been DELIVERED. Thank you for your business!`,
    exception: (tracking) => `⚠️ Miami Alliance 3PL: Alert! Shipment ${tracking} has a delivery EXCEPTION. Please contact us.`,
};

/**
 * Send SMS via Twilio
 */
async function sendSMS(to, message) {
    if (!twilioClient) {
        console.log('Twilio not configured. SMS not sent:', message);
        return { success: false, error: 'Twilio not configured' };
    }

    // Validate phone number format
    const phoneRegex = /^\+1[2-9]\d{9}$/;
    if (!phoneRegex.test(to)) {
        console.log('Invalid phone number format:', to);
        return { success: false, error: 'Invalid phone format' };
    }

    try {
        const result = await twilioClient.messages.create({
            body: message,
            from: twilioPhoneNumber,
            to: to
        });
        console.log('SMS sent:', result.sid);
        return { success: true, sid: result.sid };
    } catch (error) {
        console.error('SMS failed:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Firestore Trigger: Send SMS when shipment status changes
 */
exports.onShipmentStatusChange = functions.firestore
    .document('shipments/{shipmentId}')
    .onUpdate(async (change, context) => {
        const before = change.before.data();
        const after = change.after.data();

        // Only trigger if status changed
        if (before.status === after.status) {
            return null;
        }

        const newStatus = after.status?.toLowerCase().replace(/\s+/g, '_');
        const tracking = after.tracking_number || context.params.shipmentId;

        // Check if customer wants SMS notifications
        if (!after.customer_phone || after.sms_notifications === false) {
            console.log('SMS notifications disabled or no phone number');
            return null;
        }

        // Get message template
        const templateFn = SMS_TEMPLATES[newStatus];
        if (!templateFn) {
            console.log('No SMS template for status:', newStatus);
            return null;
        }

        const message = typeof templateFn === 'function'
            ? templateFn(tracking, after.carrier)
            : templateFn;

        // Send SMS
        const result = await sendSMS(after.customer_phone, message);

        // Log notification
        await admin.firestore().collection('notifications').add({
            type: 'sms',
            shipment_id: context.params.shipmentId,
            customer_id: after.customer_id,
            phone: after.customer_phone,
            message: message,
            status: result.success ? 'sent' : 'failed',
            error: result.error || null,
            sent_at: admin.firestore.FieldValue.serverTimestamp()
        });

        return result;
    });

/**
 * HTTP Endpoint: Manually send SMS notification
 */
exports.sendShipmentSMS = functions.https.onCall(async (data, context) => {
    // Verify admin
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
    }

    const userDoc = await admin.firestore().collection('users').doc(context.auth.uid).get();
    if (userDoc.data()?.role !== 'admin') {
        throw new functions.https.HttpsError('permission-denied', 'Admin only');
    }

    const { shipmentId, customMessage } = data;

    // Get shipment
    const shipmentDoc = await admin.firestore().collection('shipments').doc(shipmentId).get();
    if (!shipmentDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'Shipment not found');
    }

    const shipment = shipmentDoc.data();
    if (!shipment.customer_phone) {
        throw new functions.https.HttpsError('failed-precondition', 'No phone number on file');
    }

    const message = customMessage ||
        `📦 Miami Alliance 3PL: Update on shipment ${shipment.tracking_number || shipmentId}. Status: ${shipment.status}`;

    const result = await sendSMS(shipment.customer_phone, message);

    if (!result.success) {
        throw new functions.https.HttpsError('internal', result.error);
    }

    return { success: true, message: 'SMS sent successfully' };
});

/**
 * Scheduled: Send low inventory alerts
 */
exports.lowInventoryAlert = functions.pubsub
    .schedule('every day 09:00')
    .timeZone('America/New_York')
    .onRun(async (context) => {
        // Get all inventory items below threshold
        const snapshot = await admin.firestore()
            .collection('inventory')
            .where('quantity', '<', 10)
            .get();

        if (snapshot.empty) {
            console.log('No low inventory items');
            return null;
        }

        // Group by customer
        const customerAlerts = {};
        snapshot.forEach(doc => {
            const item = doc.data();
            if (item.customer_id && item.alert_phone) {
                if (!customerAlerts[item.customer_id]) {
                    customerAlerts[item.customer_id] = {
                        phone: item.alert_phone,
                        items: []
                    };
                }
                customerAlerts[item.customer_id].items.push({
                    sku: item.sku,
                    name: item.name,
                    quantity: item.quantity
                });
            }
        });

        // Send alerts
        for (const [customerId, data] of Object.entries(customerAlerts)) {
            const itemList = data.items.map(i => `${i.sku}: ${i.quantity} left`).join(', ');
            const message = `⚠️ Miami Alliance 3PL: Low inventory alert! ${itemList}. Reorder soon.`;

            await sendSMS(data.phone, message);
        }

        return null;
    });
