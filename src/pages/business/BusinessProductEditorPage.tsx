import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowLeft,
  Check,
  ImagePlus,
  Plus,
  Save,
  Upload,
  X,
} from 'lucide-react'
import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'

import { BusinessPageHeader } from '../../components/business/BusinessPageHeader'
import { Button } from '../../components/ui/Button'
import { Container } from '../../components/layout/LayoutPrimitives'
import type {
  DemoProductStatus,
  ProductCategory,
  ProductSize,
} from '../../data/productTypes'
import { classNames } from '../../lib/classNames'
import {
  getVariantKey,
  type CreateDemoProductInput,
  useDemoStore,
} from '../../store/demoStore'

const categories: Array<{ value: ProductCategory; label: string }> = [
  { value: 'dress', label: 'Dress' },
  { value: 'top', label: 'Top' },
  { value: 'kurti', label: 'Kurti' },
  { value: 'waistcoat', label: 'Waistcoat' },
]

const availableSizes: ProductSize[] = ['S', 'M', 'L', 'XL', 'XXL', 'Free size']

const demoImages = [
  {
    label: 'Brown off-shoulder dress',
    src: '/products/brown-off-shoulder-dress/primary.png',
  },
  {
    label: 'Lace trimmed top',
    src: '/products/lace-trimmed-top/primary.png',
  },
  {
    label: 'Lime shells corset kurti',
    src: '/products/lime-shells-corset-kurti/primary.png',
  },
] as const

type FormErrors = Partial<Record<'name' | 'price' | 'description' | 'image' | 'colors' | 'sizes' | 'stock', string>>

const inputClasses =
  'min-h-12 w-full rounded-xl border border-ovia-line bg-white px-4 text-sm text-ovia-ink placeholder:text-ovia-muted/55 transition-colors hover:border-ovia-primary/50 focus:border-ovia-primary focus:outline-none focus-visible:ring-3 focus-visible:ring-ovia-primary/20 aria-invalid:border-red-500'

function stockDraftKey(color: string, size: ProductSize) {
  return `${color}\u0000${size}`
}

