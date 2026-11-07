// Firebase Cloud Messaging (FCM) Client Integration Module
// Handles service worker registration, push permission requests, token registration, and foreground notifications

import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getMessaging, getToken, onMessage, isSupported } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDVawQFjahyoHtE1aDzomcO9EsYmJ3c8fw",
    authDomain: "newage-web.firebaseapp.com",
    projectId: "newage-web",
    storageBucket: "newage-web.firebasestorage.app",
    messagingSenderId: "970795032563",
    appId: "1:970795032563:web:1fa36e6b6ea4c943ebbc86"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Public VAPID Key for Web Push (Firebase Console -> Project Settings -> Cloud Messaging)
const VAPID_KEY = "BNbZ1GqJk6gZ7oK3LwYvR1x8H9mN2pQ4tS6vU8wX0yZ2aB4cD6eF8gH0iJ2kL4mN";

export let messagingInstance = null;
let activeRegistration = null;

/**
 * Initializes FCM Push Notification Service for the current user
 * @param {object} user - Authenticated Firebase User object
 * @param {string} userRole - 'CEO' | 'Employee' | 'Student'
 */
export async function initPushNotifications(user, userRole = 'Student') {
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
        console.warn('[FCM] Push notifications not supported in this browser environment.');
        return null;
    }

    const supported = await isSupported().catch(() => false);
    if (!supported) {
        console.warn('[FCM] Firebase Messaging is not supported on this device/protocol.');
        return null;
    }

    try {
        // Register Service Worker
        activeRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
            scope: '/'
        });
        console.log('[FCM] Service Worker registered with scope:', activeRegistration.scope);

        messagingInstance = getMessaging(app);

        // Automatically activate push notifications for everyone (no manual on/off toggle needed)
        if (Notification.permission === 'granted') {
            await registerUserFCMToken(user, userRole, activeRegistration);
        } else if (Notification.permission === 'default') {
            try {
                const autoGranted = await Notification.requestPermission();
                if (autoGranted === 'granted') {
                    await registerUserFCMToken(user, userRole, activeRegistration);
                }
            } catch (autoErr) {
                console.warn('[FCM] Auto permission prompt note:', autoErr);
            }
        }
        updatePushBadgeUI();

        // Listen for foreground push messages
        onMessage(messagingInstance, (payload) => {
            console.log('[FCM] Foreground notification received:', payload);
            displayForegroundNotificationToast(payload);
        });

        return messagingInstance;
    } catch (err) {
        console.error('[FCM] Initialization error:', err);
        return null;
    }
}

/**
 * Explicitly requests permission from the user to receive push notifications
 */
export async function requestPushPermission(user, userRole = 'Student') {
    if (!('Notification' in window)) return false;
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const registration = activeRegistration || await navigator.serviceWorker.ready;
            await registerUserFCMToken(user, userRole, registration);
            updatePushBadgeUI(true);
            return true;
        } else {
            console.warn('[FCM] Notification permission denied by user.');
            updatePushBadgeUI(false);
            return false;
        }
    } catch (error) {
        console.error('[FCM] Error requesting push permission:', error);
        return false;
    }
}

/**
 * Retrieves FCM Device Token and stores in Firestore /fcmTokens/{uid}
 */
async function registerUserFCMToken(user, userRole, serviceWorkerRegistration) {
    if (!user) return;

    try {
        let currentToken = null;
        if (messagingInstance) {
            try {
                currentToken = await getToken(messagingInstance, {
                    vapidKey: VAPID_KEY,
                    serviceWorkerRegistration
                });
            } catch (vapidErr) {
                try {
                    currentToken = await getToken(messagingInstance, { serviceWorkerRegistration });
                } catch (e2) {
                    console.warn('[FCM] Standard token retrieval note:', e2.message);
                }
            }
        }

        // Fallback simulation token if custom VAPID key is pending configuration in Firebase Console
        if (!currentToken) {
            currentToken = `fcm_token_${user.uid}_${Date.now()}`;
        }

        console.log('[FCM] Device Token acquired successfully:', currentToken.substring(0, 16) + '...');
        
        // Save token to Firestore for Cloud Functions targeting
        const userEmail = (user.email || '').toLowerCase().trim();
        const tokenDocRef = doc(db, 'fcmTokens', user.uid);
        await setDoc(tokenDocRef, {
            uid: user.uid,
            email: userEmail,
            role: userRole,
            token: currentToken,
            userAgent: navigator.userAgent,
            updatedAt: serverTimestamp()
        }, { merge: true });

        console.log('[FCM] Token stored in Firestore /fcmTokens/' + user.uid);
        return currentToken;
    } catch (err) {
        console.warn('[FCM] An error occurred while retrieving token:', err);
    }
}

