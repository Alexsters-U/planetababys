import type { Metadata } from "next";
import "./globals.css";
import "@fontsource/nunito-sans/400.css";
import "@fontsource/nunito-sans/600.css";
import "@fontsource/nunito-sans/700.css";
import "@fontsource/nunito-sans/800.css";
import Header from "@/widgets/header/ui/header";
import Footer from "@/widgets/footer/ui/footer";
import { Providers } from "@/shared/ui/providers";
import {indexingEnabled,publicSiteUrl} from "@/shared/seo";
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase:publicSiteUrl(),
  robots:indexingEnabled()?{index:true,follow:true}:{index:false,follow:false},
  openGraph:{type:"website",locale:"es_CO",siteName:"Planeta Baby's",title:"Planeta Baby's · Todo para su mundo todo para su bienestar",description:"Esenciales para los días en familia. Con cariño, desde Mocoa, Putumayo.",images:[{url:"/images/brand/icon-512.png",width:512,height:512}]},
  icons: {
    icon: [
      { url: "/favicon.ico?v=20261002-transparent", type: "image/x-icon", sizes: "16x16 32x32 48x48" },
      { url: "/images/brand/icon-32.png?v=20261002-transparent", type: "image/png", sizes: "32x32" },
      { url: "/images/brand/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/images/brand/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon.ico?v=20261002-transparent",
  },
  title: {
    default: "Planeta Baby's · Productos para bebé en Mocoa",
    template: "%s · Planeta Baby's",
  },
  description:
    "Tienda de productos para bebé en Mocoa, Putumayo: pañales, lactancia, ropa, higiene y juguetes. Pago seguro con Wompi y entrega en Mocoa.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <Providers>
          <Header />
          <main className="min-h-[70vh]">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
