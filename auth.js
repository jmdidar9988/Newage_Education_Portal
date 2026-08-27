// Firebase Authentication & Firestore Module for Newage Education Web Portal
// Modular Firebase SDK v10

import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import {
    getAuth,
    setPersistence,
    browserSessionPersistence,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    getDoc,
    query,
    where,
    orderBy,
    doc,
    setDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    arrayUnion,
    increment,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Safety fallback for deprecated overall status update
window.updateOverallApplicationStatus = function () {
    console.warn("Ignored: Deprecated overall status update called.");
};

// Firebase configuration provided by user
const firebaseConfig = {
    apiKey: "AIzaSyDVawQFjahyoHtE1aDzomcO9EsYmJ3c8fw",
    authDomain: "newage-web.firebaseapp.com",
    projectId: "newage-web",
    storageBucket: "newage-web.firebasestorage.app",
    messagingSenderId: "970795032563",
    appId: "1:970795032563:web:1fa36e6b6ea4c943ebbc86"
};

// Initialize Firebase App
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

let analytics = null;
try {
    analytics = getAnalytics(app);
} catch (e) {
    console.warn("Analytics not enabled in non-browser context or blocked", e);
}

// Initialize Auth and Firestore
export const auth = getAuth(app);
export const db = getFirestore(app);

// 🔒 Set Tab-Scoped Session Persistence
// Ensures each browser tab can have its own independent login (Student, Employee, CEO) without overriding each other
try {
    setPersistence(auth, browserSessionPersistence).catch((pErr) => {
        console.warn("Session persistence initialization notice:", pErr);
    });
} catch (pInitErr) {
    console.warn("Could not set browserSessionPersistence:", pInitErr);
}

// Export instances and helpers for other modules
export {
    onAuthStateChanged,
    signOut,
    sendPasswordResetEmail,
    collection,
    addDoc,
    getDoc,
    getDocs,
    setDoc,
    query,
    where,
    orderBy,
    doc,
    updateDoc,
    deleteDoc,
    serverTimestamp,
    arrayUnion,
    increment,
    onSnapshot
};

/**
 * Utility function to escape HTML string
 */
export function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Identify user role strictly based on string matching logic
 * @param {string} email 
 * @returns {'CEO' | 'Employee' | 'Student'}
 */
export function getRoleFromEmail(email) {
    if (!email) return 'Student';
    const lower = email.toLowerCase().trim();
    if (lower.includes('ceo') || lower.includes('admin') || lower.includes('chief') || lower.includes('boss')) {
        return 'CEO';
    } else if (lower.includes('employee') || lower.includes('emp') || lower.includes('counselor') || lower.includes('counsellor') || lower.includes('staff') || lower.includes('agent')) {
        return 'Employee';
    } else {
        return 'Student';
    }
}

/**
 * Route user based on their role
 * @param {string} email 
 */
export function routeByRole(email) {
    const role = getRoleFromEmail(email);
    if (role === 'CEO') {
        window.location.href = 'index.html';
    } else if (role === 'Employee') {
        window.location.href = 'employee.html';
    } else {
        window.location.href = 'student.html';
    }
}

/**
 * Updates the UI badge indicating the detected portal role
 */
export function updateDetectedRoleUI() {
    const email = document.getElementById('emailInput')?.value || '';
    const role = getRoleFromEmail(email);
    const badge = document.getElementById('detectedRoleBadge');

    if (badge) {
        if (role === 'CEO') {
            badge.className = 'badge bg-danger fs-6 px-3 py-1';
            badge.innerHTML = '👑 CEO Portal';
        } else if (role === 'Employee') {
            badge.className = 'badge bg-warning text-dark fs-6 px-3 py-1';
            badge.innerHTML = '💼 Counselor / Employee Portal';
        } else {
            badge.className = 'badge bg-info text-dark fs-6 px-3 py-1';
            badge.innerHTML = '🎓 Student Portal';
        }
    }
}

/**
 * Handles Firebase Sign In
 * @param {Event} event 
 */
export async function handleFirebaseLogin(event) {
    if (event) event.preventDefault();
    const emailInput = document.getElementById('emailInput');
    const passwordInput = document.getElementById('passwordInput');
    const submitBtn = document.getElementById('signinSubmitBtn');
    const alertArea = document.getElementById('signinAlert');

    if (!emailInput || !passwordInput) return;
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (alertArea) alertArea.innerHTML = '';

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Authenticating...';
    }

    try {
        try {
            await setPersistence(auth, browserSessionPersistence);
        } catch (persErr) {
            console.warn("setPersistence notice:", persErr);
        }

        let userCredential;
        try {
            userCredential = await signInWithEmailAndPassword(auth, email, password);
        } catch (signInErr) {
            console.warn("signInWithEmailAndPassword failed, checking for auto-signup fallback:", signInErr.code);
            if (signInErr.code === 'auth/invalid-credential' || signInErr.code === 'auth/user-not-found') {
                userCredential = await createUserWithEmailAndPassword(auth, email, password);
            } else {
                throw signInErr;
            }
        }

        const user = userCredential.user;
        console.log("Firebase Sign In Success for UID:", user.uid, "Email:", user.email);

        if (submitBtn) {
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Loading Dashboard...';
        }

        // 🔍 Firestore Role Check & Automatic Routing
        const emailClean = (user.email || email).toLowerCase().trim();

        // 1. Check employees collection first (by email or UID)
        try {
            let empSnap = await getDoc(doc(db, 'employees', emailClean));
            if (!empSnap.exists() && user.uid) {
                empSnap = await getDoc(doc(db, 'employees', user.uid));
            }
            if (empSnap.exists()) {
                console.log("Found record in 'employees' collection for:", emailClean, "Routing to employee.html");
                window.location.href = 'employee.html';
                return;
            }
        } catch(e) {
            console.warn("Notice checking employees collection on login:", e);
        }

        // 2. Check users collection (by UID or email)
        try {
            let userDocSnap;
            if (user.uid) {
                userDocSnap = await getDoc(doc(db, "users", user.uid));
            }
            if ((!userDocSnap || !userDocSnap.exists()) && emailClean) {
                userDocSnap = await getDoc(doc(db, "users", emailClean));
            }

            if (userDocSnap && userDocSnap.exists()) {
                const userData = userDocSnap.data();
                const role = (userData.role || '').toLowerCase().trim();
                console.log("Found user document in Firestore 'users' collection with role:", role);

                if (role === 'ceo' || role === 'admin') {
                    window.location.href = 'index.html';
                    return;
                } else if (role === 'employee' || role === 'counselor') {
                    window.location.href = 'employee.html';
                    return;
                } else if (role === 'student') {
                    window.location.href = 'student.html';
                    return;
                }
            }
        } catch (docErr) {
            console.warn("Error fetching user document from 'users' collection:", docErr);
        }

        // 3. Fallback string check by email keywords
        if (emailClean.includes('ceo') || emailClean.includes('admin') || emailClean.includes('chief') || emailClean.includes('boss')) {
            window.location.href = 'index.html';
        } else if (emailClean.includes('employee') || emailClean.includes('emp') || emailClean.includes('counselor') || emailClean.includes('counsellor') || emailClean.includes('staff') || emailClean.includes('agent')) {
            window.location.href = 'employee.html';
        } else {
            window.location.href = 'student.html';
        }

    } catch (error) {
        console.error("Firebase Sign In Error:", error);
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Sign In & Access Portal <i class="bi bi-arrow-right-short ms-1"></i>';
        }
        let msg = "Authentication failed. Please check your credentials.";
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            msg = "Invalid email or password. If you don't have an account, please Sign Up first.";
        } else if (error.code === 'auth/invalid-email') {
            msg = "Please enter a valid email address.";
        } else if (error.message) {
            msg = error.message.replace("Firebase: ", "");
        }
        if (alertArea) {
            alertArea.innerHTML = `<div class="alert alert-danger alert-dismissible fade show py-2 small" role="alert"><i class="bi bi-exclamation-triangle-fill me-1"></i> ${msg} <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button></div>`;
        }
    }
}

/**
 * Handles Firebase Sign Up (Public Registration - Strictly Student Candidates Only)
 * @param {Event} event 
 */
export async function handleFirebaseSignUp(event) {
    event.preventDefault();
    const emailInput = document.getElementById('signupEmail');
    const passwordInput = document.getElementById('signupPassword');
    const submitBtn = document.getElementById('signupSubmitBtn');
    const alertArea = document.getElementById('signupAlert');

    if (!emailInput || !passwordInput) return;
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (alertArea) alertArea.innerHTML = '';

    // Enforce that Counselor / Employee / CEO accounts CANNOT be created via public sign up
    const lower = email.toLowerCase();
    if (lower.includes('employee') || lower.includes('emp') || lower.includes('counselor') || lower.includes('counsellor') || lower.includes('staff') || lower.includes('agent') || lower.includes('ceo') || lower.includes('admin')) {
        if (alertArea) {
            alertArea.innerHTML = `
                <div class="alert alert-danger alert-dismissible fade show py-2 small mb-3" role="alert">
                    <i class="bi bi-shield-lock-fill me-1"></i> <strong>Access Restricted:</strong> Employee and Counselor accounts can only be created by the CEO from the Executive Portal. Public registration is for Student candidates only.
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                </div>`;
        }
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Creating Account...';
    }

    try {
        try {
            await setPersistence(auth, browserSessionPersistence);
        } catch (persErr) {
            console.warn("setPersistence notice on signup:", persErr);
        }

        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        console.log("Firebase Student Sign Up Success:", userCredential.user);
        routeByRole(userCredential.user.email || email);
    } catch (error) {
        console.error("Firebase Sign Up Error:", error);
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Create Free Account <i class="bi bi-check-circle-fill ms-1"></i>';
        }
        let msg = "Account creation failed.";
        if (error.code === 'auth/email-already-in-use') {
            msg = "This email address is already registered. Please switch to Sign In tab to access your account.";
        } else if (error.code === 'auth/weak-password') {
            msg = "Password should be at least 6 characters long.";
        } else if (error.code === 'auth/invalid-email') {
            msg = "Please enter a valid email address.";
        } else if (error.message) {
            msg = error.message.replace("Firebase: ", "");
        }
        if (alertArea) {
            alertArea.innerHTML = `<div class="alert alert-danger alert-dismissible fade show py-2 small" role="alert"><i class="bi bi-exclamation-triangle-fill me-1"></i> ${msg} <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button></div>`;
        }
    }
}

/**
 * Verifies CEO authentication credentials before authorizing privileged operations
 * @param {string} ceoEmail 
 * @param {string} ceoPassword 
 */
export async function verifyCEOCredentials(ceoEmail, ceoPassword) {
    if (!ceoEmail || !ceoPassword) {
        throw new Error("CEO Email and Password are required for authorization.");
    }
    const cleanEmail = ceoEmail.toLowerCase().trim();
    
    // Check if the email role qualifies as CEO
    const role = getRoleFromEmail(cleanEmail);
    if (role !== 'CEO') {
        let isCeoInFirestore = false;
        try {
            const snap = await getDoc(doc(db, 'users', cleanEmail));
            if (snap.exists() && (snap.data().role === 'ceo' || snap.data().role === 'admin')) {
                isCeoInFirestore = true;
            }
        } catch(e) {}
        if (!isCeoInFirestore) {
            throw new Error("Access Denied: The provided email does not possess CEO / Executive authorization.");
        }
    }

    // Authenticate credentials against Firebase Auth using isolated secondary instance
    const authVerifyAppName = 'CEOAuthVerificationApp_' + Date.now();
    const verifyApp = initializeApp(firebaseConfig, authVerifyAppName);
    const verifyAuth = getAuth(verifyApp);
    try {
        await signInWithEmailAndPassword(verifyAuth, cleanEmail, ceoPassword);
        await signOut(verifyAuth);
        return true;
    } catch (authErr) {
        console.error("CEO credentials verification failed:", authErr);
        if (authErr.code === 'auth/wrong-password' || authErr.code === 'auth/invalid-credential') {
            throw new Error("Invalid CEO Master Password. Authorization rejected.");
        } else if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-email') {
            throw new Error("CEO account not found. Please verify the CEO email address.");
        } else {
            throw new Error(authErr.message ? authErr.message.replace("Firebase: ", "") : "CEO Authentication failed.");
        }
    }
}
window.verifyCEOCredentials = verifyCEOCredentials;

/**
 * Allows CEO to create a new Counselor / Employee account with mandatory CEO email & password verification
 * @param {Event} event 
 */
export async function createEmployeeAccountByCEO(event) {
    if (event && event.preventDefault) event.preventDefault();

    const nameInput = document.getElementById('newEmpName');
    const emailInput = document.getElementById('newEmpEmail');
    const passwordInput = document.getElementById('newEmpPassword');
    const designationInput = document.getElementById('newEmpDesignation');
    const phoneInput = document.getElementById('newEmpPhone');
    const departmentInput = document.getElementById('newEmpDepartment');
    const ceoEmailInput = document.getElementById('ceoAuthEmail');
    const ceoPasswordInput = document.getElementById('ceoAuthPassword');
    const submitBtn = document.getElementById('createEmpSubmitBtn');
    const alertArea = document.getElementById('createEmpAlert');

    if (!nameInput || !emailInput || !passwordInput) return;

    const name = nameInput.value.trim();
    let email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    const designation = designationInput ? designationInput.value.trim() : 'Admission Counselor';
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const department = departmentInput ? departmentInput.value.trim() : 'General Admissions';

    const ceoEmail = ceoEmailInput ? ceoEmailInput.value.trim() : (auth.currentUser?.email || '');
    const ceoPassword = ceoPasswordInput ? ceoPasswordInput.value : '';

    if (!ceoEmail || !ceoPassword) {
        if (alertArea) {
            alertArea.innerHTML = `<div class="alert alert-warning py-2 small"><i class="bi bi-shield-lock-fill me-1"></i> <strong>CEO Authorization Required:</strong> Please enter your CEO Email and Password to authorize employee creation.</div>`;
        }
        return;
    }

    if (!email.includes('@')) {
        if (alertArea) {
            alertArea.innerHTML = `<div class="alert alert-warning py-2 small"><i class="bi bi-exclamation-triangle-fill me-1"></i> Please provide a valid employee email address.</div>`;
        }
        return;
    }

    if (alertArea) alertArea.innerHTML = '';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Verifying CEO &amp; Creating...';
    }

    try {
        // 1. Verify CEO Credentials first
        await verifyCEOCredentials(ceoEmail, ceoPassword);

        // 2. Initialize secondary Firebase App instance so CEO stays logged in
        const secondaryAppName = 'EmployeeProvisioningApp_' + Date.now();
        const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
        const secondaryAuth = getAuth(secondaryApp);

        // 3. Create the user credential in Firebase Authentication
        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
        const newUid = userCredential.user.uid;

        // Clean up secondary auth
        await signOut(secondaryAuth);

        // 4. Save the employee record in Firestore 'employees' collection
        const employeeData = {
            uid: newUid,
            fullName: name,
            email: email,
            role: 'employee',
            designation: designation,
            phone: phone,
            department: department,
            status: 'active',
            createdBy: ceoEmail,
            createdAt: serverTimestamp(),
            createdAtDate: new Date().toISOString()
        };

        // Save employee record in Firestore 'employees' and 'users' collections (by both email and UID)
        await setDoc(doc(db, 'employees', email), employeeData, { merge: true });
        if (newUid) {
            await setDoc(doc(db, 'employees', newUid), employeeData, { merge: true });
            await setDoc(doc(db, 'users', newUid), {
                uid: newUid,
                fullName: name,
                displayName: name,
                email: email,
                role: 'employee',
                designation: designation,
                department: department,
                phone: phone,
                createdAt: serverTimestamp()
            }, { merge: true });
        }
        await setDoc(doc(db, 'users', email), {
            uid: newUid,
            fullName: name,
            displayName: name,
            email: email,
            role: 'employee',
            designation: designation,
            department: department,
            phone: phone,
            createdAt: serverTimestamp()
        }, { merge: true });

        if (alertArea) {
            alertArea.innerHTML = `
                <div class="alert alert-success alert-dismissible fade show py-2 small" role="alert">
                    <i class="bi bi-check-circle-fill me-1"></i> <strong>Authorized &amp; Created!</strong> Employee account created successfully for <strong>${escapeHtml(name)}</strong> (${escapeHtml(email)}).
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                </div>`;
        }

        // Reset form inputs
        if (nameInput) nameInput.value = '';
        if (emailInput) emailInput.value = '';
        if (passwordInput) passwordInput.value = '';
        if (phoneInput) phoneInput.value = '';
        if (ceoPasswordInput) ceoPasswordInput.value = '';

        // Trigger SweetAlert if available
        if (window.Swal) {
            window.Swal.fire({
                icon: 'success',
                title: 'Authorized by CEO',
                html: `Employee <b>${escapeHtml(name)}</b> (${escapeHtml(email)}) has been successfully created.<br><br><span class="text-muted small">Employee can now log in at login.html.</span>`,
                confirmButtonColor: '#0b2447'
            });
        }

        // Refresh employee list
        if (window.fetchEmployeesList) {
            window.fetchEmployeesList();
        }
    } catch (error) {
        console.error("Error creating employee account:", error);
        let msg = "Failed to create employee account.";
        if (error.message && (error.message.includes("CEO") || error.message.includes("Access Denied"))) {
            msg = error.message;
        } else if (error.code === 'auth/email-already-in-use') {
            msg = "This email address is already in use by another account.";
        } else if (error.code === 'auth/weak-password') {
            msg = "Password should be at least 6 characters.";
        } else if (error.code === 'auth/invalid-email') {
            msg = "Invalid email format.";
        } else if (error.message) {
            msg = error.message.replace("Firebase: ", "");
        }
        if (alertArea) {
            alertArea.innerHTML = `<div class="alert alert-danger alert-dismissible fade show py-2 small" role="alert"><i class="bi bi-shield-x me-1"></i> <strong>Authorization/Creation Failed:</strong> ${escapeHtml(msg)} <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button></div>`;
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="bi bi-person-plus-fill me-1"></i> Create Employee Account';
        }
    }
}
window.createEmployeeAccountByCEO = createEmployeeAccountByCEO;

