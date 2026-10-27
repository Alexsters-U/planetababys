"use client";

/**
 * Formulario de producto (crear/editar) con subida de imagen.
 * La subida se hace a /api/admin/products/image (solo admins) y devuelve
 * la URL pública que se guarda con el producto.
 */
import { useRef, useState } from "react";
import { CATEGORIES, productCreateSchema, priceInputSchema, stockInputSchema, PRICE_PATTERN, PRICE_MESSAGE, INTEGER_PATTERN, STOCK_MESSAGE } from "@/lib/validation";
import {toast} from "sonner";
import { categoryLabel } from "@/lib/labels";
import { formatCOP } from "@/lib/money";
import { spanishValidation } from "@/shared/forms/spanish-validation";
import RestrictedInput from "@/shared/forms/restricted-input";
import { getProductPricing, promotionDateInput, promotionDateISO, formatPromotionDate, PROMOTION_LABELS } from "@/shared/promotions";
import { PriceDisplay } from "@/shared/ui/product-price";

export type ProductFormData = {
  id?: string;
  name: string;
  description: string;
  priceCents: number;
  stock: number;
  category: string;
  isActive: boolean;
  isFeatured: boolean;
  imageUrl: string | null;
  promotionEnabled?: boolean;
  promotionPriceCents?: number | null;
  promotionStartsAt?: string | null;
  promotionEndsAt?: string | null;
  pricingAsOf?: string;
};

