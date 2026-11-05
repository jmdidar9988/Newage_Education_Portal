const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// ----------------------------------------------------------------------------
// 1. RBAC CUSTOM CLAIMS & ROUTE PROTECTION
// Enforces server-side 3-role RBAC (CEO, Employee, Student) via Firebase Auth Claims
// ----------------------------------------------------------------------------

/**
 * Cloud Function to assign Custom User Claims (role) to Firebase Auth users
 * Only callers with the 'ceo' or 'admin' claim can set roles for other users.
 */
exports.setUserRole = functions.https.onCall(async (data, context) => {
    // 1. Caller authentication check
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'Authentication required to execute role assignments.'
        );
    }

    const callerUid = context.auth.uid;
    const callerClaims = context.auth.token || {};

    // 2. Caller role check (must be CEO / Admin)
    const callerDoc = await db.collection('users').doc(callerUid).get();
    const callerRole = (callerClaims.role || (callerDoc.exists ? callerDoc.data().role : '')).toLowerCase();

    if (callerRole !== 'ceo' && callerRole !== 'admin') {
        throw new functions.https.HttpsError(
            'permission-denied',
            'Access denied. Only the CEO has authorization to set user roles.'
        );
    }

    const { targetUid, role } = data;
    const allowedRoles = ['ceo', 'employee', 'student'];

    if (!targetUid || !role || !allowedRoles.includes(role.toLowerCase())) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            `Valid targetUid and role (${allowedRoles.join(', ')}) must be specified.`
        );
    }

    const cleanRole = role.toLowerCase();

    // 3. Set Firebase Auth Custom User Claims
    await admin.auth().setCustomUserClaims(targetUid, { role: cleanRole });

    // 4. Mirror role in Firestore /users/{targetUid} for fast security-rule lookup
    await db.collection('users').doc(targetUid).set({
        role: cleanRole,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    return {
        status: 'success',
        message: `Successfully granted '${cleanRole}' role to UID: ${targetUid}`
    };
});

/**
 * Cloud Function: Automatically sets default 'student' custom claim on user creation
 */
exports.onUserCreated = functions.auth.user().onCreate(async (user) => {
    const email = (user.email || '').toLowerCase().trim();
    let initialRole = 'student';

    // Check if user is pre-registered as an employee in Firestore
    const empDoc = await db.collection('employees').doc(email).get();
    if (empDoc.exists) {
        initialRole = 'employee';
    }

    // Set custom claim
    await admin.auth().setCustomUserClaims(user.uid, { role: initialRole });

    // Populate Firestore users collection
    await db.collection('users').doc(user.uid).set({
        email: email,
        role: initialRole,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log(`[RBAC] Assigned initial role '${initialRole}' to new user: ${email}`);
});

// ----------------------------------------------------------------------------
// 2. FIREBASE CLOUD MESSAGING (FCM) PUSH NOTIFICATION TRIGGERS
// Delivers instant push alerts when students send chat messages or upload documents
// ----------------------------------------------------------------------------

/**
 * Triggers push notification to Counselor/CEO when a student sends a chat message
 */
exports.onStudentMessageSent = functions.firestore
    .document('students/{studentEmail}/chatMessages/{messageId}')
    .onCreate(async (snap, context) => {
        const message = snap.data();
        const studentEmail = context.params.studentEmail;

        // Only notify if message was sent by student (not employee reply)
        if (message.sender === 'employee' || message.sender === 'counselor' || message.sender === 'ceo') {
            return null;
        }

        // Fetch student details
        const studentDoc = await db.collection('students').doc(studentEmail).get();
        const studentName = studentDoc.exists ? (studentDoc.data().personalInfo?.fullName || studentEmail) : studentEmail;
        const assignedCounselorEmail = studentDoc.exists ? studentDoc.data().assignedCounselorEmail : null;

        // Query tokens of assigned counselor or all employees
        let tokensQuery = db.collection('fcmTokens').where('role', 'in', ['Employee', 'CEO', 'employee', 'ceo']);
        if (assignedCounselorEmail) {
            tokensQuery = db.collection('fcmTokens').where('email', '==', assignedCounselorEmail.toLowerCase());
        }

        const tokenSnaps = await tokensQuery.get();
        if (tokenSnaps.empty) {
            console.log('[FCM] No employee tokens found to deliver message notification.');
            return null;
        }

        const registrationTokens = [];
        tokenSnaps.forEach(docSnap => {
            const data = docSnap.data();
            if (data.token) registrationTokens.push(data.token);
        });

        const payload = {
            notification: {
                title: `💬 New Message from ${studentName}`,
                body: message.text || 'Student sent an inquiry.',
            },
            data: {
                studentEmail: studentEmail,
                url: `/employee.html?student=${encodeURIComponent(studentEmail)}`,
                click_action: `/employee.html`
            }
        };

        const response = await admin.messaging().sendEachForMulticast({
            tokens: registrationTokens,
            notification: payload.notification,
            data: payload.data
        });

        console.log(`[FCM] Sent message notification to ${response.successCount} employee devices.`);
        return response;
    });

/**
 * Triggers push notification to student when prep material or task is updated
 */
exports.onStudentPrepMaterialAdded = functions.firestore
    .document('students/{studentEmail}')
    .onUpdate(async (change, context) => {
        const beforeData = change.before.data();
        const afterData = change.after.data();
        const studentEmail = context.params.studentEmail;

        const beforeCount = (beforeData.prepSheets || []).length;
        const afterCount = (afterData.prepSheets || []).length;

        if (afterCount > beforeCount) {
            // New prep sheet was added
            const latestSheet = afterData.prepSheets[afterCount - 1];
            const tokenSnap = await db.collection('fcmTokens').where('email', '==', studentEmail.toLowerCase()).get();

            if (tokenSnap.empty) return null;

            const tokens = [];
            tokenSnap.forEach(d => { if (d.data().token) tokens.push(d.data().token); });

            const payload = {
                notification: {
                    title: '📚 New Interview Preparation Material',
                    body: `Your counselor uploaded "${latestSheet.title || 'Prep Sheet'}". Review it in your portal.`
                },
                data: {
                    url: '/student.html#section-prep-sheets'
                }
            };

            await admin.messaging().sendEachForMulticast({
                tokens: tokens,
                notification: payload.notification,
                data: payload.data
            });
            console.log(`[FCM] Sent prep sheet push alert to student: ${studentEmail}`);
        }
        return null;
    });

// ----------------------------------------------------------------------------
// 3. SERVER-SIDE INTEGRATION: PAYMENT GATEWAYS (STRIPE & BKASH SANDBOX)
// ----------------------------------------------------------------------------

/**
 * Creates a Stripe Checkout Session for student admission/counseling fees
 */
exports.createStripePaymentSession = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be signed in.');
    }

    const { amount, currency = 'bdt', serviceTitle = 'Application Processing Fee' } = data;
    const studentEmail = context.auth.token.email || 'student@newage.com';

    // In production, initialize Stripe with functions.config().stripe.secret
    // const stripe = require('stripe')(functions.config().stripe.secret);
    console.log(`[Stripe Sandbox] Creating checkout session for ${studentEmail}: ${amount} ${currency.toUpperCase()}`);

    // Generate mock/sandbox session reference
    const sessionId = `cs_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Record pending transaction in Firestore
    await db.collection('payments').doc(sessionId).set({
        sessionId: sessionId,
        studentUid: context.auth.uid,
        studentEmail: studentEmail,
        amount: amount,
        currency: currency,
        serviceTitle: serviceTitle,
        gateway: 'Stripe',
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
        sessionId: sessionId,
        checkoutUrl: `https://checkout.stripe.com/pay/${sessionId}`,
        mode: 'sandbox'
    };
});

