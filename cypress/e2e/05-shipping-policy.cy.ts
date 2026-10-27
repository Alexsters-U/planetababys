/// <reference types="cypress" />
export {};
function captureElement(selector:string,name:string){
  // Only the screenshot removes overlapping sticky headers and transient toasts.
  cy.document().then(doc=>{const style=doc.createElement("style");style.id="shipping-evidence-style";style.textContent="header.sticky {position:static!important} [data-sonner-toaster] {display:none!important}";doc.head.appendChild(style);});
  cy.get(selector).screenshot(name);
  cy.document().then(doc=>doc.getElementById("shipping-evidence-style")?.remove());
}
if(Cypress.env("SNAPSHOT_BEFORE")) {
  describe("Estado previo de políticas",()=>{it("registra los términos antes de actualizar los contenedores",()=>{
    cy.viewport(1440,1000);cy.visit("/terminos");cy.contains("Términos y condiciones de compra");cy.screenshot("terminos-antes",{capture:"viewport"});
  });});
} else {
  describe("Políticas y envío cotizado antes del pago",()=>{
    let fixture:{id:string;name:string;slug:string;priceCents:number;stock:number};let quoteId:string;let reviewPath:string;let reference:string;
    after(()=>{if(fixture)cy.task("cleanupShippingFixture",{productId:fixture.id,quoteId});});
    it("publica los datos confirmados y el envío variable en las tres rutas",()=>{
      cy.viewport(1440,1000);
      for(const path of ["/terminos","/privacidad","/devoluciones"]){
        cy.visit(path);cy.contains("Yesica Lorena Zuluaga Trujillo").should("be.visible");cy.contains("1052406922");cy.contains("Centro, 860001, Mocoa, Putumayo");cy.get('[data-testid="contact-email-web"]').should("have.attr","href").and("include","to=Planetababys2026%40gmail.com");cy.contains("Versión 2026-10-08");cy.contains("WhatsApp");
      }
      cy.visit("/terminos");cy.contains("No hay una tarifa única ni se presume envío gratuito.");cy.screenshot("terminos-despues",{capture:"viewport"});
    });
    it("solicita, confirma en admin, revisa el total y crea un pedido sin enviar mensajes",()=>{
      cy.task("createShippingFixture").then(value=>{fixture=value as typeof fixture;
        cy.visit("/checkout",{onBeforeLoad(window){window.localStorage.setItem("pbb_cart_v2",JSON.stringify({state:{items:[{...fixture,productId:fixture.id,imageUrl:null,quantity:2}]},version:0}));}});
      });
      cy.get('[data-testid="checkout-name"]').type("Cliente Sintético");cy.get('[data-testid="checkout-phone"]').type("3001234567");cy.get('input[name="email"]').type("envios-ui@example.com");cy.get('input[name="address"]').type("Calle 10 número 20");cy.get('[data-testid="checkout-city"]').clear().type("Bogotá");cy.get('[data-testid="checkout-data-consent"]').check();cy.get('[data-testid="checkout-terms"]').check();
      cy.get('[data-testid="checkout-total"]').should("contain","Pendiente de cotización");
      cy.intercept("POST","/api/shipping/quotes").as("shippingRequest");cy.get('[data-testid="checkout-submit"]').click();
      cy.wait("@shippingRequest").then(interception=>{expect(interception.response?.statusCode).eq(201);const data=interception.response!.body;quoteId=data.id;reference=data.reference;reviewPath=`/cotizacion/${data.id}?token=${data.token}`;});
      cy.get('[data-testid="shipping-whatsapp"]').should("have.attr","href").and("include","https://wa.me/573222447982");cy.get('[data-testid="shipping-request-result"]').should("contain","No se ha reservado inventario");captureElement("main","checkout-cotizacion");
      cy.then(()=>cy.visit(reviewPath));cy.contains("Estamos esperando la confirmación");cy.get('[data-testid="quotation-pay"]').should("not.exist");
      cy.login(Cypress.env("ADMIN_EMAIL"),Cypress.env("ADMIN_PASSWORD"));cy.visit("/admin/cotizaciones");
      cy.then(()=>cy.get('input[type="search"]').type(reference+"{enter}"));
      cy.get('[data-testid="admin-quote"]').should("have.length",1);cy.get('[data-testid="quote-cost"]').type("5000abc").should("have.value","5000");cy.get('[data-testid="quote-estimate"]').type("2 a 3 días hábiles");cy.get('[data-testid="quote-confirm"]').click();
      cy.contains("Confirmada").should("be.visible");cy.get('[data-testid="quote-share"]').should("have.attr","href").and("include","https://wa.me/573001234567");captureElement('[data-testid="admin-quote"]',"admin-envio-confirmado");
      cy.then(()=>cy.visit(reviewPath));cy.get('[data-testid="quotation-shipping"]').should("contain","5.000");cy.get('[data-testid="quotation-total"]').should("contain","29.000");cy.get('[data-testid="quotation-pay"]').should("be.disabled");cy.get('[data-testid="quotation-accept"]').check();cy.get('[data-testid="quotation-pay"]').should("be.enabled");captureElement('[data-testid="quotation-review"]',"cliente-total-confirmado");
      cy.intercept("POST","/api/orders").as("paidCheckout");cy.get('[data-testid="quotation-pay"]').click();cy.wait("@paidCheckout").then(interception=>{expect(interception.response?.statusCode).eq(201);expect(interception.response!.body.totalCents).eq(2900000);expect(interception.response!.body.shippingCents).eq(500000);});
      cy.location("pathname").should("match",/^\/pedido\//);cy.get('[data-testid="order-status"]').should("contain","Pendiente");
    });
  });
}