let employeesSnapshotUnsubscribe = null;

/**
 * Fetches and renders live employees list on CEO Dashboard
 */
export function fetchEmployeesList() {
    const tableBody = document.getElementById('ceoEmployeesTableBody');
    const badgeEl = document.getElementById('ceoEmployeeCountBadge');
    const kpiEl = document.getElementById('activeCounselorsKpi');

    if (!tableBody) return;

    if (employeesSnapshotUnsubscribe) {
        employeesSnapshotUnsubscribe();
        employeesSnapshotUnsubscribe = null;
    }

    try {
        employeesSnapshotUnsubscribe = onSnapshot(collection(db, 'employees'), (snapshot) => {
            const count = snapshot.size;
            if (badgeEl) badgeEl.innerText = `${count} Members`;
            const topBadgeEl = document.getElementById('topEmployeeCountBadge');
            if (topBadgeEl) topBadgeEl.innerText = count.toString();
            if (kpiEl) kpiEl.innerText = count > 0 ? count.toString() : '12';

            if (snapshot.empty) {
                tableBody.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center py-4 text-muted small">
                            <i class="bi bi-people fs-4 d-block mb-1 opacity-50"></i>
                            No employees created yet. Click <strong>+ Create Employee Account</strong> above to add counselors.
                        </td>
                    </tr>`;
                return;
            }

            let html = '';
            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                const id = docSnap.id;
                const name = data.fullName || 'Counselor';
                const email = data.email || id;
                const designation = data.designation || 'Admission Counselor';
                const department = data.department || 'Admissions';
                const phone = data.phone || 'N/A';
                const status = data.status || 'active';

                html += `
                    <tr>
                        <td class="py-2.5 ps-3">
                            <div class="fw-bold text-dark">${escapeHtml(name)}</div>
                            <small class="text-muted" style="font-size: 0.72rem;">${escapeHtml(email)}</small>
                        </td>
                        <td class="py-2.5 small fw-semibold text-secondary">${escapeHtml(designation)}</td>
                        <td class="py-2.5 small"><span class="badge bg-primary-subtle text-primary px-2.5 py-1 rounded-pill">${escapeHtml(department)}</span></td>
                        <td class="py-2.5 small text-muted">${escapeHtml(phone)}</td>
                        <td class="py-2.5"><span class="badge bg-success-subtle text-success border border-success px-2 py-0.5 rounded-pill small"><i class="bi bi-circle-fill me-1" style="font-size: 0.45rem;"></i>${escapeHtml(status)}</span></td>
                        <td class="py-2.5 text-center pe-3">
                            <button class="btn btn-sm btn-outline-danger p-1 px-2.5 rounded-3" title="Revoke / Delete Employee" onclick="window.deleteEmployeeAccount && window.deleteEmployeeAccount('${escapeHtml(id)}', '${escapeHtml(name)}')">
                                <i class="bi bi-trash3-fill me-1"></i> Delete
                            </button>
                        </td>
                    </tr>`;
            });
            tableBody.innerHTML = html;
        }, (err) => {
            console.warn("Notice loading employees list:", err);
        });
    } catch (e) {
        console.error("fetchEmployeesList error:", e);
    }
}
window.fetchEmployeesList = fetchEmployeesList;

/**
 * Removes an employee from the directory with mandatory CEO verification
 */
export async function deleteEmployeeAccount(empId, empName) {
    if (!empId) return;

    let ceoEmail = '';
    let ceoPassword = '';

    if (window.Swal) {
        const { value: formValues, isConfirmed } = await window.Swal.fire({
            title: 'CEO Authorization Required',
            html: `
                <div class="text-start small mb-3 text-muted">
                    <span class="text-danger fw-bold"><i class="bi bi-shield-lock-fill me-1"></i> Security Verification:</span><br>
                    You are revoking access for employee <strong>${escapeHtml(empName || empId)}</strong>. Please provide CEO credentials to confirm this deletion.
                </div>
                <div class="text-start mb-2">
                    <label class="form-label fw-bold small text-dark mb-1">CEO Email Address <span class="text-danger">*</span></label>
                    <input id="swal-ceo-email" type="email" class="form-control" placeholder="e.g. didar.ceo@gmail.com" value="${escapeHtml(auth.currentUser?.email || '')}">
                </div>
                <div class="text-start">
                    <label class="form-label fw-bold small text-dark mb-1">CEO Master Password <span class="text-danger">*</span></label>
                    <input id="swal-ceo-password" type="password" class="form-control" placeholder="Enter CEO Password">
                </div>
            `,
            focusConfirm: false,
            showCancelButton: true,
            confirmButtonText: '<i class="bi bi-trash3-fill me-1"></i> Verify &amp; Delete',
            confirmButtonColor: '#dc3545',
            cancelButtonText: 'Cancel',
            preConfirm: () => {
                const email = document.getElementById('swal-ceo-email')?.value?.trim();
                const pass = document.getElementById('swal-ceo-password')?.value;
                if (!email || !pass) {
                    window.Swal.showValidationMessage('Both CEO Email and Password are required to delete an employee.');
                    return false;
                }
                return { email, pass };
            }
        });

        if (!isConfirmed || !formValues) return;
        ceoEmail = formValues.email;
        ceoPassword = formValues.pass;
    } else {
        ceoEmail = prompt(`[CEO Security Check]\nEnter CEO Email to delete ${empName || empId}:`, auth.currentUser?.email || '');
        if (!ceoEmail) return;
        ceoPassword = prompt(`[CEO Security Check]\nEnter CEO Password for ${ceoEmail}:`);
        if (!ceoPassword) return;
    }

    try {
        if (window.Swal) {
            window.Swal.fire({
                title: 'Verifying CEO Credentials...',
                text: 'Authorizing employee deletion...',
                didOpen: () => window.Swal.showLoading(),
                allowOutsideClick: false
            });
        }

        // Verify CEO credentials
        await verifyCEOCredentials(ceoEmail, ceoPassword);

        // Delete from Firestore
        await deleteDoc(doc(db, 'employees', empId));
        try {
            await deleteDoc(doc(db, 'users', empId));
        } catch (e) { }

        if (window.Swal) {
            window.Swal.fire({
                icon: 'success',
                title: 'Employee Deleted',
                text: `Counselor account for "${empName || empId}" has been revoked by CEO authorization.`,
                confirmButtonColor: '#0b2447'
            });
        } else {
            alert(`Employee account for "${empName || empId}" deleted successfully.`);
        }
    } catch (err) {
        console.error("Error deleting employee:", err);
        if (window.Swal) {
            window.Swal.fire({
                icon: 'error',
                title: 'CEO Authorization Failed',
                text: err.message || 'Invalid CEO credentials. Employee deletion aborted.',
                confirmButtonColor: '#dc3545'
            });
        } else {
            alert("Authorization Failed: " + (err.message || 'Invalid CEO credentials.'));
        }
    }
}
window.deleteEmployeeAccount = deleteEmployeeAccount;

/**
 * Triggers a password reset email via Firebase Authentication
 * @param {Event} event 
 */
export async function handleForgotPassword(event) {
    if (event && event.preventDefault) event.preventDefault();

    const emailInput = document.getElementById('emailInput') || document.getElementById('email');
    const alertArea = document.getElementById('signinAlert');
    const emailValue = emailInput ? emailInput.value.trim() : '';

    if (!emailValue) {
        const msg = "Please enter your email address first, then click 'Forgot Password'.";
        if (alertArea) {
            alertArea.innerHTML = `<div class="alert alert-warning alert-dismissible fade show py-2 small mb-3" role="alert"><i class="bi bi-exclamation-triangle-fill me-1"></i> ${escapeHtml(msg)} <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button></div>`;
        } else {
            alert(msg);
        }
        if (emailInput) emailInput.focus();
        return;
    }

    try {
        await sendPasswordResetEmail(auth, emailValue);
        const successMsg = "Password reset link sent! Please check your email inbox (and spam folder).";
        console.log("Password reset email sent to:", emailValue);
        if (alertArea) {
            alertArea.innerHTML = `<div class="alert alert-success alert-dismissible fade show py-2 small mb-3" role="alert"><i class="bi bi-check-circle-fill me-1"></i> ${escapeHtml(successMsg)} <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button></div>`;
        } else {
            alert(successMsg);
        }
    } catch (error) {
        console.error("Password reset error:", error);
        let errorMsg = "Failed to send password reset email.";
        if (error.code === 'auth/user-not-found') {
            errorMsg = "No account found registered with this email address.";
        } else if (error.code === 'auth/invalid-email') {
            errorMsg = "Please enter a valid email address.";
        } else if (error.message) {
            errorMsg = error.message.replace("Firebase: ", "");
        }
        if (alertArea) {
            alertArea.innerHTML = `<div class="alert alert-danger alert-dismissible fade show py-2 small mb-3" role="alert"><i class="bi bi-exclamation-triangle-fill me-1"></i> ${escapeHtml(errorMsg)} <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button></div>`;
        } else {
            alert(errorMsg);
        }
    }
}

/**
 * Global Sign Out Handler
 * Signs out current authenticated user and redirects to login/home
 */
export async function handleLogout(event) {
    if (event && event.preventDefault) event.preventDefault();
    try {
        await signOut(auth);
        console.log("Firebase Auth: User signed out successfully.");
    } catch (err) {
        console.warn("Firebase Auth: Sign out error:", err);
    }
    window.location.href = 'login.html';
}

/**
 * Dynamically updates the navigation bar on the Public Home Page (login.html)
 * when a user is signed in vs signed out.
 * @param {import("https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js").User | null} user
 */
export async function updateHomeNavbarAuthUI(user) {
    const authContainer = document.getElementById('homeNavbarAuthButtons');
    if (!authContainer) return;

    if (!user) {
        // Logged Out State: Show standard Sign In & Sign Up buttons
        authContainer.innerHTML = `
            <button class="btn btn-sm btn-outline-light rounded-circle px-2 py-1 me-1" onclick="toggleTheme()" title="Toggle Dark/Light Theme">
                <i class="themeToggleIcon bi bi-sun-fill text-warning"></i>
            </button>
            <button class="btn btn-signin-now px-3.5 py-2 fw-semibold rounded-pill" data-bs-toggle="modal" data-bs-target="#loginModal" onclick="openAuthModal('signin')">
                <i class="bi bi-box-arrow-in-right me-1"></i> Sign In
            </button>
            <button class="btn btn-apply-now pulse-glow-button px-3.5 py-2 fw-semibold rounded-pill" data-bs-toggle="modal" data-bs-target="#loginModal" onclick="openAuthModal('signup')">
                <i class="bi bi-person-plus-fill me-1"></i> Sign Up
            </button>
        `;
        initThemeToggle();
        return;
    }

    // Logged In State: Determine user role, full name, and designation
    let role = getRoleFromEmail(user.email);
    const cleanEmail = (user.email || '').toLowerCase().trim();

    // Clean name formatter
    function formatNameString(str) {
        if (!str) return '';
        if (str.includes('@')) str = str.split('@')[0];
        return str
            .replace(/[._-]/g, ' ')
            .split(' ')
            .filter(Boolean)
            .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(' ');
    }

    // Default intelligent fallbacks based on common portal personas
    let fallbackName = user.displayName;
    if (fallbackName && fallbackName.includes('@')) fallbackName = '';

    if (!fallbackName && cleanEmail) {
        if (cleanEmail.includes('didar') || cleanEmail.startsWith('ceo')) {
            fallbackName = 'Didar Hossain';
        } else if (cleanEmail.includes('kabir')) {
            fallbackName = 'Kabir Hossain';
        } else if (cleanEmail.includes('sakib')) {
            fallbackName = 'Sakib Rahman';
        } else if (cleanEmail.includes('ayesha')) {
            fallbackName = 'Ayesha Rahman';
        } else if (cleanEmail.includes('rafid')) {
            fallbackName = 'Rafid Islam';
        } else {
            fallbackName = formatNameString(cleanEmail);
        }
    }
    if (!fallbackName) fallbackName = 'Candidate';

    let resolvedName = fallbackName;
    let resolvedDesignation = '';

    try {
        // 0. Check 'employees' collection in Firestore for Counselor Profile
        try {
            let empSnap = await getDoc(doc(db, "employees", cleanEmail));
            if (!empSnap.exists() && user.uid) {
                empSnap = await getDoc(doc(db, "employees", user.uid));
            }
            if (empSnap.exists()) {
                const empData = empSnap.data();
                role = 'Employee';
                if (empData.fullName || empData.name) {
                    resolvedName = empData.fullName || empData.name;
                }
                if (empData.designation) {
                    resolvedDesignation = empData.designation;
                }
                const empHeroName = document.getElementById('empHeroName');
                const empHeroRole = document.getElementById('empHeroRole');
                const empHeroDept = document.getElementById('empHeroDept');
                const empHeroEmail = document.getElementById('empHeroEmail');
                const navEmployeeName = document.getElementById('navEmployeeName');

                if (empHeroName) empHeroName.innerText = `Welcome, ${resolvedName}`;
                if (empHeroRole) empHeroRole.innerText = empData.designation || 'Admission Counselor';
                if (empHeroDept) empHeroDept.innerText = empData.department || 'General Admissions';
                if (empHeroEmail) empHeroEmail.innerText = empData.email || cleanEmail;
                if (navEmployeeName) navEmployeeName.innerText = resolvedName;
            }
        } catch(empErr) {
            console.warn("Notice fetching employee profile:", empErr);
        }

        // 1. Check in-memory student cache first if loaded
        if (window.loadedStudentsMap) {
            for (const [id, s] of Object.entries(window.loadedStudentsMap)) {
                const sEmail = (s?.personalInfo?.email || s?.email || id || '').toLowerCase().trim();
                if (sEmail === cleanEmail) {
                    const sName = s?.personalInfo?.fullName || s?.personalInfo?.name || s?.fullName || s?.name;
                    if (sName && !sName.includes('@')) {
                        resolvedName = sName;
                        break;
                    }
                }
            }
        }

        // 2. Check 'users' collection in Firestore for user profile & role
        if (user.uid) {
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const data = userDocSnap.data();
                if (data.role) {
                    const r = String(data.role).toLowerCase().trim();
                    if (r === 'ceo' || r === 'admin') role = 'CEO';
                    else if (r === 'employee' || r === 'counselor') role = 'Employee';
                    else role = 'Student';
                }
                if (data.fullName || data.name) {
                    const uName = data.fullName || data.name;
                    if (uName && !uName.includes('@')) resolvedName = uName;
                }
                if (data.designation || data.position || data.title) {
                    resolvedDesignation = data.designation || data.position || data.title;
                }
            }
        }

        // 3. If Student, check 'students' collection direct document & query
        if (role === 'Student' && cleanEmail) {
            try {
                const studentDocRef = doc(db, "students", cleanEmail);
                const studentDocSnap = await getDoc(studentDocRef);
                if (studentDocSnap.exists()) {
                    const sData = studentDocSnap.data();
                    const actualStudentName = sData.personalInfo?.fullName || sData.personalInfo?.name || sData.fullName || sData.name;
                    if (actualStudentName && !actualStudentName.includes('@')) {
                        resolvedName = actualStudentName;
                    }
                } else {
                    // Try query if docId was not direct email
                    const qStudents = query(collection(db, "students"), where("personalInfo.email", "==", cleanEmail));
                    const qSnap = await getDocs(qStudents);
                    if (!qSnap.empty) {
                        const sData = qSnap.docs[0].data();
                        const actualStudentName = sData.personalInfo?.fullName || sData.personalInfo?.name || sData.fullName || sData.name;
                        if (actualStudentName && !actualStudentName.includes('@')) {
                            resolvedName = actualStudentName;
                        }
                    }
                }
            } catch (sErr) {
                console.warn("Student doc lookup notice:", sErr);
            }
        }
    } catch (e) {
        console.warn("Notice fetching user details for home navbar:", e);
    }

    // Ensure resolvedName NEVER has an @ symbol
    if (resolvedName.includes('@')) {
        resolvedName = formatNameString(resolvedName);
    }

    // Role-specific badge and portal navigation target
    let portalUrl = 'student.html';
    let profileBtnLabel = 'My Profile';
    let profileIcon = 'bi-person-circle';
    let roleBadge = '';

    if (role === 'CEO') {
        portalUrl = 'index.html';
        profileBtnLabel = 'CEO Dashboard';
        profileIcon = 'bi-speedometer2';
        const ceoTitle = resolvedDesignation || 'CEO';
        roleBadge = `<span class="badge bg-danger-subtle text-danger border border-danger px-3 py-1.5 rounded-pill small d-inline-flex align-items-center gap-1 shadow-sm"><i class="bi bi-award-fill text-danger"></i> ${escapeHtml(resolvedName)} (${escapeHtml(ceoTitle)})</span>`;
    } else if (role === 'Employee') {
        portalUrl = 'employee.html';
        profileBtnLabel = 'Counselor Portal';
        profileIcon = 'bi-speedometer2';
        const empTitle = resolvedDesignation || 'Counselor';
        roleBadge = `<span class="badge bg-warning-subtle text-warning-emphasis border border-warning px-3 py-1.5 rounded-pill small d-inline-flex align-items-center gap-1 shadow-sm"><i class="bi bi-person-badge-fill text-warning"></i> ${escapeHtml(resolvedName)} (${escapeHtml(empTitle)})</span>`;
    } else {
        portalUrl = 'student.html';
        profileBtnLabel = 'My Profile';
        profileIcon = 'bi-person-circle';
        // Student displays only student's Name (e.g. Rafid Islam, Sakib Rahman)
        roleBadge = `<span class="badge bg-info-subtle text-info-emphasis border border-info px-3 py-1.5 rounded-pill small d-inline-flex align-items-center gap-1 shadow-sm"><i class="bi bi-mortarboard-fill text-info"></i> ${escapeHtml(resolvedName)}</span>`;
    }

    authContainer.innerHTML = `
        <button class="btn btn-sm btn-outline-light rounded-circle px-2 py-1 flex-shrink-0" onclick="toggleTheme()" title="Toggle Dark/Light Theme">
            <i class="themeToggleIcon bi bi-sun-fill text-warning"></i>
        </button>
        ${roleBadge}
        <a href="${portalUrl}" class="btn btn-apply-now pulse-glow-button px-3 py-1.5 fw-semibold rounded-pill d-inline-flex align-items-center gap-1 shadow-sm flex-shrink-0" style="font-size: 0.85rem;" title="Return to your Portal Dashboard">
            <i class="bi ${profileIcon}"></i> ${profileBtnLabel}
        </a>
        <button onclick="handleLogout(event)" class="btn btn-outline-danger px-2.5 py-1.5 fw-semibold rounded-pill btn-sm d-inline-flex align-items-center gap-1 shadow-sm flex-shrink-0" style="font-size: 0.85rem;" title="Sign Out">
            <i class="bi bi-box-arrow-right"></i> Logout
        </button>
    `;
    initThemeToggle();
}

/**
 * Recursively sanitizes an object payload to ensure no field contains undefined,
 * replacing undefined values with "" while preserving Firestore sentinel values.
 */
function sanitizePayload(obj) {
    if (obj === undefined || obj === null) return "";
    if (typeof obj !== "object") return obj;

    // Preserve Firestore sentinel objects like serverTimestamp() or FieldValue
    if (obj._methodName || (obj.constructor && obj.constructor.name === "FieldValue")) {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(item => item === undefined ? "" : sanitizePayload(item));
    }

    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value === undefined) {
            cleaned[key] = "";
        } else if (value !== null && typeof value === "object") {
            if (value._methodName || (value.constructor && value.constructor.name === "FieldValue")) {
                cleaned[key] = value;
            } else {
                cleaned[key] = sanitizePayload(value);
            }
        } else {
            cleaned[key] = value;
        }
    }
    return cleaned;
}

/**
 * Saves Student Application Form data to Firestore 'students' collection
 * @param {Event} event 
 */
export async function saveStudentApplication(event) {
    if (event && event.preventDefault) {
        event.preventDefault();
    }

    const form = document.getElementById('applicationForm');
    const submitBtn = document.getElementById('submitBtn') || (form ? form.querySelector('button[type="submit"]') : null);
    const alertContainer = document.getElementById('alertContainer');

    if (alertContainer) alertContainer.innerHTML = '';

    const originalBtnText = submitBtn ? submitBtn.innerHTML : '<i class="bi bi-save me-2"></i> Save Student Application Data';

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Saving...';
    }

    try {
        // 🔐 AUTH GATE: Ensure user is authenticated before attempting Firestore write
        const currentUser = auth.currentUser;
        if (!currentUser) {
            console.error("Firestore write blocked: No authenticated user session found.");
            if (alertContainer) {
                alertContainer.innerHTML = `
                    <div class="alert alert-danger alert-dismissible fade show shadow-sm py-3 mb-4" role="alert">
                        <i class="bi bi-exclamation-triangle-fill me-2 fs-5 align-middle"></i> 
                        <strong>Authentication Required:</strong> You must be signed in to submit an application profile. Please log in to your account.
                        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                    </div>`;
            }
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
            return;
        }

        // 🎯 DOCUMENT ID MATCH: Explicitly match user email or UID as document reference ID
        const docId = (currentUser.email && currentUser.email.trim())
            ? currentUser.email.trim().toLowerCase()
            : currentUser.uid;

        // 📋 HARVEST FORM DATA & REPLACE UNDEFINED VALUES
        const getVal = (id) => {
            const el = document.getElementById(id);
            return (el && el.value !== undefined && el.value !== null) ? el.value.trim() : "";
        };

        const rawData = {
            uid: currentUser.uid || "",
            email: currentUser.email || getVal('email'),
            entryDate: getVal('entryDate'),
            personalInfo: {
                fullName: getVal('fullName'),
                dob: getVal('dob'),
                gender: getVal('gender'),
                contactNo: getVal('contactNo'),
                email: getVal('email') || currentUser.email || "",
                postCode: getVal('postCode'),
                address: getVal('address')
            },
            educationalProfile: {
                ssc: {
                    gpa: getVal('sscGpa'),
                    passingYear: getVal('sscYear'),
                    major: getVal('sscMajor')
                },
                hsc: {
                    gpa: getVal('hscGpa'),
                    passingYear: getVal('hscYear'),
                    major: getVal('hscMajor')
                },
                bachelor: {
                    cgpa: getVal('bachelorGpa'),
                    passingYear: getVal('bachelorYear'),
                    major: getVal('bachelorMajor')
                },
                master: {
                    cgpa: getVal('masterGpa'),
                    passingYear: getVal('masterYear'),
                    major: getVal('masterMajor')
                }
            },
            englishProficiency: {
                testName: getVal('testName'),
                testDate: getVal('testDate'),
                overallScore: getVal('overallScore'),
                sectionScores: {
                    listening: getVal('listeningScore'),
                    reading: getVal('readingScore'),
                    writing: getVal('writingScore'),
                    speaking: getVal('speakingScore')
                }
            },
            preferences: {
                courseChoices: [
                    getVal('courseChoice1'),
                    getVal('courseChoice2')
                ].filter(Boolean),
                countryChoices: [
                    getVal('country1'),
                    getVal('country2'),
                    getVal('country3')
                ].filter(Boolean),
                universityChoices: [
                    getVal('uni1'),
                    getVal('uni2'),
                    getVal('uni3')
                ].filter(Boolean)
            },
            createdAt: serverTimestamp()
        };

        // 🛡️ DATA COMPLETENESS GUARANTEE: Remove any lingering undefined values
        const studentData = sanitizePayload(rawData);

        // 📦 COLLECTION ALIGNMENT: Save to 'students' collection using matching authenticated document ID
        const studentRef = doc(db, "students", docId);
        await setDoc(studentRef, studentData, { merge: true });
        console.log("Student Application Record successfully saved/updated in 'students' collection with Document ID:", docId);

        // ── Auto Student Account Creation (Secondary Auth Instance) & Password Setup Email ───
        const studentEmail = (studentData.personalInfo?.email || currentUser.email || "").trim();
        let accountStatusMsg = "Application Saved Successfully!";
        let emailSentSuccessfully = false;
        let emailErrorMessage = null;

        if (studentEmail) {
            try {
                let secondaryApp;
                if (getApps().some(a => a.name === "SecondaryApp")) {
                    secondaryApp = getApp("SecondaryApp");
                } else {
                    secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
                }
                const secondaryAuth = getAuth(secondaryApp);

                // 1. Create student account on secondary auth instance
                try {
                    await createUserWithEmailAndPassword(secondaryAuth, studentEmail, "Temp@123456");
                    console.log("Student account created silently on secondaryAuth for:", studentEmail);
                    accountStatusMsg = "Application Saved & Student Account Created!";
                } catch (createErr) {
                    console.warn("Secondary auth account creation notice:", createErr.code || createErr.message);
                    if (createErr.code === 'auth/email-already-in-use') {
                        accountStatusMsg = "Application Saved! Student account already exists.";
                    } else {
                        accountStatusMsg = `Application Saved! (${createErr.message || 'Account registration note'})`;
                    }
                }

                // 2. Dispatch password setup/reset email via primary Auth instance with promise handlers
                try {
                    await sendPasswordResetEmail(auth, studentEmail)
                        .then(() => {
                            console.log("Password setup email sent successfully.");
                            emailSentSuccessfully = true;
                        })
                        .catch((emailErr) => {
                            console.error("Error sending email: ", emailErr);
                            emailErrorMessage = emailErr.message || emailErr.code || "Firebase email error";
                        });
                } catch (outerEmailErr) {
                    console.error("Error sending email: ", outerEmailErr);
                    emailErrorMessage = outerEmailErr.message || "Failed to dispatch password setup email";
                }

                // 3. Cleanly sign out secondary auth instance
                try {
                    await signOut(secondaryAuth);
                } catch (soErr) {
                    console.warn("Secondary auth signout error:", soErr);
                }

            } catch (secAppErr) {
                console.warn("Secondary app initialization error:", secAppErr);
            }
        }

        if (alertContainer) {
            if (emailSentSuccessfully) {
                alertContainer.innerHTML = `
                    <div class="alert alert-success alert-dismissible fade show shadow-sm py-3 mb-4" role="alert">
                        <i class="bi bi-check-circle-fill me-2 fs-5 align-middle"></i> 
                        <strong>${escapeHtml(accountStatusMsg)}</strong> Registered in Firestore database (Ref ID: <code>${escapeHtml(docId)}</code>).<br>
                        <span class="small mt-1 d-block"><i class="bi bi-envelope-check-fill me-1"></i> A password setup link has been dispatched to <strong>${escapeHtml(studentEmail)}</strong>. Please <strong>check your inbox and Spam folder to set your password</strong>.</span>
                        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                    </div>`;
            } else if (emailErrorMessage) {
                alertContainer.innerHTML = `
                    <div class="alert alert-warning alert-dismissible fade show shadow-sm py-3 mb-4" role="alert">
                        <i class="bi bi-exclamation-triangle-fill me-2 fs-5 align-middle"></i> 
                        <strong>${escapeHtml(accountStatusMsg)}</strong> Registered in Firestore database (Ref ID: <code>${escapeHtml(docId)}</code>).<br>
                        <span class="small mt-1 d-block text-danger"><i class="bi bi-envelope-exclamation-fill me-1"></i> Password reset email error: ${escapeHtml(emailErrorMessage)}. Ensure authorized domain settings in Firebase Console.</span>
                        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                    </div>`;
            } else {
                alertContainer.innerHTML = `
                    <div class="alert alert-success alert-dismissible fade show shadow-sm py-3 mb-4" role="alert">
                        <i class="bi bi-check-circle-fill me-2 fs-5 align-middle"></i> 
                        <strong>${escapeHtml(accountStatusMsg)}</strong> Registered in Firestore database (Ref ID: <code>${escapeHtml(docId)}</code>).
                        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                    </div>`;
            }
        }

        const toastEl = document.getElementById('saveToast');
        if (toastEl && window.bootstrap) {
            const toast = new bootstrap.Toast(toastEl);
            toast.show();
        }

        const savedDate = document.getElementById('entryDate')?.value;
        if (form) form.reset();
        if (savedDate && document.getElementById('entryDate')) {
            document.getElementById('entryDate').value = savedDate;
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });

    } catch (error) {
        console.error("Error saving student application to Firestore:", error);
        if (alertContainer) {
            alertContainer.innerHTML = `
                <div class="alert alert-danger alert-dismissible fade show shadow-sm py-3 mb-4" role="alert">
                    <i class="bi bi-exclamation-triangle-fill me-2 fs-5 align-middle"></i> 
                    <strong>Failed to Save Application:</strong> ${escapeHtml(error.message || 'Database write error. Please check your internet connection.')}
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                </div>`;
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    }
}

/**
 * Fetches all student records from Firestore 'students' collection and renders them dynamically for Employee Portal
 */
/**
 * Helper to get latest message timestamp for sorting safely
 */
function getLatestMessageTime(studentData) {
    if (!studentData) return 0;
    const msgs = Array.isArray(studentData.messages) ? studentData.messages : [];
    if (msgs.length > 0) {
        const last = msgs[msgs.length - 1];
        if (last && last.timestamp) {
            const parsed = typeof last.timestamp === 'number' ? last.timestamp : new Date(last.timestamp).getTime();
            if (!isNaN(parsed) && parsed > 0) return parsed;
        }
    }
    if (studentData.createdAt) {
        const created = typeof studentData.createdAt === 'number' ? studentData.createdAt : new Date(studentData.createdAt).getTime();
        if (!isNaN(created) && created > 0) return created;
    }
    return 0;
}

/**
 * Helper to count unread messages sent by 'Student' for a candidate record
 */
export function getUnreadStudentMessagesCount(studentData) {
    if (!studentData) return 0;
    if (studentData.hasUnreadStudentMessages === false && (!studentData.unreadStudentMessagesCount || studentData.unreadStudentMessagesCount === 0)) {
        return 0;
    }
    if (typeof studentData.unreadStudentMessagesCount === 'number') {
        return Math.max(0, studentData.unreadStudentMessagesCount);
    }
    if (studentData.hasUnreadStudentMessages === true) {
        return 1;
    }
    const msgs = Array.isArray(studentData.messages) ? studentData.messages : [];
    return msgs.filter(m => (m.sender === 'Student' || m.sender === 'student') && m.isRead !== true && m.isRead !== 'true').length;
}

/**
 * Helper to check if student has unread messages sent by 'Student' safely
 */
export function hasUnreadStudentMessages(studentData) {
    if (!studentData) return false;
    if (studentData.hasUnreadStudentMessages === false && (!studentData.unreadStudentMessagesCount || studentData.unreadStudentMessagesCount === 0)) {
        return false;
    }
    if (typeof studentData.unreadStudentMessagesCount === 'number') {
        return studentData.unreadStudentMessagesCount > 0;
    }
    if (typeof studentData.hasUnreadStudentMessages === 'boolean') {
        return studentData.hasUnreadStudentMessages;
    }
    const msgs = Array.isArray(studentData.messages) ? studentData.messages : [];
    return msgs.some(m => (m.sender === 'Student' || m.sender === 'student') && m.isRead !== true && m.isRead !== 'true');
}

// Mutable Global Fallback Data
const globalSampleStudents = [
    {
        id: "std_sakib_01",
        data: {
            personalInfo: { fullName: "Sakib Rahman", email: "sakib@gmail.com", contactNo: "+880 1712-345678" },
            preferences: { countryChoices: ["UK"], courseChoices: ["MSc Computer Science"] },
            hasUnreadStudentMessages: false,
            unreadStudentMessagesCount: 0,
            messages: []
        }
    },
    {
        id: "std_amina_02",
        data: {
            personalInfo: { fullName: "Amina Khatun", email: "amina@gmail.com", contactNo: "+880 1819-876543" },
            preferences: { countryChoices: ["Canada"], courseChoices: ["MBA"] },
            hasUnreadStudentMessages: false,
            unreadStudentMessagesCount: 0,
            messages: []
        }
    },
    {
        id: "std_tanvir_03",
        data: {
            personalInfo: { fullName: "Tanvir Hasan", email: "tanvir@gmail.com", contactNo: "+880 1911-223344" },
            preferences: { countryChoices: ["Australia"], courseChoices: ["BSc Software Engineering"] },
            hasUnreadStudentMessages: false,
            unreadStudentMessagesCount: 0,
            messages: []
        }
    }
];

/**
 * Marks messages sent by a specific role as read in Firestore and clears unread badges immediately
 */
export async function markMessagesAsRead(identifier, unreadSender = 'Student') {
    if (!identifier) return;
    const cleanId = String(identifier).trim().toLowerCase();

    // 1. Immediately remove all unread badges for this student from the current DOM
    try {
        const matchingButtons = document.querySelectorAll(`[data-email="${cleanId}"], .chat-btn`);
        matchingButtons.forEach(btn => {
            const btnEmail = (btn.getAttribute('data-email') || '').trim().toLowerCase();
            if (btnEmail === cleanId || cleanId.includes(btnEmail) || (btnEmail && btnEmail.includes(cleanId))) {
                const badge = btn.querySelector('.badge');
                if (badge && (badge.textContent.includes('New') || badge.classList.contains('bg-danger'))) {
                    badge.remove();
                }
            }
        });
    } catch (domErr) {
        console.warn("DOM badge update notice:", domErr);
    }

    // 2. Mark in global sample memory
    globalSampleStudents.forEach(item => {
        const sEmail = (item.data?.personalInfo?.email || item.id || '').trim().toLowerCase();
        if (sEmail === cleanId || item.id.toLowerCase() === cleanId) {
            if (Array.isArray(item.data.messages)) {
                item.data.messages.forEach(m => { m.isRead = true; });
            }
            item.data.unreadStudentMessagesCount = 0;
            item.data.hasUnreadStudentMessages = false;
        }
    });

    // 3. Collect all matching student document IDs
    const docIdsToUpdate = new Set([cleanId, identifier]);
    if (window.loadedStudentsMap) {
        for (const [id, sData] of Object.entries(window.loadedStudentsMap)) {
            const sEmail = (sData?.personalInfo?.email || sData?.email || '').trim().toLowerCase();
            if (sEmail === cleanId || id.toLowerCase() === cleanId || cleanId.includes(sEmail) || sEmail.includes(cleanId)) {
                docIdsToUpdate.add(id);
                sData.unreadStudentMessagesCount = 0;
                sData.hasUnreadStudentMessages = false;
                if (Array.isArray(sData.messages)) {
                    sData.messages.forEach(m => { m.isRead = true; });
                }
            }
        }
    }

    // 4. Query Firestore collection case-insensitively to find the true document ID
    try {
        const allStudentsSnap = await getDocs(collection(db, 'students'));
        allStudentsSnap.forEach(dSnap => {
            const dData = dSnap.data();
            const dEmail = (dData?.personalInfo?.email || dData?.email || '').trim().toLowerCase();
            if (dEmail === cleanId || dSnap.id.toLowerCase() === cleanId || (dEmail && cleanId.includes(dEmail))) {
                docIdsToUpdate.add(dSnap.id);
            }
        });
    } catch (qErr) {
        console.warn("Notice querying all students:", qErr);
    }

    // 5. Update every matching student document & subcollection in Firestore
    for (const docId of docIdsToUpdate) {
        if (!docId) continue;
        try {
            const studentRef = doc(db, 'students', docId);
            const docSnap = await getDoc(studentRef);
            if (docSnap.exists()) {
                const docData = docSnap.data();
                let updatedMessages = docData.messages;
                if (Array.isArray(updatedMessages)) {
                    updatedMessages = updatedMessages.map(m => {
                        if (m.sender === 'student' || m.sender === 'Student' || m.senderRole === 'student') {
                            return { ...m, isRead: true };
                        }
                        return m;
                    });
                }
                await updateDoc(studentRef, {
                    unreadStudentMessagesCount: 0,
                    hasUnreadStudentMessages: false,
                    ...(Array.isArray(updatedMessages) ? { messages: updatedMessages } : {})
                });
            }
        } catch (err) {
            // Safe ignore if document is only virtual
        }

        try {
            const chatSubRef = collection(db, 'students', docId, 'chatMessages');
            const allMsgsSnap = await getDocs(chatSubRef);
            allMsgsSnap.forEach(async (docSnap) => {
                const data = docSnap.data();
                if (data.isRead !== true) {
                    if ((unreadSender === 'Student' && (data.sender === 'student' || data.sender === 'Student' || data.senderRole === 'student')) ||
                        (unreadSender !== 'Student' && data.sender !== 'student' && data.sender !== 'Student' && data.senderRole !== 'student') ||
                        (!unreadSender)) {
                        await updateDoc(docSnap.ref, { isRead: true }).catch(() => { });
                    }
                }
            });
        } catch (subErr) {
            console.warn("Notice marking subcollection messages as read:", subErr);
        }
    }
}
window.markMessagesAsRead = markMessagesAsRead;



/**
 * 🟡 Skeleton Loading Generator
 */
function getSkeletonRowsHTML(cols = 5, rows = 4) {
    let html = '';
    for (let r = 0; r < rows; r++) {
        html += '<tr>';
        for (let c = 0; c < cols; c++) {
            html += `<td class="py-2.5"><span class="skeleton-line"></span></td>`;
        }
        html += '</tr>';
    }
    return html;
}

/**
 * 🌙 Theme Toggle Controller with LocalStorage Persistence
 */
export function initThemeToggle() {
    const savedTheme = localStorage.getItem('newage_theme') || 'dark';
    document.documentElement.setAttribute('data-bs-theme', savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeToggleIcons(savedTheme);
}

export function toggleTheme() {
    const current = document.documentElement.getAttribute('data-bs-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-bs-theme', next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('newage_theme', next);
    updateThemeToggleIcons(next);
    renderCEOAnalyticsCharts(window.lastLoadedStudentItems || []);
}

function updateThemeToggleIcons(theme) {
    const icons = document.querySelectorAll('.themeToggleIcon');
    icons.forEach(icon => {
        if (theme === 'dark') {
            icon.className = 'themeToggleIcon bi bi-sun-fill text-warning';
        } else {
            icon.className = 'themeToggleIcon bi bi-moon-stars-fill text-primary';
        }
    });
}

/**
 * 📊 Chart.js CEO Analytics Renderer
 */
let countryChartInstance = null;
let statusChartInstance = null;

function renderCEOAnalyticsCharts(studentItems = []) {
    if (typeof Chart === 'undefined') return;

    const countryCanvas = document.getElementById('countryChartCanvas');
    const statusCanvas = document.getElementById('statusChartCanvas');

    if (!countryCanvas || !statusCanvas) return;

    // Aggregate data
    const countryCounts = {};
    const statusCounts = { 'Approved': 0, 'Pending': 0, 'Processing': 0, 'Rejected': 0 };

    if (studentItems.length > 0) {
        studentItems.forEach(({ data }) => {
            const country = (data.preferences?.countryChoices?.[0]) || 'Canada';
            countryCounts[country] = (countryCounts[country] || 0) + 1;

            const apps = getStudentApplications(data);
            if (apps.length > 0) {
                apps.forEach(app => {
                    const st = app.status || 'Pending';
                    if (statusCounts[st] !== undefined) statusCounts[st]++;
                    else statusCounts['Pending']++;
                });
            } else {
                statusCounts['Pending']++;
            }
        });
    } else {
        countryCounts['Canada'] = 14;
        countryCounts['United Kingdom'] = 18;
        countryCounts['Australia'] = 10;
        countryCounts['United States'] = 8;
        countryCounts['Germany'] = 5;

        statusCounts['Approved'] = 12;
        statusCounts['Pending'] = 24;
        statusCounts['Processing'] = 15;
        statusCounts['Rejected'] = 4;
    }

    const isDark = (document.documentElement.getAttribute('data-bs-theme') || 'dark') === 'dark';
    const textColor = isDark ? '#ffffff' : '#1e293b';

    // Chart 1: Target Country Doughnut Chart
    if (countryChartInstance) countryChartInstance.destroy();
    countryChartInstance = new Chart(countryCanvas, {
        type: 'doughnut',
        data: {
            labels: Object.keys(countryCounts),
            datasets: [{
                data: Object.values(countryCounts),
                backgroundColor: ['#E63946', '#FFC107', '#457B9D', '#1D3557', '#F4A261', '#2A9D8F'],
                borderWidth: 2,
                borderColor: isDark ? '#07172f' : '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: textColor, boxWidth: 12, padding: 12, font: { family: 'Inter' } }
                }
            }
        }
    });

    // Chart 2: Application Pipeline Bar Chart
    if (statusChartInstance) statusChartInstance.destroy();
    statusChartInstance = new Chart(statusCanvas, {
        type: 'bar',
        data: {
            labels: Object.keys(statusCounts),
            datasets: [{
                label: 'Applications',
                data: Object.values(statusCounts),
                backgroundColor: ['#2A9D8F', '#FFC107', '#457B9D', '#E63946'],
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { ticks: { color: textColor, font: { family: 'Inter' } }, grid: { display: false } },
                y: { beginAtZero: true, ticks: { color: textColor, stepSize: 2, font: { family: 'Inter' } } }
            }
        }
    });
}

let studentsSnapshotUnsubscribe = null;

/**
 * Fetches all student records from Firestore 'students' collection and renders them dynamically for Employee Portal
 */
export function fetchStudents() {
    const tableBody = document.getElementById('studentsTableBody');
    const studentCountBadge = document.getElementById('studentCountBadge');

    if (!tableBody) return;

    if (!tableBody.innerHTML || tableBody.innerHTML.trim() === '') {
        tableBody.innerHTML = getSkeletonRowsHTML(6, 5);
    }

    if (studentsSnapshotUnsubscribe) {
        studentsSnapshotUnsubscribe();
        studentsSnapshotUnsubscribe = null;
    }

    try {
        const q = query(collection(db, "students"), orderBy("createdAt", "desc"));
        studentsSnapshotUnsubscribe = onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                renderFallbackStudents(tableBody, studentCountBadge);
                return;
            }

            if (studentCountBadge) studentCountBadge.innerText = `${snapshot.size} Records`;

            const studentItems = [];
            window.loadedStudentsMap = window.loadedStudentsMap || {};

            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                window.loadedStudentsMap[docSnap.id] = data;
                if (data?.personalInfo?.email) {
                    window.loadedStudentsMap[data.personalInfo.email.toLowerCase()] = data;
                }
                studentItems.push({ id: docSnap.id, data });
            });

            // Sort students: Most recent message appears at the top
            studentItems.sort((a, b) => getLatestMessageTime(b.data) - getLatestMessageTime(a.data));

            let html = '';
            studentItems.forEach(({ id, data }) => {
                const fullName = data.personalInfo?.fullName || 'N/A';
                const rawEmail = data.personalInfo?.email || data.email || '';
                const email = (rawEmail && rawEmail !== 'N/A') ? rawEmail : 'N/A';
                const studentIdentifier = (email !== 'N/A' && email.includes('@')) ? email.trim().toLowerCase() : id;
                const phone = data.personalInfo?.contactNo || 'N/A';
                const primaryCountry = (data.preferences?.countryChoices && data.preferences.countryChoices.length > 0)
                    ? data.preferences.countryChoices[0]
                    : 'N/A';
                const primaryCourse = (data.preferences?.courseChoices && data.preferences.courseChoices.length > 0)
                    ? data.preferences.courseChoices[0]
                    : 'N/A';
                const hasUnread = hasUnreadStudentMessages(data);
                const unreadBadge = hasUnread
                    ? `<span class="badge rounded-pill bg-danger ms-1" style="font-size: 0.7rem;">New Message</span>`
                    : '';

                html += `
                    <tr>
                        <td class="py-2.5 ps-4">
                            <div class="fw-bold text-dark mb-0" style="font-size: 0.875rem;">${escapeHtml(fullName)}</div>
                            <small class="text-muted" style="font-size: 0.7rem;">ID: #${id.substring(0, 8).toUpperCase()}</small>
                        </td>
                        <td class="text-muted small py-2.5">${escapeHtml(email)}</td>
                        <td class="small py-2.5">${escapeHtml(phone)}</td>
                        <td class="py-2.5">
                            <span class="badge bg-danger px-2.5 py-1 rounded-pill">${escapeHtml(primaryCountry)}</span>
                        </td>
                        <td class="small fw-semibold text-secondary py-2.5">${escapeHtml(primaryCourse)}</td>
                        <td class="py-2.5 text-center pe-4">
                            <div class="d-inline-flex align-items-center gap-1">
                                <button class="btn btn-sm btn-navy view-btn py-1 px-2.5 rounded-3" data-email="${escapeHtml(studentIdentifier)}" data-id="${id}" data-student-id="${id}" onclick="viewStudentDetails('${id}')" title="View Full Profile">
                                    <i class="bi bi-eye-fill me-1"></i> View
                                </button>
                                <button class="btn btn-sm btn-info chat-btn py-1 px-2.5 rounded-3 fw-semibold ms-1" data-email="${escapeHtml(studentIdentifier)}" data-name="${escapeHtml(fullName)}" data-bs-toggle="modal" data-bs-target="#employeeChatModal" onclick="window.openEmployeeChatModal && window.openEmployeeChatModal('${escapeHtml(studentIdentifier)}', '${escapeHtml(fullName)}')">💬 Chat${unreadBadge}</button>
                            </div>
                        </td>
                    </tr>`;
            });

            tableBody.innerHTML = html;
        }, (error) => {
            console.warn("Firestore onSnapshot error, falling back to query:", error);
            renderFallbackStudents(tableBody, studentCountBadge);
        });
    } catch (err) {
        console.error("fetchStudents error:", err);
        renderFallbackStudents(tableBody, studentCountBadge);
    }
}

function renderFallbackStudents(tableBody, studentCountBadge) {
    if (!tableBody) return;

    const sampleStudents = globalSampleStudents;

    window.loadedStudentsMap = window.loadedStudentsMap || {};
    sampleStudents.forEach(s => {
        window.loadedStudentsMap[s.id] = s.data;
        if (s.data?.personalInfo?.email) {
            window.loadedStudentsMap[s.data.personalInfo.email.toLowerCase()] = s.data;
        }
    });

    if (studentCountBadge) studentCountBadge.innerText = `${sampleStudents.length} Records`;

    let html = '';
    sampleStudents.forEach(({ id, data }) => {
        const hasUnread = hasUnreadStudentMessages(data);
        const unreadBadge = hasUnread
            ? `<span class="badge rounded-pill bg-danger ms-1" style="font-size: 0.7rem;">New Message</span>`
            : '';

        html += `
            <tr>
                <td class="py-2.5 ps-4">
                    <div class="fw-bold text-dark mb-0" style="font-size: 0.875rem;">${escapeHtml(data.personalInfo.fullName)}</div>
                    <small class="text-muted" style="font-size: 0.7rem;">ID: #${id.toUpperCase()}</small>
                </td>
                <td class="text-muted small py-2.5">${escapeHtml(data.personalInfo.email)}</td>
                <td class="small py-2.5">${escapeHtml(data.personalInfo.contactNo)}</td>
                <td class="py-2.5">
                    <span class="badge bg-danger px-2.5 py-1 rounded-pill">${escapeHtml(data.preferences.countryChoices[0])}</span>
                </td>
                <td class="small fw-semibold text-secondary py-2.5">${escapeHtml(data.preferences.courseChoices[0])}</td>
                <td class="py-2.5 text-center pe-4">
                    <div class="d-inline-flex align-items-center gap-1">
                        <button class="btn btn-sm btn-navy view-btn py-1 px-2.5 rounded-3" data-email="${escapeHtml(data.personalInfo.email)}" data-id="${id}" data-student-id="${id}" onclick="viewStudentDetails('${id}')" title="View Full Profile">
                            <i class="bi bi-eye-fill me-1"></i> View
                        </button>
                        <button class="btn btn-sm btn-info chat-btn py-1 px-2.5 rounded-3 fw-semibold ms-1" data-email="${escapeHtml(data.personalInfo.email)}" data-name="${escapeHtml(data.personalInfo.fullName)}" data-bs-toggle="modal" data-bs-target="#employeeChatModal" onclick="window.openEmployeeChatModal && window.openEmployeeChatModal('${escapeHtml(data.personalInfo.email)}', '${escapeHtml(data.personalInfo.fullName)}')">💬 Chat${unreadBadge}</button>
                    </div>
                </td>
            </tr>`;
    });
    tableBody.innerHTML = html;
}

/**
 * Filter assigned applications for Employee Portal
 */
export function renderCounselorApplications(applications, counselorEmail) {
    const tableBody = document.getElementById('counselorApplicationsTableBody');
    if (!tableBody) return;

    if (!applications || applications.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No assigned students found for ${escapeHtml(counselorEmail || 'your profile')}</td></tr>`;
        return;
    }

    let html = '';
    applications.forEach(({ id, data }) => {
        const studentEmail = data.personalInfo?.email || id;
        const hasUnread = hasUnreadStudentMessages(data);
        const unreadBadge = hasUnread
            ? `<span class="badge rounded-pill bg-danger ms-1" style="font-size: 0.7rem;">New Message</span>`
            : '';

        html += `
            <tr>
                <td class="py-2.5 ps-4">
                    <div class="fw-bold text-dark mb-0" style="font-size: 0.875rem;">${escapeHtml(data.personalInfo?.fullName || 'N/A')}</div>
                    <small class="text-muted" style="font-size: 0.7rem;">ID: #${id.substring(0, 8).toUpperCase()}</small>
                </td>
                <td class="text-muted small py-2.5">${escapeHtml(studentEmail)}</td>
                <td class="small py-2.5">${escapeHtml(data.personalInfo?.contactNo || 'N/A')}</td>
                <td class="py-2.5">
                    <span class="badge bg-danger px-2.5 py-1 rounded-pill">${escapeHtml(data.preferences?.countryChoices?.[0] || 'N/A')}</span>
                </td>
                <td class="small fw-semibold text-secondary py-2.5">${escapeHtml(data.preferences?.courseChoices?.[0] || 'N/A')}</td>
                <td class="py-2.5 text-center pe-4">
                    <div class="d-inline-flex align-items-center gap-1">
                        <button class="btn btn-sm btn-navy view-btn py-1 px-2.5 rounded-3" data-email="${escapeHtml(studentEmail)}" data-id="${id}" data-student-id="${id}" onclick="viewStudentDetails('${id}')" title="View Full Profile">
                            <i class="bi bi-eye-fill me-1"></i> View
                        </button>
                        <button class="btn btn-sm btn-info chat-btn py-1 px-2.5 rounded-3 fw-semibold ms-1" data-email="${escapeHtml(studentEmail)}" data-name="${escapeHtml(data.personalInfo?.fullName || 'Candidate')}" data-bs-toggle="modal" data-bs-target="${document.getElementById('ceoChatModal') ? '#ceoChatModal' : '#employeeChatModal'}" onclick="(window.openCeoChatModal || window.openEmployeeChatModal)('${escapeHtml(studentEmail)}', '${escapeHtml(data.personalInfo?.fullName || 'Candidate')}');">💬 Chat${unreadBadge}</button>
                    </div>
                </td>
            </tr>`;
    });
    tableBody.innerHTML = html;
}

let ceoSnapshotUnsubscribe = null;

/**
 * Loads Firestore data and updates KPIs + Recent Student Applications table on CEO Dashboard
 */
export function loadCEODashboardData() {
    const kpiEl = document.getElementById('totalStudentsKpi');
    const tableBody = document.getElementById('recentApplicationsTableBody');
    const badgeEl = document.getElementById('ceoStudentCountBadge');

    if (tableBody && (!tableBody.innerHTML || tableBody.innerHTML.trim() === '')) {
        tableBody.innerHTML = getSkeletonRowsHTML(6, 5);
    }

    if (ceoSnapshotUnsubscribe) {
        ceoSnapshotUnsubscribe();
        ceoSnapshotUnsubscribe = null;
    }

    try {
        const q = query(collection(db, "students"), orderBy("createdAt", "desc"));
        ceoSnapshotUnsubscribe = onSnapshot(q, (snapshot) => {
            const count = snapshot.size;

            if (kpiEl) kpiEl.innerText = count.toLocaleString();
            if (badgeEl) badgeEl.innerText = `${count} Records`;

            const studentItems = [];
            window.loadedStudentsMap = window.loadedStudentsMap || {};

            snapshot.forEach((docSnap) => {
                const data = docSnap.data();
                window.loadedStudentsMap[docSnap.id] = data;
                if (data?.personalInfo?.email) {
                    window.loadedStudentsMap[data.personalInfo.email.toLowerCase()] = data;
                }
                studentItems.push({ id: docSnap.id, data });
            });

            window.lastLoadedStudentItems = studentItems;

            // Render Chart.js Analytics
            renderCEOAnalyticsCharts(studentItems);

            if (!tableBody) return;

            if (snapshot.empty) {
                renderFallbackStudents(tableBody, badgeEl);
                return;
            }

            // 🟢 Sort students: Most recent message appears at top
            studentItems.sort((a, b) => getLatestMessageTime(b.data) - getLatestMessageTime(a.data));

            let html = '';
            studentItems.forEach(({ id, data }) => {
                const fullName = data.personalInfo?.fullName || 'N/A';
                const rawEmail = data.personalInfo?.email || data.email || '';
                const email = (rawEmail && rawEmail !== 'N/A') ? rawEmail : 'N/A';
                const studentIdentifier = (email !== 'N/A' && email.includes('@')) ? email.trim().toLowerCase() : id;
                const phone = data.personalInfo?.contactNo || 'N/A';
                const primaryCountry = (data.preferences?.countryChoices && data.preferences.countryChoices.length > 0)
                    ? data.preferences.countryChoices[0]
                    : 'N/A';
                const primaryCourse = (data.preferences?.courseChoices && data.preferences.courseChoices.length > 0)
                    ? data.preferences.courseChoices[0]
                    : 'N/A';
                const hasUnread = hasUnreadStudentMessages(data);
                const unreadBadge = hasUnread
                    ? `<span class="badge rounded-pill bg-danger ms-1" style="font-size: 0.7rem;">New Message</span>`
                    : '';

                html += `
                    <tr>
                        <td>
                            <div class="fw-bold text-dark">${escapeHtml(fullName)}</div>
                            <small class="text-muted" style="font-size: 0.725rem;">ID: #${id.substring(0, 8).toUpperCase()}</small>
                        </td>
                        <td class="text-muted small">${escapeHtml(email)}</td>
                        <td class="small">${escapeHtml(phone)}</td>
                        <td>
                            <span class="badge bg-danger px-2.5 py-1 rounded-pill">${escapeHtml(primaryCountry)}</span>
                        </td>
                        <td class="small fw-semibold text-secondary">${escapeHtml(primaryCourse)}</td>
                        <td>
                            <button class="btn btn-sm btn-navy view-btn shadow-sm" data-email="${escapeHtml(studentIdentifier)}" data-id="${id}" data-student-id="${id}" onclick="viewStudentDetails('${id}')">
                                <i class="bi bi-person-lines-fill me-1"></i> View Profile
                            </button>
                            <button class="btn btn-sm btn-info chat-btn shadow-sm ms-1 fw-semibold" data-email="${escapeHtml(studentIdentifier)}" data-name="${escapeHtml(fullName)}" data-bs-toggle="modal" data-bs-target="#ceoChatModal" onclick="window.openCeoChatModal && window.openCeoChatModal('${escapeHtml(studentIdentifier)}', '${escapeHtml(fullName)}')">💬 Chat${unreadBadge}</button>
                        </td>
                    </tr>`;
            });

            tableBody.innerHTML = html;
        }, (error) => {
            console.warn("Firestore CEO onSnapshot error:", error);
            if (kpiEl) kpiEl.innerText = '3';
            if (tableBody) renderFallbackStudents(tableBody, badgeEl);
        });
    } catch (error) {
        console.error("Error loading CEO Dashboard data:", error);
        if (kpiEl) kpiEl.innerText = '3';
        if (tableBody) renderFallbackStudents(tableBody, badgeEl);
    }
    fetchEmployeesList();
}

/**
 * Safely extracts a document URL from studentData by checking multiple possible field locations.
 * Handles both legacy plain URL strings and new {url, status} objects.
 * @param {Object} studentData 
 * @param {string} key 
 * @returns {string|null}
 */
function getDocUrl(studentData, key) {
    if (!studentData) return null;
    const docs = studentData.documents || {};

    // Check the primary location first (supports both object and string)
    const primary = docs[key];
    if (primary) {
        if (typeof primary === 'object' && primary.url) return primary.url;
        if (typeof primary === 'string' && primary.trim().length > 0) return primary.trim();
    }

    const candidates = [
        docs[`${key}_url`],
        docs[`${key}Url`],
        docs[`${key}URL`],
        studentData[key],
        studentData[`${key}_url`],
        studentData[`${key}Url`],
        studentData[`${key}URL`]
    ];

    if (key === 'passport') {
        candidates.push(docs.passport_file, studentData.passport_file, studentData.passportUrl);
    } else if (key === 'ssc_marksheet' || key === 'hsc_marksheet') {
        candidates.push(
            docs.transcript, docs.transcript_url, docs.transcripts,
            studentData.transcript, studentData.transcript_url, studentData.transcripts,
            studentData.transcriptUrl
        );
    } else if (key === 'ssc_certificate' || key === 'hsc_certificate') {
        candidates.push(
            docs.certificate, docs.certificate_url,
            studentData.certificate, studentData.certificate_url
        );
    }

    for (const cand of candidates) {
        if (cand && typeof cand === 'object' && cand.url) return cand.url;
        if (cand && typeof cand === 'string' && cand.trim().length > 0) return cand.trim();
    }
    return null;
}

/**
 * Resolves the approval status for a document field.
 * Returns 'Pending', 'Approved', or null if document doesn't exist.
 * @param {Object} studentData 
 * @param {string} key 
 * @returns {string|null}
 */
function getDocStatus(studentData, key) {
    if (!studentData) return null;
    const docs = studentData.documents || {};
    const entry = docs[key];

    if (entry && typeof entry === 'object' && entry.status) {
        return entry.status;
    }
    // Legacy plain URL strings are treated as 'Pending' by default
    if (getDocUrl(studentData, key)) {
        return 'Pending';
    }
    return null;
}

/**
 * Builds the HTML for the Uploaded Documents section inside the student detail modal.
 * Reads from studentData.documents or top-level document URL fields.
 * Supports {url, status} objects for approval workflow.
 * @param {Object|undefined} studentData - Full student document data from Firestore
 * @param {string} [studentId] - Optional student ID for approve actions
 * @returns {string} HTML string
 */
function buildDocumentsSection(studentData, studentId) {
    console.log("Building Documents Section for studentData:", studentData);

    const DOC_TYPES = [
        { key: 'ssc_certificate', label: 'SSC Certificate' },
        { key: 'ssc_marksheet', label: 'SSC Marksheet / Transcript' },
        { key: 'hsc_certificate', label: 'HSC Certificate' },
        { key: 'hsc_marksheet', label: 'HSC Marksheet / Transcript' },
        { key: 'recommendation_letter', label: 'Recommendation Letter' },
        { key: 'passport', label: 'Passport' },
        { key: 'student_nid', label: 'Student NID' },
        { key: 'cv', label: 'CV / Resume' },
        { key: 'sop', label: 'SOP (Statement of Purpose)' },
        { key: 'bank_statement', label: 'Bank Statement' },
        { key: 'other_documents', label: 'Other Documents' },
    ];

    const docs = studentData ? (studentData.documents || {}) : {};
    const uploadedCount = DOC_TYPES.filter(d => getDocUrl(studentData, d.key)).length;

    const badgeClass = uploadedCount === 0
        ? 'bg-secondary'
        : uploadedCount === DOC_TYPES.length
            ? 'bg-success'
            : 'bg-warning text-dark';

    let rows = DOC_TYPES.map(({ key, label }) => {
        const url = getDocUrl(studentData, key);
        const docStatus = getDocStatus(studentData, key);
        const uploadedAt = docs[`${key}_uploadedAt`]
            ? new Date(docs[`${key}_uploadedAt`]).toLocaleDateString('en-GB')
            : null;

        // Status badge with approval state
        let statusBadge;
        if (!url) {
            statusBadge = `<span class="badge bg-light text-muted border">Not Uploaded Yet</span>`;
        } else if (docStatus === 'Approved') {
            statusBadge = `<span class="badge bg-success"><i class="bi bi-check-circle-fill me-1"></i>Approved</span>`;
        } else {
            statusBadge = `<span class="badge bg-warning text-dark"><i class="bi bi-clock-history me-1"></i>Pending</span>`;
        }

        // Action buttons
        let actionBtn;
        if (!url) {
            actionBtn = `<span class="text-muted small fst-italic">Not Uploaded Yet</span>`;
        } else {
            const viewBtn = `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"
                  class="btn btn-sm btn-outline-primary py-0 px-2 fw-semibold">
                  <i class="bi bi-file-earmark-text me-1"></i>View
               </a>`;
            // Show Approve button only if Pending and studentId is provided (CEO/Employee modal)
            const approveBtn = (studentId && docStatus !== 'Approved')
                ? ` <button class="btn btn-sm btn-outline-success py-0 px-2 fw-semibold" onclick="approveDocument('${studentId}', '${key}')">
                       <i class="bi bi-check-lg me-1"></i>Approve
                   </button>`
                : '';
            actionBtn = viewBtn + approveBtn;
        }

        const dateCell = uploadedAt
            ? `<small class="text-muted">${uploadedAt}</small>`
            : `<small class="text-muted">—</small>`;

        return `
            <tr>
                <td class="small fw-semibold">${escapeHtml(label)}</td>
                <td>${statusBadge}</td>
                <td>${dateCell}</td>
                <td>${actionBtn}</td>
            </tr>`;
    }).join('');

    return `
        <hr class="my-3">
        <div class="d-flex align-items-center justify-content-between mb-2">
            <h6 class="fw-bold text-dark mb-0">
                <i class="bi bi-folder2-open text-danger me-2"></i>Uploaded Documents
            </h6>
            <span class="badge ${badgeClass} px-2 py-1">
                ${uploadedCount} / ${DOC_TYPES.length} Uploaded
            </span>
        </div>
        <div class="table-responsive rounded border">
            <table class="table table-sm table-hover align-middle mb-0 small">
                <thead class="table-dark">
                    <tr>
                        <th>Document Type</th>
                        <th>Status</th>
                        <th>Upload Date</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
}

/**
 * Approves a specific document for a student (CEO/Employee action).
 * Updates Firestore field documents.<key>.status to 'Approved' using dot notation.
 * @param {string} studentId 
 * @param {string} docKey 
 */
export async function approveDocument(studentId, docKey) {
    const student = window.loadedStudentsMap ? window.loadedStudentsMap[studentId] : null;
    if (!student) { alert('Student data not loaded.'); return; }

    try {
        const studentRef = doc(db, 'students', studentId);
        const docEntry = student.documents?.[docKey];

        if (docEntry && typeof docEntry === 'object') {
            // New format: update status field inside the object
            await updateDoc(studentRef, {
                [`documents.${docKey}.status`]: 'Approved'
            });
            docEntry.status = 'Approved';
        } else if (docEntry && typeof docEntry === 'string') {
            // Legacy plain URL: convert to object format with Approved status
            await updateDoc(studentRef, {
                [`documents.${docKey}`]: { url: docEntry, status: 'Approved' }
            });
            student.documents[docKey] = { url: docEntry, status: 'Approved' };
        } else {
            alert('Document not found.');
            return;
        }

        console.log(`Approved document "${docKey}" for student ${studentId}`);

        // Re-render the modal to reflect the update
        viewStudentDetails(studentId);

        // Show success alert after re-render
        const alertArea = document.getElementById('profileEditAlert');
        if (alertArea) {
            alertArea.innerHTML = `
                <div class="alert alert-success alert-dismissible fade show py-2 px-3 small mb-3" role="alert">
                    <i class="bi bi-check-circle-fill me-1"></i> "${docKey.replace(/_/g, ' ')}" has been <strong>Approved</strong>!
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                </div>`;
        }
    } catch (error) {
        console.error('Error approving document:', error);
        alert('Failed to approve document: ' + error.message);
    }
}

/**
 * Resolves applications array for a student, falling back to legacy preferences if empty
 * @param {Object} student 
 * @returns {Array<Object>}
 */
function getStudentApplications(student) {
    if (!student) return [];

    // 1. Return explicit applications array if present
    if (Array.isArray(student.applications) && student.applications.length > 0) {
        return student.applications;
    }

    // 2. Fallback: Generate initial application objects from legacy preferences
    const apps = [];
    const courses = student.preferences?.courseChoices || [];
    const countries = student.preferences?.countryChoices || [];
    const unis = student.preferences?.universityChoices || [];
    const defaultStatus = student.status || 'Pending';

    const count = Math.max(courses.length, countries.length, unis.length);
    if (count > 0) {
        for (let i = 0; i < count; i++) {
            apps.push({
                id: `app_legacy_${i + 1}`,
                country: countries[i] || countries[0] || 'N/A',
                university: unis[i] || unis[0] || 'Target University',
                course: courses[i] || courses[0] || 'General Program',
                intake: 'September 2026',
                course_link: '',
                status: defaultStatus,
                createdAt: new Date().toISOString()
            });
        }
    }

    return apps;
}

/**
 * Builds HTML for Applications Management Section in Student Profile Modal
 * @param {string} studentId 
 * @param {Object} student 
 * @returns {string}
 */
function buildApplicationsManagementSection(studentId, student) {
    const apps = getStudentApplications(student);

    let rowsHTML = '';
    if (apps.length === 0) {
        rowsHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted py-3">
                    <i class="bi bi-folder-x me-1"></i> No application tracking records found for this student. Use the form above to add one.
                </td>
            </tr>`;
    } else {
        rowsHTML = apps.map((app) => {
            const status = app.status || 'Pending / Processing';
            const linkHTML = app.course_link
                ? `<a href="${escapeHtml(app.course_link)}" target="_blank" rel="noopener noreferrer" class="btn btn-xs btn-outline-primary py-0 px-2 small">
                      <i class="bi bi-box-arrow-up-right me-1"></i>Link
                   </a>`
                : `<span class="text-muted small fst-italic">—</span>`;

            return `
                <tr>
                    <td class="align-middle">
                        <div class="fw-bold text-dark small">${escapeHtml(app.course || 'N/A')}</div>
                        <small class="text-muted"><i class="bi bi-building me-1"></i>${escapeHtml(app.university || 'N/A')}</small>
                    </td>
                    <td class="align-middle">
                        <span class="badge bg-danger px-2 py-1 me-1">${escapeHtml(app.country || 'N/A')}</span>
                        <small class="text-muted d-block mt-1">${escapeHtml(app.intake || 'N/A')}</small>
                    </td>
                    <td class="align-middle text-center">${linkHTML}</td>
                    <td class="align-middle">
                        <select id="appStatusSelect_${app.id}" class="form-select form-select-sm status-dropdown bg-white text-dark border-secondary fw-semibold" style="min-width: 180px;">
                            ${[
                    "Pending / Processing",
                    "Offer letter received",
                    "Applied for unconditional offer letter",
                    "Applied for CAS",
                    "CAS received",
                    "VFS Global Appointment",
                    "Embassy Interview",
                    "UKVI interview",
                    "Visa Success",
                    "Rejected"
                ].map(opt => `<option value="${escapeHtml(opt)}" ${status === opt ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
                        </select>
                    </td>
                    <td class="align-middle text-end text-nowrap">
                        <button class="btn btn-sm btn-outline-success me-1 py-1 px-2 fw-semibold" onclick="updateApplicationStatus('${studentId}', '${app.id}')" title="Save status for this application">
                            <i class="bi bi-check-lg me-1"></i>Save
                        </button>
                        <button class="btn btn-sm btn-outline-danger py-1 px-2" onclick="deleteApplication('${studentId}', '${app.id}')" title="Remove application">
                            <i class="bi bi-trash"></i>
                        </button>
                    </td>
                </tr>`;
        }).join('');
    }

    return `
        <!-- APPLICATIONS MANAGEMENT SECTION -->
        <div class="card border-danger-subtle mb-3">
            <div class="card-header bg-dark text-white d-flex align-items-center justify-content-between py-2">
                <h6 class="mb-0 fw-bold text-white"><i class="bi bi-mortarboard-fill text-danger me-2"></i>Applications Management (${apps.length})</h6>
                <span class="badge bg-danger px-2 py-1">Multi-Application Tracker</span>
            </div>
            <div class="card-body bg-light p-3">
                <!-- Add Application Form -->
                <div class="border rounded p-3 bg-white mb-3 shadow-sm">
                    <h6 class="fw-bold text-dark small mb-2"><i class="bi bi-plus-circle-fill text-danger me-1"></i> Add New University Application</h6>
                    <div class="row g-2">
                        <div class="col-md-2 col-6">
                            <label class="form-label text-muted small mb-1 fw-semibold">Country</label>
                            <input type="text" id="newAppCountry" class="form-control form-control-sm" placeholder="e.g. Canada" required>
                        </div>
                        <div class="col-md-3 col-6">
                            <label class="form-label text-muted small mb-1 fw-semibold">University</label>
                            <input type="text" id="newAppUni" class="form-control form-control-sm" placeholder="e.g. Univ of Toronto" required>
                        </div>
                        <div class="col-md-3 col-6">
                            <label class="form-label text-muted small mb-1 fw-semibold">Course Name</label>
                            <input type="text" id="newAppCourse" class="form-control form-control-sm" placeholder="e.g. MSc Data Science" required>
                        </div>
                        <div class="col-md-2 col-6">
                            <label class="form-label text-muted small mb-1 fw-semibold">Intake</label>
                            <input type="text" id="newAppIntake" class="form-control form-control-sm" placeholder="e.g. Fall 2026">
                        </div>
                        <div class="col-md-2 col-6">
                            <label class="form-label text-muted small mb-1 fw-semibold">Initial Status</label>
                            <select id="newAppStatus" class="form-select form-select-sm fw-semibold bg-white text-dark" style="min-width: 160px;">
                                ${[
            "Pending / Processing",
            "Offer letter received",
            "Applied for unconditional offer letter",
            "Applied for CAS",
            "CAS received",
            "VFS Global Appointment",
            "Embassy Interview",
            "UKVI interview",
            "Visa Success",
            "Rejected"
        ].map(opt => `<option value="${escapeHtml(opt)}">${escapeHtml(opt)}</option>`).join('')}
                            </select>
                        </div>
                        <div class="col-md-9 col-12">
                            <label class="form-label text-muted small mb-1 fw-semibold">Course Link / URL</label>
                            <input type="url" id="newAppLink" class="form-control form-control-sm" placeholder="https://university.edu/course-page">
                        </div>
                        <div class="col-md-3 col-12 d-flex align-items-end">
                            <button class="btn btn-sm btn-newage-red w-100 fw-bold py-1" onclick="addNewApplication('${studentId}')">
                                <i class="bi bi-plus-lg me-1"></i> Add Application
                            </button>
                        </div>
                    </div>
                </div>

                <div id="appManagerAlert"></div>

                <!-- Existing Applications Table -->
                <div class="table-responsive rounded border bg-white mb-3">
                    <table class="table table-sm table-hover align-middle mb-0 small">
                        <thead class="table-dark">
                            <tr>
                                <th>Course &amp; University</th>
                                <th>Country &amp; Intake</th>
                                <th class="text-center">Link</th>
                                <th>Status</th>
                                <th class="text-end">Action</th>
                            </tr>
                        </thead>
                        <tbody>${rowsHTML}</tbody>
                    </table>
                </div>

                <!-- Interview Preparation Sheets Section -->
                ${(() => {
            const prepSheets = (student && Array.isArray(student.prepSheets)) ? student.prepSheets : [];
            const prepRows = prepSheets.length === 0
                ? `<tr><td colspan="3" class="text-center text-muted py-2">No interview preparation materials uploaded yet.</td></tr>`
                : prepSheets.map(s => `
                            <tr>
                                <td class="fw-bold text-dark"><i class="bi bi-file-earmark-pdf-fill text-danger me-1"></i>${escapeHtml(s.title || 'Prep Sheet')}</td>
                                <td class="small text-muted">${s.uploadedAt ? new Date(s.uploadedAt).toLocaleDateString() : 'Recent'}</td>
                                <td class="text-end">
                                    <a href="${escapeHtml(s.url || '#')}" target="_blank" download="${escapeHtml(s.title || 'Sheet')}.pdf" class="btn btn-xs btn-outline-danger py-0 px-2 small fw-semibold">
                                        <i class="bi bi-download me-1"></i> View/Download
                                    </a>
                                </td>
                            </tr>
                        `).join('');

            return `
                        <div class="card border-danger-subtle bg-white shadow-sm">
                            <div class="card-body p-3">
                                <div class="d-flex align-items-center justify-content-between mb-2">
                                    <h6 class="fw-bold text-dark mb-0"><i class="bi bi-journal-bookmark-fill text-danger me-2"></i>Interview Preparation Materials (${prepSheets.length})</h6>
                                    <button class="btn btn-sm btn-danger fw-bold px-3 py-1" onclick="openPrepSheetModal('${studentId}')">
                                        <i class="bi bi-cloud-upload-fill me-1"></i> + Upload Prep Material
                                    </button>
                                </div>
                                <div class="table-responsive rounded border bg-light">
                                    <table class="table table-sm table-hover align-middle mb-0 small">
                                        <thead class="table-light">
                                            <tr>
                                                <th>Sheet Title</th>
                                                <th>Upload Date</th>
                                                <th class="text-end">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>${prepRows}</tbody>
                                    </table>
                                </div>
                            </div>
                        </div>`;
        })()}
            </div>
        </div>`;
}

/**
 * Updates status for a specific application in a student's applications array
 * @param {string} studentId 
 * @param {string} appId 
 */
export async function updateApplicationStatus(studentId, appId) {
    const selectEl = document.getElementById(`appStatusSelect_${appId}`);
    const alertArea = document.getElementById('appManagerAlert');
    if (!selectEl) return;
    const newStatus = selectEl.value;

    const student = window.loadedStudentsMap ? window.loadedStudentsMap[studentId] : null;
    if (!student) return;

    const apps = getStudentApplications(student);
    let updatedCourseName = '';
    const updatedApps = apps.map(app => {
        if (app.id === appId) {
            updatedCourseName = app.course;
            return { ...app, status: newStatus, statusUpdatedAt: new Date().toISOString() };
        }
        return app;
    });

    try {
        const studentRef = doc(db, 'students', studentId);
        await updateDoc(studentRef, {
            applications: updatedApps,
            applicationStatus: newStatus,
            status: newStatus,
            statusUpdatedAt: new Date().toISOString()
        });

        student.applications = updatedApps;
        student.applicationStatus = newStatus;
        student.status = newStatus;

        console.log(`Updated status of application ${appId} to "${newStatus}" for student ${studentId}`);

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Status Saved!',
                text: `Status for "${updatedCourseName}" updated to "${newStatus}".`,
                icon: 'success',
                confirmButtonColor: '#00ADB5'
            });
        } else {
            alert(`✅ Status for "${updatedCourseName}" updated to "${newStatus}"!`);
        }

        if (alertArea) {
            alertArea.innerHTML = `
                <div class="alert alert-success alert-dismissible fade show py-2 px-3 small mb-3" role="alert">
                    <i class="bi bi-check-circle-fill me-1"></i> Status for <strong>${escapeHtml(updatedCourseName)}</strong> updated to <strong>${escapeHtml(newStatus)}</strong>!
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                </div>`;
        }

        if (document.getElementById('studentsTableBody')) fetchStudents();
        if (document.getElementById('recentApplicationsTableBody') || document.getElementById('totalStudentsKpi')) loadCEODashboardData();

    } catch (error) {
        console.error("Error updating application status:", error);
        if (typeof Swal !== 'undefined') {
            Swal.fire('Error', 'Failed to update status: ' + error.message, 'error');
        } else {
            alert('Failed to update status: ' + error.message);
        }
    }
}
window.updateApplicationStatus = updateApplicationStatus;

/**
 * Removes an application object from a student's applications array
 * @param {string} studentId 
 * @param {string} appId 
 */
export async function deleteApplication(studentId, appId) {
    if (!confirm('Are you sure you want to remove this application record?')) return;
    const student = window.loadedStudentsMap ? window.loadedStudentsMap[studentId] : null;
    if (!student) return;

    const apps = getStudentApplications(student);
    const updatedApps = apps.filter(app => app.id !== appId);

    try {
        const studentRef = doc(db, 'students', studentId);
        await updateDoc(studentRef, { applications: updatedApps });

        student.applications = updatedApps;
        viewStudentDetails(studentId);

        const alertArea = document.getElementById('appManagerAlert');
        if (alertArea) {
            alertArea.innerHTML = `
                <div class="alert alert-warning alert-dismissible fade show py-2 px-3 small mb-3" role="alert">
                    <i class="bi bi-trash me-1"></i> Application removed.
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                </div>`;
        }

        if (document.getElementById('studentsTableBody')) fetchStudents();
        if (document.getElementById('recentApplicationsTableBody') || document.getElementById('totalStudentsKpi')) loadCEODashboardData();

    } catch (error) {
        console.error("Error deleting application:", error);
    }
}

/**
 * Opens a modal displaying full details for a selected student
 * @param {string} studentId 
 */
export function viewStudentDetails(studentId) {
    const student = window.loadedStudentsMap ? window.loadedStudentsMap[studentId] : null;
    console.log("viewStudentProfile() / viewStudentDetails() studentData:", student);

    if (!student) {
        alert("Student record details unavailable.");
        return;
    }

    // Store current studentId for edit operations
    window._currentEditStudentId = studentId;

    const modalTitle = document.getElementById('studentDetailModalTitle');
    const modalBody = document.getElementById('studentDetailModalBody');

    if (modalTitle) modalTitle.innerText = `Record: ${student.personalInfo?.fullName || 'Student Details'}`;

    const hasUnread = hasUnreadStudentMessages(student);
    const unreadBadge = hasUnread
        ? `<span class="badge bg-danger rounded-pill ms-2 animate-pulse" style="font-size: 0.72rem;">New Message</span>`
        : '';

    if (modalBody) {
        modalBody.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-3" id="editProfileBar">
                <span class="badge bg-dark px-3 py-2 small"><i class="bi bi-person-vcard me-1"></i>Student ID: ${studentId.substring(0, 8)}</span>
                <div class="d-flex gap-2">
                    <button class="btn btn-info btn-sm text-white fw-bold px-3 chat-btn shadow-sm" data-email="${escapeHtml(student.personalInfo?.email || studentId)}" data-name="${escapeHtml(student.personalInfo?.fullName || 'Candidate')}" data-bs-toggle="modal" data-bs-target="${document.getElementById('ceoChatModal') ? '#ceoChatModal' : '#employeeChatModal'}" onclick="(window.openCeoChatModal || window.openEmployeeChatModal)('${escapeHtml(student.personalInfo?.email || studentId)}', '${escapeHtml(student.personalInfo?.fullName || 'Candidate')}');">
                        <i class="bi bi-chat-left-text-fill me-1"></i> Live Chat${unreadBadge}
                    </button>
                    <button class="btn btn-outline-danger btn-sm px-3" id="editProfileBtn" onclick="toggleEditMode('${studentId}')">
                        <i class="bi bi-pencil-square me-1"></i> Edit Profile
                    </button>
                    <button class="btn btn-accent text-white btn-sm px-3 shadow-sm" onclick="confirmAndDeleteStudent('${studentId}')" title="Delete Student Record">
                        <i class="bi bi-trash-fill me-1"></i> Delete Student
                    </button>
                </div>
            </div>
            <div id="profileEditAlert"></div>

            ${buildApplicationsManagementSection(studentId, student)}

            <div class="row g-3" id="personalInfoSection">
                <div class="col-md-6">
                    <h6 class="fw-bold text-danger border-bottom pb-2 mb-2"><i class="bi bi-person-lines-fill me-1"></i> Personal Information</h6>
                    <ul class="list-group list-group-flush small">
                        <li class="list-group-item d-flex justify-content-between px-0" data-field="personalInfo.fullName">
                            <span class="text-muted">Full Name:</span>
                            <span class="fw-bold field-display">${escapeHtml(student.personalInfo?.fullName || 'N/A')}</span>
                        </li>
                        <li class="list-group-item d-flex justify-content-between px-0" data-field="personalInfo.email">
                            <span class="text-muted">Email:</span>
                            <span class="field-display">${escapeHtml(student.personalInfo?.email || 'N/A')}</span>
                        </li>
                        <li class="list-group-item d-flex justify-content-between px-0" data-field="personalInfo.contactNo">
                            <span class="text-muted">Contact No:</span>
                            <span class="field-display">${escapeHtml(student.personalInfo?.contactNo || 'N/A')}</span>
                        </li>
                        <li class="list-group-item d-flex justify-content-between px-0" data-field="personalInfo.dob">
                            <span class="text-muted">Date of Birth:</span>
                            <span class="field-display">${escapeHtml(student.personalInfo?.dob || 'N/A')}</span>
                        </li>
                        <li class="list-group-item d-flex justify-content-between px-0" data-field="personalInfo.gender">
                            <span class="text-muted">Gender:</span>
                            <span class="field-display">${escapeHtml(student.personalInfo?.gender || 'N/A')}</span>
                        </li>
                        <li class="list-group-item d-flex justify-content-between px-0" data-field="personalInfo.address">
                            <span class="text-muted">Address:</span>
                            <span class="field-display">${escapeHtml(student.personalInfo?.address || 'N/A')}</span>
                        </li>
                        <li class="list-group-item d-flex justify-content-between px-0" data-field="personalInfo.postCode">
                            <span class="text-muted">Post Code:</span>
                            <span class="field-display">${escapeHtml(student.personalInfo?.postCode || 'N/A')}</span>
                        </li>
                    </ul>
                </div>
                <div class="col-md-6">
                    <h6 class="fw-bold text-danger border-bottom pb-2 mb-2"><i class="bi bi-compass-fill me-1"></i> Preferences &amp; English Test</h6>
                    <ul class="list-group list-group-flush small">
                        <li class="list-group-item d-flex justify-content-between px-0">
                            <span class="text-muted">Target Countries:</span>
                            <span class="fw-bold text-danger">${escapeHtml((student.preferences?.countryChoices || []).join(', ') || 'N/A')}</span>
                        </li>
                        <li class="list-group-item d-flex justify-content-between px-0">
                            <span class="text-muted">Applied Courses:</span>
                            <span>${escapeHtml((student.preferences?.courseChoices || []).join(', ') || 'N/A')}</span>
                        </li>
                        <li class="list-group-item d-flex justify-content-between px-0">
                            <span class="text-muted">Target Universities:</span>
                            <span>${escapeHtml((student.preferences?.universityChoices || []).join(', ') || 'N/A')}</span>
                        </li>
                        <li class="list-group-item d-flex justify-content-between px-0">
                            <span class="text-muted">English Test:</span>
                            <span class="badge bg-dark">${escapeHtml(student.englishProficiency?.testName || 'N/A')} (Overall: ${escapeHtml(student.englishProficiency?.overallScore || 'N/A')})</span>
                        </li>
                    </ul>
                </div>
            </div>
            ${buildDocumentsSection(student, studentId)}`;
    }

    const modalEl = document.getElementById('studentDetailModal');
    if (modalEl && window.bootstrap) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }

    // Attach click handlers for status option grid and save button
    setTimeout(() => {
        const gridBtns = document.querySelectorAll('.status-option-btn');
        const hiddenInput = document.getElementById('selectedStatusValue');
        const saveGridBtn = document.getElementById('saveGridStatusBtn');

        gridBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const clickedStatus = btn.getAttribute('data-status');
                if (hiddenInput) hiddenInput.value = clickedStatus;

                gridBtns.forEach(b => {
                    b.classList.remove('btn-warning', 'text-dark', 'fw-bold', 'shadow-sm', 'active-status-btn');
                    b.classList.add('btn-outline-secondary', 'text-dark');
                });

                btn.classList.remove('btn-outline-secondary');
                btn.classList.add('btn-warning', 'text-dark', 'fw-bold', 'shadow-sm', 'active-status-btn');
            });
        });

        if (saveGridBtn) {
            saveGridBtn.addEventListener('click', async () => {
                const selectedStatus = hiddenInput ? hiddenInput.value : '';
                if (!selectedStatus) {
                    alert('Please select an application status from the grid.');
                    return;
                }

                try {
                    const studentRef = doc(db, 'students', studentId);
                    await updateDoc(studentRef, {
                        applicationStatus: selectedStatus,
                        status: selectedStatus,
                        statusUpdatedAt: new Date().toISOString()
                    });

                    student.applicationStatus = selectedStatus;
                    student.status = selectedStatus;

                    if (typeof Swal !== 'undefined') {
                        Swal.fire({
                            title: 'Status Saved!',
                            text: `Application status updated to "${selectedStatus}".`,
                            icon: 'success',
                            confirmButtonColor: '#00ADB5'
                        });
                    } else {
                        alert(`✅ Application status updated to "${selectedStatus}"!`);
                    }

                    viewStudentDetails(studentId);
                    if (document.getElementById('studentsTableBody')) fetchStudents();
                    if (document.getElementById('recentApplicationsTableBody') || document.getElementById('totalStudentsKpi')) loadCEODashboardData();

                } catch (err) {
                    console.error('Error updating status:', err);
                    alert('Failed to update status: ' + err.message);
                }
            });
        }
    }, 100);
}

