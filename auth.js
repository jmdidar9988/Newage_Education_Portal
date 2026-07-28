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
    getDoc,
    query,
    where,
    orderBy,
    doc,
    setDoc,
    updateDoc,
    serverTimestamp,
    arrayUnion,
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
    serverTimestamp,
    arrayUnion
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

        const user = userCredential.user;
        console.log("Firebase Sign In Success for UID:", user.uid, "Email:", user.email);

        if (submitBtn) {
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Loading Dashboard...';
        }

        // 🔍 Firestore Role Check & Automatic Routing
        try {
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
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
            } else {
                console.log("User doc not found in 'users' collection for UID:", user.uid, "- Defaulting to fallback routing...");
            }
        } catch (docErr) {
            console.warn("Error fetching user document from 'users' collection:", docErr);
        }

        // Fallback for Student / Legacy role check by email domain
        const emailLower = (user.email || email).toLowerCase().trim();
        if (emailLower === 'ceo@newage.com' || emailLower.startsWith('ceo.')) {
            window.location.href = 'index.html';
        } else if (emailLower.includes('employee') || emailLower.includes('counselor')) {
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

        // ── Auto Student Account Creation (Secondary Auth Instance) & Password Setup Email ───
        const studentEmail = studentData.personalInfo?.email?.trim();
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
                        <strong>${escapeHtml(accountStatusMsg)}</strong> Registered in Firestore database (Ref ID: <code>${docRef.id}</code>).<br>
                        <span class="small mt-1 d-block"><i class="bi bi-envelope-check-fill me-1"></i> A password setup link has been dispatched to <strong>${escapeHtml(studentEmail)}</strong>. Please <strong>check your inbox and Spam folder to set your password</strong>.</span>
                        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                    </div>`;
            } else if (emailErrorMessage) {
                alertContainer.innerHTML = `
                    <div class="alert alert-warning alert-dismissible fade show shadow-sm py-3 mb-4" role="alert">
                        <i class="bi bi-exclamation-triangle-fill me-2 fs-5 align-middle"></i> 
                        <strong>${escapeHtml(accountStatusMsg)}</strong> Registered in Firestore database (Ref ID: <code>${docRef.id}</code>).<br>
                        <span class="small mt-1 d-block text-danger"><i class="bi bi-envelope-exclamation-fill me-1"></i> Password reset email error: ${escapeHtml(emailErrorMessage)}. Ensure authorized domain settings in Firebase Console.</span>
                        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                    </div>`;
            } else {
                alertContainer.innerHTML = `
                    <div class="alert alert-success alert-dismissible fade show shadow-sm py-3 mb-4" role="alert">
                        <i class="bi bi-check-circle-fill me-2 fs-5 align-middle"></i> 
                        <strong>${escapeHtml(accountStatusMsg)}</strong> Registered in Firestore database (Ref ID: <code>${docRef.id}</code>).
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
 * Helper to check if student has unread messages sent by 'Student' safely
 */
function hasUnreadStudentMessages(studentData) {
    if (!studentData) return false;
    const msgs = Array.isArray(studentData.messages) ? studentData.messages : [];
    if (msgs.length === 0) return false;
    const lastMsg = msgs[msgs.length - 1];
    return Boolean(lastMsg && lastMsg.sender === 'Student' && lastMsg.isRead !== true);
}

/**
 * Marks messages sent by a specific role as read in Firestore
 */
export async function markMessagesAsRead(studentId, unreadSender = 'Student') {
    const student = window.loadedStudentsMap ? window.loadedStudentsMap[studentId] : null;
    if (!student || !Array.isArray(student.messages)) return;

    let updated = false;
    const updatedMessages = student.messages.map(m => {
        if (m.sender === unreadSender && m.isRead !== true) {
            updated = true;
            return { ...m, isRead: true };
        }
        return m;
    });

    if (updated) {
        try {
            const studentRef = doc(db, 'students', studentId);
            await updateDoc(studentRef, { messages: updatedMessages });
            student.messages = updatedMessages;
            console.log(`Marked ${unreadSender} messages as read for student ${studentId}`);
            if (document.getElementById('studentsTableBody')) fetchStudents();
            if (document.getElementById('recentApplicationsTableBody')) loadCEODashboardData();
        } catch (err) {
            console.error("Error marking messages as read:", err);
        }
    }
}



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

/**
 * Fetches all student records from Firestore 'students' collection and renders them dynamically for Employee Portal
 */
export async function fetchStudents() {
    const tableBody = document.getElementById('studentsTableBody');
    const studentCountBadge = document.getElementById('studentCountBadge');

    if (!tableBody) return;

    // Show skeleton loaders before data arrives
    tableBody.innerHTML = getSkeletonRowsHTML(6, 5);

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
            renderFallbackStudents(tableBody, studentCountBadge);
            return;
        }

        if (studentCountBadge) studentCountBadge.innerText = `${snapshot.size} Records`;

        const studentItems = [];
        window.loadedStudentsMap = window.loadedStudentsMap || {};

        snapshot.forEach((doc) => {
            const data = doc.data();
            window.loadedStudentsMap[doc.id] = data;
            studentItems.push({ id: doc.id, data });
        });

        // Sort students: Most recent message appears at the top
        studentItems.sort((a, b) => getLatestMessageTime(b.data) - getLatestMessageTime(a.data));

        let html = '';
        studentItems.forEach(({ id, data }) => {
            const fullName = data.personalInfo?.fullName || 'N/A';
            const email = data.personalInfo?.email || 'N/A';
            const phone = data.personalInfo?.contactNo || 'N/A';
            const primaryCountry = (data.preferences?.countryChoices && data.preferences.countryChoices.length > 0)
                ? data.preferences.countryChoices[0]
                : 'N/A';
            const primaryCourse = (data.preferences?.courseChoices && data.preferences.courseChoices.length > 0)
                ? data.preferences.courseChoices[0]
                : 'N/A';

            const unread = hasUnreadStudentMessages(data);
            const chatBtnHTML = unread
                ? `<button class="btn btn-sm btn-outline-danger position-relative py-1 px-2.5 rounded-3" onclick="openStudentChat('${id}')" title="Unread student message!">
                      <i class="bi bi-chat-left-text-fill"></i>
                      <span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger" style="font-size: 0.55rem;">!</span>
                   </button>`
                : `<button class="btn btn-sm btn-outline-secondary py-1 px-2.5 rounded-3" onclick="openStudentChat('${id}')" title="Chat with student">
                      <i class="bi bi-chat-left-text-fill"></i>
                   </button>`;

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
                            <button class="btn btn-sm btn-navy py-1 px-2.5 rounded-3" onclick="viewStudentDetails('${id}')" title="View Full Profile">
                                <i class="bi bi-eye-fill me-1"></i> View
                            </button>
                            ${chatBtnHTML}
                        </div>
                    </td>
                </tr>`;
        });

        tableBody.innerHTML = html;

    } catch (error) {
        console.error("Firestore Loading Error:", error);
        renderFallbackStudents(tableBody, studentCountBadge);
    }
}

function renderFallbackStudents(tableBody, studentCountBadge) {
    if (!tableBody) return;

    const sampleStudents = [
        {
            id: "std_sakib_01",
            data: {
                personalInfo: { fullName: "Sakib Rahman", email: "sakib@gmail.com", contactNo: "+880 1712-345678" },
                preferences: { countryChoices: ["UK"], courseChoices: ["MSc Computer Science"] }
            }
        },
        {
            id: "std_amina_02",
            data: {
                personalInfo: { fullName: "Amina Begum", email: "amina@gmail.com", contactNo: "+880 1819-876543" },
                preferences: { countryChoices: ["Canada"], courseChoices: ["MBA International Business"] }
            }
        },
        {
            id: "std_zayd_03",
            data: {
                personalInfo: { fullName: "Zayd Al-Amin", email: "zayd@gmail.com", contactNo: "+880 1911-223344" },
                preferences: { countryChoices: ["Australia"], courseChoices: ["Bachelor of Data Science"] }
            }
        }
    ];

    window.loadedStudentsMap = window.loadedStudentsMap || {};
    sampleStudents.forEach(s => window.loadedStudentsMap[s.id] = s.data);

    if (studentCountBadge) studentCountBadge.innerText = `${sampleStudents.length} Records`;

    let html = '';
    sampleStudents.forEach(({ id, data }) => {
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
                        <button class="btn btn-sm btn-navy py-1 px-2.5 rounded-3" onclick="viewStudentDetails('${id}')" title="View Full Profile">
                            <i class="bi bi-eye-fill me-1"></i> View
                        </button>
                        <button class="btn btn-sm btn-outline-secondary py-1 px-2.5 rounded-3" onclick="openStudentChat('${id}')" title="Chat with student">
                            <i class="bi bi-chat-left-text-fill"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
    });
    tableBody.innerHTML = html;
}

/**
 * Loads Firestore data and updates KPIs + Recent Student Applications table on CEO Dashboard
 */
export async function loadCEODashboardData() {
    const kpiEl = document.getElementById('totalStudentsKpi');
    const tableBody = document.getElementById('recentApplicationsTableBody');
    const badgeEl = document.getElementById('ceoStudentCountBadge');

    if (tableBody) {
        // Show skeleton loaders before data arrives
        tableBody.innerHTML = getSkeletonRowsHTML(6, 5);
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

        const studentItems = [];
        window.loadedStudentsMap = window.loadedStudentsMap || {};

        snapshot.forEach((doc) => {
            const data = doc.data();
            window.loadedStudentsMap[doc.id] = data;
            studentItems.push({ id: doc.id, data });
        });

        window.lastLoadedStudentItems = studentItems;

        // Render Chart.js Analytics
        renderCEOAnalyticsCharts(studentItems);

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

        // 🟢 Sort students: Most recent message appears at top
        studentItems.sort((a, b) => getLatestMessageTime(b.data) - getLatestMessageTime(a.data));

        let html = '';
        studentItems.forEach(({ id, data }) => {
            const fullName = data.personalInfo?.fullName || 'N/A';
            const email = data.personalInfo?.email || 'N/A';
            const phone = data.personalInfo?.contactNo || 'N/A';
            const primaryCountry = (data.preferences?.countryChoices && data.preferences.countryChoices.length > 0)
                ? data.preferences.countryChoices[0]
                : 'N/A';
            const primaryCourse = (data.preferences?.courseChoices && data.preferences.courseChoices.length > 0)
                ? data.preferences.courseChoices[0]
                : 'N/A';

            const unread = hasUnreadStudentMessages(data);
            const chatBtnHTML = unread
                ? `<button class="btn btn-sm btn-outline-danger shadow-sm ms-1 position-relative" onclick="openStudentChat('${id}')" title="Unread student message!">
                      <i class="bi bi-chat-left-text-fill me-1"></i>Chat
                      <span class="badge bg-danger rounded-pill ms-1">New</span>
                   </button>`
                : `<button class="btn btn-sm btn-outline-secondary shadow-sm ms-1" onclick="openStudentChat('${id}')" title="Chat with student">
                      <i class="bi bi-chat-left-text me-1"></i>Chat
                   </button>`;

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
                        <button class="btn btn-sm btn-navy shadow-sm" onclick="viewStudentDetails('${id}')">
                            <i class="bi bi-person-lines-fill me-1"></i> View Profile
                        </button>
                        ${chatBtnHTML}
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

    if (modalBody) {
        modalBody.innerHTML = `
            <div class="d-flex justify-content-between align-items-center mb-3" id="editProfileBar">
                <span class="badge bg-dark px-3 py-2 small"><i class="bi bi-person-vcard me-1"></i>Student ID: ${studentId.substring(0, 8)}</span>
                <div class="d-flex gap-2">
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

window.sendConsultantReply = async function (studentId) {
    console.log("sendConsultantReply triggered for student:", studentId);
    const inputEl = document.getElementById(`modalChatInput_${studentId}`);
    const alertEl = document.getElementById(`modalChatAlert_${studentId}`);
    if (!inputEl) return;
    const text = inputEl.value.trim();
    if (!text) {
        alert('Please enter a message before replying.');
        return;
    }

    const student = window.loadedStudentsMap ? window.loadedStudentsMap[studentId] : null;
    if (!student) return;

    const newMsg = {
        id: 'msg_' + Date.now(),
        sender: 'Consultant',
        text: text,
        timestamp: new Date().toISOString(),
        isRead: false
    };

    try {
        const studentRef = doc(db, 'students', studentId);
        await updateDoc(studentRef, {
            messages: arrayUnion(newMsg)
        });

        if (!Array.isArray(student.messages)) student.messages = [];
        student.messages.push(newMsg);

        console.log(`Consultant reply sent to student ${studentId}:`, newMsg);
        viewStudentDetails(studentId);

        setTimeout(() => {
            const chatBox = document.getElementById(`modalChatHistory_${studentId}`);
            if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
        }, 100);

    } catch (error) {
        console.error("Error sending consultant reply:", error);
        if (alertEl) {
            alertEl.innerHTML = `<div class="alert alert-danger py-1 px-2 small mb-2"><i class="bi bi-exclamation-triangle-fill me-1"></i> Failed to send: ${escapeHtml(error.message)}</div>`;
        }
    }
};

window.markMessagesAsRead = function (studentId) {
    console.log("markMessagesAsRead triggered for student:", studentId);
};

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

/* ==========================================================================
   REAL-TIME FIRESTORE CHAT MODULE (COUNSELOR & CANDIDATE)
   ========================================================================== */

let activeChatUnsubscribe = null;
let studentChatUnsubscribe = null;

/**
 * Initializes real-time Student Chat on candidate portal (student.html)
 */
export async function initStudentChat(targetStudentId) {
    const studentId = targetStudentId || window._currentStudentId || 'std_sakib_01';
    window._currentStudentId = studentId;

    const chatPath = `students/${studentId}`;
    console.log("🟢 [Student Chat] Listening to chat path:", chatPath);

    const historyEl = document.getElementById('studentChatHistory');
    if (!historyEl) return;

    try {
        const studentRef = doc(db, "students", studentId);

        // Unsubscribe previous if any
        if (studentChatUnsubscribe) {
            studentChatUnsubscribe();
            studentChatUnsubscribe = null;
        }

        studentChatUnsubscribe = onSnapshot(studentRef, (docSnap) => {
            if (!docSnap.exists()) {
                console.warn("⚠️ [Student Chat] Document not found at path:", chatPath);
                renderStudentChatMessages(historyEl, []);
                return;
            }

            const data = docSnap.data();
            const messages = Array.isArray(data.messages) ? data.messages : [];
            console.log(`💬 [Student Chat] Snapshot received from ${chatPath}. Messages count: ${messages.length}`);
            renderStudentChatMessages(historyEl, messages);

            // Clear unread counselor badge when student reads chat
            if (data.hasUnreadCounselorMessage) {
                updateDoc(studentRef, { hasUnreadCounselorMessage: false }).catch(() => {});
            }
        }, (error) => {
            console.error("❌ [Student Chat] Firestore subscription error for path " + chatPath + ":", error);
            renderStudentChatMessages(historyEl, getFallbackChatMessages(studentId));
        });

    } catch (err) {
        console.error("❌ [Student Chat] Error setting up listener for path " + chatPath + ":", err);
        renderStudentChatMessages(historyEl, getFallbackChatMessages(studentId));
    }
}

function renderStudentChatMessages(historyEl, messages) {
    if (!historyEl) return;

    if (!messages || messages.length === 0) {
        historyEl.innerHTML = `
            <div class="d-flex flex-column gap-2" id="studentChatMessages">
                <div class="p-2.5 rounded-3 bg-light text-dark border small align-self-start shadow-sm" style="max-width: 85%;">
                    <div class="fw-bold text-danger mb-0.5" style="font-size: 0.75rem;"><i class="bi bi-person-badge-fill me-1"></i> Kabir Hossain (Senior Counselor)</div>
                    Hello! Welcome to Newage Education. How can I assist you with your university application and visa documents today?
                    <div class="text-muted text-end mt-1" style="font-size: 0.65rem;">10:00 AM</div>
                </div>
            </div>`;
        return;
    }

    let html = '<div class="d-flex flex-column gap-2" id="studentChatMessages">';
    messages.forEach(msg => {
        const isStudent = msg.sender === 'Student';
        const bgClass = isStudent ? 'bg-danger text-white align-self-end shadow-sm' : 'bg-light text-dark border align-self-start shadow-sm';
        const senderLabel = isStudent ? 'You (Student Candidate)' : (msg.senderName || 'Kabir Hossain (Senior Counselor)');
        const timeStr = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

        html += `
            <div class="p-2.5 rounded-3 ${bgClass}" style="max-width: 85%;">
                <div class="fw-bold mb-0.5" style="font-size: 0.75rem; color: ${isStudent ? '#ffffff' : '#e63946'};">
                    <i class="bi ${isStudent ? 'bi-person-fill' : 'bi-person-badge-fill'} me-1"></i>${escapeHtml(senderLabel)}
                </div>
                <div style="font-size: 0.875rem;">${escapeHtml(msg.text || '')}</div>
                <div class="${isStudent ? 'text-white-50' : 'text-muted'} text-end mt-1" style="font-size: 0.65rem;">${timeStr}</div>
            </div>`;
    });
    html += '</div>';

    historyEl.innerHTML = html;
    historyEl.scrollTop = historyEl.scrollHeight;
}

/**
 * Student Candidate sends message to Counselor via Firestore
 */
export async function sendStudentMessage(event) {
    if (event) event.preventDefault();
    const msgInput = document.getElementById('counselorMessage');
    const sendBtn = document.getElementById('sendMsgBtn');

    if (!msgInput) return;
    const text = msgInput.value.trim();
    if (!text) return;

    const studentId = window._currentStudentId || 'std_sakib_01';
    const chatPath = `students/${studentId}`;
    console.log(`📤 [Student Chat] Sending candidate message to path ${chatPath}: "${text}"`);

    if (sendBtn) sendBtn.disabled = true;

    const newMsgPayload = {
        id: 'msg_' + Date.now(),
        sender: 'Student',
        senderName: 'Sakib Rahman (Candidate)',
        text: text,
        timestamp: new Date().toISOString()
    };

    try {
        const studentRef = doc(db, "students", studentId);
        await updateDoc(studentRef, {
            messages: arrayUnion(newMsgPayload),
            hasUnreadStudentMessage: true
        });

        console.log(`✅ [Student Chat] Candidate message successfully written to Firestore path ${chatPath}`);
        msgInput.value = '';

    } catch (error) {
        console.error(`❌ [Student Chat] Firestore write error for path ${chatPath}:`, error);
        const historyEl = document.getElementById('studentChatHistory');
        if (historyEl) {
            let msgList = document.getElementById('studentChatMessages') || historyEl;
            const bubble = document.createElement('div');
            bubble.className = 'p-2.5 rounded-3 bg-danger text-white small align-self-end shadow-sm mb-2';
            bubble.style.maxWidth = '85%';
            bubble.innerHTML = `
                <div class="fw-bold mb-0.5" style="font-size: 0.75rem;">You (Student Candidate)</div>
                <div>${escapeHtml(text)}</div>
                <div class="text-white-50 text-end mt-1" style="font-size: 0.65rem;">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>`;
            msgList.appendChild(bubble);
            historyEl.scrollTop = historyEl.scrollHeight;
        }
        msgInput.value = '';
    } finally {
        if (sendBtn) sendBtn.disabled = false;
    }
}

/**
 * Opens Counselor Employee Chat Modal for a student candidate and listens to Firestore updates
 */
export async function openStudentChat(studentId) {
    const chatPath = `students/${studentId}`;
    console.log("Attempting to fetch chat for student:", studentId);
    console.log("🟢 [Employee Chat] Listening to chat path:", chatPath);
    if (!studentId) {
        console.warn("⚠️ [Employee Chat] Aborted: studentId is undefined or empty!");
        return;
    }

    window._activeChatStudentId = studentId;

    // Verify DOM Targets
    const modalEl = document.getElementById('employeeChatModal');
    const titleEl = document.getElementById('employeeChatModalTitle');
    const chatBox = document.getElementById('employeeChatBox') || document.getElementById('employeeChatHistory');

    console.log("🔍 [Employee Chat] DOM Check -> Modal:", !!modalEl, "Title:", !!titleEl, "ChatBox:", !!chatBox);

    if (modalEl && window.bootstrap) {
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
        modal.show();
    }

    if (chatBox) {
        chatBox.style.display = 'block';
        chatBox.style.zIndex = '9999';
        chatBox.innerHTML = `
            <div class="text-center text-muted py-4 small">
                <span class="spinner-border spinner-border-sm text-danger me-1"></span> Loading conversation with Firestore...
            </div>`;
    }

    try {
        const studentRef = doc(db, "students", studentId);
        
        // Clear unread student message flag on open
        await updateDoc(studentRef, { hasUnreadStudentMessage: false }).catch(() => {});

        // Unsubscribe existing listener if any
        if (activeChatUnsubscribe) {
            activeChatUnsubscribe();
            activeChatUnsubscribe = null;
        }

        // Attach real-time Firestore listener with explicit Security Rules error handler
        activeChatUnsubscribe = onSnapshot(studentRef, (docSnap) => {
            if (!docSnap.exists()) {
                console.warn("⚠️ [Employee Chat] Student document not found at path:", chatPath);
                renderEmployeeChatMessages(studentId, chatBox, titleEl, getFallbackChatMessages(studentId), 'Student Candidate');
                return;
            }

            const data = docSnap.data();
            console.log("Data keys:", Object.keys(data));

            let messages = [];
            if (Array.isArray(data.messages)) {
                messages = data.messages;
            } else if (Array.isArray(data.chatHistory)) {
                messages = data.chatHistory;
            } else if (Array.isArray(data.chat)) {
                messages = data.chat;
            } else if (data.text || data.message || data.msg) {
                messages = [data];
            }

            const fullName = data.personalInfo?.fullName || data.fullName || 'Student Candidate';

            console.log("Snapshot received. Total messages:", messages.length);
            console.log(`💬 [Employee Chat] Snapshot received from ${chatPath}. Messages count: ${messages.length}`);

            renderEmployeeChatMessages(studentId, chatBox, titleEl, messages, fullName);
        }, (error) => {
            console.error("Firebase Chat Sync Error (Check Security Rules):", error.message);
            console.error("❌ [Employee Chat] Firestore chat subscription error for path " + chatPath + ":", error);
            renderEmployeeChatMessages(studentId, chatBox, titleEl, getFallbackChatMessages(studentId), 'Student Candidate');
        });

    } catch (err) {
        console.error("❌ [Employee Chat] Error opening student chat for path " + chatPath + ":", err);
        renderEmployeeChatMessages(studentId, chatBox, titleEl, getFallbackChatMessages(studentId), 'Student Candidate');
    }
}

function renderEmployeeChatMessages(studentId, historyEl, titleEl, messages, studentName) {
    const chatBox = document.getElementById('employeeChatBox') || document.getElementById('employeeChatHistory') || historyEl;
    const targetTitle = document.getElementById('employeeChatModalTitle') || titleEl;

    if (targetTitle) {
        targetTitle.innerHTML = `<i class="bi bi-chat-left-text-fill text-danger me-2"></i>Chat with ${escapeHtml(studentName || 'Candidate')} <span class="badge bg-secondary rounded-pill ms-2" style="font-size: 0.7rem;">ID: #${studentId ? studentId.substring(0, 8) : 'CLIENT'}</span>`;
    }

    if (!chatBox) {
        console.error("CRITICAL: Chat box HTML element is still missing!");
        return;
    }

    // Force Visibility (CSS)
    chatBox.style.display = 'block';
    chatBox.style.zIndex = '9999';

    if (!messages || messages.length === 0) {
        chatBox.innerHTML = `
            <div class="text-center text-muted py-5 small">
                <i class="bi bi-chat-dots fs-2 text-secondary d-block mb-2"></i>
                No message history yet. Type a message below to start chatting with ${escapeHtml(studentName || 'the candidate')}.
            </div>`;
        return;
    }

    chatBox.innerHTML = ""; // Clear old contents

    let html = '<div class="d-flex flex-column gap-2.5 p-1" id="employeeChatBubbleWrapper">';
    messages.forEach(msg => {
        // Hard-wired Field Normalization & Fallbacks
        const textContent = (typeof msg === 'string')
            ? msg
            : (msg.text || msg.message || msg.msg || msg.content || "Empty message");

        const sender = (typeof msg === 'object' && (msg.sender || msg.role || msg.senderRole))
            ? (msg.sender || msg.role || msg.senderRole)
            : 'Student';

        const isCounselor = sender === 'Counselor' || sender === 'Employee' || sender === 'Consultant';
        const bgClass = isCounselor ? 'bg-danger text-white align-self-end shadow-sm' : 'bg-white text-dark border align-self-start shadow-sm';
        const senderLabel = isCounselor
            ? (msg.senderName || msg.author || 'Kabir Hossain (Counselor)')
            : (msg.senderName || studentName || 'Student Candidate');

        const rawTime = msg.timestamp || msg.createdAt || msg.time;
        const timeStr = rawTime ? new Date(rawTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

        html += `
            <div class="p-2.5 rounded-3 ${bgClass}" style="max-width: 85%;">
                <div class="fw-bold mb-1" style="font-size: 0.75rem; color: ${isCounselor ? '#ffffff' : '#e63946'};">
                    <i class="bi ${isCounselor ? 'bi-person-badge-fill' : 'bi-person-fill'} me-1"></i>${escapeHtml(senderLabel)}
                </div>
                <div style="font-size: 0.875rem; word-break: break-word;">${escapeHtml(textContent)}</div>
                <div class="mt-1 text-end" style="font-size: 0.65rem; opacity: 0.8;">${timeStr}</div>
            </div>`;
    });
    html += '</div>';

    chatBox.insertAdjacentHTML('beforeend', html);

    // Auto-scroll to bottom of chat container
    chatBox.scrollTop = chatBox.scrollHeight;
}

/**
 * Counselor sends reply to student candidate
 */
export async function sendEmployeeReply(event) {
    if (event) event.preventDefault();
    const studentId = window._activeChatStudentId;
    const inputEl = document.getElementById('employeeReplyInput');
    const sendBtn = document.getElementById('employeeSendBtn');

    if (!studentId || !inputEl) return;
    const text = inputEl.value.trim();
    if (!text) return;

    const chatPath = `students/${studentId}`;
    console.log(`📤 [Employee Chat] Counselor sending reply to path ${chatPath}: "${text}"`);

    if (sendBtn) sendBtn.disabled = true;

    const newMsgPayload = {
        id: 'msg_' + Date.now(),
        sender: 'Counselor',
        senderName: 'Kabir Hossain (Senior Counselor)',
        text: text,
        timestamp: new Date().toISOString()
    };

    try {
        const studentRef = doc(db, "students", studentId);
        await updateDoc(studentRef, {
            messages: arrayUnion(newMsgPayload),
            hasUnreadCounselorMessage: true
        });

        console.log(`✅ [Employee Chat] Counselor reply successfully written to Firestore path ${chatPath}`);
        inputEl.value = '';

    } catch (error) {
        console.error(`❌ [Employee Chat] Error sending counselor reply to Firestore path ${chatPath}:`, error);
        const targetBox = document.getElementById('employeeChatHistory');
        if (targetBox) {
            let listEl = document.getElementById('employeeChatBubbleWrapper');
            if (!listEl) {
                targetBox.innerHTML = '<div class="d-flex flex-column gap-2.5 p-1" id="employeeChatBubbleWrapper"></div>';
                listEl = document.getElementById('employeeChatBubbleWrapper');
            }
            const bubble = document.createElement('div');
            bubble.className = 'p-2.5 rounded-3 bg-danger text-white align-self-end shadow-sm mb-2';
            bubble.style.maxWidth = '85%';
            bubble.innerHTML = `
                <div class="fw-bold mb-1" style="font-size: 0.75rem;"><i class="bi bi-person-badge-fill me-1"></i> Kabir Hossain (Counselor)</div>
                <div style="font-size: 0.875rem; word-break: break-word;">${escapeHtml(text)}</div>
                <div class="mt-1 text-end" style="font-size: 0.65rem; opacity: 0.8;">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>`;
            listEl.appendChild(bubble);
            targetBox.scrollTop = targetBox.scrollHeight;
        }
        inputEl.value = '';
    } finally {
        if (sendBtn) sendBtn.disabled = false;
    }
}

function getFallbackChatMessages(studentId) {
    return [
        {
            id: 'msg_sample_1',
            sender: 'Student',
            senderName: 'Sakib Rahman',
            text: 'Hello Kabir Sir! I have submitted my passport scan and IELTS TRF copy.',
            timestamp: new Date(Date.now() - 3600000).toISOString()
        },
        {
            id: 'msg_sample_2',
            sender: 'Counselor',
            senderName: 'Kabir Hossain (Senior Counselor)',
            text: 'Great Sakib! I am reviewing your documents for the offer letter application now.',
            timestamp: new Date(Date.now() - 1800000).toISOString()
        }
    ];
}

window.initStudentChat = initStudentChat;
window.sendStudentMessage = sendStudentMessage;
window.openStudentChat = openStudentChat;
window.sendEmployeeReply = sendEmployeeReply;

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
    if (document.getElementById('studentChatHistory')) {
        initStudentChat();
    }
}

if (typeof window !== 'undefined') {
    initThemeToggle();
    if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', runInit);
    } else {
        runInit();
    }
}
