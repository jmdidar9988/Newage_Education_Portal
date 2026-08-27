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
    return document.getElementById('employeeChatMessages') || document.getElementById('chatMessages');
}

function getInput() {
    return document.getElementById('employeeChatInput') || document.getElementById('chatInput');
}

function getSendButton() {
    return document.getElementById('employeeChatSendBtn') || document.getElementById('chatSendBtn');
}

function startChatListener(email, candidateName) {
    if (!email) return;
    window.currentActiveChatEmail = email;

    const messagesContainer = getMessagesContainer();
    const modalTitle = document.getElementById('chatModalTitle');
    const modalSubtitle = document.getElementById('chatModalSubtitle');

    // Update Chat Header to explicitly show candidate name and email
    if (modalTitle) {
        modalTitle.textContent = "Chatting with: " + (candidateName ? `${candidateName} (${email})` : email);
    }
    if (modalSubtitle) {
        modalSubtitle.innerHTML = `<i class="bi bi-headset me-1 text-danger"></i> Live Counselor Workstation — Active Session`;
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
                container.innerHTML = '<div class="text-center text-muted py-4 small">No messages yet.</div>';
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
                const isEmployee = msg.sender === 'employee' || msg.sender === 'counselor' || msg.sender === 'ceo';
                const row = document.createElement('div');
                row.className = `d-flex mb-2 ${isEmployee ? 'justify-content-end' : 'justify-content-start'}`;

                // Clean chat bubble without redundant sender tags
                const bubble = document.createElement('div');
                bubble.className = `p-2.5 px-3 rounded-3 small shadow-sm ${isEmployee ? 'bg-danger text-white' : 'bg-white text-dark border'}`;
                bubble.style.maxWidth = '75%';
                bubble.style.wordBreak = 'break-word';
                bubble.style.whiteSpace = 'pre-wrap';
                bubble.textContent = msg.text || '';

                row.appendChild(bubble);
                container.appendChild(row);
            });

            container.scrollTop = container.scrollHeight;
        }, (error) => {
            console.error('[Employee Chat] Firestore Error:', error);
            const container = getMessagesContainer();
            if (container) {
                container.innerHTML = `<div class="text-danger small text-center py-3">Error loading messages: ${escapeHtml(error.message)}</div>`;
            }
        });
    } catch (err) {
        console.error('[Employee Chat] Listener error:', err);
        const container = getMessagesContainer();
        if (container) {
            container.innerHTML = `<div class="text-danger small text-center py-3">Error: ${escapeHtml(err.message)}</div>`;
        }
    }
}

export function openEmployeeChatModal(email, name) {
    const targetEmail = (email || '').trim().toLowerCase();
    if (targetEmail) {
        window.currentActiveChatEmail = targetEmail;
        startChatListener(window.currentActiveChatEmail, name);

        // If another modal like studentDetailModal is open, hide it first
        const studentDetailModal = document.getElementById('studentDetailModal');
        if (studentDetailModal && window.bootstrap && window.bootstrap.Modal) {
            const detailInst = bootstrap.Modal.getInstance(studentDetailModal);
            if (detailInst) detailInst.hide();
        }

        // Explicitly show employeeChatModal via Bootstrap Modal instance
        const modalEl = document.getElementById('employeeChatModal');
        if (modalEl && window.bootstrap && window.bootstrap.Modal) {
            const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
            modalInstance.show();
        }
    }
}
window.openEmployeeChatModal = openEmployeeChatModal;

// Ensure .chat-btn click listener correctly extracts data-email and assigns to window.currentActiveChatEmail
document.addEventListener('click', (e) => {
    const chatBtn = e.target.closest('.chat-btn');
    if (chatBtn) {
        const email = (chatBtn.getAttribute('data-email') || chatBtn.dataset.email || '').trim().toLowerCase();
        const name = (chatBtn.getAttribute('data-name') || chatBtn.dataset.name || email).trim();
        openEmployeeChatModal(email, name);
    }
});

// Hard-Bind Send Logic (Event Delegation on document.body)
async function sendEmployeeMessage() {
    if (!window.currentActiveChatEmail) {
        console.warn('[Employee Chat] Cannot send: window.currentActiveChatEmail is not set');
        return;
    }

    const input = getInput();
    if (!input) return;
    const val = input.value.trim();
    if (!val) return;

    input.value = '';
    const sendBtn = getSendButton();
    if (sendBtn) sendBtn.disabled = true;

    try {
        await addDoc(collection(db, 'students', window.currentActiveChatEmail, 'chatMessages'), {
            text: val,
            sender: 'employee',
            timestamp: serverTimestamp()
        });
        console.log('[Employee Chat] Sent reply to:', window.currentActiveChatEmail);
    } catch (error) {
        console.error('[Employee Chat] Send Reply error:', error);
        alert('Failed to send reply: ' + error.message);
    } finally {
        if (sendBtn) sendBtn.disabled = false;
        input.focus();
    }
}

window.sendEmployeeMessage = sendEmployeeMessage;

document.addEventListener('click', (e) => {
    const sendBtn = e.target.closest('#employeeChatSendBtn') || 
                    (e.target.closest('button') && e.target.closest('button').textContent.toLowerCase().includes('send reply'));
    if (sendBtn) {
        e.preventDefault();
        sendEmployeeMessage();
    }
});

document.addEventListener('keydown', (e) => {
    if (e.target && (e.target.id === 'employeeChatInput' || e.target.id === 'chatInput') && e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendEmployeeMessage();
    }
});

console.log('[Employee Chat] Module initialized with clean bubbles and updated header.');
