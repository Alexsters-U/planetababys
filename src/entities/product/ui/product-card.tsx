import Link from "next/link";
import ProductPrice from "@/shared/ui/product-price";
import type {PromotionSource} from "@/shared/promotions";
import AddToCart from "@/features/cart/ui/add-to-cart";
import ProductImage from "@/shared/ui/product-image";
import { productImageUrl } from "@/shared/brand/product-images";

export type ProductCardData = PromotionSource & {
  id: string;
  slug: string;
  name: string;
  priceCents: number;
  stock: number;
  imageUrl: string | null;
  alt?: string;
};

export default function ProductCard({ product }: { product: ProductCardData }) {
  return (
    <article
      data-testid="product-card"
      data-product-id={product.id}
      className="card product-card flex flex-col overflow-hidden"
    >
      <Link href={`/producto/${product.slug}`} className="block">
        <div className="aspect-square w-full overflow-hidden bg-baby-pink-50">
          <ProductImage slug={product.slug} url={product.imageUrl} alt={product.alt ?? product.name} />
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <Link
          href={`/producto/${product.slug}`}
          className="line-clamp-2 min-h-10 text-sm font-bold text-brand-ink hover:text-brand-primary"
        >
          {product.name}
        </Link>
        <ProductPrice product={product}/>
        <div className="mt-auto">
          <AddToCart
            product={{
              productId: product.id,
              slug: product.slug,
              name: product.name,
              priceCents: product.priceCents,
              promotionEnabled:product.promotionEnabled,promotionPriceCents:product.promotionPriceCents,
              promotionStartsAt:product.promotionStartsAt,promotionEndsAt:product.promotionEndsAt,pricingAsOf:product.pricingAsOf,
              imageUrl: productImageUrl(product.slug, product.imageUrl),
              stock: product.stock,
            }}
          />
        </div>
      </div>
    </article>
  );
}