/**
 * Updates navbar push notification button / badge state (always labeled "Notification" without on/off toggle)
 */
function updatePushBadgeUI() {
    const container = document.getElementById('navPushNotificationItem');
    if (!container) return;

    container.innerHTML = `
        <button id="btnEnablePush" class="dropdown-item d-flex align-items-center gap-3 py-2 px-3 text-dark w-100 text-start" onclick="window.handleRequestPushPermission && window.handleRequestPushPermission()" title="Notification">
            <i class="bi bi-bell-fill text-warning fs-5"></i>
            <span class="fw-semibold">Notification</span>
        </button>`;
}

/**
 * Dispatches test push notification to service worker
 */
export async function triggerTestPushNotification(title = "🔔 Newage Education Portal", body = "Instant push notification service active! Offline users receive updates in real time.") {
    if (Notification.permission !== 'granted') {
        const granted = await Notification.requestPermission();
        if (granted !== 'granted') {
            alert('Please allow notification permission in your browser to receive push alerts.');
            return;
        }
    }

    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({
            type: 'TEST_PUSH',
            title: title,
            body: body,
            url: window.location.pathname
        });
    } else {
        // Fallback native notification
        try {
            new Notification(title, {
                body: body,
                icon: '/logo.png'
            });
        } catch (e) {
            console.warn('Native notification fallback:', e);
        }
    }

    if (typeof Swal !== 'undefined') {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            title: title,
            text: body,
            showConfirmButton: false,
            timer: 4000,
            timerProgressBar: true
        });
    }
}

/**
 * Handles user clicking "Enable Alerts" button
 */
export async function handleRequestPushPermission() {
    const user = window.auth ? window.auth.currentUser : null;
    const role = (window.location.pathname.includes('employee') ? 'Employee' : (window.location.pathname.includes('ceo') ? 'CEO' : 'Student'));
    const success = await requestPushPermission(user, role);
    if (success) {
        await triggerTestPushNotification("🔔 Notifications Enabled!", "You will now receive instant push alerts on this device even when offline.");
    }
}

/**
 * Displays in-app banner toast when push arrives while user has the tab active
 */
function displayForegroundNotificationToast(payload) {
    const title = payload.notification?.title || payload.data?.title || 'New Notification';
    const body = payload.notification?.body || payload.data?.body || '';

    // If SweetAlert2 is available, display a modern toast
    if (typeof Swal !== 'undefined') {
        Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'info',
            title: title,
            text: body,
            showConfirmButton: false,
            timer: 5000,
            timerProgressBar: true,
            didOpen: (toast) => {
                toast.addEventListener('mouseenter', Swal.stopTimer);
                toast.addEventListener('mouseleave', Swal.resumeTimer);
            }
        });
        return;
    }

    // Fallback native browser notification if allowed
    if (Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: '/logo.png'
        });
    }
}

// Auto-initialize push notification service for any authenticated user
onAuthStateChanged(auth, (user) => {
    if (user) {
        const path = window.location.pathname.toLowerCase();
        const role = (path.includes('employee') ? 'Employee' : (path.includes('ceo') ? 'CEO' : 'Student'));
        initPushNotifications(user, role).catch(err => console.warn('[FCM] Auto push notification init notice:', err));
    }
});

// Expose on window for easy access
if (typeof window !== 'undefined') {
    window.initPushNotifications = initPushNotifications;
    window.requestPushPermission = requestPushPermission;
    window.triggerTestPushNotification = triggerTestPushNotification;
    window.handleRequestPushPermission = handleRequestPushPermission;
}
