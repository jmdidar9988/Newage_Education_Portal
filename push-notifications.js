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
// Falls back to standard key pair or project default
const VAPID_KEY = "BNbZ1GqJk6gZ7oK3LwYvR1x8H9mN2pQ4tS6vU8wX0yZ2aB4cD6eF8gH0iJ2kL4mN";

export let messagingInstance = null;

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
        const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
            scope: '/'
        });
        console.log('[FCM] Service Worker registered with scope:', registration.scope);

        messagingInstance = getMessaging(app);

        // Check current notification permission
        if (Notification.permission === 'granted') {
            await registerUserFCMToken(user, userRole, registration);
        } else if (Notification.permission === 'default') {
            // Surface a non-intrusive prompt or request permission
            console.log('[FCM] Notification permission is default. Ready to request on user interaction.');
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
export async function requestPushPermission(user, userRole) {
    if (!('Notification' in window)) return false;
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const registration = await navigator.serviceWorker.ready;
            await registerUserFCMToken(user, userRole, registration);
            return true;
        } else {
            console.warn('[FCM] Notification permission denied by user.');
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
    if (!user || !messagingInstance) return;

    try {
        const currentToken = await getToken(messagingInstance, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration
        });

        if (currentToken) {
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
        } else {
            console.warn('[FCM] No registration token available. Request permission to generate one.');
        }
    } catch (err) {
        console.warn('[FCM] An error occurred while retrieving token:', err);
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
}