export default function ProductForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial?: Partial<ProductFormData>;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [price, setPrice] = useState(
    initial?.priceCents ? String(initial.priceCents / 100) : ""
  );
  const [stock, setStock] = useState(String(initial?.stock ?? 0));
  const [category, setCategory] = useState(initial?.category ?? "general");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [isFeatured, setIsFeatured] = useState(initial?.isFeatured ?? false);
  const [promotionEnabled, setPromotionEnabled] = useState(initial?.promotionEnabled ?? false);
  const [promotionPrice, setPromotionPrice] = useState(initial?.promotionPriceCents ? String(initial.promotionPriceCents / 100) : "");
  const [promotionStartsAt, setPromotionStartsAt] = useState(promotionDateInput(initial?.promotionStartsAt));
  const [promotionEndsAt, setPromotionEndsAt] = useState(promotionDateInput(initial?.promotionEndsAt));
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.imageUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const parsedPrice = priceInputSchema.safeParse(price);
  const parsedOffer = priceInputSchema.safeParse(promotionPrice);
  const preview = getProductPricing({
    priceCents: parsedPrice.success ? parsedPrice.data : 0,
    promotionEnabled,
    promotionPriceCents: parsedOffer.success ? parsedOffer.data : null,
    promotionStartsAt: promotionDateISO(promotionStartsAt),
    promotionEndsAt: promotionDateISO(promotionEndsAt),
  });

  async function handleUpload(file: File) {
    setError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/products/image", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "No se pudo subir la imagen");
        return;
      }
      setImageUrl(data.url);
    } catch {
      setError("Error de conexión al subir la imagen");
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const priceResult = priceInputSchema.safeParse(price);
    const stockResult = stockInputSchema.safeParse(stock);
    if (!name || name.length < 3) {
      setError("El nombre debe tener al menos 3 caracteres");
      return;
    }
    if (!priceResult.success) {
      setError(priceResult.error.issues[0]?.message ?? PRICE_MESSAGE);
      return;
    }
    if (!stockResult.success) {
      setError(stockResult.error.issues[0]?.message ?? STOCK_MESSAGE);
      return;
    }
    if (promotionEnabled && !parsedOffer.success) {
      setError("Ingresa un precio de oferta válido, desde $1 COP y con hasta dos decimales.");
      return;
    }

    const body = {
      name,
      description,
      priceCents: priceResult.data,
      stock: stockResult.data,
      category,
      isActive,
      isFeatured,
      imageUrl,
      promotionEnabled,
      promotionPriceCents: promotionEnabled && parsedOffer.success ? parsedOffer.data : null,
      promotionStartsAt: promotionEnabled ? promotionDateISO(promotionStartsAt) : null,
      promotionEndsAt: promotionEnabled ? promotionDateISO(promotionEndsAt) : null,
    };
    const validated=productCreateSchema.safeParse(body);
    if(!validated.success){setError(validated.error.issues[0]?.message??"Datos inválidos");return;}

    setSaving(true);
    try {
      const res = await fetch(
        initial?.id ? `/api/admin/products/${initial.id}` : "/api/admin/products",
        {
          method: initial?.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validated.data),
        }
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "No se pudo guardar el producto");
        return;
      }
      toast.success(initial?.id?"Producto actualizado":"Producto creado");
      onSaved();
    } catch {
      setError("Error de conexión");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form {...spanishValidation} onSubmit={handleSubmit} className="space-y-4" data-testid="product-form">
      <div>
        <label htmlFor="p-name" className="label">
          Nombre del producto *
        </label>
        <input
          id="p-name"
          data-testid="product-name-input"
          className="input"
          required
          minLength={3}
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Pañales Babysec Etapa 1 (x40)"
        />
      </div>

      <div>
        <label htmlFor="p-desc" className="label">
          Descripción
        </label>
        <textarea
          id="p-desc"
          data-testid="product-description-input"
          className="input"
          rows={3}
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Características, contenidos, tallas disponibles..."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="p-price" className="label">
            Precio habitual (COP) *
          </label>
          <RestrictedInput restriction="decimal"
            id="p-price"
            data-testid="product-price-input"
            className="input"
            required
            inputMode="decimal"
            pattern={PRICE_PATTERN}
            data-format-message={PRICE_MESSAGE}
            maxLength={12}
            aria-describedby="p-price-help"
            value={price}
            onValueChange={setPrice}
            placeholder="34900"
          />
          <p id="p-price-help" className="mt-1 text-xs text-gray-500">Ejemplo: 25000 o 25000,50. Sin separadores de miles.</p>
          {parsedPrice.success && (
            <p className="mt-1 text-xs text-gray-500">
              {formatCOP(parsedPrice.data)}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="p-stock" className="label">
            Stock *
          </label>
          <RestrictedInput restriction="integer"
            id="p-stock"
            data-testid="product-stock-input"
            className="input"
            required
            inputMode="numeric"
            pattern={INTEGER_PATTERN}
            data-format-message={STOCK_MESSAGE}
            maxLength={6}
            aria-describedby="p-stock-help"
            value={stock}
            onValueChange={setStock}
            placeholder="10"
          />
          <p id="p-stock-help" className="mt-1 text-xs text-gray-500">Número entero entre 0 y 100000, sin signos ni decimales.</p>
        </div>
        <div>
          <label htmlFor="p-cat" className="label">
            Categoría
          </label>
          <select
            id="p-cat"
            data-testid="product-category-select"
            className="input"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <fieldset className="rounded-2xl border border-mint-200 bg-mint-50 p-4" data-testid="promotion-fields">
        <legend className="px-2 text-sm font-bold text-mint-800">Promoción</legend>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={promotionEnabled} onChange={e => setPromotionEnabled(e.target.checked)} data-testid="promotion-enabled-input" className="h-4 w-4" />
          Ofrecer promoción
        </label>
        <p className="mt-2 text-sm text-gray-600">Ofrece un precio menor al habitual. El producto conserva su categoría y puede seguir destacado.</p>
        {promotionEnabled && <div className="mt-4 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="p-offer" className="label">Precio de oferta (COP) *</label>
              <RestrictedInput restriction="decimal" id="p-offer" className="input" data-testid="promotion-price-input" required inputMode="decimal" pattern={PRICE_PATTERN} data-format-message={PRICE_MESSAGE} maxLength={12} value={promotionPrice} onValueChange={setPromotionPrice} aria-describedby="p-offer-help" placeholder="19900" />
              <p id="p-offer-help" className="mt-1 text-xs text-gray-600">Sin separadores de miles. Debe ser menor al precio habitual.</p>
              {parsedPrice.success && parsedOffer.success && parsedOffer.data >= parsedPrice.data && <p className="mt-1 text-sm text-red-600">La oferta debe ser menor al precio habitual.</p>}
            </div>
            <div>
              <label htmlFor="p-offer-end" className="label">Finaliza el *</label>
              <input id="p-offer-end" type="datetime-local" className="input" data-testid="promotion-end-input" required value={promotionEndsAt} onChange={e => setPromotionEndsAt(e.target.value)} />
              <p className="mt-1 text-xs text-gray-600">Al finalizar, vuelve automáticamente al precio habitual.</p>
            </div>
          </div>
          <details open={promotionStartsAt ? true : undefined}>
            <summary className="cursor-pointer text-sm font-semibold text-mint-800">Programar inicio (opcional)</summary>
            <label htmlFor="p-offer-start" className="label mt-3">Comienza el</label>
            <input id="p-offer-start" type="datetime-local" className="input" data-testid="promotion-start-input" value={promotionStartsAt} onChange={e => setPromotionStartsAt(e.target.value)} />
            <p className="mt-1 text-xs text-gray-600">Déjalo vacío para comenzar al guardar. Debe ser anterior a la fecha de finalización.</p>
          </details>
          <p className="text-xs font-semibold text-gray-600">Todas las fechas usan la hora de Colombia (UTC−5).</p>
          {preview.promotionStatus !== "none" && <div className="rounded-xl border border-mint-200 bg-white p-3" aria-live="polite" data-testid="promotion-preview">
            <p className="mb-2 text-sm font-semibold">{PROMOTION_LABELS[preview.promotionStatus]}</p>
            <PriceDisplay priceCents={parsedOffer.success ? parsedOffer.data : 0} originalPriceCents={parsedPrice.success ? parsedPrice.data : null} discountPercent={Math.floor((1 - (parsedOffer.success ? parsedOffer.data : 0) / (parsedPrice.success ? parsedPrice.data : 1)) * 100)} />
            {preview.promotionStatus === "scheduled" && <p className="mt-2 text-xs text-gray-600">Comienza el {formatPromotionDate(promotionDateISO(promotionStartsAt)!)}.</p>}
            {preview.promotionStatus === "expired" && <p className="mt-2 text-sm text-amber-800">Esta oferta terminó. Actualiza las fechas para renovarla; la tienda muestra el precio habitual.</p>}
          </div>}
        </div>}
        {!promotionEnabled && initial?.promotionEnabled && <p className="mt-3 text-sm text-gray-600">Al guardar, se retirará la oferta y se usará el precio habitual.</p>}
      </fieldset>

      <div>
        <label className="label">Imagen del producto</label>
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-baby-pink-50">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="Vista previa" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-2xl" aria-hidden>
                🖼️
              </div>
            )}
          </div>
          <div className="flex-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              data-testid="product-image-input"
              className="block w-full text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-baby-pink-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-baby-pink-700 hover:file:bg-baby-pink-200"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUpload(f);
              }}
            />
            <p className="mt-1 text-xs text-gray-500">
              JPG, PNG, WEBP o AVIF · máx 5MB {uploading && "· subiendo..."}
            </p>
            {imageUrl && (
              <button
                type="button"
                className="mt-1 text-xs text-red-500 hover:underline"
                onClick={() => setImageUrl(null)}
              >
                Quitar imagen
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            data-testid="product-active-input"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4"
          />
          Visible en la tienda
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            data-testid="product-featured-input"
            checked={isFeatured}
            onChange={(e) => setIsFeatured(e.target.checked)}
            className="h-4 w-4"
          />
          Destacado en inicio
        </label>
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-600" role="alert" data-testid="product-form-error">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
        <button type="button" onClick={onCancel} className="btn-outline" data-testid="product-form-cancel">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving || uploading}
          className="btn-primary disabled:opacity-50"
          data-testid="product-form-submit"
        >
          {saving ? "Guardando..." : initial?.id ? "Guardar cambios" : "Crear producto"}
        </button>
      </div>
    </form>
  );
}
