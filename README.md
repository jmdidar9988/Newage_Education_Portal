# 🎓 Newage Education - Student Portal & Management System

[![HTML5](https://img.shields.io/badge/Frontend-HTML5-orange.svg)](https://developer.mozilla.org/en-US/docs/Web/HTML)
[![CSS3](https://img.shields.io/badge/Styling-Custom%20CSS3%20%26%20Bootstrap%205-blue.svg)](https://getbootstrap.com/)
[![JavaScript](https://img.shields.io/badge/Logic-Vanilla%20ES6%2B%20Modules-yellow.svg)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Firebase](https://img.shields.io/badge/Backend-Firebase%20v10%20%28Firestore%20%26%20Auth%29-FFCA28.svg)](https://firebase.google.com/)
[![Cloudinary](https://img.shields.io/badge/Storage-Cloudinary%20%2F%20Data%20URL-3B48CC.svg)](https://cloudinary.com/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Newage Education** is a modern, full-featured web portal and candidate management platform designed for international education consultancies. It connects students, educational counselors, and executive management (CEO) through a unified real-time dashboard powered by Firebase Firestore.

---

## 🌟 Key Features

### 1. 📱 Screen-Centered Neo-Lightbox Modals
- **Fixed-Position Pop-Out Lightboxes**: High-performance floating modals centered on screen with backdrop blur (`backdrop-filter: blur(4px)`).
- **Smooth 2-Way Scale Transitions**: Expands and shrinks smoothly with custom `cubic-bezier(0.175, 0.885, 0.32, 1.275)` timing functions.
- **Dedicated Close Controls**: Floating circular `X` close buttons (`.btn-close-neo`) with hover rotation and backdrop click dismiss handlers.

### 2. 📁 Document Vault & Verification Checklist
- **Student Document Workspace**: Streamlined document checklist allowing candidates to upload PDF scans and images for certificates, marksheets, recommendation letters, passport, NID, SOP, CV, and bank statements.
- **Counselor Verification**: Real-time status mapping (*Pending*, *Verified*, *Rejected*) accessible to counselors for document review.

### 3. 📚 Sequential Interview Preparation Materials
- **Custom Title & Single-File Upload Modal**: Counselors can upload interview preparation sheets (e.g., "Sheet 1", "Sheet 2") sequentially.
- **Firestore `arrayUnion` Storage**: Ensures new PDF uploads append safely to the candidate record without overwriting existing materials.
- **Unread Notification Badge System**: Automatically flags candidate records with `hasUnreadMaterials: true`, displaying a glowing **"New"** notification badge on the student portal that clears once viewed.

### 4. 🎓 10-Stage Visa & Application Lifecycle Tracker
Real-time progress tracking across all ten key visa and application stages:
1. `Pending / Processing`
2. `Offer letter received`
3. `Applied for unconditional offer letter`
4. `Applied for CAS`
5. `CAS received`
6. `VFS Global Appointment`
7. `Embassy Interview`
8. `UKVI interview`
9. `Visa Success`
10. `Rejected`

### 5. 👥 Multi-Role Portal Authentication & Access Control
- **Automatic Email Role Detection**: Real-time email domain/pattern matching displaying role badges (CEO, Employee, Student) on the login interface.
- **Role-Based Views**:
  - **CEO Dashboard**: High-level KPIs, total student metrics, recent applications overview.
  - **Employee / Counselor Dashboard**: Interactive student directory, document verification workspace, application status dropdowns, prep sheet upload modal, and direct candidate messaging.
  - **Student Dashboard**: Candidate profile record, real-time application tracker, document vault, interview materials, and assigned counselor chat.
- **Instant Demo Logins**: One-click demo login buttons for testing (`ceo@newage.com`, `employee@newage.com`, `student@newage.com`).

### 6. 🌗 Dynamic Light & Dark Theme System
- **Theme Persistence**: Theme state stored in `localStorage` and synchronized across all pages.
- **Dynamic Text Contrast Utilities**: CSS classes (`.dynamic-text`, `.dynamic-header-text`, `.dynamic-text-muted`) guaranteeing high contrast and legibility across both Light Slate and Dark Charcoal themes.

### 7. 💬 Real-Time Counselor Support Chat
- Integrated candidate-counselor messaging widget for direct communication, status updates, and document inquiries.

---

## 🛠️ Tech Stack

- **Frontend**:
  - **HTML5 & Vanilla JavaScript**: ES6 Modules (`auth.js`).
  - **Styling**: Custom CSS design system (`style.css`), Bootstrap 5.3 framework, Bootstrap Icons.
  - **UI/UX Enhancements**: SweetAlert2 modal feedback, custom Glassmorphism cards, CSS keyframes.
- **Backend & Database**:
  - **Firebase v10 SDK**: Modular JavaScript SDK (`firebase/app`, `firebase/auth`, `firebase/firestore`).
  - **Cloud Database**: Real-time Firebase Firestore (`students` collection).
- **Document & Asset Storage**:
  - **HTML5 FileReader API**: Base64 Data URL encoding for PDF and image document uploads.
  - **Cloudinary Integration Ready**: Prepared infrastructure for cloud image/PDF CDN hosting and asset delivery.
  - **Atomic Array Operations**: Firestore `arrayUnion()` for safe sequential document appending.
- **Dev Tooling**:
  - **PowerShell Local Web Server**: Lightweight PowerShell HTTP server script (`server.ps1`).

---

## 📁 Repository Structure

```
Newage-Education/
├── index.html            # Public Homepage (Courses, Destinations, Consultation Booking)
├── login.html            # Multi-Role Authentication Page (CEO, Employee, Student)
├── student.html          # Candidate Dashboard (Status Tracker, Document Vault, Interview Materials)
├── employee.html         # Counselor & Staff Portal (Student Management, Prep Sheet Uploads)
├── application_form.html # Multi-Step Registration & Application Form
├── style.css             # Core CSS Design System & Theme Variables
├── auth.js               # Firebase Authentication, Firestore Sync & UI Controllers
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
   - **Public Portal**: `http://localhost:8000/index.html`
   - **Login Page**: `http://localhost:8000/login.html`
   - **Student Dashboard**: `http://localhost:8000/student.html`
   - **Counselor Portal**: `http://localhost:8000/employee.html`

### Demo Credentials
Use the quick demo buttons on `login.html`:
- **CEO Portal**: `ceo@newage.com`
- **Counselor Portal**: `employee@newage.com`
- **Student Portal**: `student@newage.com`

---

## 🗄️ Firestore Data Schema

```json
students/{studentId}
{
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
  "assignedCounselor": "Kabir Hossain"
}
```

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for details.

---

## 👨‍💻 Author & Credits

**Jibran Masum Didar, Metropolitan University**
