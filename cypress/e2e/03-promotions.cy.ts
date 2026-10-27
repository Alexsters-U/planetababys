import {captureFullPage} from "../support/capture";
import {pasteInput} from "../support/input-helpers";
const colombiaInput=(date:Date)=>new Date(date.getTime()-5*3600000).toISOString().slice(0,16);

describe("Promociones: configuración intuitiva, vigencia, carrito y cobro persistente",()=>{
  const name="Promoción UI "+Date.now();let productId="",slug="",orderId="";
  after(()=>{cy.task("cleanupPromotion",{name,orderId:orderId||undefined});});
  it("Programa, activa y retira la oferta; informa vencimientos y guarda el importe exacto",()=>{
    cy.viewport(1280,800);
    cy.visit("/admin/productos");
    cy.location("pathname").should("eq","/admin/login");
    cy.get('[data-testid="admin-email"]').type(Cypress.env("ADMIN_EMAIL"));
    cy.get('[data-testid="admin-password"]').type(Cypress.env("ADMIN_PASSWORD"),{log:false});
    cy.get('[data-testid="admin-login-submit"]').click();
    cy.location("pathname").should("eq","/admin/productos");
    cy.window().then(win=>cy.task("recordPromotionFormat",{
      date:new win.Intl.DateTimeFormat("es-CO",{timeZone:"America/Bogota",day:"numeric",month:"short",year:"numeric",hour:"numeric",minute:"2-digit"}).format(new Date("2026-10-04T04:59:00Z")),
      money:new win.Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",minimumFractionDigits:2,maximumFractionDigits:2}).format(25000.50),
    }));
    cy.get('[data-testid="new-product-button"]').click();
    cy.get('[data-testid="product-name-input"]').type(name);
    cy.get('[data-testid="product-price-input"]').type("25000,50");
    cy.get('[data-testid="product-stock-input"]').clear().type("5");
    cy.get('[data-testid="product-category-select"]').select("lactancia");
    cy.intercept("POST","/api/admin/products/image").as("uploadPromotionImage");
    cy.get('[data-testid="product-image-input"]').selectFile("public/images/products/branding-2026-10-02/tetero.webp");
    cy.wait("@uploadPromotionImage").its("response.statusCode").should("eq",201);
    cy.get('[data-testid="promotion-enabled-input"]').check();
    cy.get('[data-testid="promotion-price-input"]').type("20000,50abc9.").should("have.value","20000,50");
    pasteInput('[data-testid="promotion-price-input"]',"20000abc",true).should("eq",false);
    cy.get('[data-testid="promotion-price-input"]').should("have.value","20000,50");
    cy.get('[data-testid="product-form-submit"]').click();
    cy.get('[data-testid="promotion-end-input"]').invoke("prop","validationMessage").should("eq","Completa este campo.");
    const end=colombiaInput(new Date(Date.now()+7200000)),start=colombiaInput(new Date(Date.now()+3600000));
    cy.get('[data-testid="promotion-end-input"]').type(end);
    cy.get('[data-testid="promotion-fields"] summary').click();
    cy.get('[data-testid="promotion-start-input"]').type(start);
    cy.get('[data-testid="promotion-price-input"]').clear().type("25000,50");
    cy.get('[data-testid="product-form-submit"]').click();
    cy.get('[data-testid="product-form-error"]').should("contain","menor");
    cy.get('[data-testid="promotion-price-input"]').clear().type("20000,50");
    cy.get('[data-testid="promotion-preview"]').should("contain","Programada");
    cy.viewport(390,844);
    cy.document().should(doc=>expect(doc.documentElement.scrollWidth).to.be.at.most(390));
    cy.get('[data-testid="promotion-fields"] input').each($input=>{
      const rect=$input[0].getBoundingClientRect();expect(rect.left).to.be.at.least(0);expect(rect.right).to.be.at.most(390);
    });
    cy.viewport(1280,800);
    cy.get('[data-testid="promotion-fields"]').screenshot("promotions-admin-form");
    cy.intercept("POST","/api/admin/products").as("createPromotion");
    cy.get('[data-testid="product-form-submit"]').click();
    cy.wait("@createPromotion").its("response.statusCode").should("eq",201);
    cy.task("promotionProduct",name).then((p:any)=>{
      productId=p.id;slug=p.slug;expect(p.promotionPriceCents).to.equal(2000050);
      expect(new Date(p.promotionStartsAt).toISOString()).to.equal(new Date(start+":00-05:00").toISOString());
    });
    cy.get('[data-testid="admin-search"]').type(name+"{enter}");
    cy.get('[data-testid="admin-filter-promotion"]').select("scheduled");
    cy.get('[data-testid="product-row"]').should("have.length",1).and("contain","Programada");
    cy.visit("/catalogo?promociones=1&q="+encodeURIComponent(name));
    cy.get('[data-testid="product-card"]').should("not.exist");
    cy.contains("No hay promociones que coincidan").should("be.visible");
    cy.then(()=>cy.visit("/producto/"+slug));
    cy.get('[data-testid="product-detail-price"]').should("contain","25.000,50");
    cy.get('[data-testid="promotion-badge"]').should("not.exist");
    cy.visit("/admin/productos");
    cy.get('[data-testid="admin-search"]').type(name+"{enter}");
    cy.get('[data-testid="product-row"]').should("have.length",1);
    cy.get('[data-testid="edit-product-button"]').click();
    cy.get('[data-testid="promotion-start-input"]').clear();
    cy.get('[data-testid="promotion-preview"]').should("contain","Activa");
    cy.intercept("PATCH","/api/admin/products/*").as("updatePromotion");
    cy.get('[data-testid="product-form-submit"]').click();
    cy.wait("@updatePromotion").its("response.statusCode").should("eq",200);
    cy.get('[data-testid="admin-filter-promotion"]').select("active");
    cy.get('[data-testid="product-row"]').should("have.length",1).and("contain","Activa");
    captureFullPage("promotions-admin-list");
    cy.visit("/");
    cy.get('[data-testid="home-promotions"]').should("contain",name);
    cy.get('[data-testid="header-promotions"]').first().click();
    cy.location("search").should("include","promociones=1");
    cy.get('input[name="q"]').type(name+"{enter}");
    cy.contains("a","Lactancia").click();
    cy.location("search").should("include","promociones=1").and("include","categoria=lactancia");
    cy.get('[data-testid="product-card"]').should("have.length",1).within(()=>{
      cy.get('[data-testid="product-original-price"]').should("contain","25.000,50");
      cy.get('[data-testid="product-price"]').should("contain","20.000,50");
      cy.get('[data-testid="promotion-badge"]').should("contain","19%");
      cy.get('[data-testid="promotion-validity"]').should("contain","hora Colombia");
    });
    captureFullPage("promotions-catalog-desktop");
    cy.viewport(390,844);
    cy.document().should(doc=>expect(doc.documentElement.scrollWidth).to.be.at.most(390));
    captureFullPage("promotions-catalog-mobile");
    cy.viewport(1280,800);
    cy.get('[data-testid="product-card"] [data-testid="add-to-cart"]').click();
    cy.visit("/carrito");
    cy.get('[data-testid="cart-unit-price"]').should("contain","20.000,50");
    cy.then(()=>cy.task("expirePromotion",productId));
    cy.reload();
    cy.get('[data-testid="cart-unit-price"]').should("contain","25.000,50");
    cy.contains("Actualizamos los precios de tu carrito").should("be.visible");
    cy.get('[data-testid="promotion-badge"]').should("not.exist");
    cy.visit("/admin/productos");
    cy.get('[data-testid="admin-search"]').type(name+"{enter}");
    cy.get('[data-testid="admin-filter-promotion"]').select("expired");
    cy.get('[data-testid="product-row"]').should("have.length",1).and("contain","Finalizada");
    cy.get('[data-testid="edit-product-button"]').click();
    cy.get('[data-testid="promotion-enabled-input"]').uncheck();
    cy.get('[data-testid="product-form-submit"]').click();
    cy.wait("@updatePromotion").its("response.statusCode").should("eq",200);
    cy.task("promotionProduct",name).then((p:any)=>{expect(p.promotionEnabled).to.equal(false);expect(p.promotionPriceCents).to.equal(null);expect(p.promotionEndsAt).to.equal(null);});
    cy.get('[data-testid="admin-filter-promotion"]').select("none");
    cy.get('[data-testid="product-row"]').should("have.length",1);
    cy.get('[data-testid="edit-product-button"]').click();
    cy.get('[data-testid="promotion-enabled-input"]').check();
    cy.get('[data-testid="promotion-price-input"]').type("20000,50");
    cy.get('[data-testid="promotion-end-input"]').type(end);
    cy.get('[data-testid="product-form-submit"]').click();
    cy.wait("@updatePromotion").its("response.statusCode").should("eq",200);
    cy.then(()=>cy.request({method:"PATCH",url:"/api/admin/products/"+productId,headers:{Origin:"http://localhost:3100"},body:{promotionEndsAt:new Date(Date.now()+5000).toISOString()}}));
    cy.then(()=>cy.visit("/producto/"+slug));
    cy.get('[data-testid="product-detail-price"]').should("contain","20.000,50");
    cy.get('[data-testid="product-detail-price"]').should("contain","25.000,50");
    cy.get('[data-testid="promotion-badge"]').should("not.exist");
    cy.then(()=>cy.request({method:"PATCH",url:"/api/admin/products/"+productId,headers:{Origin:"http://localhost:3100"},body:{promotionEndsAt:new Date(end+":00-05:00").toISOString()}}));
    cy.visit("/checkout");
    cy.get('[data-testid="checkout-total"]').should("contain","20.000,50");
    cy.get('[data-testid="checkout-name"]').type("Ana María Gómez");
    cy.get('[data-testid="checkout-phone"]').type("3001234567");
    cy.get('[data-testid="checkout-email"]').type("promo@example.com");
    cy.get('[data-testid="checkout-address"]').type("Calle 12 # 5-34, apartamento 302");
    cy.get('[data-testid="checkout-data-consent"]').check();
    cy.get('[data-testid="checkout-terms"]').check();
    captureFullPage("promotions-checkout");
    // Lose only the browser response after the real server has committed the order.
    // A retry must recover that reservation, even if the offer has since expired.
    cy.window().then(win=>{
      const nativeFetch=win.fetch.bind(win);let loseResponse=true;
      win.fetch=(async(input:any,init?:RequestInit)=>{
        const response=await nativeFetch(input,init);
        if(String(input)==="/api/orders" && loseResponse){loseResponse=false;const body=await response.clone().json();orderId=body.orderId;throw new TypeError("Test: respuesta perdida");}
        return response;
      }) as typeof win.fetch;
    });
    cy.get('[data-testid="checkout-submit"]').should("not.be.disabled").click();
    cy.get('[data-testid="checkout-error"]').should("contain","sin duplicarlo");
    cy.then(()=>{expect(orderId).to.be.a("string").and.not.empty;return cy.task("expirePromotion",productId);});
    cy.intercept("POST","/api/orders").as("recoverOrder");
    cy.get('[data-testid="checkout-submit"]').should("contain","Reintentar").click();
    cy.wait("@recoverOrder").then(({request,response})=>{
      expect(response?.statusCode).to.equal(201);expect(response!.body.orderId).to.equal(orderId);
      expect(request.body.items[0].expectedUnitCents).to.equal(2000050);
    });
    cy.then(()=>cy.location("pathname").should("eq","/pedido/"+orderId));
    cy.then(()=>cy.task("promotionOrder",orderId)).then((o:any)=>{
      expect(o.items[0].unitCents).to.equal(2000050);expect(o.items[0].quantity).to.equal(1);
      expect(o.totalCents).to.equal(2000050+o.shippingCents);expect(o.payments[0].amountInCents).to.equal(o.totalCents);
    });
    cy.task("promotionProduct",name).then((p:any)=>expect(p.stock).to.equal(4));
  });
});