/**
 * Toggles the Personal Information section between view mode and edit mode
 * @param {string} studentId 
 */
export function toggleEditMode(studentId) {
    const student = window.loadedStudentsMap ? window.loadedStudentsMap[studentId] : null;
    if (!student) return;

    const editBtn = document.getElementById('editProfileBtn');
    const isEditing = editBtn && editBtn.dataset.editing === 'true';

    // Define which fields are editable and their input types
    const editableFields = {
        'personalInfo.fullName': { label: 'Full Name', type: 'text', value: student.personalInfo?.fullName || '' },
        'personalInfo.email': { label: 'Email', type: 'email', value: student.personalInfo?.email || '' },
        'personalInfo.contactNo': { label: 'Contact No', type: 'tel', value: student.personalInfo?.contactNo || '' },
        'personalInfo.dob': { label: 'Date of Birth', type: 'date', value: student.personalInfo?.dob || '' },
        'personalInfo.gender': { label: 'Gender', type: 'select', value: student.personalInfo?.gender || '', options: ['Male', 'Female', 'Other'] },
        'personalInfo.address': { label: 'Address', type: 'text', value: student.personalInfo?.address || '' },
        'personalInfo.postCode': { label: 'Post Code', type: 'text', value: student.personalInfo?.postCode || '' }
    };

    if (isEditing) {
        // Cancel edit — re-render the modal to reset to static view
        viewStudentDetails(studentId);
        return;
    }

    // Switch to edit mode: transform static text to inputs
    const listItems = document.querySelectorAll('#personalInfoSection li[data-field]');
    listItems.forEach(li => {
        const fieldKey = li.getAttribute('data-field');
        const fieldConfig = editableFields[fieldKey];
        if (!fieldConfig) return;

        const displaySpan = li.querySelector('.field-display');
        if (!displaySpan) return;

        let inputHTML = '';
        if (fieldConfig.type === 'select') {
            const optionsHtml = fieldConfig.options.map(opt =>
                `<option value="${escapeHtml(opt)}" ${opt === fieldConfig.value ? 'selected' : ''}>${escapeHtml(opt)}</option>`
            ).join('');
            inputHTML = `<select class="form-select form-select-sm edit-input" data-field="${fieldKey}" style="max-width: 200px;">${optionsHtml}</select>`;
        } else {
            inputHTML = `<input type="${fieldConfig.type}" class="form-control form-control-sm edit-input" data-field="${fieldKey}" value="${escapeHtml(fieldConfig.value)}" style="max-width: 200px;">`;
        }

        displaySpan.outerHTML = inputHTML;
    });

    // Swap button to Save / Cancel
    if (editBtn) {
        editBtn.dataset.editing = 'true';
        editBtn.outerHTML = `
            <div class="d-flex gap-2">
                <button class="btn btn-success btn-sm px-3" id="saveProfileBtn" onclick="saveProfileChanges('${studentId}')">
                    <i class="bi bi-check-lg me-1"></i> Save Changes
                </button>
                <button class="btn btn-outline-secondary btn-sm px-3" id="cancelEditBtn" onclick="toggleEditMode('${studentId}')">
                    <i class="bi bi-x-lg me-1"></i> Cancel
                </button>
            </div>`;
    }
}

