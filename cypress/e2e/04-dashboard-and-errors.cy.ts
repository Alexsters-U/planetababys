import {captureFullPage} from "../support/capture";
describe("Métricas y prioridades del centro de cuidado",()=>{
  let fixture:{orderId:string;reference:string;productId:string}|undefined;
  beforeEach(()=>{cy.session("metrics-admin",()=>cy.login(Cypress.env("ADMIN_EMAIL"),Cypress.env("ADMIN_PASSWORD")));});
  after(()=>{if(fixture)cy.task("cleanupFixture",fixture);});
  it("Presenta datos reales del API, rangos, gráfica accesible y capturas",()=>{
    cy.task("createPaidOrder").then((value:any)=>{fixture=value;});
    cy.visit("/admin");cy.get('[data-testid="admin-dashboard"]').should("be.visible");
    cy.request("/api/admin/summary?days=30").then(({body})=>{
      const pesos=String(Math.trunc(body.metrics.salesCents/100)).replace(/\B(?=(\d{3})+(?!\d))/g,".");
      cy.get('[data-testid="metric-sales"]').should("contain",pesos);
      cy.get('[data-testid="metric-paid"]').should("have.text",String(body.metrics.paidOrders));
    });
    cy.viewport(1280,900);captureFullPage("after-dashboard-desktop");
    cy.viewport(390,844);cy.document().should(doc=>expect(doc.documentElement.scrollWidth).to.be.at.most(390));captureFullPage("after-dashboard-mobile");
    cy.intercept("GET","/api/admin/summary?days=7").as("sevenDays");cy.get('[data-testid="range-7"]').click();cy.wait("@sevenDays").its("response.statusCode").should("eq",200);
    cy.get('[data-testid="range-7"]').should("have.attr","aria-pressed","true");cy.get('[data-testid="metrics-period"]').should("contain","Últimos 7 días");
    cy.location("search").should("eq","?days=7");
    cy.get('[data-testid="sales-chart"] svg').focus().trigger("keydown",{key:"Home"});
    cy.request("/api/admin/summary?days=7").then(({body})=>{cy.get('[data-testid="chart-selected"]').should("contain",body.dailySales[0].date);});
    cy.get('[data-testid="sales-chart"] svg').trigger("keydown",{key:"End"});
    cy.get('[data-testid="sales-chart"] details summary').click();cy.get('[data-testid="sales-chart"] table tbody tr').should("have.length",8);
    cy.get('[data-testid="range-90"]').click();cy.get('[data-testid="metrics-period"]').should("contain","Últimos 90 días");
    cy.reload();cy.get('[data-testid="range-90"]').should("have.attr","aria-pressed","true");
  });
  it("Abre alertas con filtros efectivos y recupera un fallo de consulta",()=>{
    cy.visit("/admin");cy.get('[data-testid="action-low-stock"]').click();
    cy.get('[data-testid="admin-filter-stock"]').should("have.value","low");cy.get('[data-testid="admin-filter-visibility"]').should("have.value","visible");
    cy.get('[data-testid="admin-result-count"]').should("not.contain","Actualizando");
    cy.visit("/admin");cy.get('[data-testid="action-review"]').click();cy.get('[data-testid="admin-filter-review"]').should("have.value","required");
    cy.get('[data-testid="admin-result-count"]').should("not.contain","Actualizando");
    cy.visit("/admin");cy.get('[data-testid="action-ready"]').click();cy.get('[data-testid="admin-filter-status"]').should("have.value","PAID");cy.get('[data-testid="admin-filter-review"]').should("have.value","clear");
    cy.visit("/admin");
    cy.intercept({method:"GET",url:"/api/admin/summary?days=30",times:1},{statusCode:503,body:{error:"No disponible"}}).as("metricsFailure");
    cy.get('[data-testid="metrics-refresh"]').click();cy.wait("@metricsFailure");cy.get('[data-testid="metrics-error"]').should("be.visible");
    cy.viewport(1280,900);captureFullPage("after-dashboard-query-error");
    cy.get('[data-testid="metrics-error"]').contains("button","Reintentar").click();cy.get('[data-testid="metrics-error"]').should("not.exist");
    cy.get('[data-testid="admin-dashboard"]').should("have.attr","aria-busy","false");
  });
});
describe("Errores con identidad de Planeta Baby’s",()=>{
  after(()=>{cy.task("backendAvailability","start");});
  it("Mantiene un 404 real, el carrito y rutas de regreso útiles",()=>{
    cy.visit("/catalogo");cy.get('[data-testid="add-to-cart"]').first().click();
    let saved:{productId:string;quantity:number}[]=[];
    cy.window().then(win=>{saved=JSON.parse(win.localStorage.getItem("pbb_cart_v2")!).state.items.map((item:any)=>({productId:item.productId,quantity:item.quantity}));});
    cy.request({url:"/pagina-que-no-existe",failOnStatusCode:false}).its("status").should("eq",404);
    cy.visit("/pagina-que-no-existe",{failOnStatusCode:false});cy.get('[data-testid="brand-404"]').should("be.visible");
    cy.viewport(1280,900);captureFullPage("after-404-desktop");
    cy.viewport(390,844);cy.document().should(doc=>expect(doc.documentElement.scrollWidth).to.be.at.most(390));captureFullPage("after-404-mobile");
    cy.window().then(win=>{expect(saved).to.have.length(1);expect(JSON.parse(win.localStorage.getItem("pbb_cart_v2")!).state.items.map((item:any)=>({productId:item.productId,quantity:item.quantity}))).to.deep.equal(saved);});
    cy.get('[data-testid="error-primary-link"]').click();cy.location("pathname").should("eq","/catalogo");
    cy.visit("/producto/no-existe-metrics",{failOnStatusCode:false});cy.get('[data-testid="brand-404"]').should("be.visible");
  });
  it("Muestra la vista de fallo ante una API caída y reintenta al recuperarse",()=>{
    // Real failure injection scoped exclusively to the local test API.
    cy.task("backendAvailability","stop");
    cy.on("uncaught:exception",error=>{if(/Server Components render|fetch failed|API no disponible|Minified React error #441/.test(error.message))return false;});
    cy.visit("/catalogo",{failOnStatusCode:false});cy.get('[data-testid="brand-error"]').should("be.visible");
    cy.viewport(1280,900);captureFullPage("after-error-desktop");
    cy.viewport(390,844);captureFullPage("after-error-mobile");
    cy.task("backendAvailability","start");cy.get('[data-testid="error-retry"]').click();
    cy.contains("h1","Catálogo").should("be.visible");cy.get('[data-testid="brand-error"]').should("not.exist");
  });
});
