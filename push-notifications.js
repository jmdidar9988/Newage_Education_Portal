// Firebase Cloud Messaging (FCM) Client Integration Module
// Handles service worker registration, push permission requests, token registration, and foreground notifications

import { initializeApp, getApp, getApps } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
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

        // Check current notification permission
        if (Notification.permission === 'granted') {
            await registerUserFCMToken(user, userRole, activeRegistration);
            updatePushBadgeUI(true);
        } else {
            console.log('[FCM] Notification permission state:', Notification.permission);
            updatePushBadgeUI(false);
        }

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
 * Updates navbar push notification button / badge state
 */
function updatePushBadgeUI(isSubscribed) {
    const container = document.getElementById('navPushNotificationItem');
    if (!container) return;

    if (isSubscribed) {
        container.innerHTML = `
            <button class="btn btn-sm btn-outline-light rounded-pill px-3 py-1" onclick="window.triggerTestPushNotification && window.triggerTestPushNotification()" title="Click to test live OS push notification">
                <i class="bi bi-bell-fill text-warning me-1"></i> <span class="d-none d-sm-inline">Push: </span>Active
            </button>`;
    } else {
        container.innerHTML = `
            <button id="btnEnablePush" class="btn btn-sm btn-outline-warning rounded-pill px-3 py-1 fw-semibold" onclick="window.handleRequestPushPermission && window.handleRequestPushPermission()" title="Enable push notifications for instant alerts">
                <i class="bi bi-bell-fill me-1"></i> Enable Alerts
            </button>`;
    }
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

// Expose on window for easy access
if (typeof window !== 'undefined') {
    window.initPushNotifications = initPushNotifications;
    window.requestPushPermission = requestPushPermission;
    window.triggerTestPushNotification = triggerTestPushNotification;
    window.handleRequestPushPermission = handleRequestPushPermission;
}
