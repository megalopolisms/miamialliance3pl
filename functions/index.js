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