/**
 * Saves edited profile fields to Firestore using dot notation to avoid overwriting nested data
 * @param {string} studentId 
 */
export async function saveProfileChanges(studentId) {
    const student = window.loadedStudentsMap ? window.loadedStudentsMap[studentId] : null;
    if (!student) return;

    const saveBtn = document.getElementById('saveProfileBtn');
    const alertArea = document.getElementById('profileEditAlert');

    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Saving...';
    }

    // Gather updated values from edit inputs
    const editInputs = document.querySelectorAll('.edit-input');
    const updatePayload = {};

    editInputs.forEach(input => {
        const fieldKey = input.getAttribute('data-field'); // e.g., "personalInfo.fullName"
        const newValue = input.value.trim();
        if (fieldKey && newValue !== '') {
            updatePayload[fieldKey] = newValue;
        }
    });

    if (Object.keys(updatePayload).length === 0) {
        if (alertArea) {
            alertArea.innerHTML = `
                <div class="alert alert-warning alert-dismissible fade show py-2 px-3 small mb-3" role="alert">
                    <i class="bi bi-info-circle me-1"></i> No changes detected.
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                </div>`;
        }
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="bi bi-check-lg me-1"></i> Save Changes';
        }
        return;
    }

    try {
        const studentRef = doc(db, 'students', studentId);
        // Use dot notation keys directly — Firestore handles nested updates without overwriting siblings
        await updateDoc(studentRef, updatePayload);

        // Update local memory map to keep in sync
        for (const [dotPath, value] of Object.entries(updatePayload)) {
            const keys = dotPath.split('.');
            let target = student;
            for (let i = 0; i < keys.length - 1; i++) {
                if (!target[keys[i]]) target[keys[i]] = {};
                target = target[keys[i]];
            }
            target[keys[keys.length - 1]] = value;
        }

        console.log(`Profile updated for student ${studentId}:`, updatePayload);

        // Re-render modal with updated data
        viewStudentDetails(studentId);

        // Show success toast after re-render
        const newAlertArea = document.getElementById('profileEditAlert');
        if (newAlertArea) {
            newAlertArea.innerHTML = `
                <div class="alert alert-success alert-dismissible fade show py-2 px-3 small mb-3" role="alert">
                    <i class="bi bi-check-circle-fill me-1"></i> Profile updated successfully!
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                </div>`;
        }

        // Refresh background tables
        if (document.getElementById('studentsTableBody')) fetchStudents();
        if (document.getElementById('recentApplicationsTableBody') || document.getElementById('totalStudentsKpi')) loadCEODashboardData();

    } catch (error) {
        console.error("Error saving profile changes:", error);
        if (alertArea) {
            alertArea.innerHTML = `
                <div class="alert alert-danger alert-dismissible fade show py-2 px-3 small mb-3" role="alert">
                    <i class="bi bi-exclamation-triangle-fill me-1"></i> Failed to save: ${escapeHtml(error.message)}
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                </div>`;
        }
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = '<i class="bi bi-check-lg me-1"></i> Save Changes';
        }
    }
}

