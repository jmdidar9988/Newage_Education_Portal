// Firebase Authentication & Firestore Module for Newage Education Web Portal
// Modular Firebase SDK v10

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

import { 
    getFirestore, 
    collection, 
    addDoc, 
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
export { collection, addDoc, serverTimestamp };

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
    event.preventDefault();
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
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
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

    // 1. UI Loading state
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Saving...';
    }

    try {
        // 2. Gather full student application record
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

        // 3. Write document to 'students' collection in Firestore
        const docRef = await addDoc(collection(db, "students"), studentData);
        console.log("Student Application Record Saved in Firestore with ID:", docRef.id);

        // 4. UI Success Feedback
        if (alertContainer) {
            alertContainer.innerHTML = `
                <div class="alert alert-success alert-dismissible fade show shadow-sm py-3 mb-4" role="alert">
                    <i class="bi bi-check-circle-fill me-2 fs-5 align-middle"></i> 
                    <strong>Student Application Saved Successfully!</strong> Record registered in Firestore database (Ref ID: <code>${docRef.id}</code>).
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                </div>`;
        }

        // Trigger Bootstrap Toast if active
        const toastEl = document.getElementById('saveToast');
        if (toastEl && window.bootstrap) {
            const toast = new bootstrap.Toast(toastEl);
            toast.show();
        }

        // Reset form fields while preserving current date
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
 * Expose helper functions globally for inline HTML event handlers
 */
window.handleFirebaseLogin = handleFirebaseLogin;
window.handleFirebaseSignUp = handleFirebaseSignUp;
window.saveStudentApplication = saveStudentApplication;
window.updateDetectedRoleUI = updateDetectedRoleUI;
window.setDemoCredentials = function(email) {
    const emailInput = document.getElementById('emailInput');
    if (emailInput) {
        emailInput.value = email;
        updateDetectedRoleUI();
    }
};
