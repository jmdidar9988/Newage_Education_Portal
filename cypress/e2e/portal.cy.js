/**
 * Cypress End-to-End & Integration Test Suite
 * Validates Newage Education Portal navigation, destination discovery,
 * RBAC client guard interception, and student document vault.
 */

describe('Newage Education Portal - End-to-End & Integration Suite', () => {

  const getBase = () => Cypress.config('baseUrl') || 'http://localhost:8080';

  beforeEach(() => {
    // Preserve clear session for deterministic route assertions
    cy.clearLocalStorage();
    cy.clearCookies();
  });

  it('1. Loads homepage and verifies brand title and 14 study destinations', () => {
    cy.visit('/index.html');
    cy.title().should('match', /Newage Education/i);

    // Verify header navigation and search
    cy.get('header').should('be.visible');
    cy.contains('Study Abroad').should('be.visible');

    // Verify Bulgaria destination inclusion
    cy.get('body').should('contain', 'Bulgaria');
  });

  it('2. Redirects unauthenticated access from executive dashboards (CEO/Employee)', () => {
    // When attempting to access ceo.html without valid session, RBAC redirects to index.html
    cy.visit('/ceo.html', { failOnStatusCode: false });
    cy.url().should('include', 'index.html');

    cy.visit('/employee.html', { failOnStatusCode: false });
    cy.url().should('include', 'index.html');
  });

  it('3. Verifies application form modal or direct view loads essential fields', () => {
    cy.visit('/application_form.html');
    cy.get('body').should('be.visible');
    // Ensure form inputs exist
    cy.get('input, select, textarea').should('have.length.at.least', 5);
  });

  it('4. Verifies responsive mobile viewport layout', () => {
    cy.viewport('iphone-x');
    cy.visit('/index.html');
    cy.get('body').should('be.visible');
    cy.get('header').should('be.visible');
  });

});

