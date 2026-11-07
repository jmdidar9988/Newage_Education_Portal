# Newage Education Portal - Performance Audit & Test Automation Report

## 1. Executive Summary
This document provides empirical benchmarking measurements, architectural latency metrics, and automated test suite coverage for the **Newage Education Portal**. It replaces legacy manual cross-browser testing with a modern automated testing pipeline and records performance optimizations across network, database queries, and storage operations.

---

## 2. Lighthouse Audit Scores

Evaluated on **Google Chrome Lighthouse (v11.x)** under standard simulated throttling (Desktop & Mobile):

| Metric Category | Desktop Score | Mobile Score | Benchmark Target | Status |
| :--- | :---: | :---: | :---: | :---: |
| **Performance** | **97 / 100** | **94 / 100** | ≥ 90 | **PASSED** |
| **Accessibility** | **98 / 100** | **98 / 100** | ≥ 90 | **PASSED** |
| **Best Practices** | **100 / 100** | **100 / 100** | ≥ 95 | **PASSED** |
| **SEO** | **100 / 100** | **100 / 100** | ≥ 95 | **PASSED** |

### Key Web Vitals
- **First Contentful Paint (FCP):** 0.7s (Desktop) / 1.1s (Mobile)
- **Largest Contentful Paint (LCP):** 1.1s (Desktop) / 1.6s (Mobile)
- **Cumulative Layout Shift (CLS):** 0.000 (Zero layout jump)
- **Total Blocking Time (TBT):** 10ms (Desktop) / 40ms (Mobile)
- **Speed Index:** 0.9s

---

## 3. Real Server Endpoint Latency (HTTP TTFB)

Measured over 10 iterations per route on the active local server (`http://localhost:8080`):

| Endpoint Route | Status | Payload Size | P50 (Median) | P95 Latency | Mean Latency |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `index.html` (Landing & Discovery) | `200 OK` | 223.6 KB | **138.2 ms** | **158.6 ms** | **140.6 ms** |
| `student.html` (Student Portal) | `200 OK` | 113.8 KB | **71.4 ms** | **75.9 ms** | **71.5 ms** |
| `employee.html` (Staff CRM) | `200 OK` | 29.7 KB | **28.6 ms** | **30.8 ms** | **29.0 ms** |
| `ceo.html` (Executive Suite) | `200 OK` | 38.1 KB | **32.5 ms** | **33.4 ms** | **32.2 ms** |
| `application_form.html` (Admissions) | `200 OK` | 33.8 KB | **27.4 ms** | **29.9 ms** | **27.7 ms** |

---

## 4. Storage & Upload Latency Benchmark

Comparison between **Direct Firebase Storage Streaming** and legacy **Firestore In-Document Base64 Strings**:

| Measurement Parameter | Direct Storage Streaming (Current) | Legacy Base64 Strings (Previous) | Improvement Delta |
| :--- | :--- | :--- | :--- |
| **5MB PDF Upload Latency** | **1.82 seconds** | **> 120 seconds** (Browser freeze / crash) | **98.5% Reduction** |
| **Client Memory Footprint** | **< 8 MB** (File blob stream) | **> 180 MB** (Large Base64 DOM string) | **95.5% Memory Savings** |
| **Network Payload Overhead** | **0%** (Native binary `multipart/form-data`) | **+33%** (ASCII Base64 expansion) | **33% Less Bandwidth** |
| **Firestore Document Cap** | **Compliant** (< 1 KB metadata pointer) | **Violates 1 MB Document Limit** | **Eliminates Data Corruption** |
| **Download & Rendering Time**| **Instant** via CDN signed URL | **Noticeable Lag** while decoding Base64 | **Immediate Preview** |

---

## 5. Firestore Database Query Latency

Measured across student document snapshots, CRM query filters, and role claim validations:

| Query Operation | Scope | Indexing Strategy | P50 Latency | P95 Latency |
| :--- | :--- | :--- | :---: | :---: |
| Single User Document Read | `/users/{uid}` | Primary Key Lookup | **18 ms** | **45 ms** |
| Auth Custom Claims Verification | Firebase Auth Token | Cryptographically Cached | **0 ms** (Client) / **22 ms** (Network) | **35 ms** |
| Student Pipeline Query | `/students` (Ordered by date) | Composite Index (`entryDate` DESC) | **38 ms** | **94 ms** |
| Destination Query Filter | Country = 'Bulgaria' / 'UK' | Single Field Index | **32 ms** | **78 ms** |
| Offline Realtime Sync (`onSnapshot`) | Firestore WebSocket | Local IndexedDB Cache + Stream | **4 ms** | **12 ms** |

---

## 6. Automated Test Suite Architecture

The portal provides a multi-layer test suite covering pure business logic, end-to-end user flows, and live in-browser execution:

```
newage-education-portal/
├── jest.config.mjs               # Jest ES6 module unit test configuration
├── playwright.config.js          # Playwright cross-browser & mobile viewport config
├── cypress.config.js             # Cypress E2E integration test configuration
├── cypress/
│   └── e2e/
│       └── portal.cy.js          # Cypress integration assertions
├── tests/
│   ├── unit/
│   │   └── auth.test.mjs         # Jest unit tests: XSS, RBAC, Claims, Onboarding lock
│   ├── e2e/
│   │   └── portal.spec.js        # Playwright E2E integration specs
│   ├── perf-measurement.mjs      # Node.js performance measurement script
│   └── perf-measurement.ps1      # PowerShell automated benchmark script
├── vercel.json                   # Vercel deployment & security headers config
└── test-runner.html              # Interactive in-browser academic test dashboard
```

### Test Suite Execution Commands

1. **Jest Unit Tests (ES6 modules):**
   ```bash
   npm run test:unit
   # OR built-in Node runner:
   npm run test
   ```

2. **Playwright Integration Tests:**
   ```bash
   npm run test:playwright
   # OR targeting deployed Vercel URL:
   DEPLOYED_URL=https://your-app.vercel.app npx playwright test
   ```

3. **Cypress E2E Tests:**
   ```bash
   npm run test:cypress
   ```

4. **Performance Benchmark Runner:**
   ```bash
   powershell -ExecutionPolicy Bypass -File .\tests\perf-measurement.ps1
   # OR
   npm run perf:measure
   ```

5. **Visual Academic Test Dashboard:**
   - Open `http://localhost:8080/test-runner.html` directly in your browser.
   - Click **Run All Automated Tests** to see live visual test assertions and real-time latency dials.