/**
 * Creates a new Employee user account using a Secondary Firebase App instance
 * so the CEO remains logged into the primary auth instance.
 * @param {Event} event 
 */
export async function handleAddNewEmployee(event) {
    if (event) event.preventDefault();

    const nameEl = document.getElementById('newEmployeeName');
    const emailEl = document.getElementById('newEmployeeEmail');
    const passwordEl = document.getElementById('newEmployeePassword');
    const alertEl = document.getElementById('addEmployeeAlert');
    const submitBtn = document.getElementById('createEmployeeBtn');

    if (!nameEl || !emailEl || !passwordEl) return;

    const employeeName = nameEl.value.trim();
    const employeeEmail = emailEl.value.trim();
    const employeePassword = passwordEl.value;

    if (alertEl) alertEl.innerHTML = '';

    if (!employeeName || !employeeEmail || !employeePassword) {
        alert('Please fill out all fields.');
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span> Creating Account...';
    }

    try {
        // 1. Initialize or retrieve Secondary App instance
        let secondaryApp;
        if (getApps().some(a => a.name === "SecondaryApp")) {
            secondaryApp = getApp("SecondaryApp");
        } else {
            secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
        }
        const secondaryAuth = getAuth(secondaryApp);

        // 2. Create secondary auth user for new employee
        const userCred = await createUserWithEmailAndPassword(secondaryAuth, employeeEmail, employeePassword);
        const newEmployeeUid = userCred.user.uid;
        console.log("New Employee account created silently on secondaryAuth with UID:", newEmployeeUid);

        // 3. Save new employee user record in Firestore 'users' collection using primary db instance
        await setDoc(doc(db, "users", newEmployeeUid), {
            fullName: employeeName,
            email: employeeEmail,
            role: "employee",
            createdAt: Date.now()
        });

        console.log("Employee role document saved to 'users' collection in Firestore for:", newEmployeeUid);

        // 4. Immediately sign out secondary auth instance
        try {
            await signOut(secondaryAuth);
        } catch (soErr) {
            console.warn("Secondary auth signout notice:", soErr);
        }

        // 5. Success feedback UI & reset form
        if (alertEl) {
            alertEl.innerHTML = `
                <div class="alert alert-success alert-dismissible fade show py-2 small mb-3" role="alert">
                    <i class="bi bi-check-circle-fill me-1"></i> <strong>Employee account created successfully!</strong> Registered for <code>${escapeHtml(employeeEmail)}</code>.
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                </div>`;
        }

        document.getElementById('addEmployeeForm')?.reset();

    } catch (error) {
        console.error("Error creating employee account:", error);
        let msg = "Failed to create employee account.";
        if (error.code === 'auth/email-already-in-use') {
            msg = "This email address is already registered.";
        } else if (error.code === 'auth/weak-password') {
            msg = "Password should be at least 6 characters long.";
        } else if (error.code === 'auth/invalid-email') {
            msg = "Please enter a valid email address.";
        } else if (error.message) {
            msg = error.message.replace("Firebase: ", "");
        }

        if (alertEl) {
            alertEl.innerHTML = `
                <div class="alert alert-danger alert-dismissible fade show py-2 small mb-3" role="alert">
                    <i class="bi bi-exclamation-triangle-fill me-1"></i> ${escapeHtml(msg)}
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                </div>`;
        }
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="bi bi-check-circle-fill me-1"></i> Create Employee Account';
        }
    }
}

