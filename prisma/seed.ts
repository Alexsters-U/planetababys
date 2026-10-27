/**
 * Seed inicial: usuario admin + productos demo.
 * Idempotente: puede ejecutarse varias veces sin duplicar datos.
 *
 * Credenciales por defecto (SOLO desarrollo/demo):
 *   test@admin.com / password
 * Cámbialas con las variables SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import catalogImages from "../src/shared/brand/catalog-images.json";

const prisma = new PrismaClient();

const DEMO_PRODUCTS = [
  {
    slug: "panales-babysec-etapa-1",
    name: "Pañales suaves · Etapa 1 (x40)",
    description:
      "Pañales ultra absorbentes para recién nacidos, con cintura elástica y canal distribuidor. Hasta 12 horas de protección. Empaque de 40 unidades.",
    priceCents: 3490000,
    stock: 25,
    category: "panales",
    isFeatured: true,
    alt: "Paquete de pañales etapa 1",
  },
  {
    slug: "panales-babysec-etapa-2",
    name: "Pañales suaves · Etapa 2 (x40)",
    description:
      "Para bebés de 6 a 11 kg. Máxima absorción y suavidad con loción protectora. Empaque de 40 unidades.",
    priceCents: 3490000,
    stock: 30,
    category: "panales",
    isFeatured: true,
    alt: "Paquete de pañales etapa 2",
  },
  {
    slug: "toallas-humedas-aloe",
    name: "Toallas Húmedas con Aloe (x72)",
    description:
      "Toallas húmedas hipoalergénicas con aloe y sin alcohol. Ideales para la piel delicada del bebé. Empaque de 72 unidades.",
    priceCents: 990000,
    stock: 40,
    category: "panales",
    isFeatured: false,
    alt: "Toallas húmedas con aloe",
  },
  {
    slug: "biberon-anticolico-260ml",
    name: "Biberón Anticólico 260 ml",
    description:
      "Biberón con válvula anticólico, tetina de silicona ultrisuave fluxo flexible. Libre de BPA. Apto para lavavajillas y esterilizador.",
    priceCents: 2590000,
    stock: 18,
    category: "lactancia",
    isFeatured: true,
    alt: "Biberón anticólico 260ml",
  },
  {
    slug: "chupete-ortodontico-silicona",
    name: "Chupete Ortodóntico de Silicona",
    description:
      "Chupete anatómico que respalda el desarrollo natural del paladar. Talla 2 (6-18 meses). Presentación con cubre chupón.",
    priceCents: 1290000,
    stock: 35,
    category: "lactancia",
    isFeatured: false,
    alt: "Chupete ortodóntico de silicona",
  },
  {
    slug: "enterito-algodon-organico",
    name: "Enterito de Algodón Orgánico",
    description:
      "Enterito de manga larga en algodón orgánico, suave con la piel del bebé. Disponible en tintas pasteles. Tallas 0 a 12 meses.",
    priceCents: 3990000,
    stock: 20,
    category: "ropa",
    isFeatured: true,
    alt: "Enterito de algodón orgánico",
  },
  {
    slug: "kit-higiene-recien-nacido",
    name: "Kit de Higiene Recién Nacido",
    description:
      "Incluye cortauñas de seguridad, aspirador nasal, cepillo de pelo suave, termómetro digital y mansitos para la hora del baño. Estuche práctico para viaje.",
    priceCents: 4590000,
    stock: 12,
    category: "higiene",
    isFeatured: true,
    alt: "Kit de higiene para recién nacido",
  },
  {
    slug: "shampoo-sin-lagrimas-500ml",
    name: "Shampoo Sin Lágrimas 500 ml",
    description:
      "Fórmula neutra sin lágrimas con camomila, pH balanceado. Hipoalergénico, dermatológicamente testeado.",
    priceCents: 1890000,
    stock: 22,
    category: "higiene",
    isFeatured: false,
    alt: "Shampoo sin lágrimas 500 ml",
  },
  {
    slug: "osito-peluche-40cm",
    name: "Osito de Peluche 40 cm",
    description:
      "Peluche abrazable de 40 cm en felpa extra suave, apto para bebés desde 0 meses. Lavable a máquina.",
    priceCents: 5990000,
    stock: 10,
    category: "juguetes",
    isFeatured: true,
    alt: "Osito de peluche 40 cm",
  },
  {
    slug: "sonajeros-set-3-piezas",
    name: "Set de Sonajeros (3 piezas)",
    description:
      "Set de 3 sonajeros con texturas y colores estimulantes. Favorecen la coordinación ojo-mano. Libres de BPA.",
    priceCents: 2290000,
    stock: 16,
    category: "juguetes",
    isFeatured: false,
    alt: "Set de sonajeros 3 piezas",
  },
  {
    slug: "coche-paseo-ligero",
    name: "Coche Paseo Ligero",
    description:
      "Coche de paseo plegable ultraligero (6.5 kg), respaldo reclinable, canopy extensible y cesta portaobjetos. Para bebés desde 6 meses.",
    priceCents: 34900000,
    stock: 4,
    category: "accesorios",
    isFeatured: true,
    alt: "Coche de paseo ligero",
  },
  {
    slug: "silla-de-comer-boost",
    name: "Silla de Comer Boost",
    description:
      "Silla elevadora para comer, con bandeja removible, arnés de 3 puntos y patas antideslizantes. De 6 meses a 4 años.",
    priceCents: 12900000,
    stock: 6,
    category: "accesorios",
    isFeatured: false,
    alt: "Silla de comer boost",
  },
];

async function main() {
  const prod=process.env.APP_ENV==="production";
  if(prod && (!process.env.SEED_ADMIN_EMAIL || !process.env.SEED_ADMIN_PASSWORD || process.env.SEED_ADMIN_PASSWORD==="password" || process.env.SEED_ADMIN_PASSWORD.length<16 || process.env.SEED_ADMIN_EMAIL==="test@admin.com")) throw new Error("Producción requiere credenciales administrativas propias y contraseña de 16 caracteres");
  const email = process.env.SEED_ADMIN_EMAIL || "test@admin.com";
  const password = process.env.SEED_ADMIN_PASSWORD || "password";
  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.adminUser.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash, name: "Administrador Planeta Baby's" },
  });
  console.log(`✓ Admin listo: ${admin.email}`);

  if(process.env.SEED_DEMO_CATALOG !== "true") return;
  if(prod) throw new Error("El catálogo ficticio no puede sembrarse en producción");
  for (const p of DEMO_PRODUCTS) {
    const asset = (catalogImages as Record<string, string>)[p.slug];
    const imageUrl = `/images/products/branding-2026-10-02/${asset}.webp`;
    const product = await prisma.product.upsert({
      where: { slug: p.slug },
      update: {},
      create: {
        slug: p.slug,
        name: p.name,
        description: p.description,
        priceCents: p.priceCents,
        stock: p.stock,
        category: p.category,
        isFeatured: p.isFeatured,
      },
    });

    const existing = await prisma.productImage.findFirst({
      where: { productId: product.id, sort: 0 },
    });
    if (!existing) {
      await prisma.productImage.create({
        data: { productId: product.id, url: imageUrl, alt: p.alt + " · imagen ilustrativa generada por IA", sort: 0 },
      });
    }
  }
  console.log(`✓ ${DEMO_PRODUCTS.length} productos demo listos`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