/**
 * bKash Payment Sandbox Integration (Tokenized Checkout API)
 */
exports.initiateBKashPayment = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be signed in.');
    }

    const { amount, intent = 'sale' } = data;
    const studentEmail = context.auth.token.email;

    console.log(`[bKash Sandbox] Initiating payment of BDT ${amount} for ${studentEmail}`);

    const paymentID = `BKASH_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    await db.collection('payments').doc(paymentID).set({
        paymentId: paymentID,
        studentUid: context.auth.uid,
        studentEmail: studentEmail,
        amount: amount,
        currency: 'BDT',
        gateway: 'bKash',
        status: 'Initiated',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
        paymentID: paymentID,
        bkashURL: `https://sandbox.payment.bkash.com/redirect/${paymentID}`,
        statusCode: '0000',
        statusMessage: 'Successful'
    };
});

// ----------------------------------------------------------------------------
// 4. SERVER-SIDE INTEGRATION: SMS GATEWAY (BULK SMS BD / TWILIO)
// ----------------------------------------------------------------------------

/**
 * Cloud Function to dispatch transactional SMS notifications for intake deadlines & offers
 */
exports.sendTransactionalSMS = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Authentication required.');
    }

    // Role check: Only staff can dispatch SMS
    const callerClaims = context.auth.token || {};
    if (callerClaims.role !== 'ceo' && callerClaims.role !== 'admin' && callerClaims.role !== 'employee') {
        throw new functions.https.HttpsError('permission-denied', 'Staff authorization required.');
    }

    const { recipientPhone, messageText } = data;

    if (!recipientPhone || !messageText) {
        throw new functions.https.HttpsError('invalid-argument', 'recipientPhone and messageText are required.');
    }

    console.log(`[SMS Gateway] Dispatching SMS to ${recipientPhone}: "${messageText}"`);

    // Record SMS in audit logs
    const smsLogRef = await db.collection('smsLogs').add({
        recipientPhone: recipientPhone,
        messageText: messageText,
        dispatchedBy: context.auth.token.email,
        status: 'DELIVERED_SANDBOX',
        dispatchedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
        success: true,
        smsId: smsLogRef.id,
        recipient: recipientPhone
    };
});

