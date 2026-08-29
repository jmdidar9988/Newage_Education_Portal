# 🎓 Newage Education - Student Portal & Management System

[![HTML5](https://img.shields.io/badge/Frontend-HTML5-orange.svg)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/Styling-Custom%20CSS3%20%26%20Bootstrap%205-blue.svg)](https://getbootstrap.com/)
[![JavaScript](https://img.shields.io/badge/Logic-Vanilla%20ES6%2B%20Modules-yellow.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Firebase](https://img.shields.io/badge/Backend-Firebase%20v10%20%28Firestore%20%26%20Auth%29-FFCA28.svg)](https://firebase.google.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Newage Education** is a modern, full-featured web portal and candidate management platform designed for international education consultancies. It connects students, educational counselors, and executive management (CEO) through a unified real-time dashboard powered by Firebase Firestore.

---

## 🌟 Key Features

### 1. 👥 Multi-Role Portal Authentication & Access Control
- **Automatic Email Role Detection**: Real-time email domain/pattern matching displaying role badges (CEO, Employee, Student) on the login interface.
- **Persistent Session Navigation**: Clicking the **Home** button keeps users logged in, rendering their active portal state. A dedicated **My Profile** navbar button lets authenticated users instantly return to their respective dashboards.
- **Role-Based Views**:
  - **CEO Terminal**: Greeted as **Mahfuz Shuvo**, features live student metrics, recent applications, counselor task tracker, and the secure **My Team** management panel.
  - **Employee / Counselor Dashboard**: Personal greeting from Firestore, task control center, interactive student directory, document verification workspace, and direct candidate messaging.
  - **Student Dashboard**: Candidate profile, live application tracker, document vault, and assigned counselor chat.
- **Instant Demo Logins**: One-click demo login buttons for testing (`ceo@newage.com`, `employee@newage.com`, `student@newage.com`).

### 2. 💼 "My Team" Staff Management Modal (CEO Only)
- **Centralized Directory**: Removed static dashboard blocks and placed employee listings inside a secure **My Team** modal directory.
- **Designation-Based Provisioning**: Adds new employee accounts directly from the team window, allowing the CEO to specify their role/designation (e.g. Senior Admission Counselor).
- **Secure Configuration Lock**: Clicking **Update** prompts for the CEO's master password. On success, it unlocks a SweetAlert2 form to edit staff names, designations, phone numbers, departments, and status (Active/Inactive), or permanently delete the counselor account.

### 3. 📋 Real-Time Counselor Task Control Center
- **Deadline Countdowns**: Interactive countdown timer ticking in seconds next to each task. Deadline-passed tasks are visually flagged as red **Missed**.
- **Deadline Lock Enforcements**: If the deadline for a task has passed, the counselor is blocked from uploading files, marking it complete, or changing its status in the system. The submission form automatically renders a warning alert: **"Deadline Missed. You can no longer mark this task as completed."**
- **Task Assign Form**: CEO can dynamically assign due dates, deadlines (with due time), and upload task instruction PDFs.
- **Unread Task Alerts**: Displays a glowing notification badge on the counselor navbar when a new task is assigned, vanishing once opened.

### 4. 📁 Document Vault & Verification Checklist
- **Student Document Workspace**: Checklist allowing candidates to upload PDF scans and images for certificates, marksheets, letters, passport, SOP, CV, and bank statements.
- **Bidirectional Verification Controls**: CEO and counselors can review uploads in the Student Details Modal, toggling status back and forth between **Approve** and **Mark Pending**, or choosing **Delete Document** to remove it from Firestore.

### 5. 💬 Real-Time Synced Chat Notifications & Seen States
- **High-Visibility Alerts**:
  - **Student Notification**: A glowing notification banner stating **"New Message from Counselor!"** is displayed at the top of the student dashboard.
  - **Counselor/CEO Navbar Notifications**: A red **"New Message"** navbar badge glows whenever a student sends a message. Clicking the navbar badge instantly opens the chat with that candidate.
  - **Automatic Candidate Setup**: Upon student signup, a student record document is initialized immediately in the Firestore `students` collection. This registers their `createdAt` timestamp, preventing them from being filtered out of ordered counselor CRM lists, and ensuring unread notifications always sync instantly.
- **Auto-Seen Sync**: Opening the chatbox on either side instantly clears the unread flags in Firestore, causing the navbar badges and row indicators to vanish in real-time across both staff portals.
- **Double-Click to Delete**: Double-clicking any message bubble prompts a confirmation dialog to delete the message permanently from Firestore.

### 6. 🌗 Dynamic Light & Dark Theme System
- **Theme Persistence**: Theme state stored in `localStorage` and synchronized across all pages.
- **Dynamic Text Contrast Utilities**: CSS classes (`.dynamic-text`, `.dynamic-header-text`, `.dynamic-text-muted`) guaranteeing high contrast and legibility across both Light Slate and Dark Charcoal themes.
- **Navbar Legibility Fixes**: Resolved all light theme contrast issues; buttons, dropdowns, toggler icons, and text are high-contrast and fully visible against the light background.

### 7. 🟢 Floating Facebook & WhatsApp Widgets
- **Helplines Stack**: Features stacked floating brand buttons on the bottom-right corner for direct helplines:
  - **WhatsApp** (bottom: 25px): Links directly to WhatsApp API (`https://api.whatsapp.com/send/?phone=8801907130612`).
  - **Facebook** (bottom: 80px): Links directly to the Facebook share page (`https://www.facebook.com/share/18BbYk9GWx/`).

---

## 🛠️ Tech Stack

- **Frontend**:
  - **HTML5 & Vanilla JavaScript**: ES6 Modules (`auth.js`).
  - **Styling**: Custom CSS design system (`style.css`), Bootstrap 5.3 framework, Bootstrap Icons.
  - **UI/UX Enhancements**: SweetAlert2 modal feedback, custom Glassmorphism cards, CSS keyframes.
- **Backend & Database**:
  - **Firebase v10 SDK**: Modular JavaScript SDK (`firebase/app`, `firebase/auth`, `firebase/firestore`).
  - **Cloud Database**: Real-time Firebase Firestore (`students` and `tasks` collections).
- **Document & Asset Storage**:
  - **HTML5 FileReader API**: Base64 Data URL encoding for PDF and image document uploads.
  - **Atomic Array Operations**: Firestore `arrayUnion()` for safe sequential document appending.
- **Dev Tooling**:
  - **PowerShell Local Web Server**: Lightweight PowerShell HTTP server script (`server.ps1`).

---

## 📁 Repository Structure

```
Newage-Education/
├── index.html            # Public Landing Page (Auth Hub, Intake Status, Partner University Directory)
├── student.html          # Candidate Dashboard (Status Tracker, Document Vault, Chat)
├── employee.html         # Counselor Portal (Student Directory, Chat Modal, Task Manager Modal)
├── ceo.html              # CEO Dashboard (My Team modal, Task Assigner, Application Metrics)
├── application_form.html # Multi-Step Registration & Application Form
├── style.css             # Core CSS Design System & Theme Variables
├── auth.js               # Firebase Authentication, Firestore Sync & UI Controllers
├── index.js              # CEO Chat Module & Seen Clear Handlers
├── employee.js           # Counselor Chat Module & Seen Clear Handlers
├── server.ps1            # Local PowerShell Development HTTP Server
└── README.md             # Project Documentation
```

---

## 🚀 Getting Started

### Prerequisites
- Modern web browser (Chrome, Firefox, Edge, Safari).
- PowerShell (Windows) or any static HTTP server (e.g., VS Code Live Server, `npx serve`).

### Running Locally

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/jmdidar9988/Newage_Education_Portal.git
   cd Newage-Education
   ```

2. **Launch Development Server**:
   Run the included PowerShell server script:
   ```powershell
   powershell -ExecutionPolicy Bypass -File server.ps1
   ```
   Or use VS Code Live Server to open `index.html`.

3. **Access the Portals**:
   - **Homepage (Login)**: `http://localhost:8080/index.html` (Use the sign in option to toggle login modal)
   - **CEO Terminal**: `http://localhost:8080/ceo.html`
   - **Counselor Portal**: `http://localhost:8080/employee.html`
   - **Student Dashboard**: `http://localhost:8080/student.html`

### Demo Credentials
Use the quick demo buttons on the sign in tab:
- **CEO Portal**: `ceo@newage.com`
- **Counselor Portal**: `employee@newage.com`
- **Student Portal**: `student@newage.com`

---

## 🗄️ Firestore Data Schema

```json
students/{studentId}
{
  "email": "student@example.com",
  "uid": "auth_uid",
  "personalInfo": {
    "fullName": "Student Name",
    "email": "student@example.com",
    "contactNo": "+8801700000000"
  },
  "applications": [
    {
      "id": "app_1700000000000",
      "country": "UK",
      "university": "University of Greenwich",
      "course": "MSc Computer Science",
      "status": "Offer letter received",
      "statusUpdatedAt": "2026-07-26T20:00:00.000Z"
    }
  ],
  "documents": {
    "ssc_certificate": { "status": "Verified", "url": "data:application/pdf;base64,..." },
    "passport": { "status": "Pending", "url": "data:application/pdf;base64,..." }
  },
  "prepSheets": [
    {
      "id": "sheet_1700000000000",
      "title": "Sheet 1",
      "url": "data:application/pdf;base64,...",
      "uploadedAt": "2026-07-26T21:00:00.000Z"
    }
  ],
  "hasUnreadMaterials": true,
  "assignedCounselor": "Kabir Hossain",
  "staffHasUnread": false,
  "studentHasUnread": true,
  "createdAt": "2026-08-29T00:26:03.000Z"
}
```

```json
tasks/{taskId}
{
  "assignedToEmail": "employee@newage.com",
  "assignedToName": "Kabir Hossain",
  "description": "Review application documents",
  "deadline": "2026-08-30T10:00:00.000Z",
  "pdfData": "data:application/pdf;base64,...",
  "pdfName": "instructions.pdf",
  "status": "pending",
  "seenByEmployee": false,
  "employeeUpdates": "",
  "createdAt": "2026-08-28T13:25:35.225Z"
}
```

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.

---

## 👨‍💻 Author & Credits

**Jibran Masum Didar, Metropolitan University**