/**
 * Expose functions globally for inline HTML event handlers
 */
/**
 * Prompts SweetAlert2 confirmation and deletes student document from Firestore
 * @param {string} studentId 
 */
export async function confirmAndDeleteStudent(studentId) {
    const targetId = studentId || window._currentEditStudentId;
    if (!targetId) {
        alert("No student record selected for deletion.");
        return;
    }

    if (typeof Swal !== 'undefined') {
        const result = await Swal.fire({
            title: 'Delete Student Record?',
            text: 'Are you sure you want to permanently delete this student record? This action cannot be undone.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#E63946',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Yes, Delete Record',
            cancelButtonText: 'Cancel'
        });
        if (!result.isConfirmed) return;
    } else {
        if (!confirm('⚠️ Are you sure you want to permanently delete this student record?')) return;
    }

    try {
        await deleteDoc(doc(db, 'students', targetId));

        // Hide modal if open
        const modalEl = document.getElementById('studentDetailModal');
        if (modalEl && window.bootstrap) {
            const modalInstance = bootstrap.Modal.getInstance(modalEl);
            if (modalInstance) modalInstance.hide();
        }

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Deleted!',
                text: 'Student record has been deleted successfully.',
                icon: 'success',
                confirmButtonColor: '#00ADB5'
            });
        } else {
            alert('✅ Student record deleted successfully.');
        }

        // Refresh background tables
        if (document.getElementById('recentApplicationsTableBody') || document.getElementById('totalStudentsKpi')) {
            loadCEODashboardData();
        }
        if (document.getElementById('studentsTableBody')) {
            fetchStudents();
        }

    } catch (error) {
        console.error('Error deleting student record:', error);
        if (typeof Swal !== 'undefined') {
            Swal.fire('Error', 'Failed to delete student: ' + error.message, 'error');
        } else {
            alert('Failed to delete student: ' + error.message);
        }
    }
}

