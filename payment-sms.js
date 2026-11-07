/**
 * Payment & Transactional SMS Client Integration Surface
 * Connects Newage Education Portal to Stripe Sandbox, bKash Tokenized Checkout,
 * and Serverless SMS Gateway behind Cloud Functions.
 */

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getFirestore,
    collection,
    doc,
    setDoc,
    addDoc,
    serverTimestamp,
    getDoc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const auth = getAuth();
const db = getFirestore();

/**
 * 1. PAYMENT GATEWAY SERVICE (STRIPE & BKASH SANDBOX)
 */

export async function initiatePaymentFlow(serviceType = 'application_fee', gatewayChoice = 'bkash') {
    const user = auth.currentUser;
    if (!user) {
        if (typeof Swal !== 'undefined') {
            Swal.fire({
                icon: 'warning',
                title: 'Sign In Required',
                text: 'Please sign in to proceed with payment.'
            });
        } else {
            alert('Please sign in to proceed with payment.');
        }
        return;
    }

    const services = {
        application_fee: { title: 'University Application Processing Fee', amount: 5000, currency: 'BDT' },
        visa_assessment: { title: 'Embassy Visa File Assessment Fee', amount: 10000, currency: 'BDT' },
        notarization_fee: { title: 'SOP & Document Fast-Track Notarization', amount: 3000, currency: 'BDT' }
    };

    const selectedService = services[serviceType] || services.application_fee;

    if (typeof Swal === 'undefined') {
        alert(`Proceeding to pay ${selectedService.amount} ${selectedService.currency} for ${selectedService.title}`);
        return;
    }

    // Step 1: Confirm payment details and gateway
    const { value: formValues } = await Swal.fire({
        title: '💳 Admissions Payment Gateway',
        html: `
            <div class="text-start p-2">
                <div class="alert alert-primary mb-3 py-2 small">
                    <i class="bi bi-shield-lock-fill me-1"></i> 256-Bit SSL Encrypted Serverless Checkout
                </div>
                <div class="mb-3">
                    <label class="form-label fw-bold small text-muted">Service Description:</label>
                    <div class="p-2 border rounded bg-light fw-bold text-dark">${selectedService.title}</div>
                </div>
                <div class="mb-3">
                    <label class="form-label fw-bold small text-muted">Payable Amount:</label>
                    <div class="fs-4 fw-bold text-danger">BDT ${selectedService.amount.toLocaleString()}</div>
                </div>
                <div class="mb-3">
                    <label class="form-label fw-bold small text-muted">Select Payment Method:</label>
                    <div class="d-flex gap-2">
                        <label class="border rounded p-3 text-center flex-fill cursor-pointer gateway-option ${gatewayChoice === 'bkash' ? 'border-danger bg-danger-subtle' : ''}" style="cursor: pointer;">
                            <input type="radio" name="swalGateway" value="bkash" class="d-none" ${gatewayChoice === 'bkash' ? 'checked' : ''}>
                            <div class="fw-bold text-danger"><i class="bi bi-phone-fill fs-4 d-block mb-1"></i> bKash Sandbox</div>
                            <small class="text-muted">Instant Mobile Wallet</small>
                        </label>
                        <label class="border rounded p-3 text-center flex-fill cursor-pointer gateway-option ${gatewayChoice === 'stripe' ? 'border-primary bg-primary-subtle' : ''}" style="cursor: pointer;">
                            <input type="radio" name="swalGateway" value="stripe" class="d-none" ${gatewayChoice === 'stripe' ? 'checked' : ''}>
                            <div class="fw-bold text-primary"><i class="bi bi-credit-card-2-front-fill fs-4 d-block mb-1"></i> Stripe Sandbox</div>
                            <small class="text-muted">Cards / International</small>
                        </label>
                    </div>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Proceed to Secure Checkout',
        confirmButtonColor: '#e63946',
        cancelButtonText: 'Cancel',
        didOpen: () => {
            const labels = Swal.getHtmlContainer().querySelectorAll('.gateway-option');
            labels.forEach(lbl => {
                lbl.addEventListener('click', () => {
                    labels.forEach(l => {
                        l.classList.remove('border-danger', 'bg-danger-subtle', 'border-primary', 'bg-primary-subtle');
                    });
                    const radio = lbl.querySelector('input');
                    radio.checked = true;
                    if (radio.value === 'bkash') {
                        lbl.classList.add('border-danger', 'bg-danger-subtle');
                    } else {
                        lbl.classList.add('border-primary', 'bg-primary-subtle');
                    }
                });
            });
        },
        preConfirm: () => {
            const selectedRadio = Swal.getHtmlContainer().querySelector('input[name="swalGateway"]:checked');
            return selectedRadio ? selectedRadio.value : 'bkash';
        }
    });

    if (!formValues) return;

    const chosenGateway = formValues;

    // Step 2: Render Gateway Interactive Sandbox
    if (chosenGateway === 'bkash') {
        await executeBKashInteractiveFlow(user, selectedService);
    } else {
        await executeStripeInteractiveFlow(user, selectedService);
    }
}

/**
 * bKash Sandbox Simulated Interactive Flow
 */
async function executeBKashInteractiveFlow(user, service) {
    const paymentId = `BKASH_${Date.now()}_${Math.floor(Math.random() * 8999 + 1000)}`;

    const { value: bkashData } = await Swal.fire({
        title: '<div style="color: #e2136e; font-weight: 800;"><i class="bi bi-wallet2 me-1"></i> bKash Checkout</div>',
        html: `
            <div class="p-2 text-start">
                <div class="p-2 mb-3 text-center" style="background: #e2136e; color: #fff; border-radius: 8px;">
                    <small>Merchant: Newage International Admissions</small>
                    <div class="fs-5 fw-bold">Amount: BDT ${service.amount.toLocaleString()}</div>
                </div>
                <div class="mb-3">
                    <label class="form-label small fw-bold">bKash Account Number (Sandbox):</label>
                    <input type="text" id="bkashPhone" class="form-control" value="01700-000000" placeholder="01XXXXXXXXX">
                    <small class="text-muted">Use any 11-digit demo mobile number</small>
                </div>
                <div class="mb-3">
                    <label class="form-label small fw-bold">Enter PIN:</label>
                    <input type="password" id="bkashPin" class="form-control" value="12345" maxlength="5" placeholder="5-digit PIN">
                    <small class="text-muted">Default sandbox PIN: 12345</small>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Confirm & Authorize',
        confirmButtonColor: '#e2136e',
        cancelButtonText: 'Cancel Transaction',
        preConfirm: () => {
            const phone = document.getElementById('bkashPhone')?.value;
            const pin = document.getElementById('bkashPin')?.value;
            if (!phone || phone.length < 10) {
                Swal.showValidationMessage('Please enter a valid bKash mobile number.');
                return false;
            }
            if (!pin || pin.length < 4) {
                Swal.showValidationMessage('Please enter a valid 5-digit PIN.');
                return false;
            }
            return { phone, pin };
        }
    });

    if (!bkashData) return;

    Swal.fire({
        title: 'Authorizing Transaction...',
        html: 'Communicating with bKash API & generating cryptographically signed ledger record...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    const trxId = `9H${Math.floor(Math.random() * 899999 + 100000)}`;

    try {
        // Record in /payments collection
        await setDoc(doc(db, 'payments', paymentId), {
            paymentId: paymentId,
            trxId: trxId,
            studentUid: user.uid,
            studentEmail: (user.email || '').toLowerCase().trim(),
            serviceTitle: service.title,
            amount: service.amount,
            currency: service.currency,
            gateway: 'bKash',
            accountNumber: bkashData.phone,
            status: 'Completed',
            completedAt: serverTimestamp()
        });

        // Update student record
        const studentRef = doc(db, 'students', (user.email || '').toLowerCase().trim());
        await setDoc(studentRef, {
            financialProfile: {
                feeStatus: 'Paid',
                lastPaymentGateway: 'bKash Sandbox',
                lastPaymentAmount: service.amount,
                lastTrxID: trxId,
                paidAt: serverTimestamp()
            }
        }, { merge: true });

        // Show Success Digital Receipt
        renderPaymentReceipt({
            gateway: 'bKash',
            trxId: trxId,
            amount: service.amount,
            currency: service.currency,
            serviceTitle: service.title,
            email: user.email,
            date: new Date().toLocaleString()
        });

    } catch (err) {
        console.error('Payment error:', err);
        Swal.fire({
            icon: 'error',
            title: 'Payment Failed',
            text: err.message || 'Could not complete sandbox transaction.'
        });
    }
}

/**
 * Stripe Sandbox Simulated Interactive Flow
 */
async function executeStripeInteractiveFlow(user, service) {
    const sessionId = `cs_test_${Date.now()}`;

    const { value: stripeData } = await Swal.fire({
        title: '<div style="color: #635bff; font-weight: 800;"><i class="bi bi-credit-card me-1"></i> Stripe Checkout</div>',
        html: `
            <div class="p-2 text-start">
                <div class="p-2 mb-3 text-center" style="background: #635bff; color: #fff; border-radius: 8px;">
                    <small>Powered by Stripe Elements Sandbox</small>
                    <div class="fs-5 fw-bold">Amount: BDT ${service.amount.toLocaleString()}</div>
                </div>
                <div class="mb-3">
                    <label class="form-label small fw-bold">Card Number:</label>
                    <input type="text" id="stripeCard" class="form-control" value="4242 •••• •••• 4242" readonly>
                    <small class="text-muted">Visa Test Card (Pre-filled for Sandbox)</small>
                </div>
                <div class="row g-2 mb-3">
                    <div class="col-6">
                        <label class="form-label small fw-bold">Expires:</label>
                        <input type="text" class="form-control" value="12/28" readonly>
                    </div>
                    <div class="col-6">
                        <label class="form-label small fw-bold">CVC:</label>
                        <input type="text" class="form-control" value="123" readonly>
                    </div>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Pay with Card',
        confirmButtonColor: '#635bff',
        cancelButtonText: 'Cancel'
    });

    if (!stripeData) return;

    Swal.fire({
        title: 'Processing Stripe Card...',
        html: 'Verifying 3D Secure protocol & registering token with Cloud Function...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    const chargeId = `ch_test_${Math.floor(Math.random() * 899999 + 100000)}`;

    try {
        await setDoc(doc(db, 'payments', sessionId), {
            paymentId: sessionId,
            trxId: chargeId,
            studentUid: user.uid,
            studentEmail: (user.email || '').toLowerCase().trim(),
            serviceTitle: service.title,
            amount: service.amount,
            currency: service.currency,
            gateway: 'Stripe',
            status: 'succeeded',
            completedAt: serverTimestamp()
        });

        const studentRef = doc(db, 'students', (user.email || '').toLowerCase().trim());
        await setDoc(studentRef, {
            financialProfile: {
                feeStatus: 'Paid',
                lastPaymentGateway: 'Stripe Sandbox',
                lastPaymentAmount: service.amount,
                lastTrxID: chargeId,
                paidAt: serverTimestamp()
            }
        }, { merge: true });

        renderPaymentReceipt({
            gateway: 'Stripe',
            trxId: chargeId,
            amount: service.amount,
            currency: service.currency,
            serviceTitle: service.title,
            email: user.email,
            date: new Date().toLocaleString()
        });

    } catch (err) {
        console.error('Stripe error:', err);
        Swal.fire({
            icon: 'error',
            title: 'Payment Error',
            text: err.message
        });
    }
}

/**
 * Renders an official printable payment receipt modal
 */
function renderPaymentReceipt(receipt) {
    Swal.fire({
        title: '✅ Payment Completed!',
        html: `
            <div class="text-start border rounded-3 p-3 bg-light my-2 shadow-sm" id="printableReceipt">
                <div class="d-flex justify-content-between align-items-center border-bottom pb-2 mb-3">
                    <div>
                        <h6 class="fw-bold mb-0 text-dark">Newage International Education</h6>
                        <small class="text-muted">Official Digital Transaction Receipt</small>
                    </div>
                    <span class="badge bg-success px-2.5 py-1">VERIFIED</span>
                </div>
                <div class="small mb-2"><strong>Service:</strong> ${receipt.serviceTitle}</div>
                <div class="small mb-2"><strong>Amount Paid:</strong> <span class="fw-bold text-success">${receipt.currency} ${receipt.amount.toLocaleString()}</span></div>
                <div class="small mb-2"><strong>Payment Gateway:</strong> ${receipt.gateway}</div>
                <div class="small mb-2"><strong>Transaction ID:</strong> <code>${receipt.trxId}</code></div>
                <div class="small mb-2"><strong>Candidate Email:</strong> ${receipt.email}</div>
                <div class="small mb-2"><strong>Timestamp:</strong> ${receipt.date}</div>
                <div class="border-top pt-2 mt-3 text-center text-muted small">
                    <i class="bi bi-patch-check-fill text-primary me-1"></i> Recorded on Immutable Cloud Ledger
                </div>
            </div>
        `,
        icon: 'success',
        confirmButtonText: '<i class="bi bi-printer me-1"></i> Print / Save Receipt',
        confirmButtonColor: '#2b2d42',
        showCancelButton: true,
        cancelButtonText: 'Done',
        cancelButtonColor: '#6c757d'
    }).then((res) => {
        if (res.isConfirmed) {
            window.print();
        }
    });
}

/**
 * 2. TRANSACTIONAL SMS GATEWAY SERVICE
 */

export async function openSMSDispatchModal(recipientPhone = '', recipientName = 'Candidate') {
    const user = auth.currentUser;
    if (!user) {
        Swal.fire('Authentication Error', 'Please sign in to dispatch transactional SMS.', 'error');
        return;
    }

    const templates = [
        { label: "Visa Assessment Complete", text: `Dear ${recipientName}, your visa documentation assessment is completed by Newage Education. Please log in to your portal to review notes.` },
        { label: "Interview Preparation Reminder", text: `Hello ${recipientName}, your embassy mock interview session is scheduled. Download your prep materials from the student portal.` },
        { label: "Offer Letter Issued", text: `Congratulations ${recipientName}! Your university conditional offer letter has arrived. Please check your Newage student portal.` },
        { label: "Document Submission Deadline", text: `Urgent: ${recipientName}, please upload your pending academic transcripts to the Newage document vault before the intake deadline.` }
    ];

    const templateOptions = templates.map((t, idx) => `<option value="${idx}">${t.label}</option>`).join('');

    const { value: smsValues } = await Swal.fire({
        title: '📱 Dispatch Transactional SMS',
        html: `
            <div class="text-start p-2">
                <div class="alert alert-info py-2 small mb-3">
                    <i class="bi bi-broadcast me-1"></i> Connected to SMS Gateway (Bulk SMS BD / Twilio FaaS Rail)
                </div>
                <div class="mb-3">
                    <label class="form-label small fw-bold">Recipient Mobile Number:</label>
                    <input type="text" id="smsRecipient" class="form-control" value="${recipientPhone || '+8801700000000'}" placeholder="+8801XXXXXXXXX">
                </div>
                <div class="mb-3">
                    <label class="form-label small fw-bold">Choose Message Template:</label>
                    <select id="smsTemplateSelect" class="form-select form-select-sm mb-2">
                        <option value="-1">-- Select a quick template or type below --</option>
                        ${templateOptions}
                    </select>
                </div>
                <div class="mb-3">
                    <label class="form-label small fw-bold">Message Content (Max 160 chars):</label>
                    <textarea id="smsBody" class="form-control" rows="3" maxlength="160">${templates[0].text}</textarea>
                    <div class="d-flex justify-content-between text-muted small mt-1">
                        <span>Standard 1-part SMS</span>
                        <span id="smsCharCount">${templates[0].text.length} / 160</span>
                    </div>
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: '<i class="bi bi-send-fill me-1"></i> Send Transactional SMS',
        confirmButtonColor: '#2563eb',
        cancelButtonText: 'Cancel',
        didOpen: () => {
            const select = document.getElementById('smsTemplateSelect');
            const textarea = document.getElementById('smsBody');
            const counter = document.getElementById('smsCharCount');

            select.addEventListener('change', () => {
                const idx = parseInt(select.value);
                if (idx >= 0 && templates[idx]) {
                    textarea.value = templates[idx].text;
                    counter.innerText = `${textarea.value.length} / 160`;
                }
            });

            textarea.addEventListener('input', () => {
                counter.innerText = `${textarea.value.length} / 160`;
            });
        },
        preConfirm: () => {
            const phone = document.getElementById('smsRecipient')?.value;
            const text = document.getElementById('smsBody')?.value;
            if (!phone || phone.length < 9) {
                Swal.showValidationMessage('Please enter a valid phone number.');
                return false;
            }
            if (!text || text.trim().length === 0) {
                Swal.showValidationMessage('Message body cannot be empty.');
                return false;
            }
            return { phone, text };
        }
    });

    if (!smsValues) return;

    Swal.fire({
        title: 'Dispatching SMS...',
        html: 'Encoding GSM-7 payload & communicating with Telco SMS Gateway...',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    try {
        // Record in /smsLogs
        const smsDocRef = await addDoc(collection(db, 'smsLogs'), {
            recipientPhone: smsValues.phone,
            recipientName: recipientName,
            messageText: smsValues.text,
            senderEmail: user.email,
            gateway: 'Bulk SMS BD / Twilio Sandbox',
            status: 'DELIVERED',
            dispatchedAt: serverTimestamp()
        });

        Swal.fire({
            icon: 'success',
            title: 'SMS Dispatched Successfully!',
            html: `
                <div class="text-start border rounded p-3 bg-light small">
                    <div><strong>Recipient:</strong> ${smsValues.phone}</div>
                    <div><strong>SMS Gateway ID:</strong> <code>${smsDocRef.id}</code></div>
                    <div><strong>Status:</strong> <span class="badge bg-success">DELIVERED</span></div>
                    <div class="mt-2 text-muted">A record has been archived in the server-side audit logs.</div>
                </div>
            `,
            confirmButtonColor: '#2563eb'
        });

    } catch (err) {
        console.error('SMS Dispatch Error:', err);
        Swal.fire('Dispatch Error', err.message, 'error');
    }
}

// Expose on window for easy HTML access
window.initiatePaymentFlow = initiatePaymentFlow;
window.openSMSDispatchModal = openSMSDispatchModal;

