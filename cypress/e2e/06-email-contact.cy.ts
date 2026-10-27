/// <reference types="cypress" />
export {};
const email="Planetababys2026@gmail.com";
function captureContact(selector:string,name:string){
  // Prevent the sticky header from covering the component during capture only.
  cy.document().then(doc=>{const style=doc.createElement("style");style.id="email-evidence-style";style.textContent="header.sticky {position:static!important}";doc.head.appendChild(style);});
  cy.get(selector).first().screenshot(name,{disableTimersAndAnimations:false});
  cy.document().then(doc=>doc.getElementById("email-evidence-style")?.remove());
}
describe("Contacto por correo sin dependencia de mailto",()=>{
  it("conserva el destinatario y abre Maps desde un control accesible en las tres políticas",()=>{
    cy.viewport(1280,720);
    for(const path of ["/terminos","/privacidad","/devoluciones"]){
      cy.visit(path);
      cy.get('[data-testid="contact-email-web"]').should("have.length",2).each(link=>{
        const url=new URL(link.attr("href")!);
        expect(url.protocol).eq("https:");expect(url.hostname).eq("mail.google.com");
        expect(url.searchParams.get("view")).eq("cm");expect(url.searchParams.get("to")).eq(email);
        expect(link.attr("target")).eq("_blank");expect(link.attr("rel")).contain("noopener");expect(link.attr("rel")).contain("noreferrer");
      });
      cy.get('[data-testid="contact-email-options"]').should("not.exist");
      cy.contains("Opciones de correo").should("not.exist");
      cy.get('[data-testid="contact-email-copy"]').should("have.length",2).each(button=>{
        expect(button.attr("aria-label")).eq("Copiar correo "+email);
        expect(button.attr("type")).eq("button");
      });
      cy.get('[data-testid="legal-location"]').should("have.attr","href","https://maps.app.goo.gl/PTmZaGLgVhycLrp48")
        .and("have.attr","target","_blank").and("have.attr","rel","noopener noreferrer")
        .and("have.attr","aria-label","Ver local de Planeta Baby’s en Google Maps (se abre en otra pestaña)");
      cy.get('[data-testid="legal-location"]').focus().should("have.focus").and("have.css","outline-style","solid");
    }
    cy.visit("/terminos");
    captureContact('[data-testid="legal-identity"]',"contactos-iconos-escritorio");
    captureContact('footer [data-testid="contact-email"]',"correo-footer-icono");
  });
  it("copia el correo y conserva una alternativa cuando Clipboard no está disponible",()=>{
    cy.visit("/terminos");
    cy.window().then(window=>cy.stub(window.navigator.clipboard,"writeText").resolves().as("copyEmail"));
    // Hold the three-second success state while Cypress captures its visual evidence.
    cy.clock(undefined,["setTimeout","clearTimeout"]);
    cy.get('[data-testid="contact-email-copy"]').first().focus().should("have.focus").and("have.css","outline-style","solid").click();cy.get("@copyEmail").should("have.been.calledOnceWith",email);
    cy.get('[data-testid="contact-email-copy-status"]').first().should("contain","Correo copiado.");
    cy.get('[data-testid="contact-email-copy"]').first().should("have.attr","data-copied","true").and("have.css","color","rgb(25, 117, 88)");
    cy.get('[data-testid="contact-email-copy-status"]').first().should("have.css","color","rgb(25, 117, 88)").then(status=>{
      cy.get('[data-testid="contact-email-copy"]').first().then(button=>{
        const notice=status[0].getBoundingClientRect(),control=button[0].getBoundingClientRect();
        expect(notice.left).gte(control.right);expect(Math.abs(notice.top+notice.height/2-control.top-control.height/2)).lt(2);
      });
    });
    cy.get('[data-testid="contact-email-copy"]').first().blur();
    captureContact('[data-testid="legal-identity"]',"correo-copiado");
    cy.get('[data-testid="contact-email-copy"]').first().should("have.attr","data-copied","true");
    cy.get('footer [data-testid="contact-email-copy"]').click();cy.get("@copyEmail").should("have.been.calledTwice");
    cy.get('footer [data-testid="contact-email-copy-status"]').should("contain","Correo copiado.");
    cy.clock().invoke("restore");
    cy.visit("/terminos");cy.window().then(window=>cy.stub(window.navigator.clipboard,"writeText").rejects(new Error("Permiso denegado")).as("blockedCopy"));
    cy.get('[data-testid="contact-email-copy"]').first().click();cy.get("@blockedCopy").should("have.been.calledOnceWith",email);
    cy.get('[data-testid="contact-email-copy-status"]').first().should("contain","Selecciona la dirección visible");
    cy.visit("/privacidad",{onBeforeLoad(window){Object.defineProperty(window.navigator,"clipboard",{configurable:true,value:undefined});}});
    cy.get('[data-testid="contact-email-copy"]').first().click();
    cy.get('[data-testid="contact-email-copy-status"]').first().should("contain","Selecciona la dirección visible");cy.location("pathname").should("eq","/privacidad");
  });
  it("desvanece la confirmación, reinicia su duración al copiar otra vez y restaura el icono",()=>{
    cy.visit("/terminos");
    cy.window().then(window=>cy.stub(window.navigator.clipboard,"writeText").resolves().as("timedCopy"));
    cy.clock(undefined,["setTimeout","clearTimeout"]);
    cy.get('[data-testid="contact-email-copy"]').first().click();
    cy.get('[data-testid="contact-email-copy-status"]').first().should("have.attr","data-phase","visible");
    cy.tick(2000);cy.get('[data-testid="contact-email-copy"]').first().click();
    cy.get("@timedCopy").should("have.been.calledTwice");
    cy.get('[data-testid="contact-email-copy-status"]').first().should("have.attr","data-phase","visible");
    cy.tick(1000);cy.get('[data-testid="contact-email-copy-status"]').first().should("contain","Correo copiado.");
    cy.tick(1600);cy.get('[data-testid="contact-email-copy-status"]').first().should("have.attr","data-phase","fading");
    cy.tick(400);cy.get('[data-testid="contact-email-copy-status"]').first().should("be.empty");
    cy.get('[data-testid="contact-email-copy"]').first().should("have.attr","data-copied","false").and("have.css","color","rgb(112, 80, 143)");
    cy.get('[data-testid="contact-email-copy"] svg rect').first().should("exist");
    cy.clock().invoke("restore");cy.get('[data-testid="contact-email-copy"]').first().blur();captureContact('[data-testid="legal-identity"]',"correo-restaurado");
  });
  it("mantiene correo y controles compactos sin desbordar en móvil al copiar",()=>{
    for(const width of [320,375]){
      cy.viewport(width,812);cy.visit("/terminos");
      cy.get('[data-testid="contact-email-web"]').first().should("be.visible");
      cy.get('[data-testid="contact-email-copy"], [data-testid="legal-location"]').each(control=>{
        const rect=control[0].getBoundingClientRect();
        // Browser transforms can introduce floating-point differences below a hundredth of a pixel.
        expect(Math.round(rect.width*100)/100).gte(32);expect(Math.round(rect.height*100)/100).gte(32);
        expect(rect.left).gte(0);expect(rect.right).lte(width);
      });
      cy.document().then(doc=>expect(doc.documentElement.scrollWidth).lte(doc.documentElement.clientWidth));
      captureContact('[data-testid="legal-identity"]',"contactos-iconos-movil-"+width);
      cy.window().then(window=>cy.stub(window.navigator.clipboard,"writeText").resolves());
      cy.get('[data-testid="contact-email-copy"]').first().click();
      cy.get('[data-testid="contact-email-copy-status"]').first().should("contain","Correo copiado.");
      cy.document().then(doc=>expect(doc.documentElement.scrollWidth).lte(doc.documentElement.clientWidth));
      cy.get('[data-testid="contact-email-copy"]').first().blur();
      captureContact('[data-testid="legal-identity"]',"correo-copiado-movil-"+width);
    }
  });
});
