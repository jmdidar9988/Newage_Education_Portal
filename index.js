// Global Email State
window.currentActiveChatEmail = null;

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

let currentChatUnsubscribe = null;

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getMessagesContainer() {
    return document.getElementById('ceoChatMessages');
}

function getInput() {
    return document.getElementById('ceoChatInput');
}

function getSendButton() {
    return document.getElementById('ceoChatSendBtn');
}

function getFallbackEmail() {
    if (window.loadedStudentsMap && Object.keys(window.loadedStudentsMap).length > 0) {
        const firstKey = Object.keys(window.loadedStudentsMap)[0];
        const firstData = window.loadedStudentsMap[firstKey];
        return (firstData?.personalInfo?.email || firstKey).trim().toLowerCase();
    }
    return 'sakib@gmail.com';
}

function startChatListener(email, candidateName) {
    const targetEmail = (email || getFallbackEmail()).trim().toLowerCase();
    window.currentActiveChatEmail = targetEmail;

    const messagesContainer = getMessagesContainer();
    const modalTitle = document.getElementById('ceoChatModalTitle');
    const modalSubtitle = document.getElementById('ceoChatModalSubtitle');

    // Update Header to explicitly show candidate name and email
    if (modalTitle) {
        modalTitle.textContent = "Chatting with: " + (candidateName ? `${candidateName} (${targetEmail})` : targetEmail);
    }
    if (modalSubtitle) {
        modalSubtitle.innerHTML = `<i class="bi bi-headset me-1 text-danger"></i> Live Executive Workstation — Active Session`;
    }

    if (messagesContainer) {
        messagesContainer.innerHTML = `
            <div class="text-center text-muted py-4 small">
                <span class="spinner-border spinner-border-sm text-danger me-1"></span> Loading candidate messages...
            </div>`;
    }

    if (currentChatUnsubscribe) {
        currentChatUnsubscribe();
        currentChatUnsubscribe = null;
    }

    try {
        const messagesRef = collection(db, 'students', window.currentActiveChatEmail, 'chatMessages');

        currentChatUnsubscribe = onSnapshot(messagesRef, (snapshot) => {
            const container = getMessagesContainer();
            if (!container) return;
            container.innerHTML = '';

            if (snapshot.empty) {
                container.innerHTML = '<div class="text-center text-muted py-4 small">No messages yet. Start the conversation!</div>';
                return;
            }

            const messages = [];
            snapshot.forEach((doc) => {
                messages.push({ id: doc.id, ...doc.data() });
            });

            // Sort chronologically
            messages.sort((a, b) => {
                const timeA = a.timestamp?.seconds || (a.timestamp ? new Date(a.timestamp).getTime() / 1000 : 0);
                const timeB = b.timestamp?.seconds || (b.timestamp ? new Date(b.timestamp).getTime() / 1000 : 0);
                return timeA - timeB;
            });

            messages.forEach((msg) => {
                const isCeo = msg.sender === 'ceo' || msg.sender === 'employee' || msg.sender === 'counselor';
                const row = document.createElement('div');
                row.className = `d-flex mb-2 ${isCeo ? 'justify-content-end' : 'justify-content-start'}`;

                // Clean chat bubble without sender labels or "You"
                const bubble = document.createElement('div');
                bubble.className = `p-2.5 px-3 rounded-3 small shadow-sm ${isCeo ? 'bg-danger text-white' : 'bg-white text-dark border'}`;
                bubble.style.maxWidth = '75%';
                bubble.style.wordBreak = 'break-word';
                bubble.style.whiteSpace = 'pre-wrap';
                bubble.textContent = msg.text || '';

                row.appendChild(bubble);
                container.appendChild(row);
            });

            container.scrollTop = container.scrollHeight;
        }, (error) => {
            console.error('[CEO Chat] Firestore Error:', error);
            const container = getMessagesContainer();
            if (container) {
                container.innerHTML = `<div class="text-danger small text-center py-3">Error loading messages: ${escapeHtml(error.message)}</div>`;
            }
        });
    } catch (err) {
        console.error('[CEO Chat] Listener error:', err);
        const container = getMessagesContainer();
        if (container) {
            container.innerHTML = `<div class="text-danger small text-center py-3">Error: ${escapeHtml(err.message)}</div>`;
        }
    }
}

export function openCeoChatModal(email, name) {
    const targetEmail = (email || getFallbackEmail()).trim().toLowerCase();
    window.currentActiveChatEmail = targetEmail;
    startChatListener(targetEmail, name);

    const studentDetailModal = document.getElementById('studentDetailModal');
    if (studentDetailModal && window.bootstrap && window.bootstrap.Modal) {
        const detailInst = bootstrap.Modal.getInstance(studentDetailModal);
        if (detailInst) detailInst.hide();
    }

    const modalEl = document.getElementById('ceoChatModal');
    if (modalEl && window.bootstrap && window.bootstrap.Modal) {
        const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
        modalInstance.show();
    }
}
window.openCeoChatModal = openCeoChatModal;

// Ensure .chat-btn click listener correctly extracts data-email and assigns to window.currentActiveChatEmail
document.addEventListener('click', (e) => {
    const chatBtn = e.target.closest('.chat-btn');
    if (chatBtn) {
        const email = (chatBtn.getAttribute('data-email') || chatBtn.dataset.email || '').trim().toLowerCase();
        const name = (chatBtn.getAttribute('data-name') || chatBtn.dataset.name || email).trim();
        openCeoChatModal(email, name);
    }
});

// Auto initialize chat when ceoChatModal is opened
document.addEventListener('DOMContentLoaded', () => {
    const ceoModalEl = document.getElementById('ceoChatModal');
    if (ceoModalEl) {
        ceoModalEl.addEventListener('show.bs.modal', () => {
            if (!window.currentActiveChatEmail) {
                const email = getFallbackEmail();
                startChatListener(email, 'Candidate');
            }
        });
    }
});

// Hard-Bind Send Logic
export async function sendCeoMessage() {
    const targetEmail = window.currentActiveChatEmail || getFallbackEmail();
    if (!targetEmail) {
        alert('Please select a student to chat with.');
        return;
    }
    window.currentActiveChatEmail = targetEmail;

    const input = getInput();
    if (!input) return;
    const val = input.value.trim();
    if (!val) return;

    input.value = '';
    const sendBtn = getSendButton();
    if (sendBtn) sendBtn.disabled = true;

    try {
        await addDoc(collection(db, 'students', targetEmail, 'chatMessages'), {
            text: val,
            sender: 'ceo',
            timestamp: serverTimestamp()
        });
        console.log('[CEO Chat] Sent reply to:', targetEmail);
    } catch (error) {
        console.error('[CEO Chat] Send Reply error:', error);
        alert('Failed to send reply: ' + error.message);
    } finally {
        if (sendBtn) sendBtn.disabled = false;
        input.focus();
    }
}

window.sendCeoMessage = sendCeoMessage;
window.startCeoChatListener = startChatListener;

document.addEventListener('click', (e) => {
    const sendBtn = e.target.closest('#ceoChatSendBtn') || 
                    (e.target.closest('button') && e.target.closest('button').textContent.toLowerCase().includes('send reply') && e.target.closest('#ceoChatModal'));
    if (sendBtn) {
        e.preventDefault();
        sendCeoMessage();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.target && (e.target.id === 'ceoChatInput') && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendCeoMessage();
    }
});

console.log('[CEO Chat] Module initialized with clean bubbles, robust fallbacks, and updated header.');


