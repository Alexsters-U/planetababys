// Keep stitched evidence faithful: load lazy photos and avoid repeated fixed UI.
export function captureFullPage(name: string) {
  cy.document().then(document => {
    document.querySelectorAll("img").forEach(image => image.loading = "eager");
    document.querySelector("header")!.style.position = "relative";
    const style = document.createElement("style");
    style.id = "evidence-toast-style";
    style.textContent = "[data-sonner-toaster]{visibility:hidden!important}";
    document.head.append(style);
  });
  cy.get("img").should($images => {
    for (const image of $images.toArray()) expect((image as HTMLImageElement).naturalWidth).to.be.greaterThan(0);
  });
  cy.scrollTo("top");
  cy.screenshot(name, { capture: "fullPage" });
  cy.document().then(document => {
    document.querySelector("header")!.style.position = "sticky";
    document.getElementById("evidence-toast-style")!.remove();
  });
}
