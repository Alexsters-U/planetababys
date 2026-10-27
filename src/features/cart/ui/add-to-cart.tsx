"use client";

import { useState } from "react";
import { useCart } from "@/features/cart/model/use-cart";
import { toast } from "sonner";
import { INTEGER_PATTERN, quantityInputSchema } from "@/lib/validation";
import RestrictedInput from "@/shared/forms/restricted-input";
import {getProductPricing,type PromotionSource} from "@/shared/promotions";

export type AddToCartProduct = PromotionSource & {
  productId: string;
  slug: string;
  name: string;
  priceCents: number;
  imageUrl: string | null;
  stock: number;
};

export default function AddToCart({
  product,
  withQuantity = false,
}: {
  product: AddToCartProduct;
  withQuantity?: boolean;
}) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);
  const [quantityText, setQuantityText] = useState("1");

  const soldOut = product.stock <= 0;
  const maxQuantity = Math.min(product.stock, 50);
  const parsedQuantity = quantityInputSchema.safeParse(quantityText);
  const quantity = parsedQuantity.success ? parsedQuantity.data : 1;
  const quantityError = !parsedQuantity.success
    ? "Ingresa una cantidad entera entre 1 y " + maxQuantity + "."
    : quantity > maxQuantity ? `Solo puedes añadir hasta ${maxQuantity} unidades.` : "";
  const invalidQuantity = withQuantity && Boolean(quantityError);

  function handleAdd() {
    if (soldOut) return;
    if (invalidQuantity) { toast.error(quantityError); return; }
    const pricing=getProductPricing(product);
    if (!addItem({...product,priceCents:pricing.effectivePriceCents,originalPriceCents:pricing.originalPriceCents,
      discountPercent:pricing.discountPercent,promotionEndsAt:pricing.promotionActive?String(product.promotionEndsAt):null}, quantity)) { toast.error("No hay más unidades disponibles"); return; }
    toast.success("Añadido al carrito con éxito", { description: product.name });
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1600);
  }

  return (
    <div className={withQuantity ? "flex flex-col gap-3" : ""}>
      {withQuantity && !soldOut && (
        <div className="flex items-center gap-3">
          <label htmlFor="qty" className="text-sm font-medium text-gray-700">
            Cantidad
          </label>
          <div className="flex items-center rounded-lg border border-gray-300">
            <button
              type="button"
              className="px-3 py-1 text-lg text-gray-600 hover:text-baby-pink-600"
              onClick={() => setQuantityText(String(Math.max(1, quantity - 1)))}
              disabled={invalidQuantity || quantity <= 1}
              aria-label="Disminuir cantidad"
            >
              −
            </button>
            <RestrictedInput restriction="integer"
              id="qty"
              data-testid="quantity-input"
              type="text"
              inputMode="numeric"
              pattern={INTEGER_PATTERN}
              maxLength={6}
              aria-invalid={invalidQuantity}
              aria-describedby={invalidQuantity ? "qty-error" : undefined}
              value={quantityText}
              onValueChange={setQuantityText}
              className="w-14 border-x border-gray-300 py-1 text-center focus:outline-none"
            />
            <button
              type="button"
              className="px-3 py-1 text-lg text-gray-600 hover:text-baby-pink-600"
              onClick={() => setQuantityText(String(Math.min(quantity + 1, maxQuantity)))}
              disabled={invalidQuantity || quantity >= maxQuantity}
              aria-label="Aumentar cantidad"
            >
              +
            </button>
          </div>
        </div>
      )}
      {withQuantity && !soldOut && quantityError && (
        <p id="qty-error" data-testid="quantity-error" className="text-sm text-red-600" role="alert">{quantityError}</p>
      )}

      <button
        type="button"
        data-testid="add-to-cart"
        onClick={handleAdd}
        disabled={soldOut || invalidQuantity}
        className={
          "btn-primary w-full " +
          (soldOut || invalidQuantity ? "cursor-not-allowed opacity-50" : "")
        }
      >
        {soldOut
          ? "Agotado"
          : added
            ? "✓ Añadido al carrito"
            : "Añadir al carrito"}
      </button>
    </div>
  );
}