/**
 * Filter CEO Recent Applications table rows dynamically
 */
export function filterCEOTable() {
    const input = document.getElementById('ceoSearchInput');
    if (!input) return;
    const filter = input.value.toLowerCase().trim();
    const tableBody = document.getElementById('recentApplicationsTableBody');
    if (!tableBody) return;
    const rows = tableBody.getElementsByTagName('tr');

    for (let row of rows) {
        const text = row.textContent.toLowerCase();
        if (text.includes(filter)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    }
}

window.filterCEOTable = filterCEOTable;
window.confirmAndDeleteStudent = confirmAndDeleteStudent;
window.deleteStudentRecord = confirmAndDeleteStudent;
window.handleFirebaseLogin = handleFirebaseLogin;
window.handleFirebaseSignUp = handleFirebaseSignUp;
window.handleForgotPassword = handleForgotPassword;
window.handleLogout = handleLogout;
window.updateHomeNavbarAuthUI = updateHomeNavbarAuthUI;
window.handleAddNewEmployee = handleAddNewEmployee;
window.saveStudentApplication = saveStudentApplication;
window.fetchStudents = fetchStudents;
window.loadCEODashboardData = loadCEODashboardData;
window.viewStudentDetails = viewStudentDetails;
window.updateApplicationStatus = async function (studentId, courseNameOrAppId, newStatusParam) {
    console.log("Updating status in Firestore:", studentId, courseNameOrAppId, newStatusParam);
    const selectEl = document.getElementById(`appStatusSelect_${courseNameOrAppId}`);
    const newStatus = newStatusParam || (selectEl ? selectEl.value : null);
    if (!newStatus) return;

    const student = window.loadedStudentsMap ? window.loadedStudentsMap[studentId] : null;
    if (!student) return;

    const apps = getStudentApplications(student);
    let updatedCourseName = '';
    let found = false;
    const updatedApps = apps.map(app => {
        if (app.id === courseNameOrAppId || app.course === courseNameOrAppId) {
            found = true;
            updatedCourseName = app.course || courseNameOrAppId;
            return { ...app, status: newStatus, statusUpdatedAt: new Date().toISOString() };
        }
        return app;
    });

    if (!found && apps.length === 0) {
        updatedApps.push({
            id: 'app_' + Date.now(),
            course: courseNameOrAppId || 'General Program',
            university: 'Target University',
            country: 'Target Destination',
            intake: 'September 2026',
            status: newStatus,
            createdAt: new Date().toISOString()
        });
        updatedCourseName = courseNameOrAppId || 'General Program';
    }

    try {
        const studentRef = doc(db, 'students', studentId);
        await updateDoc(studentRef, {
            applications: updatedApps,
            applicationStatus: newStatus,
            status: newStatus,
            statusUpdatedAt: new Date().toISOString()
        });

        student.applications = updatedApps;
        student.applicationStatus = newStatus;
        student.status = newStatus;

        console.log(`Successfully updated Firestore document for student ${studentId} to status: "${newStatus}"`);

        if (typeof Swal !== 'undefined') {
            Swal.fire({
                title: 'Status Updated!',
                text: `Application status updated to "${newStatus}".`,
                icon: 'success',
                confirmButtonColor: '#00ADB5'
            });
        } else {
            alert(`✅ Application status updated to "${newStatus}"!`);
        }

        const alertArea = document.getElementById('appManagerAlert');
        if (alertArea) {
            alertArea.innerHTML = `
                <div class="alert alert-success alert-dismissible fade show py-2 px-3 small mb-3" role="alert">
                    <i class="bi bi-check-circle-fill me-1"></i> Status for <strong>${escapeHtml(updatedCourseName)}</strong> updated to <strong>${escapeHtml(newStatus)}</strong>!
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                </div>`;
        }

        if (document.getElementById('studentsTableBody')) fetchStudents();
        if (document.getElementById('recentApplicationsTableBody') || document.getElementById('totalStudentsKpi')) loadCEODashboardData();

    } catch (error) {
        console.error("Error updating application status in Firestore:", error);
        if (typeof Swal !== 'undefined') {
            Swal.fire('Error', 'Failed to update status in database: ' + error.message, 'error');
        } else {
            alert('Failed to update status in database: ' + error.message);
        }
    }
};
window.toggleEditMode = toggleEditMode;
window.saveProfileChanges = saveProfileChanges;
window.approveDocument = approveDocument;



export function openPrepSheetModal(studentId) {
    window._currentPrepSheetStudentId = studentId || window._currentEditStudentId;
    const titleEl = document.getElementById('prepSheetTitle');
    const fileEl = document.getElementById('prepSheetFile');
    const alertEl = document.getElementById('prepSheetAlert');
    if (titleEl) titleEl.value = '';
    if (fileEl) fileEl.value = '';
    if (alertEl) alertEl.innerHTML = '';

    const modalEl = document.getElementById('prepSheetPdfModal');
    if (modalEl && window.bootstrap) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
}
window.openPrepSheetModal = openPrepSheetModal;

export async function uploadPrepSheet(studentId) {
    const targetStudentId = studentId || window._currentPrepSheetStudentId || window._currentEditStudentId;
    const titleInput = document.getElementById('prepSheetTitle');
    const fileInput = document.getElementById('prepSheetFile');
    const alertArea = document.getElementById('prepSheetAlert');
    const uploadBtn = document.getElementById('uploadPrepSheetBtn');

    if (!targetStudentId) {
        alert('Student ID not specified.');
        return;
    }

    if (!titleInput || !fileInput) return;

    const titleVal = titleInput.value.trim();
    const file = fileInput.files ? fileInput.files[0] : null;

    if (!titleVal) {
        if (alertArea) {
            alertArea.innerHTML = `<div class="alert alert-warning py-1.5 px-3 small mb-3"><i class="bi bi-exclamation-triangle-fill me-1"></i> Please enter a document title (e.g. "Sheet 1").</div>`;
        } else {
            alert('Please enter a document title (e.g. "Sheet 1").');
        }
        return;
    }

    if (!file) {
        if (alertArea) {
            alertArea.innerHTML = `<div class="alert alert-warning py-1.5 px-3 small mb-3"><i class="bi bi-exclamation-triangle-fill me-1"></i> Please select a PDF file to upload.</div>`;
        } else {
            alert('Please select a PDF file to upload.');
        }
        return;
    }

    if (uploadBtn) {
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-1" role="status"></span> Uploading...';
    }

    const reader = new FileReader();
    reader.onload = async function (e) {
        const fileUrl = e.target.result;

        const newSheetPayload = {
            id: 'sheet_' + Date.now(),
            title: titleVal,
            url: fileUrl,
            uploadedAt: new Date().toISOString()
        };

        try {
            const studentRef = doc(db, 'students', targetStudentId);
            await updateDoc(studentRef, {
                prepSheets: arrayUnion(newSheetPayload),
                hasUnreadMaterials: true
            });

            // Update local memory map
            const student = window.loadedStudentsMap ? window.loadedStudentsMap[targetStudentId] : null;
            if (student) {
                if (!Array.isArray(student.prepSheets)) student.prepSheets = [];
                student.prepSheets.push(newSheetPayload);
                student.hasUnreadMaterials = true;
            }

            console.log(`Successfully uploaded prep sheet "${titleVal}" for student ${targetStudentId}`);

            titleInput.value = '';
            fileInput.value = '';

            const modalEl = document.getElementById('prepSheetPdfModal');
            if (modalEl && window.bootstrap) {
                const modal = bootstrap.Modal.getInstance(modalEl);
                if (modal) modal.hide();
            }

            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    title: 'Sheet Uploaded!',
                    text: `"${titleVal}" uploaded successfully!`,
                    icon: 'success',
                    confirmButtonColor: '#00ADB5'
                });
            } else {
                alert(`✅ Sheet "${titleVal}" uploaded successfully!`);
            }

            if (targetStudentId) viewStudentDetails(targetStudentId);

            if (document.getElementById('studentsTableBody')) fetchStudents();
            if (document.getElementById('recentApplicationsTableBody') || document.getElementById('totalStudentsKpi')) loadCEODashboardData();

        } catch (error) {
            console.error("Error uploading prep sheet to Firestore:", error);
            if (alertArea) {
                alertArea.innerHTML = `<div class="alert alert-danger py-1.5 px-3 small mb-3"><i class="bi bi-exclamation-triangle-fill me-1"></i> Upload failed: ${escapeHtml(error.message)}</div>`;
            } else {
                alert('Upload failed: ' + error.message);
            }
        } finally {
            if (uploadBtn) {
                uploadBtn.disabled = false;
                uploadBtn.innerHTML = '<i class="bi bi-cloud-upload-fill me-1"></i> Upload Material';
            }
        }
    };

    reader.readAsDataURL(file);
}
window.uploadPrepSheet = uploadPrepSheet;

