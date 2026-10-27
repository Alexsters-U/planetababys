/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      login(email: string, password: string): Chainable<void>;
    }
  }
}

Cypress.Commands.add("login", (email: string, password: string) => {
  cy.request({
    method: "POST",
    url: "/api/auth/login",
    body: { email, password },
    headers:{Origin:Cypress.config("baseUrl")??"http://localhost:3100"},
    failOnStatusCode: false,
  }).then((res) => {
    expect(res.status, "login exitoso").to.eq(200);
  });
});

export {};
