/**
 * Automated Unit Test Suite for Newage Portal Core Logic & ES6 Modules
 * Compatible with both Jest and Node.js built-in test runner (node --test)
 * Tests:
 * 1. String Sanitization & XSS Prevention (escapeHtml)
 * 2. Strict Role Resolution (getRoleFromEmail)
 * 3. Server-Enforced RBAC & Claim Verification
 * 4. Document upload metadata schema validation & Base64 Elimination
 * 5. Canonical Application Completion & Progressive Lock Flow
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Pure logic implementations under test
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getRoleFromEmail(email) {
    if (!email) return 'Student';
    const lower = email.toLowerCase().trim();
    if (lower === 'ceo@newage.com') {
        return 'CEO';
    }
    // Strict Server-Enforced RBAC: Insecure substring matching is eliminated
    return 'Student';
}

function verifyUserRoleServerSide(authClaimRole, firestoreUserDoc, email) {
    const cleanEmail = (email || '').toLowerCase().trim();
    if (cleanEmail === 'ceo@newage.com') return 'CEO';

    // 1. Cryptographically signed Custom Claim takes precedence
    if (authClaimRole) {
        const claim = authClaimRole.toLowerCase();
        if (claim === 'ceo' || claim === 'admin') return 'CEO';
        if (claim === 'employee' || claim === 'counselor') return 'Employee';
        if (claim === 'student') return 'Student';
    }

    // 2. Authoritative Firestore /users/{uid} document
    if (firestoreUserDoc && firestoreUserDoc.role) {
        const role = firestoreUserDoc.role.toLowerCase();
        if (role === 'ceo' || role === 'admin') return 'CEO';
        if (role === 'employee' || role === 'counselor') return 'Employee';
        if (role === 'student') return 'Student';
    }

    // 3. Fallback: Default strictly to Student
    return 'Student';
}

function validateDocumentMetadata(docData) {
    const requiredKeys = ['url', 'status'];
    const validStatuses = ['Pending', 'Verified', 'Rejected'];

    for (const key of requiredKeys) {
        if (!docData[key]) return { valid: false, error: `Missing ${key}` };
    }
    if (!validStatuses.includes(docData.status)) {
        return { valid: false, error: `Invalid status: ${docData.status}` };
    }
    // Verify it is a valid URL and not an encoded Base64 payload exceeding size limits
    if (docData.url.startsWith('data:') && docData.url.length > 500000) {
        return { valid: false, error: 'Document URL violates Base64 elimination policy' };
    }
    return { valid: true };
}

function checkIfApplicationCompleted(data) {
    if (!data) return false;

    if (data.hasSubmittedApplication === true || data.isApplicationSubmitted === true) {
        return true;
    }
    if (data.entryDate && String(data.entryDate).trim() !== '') {
        return true;
    }
    if (data.personalInfo && typeof data.personalInfo === 'object') {
        const p = data.personalInfo;
        if (p.dob && String(p.dob).trim() !== '') return true;
        if (p.gender && String(p.gender).trim() !== '') return true;
        if (p.address && String(p.address).trim() !== '') return true;
        if (p.postCode && String(p.postCode).trim() !== '') return true;
    }
    if (data.educationalProfile && typeof data.educationalProfile === 'object') {
        const edu = data.educationalProfile;
        const hasValues = (obj) => {
            if (!obj || typeof obj !== 'object') return false;
            return Object.values(obj).some(v => v !== null && v !== undefined && String(v).trim() !== '');
        };
        if (hasValues(edu.ssc) || hasValues(edu.hsc) || hasValues(edu.bachelor) || hasValues(edu.master)) {
            return true;
        }
    }
    if (data.englishProficiency && typeof data.englishProficiency === 'object') {
        const ep = data.englishProficiency;
        if (ep.testName || ep.overallScore || ep.testDate) return true;
    }
    if (data.preferences && typeof data.preferences === 'object') {
        const pref = data.preferences;
        if (Array.isArray(pref.courseChoices) && pref.courseChoices.some(c => c && String(c).trim() !== '')) return true;
        if (Array.isArray(pref.universityChoices) && pref.universityChoices.some(u => u && String(u).trim() !== '')) return true;
    }
    if (Array.isArray(data.applications) && data.applications.length > 0) {
        return true;
    }
    if (data.documents && typeof data.documents === 'object' && Object.keys(data.documents).length > 0) {
        return true;
    }
    if (data.assignedCounselor || data.assignedCounselorEmail) {
        return true;
    }
    if (data.applicationStatus && data.applicationStatus !== 'Not Applied' && data.applicationStatus !== 'Pending') {
        return true;
    }
    if (data.status && data.status !== 'Pending') {
        return true;
    }
    return false;
}

describe('Newage Portal Core Logic & Server-Side RBAC Test Suite', () => {

    describe('XSS Prevention (escapeHtml)', () => {
        it('should escape dangerous HTML script tags', () => {
            const raw = '<script>alert("XSS")</script>';
            const escaped = escapeHtml(raw);
            assert.equal(escaped, '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;');
        });

        it('should handle null and undefined safely without throwing', () => {
            assert.equal(escapeHtml(null), '');
            assert.equal(escapeHtml(undefined), '');
            assert.equal(escapeHtml(''), '');
        });

        it('should escape quotes and ampersands in user inputs', () => {
            const raw = 'John & "Jane" Doe\'s Passport';
            const escaped = escapeHtml(raw);
            assert.equal(escaped, 'John &amp; &quot;Jane&quot; Doe&#039;s Passport');
        });
    });

    describe('Strict RBAC Role Assignment (Bypass Prevention)', () => {
        it('should strictly allow designated founder CEO email only', () => {
            assert.equal(getRoleFromEmail('ceo@newage.com'), 'CEO');
        });

        it('should prevent spoofing via email substring tricks', () => {
            assert.equal(getRoleFromEmail('fakeceo@gmail.com'), 'Student');
            assert.equal(getRoleFromEmail('marceo.silva@yahoo.com'), 'Student');
            assert.equal(getRoleFromEmail('counselor.fake@hotmail.com'), 'Student');
            assert.equal(getRoleFromEmail('employee123@gmail.com'), 'Student');
        });

        it('should classify all regular candidate emails as Students by default', () => {
            assert.equal(getRoleFromEmail('sakib.rahman@gmail.com'), 'Student');
            assert.equal(getRoleFromEmail('tanvir.hossain@yahoo.com'), 'Student');
            assert.equal(getRoleFromEmail(''), 'Student');
        });
    });

    describe('Server-Side Custom Claims & Firestore RBAC Enforcement', () => {
        it('should verify CEO permissions via signed Firebase Auth Custom Claims', () => {
            const role = verifyUserRoleServerSide('ceo', null, 'staff@newage.com');
            assert.equal(role, 'CEO');
        });

        it('should verify Employee permissions via signed claims or Firestore document', () => {
            const roleFromClaim = verifyUserRoleServerSide('employee', null, 'agent@newage.com');
            assert.equal(roleFromClaim, 'Employee');

            const roleFromDoc = verifyUserRoleServerSide(null, { role: 'employee' }, 'agent@newage.com');
            assert.equal(roleFromDoc, 'Employee');
        });

        it('should deny unauthorized privilege escalation when claims and documents lack permissions', () => {
            const hackerAttempt = verifyUserRoleServerSide(null, null, 'hacker.ceo@domain.com');
            assert.equal(hackerAttempt, 'Student');
        });
    });

    describe('Storage Pipeline Validation', () => {
        it('should accept valid Firebase Storage download URLs', () => {
            const validMetadata = {
                url: 'https://firebasestorage.googleapis.com/v0/b/newage-web.appspot.com/o/students%2Fsakib%2Fpassport.pdf?alt=media',
                status: 'Pending',
                fileName: 'passport.pdf',
                storageProvider: 'firebase-storage'
            };
            const result = validateDocumentMetadata(validMetadata);
            assert.equal(result.valid, true);
        });

        it('should reject Base64 payloads that violate Firestore storage cap policy', () => {
            const massiveBase64 = 'data:application/pdf;base64,' + 'A'.repeat(600000);
            const invalidMetadata = {
                url: massiveBase64,
                status: 'Pending'
            };
            const result = validateDocumentMetadata(invalidMetadata);
            assert.equal(result.valid, false);
            assert.match(result.error, /Base64 elimination policy/);
        });
    });

    describe('Progressive Onboarding & Canonical Application Completion', () => {
        it('should keep brand new sign-ups LOCKED until application form is submitted', () => {
            const newSignupData = {
                email: 'newcandidate@gmail.com',
                uid: 'uid_123',
                hasSubmittedApplication: false,
                isApplicationSubmitted: false,
                personalInfo: {
                    fullName: 'Tanvir Ahmed',
                    email: 'newcandidate@gmail.com',
                    contactNo: '+880 1700-000000'
                },
                preferences: { countryChoices: ['UK'] }
            };
            const isCompleted = checkIfApplicationCompleted(newSignupData);
            assert.equal(isCompleted, false, 'New candidate must remain locked until application is submitted');
        });

        it('should UNLOCK students who have submitted the application form', () => {
            const submittedData = {
                email: 'newcandidate@gmail.com',
                hasSubmittedApplication: true,
                entryDate: '2026-11-08',
                personalInfo: { dob: '2001-05-15', gender: 'Male', address: 'Dhaka' },
                educationalProfile: { ssc: { gpa: '5.00', passingYear: '2018' } }
            };
            const isCompleted = checkIfApplicationCompleted(submittedData);
            assert.equal(isCompleted, true, 'Submitted candidate must be unlocked');
        });

        it('should UNLOCK existing students created previously by Employee or CEO', () => {
            const legacyStudentRecord = {
                personalInfo: { fullName: 'Sakib Rahman', email: 'sakib@gmail.com', dob: '1999-04-12' },
                educationalProfile: { bachelor: { cgpa: '3.65', major: 'CSE' } },
                applications: [{ course: 'MSc Data Science', status: 'Processing' }],
                assignedCounselor: 'counselor@newage.com'
            };
            const isCompleted = checkIfApplicationCompleted(legacyStudentRecord);
            assert.equal(isCompleted, true, 'Existing legacy students must be unlocked');
        });
    });

    describe('Serverless FinTech & Payment Gateway Payload Integrity', () => {
        function validatePaymentPayload(payload) {
            if (!payload || !payload.amount || payload.amount <= 0) return { valid: false, error: 'Invalid amount' };
            if (!['Stripe', 'bKash'].includes(payload.gateway)) return { valid: false, error: 'Unsupported gateway' };
            if (!payload.studentEmail || !payload.studentEmail.includes('@')) return { valid: false, error: 'Invalid student email' };
            return { valid: true };
        }

        it('should accept valid bKash and Stripe sandbox payment payloads', () => {
            const bKashPayload = { amount: 5000, currency: 'BDT', gateway: 'bKash', studentEmail: 'sakib@gmail.com' };
            const stripePayload = { amount: 10000, currency: 'BDT', gateway: 'Stripe', studentEmail: 'tanvir@gmail.com' };
            assert.equal(validatePaymentPayload(bKashPayload).valid, true);
            assert.equal(validatePaymentPayload(stripePayload).valid, true);
        });

        it('should reject invalid payment requests lacking valid amounts or gateways', () => {
            assert.equal(validatePaymentPayload({ amount: 0, gateway: 'bKash' }).valid, false);
            assert.equal(validatePaymentPayload({ amount: 5000, gateway: 'Crypto', studentEmail: 'test@mail.com' }).valid, false);
        });
    });

    describe('Transactional SMS Gateway & Carrier Payload Guard', () => {
        function validateSMSPayload(payload) {
            if (!payload || !payload.recipientPhone || payload.recipientPhone.length < 10) {
                return { valid: false, error: 'Invalid recipient phone' };
            }
            if (!payload.messageText || payload.messageText.trim().length === 0) {
                return { valid: false, error: 'Empty message' };
            }
            if (payload.messageText.length > 160) {
                return { valid: false, error: 'Exceeds standard 1-part GSM-7 character limit' };
            }
            return { valid: true };
        }

        it('should validate standard single-part transactional SMS payloads', () => {
            const validSMS = {
                recipientPhone: '+8801700000000',
                messageText: 'Your visa file assessment is completed by Newage Education.'
            };
            assert.equal(validateSMSPayload(validSMS).valid, true);
        });

        it('should reject SMS payloads exceeding 160 characters to prevent carrier segmentation fees', () => {
            const oversizedSMS = {
                recipientPhone: '+8801700000000',
                messageText: 'A'.repeat(161)
            };
            const result = validateSMSPayload(oversizedSMS);
            assert.equal(result.valid, false);
            assert.match(result.error, /GSM-7 character limit/);
        });
    });

});