export function BusinessProductEditorPage() {
  const { productId } = useParams()
  const navigate = useNavigate()
  const createdProducts = useDemoStore((state) => state.createdProducts)
  const inventory = useDemoStore((state) => state.inventoryByVariant)
  const createProduct = useDemoStore((state) => state.createProduct)
  const updateProduct = useDemoStore((state) => state.updateProduct)
  const existingProduct = productId
    ? createdProducts.find((product) => product.id === productId)
    : undefined
  const isEditing = Boolean(productId)

  const [name, setName] = useState(existingProduct?.catalogueName ?? '')
  const [category, setCategory] = useState<ProductCategory>(existingProduct?.category ?? 'top')
  const [price, setPrice] = useState(
    existingProduct ? String(existingProduct.priceInPaise / 100) : '',
  )
  const [description, setDescription] = useState(existingProduct?.description ?? '')
  const [image, setImage] = useState(existingProduct?.image ?? '')
  const [colors, setColors] = useState<string[]>(
    existingProduct?.colors.map((color) => color.label) ?? [],
  )
  const [colorDraft, setColorDraft] = useState('')
  const [sizes, setSizes] = useState<ProductSize[]>(
    existingProduct ? [...existingProduct.sizes] : [],
  )
  const [publicationStatus, setPublicationStatus] =
    useState<DemoProductStatus>(existingProduct?.publicationStatus ?? 'active')
  const [stockByVariant, setStockByVariant] = useState<Record<string, number>>(
    () => {
      if (!existingProduct) return {}
      return Object.fromEntries(
        existingProduct.colors.flatMap((color) =>
          existingProduct.sizes.map((size) => [
            stockDraftKey(color.label, size),
            inventory[
              getVariantKey(existingProduct.id, size, color.label)
            ] ?? 0,
          ]),
        ),
      )
    },
  )
  const [errors, setErrors] = useState<FormErrors>({})
  const [imageError, setImageError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const colorInputRef = useRef<HTMLInputElement>(null)

  const variants = useMemo(
    () => colors.flatMap((color) => sizes.map((size) => ({ color, size }))),
    [colors, sizes],
  )

  if (isEditing && !existingProduct) {
    return <Navigate replace to="/business/products" />
  }

  const addColor = () => {
    const value = colorDraft.trim()
    if (!value) {
      setErrors((current) => ({ ...current, colors: 'Enter a color name first.' }))
      colorInputRef.current?.focus()
      return
    }
    if (colors.some((color) => color.toLowerCase() === value.toLowerCase())) {
      setErrors((current) => ({ ...current, colors: 'That color is already added.' }))
      return
    }
    setColors((current) => [...current, value])
    setColorDraft('')
    setErrors((current) => ({ ...current, colors: undefined }))
  }

  const removeColor = (color: string) => {
    setColors((current) => current.filter((item) => item !== color))
    setStockByVariant((current) =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([key]) => !key.startsWith(`${color}\u0000`),
        ),
      ),
    )
  }

  const toggleSize = (size: ProductSize) => {
    if (sizes.includes(size)) {
      setSizes((current) => current.filter((item) => item !== size))
      setStockByVariant((current) =>
        Object.fromEntries(
          Object.entries(current).filter(
            ([key]) => !key.endsWith(`\u0000${size}`),
          ),
        ),
      )
      return
    }
    setSizes((current) => [...current, size])
    setErrors((current) => ({ ...current, sizes: undefined }))
  }

  const handleImageUpload = (file?: File) => {
    setImageError(null)
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setImageError('Choose a JPG, PNG, WEBP, or another image file.')
      return
    }
    if (file.size > 1_000_000) {
      setImageError('Choose an image under 1 MB so it can persist in this browser demo.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') return
      setImage(reader.result)
      setErrors((current) => ({ ...current, image: undefined }))
    }
    reader.onerror = () => setImageError('The image could not be read. Try another file.')
    reader.readAsDataURL(file)
  }

  const validate = () => {
    const nextErrors: FormErrors = {}
    const numericPrice = Number(price)

    if (!name.trim()) nextErrors.name = 'Product name is required.'
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      nextErrors.price = 'Enter a price greater than ₹0.'
    }
    if (!description.trim()) nextErrors.description = 'Description is required.'
    if (!image) nextErrors.image = 'Choose or upload a product image.'
    if (colors.length === 0) nextErrors.colors = 'Add at least one color.'
    if (sizes.length === 0) nextErrors.sizes = 'Add at least one size.'
    if (
      variants.some(({ color, size }) => {
        const quantity = stockByVariant[stockDraftKey(color, size)] ?? 0
        return !Number.isInteger(quantity) || quantity < 0 || quantity > 999
      })
    ) {
      nextErrors.stock = 'Stock must be a whole number from 0 to 999.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!validate()) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    const input: CreateDemoProductInput = {
      catalogueName: name.trim(),
      category,
      priceInPaise: Math.round(Number(price) * 100),
      description: description.trim(),
      image,
      colors: colors.map((label) => ({
        label,
        evidence: 'demo-entered',
        selectable: true,
      })),
      sizes,
      publicationStatus,
      variants: variants.map(({ color, size }) => ({
        color,
        size,
        quantity: stockByVariant[stockDraftKey(color, size)] ?? 0,
      })),
    }

    if (existingProduct) {
      updateProduct(existingProduct.id, input)
      setToast(`${input.catalogueName} was updated.`)
      window.setTimeout(() => setToast(null), 3200)
      return
    }

    const product = createProduct(input)
    setToast(`${product.catalogueName} was created successfully.`)
    window.setTimeout(() => setToast(null), 3200)
    navigate(`/business/products/${product.id}`, { replace: true })
  }

  return (
    <Container className="py-7 sm:py-10">
      <Link
        className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-full text-sm font-bold text-ovia-muted hover:text-ovia-primary"
        to="/business/products"
      >
        <ArrowLeft aria-hidden="true" size={16} />
        Back to products
      </Link>

      <BusinessPageHeader
        description="Build a browser-only demo product with color-by-size inventory. Nothing here is sent to a backend."
        eyebrow="Products"
        title={existingProduct ? `Edit ${existingProduct.catalogueName}` : 'Add a product'}
      />

      {Object.keys(errors).length > 0 && (
        <div
          aria-live="assertive"
          className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          data-testid="product-form-errors"
          role="alert"
        >
          <strong>Review the highlighted fields.</strong> Complete the required product details before saving.
        </div>
      )}

      <form className="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]" noValidate onSubmit={handleSubmit}>
        <div className="space-y-5">
          <section className="rounded-card border border-ovia-line bg-white p-5 shadow-card sm:p-7">
            <div>
              <p className="text-xs font-bold tracking-[0.12em] text-ovia-primary uppercase">Product details</p>
              <h2 className="mt-2 font-display text-2xl text-ovia-ink">The storefront essentials</h2>
            </div>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-2 block text-sm font-bold text-ovia-ink">Product name <span className="text-ovia-primary">*</span></span>
                <input
                  aria-invalid={Boolean(errors.name)}
                  className={inputClasses}
                  data-testid="product-name"
                  onChange={(event) => {
                    setName(event.target.value)
                    setErrors((current) => ({ ...current, name: undefined }))
                  }}
                  placeholder="e.g. Brown Top"
                  value={name}
                />
                {errors.name && <span className="mt-1.5 block text-xs text-red-700">{errors.name}</span>}
              </label>
              <label>
                <span className="mb-2 block text-sm font-bold text-ovia-ink">Category <span className="text-ovia-primary">*</span></span>
                <select className={inputClasses} data-testid="product-category" onChange={(event) => setCategory(event.target.value as ProductCategory)} value={category}>
                  {categories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
              </label>
              <label>
                <span className="mb-2 block text-sm font-bold text-ovia-ink">Price <span className="text-ovia-primary">*</span></span>
                <span className="relative block">
                  <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-sm font-bold text-ovia-muted">₹</span>
                  <input
                    aria-invalid={Boolean(errors.price)}
                    className={classNames(inputClasses, 'pl-9')}
                    data-testid="product-price"
                    inputMode="decimal"
                    min="1"
                    onChange={(event) => {
                      setPrice(event.target.value)
                      setErrors((current) => ({ ...current, price: undefined }))
                    }}
                    placeholder="699"
                    step="1"
                    type="number"
                    value={price}
                  />
                </span>
                {errors.price && <span className="mt-1.5 block text-xs text-red-700">{errors.price}</span>}
              </label>
              <label className="sm:col-span-2">
                <span className="mb-2 block text-sm font-bold text-ovia-ink">Description <span className="text-ovia-primary">*</span></span>
                <textarea
                  aria-invalid={Boolean(errors.description)}
                  className={classNames(inputClasses, 'min-h-32 resize-y py-3')}
                  data-testid="product-description"
                  maxLength={500}
                  onChange={(event) => {
                    setDescription(event.target.value)
                    setErrors((current) => ({ ...current, description: undefined }))
                  }}
                  placeholder="Describe the silhouette, styling, or key details."
                  value={description}
                />
                <span className="mt-1.5 flex justify-between gap-3 text-xs text-ovia-muted">
                  <span className="text-red-700">{errors.description}</span>
                  <span>{description.length}/500</span>
                </span>
              </label>
            </div>
          </section>

          <section className="rounded-card border border-ovia-line bg-white p-5 shadow-card sm:p-7">
            <p className="text-xs font-bold tracking-[0.12em] text-ovia-primary uppercase">Product image</p>
            <h2 className="mt-2 font-display text-2xl text-ovia-ink">Choose a demo visual</h2>
            <p className="mt-2 text-sm leading-6 text-ovia-muted">Select an existing Ovia catalogue crop for this demo workflow, or upload your own image. No image is generated or redesigned.</p>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {demoImages.map((option) => (
                <button
                  aria-label={`Use ${option.label}`}
                  aria-pressed={image === option.src}
                  className={classNames(
                    'relative overflow-hidden rounded-2xl border-2 bg-ovia-ivory transition-colors',
                    image === option.src ? 'border-ovia-primary' : 'border-transparent hover:border-ovia-logo/50',
                  )}
                  data-testid={`demo-image-${option.src.split('/').at(-2)}`}
                  key={option.src}
                  onClick={() => {
                    setImage(option.src)
                    setImageError(null)
                    setErrors((current) => ({ ...current, image: undefined }))
                  }}
                  type="button"
                >
                  <img alt="" className="aspect-[4/5] w-full object-cover" src={option.src} />
                  {image === option.src && <span className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-ovia-primary text-white"><Check aria-hidden="true" size={15} /></span>}
                </button>
              ))}
            </div>
            <label className="mt-4 flex min-h-13 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-ovia-logo bg-ovia-blush/20 px-4 text-sm font-bold text-ovia-plum hover:bg-ovia-blush/40">
              <Upload aria-hidden="true" size={17} />
              Upload product image
              <input accept="image/jpeg,image/png,image/webp" className="sr-only" data-testid="product-image-upload" onChange={(event) => handleImageUpload(event.target.files?.[0])} type="file" />
            </label>
            {(errors.image || imageError) && <p className="mt-2 text-xs text-red-700">{imageError ?? errors.image}</p>}
          </section>

          <section className="rounded-card border border-ovia-line bg-white p-5 shadow-card sm:p-7">
            <p className="text-xs font-bold tracking-[0.12em] text-ovia-primary uppercase">Variants</p>
            <h2 className="mt-2 font-display text-2xl text-ovia-ink">Colors and sizes</h2>
            <p className="mt-2 text-sm leading-6 text-ovia-muted">Each color and size combination receives its own persisted stock quantity.</p>

            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div>
                <label className="text-sm font-bold text-ovia-ink" htmlFor="product-color">Colors <span className="text-ovia-primary">*</span></label>
                <div className="mt-2 flex gap-2">
                  <input
                    className={inputClasses}
                    data-testid="product-color"
                    id="product-color"
                    onChange={(event) => setColorDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return
                      event.preventDefault()
                      addColor()
                    }}
                    placeholder="e.g. Red"
                    ref={colorInputRef}
                    value={colorDraft}
                  />
                  <Button aria-label="Add color" data-testid="add-color" onClick={addColor} variant="secondary"><Plus aria-hidden="true" size={17} /></Button>
                </div>
                <div className="mt-3 flex min-h-9 flex-wrap gap-2" data-testid="selected-colors">
                  {colors.map((color) => (
                    <span className="inline-flex items-center gap-1 rounded-full bg-ovia-blush/55 py-1.5 pr-1.5 pl-3 text-sm font-bold text-ovia-plum" key={color}>
                      {color}
                      <button aria-label={`Remove color ${color}`} className="flex size-7 items-center justify-center rounded-full hover:bg-white/70" onClick={() => removeColor(color)} type="button"><X aria-hidden="true" size={14} /></button>
                    </span>
                  ))}
                </div>
                {errors.colors && <p className="mt-2 text-xs text-red-700">{errors.colors}</p>}
              </div>

              <div>
                <p className="text-sm font-bold text-ovia-ink">Sizes <span className="text-ovia-primary">*</span></p>
                <div className="mt-2 flex flex-wrap gap-2" data-testid="selected-sizes">
                  {availableSizes.map((size) => {
                    const selected = sizes.includes(size)
                    return (
                      <button
                        aria-pressed={selected}
                        className={classNames(
                          'inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-bold transition-colors',
                          selected ? 'border-ovia-primary bg-ovia-primary text-white' : 'border-ovia-line bg-white text-ovia-muted hover:border-ovia-primary hover:text-ovia-plum',
                        )}
                        data-testid={`toggle-size-${size}`}
                        key={size}
                        onClick={() => toggleSize(size)}
                        type="button"
                      >
                        {selected ? <X aria-hidden="true" size={13} /> : <Plus aria-hidden="true" size={13} />}
                        {size}
                      </button>
                    )
                  })}
                </div>
                {errors.sizes && <p className="mt-2 text-xs text-red-700">{errors.sizes}</p>}
              </div>
            </div>

            <div className="mt-7 border-t border-ovia-line pt-6">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-ovia-ink">Stock per variant <span className="text-ovia-primary">*</span></h3>
                  <p className="mt-1 text-xs text-ovia-muted">{variants.length} {variants.length === 1 ? 'variant' : 'variants'} generated from your selections</p>
                </div>
                <span className="rounded-full bg-ovia-ivory px-3 py-1 text-xs font-semibold text-ovia-muted">0–999 units</span>
              </div>
              {variants.length > 0 ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2" data-testid="variant-inventory">
                  {variants.map(({ color, size }) => {
                    const key = stockDraftKey(color, size)
                    return (
                      <label className="flex items-center gap-3 rounded-2xl border border-ovia-line bg-ovia-ivory/45 p-3" key={key}>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-ovia-ink">{color} / {size}</span>
                          <span className="mt-0.5 block text-xs text-ovia-muted">Simulated stock</span>
                        </span>
                        <input
                          aria-label={`${color} / ${size} stock`}
                          className="h-11 w-22 rounded-xl border border-ovia-line bg-white px-2 text-center text-sm font-bold text-ovia-ink focus:border-ovia-primary focus:outline-none"
                          data-testid={`stock-${color}-${size}`}
                          inputMode="numeric"
                          max="999"
                          min="0"
                          onChange={(event) => {
                            const quantity = Number.parseInt(event.target.value || '0', 10)
                            setStockByVariant((current) => ({ ...current, [key]: quantity }))
                            setErrors((current) => ({ ...current, stock: undefined }))
                          }}
                          type="number"
                          value={stockByVariant[key] ?? 0}
                        />
                      </label>
                    )
                  })}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-ovia-line px-4 py-8 text-center">
                  <p className="text-sm font-bold text-ovia-ink">Add colors and sizes to build inventory</p>
                  <p className="mt-1 text-xs text-ovia-muted">The variant matrix will appear here automatically.</p>
                </div>
              )}
              {errors.stock && <p className="mt-2 text-xs text-red-700">{errors.stock}</p>}
            </div>
          </section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-28">
          <section className="rounded-card border border-ovia-line bg-white p-5 shadow-card">
            <p className="text-xs font-bold tracking-[0.12em] text-ovia-primary uppercase">Publishing</p>
            <h2 className="mt-2 font-display text-2xl text-ovia-ink">Product status</h2>
            <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-ovia-ivory p-1" role="group" aria-label="Product status">
              {(['active', 'draft'] as DemoProductStatus[]).map((status) => (
                <button
                  aria-pressed={publicationStatus === status}
                  className={classNames(
                    'min-h-11 rounded-lg text-sm font-bold capitalize transition-colors',
                    publicationStatus === status ? 'bg-ovia-primary text-white shadow-sm' : 'text-ovia-muted hover:bg-white',
                  )}
                  data-testid={`product-status-${status}`}
                  key={status}
                  onClick={() => setPublicationStatus(status)}
                  type="button"
                >
                  {status}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs leading-5 text-ovia-muted">
              {publicationStatus === 'active'
                ? 'Active products appear in the customer storefront immediately.'
                : 'Draft products remain visible only in this business preview.'}
            </p>
          </section>

          <section className="overflow-hidden rounded-card border border-ovia-line bg-white shadow-card">
            <div className="aspect-[4/5] bg-ovia-ivory">
              {image ? (
                <img alt="Product preview" className="size-full object-cover" src={image} />
              ) : (
                <div className="flex size-full flex-col items-center justify-center px-6 text-center text-ovia-muted">
                  <ImagePlus aria-hidden="true" size={32} strokeWidth={1.4} />
                  <p className="mt-3 text-sm font-bold text-ovia-ink">Product preview</p>
                  <p className="mt-1 text-xs leading-5">Choose a demo image or upload one.</p>
                </div>
              )}
            </div>
            <div className="p-5">
              <p className="text-xs font-bold tracking-[0.1em] text-ovia-primary uppercase">{category}</p>
              <p className="mt-1 font-display text-2xl text-ovia-ink">{name.trim() || 'Untitled product'}</p>
              <p className="mt-2 font-bold text-ovia-plum">{Number(price) > 0 ? `₹${Number(price).toLocaleString('en-IN')}` : 'Price required'}</p>
              <p className="mt-2 text-xs text-ovia-muted">{colors.length} colors · {sizes.length} sizes · {variants.length} variants</p>
            </div>
          </section>

          <div className="grid gap-2">
            <Button data-testid="save-product" fullWidth size="lg" type="submit"><Save aria-hidden="true" size={18} /> Save Product</Button>
            <Link className="inline-flex min-h-11 items-center justify-center rounded-control text-sm font-bold text-ovia-muted hover:bg-ovia-blush/35 hover:text-ovia-plum" to="/business/products">Cancel</Link>
          </div>
        </aside>
      </form>

      <AnimatePresence>
        {toast && (
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            aria-live="polite"
            className="fixed right-4 bottom-4 left-4 z-50 flex items-center gap-3 rounded-2xl bg-ovia-ink px-4 py-3.5 text-sm text-white shadow-floating sm:right-6 sm:left-auto sm:max-w-md"
            data-testid="product-success-toast"
            exit={{ opacity: 0, y: 12 }}
            initial={{ opacity: 0, y: 12 }}
            role="status"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ovia-success"><Check aria-hidden="true" size={15} /></span>
            <span><strong className="block">Product saved</strong><span className="text-xs text-white/70">{toast}</span></span>
          </motion.div>
        )}
      </AnimatePresence>
    </Container>
  )
}
