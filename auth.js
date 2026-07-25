// Firebase Authentication & Firestore Module for Newage Education Web Portal
// Modular Firebase SDK v10

import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { 
    getAuth, 
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
    query,
    where,
    orderBy,
    doc,
    updateDoc,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase configuration provided by user
const firebaseConfig = {
  apiKey: "AIzaSyDVawQFjahyoHtE1aDzomcO9EsYmJ3c8fw",
  authDomain: "newage-web.firebaseapp.com",
  projectId: "newage-web",
  storageBucket: "newage-web.firebasestorage.app",
  messagingSenderId: "970795032563",
  appId: "1:970795032563:web:1fa36e6b6ea4c943ebbc86",
  measurementId: "G-17R34MNL2Q"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

let analytics = null;
try {
    analytics = getAnalytics(app);
} catch (e) {
    console.warn("Analytics not enabled in non-browser context or blocked", e);
}

// Initialize Auth and Firestore
export const auth = getAuth(app);
export const db = getFirestore(app);
export { 
    onAuthStateChanged, 
    signOut, 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    where, 
    orderBy, 
    doc, 
    updateDoc, 
    serverTimestamp 
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
        console.log("Firebase Sign In Success:", userCredential.user);
        routeByRole(userCredential.user.email || email);
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
 * Handles Firebase Sign Up
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

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Creating Account...';
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        console.log("Firebase Sign Up Success:", userCredential.user);
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
 * Saves Student Application Form data to Firestore 'students' collection
 * @param {Event} event 
 */
export async function saveStudentApplication(event) {
    event.preventDefault();

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
        const studentData = {
            entryDate: document.getElementById('entryDate')?.value || '',
            personalInfo: {
                fullName: document.getElementById('fullName')?.value || '',
                dob: document.getElementById('dob')?.value || '',
                gender: document.getElementById('gender')?.value || '',
                contactNo: document.getElementById('contactNo')?.value || '',
                email: document.getElementById('email')?.value || '',
                postCode: document.getElementById('postCode')?.value || '',
                address: document.getElementById('address')?.value || ''
            },
            educationalProfile: {
                ssc: {
                    gpa: document.getElementById('sscGpa')?.value || '',
                    passingYear: document.getElementById('sscYear')?.value || '',
                    major: document.getElementById('sscMajor')?.value || ''
                },
                hsc: {
                    gpa: document.getElementById('hscGpa')?.value || '',
                    passingYear: document.getElementById('hscYear')?.value || '',
                    major: document.getElementById('hscMajor')?.value || ''
                },
                bachelor: {
                    cgpa: document.getElementById('bachelorGpa')?.value || '',
                    passingYear: document.getElementById('bachelorYear')?.value || '',
                    major: document.getElementById('bachelorMajor')?.value || ''
                },
                master: {
                    cgpa: document.getElementById('masterGpa')?.value || '',
                    passingYear: document.getElementById('masterYear')?.value || '',
                    major: document.getElementById('masterMajor')?.value || ''
                }
            },
            englishProficiency: {
                testName: document.getElementById('testName')?.value || '',
                testDate: document.getElementById('testDate')?.value || '',
                overallScore: document.getElementById('overallScore')?.value || '',
                sectionScores: {
                    listening: document.getElementById('listeningScore')?.value || '',
                    reading: document.getElementById('readingScore')?.value || '',
                    writing: document.getElementById('writingScore')?.value || '',
                    speaking: document.getElementById('speakingScore')?.value || ''
                }
            },
            preferences: {
                courseChoices: [
                    document.getElementById('courseChoice1')?.value || '',
                    document.getElementById('courseChoice2')?.value || ''
                ].filter(Boolean),
                countryChoices: [
                    document.getElementById('country1')?.value || '',
                    document.getElementById('country2')?.value || '',
                    document.getElementById('country3')?.value || ''
                ].filter(Boolean),
                universityChoices: [
                    document.getElementById('uni1')?.value || '',
                    document.getElementById('uni2')?.value || '',
                    document.getElementById('uni3')?.value || ''
                ].filter(Boolean)
            },
            createdAt: serverTimestamp()
        };

        const docRef = await addDoc(collection(db, "students"), studentData);
        console.log("Student Application Record Saved in Firestore with ID:", docRef.id);

        // ── Auto Student Account Creation (Secondary Auth Instance) ───────────
        const studentEmail = studentData.personalInfo?.email?.trim();
        let accountStatusMsg = "Application Saved Successfully!";

        if (studentEmail) {
            try {
                let secondaryApp;
                if (getApps().some(a => a.name === "SecondaryApp")) {
                    secondaryApp = getApp("SecondaryApp");
                } else {
                    secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
                }
                const secondaryAuth = getAuth(secondaryApp);

                try {
                    await createUserWithEmailAndPassword(secondaryAuth, studentEmail, "Temp@123456");
                    console.log("Student account created silently on secondaryAuth for:", studentEmail);
                    accountStatusMsg = "Application Saved & Account Created! A password setup email has been sent to the student.";
                } catch (createErr) {
                    console.warn("Secondary auth account creation notice:", createErr.code || createErr.message);
                    if (createErr.code === 'auth/email-already-in-use') {
                        accountStatusMsg = "Application Saved! Student account already exists; password reset email dispatched.";
                    } else {
                        accountStatusMsg = `Application Saved! (${createErr.message || 'Account registration note'}).`;
                    }
                } finally {
                    // Dispatch password setup / reset email using primary Auth instance
                    try {
                        await sendPasswordResetEmail(auth, studentEmail);
                        console.log("Password reset email sent to student:", studentEmail);
                    } catch (resetErr) {
                        console.warn("Password reset email error:", resetErr);
                    }

                    // Immediately sign out secondary auth instance
                    try {
                        await signOut(secondaryAuth);
                    } catch (soErr) {
                        console.warn("Secondary auth signout error:", soErr);
                    }
                }
            } catch (secAppErr) {
                console.warn("Secondary app initialization error:", secAppErr);
            }
        }

        if (alertContainer) {
            alertContainer.innerHTML = `
                <div class="alert alert-success alert-dismissible fade show shadow-sm py-3 mb-4" role="alert">
                    <i class="bi bi-check-circle-fill me-2 fs-5 align-middle"></i> 
                    <strong>${accountStatusMsg}</strong> Registered in Firestore database (Ref ID: <code>${docRef.id}</code>).
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                </div>`;
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
                    <strong>Failed to Save Application:</strong> ${error.message || 'Database write error. Please check your internet connection.'}
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
export async function fetchStudents() {
    const tableBody = document.getElementById('studentsTableBody');
    const studentCountBadge = document.getElementById('studentCountBadge');

    if (!tableBody) return;

    tableBody.innerHTML = `
        <tr>
            <td colspan="5" class="text-center py-4 text-muted">
                <span class="spinner-border spinner-border-sm text-danger me-2" role="status" aria-hidden="true"></span>
                Loading student records from Firestore...
            </td>
        </tr>`;

    try {
        let snapshot;
        try {
            const q = query(collection(db, "students"), orderBy("createdAt", "desc"));
            snapshot = await getDocs(q);
        } catch (e) {
            console.warn("Falling back to unordered query for students collection:", e);
            snapshot = await getDocs(collection(db, "students"));
        }

        if (snapshot.empty) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-4 text-muted">
                        <i class="bi bi-folder-x fs-4 d-block mb-1 text-secondary"></i>
                        No student records found in database.
                    </td>
                </tr>`;
            if (studentCountBadge) studentCountBadge.innerText = '0 Records';
            return;
        }

        if (studentCountBadge) studentCountBadge.innerText = `${snapshot.size} Records`;

        let html = '';
        window.loadedStudentsMap = window.loadedStudentsMap || {};

        snapshot.forEach((doc) => {
            const data = doc.data();
            window.loadedStudentsMap[doc.id] = data;

            const fullName = data.personalInfo?.fullName || 'N/A';
            const email = data.personalInfo?.email || 'N/A';
            const primaryCountry = (data.preferences?.countryChoices && data.preferences.countryChoices.length > 0) 
                ? data.preferences.countryChoices[0] 
                : 'N/A';
            const primaryCourse = (data.preferences?.courseChoices && data.preferences.courseChoices.length > 0) 
                ? data.preferences.courseChoices[0] 
                : 'N/A';

            html += `
                <tr>
                    <td>
                        <div class="fw-bold text-dark">${escapeHtml(fullName)}</div>
                        <small class="text-muted" style="font-size: 0.725rem;">Ref: ${doc.id.substring(0, 8)}</small>
                    </td>
                    <td class="text-muted small">${escapeHtml(email)}</td>
                    <td>
                        <span class="badge bg-danger px-2 py-1">${escapeHtml(primaryCountry)}</span>
                    </td>
                    <td class="small fw-semibold text-secondary">${escapeHtml(primaryCourse)}</td>
                    <td>
                        <button class="btn btn-sm btn-dark shadow-sm" onclick="viewStudentDetails('${doc.id}')">
                            <i class="bi bi-eye me-1"></i> View Details
                        </button>
                    </td>
                </tr>`;
        });

        tableBody.innerHTML = html;

    } catch (error) {
        console.error("Error fetching students from Firestore:", error);
        tableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-4 text-danger">
                    <i class="bi bi-exclamation-triangle-fill me-1"></i>
                    Failed to fetch students: ${escapeHtml(error.message || 'Database error')}
                </td>
            </tr>`;
    }
}

/**
 * Loads Firestore data and updates KPIs + Recent Student Applications table on CEO Dashboard
 */
export async function loadCEODashboardData() {
    const kpiEl = document.getElementById('totalStudentsKpi');
    const tableBody = document.getElementById('recentApplicationsTableBody');
    const badgeEl = document.getElementById('ceoStudentCountBadge');

    if (tableBody) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4 text-muted">
                    <span class="spinner-border spinner-border-sm text-danger me-2" role="status" aria-hidden="true"></span>
                    Fetching recent student records from Firestore...
                </td>
            </tr>`;
    }

    try {
        let snapshot;
        try {
            const q = query(collection(db, "students"), orderBy("createdAt", "desc"));
            snapshot = await getDocs(q);
        } catch (e) {
            console.warn("Falling back to unordered query for CEO Dashboard:", e);
            snapshot = await getDocs(collection(db, "students"));
        }

        const count = snapshot.size;

        if (kpiEl) kpiEl.innerText = count.toLocaleString();
        if (badgeEl) badgeEl.innerText = `${count} Records`;

        if (!tableBody) return;

        if (snapshot.empty) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4 text-muted">
                        <i class="bi bi-inbox fs-4 d-block mb-1 text-secondary"></i>
                        No student application records found in database.
                    </td>
                </tr>`;
            return;
        }

        let html = '';
        window.loadedStudentsMap = window.loadedStudentsMap || {};

        snapshot.forEach((doc) => {
            const data = doc.data();
            window.loadedStudentsMap[doc.id] = data;

            const fullName = data.personalInfo?.fullName || 'N/A';
            const email = data.personalInfo?.email || 'N/A';
            const phone = data.personalInfo?.contactNo || 'N/A';
            const primaryCountry = (data.preferences?.countryChoices && data.preferences.countryChoices.length > 0)
                ? data.preferences.countryChoices[0]
                : 'N/A';
            const primaryCourse = (data.preferences?.courseChoices && data.preferences.courseChoices.length > 0)
                ? data.preferences.courseChoices[0]
                : 'N/A';

            html += `
                <tr>
                    <td>
                        <div class="fw-bold text-dark">${escapeHtml(fullName)}</div>
                        <small class="text-muted" style="font-size: 0.725rem;">ID: ${doc.id.substring(0, 8)}</small>
                    </td>
                    <td class="text-muted small">${escapeHtml(email)}</td>
                    <td class="small">${escapeHtml(phone)}</td>
                    <td>
                        <span class="badge bg-danger px-2 py-1">${escapeHtml(primaryCountry)}</span>
                    </td>
                    <td class="small fw-semibold text-secondary">${escapeHtml(primaryCourse)}</td>
                    <td>
                        <button class="btn btn-sm btn-dark shadow-sm" onclick="viewStudentDetails('${doc.id}')">
                            <i class="bi bi-person-lines-fill me-1"></i> View Profile
                        </button>
                    </td>
                </tr>`;
        });

        tableBody.innerHTML = html;

    } catch (error) {
        console.error("Error loading CEO Dashboard data:", error);
        if (kpiEl) kpiEl.innerText = '0';
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-4 text-danger">
                        <i class="bi bi-exclamation-triangle-fill me-1"></i>
                        Failed to load applications: ${escapeHtml(error.message || 'Database error')}
                    </td>
                </tr>`;
        }
    }
}

/**
 * Safely extracts a document URL from studentData by checking multiple possible field locations
 * (e.g. studentData.documents.passport, studentData.passport_url, studentData.transcript_url, etc.)
 * @param {Object} studentData 
 * @param {string} key 
 * @returns {string|null}
 */
function getDocUrl(studentData, key) {
    if (!studentData) return null;
    const docs = studentData.documents || {};

    const candidates = [
        docs[key],
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
        if (cand && typeof cand === 'string' && cand.trim().length > 0) {
            return cand.trim();
        }
    }
    return null;
}

/**
 * Builds the HTML for the Uploaded Documents section inside the student detail modal.
 * Reads from studentData.documents or top-level document URL fields.
 * @param {Object|undefined} studentData - Full student document data from Firestore
 * @returns {string} HTML string
 */
function buildDocumentsSection(studentData) {
    console.log("Building Documents Section for studentData:", studentData);

    const DOC_TYPES = [
        { key: 'ssc_certificate',       label: 'SSC Certificate' },
        { key: 'ssc_marksheet',         label: 'SSC Marksheet / Transcript' },
        { key: 'hsc_certificate',       label: 'HSC Certificate' },
        { key: 'hsc_marksheet',         label: 'HSC Marksheet / Transcript' },
        { key: 'recommendation_letter', label: 'Recommendation Letter' },
        { key: 'passport',              label: 'Passport' },
        { key: 'student_nid',           label: 'Student NID' },
        { key: 'cv',                    label: 'CV / Resume' },
        { key: 'sop',                   label: 'SOP (Statement of Purpose)' },
        { key: 'bank_statement',        label: 'Bank Statement' },
        { key: 'other_documents',       label: 'Other Documents' },
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
        const uploadedAt = docs[`${key}_uploadedAt`]
            ? new Date(docs[`${key}_uploadedAt`]).toLocaleDateString('en-GB')
            : null;

        const statusBadge = url
            ? `<span class="badge bg-success"><i class="bi bi-check-circle-fill me-1"></i>Uploaded</span>`
            : `<span class="badge bg-light text-muted border">Not Uploaded Yet</span>`;

        const actionBtn = url
            ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer"
                  class="btn btn-sm btn-outline-primary py-0 px-2 fw-semibold">
                  <i class="bi bi-file-earmark-text me-1"></i>View Document
               </a>`
            : `<span class="text-muted small fst-italic">Not Uploaded Yet</span>`;

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
            const status = app.status || 'Pending';
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
                        <select id="appStatusSelect_${app.id}" class="form-select form-select-sm small fw-semibold">
                            <option value="Pending" ${status === 'Pending' ? 'selected' : ''}>⏳ Pending</option>
                            <option value="Processing" ${status === 'Processing' ? 'selected' : ''}>⚙️ Processing</option>
                            <option value="Approved" ${status === 'Approved' ? 'selected' : ''}>✅ Approved</option>
                            <option value="Rejected" ${status === 'Rejected' ? 'selected' : ''}>❌ Rejected</option>
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
                            <select id="newAppStatus" class="form-select form-select-sm fw-semibold">
                                <option value="Pending">⏳ Pending</option>
                                <option value="Processing">⚙️ Processing</option>
                                <option value="Approved">✅ Approved</option>
                                <option value="Rejected">❌ Rejected</option>
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
                <div class="table-responsive rounded border bg-white">
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
            </div>
        </div>`;
}

/**
 * Adds a new application object to a student's applications array in Firestore
 * @param {string} studentId 
 */
export async function addNewApplication(studentId) {
    const country = document.getElementById('newAppCountry')?.value.trim();
    const university = document.getElementById('newAppUni')?.value.trim();
    const course = document.getElementById('newAppCourse')?.value.trim();
    const intake = document.getElementById('newAppIntake')?.value.trim() || 'September 2026';
    const course_link = document.getElementById('newAppLink')?.value.trim() || '';
    const status = document.getElementById('newAppStatus')?.value || 'Pending';
    const alertArea = document.getElementById('appManagerAlert');

    if (!country || !university || !course) {
        alert('Please specify Country, University, and Course Name.');
        return;
    }

    const student = window.loadedStudentsMap ? window.loadedStudentsMap[studentId] : null;
    if (!student) return;

    const existingApps = getStudentApplications(student);
    const newAppObj = {
        id: 'app_' + Date.now(),
        country,
        university,
        course,
        intake,
        course_link,
        status,
        createdAt: new Date().toISOString()
    };

    const updatedApps = [...existingApps, newAppObj];

    try {
        const studentRef = doc(db, 'students', studentId);
        await updateDoc(studentRef, {
            applications: updatedApps,
            status: status
        });

        // Update local memory map
        student.applications = updatedApps;
        student.status = status;

        console.log(`Added new application to student ${studentId}:`, newAppObj);

        // Re-render modal view to show updated application table
        viewStudentDetails(studentId);

        const newAlertArea = document.getElementById('appManagerAlert');
        if (newAlertArea) {
            newAlertArea.innerHTML = `
                <div class="alert alert-success alert-dismissible fade show py-2 px-3 small mb-3" role="alert">
                    <i class="bi bi-check-circle-fill me-1"></i> Application for <strong>${escapeHtml(course)} (${escapeHtml(university)})</strong> added successfully!
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                </div>`;
        }

        if (document.getElementById('studentsTableBody')) fetchStudents();
        if (document.getElementById('recentApplicationsTableBody') || document.getElementById('totalStudentsKpi')) loadCEODashboardData();

    } catch (error) {
        console.error("Error adding application:", error);
        if (alertArea) {
            alertArea.innerHTML = `
                <div class="alert alert-danger alert-dismissible fade show py-2 px-3 small mb-3" role="alert">
                    <i class="bi bi-exclamation-triangle-fill me-1"></i> Failed to add application: ${escapeHtml(error.message)}
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                </div>`;
        }
    }
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
            applications: updatedApps
        });

        student.applications = updatedApps;

        console.log(`Updated status of application ${appId} to ${newStatus} for student ${studentId}`);

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
        if (alertArea) {
            alertArea.innerHTML = `
                <div class="alert alert-danger alert-dismissible fade show py-2 px-3 small mb-3" role="alert">
                    <i class="bi bi-exclamation-triangle-fill me-1"></i> Failed to update status: ${escapeHtml(error.message)}
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                </div>`;
        }
    }
}

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
    
    if (modalBody) {
        modalBody.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-3" id="editProfileBar">
                <span class="badge bg-dark px-3 py-2 small"><i class="bi bi-person-vcard me-1"></i>Student ID: ${studentId.substring(0, 8)}</span>
                <button class="btn btn-outline-danger btn-sm px-3" id="editProfileBtn" onclick="toggleEditMode('${studentId}')">
                    <i class="bi bi-pencil-square me-1"></i> Edit Profile
                </button>
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
            ${buildDocumentsSection(student)}`;
    }

    const modalEl = document.getElementById('studentDetailModal');
    if (modalEl && window.bootstrap) {
        const modal = new bootstrap.Modal(modalEl);
        modal.show();
    }
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
 * Expose functions globally for inline HTML event handlers
 */
window.handleFirebaseLogin = handleFirebaseLogin;
window.handleFirebaseSignUp = handleFirebaseSignUp;
window.saveStudentApplication = saveStudentApplication;
window.fetchStudents = fetchStudents;
window.loadCEODashboardData = loadCEODashboardData;
window.viewStudentDetails = viewStudentDetails;
window.viewStudentProfile = viewStudentDetails;
window.addNewApplication = addNewApplication;
window.updateApplicationStatus = updateApplicationStatus;
window.deleteApplication = deleteApplication;
window.toggleEditMode = toggleEditMode;
window.saveProfileChanges = saveProfileChanges;
window.updateDetectedRoleUI = updateDetectedRoleUI;
window.setDemoCredentials = function(email) {
    const emailInput = document.getElementById('emailInput');
    if (emailInput) {
        emailInput.value = email;
        updateDetectedRoleUI();
    }
};

// Automatically fetch data depending on active dashboard
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', () => {
        if (document.getElementById('studentsTableBody')) {
            fetchStudents();
        }
        if (document.getElementById('recentApplicationsTableBody') || document.getElementById('totalStudentsKpi')) {
            loadCEODashboardData();
        }
    });
}