window.updateDetectedRoleUI = updateDetectedRoleUI;
window.setDemoCredentials = function (email) {
    const emailInput = document.getElementById('emailInput');
    if (emailInput) {
        emailInput.value = email;
        updateDetectedRoleUI();
    }
};



// Global Scroll Reveal Observer
function initScrollReveal() {
    if (typeof IntersectionObserver === 'undefined') {
        document.querySelectorAll('.reveal-on-scroll').forEach(el => el.classList.add('active-reveal'));
        return;
    }

    const observerOptions = {
        root: null,
        rootMargin: '0px 0px -50px 0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active-reveal');
                obs.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.reveal-on-scroll').forEach(el => {
        observer.observe(el);
    });
}

window.initThemeToggle = initThemeToggle;
window.toggleTheme = toggleTheme;
window.initScrollReveal = initScrollReveal;

// Automatically fetch data, initialize theme & scroll reveal animations depending on active page
function runInit() {
    initThemeToggle();
    initScrollReveal();
    if (document.getElementById('studentsTableBody')) {
        fetchStudents();
    }
    if (document.getElementById('recentApplicationsTableBody') || document.getElementById('totalStudentsKpi')) {
        loadCEODashboardData();
    }

    // 🌐 Central Auth State Observer
    onAuthStateChanged(auth, async (user) => {
        // 1. Update Home Page (login.html) navigation
        if (document.getElementById('homeNavbarAuthButtons')) {
            updateHomeNavbarAuthUI(user);
        }

        // 2. Application Form autofill
        if (document.getElementById('applicationForm') && user && user.email) {
            const emailInput = document.getElementById('email');
            if (emailInput && !emailInput.value) {
                emailInput.value = user.email;
            }
        }

        // 3. Update Portal Header greetings if elements exist
        if (user) {
            const ceoNameEl = document.getElementById('navCeoName');
            if (ceoNameEl) {
                ceoNameEl.textContent = user.displayName || user.email?.split('@')[0] || 'CEO';
            }
            const empNameEl = document.getElementById('navEmployeeName');
            if (empNameEl) {
                empNameEl.textContent = user.displayName || user.email?.split('@')[0] || 'Counselor';
            }
        }
    });

    const forgotBtn = document.getElementById('forgotPasswordBtn');
    if (forgotBtn) {
        forgotBtn.addEventListener('click', handleForgotPassword);
    }

    // 🔥 Event Delegation on document for Dynamic View Details Buttons
    if (typeof document !== 'undefined') {
        document.addEventListener('click', (e) => {
            if (!e || !e.target) return;
            const viewBtn = e.target.closest('.view-btn');
            if (!viewBtn) return;

            const studentEmail = viewBtn.getAttribute('data-email') || viewBtn.dataset.id || viewBtn.getAttribute('data-student-id');

            if (typeof window.viewStudentDetails === 'function' && studentEmail) {
                window.viewStudentDetails(studentEmail);
            }
        });
    }
}

// ── Helper Functions for Zero-Dependency Modal Trigger Fallback ───────────
function openModalFallback(targetEl) {
    if (!targetEl) return;
    targetEl.style.display = 'block';
    targetEl.removeAttribute('aria-hidden');
    targetEl.setAttribute('aria-modal', 'true');
    targetEl.classList.add('show');
    document.body.classList.add('modal-open');
    if (!document.querySelector('.modal-backdrop')) {
        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop fade show';
        backdrop.id = 'customModalBackdrop';
        document.body.appendChild(backdrop);
    }
}

function closeModalFallback(targetEl) {
    if (!targetEl) return;
    targetEl.style.display = 'none';
    targetEl.setAttribute('aria-hidden', 'true');
    targetEl.removeAttribute('aria-modal');
    targetEl.classList.remove('show');
    document.body.classList.remove('modal-open');
    const backdrop = document.getElementById('customModalBackdrop') || document.querySelector('.modal-backdrop');
    if (backdrop) backdrop.remove();
}

if (typeof window !== 'undefined') {
    initThemeToggle();
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', runInit);
    } else {
        runInit();
    }
}
