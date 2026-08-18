import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Plus,
  Save,
  Star,
  Upload,
  X,
} from 'lucide-react'
import { useMemo, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'

import { BusinessPageHeader } from '../../components/business/BusinessPageHeader'
import { Container } from '../../components/layout/LayoutPrimitives'
import { Button } from '../../components/ui/Button'
import {
  getProductSelections,
  type DemoProductStatus,
  type JewelleryOptionName,
  type ProductCategory,
  type ProductSelection,
  type ProductVariantOption,
} from '../../data/productTypes'
import { classNames } from '../../lib/classNames'
import {
  getVariantKey,
  type CreateDemoProductInput,
  useDemoStore,
} from '../../store/demoStore'

const categories: Array<{ value: ProductCategory; label: string }> = [
  { value: 'necklace', label: 'Necklace' },
  { value: 'earrings', label: 'Earrings' },
  { value: 'bracelet', label: 'Bracelet' },
  { value: 'ring', label: 'Ring' },
  { value: 'anklet', label: 'Anklet' },
]

const jewelleryOptionNames: JewelleryOptionName[] = [
  'Ring Size',
  'Finish',
  'Color',
  'Length',
  'Stone',
]

const demoImages = [
  {
    label: 'Wave station ring demo',
    images: [
      '/products/demo/wave-station-ring/hero.jpg',
      '/products/demo/wave-station-ring/detail-01.jpg',
      '/products/demo/wave-station-ring/detail-02.jpg',
      '/products/demo/wave-station-ring/editorial.jpg',
    ],
  },
  {
    label: 'Asymmetric stone huggies demo',
    images: [
      '/products/demo/asymmetric-stone-huggies/hero.jpg',
      '/products/demo/asymmetric-stone-huggies/detail-01.jpg',
      '/products/demo/asymmetric-stone-huggies/detail-02.jpg',
      '/products/demo/asymmetric-stone-huggies/editorial.jpg',
    ],
  },
  {
    label: 'Seven station anklet demo',
    images: [
      '/products/demo/seven-station-anklet/hero.jpg',
      '/products/demo/seven-station-anklet/detail-01.jpg',
      '/products/demo/seven-station-anklet/detail-02.jpg',
      '/products/demo/seven-station-anklet/editorial.jpg',
    ],
  },
] as const

type FormErrors = Partial<
  Record<
    'name' | 'price' | 'description' | 'images' | 'optionValues' | 'stock',
    string
  >
>

interface VariantGroupDraft {
  key: string
  name: JewelleryOptionName
  values: string[]
  valueDraft: string
}

const inputClasses =
  'min-h-12 w-full rounded-xl border border-ovia-line bg-white px-4 text-sm text-ovia-ink placeholder:text-ovia-muted/55 transition-colors hover:border-ovia-primary/50 focus:border-ovia-primary focus:outline-none focus-visible:ring-3 focus-visible:ring-ovia-primary/20 aria-invalid:border-red-500'

function optionId(name: JewelleryOptionName) {
  return name.toLowerCase().replace(/\s+/g, '-')
}

function stockDraftKey(selection: ProductSelection) {
  return JSON.stringify(
    Object.entries(selection).sort(([left], [right]) =>
      left.localeCompare(right),
    ),
  )
}

function selectionLabel(
  selection: ProductSelection,
  variantOptions: readonly ProductVariantOption[],
) {
  const label = variantOptions
    .map((option) => {
      const value = selection[option.id]
      return value ? `${option.name}: ${value}` : null
    })
    .filter(Boolean)
    .join(' · ')
  return label || 'Standard item'
}

function readImageFile(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      typeof reader.result === 'string'
        ? resolve(reader.result)
        : reject(new Error('Invalid image result'))
    reader.onerror = () => reject(new Error('Image read failed'))
    reader.readAsDataURL(file)
  })
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
  const [category, setCategory] = useState<ProductCategory>(
    existingProduct?.category ?? 'earrings',
  )
  const [price, setPrice] = useState(
    existingProduct?.priceInPaise === null || !existingProduct
      ? ''
      : String(existingProduct.priceInPaise / 100),
  )
  const [description, setDescription] = useState(
    existingProduct?.description ?? '',
  )
  const [images, setImages] = useState<string[]>(
    existingProduct ? [...existingProduct.images] : [],
  )
  const [appearance, setAppearance] = useState(
    existingProduct?.attributes.find(
      (attribute) => attribute.label === 'Visible appearance',
    )?.value ?? '',
  )
  const optionKeySequence = useRef(existingProduct?.variantOptions.length ?? 0)
  const [optionGroups, setOptionGroups] = useState<VariantGroupDraft[]>(
    () =>
      existingProduct?.variantOptions.map((option, index) => ({
        key: `option-${index}`,
        name: option.name,
        values: [...option.values],
        valueDraft: '',
      })) ?? [],
  )
  const [publicationStatus, setPublicationStatus] =
    useState<DemoProductStatus>(existingProduct?.publicationStatus ?? 'active')
  const [stockByVariant, setStockByVariant] = useState<Record<string, number>>(
    () => {
      if (!existingProduct) return { [stockDraftKey({})]: 10 }
      return Object.fromEntries(
        getProductSelections(existingProduct).map((selection) => [
          stockDraftKey(selection),
          inventory[getVariantKey(existingProduct.id, selection)] ?? 0,
        ]),
      )
    },
  )
  const [errors, setErrors] = useState<FormErrors>({})
  const [imageError, setImageError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const variantOptions = useMemo<ProductVariantOption[]>(() => {
    return optionGroups.flatMap((group) =>
      group.values.length > 0
        ? [
            {
              id: optionId(group.name),
              name: group.name,
              values: group.values as [string, ...string[]],
            },
          ]
        : [],
    )
  }, [optionGroups])

  const selections = useMemo<ProductSelection[]>(() => {
    return variantOptions.reduce<ProductSelection[]>(
      (combinations, option) =>
        combinations.flatMap((combination) =>
          option.values.map((value) => ({
            ...combination,
            [option.id]: value,
          })),
        ),
      [{}],
    )
  }, [variantOptions])

  if (isEditing && !existingProduct) {
    return <Navigate replace to="/business/products" />
  }

  const addOptionGroup = () => {
    const usedNames = new Set(optionGroups.map((group) => group.name))
    const nextName = jewelleryOptionNames.find((name) => !usedNames.has(name))
    if (!nextName) return
    optionKeySequence.current += 1
    setOptionGroups((current) => [
      ...current,
      {
        key: `option-${optionKeySequence.current}`,
        name: nextName,
        values: [],
        valueDraft: '',
      },
    ])
    setErrors((current) => ({ ...current, optionValues: undefined }))
  }

  const updateOptionName = (key: string, name: JewelleryOptionName) => {
    setOptionGroups((current) =>
      current.map((group) =>
        group.key === key ? { ...group, name, values: [], valueDraft: '' } : group,
      ),
    )
    setErrors((current) => ({ ...current, optionValues: undefined }))
  }

  const updateOptionValueDraft = (key: string, valueDraft: string) => {
    setOptionGroups((current) =>
      current.map((group) =>
        group.key === key ? { ...group, valueDraft } : group,
      ),
    )
  }

  const addVariantValue = (key: string) => {
    const group = optionGroups.find((item) => item.key === key)
    if (!group) return
    const value = group.valueDraft.trim()
    if (!value) {
      setErrors((current) => ({
        ...current,
        optionValues: 'Enter an option value first.',
      }))
      return
    }
    if (
      group.values.some(
        (candidate) => candidate.toLowerCase() === value.toLowerCase(),
      )
    ) {
      setErrors((current) => ({
        ...current,
        optionValues: 'That value is already added.',
      }))
      return
    }
    setOptionGroups((current) =>
      current.map((item) =>
        item.key === key
          ? { ...item, values: [...item.values, value], valueDraft: '' }
          : item,
      ),
    )
    setErrors((current) => ({ ...current, optionValues: undefined }))
  }

  const removeVariantValue = (key: string, value: string) => {
    setOptionGroups((current) =>
      current.map((group) =>
        group.key === key
          ? { ...group, values: group.values.filter((item) => item !== value) }
          : group,
      ),
    )
  }

  const removeOptionGroup = (key: string) => {
    setOptionGroups((current) => current.filter((group) => group.key !== key))
    setErrors((current) => ({ ...current, optionValues: undefined }))
  }

  const handleImageUpload = async (files?: FileList | null) => {
    setImageError(null)
    const selectedFiles = Array.from(files ?? [])
    if (selectedFiles.length === 0) return
    if (images.length + selectedFiles.length > 8) {
      setImageError('A demo product can contain up to 8 images.')
      return
    }
    if (selectedFiles.some((file) => !file.type.startsWith('image/'))) {
      setImageError('Choose a JPG, PNG, WEBP, or another image file.')
      return
    }
    if (selectedFiles.some((file) => file.size > 750_000)) {
      setImageError(
        'Keep each image under 750 KB so the gallery can persist in this browser demo.',
      )
      return
    }
    const existingUploadCharacters = images
      .filter((image) => image.startsWith('data:'))
      .reduce((total, image) => total + image.length, 0)
    const estimatedNewCharacters = selectedFiles.reduce(
      (total, file) => total + Math.ceil((file.size * 4) / 3),
      0,
    )
    if (existingUploadCharacters + estimatedNewCharacters > 3_000_000) {
      setImageError(
        'These uploads exceed the safe browser-storage budget. Choose fewer or smaller images.',
      )
      return
    }

    try {
      const uploadedImages = await Promise.all(selectedFiles.map(readImageFile))
      setImages((current) => [...current, ...uploadedImages])
      setErrors((current) => ({ ...current, images: undefined }))
    } catch {
      setImageError('One or more images could not be read. Try again.')
    }
  }

  const makeImagePrimary = (index: number) => {
    setImages((current) => {
      const selected = current[index]
      if (!selected) return current
      return [selected, ...current.filter((_, itemIndex) => itemIndex !== index)]
    })
  }

  const moveImage = (index: number, direction: -1 | 1) => {
    setImages((current) => {
      const destination = index + direction
      if (destination < 0 || destination >= current.length) return current
      const next = [...current]
      const selected = next[index]
      const displaced = next[destination]
      if (!selected || !displaced) return current
      next[index] = displaced
      next[destination] = selected
      return next
    })
  }

  const removeImage = (index: number) => {
    setImages((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  const validate = () => {
    const nextErrors: FormErrors = {}
    const numericPrice = Number(price)

    if (!name.trim()) nextErrors.name = 'Product name is required.'
    if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
      nextErrors.price = 'Enter a demo price greater than ₹0.'
    }
    if (!description.trim()) nextErrors.description = 'Description is required.'
    if (images.length === 0) {
      nextErrors.images = 'Choose or upload at least one product image.'
    }
    if (optionGroups.some((group) => group.values.length === 0)) {
      nextErrors.optionValues = 'Every option group needs at least one value.'
    }
    if (new Set(optionGroups.map((group) => group.name)).size !== optionGroups.length) {
      nextErrors.optionValues = 'Each option group must use a different type.'
    }
    if (
      selections.some((selection) => {
        const quantity = stockByVariant[stockDraftKey(selection)] ?? 0
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
      images,
      attributes: appearance.trim()
        ? [
            {
              label: 'Visible appearance',
              value: appearance.trim(),
              evidence: 'demo-entered',
            },
          ]
        : [],
      variantOptions,
      publicationStatus,
      variants: selections.map((selection) => ({
        selection,
        quantity: stockByVariant[stockDraftKey(selection)] ?? 10,
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
      <Link className="mb-5 inline-flex min-h-11 items-center gap-2 rounded-full text-sm font-bold text-ovia-muted hover:text-ovia-primary" to="/business/products">
        <ArrowLeft aria-hidden="true" size={16} />
        Back to products
      </Link>

      <BusinessPageHeader
        description="Build a browser-only demo jewellery product with a complete image gallery and any relevant Ring Size, Finish, Color, Length, or Stone options."
        eyebrow="Products"
        title={existingProduct ? `Edit ${existingProduct.catalogueName}` : 'Add a product'}
      />

      {Object.keys(errors).length > 0 && (
        <div aria-live="assertive" className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" data-testid="product-form-errors" role="alert">
          <strong>Review the highlighted fields.</strong> Complete the required product details before saving.
        </div>
      )}

      <form className="mt-6 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]" noValidate onSubmit={handleSubmit}>
        <div className="space-y-5">
          <section className="rounded-card border border-ovia-line bg-white p-5 shadow-card sm:p-7">
            <p className="text-xs font-bold tracking-[0.12em] text-ovia-primary uppercase">Product details</p>
            <h2 className="mt-2 font-display text-2xl text-ovia-ink">The storefront essentials</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-2 block text-sm font-bold text-ovia-ink">Product name <span className="text-ovia-primary">*</span></span>
                <input aria-invalid={Boolean(errors.name)} className={inputClasses} data-testid="product-name" maxLength={80} onChange={(event) => { setName(event.target.value); setErrors((current) => ({ ...current, name: undefined })) }} placeholder="e.g. Pearl Drop Earrings" value={name} />
                {errors.name && <span className="mt-1.5 block text-xs text-red-700">{errors.name}</span>}
              </label>
              <label>
                <span className="mb-2 block text-sm font-bold text-ovia-ink">Category <span className="text-ovia-primary">*</span></span>
                <select className={inputClasses} data-testid="product-category" onChange={(event) => setCategory(event.target.value as ProductCategory)} value={category}>
                  {categories.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </label>
              <label>
                <span className="mb-2 block text-sm font-bold text-ovia-ink">Demo price <span className="text-ovia-primary">*</span></span>
                <span className="relative block"><span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-sm font-bold text-ovia-muted">₹</span><input aria-invalid={Boolean(errors.price)} className={`${inputClasses} pl-8`} data-testid="product-price" inputMode="decimal" min="1" onChange={(event) => { setPrice(event.target.value); setErrors((current) => ({ ...current, price: undefined })) }} placeholder="1490" type="number" value={price} /></span>
                {errors.price && <span className="mt-1.5 block text-xs text-red-700">{errors.price}</span>}
              </label>
              <label className="sm:col-span-2">
                <span className="mb-2 block text-sm font-bold text-ovia-ink">Visible appearance</span>
                <input className={inputClasses} data-testid="product-appearance" maxLength={100} onChange={(event) => setAppearance(event.target.value)} placeholder="e.g. Yellow-tone with clear details" value={appearance} />
                <span className="mt-1.5 block text-xs text-ovia-muted">Describe only what the selected visual actually shows.</span>
              </label>
              <label className="sm:col-span-2">
                <span className="mb-2 block text-sm font-bold text-ovia-ink">Description <span className="text-ovia-primary">*</span></span>
                <textarea aria-invalid={Boolean(errors.description)} className={`${inputClasses} min-h-32 py-3`} data-testid="product-description" maxLength={500} onChange={(event) => { setDescription(event.target.value); setErrors((current) => ({ ...current, description: undefined })) }} placeholder="Describe the visible design without unsupported material claims." value={description} />
                <span className="mt-1.5 flex justify-between gap-3 text-xs text-ovia-muted"><span className="text-red-700">{errors.description}</span><span>{description.length}/500</span></span>
              </label>
            </div>
          </section>

          <section className="rounded-card border border-ovia-line bg-white p-5 shadow-card sm:p-7">
            <p className="text-xs font-bold tracking-[0.12em] text-ovia-primary uppercase">Product gallery</p>
            <h2 className="mt-2 font-display text-2xl text-ovia-ink">Build the product gallery</h2>
            <p className="mt-2 text-sm leading-6 text-ovia-muted">Start with a cohesive prepared gallery or upload several images. The first image is used by storefront cards.</p>
            <div className="mt-5 grid grid-cols-3 gap-3">
              {demoImages.map((option) => {
                const selected = images[0] === option.images[0]
                return (
                  <button aria-label={`Use ${option.label}`} aria-pressed={selected} className={classNames('relative min-h-11 overflow-hidden rounded-2xl border-2 bg-ovia-ivory transition-colors', selected ? 'border-ovia-primary' : 'border-transparent hover:border-ovia-logo/50')} data-testid={`demo-image-${option.images[0].split('/').at(-2)}`} key={option.images[0]} onClick={() => { setImages([...option.images]); setImageError(null); setErrors((current) => ({ ...current, images: undefined })) }} type="button">
                    <img alt="" className="aspect-[4/5] w-full object-cover" src={option.images[0]} />
                    {selected && <span className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-full bg-ovia-primary text-white"><Check aria-hidden="true" size={15} /></span>}
                    <span className="block px-2 py-2 text-[0.65rem] font-bold text-ovia-ink sm:text-xs">{option.images.length} images</span>
                  </button>
                )
              })}
            </div>
            <label className="mt-4 flex min-h-13 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-ovia-logo bg-ovia-blush/20 px-4 text-sm font-bold text-ovia-plum hover:bg-ovia-blush/40"><Upload aria-hidden="true" size={17} />Add product images<input accept="image/jpeg,image/png,image/webp" className="sr-only" data-testid="product-image-upload" multiple onChange={(event) => { void handleImageUpload(event.target.files); event.currentTarget.value = '' }} type="file" /></label>
            <p className="mt-2 text-xs leading-5 text-ovia-muted">Select multiple files if needed. Up to 8 images, 750 KB each, are stored only in this browser.</p>
            {(errors.images || imageError) && <p className="mt-2 text-xs text-red-700">{imageError ?? errors.images}</p>}
            {images.length > 0 && (
              <div className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold text-ovia-ink">Gallery preview</h3>
                  <p className="text-xs text-ovia-muted">{images.length} of 8 images</p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3" data-testid="product-gallery-preview">
                  {images.map((image, index) => (
                    <article className="overflow-hidden rounded-2xl border border-ovia-line bg-ovia-ivory/40" data-testid={`gallery-image-${index}`} key={`${image.slice(-48)}-${index}`}>
                      <div className="relative aspect-[4/5] overflow-hidden bg-ovia-ivory">
                        <img alt={`Gallery preview ${index + 1}`} className="size-full object-cover" src={image} />
                        {index === 0 && <span className="absolute top-2 left-2 rounded-full bg-ovia-primary px-2.5 py-1 text-[0.62rem] font-bold tracking-wide text-white uppercase">Primary</span>}
                      </div>
                      <div className="grid grid-cols-2 gap-px bg-ovia-line sm:grid-cols-4">
                        <button aria-label={`Make image ${index + 1} primary`} aria-pressed={index === 0} className="flex min-h-11 items-center justify-center bg-white text-ovia-muted hover:text-ovia-primary disabled:bg-ovia-blush/30 disabled:text-ovia-primary" data-testid={`make-primary-${index}`} disabled={index === 0} onClick={() => makeImagePrimary(index)} type="button"><Star aria-hidden="true" fill={index === 0 ? 'currentColor' : 'none'} size={16} /></button>
                        <button aria-label={`Move image ${index + 1} left`} className="flex min-h-11 items-center justify-center bg-white text-ovia-muted hover:text-ovia-primary disabled:opacity-35" data-testid={`move-image-left-${index}`} disabled={index === 0} onClick={() => moveImage(index, -1)} type="button"><ChevronLeft aria-hidden="true" size={17} /></button>
                        <button aria-label={`Move image ${index + 1} right`} className="flex min-h-11 items-center justify-center bg-white text-ovia-muted hover:text-ovia-primary disabled:opacity-35" data-testid={`move-image-right-${index}`} disabled={index === images.length - 1} onClick={() => moveImage(index, 1)} type="button"><ChevronRight aria-hidden="true" size={17} /></button>
                        <button aria-label={`Remove image ${index + 1}`} className="flex min-h-11 items-center justify-center bg-white text-ovia-muted hover:text-red-700" data-testid={`remove-image-${index}`} onClick={() => removeImage(index)} type="button"><X aria-hidden="true" size={17} /></button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="rounded-card border border-ovia-line bg-white p-5 shadow-card sm:p-7">
            <p className="text-xs font-bold tracking-[0.12em] text-ovia-primary uppercase">Variants</p>
            <h2 className="mt-2 font-display text-2xl text-ovia-ink">Flexible jewellery options</h2>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-2xl text-sm leading-6 text-ovia-muted">Simple products need no options. Add one or more relevant groups to generate every stock combination automatically.</p>
              <button className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ovia-primary px-4 text-sm font-bold text-ovia-primary hover:bg-ovia-blush/35 disabled:cursor-not-allowed disabled:opacity-45" data-testid="add-option-group" disabled={optionGroups.length === jewelleryOptionNames.length} onClick={addOptionGroup} type="button"><Plus aria-hidden="true" size={16} /> Add option</button>
            </div>

            {optionGroups.length === 0 ? (
              <div className="mt-5 rounded-2xl border border-dashed border-ovia-line bg-ovia-ivory/35 px-4 py-7 text-center" data-testid="no-variant-groups">
                <p className="text-sm font-bold text-ovia-ink">No variants</p>
                <p className="mt-1 text-xs text-ovia-muted">This product will use one standard inventory record.</p>
              </div>
            ) : (
              <div className="mt-5 space-y-4" data-testid="variant-groups">
                {optionGroups.map((group, groupIndex) => (
                  <article className="rounded-2xl border border-ovia-line bg-ovia-ivory/35 p-4 sm:p-5" data-testid={`variant-group-${groupIndex}`} key={group.key}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold tracking-[0.1em] text-ovia-primary uppercase">Option {groupIndex + 1}</p>
                        <p className="mt-1 text-sm text-ovia-muted">Choose a jewellery option and add its available values.</p>
                      </div>
                      <button aria-label={`Remove option ${groupIndex + 1}`} className="flex size-11 shrink-0 items-center justify-center rounded-full text-ovia-muted hover:bg-white hover:text-red-700" data-testid={`remove-option-group-${groupIndex}`} onClick={() => removeOptionGroup(group.key)} type="button"><X aria-hidden="true" size={18} /></button>
                    </div>
                    <div className="mt-4 grid gap-4 lg:grid-cols-[13rem_1fr]">
                      <label>
                        <span className="mb-2 block text-sm font-bold text-ovia-ink">Option type</span>
                        <select className={inputClasses} data-testid={`product-option-name-${groupIndex}`} onChange={(event) => updateOptionName(group.key, event.target.value as JewelleryOptionName)} value={group.name}>
                          {jewelleryOptionNames.map((option) => <option disabled={option !== group.name && optionGroups.some((candidate) => candidate.name === option)} key={option} value={option}>{option}</option>)}
                        </select>
                      </label>
                      <div>
                        <label className="text-sm font-bold text-ovia-ink" htmlFor={`product-option-value-${group.key}`}>{group.name} values</label>
                        <div className="mt-2 flex gap-2">
                          <input className={inputClasses} data-testid={`product-option-value-${groupIndex}`} id={`product-option-value-${group.key}`} onChange={(event) => updateOptionValueDraft(group.key, event.target.value)} onKeyDown={(event) => { if (event.key !== 'Enter') return; event.preventDefault(); addVariantValue(group.key) }} placeholder={group.name === 'Ring Size' ? 'e.g. 7' : 'Enter a value'} value={group.valueDraft} />
                          <Button aria-label={`Add ${group.name} value`} data-testid={`add-option-value-${groupIndex}`} onClick={() => addVariantValue(group.key)} variant="secondary"><Plus aria-hidden="true" size={17} /></Button>
                        </div>
                        <div className="mt-3 flex min-h-11 flex-wrap gap-2" data-testid={`selected-option-values-${groupIndex}`}>
                          {group.values.map((value) => <span className="inline-flex min-h-11 items-center gap-1 rounded-full bg-ovia-blush/55 pr-1 pl-3 text-sm font-bold text-ovia-plum" key={value}>{value}<button aria-label={`Remove ${group.name} ${value}`} className="flex size-9 items-center justify-center rounded-full hover:bg-white/70" onClick={() => removeVariantValue(group.key, value)} type="button"><X aria-hidden="true" size={14} /></button></span>)}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
            {errors.optionValues && <p className="mt-3 text-xs text-red-700">{errors.optionValues}</p>}

            <div className="mt-7 border-t border-ovia-line pt-6">
              <h3 className="text-sm font-bold text-ovia-ink">Stock per variant</h3>
              <p className="mt-1 text-xs text-ovia-muted">{selections.length} inventory {selections.length === 1 ? 'record' : 'records'}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2" data-testid="variant-inventory">
                {selections.map((selection) => {
                  const key = stockDraftKey(selection)
                  return (
                    <label className="flex items-center gap-3 rounded-2xl border border-ovia-line bg-ovia-ivory/45 p-3" key={key}>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-ovia-ink">{selectionLabel(selection, variantOptions)}</span><span className="mt-0.5 block text-xs text-ovia-muted">Simulated stock</span></span>
                      <input aria-label={`${selectionLabel(selection, variantOptions)} stock`} className="h-11 w-22 rounded-xl border border-ovia-line bg-white px-2 text-center text-sm font-bold text-ovia-ink focus:border-ovia-primary focus:outline-none" inputMode="numeric" max="999" min="0" onChange={(event) => { const quantity = Number.parseInt(event.target.value || '0', 10); setStockByVariant((current) => ({ ...current, [key]: quantity })); setErrors((current) => ({ ...current, stock: undefined })) }} type="number" value={stockByVariant[key] ?? 10} />
                    </label>
                  )
                })}
              </div>
              {errors.stock && <p className="mt-2 text-xs text-red-700">{errors.stock}</p>}
            </div>
          </section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-28">
          <section className="rounded-card border border-ovia-line bg-white p-5 shadow-card">
            <p className="text-xs font-bold tracking-[0.12em] text-ovia-primary uppercase">Publishing</p>
            <h2 className="mt-2 font-display text-2xl text-ovia-ink">Product status</h2>
            <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-ovia-ivory p-1" role="group" aria-label="Product status">
              {(['active', 'draft'] as DemoProductStatus[]).map((status) => <button aria-pressed={publicationStatus === status} className={classNames('min-h-11 rounded-lg text-sm font-bold capitalize transition-colors', publicationStatus === status ? 'bg-ovia-primary text-white shadow-sm' : 'text-ovia-muted hover:bg-white')} data-testid={`product-status-${status}`} key={status} onClick={() => setPublicationStatus(status)} type="button">{status}</button>)}
            </div>
            <p className="mt-3 text-xs leading-5 text-ovia-muted">{publicationStatus === 'active' ? 'Active products appear in the customer storefront immediately.' : 'Draft products remain visible only in this business preview.'}</p>
          </section>

          <section className="overflow-hidden rounded-card border border-ovia-line bg-white shadow-card">
            <div className="aspect-[4/5] bg-ovia-ivory">
              {images[0] ? <img alt="Product preview" className="size-full object-cover" src={images[0]} /> : <div className="flex size-full flex-col items-center justify-center px-6 text-center text-ovia-muted"><ImagePlus aria-hidden="true" size={32} strokeWidth={1.4} /><p className="mt-3 text-sm font-bold text-ovia-ink">Product preview</p><p className="mt-1 text-xs leading-5">Choose a demo image or upload one.</p></div>}
            </div>
            <div className="p-5"><p className="text-xs font-bold tracking-[0.1em] text-ovia-primary uppercase">{category}</p><p className="mt-1 font-display text-2xl text-ovia-ink">{name.trim() || 'Untitled product'}</p><p className="mt-2 font-bold text-ovia-plum">{Number(price) > 0 ? `₹${Number(price).toLocaleString('en-IN')}` : 'Price required'}</p><p className="mt-2 text-xs text-ovia-muted">{images.length} gallery {images.length === 1 ? 'image' : 'images'} · {variantOptions.length === 0 ? 'No variants' : variantOptions.map((option) => option.name).join(' + ')}</p></div>
          </section>

          <div className="grid gap-2"><Button data-testid="save-product" fullWidth size="lg" type="submit"><Save aria-hidden="true" size={18} /> Save Product</Button><Link className="inline-flex min-h-11 items-center justify-center rounded-control text-sm font-bold text-ovia-muted hover:bg-ovia-blush/35 hover:text-ovia-plum" to="/business/products">Cancel</Link></div>
        </aside>
      </form>

      <AnimatePresence>
        {toast && <motion.div animate={{ opacity: 1, y: 0 }} aria-live="polite" className="fixed right-4 bottom-4 left-4 flex items-center gap-3 rounded-2xl bg-ovia-ink px-4 py-3.5 text-sm text-white shadow-floating sm:right-6 sm:left-auto sm:max-w-md" data-testid="product-success-toast" exit={{ opacity: 0, y: 12 }} initial={{ opacity: 0, y: 12 }} role="status"><span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ovia-success"><Check aria-hidden="true" size={15} /></span><span><strong className="block">Product saved</strong><span className="text-xs text-white/70">{toast}</span></span></motion.div>}
      </AnimatePresence>
    </Container>
  )
}
