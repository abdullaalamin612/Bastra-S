import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useShop } from '../context/ShopContext';
import { ProductVariant, SizeChartData } from '../types';
import { ProductCard } from '../components/ProductCard';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Ruler,
  Layers,
  Sparkles,
  Truck,
  Heart,
  Share2,
  ArrowLeft,
  Check,
  ShoppingBasket,
  ArrowRight,
  Star,
  ShieldCheck,
  RotateCcw,
  MessageSquare,
  Send,
  User,
  CheckCircle2,
  Info,
} from 'lucide-react';

export const ProductDetailsPage: React.FC = () => {
  const {
    currentProductSlug,
    products,
    addToCart,
    buyNow,
    navigateToCheckout,
    deliveryConfig,
    showToast,
    navigateToCategory,
    navigateBack,
    openSizeGuideModal,
    language,
    wishlist,
    toggleWishlist,
    reviews,
    addProductReview,
  } = useShop();

  const product = useMemo(() => {
    if (!products || products.length === 0) return null;
    if (!currentProductSlug) return products[0];
    const decodedSlug = decodeURIComponent(currentProductSlug);
    return (
      products.find(
        (p) =>
          p.slug === currentProductSlug ||
          p.id === currentProductSlug ||
          p.slug === decodedSlug ||
          p.id === decodedSlug ||
          (p.slug && decodeURIComponent(p.slug) === decodedSlug)
      ) || products[0]
    );
  }, [products, currentProductSlug]);

  // Extract unique colors and sizes from variants & colorGalleries
  const availableColors: string[] = useMemo(() => {
    if (!product) return [];
    const colors = new Set<string>();
    if (product.variants) {
      product.variants.forEach((v) => {
        const c = v.color?.trim();
        if (c) colors.add(c);
      });
    }
    if (product.colorGalleries) {
      Object.keys(product.colorGalleries).forEach((k) => {
        const c = k.trim();
        if (c) colors.add(c);
      });
    }
    return Array.from(colors);
  }, [product]);

  const availableSizes: string[] = useMemo(() => {
    if (!product?.variants) return [];
    return Array.from(
      new Set(
        product.variants
          .map((v) => v.size?.trim())
          .filter((s): s is string => Boolean(s && s.length > 0))
      )
    );
  }, [product]);

  // Selected states
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | undefined>(undefined);
  const [quantity, setQuantity] = useState<number>(1);
  const [activeImageIndex, setActiveImageIndex] = useState<number>(0);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Accordion open states (support independent open/collapse)
  const [openAccordions, setOpenAccordions] = useState<Record<string, boolean>>({
    sizeChart: false,
    productDetails: false,
    laundryCare: false,
    shippingDetails: false,
  });

  const toggleAccordion = (key: string) => {
    setOpenAccordions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  // Review states
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewName, setReviewName] = useState<string>('');
  const [reviewComment, setReviewComment] = useState<string>('');
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false);

  // Initialize or synchronize selections when product changes
  useEffect(() => {
    if (product) {
      const defaultVariant = product.variants && product.variants.length > 0 ? product.variants[0] : undefined;
      const initialColor = defaultVariant?.color || availableColors[0] || '';
      const initialSize = defaultVariant?.size || availableSizes[0] || '';

      setSelectedColor(initialColor);
      setSelectedSize(initialSize);
      setSelectedVariant(defaultVariant);
      setQuantity(1);
      setActiveImageIndex(0);
      setValidationError(null);
    }
  }, [product?.id, product?.slug, availableColors, availableSizes]);

  // When selectedColor changes, update available variant and gallery
  const handleSelectColor = (color: string) => {
    setSelectedColor(color);
    setValidationError(null);
    setActiveImageIndex(0);

    if (!product?.variants) return;

    // Try to find matching variant with current size
    let matched = product.variants.find((v) => v.color === color && v.size === selectedSize);

    // If current size isn't available for this color, find first available size
    if (!matched) {
      matched =
        product.variants.find((v) => v.color === color && v.stock > 0) ||
        product.variants.find((v) => v.color === color);
    }

    if (matched) {
      setSelectedVariant(matched);
      setSelectedSize(matched.size);
    }
  };

  // When selectedSize changes
  const handleSelectSize = (size: string) => {
    setSelectedSize(size);
    setValidationError(null);

    if (!product?.variants) return;

    const matched =
      product.variants.find((v) => v.size === size && v.color === selectedColor) ||
      product.variants.find((v) => v.size === size);

    if (matched) {
      setSelectedVariant(matched);
      if (matched.color && matched.color !== selectedColor) {
        setSelectedColor(matched.color);
        setActiveImageIndex(0);
      }
    }
  };

  // Determine active images for current color / variant strictly per specification:
  // Rule: Selected Color -> Color Gallery (default). Changing a color must NEVER display another color's gallery.
  const activeGalleryImages = useMemo(() => {
    if (!product) return [];

    const cleanSelectedColor = (selectedColor || '').toLowerCase().trim();

    // 1. Direct Color Galleries Mapping (from admin upload wizard or product definition)
    if (product.colorGalleries && cleanSelectedColor) {
      const colorKeys = Object.keys(product.colorGalleries);
      // Exact match first
      const exactKey = colorKeys.find(
        (key) => key.toLowerCase().trim() === cleanSelectedColor
      );
      if (exactKey && product.colorGalleries[exactKey]?.length > 0) {
        return product.colorGalleries[exactKey].filter(Boolean);
      }
      // Specific match (e.g. "Royal Blue" or "রয়্যাল ব্লু")
      const matchedKey = colorKeys.find(
        (key) =>
          key.toLowerCase().trim() === cleanSelectedColor ||
          key.toLowerCase().trim().replace(/[\s-_]/g, '') === cleanSelectedColor.replace(/[\s-_]/g, '')
      );
      if (matchedKey && product.colorGalleries[matchedKey]?.length > 0) {
        return product.colorGalleries[matchedKey].filter(Boolean);
      }
    }

    // 2. Variant Gallery Override (ONLY if this variant actually belongs to the selected color)
    if (
      selectedVariant &&
      (!selectedVariant.color || selectedVariant.color.toLowerCase().trim() === cleanSelectedColor) &&
      selectedVariant.galleryImages &&
      selectedVariant.galleryImages.length > 0
    ) {
      return selectedVariant.galleryImages.filter(Boolean);
    }

    // 3. Color Gallery from variants strictly matching selectedColor
    if (cleanSelectedColor && product.variants) {
      const matchingVariants = product.variants.filter((v) => {
        if (!v.color) return false;
        const vCol = v.color.toLowerCase().trim();
        return vCol === cleanSelectedColor || vCol.replace(/[\s-_]/g, '') === cleanSelectedColor.replace(/[\s-_]/g, '');
      });

      if (matchingVariants.length > 0) {
        const colorImages: string[] = [];
        matchingVariants.forEach((v) => {
          if (v.image && !colorImages.includes(v.image)) {
            colorImages.push(v.image);
          }
          if (v.galleryImages && Array.isArray(v.galleryImages)) {
            v.galleryImages.forEach((img) => {
              if (img && !colorImages.includes(img)) colorImages.push(img);
            });
          }
        });
        if (colorImages.length > 0) {
          return colorImages;
        }
      }
    }

    // 4. Fallback to product images (only if current color has no specific images)
    const fallbackImages: string[] = [];
    if (product.mainImage) fallbackImages.push(product.mainImage);
    if (product.galleryImages) {
      product.galleryImages.forEach((img) => {
        if (img && !fallbackImages.includes(img)) fallbackImages.push(img);
      });
    }

    return fallbackImages.length > 0 ? fallbackImages : [product.mainImage || ''];
  }, [product, selectedColor, selectedVariant]);

  // Gallery Navigation
  const handlePrevImage = () => {
    setActiveImageIndex((prev) => (prev - 1 + activeGalleryImages.length) % activeGalleryImages.length);
  };

  const handleNextImage = () => {
    setActiveImageIndex((prev) => (prev + 1) % activeGalleryImages.length);
  };

  // Mobile Touch Swipe Handlers for Gallery
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    if (diff > 45) {
      handleNextImage(); // Swiped Left -> Next Image
    } else if (diff < -45) {
      handlePrevImage(); // Swiped Right -> Prev Image
    }
    setTouchStartX(null);
  };

  if (!product) {
    return (
      <div className="text-center py-24">
        <p className="text-lg font-bold text-stone-700">
          {language === 'bn' ? 'পণ্যটি পাওয়া যায়নি' : 'Product not found'}
        </p>
        <button
          onClick={navigateBack}
          className="mt-4 px-5 py-2.5 bg-stone-900 text-white rounded-xl text-sm font-semibold"
        >
          {language === 'bn' ? 'হোমে ফিরে যান' : 'Back to Home'}
        </button>
      </div>
    );
  }

  // Price & Stock calculations with authoritative variant offerPrice handling
  const variantOffer =
    (selectedVariant as any)?.offerPrice ??
    (selectedVariant as any)?.offer_price;
  const variantBase = selectedVariant?.price ?? product.price;

  const effectivePrice =
    variantOffer && variantOffer > 0
      ? variantOffer
      : (product.discountPrice && product.discountPrice > 0
          ? product.discountPrice
          : variantBase);

  const originalPrice =
    variantOffer && variantOffer > 0 && variantBase > variantOffer
      ? variantBase
      : (product.discountPrice && product.price > product.discountPrice
          ? product.price
          : null);

  const hasDiscount = Boolean(originalPrice && originalPrice > effectivePrice);
  const discountPercentage = originalPrice
    ? Math.round(((originalPrice - effectivePrice) / originalPrice) * 100)
    : 0;

  const currentStock = selectedVariant ? selectedVariant.stock : product.stock;
  const isWishlisted = wishlist.includes(product.id);

  // Swatch styling helper
  const getSwatchStyle = (colorName: string): React.CSSProperties => {
    const matched = product.variants?.find((v) => v.color === colorName);
    if (matched?.colorSwatchPattern) {
      return { background: matched.colorSwatchPattern };
    }
    if (matched?.colorCode) {
      return { backgroundColor: matched.colorCode };
    }

    const lower = colorName.toLowerCase();
    if (lower.includes('abyss') || lower.includes('dark blue') || lower.includes('navy')) {
      return { backgroundColor: '#0F172A' };
    }
    if (lower.includes('brown')) {
      return { backgroundColor: '#78350F' };
    }
    if (lower.includes('light green')) {
      return { backgroundColor: '#86EFAC' };
    }
    if (lower.includes('green')) {
      return { backgroundColor: '#10B981' };
    }
    if (lower.includes('light blue')) {
      return { backgroundColor: '#93C5FD' };
    }
    if (lower.includes('blue')) {
      return { backgroundColor: '#2563EB' };
    }
    if (lower.includes('pink') || lower.includes('pattern')) {
      return { background: 'linear-gradient(135deg, #F472B6 50%, #FEE2E2 50%)' };
    }
    if (lower.includes('red')) {
      return { backgroundColor: '#EF4444' };
    }
    if (lower.includes('white')) {
      return { backgroundColor: '#F8FAFC' };
    }
    if (lower.includes('black')) {
      return { backgroundColor: '#18181B' };
    }
    return { backgroundColor: '#71717A' };
  };

  // Validation logic before Cart or Buy Now
  const validateSelection = (): boolean => {
    if (availableColors.length > 0 && !selectedColor) {
      setValidationError(language === 'bn' ? 'অনুগ্রহ করে একটি রঙ নির্বাচন করুন।' : 'Please select a color.');
      return false;
    }
    if (availableSizes.length > 0 && !selectedSize) {
      setValidationError(language === 'bn' ? 'অনুগ্রহ করে একটি সাইজ নির্বাচন করুন।' : 'Please select a size.');
      return false;
    }
    if (currentStock <= 0) {
      setValidationError(language === 'bn' ? 'নির্বাচিত ভ্যারিয়েন্টটি বর্তমানে স্টকে নেই।' : 'Selected variant is out of stock.');
      return false;
    }
    setValidationError(null);
    return true;
  };

  const handleAddToCart = () => {
    if (!validateSelection()) return;
    addToCart(product, selectedVariant, quantity);
    showToast(
      language === 'bn'
        ? `${product.name} (${selectedColor ? selectedColor + ', ' : ''}${selectedSize}) ব্যাগে যুক্ত হয়েছে!`
        : `Added ${product.name} to cart!`
    );
  };

  const handleBuyNow = () => {
    if (!validateSelection()) return;
    buyNow(product, selectedVariant, quantity);
  };

  const handleCopyLink = () => {
    const fullUrl = `${window.location.origin}${window.location.pathname}#/product/${product.slug}`;
    navigator.clipboard.writeText(fullUrl);
    setIsCopied(true);
    showToast(
      language === 'bn'
        ? `ফেসবুক পোস্টের জন্য প্রোডাক্ট লিঙ্ক কপি করা হয়েছে: ${fullUrl}`
        : `Product link copied: ${fullUrl}`
    );
    setTimeout(() => setIsCopied(false), 2500);
  };

  // Filter reviews
  const productReviews = reviews.filter((r) => r.productId === product.id);
  const displayReviews =
    productReviews.length > 0
      ? productReviews
      : [
          {
            id: 'sample-1',
            productId: product.id,
            userName: language === 'bn' ? 'মাহমুদুল হাসান' : 'Mahmudul Hasan',
            rating: 5,
            comment:
              language === 'bn'
                ? 'অসাধারণ ফেব্রিক ও আরামদায়ক কাটিং! রঙের মান ১০০% নিখুঁত।'
                : 'Outstanding fabric and comfortable silhouette! Color and build quality are 100% genuine.',
            createdAt: '২০২৬-০২-১৫',
            isVerifiedPurchase: true,
          },
          {
            id: 'sample-2',
            productId: product.id,
            userName: language === 'bn' ? 'তানভীর আহমেদ' : 'Tanvir Ahmed',
            rating: 5,
            comment:
              language === 'bn'
                ? 'ডেলিভারি দ্রুত পেয়েছি এবং সাইজ একদম পারফেক্ট হয়েছে।'
                : 'Fast delivery inside Dhaka and the size fitting is absolutely perfect.',
            createdAt: '২০২৬-০২-১০',
            isVerifiedPurchase: true,
          },
        ];

  const averageRating = (
    displayReviews.reduce((sum, r) => sum + r.rating, 0) / displayReviews.length
  ).toFixed(1);

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewName.trim() || !reviewComment.trim()) return;

    setIsSubmittingReview(true);
    addProductReview({
      productId: product.id,
      userName: reviewName.trim(),
      rating: reviewRating,
      comment: reviewComment.trim(),
    });

    setReviewName('');
    setReviewComment('');
    setIsSubmittingReview(false);
    showToast(language === 'bn' ? 'আপনার রিভিউ সফলভাবে যুক্ত হয়েছে!' : 'Thank you for your review!');
  };

  // Related products
  const relatedProducts = products
    .filter((p) => p.id !== product.id && (p.category === product.category || p.subCategory === product.subCategory))
    .slice(0, 4);

  // Fallback dynamic size chart data if not set on product
  const getCategoryFallbackSizeChart = (subCat?: string, cat?: string): SizeChartData => {
    const key = `${subCat || ''} ${cat || ''}`.toLowerCase();
    if (key.includes('lungi') || key.includes('লুঙ্গি')) {
      return {
        headers: ['Size', 'Length (দৈর্ঘ্য)', 'Width (ঘের/প্রস্থ)', 'Recommended For (উপযোগী)'],
        rows: [
          { Size: '২.৫ হাত', 'Length (দৈর্ঘ্য)': '45 Inch', 'Width (ঘের/প্রস্থ)': '82 Inch', 'Recommended For (উপযোগী)': 'উচ্চতা ৫\'২" - ৫\'৫"' },
          { Size: '২.৭৫ হাত', 'Length (দৈর্ঘ্য)': '48 Inch', 'Width (ঘের/প্রস্থ)': '88 Inch', 'Recommended For (উপযোগী)': 'উচ্চতা ৫\'৬" - ৫\'১০" (স্ট্যান্ডার্ড)' },
          { Size: '৩ হাত', 'Length (দৈর্ঘ্য)': '52 Inch', 'Width (ঘের/প্রস্থ)': '92 Inch', 'Recommended For (উপযোগী)': 'উচ্চতা ৫\'১০"+ (লম্বা মানুষদের)' },
          { Size: 'Free Size', 'Length (দৈর্ঘ্য)': '48 Inch', 'Width (ঘের/প্রস্থ)': '88 Inch', 'Recommended For (উপযোগী)': 'রেগুলার যেকোনো উচ্চতা' },
        ],
      };
    }
    if (key.includes('saree') || key.includes('শাড়ি') || key.includes('শাড়ি')) {
      return {
        headers: ['Size', 'Length (দৈর্ঘ্য)', 'Blouse Piece (ব্লাউজ পিস)', 'Aanchal / Pallu (আঁচল)'],
        rows: [
          { Size: '১২ হাত (Standard)', 'Length (দৈর্ঘ্য)': '5.5 Meter', 'Blouse Piece (ব্লাউজ পিস)': 'Without Blouse Piece', 'Aanchal / Pallu (আঁচল)': 'Traditional Woven' },
          { Size: '১২.৫ হাত (With Blouse)', 'Length (দৈর্ঘ্য)': '6.0 Meter', 'Blouse Piece (ব্লাউজ পিস)': 'Included (0.8 Meter)', 'Aanchal / Pallu (আঁচল)': 'Designer Zari/Resham' },
          { Size: 'Free Size', 'Length (দৈর্ঘ্য)': '5.5 Meter (১২ হাত)', 'Blouse Piece (ব্লাউজ পিস)': 'রানিং ব্লাউজ পিস সহ', 'Aanchal / Pallu (আঁচল)': 'অভিজাত ট্র্যাডিশনাল' },
        ],
      };
    }
    if (key.includes('panjabi') || key.includes('পাঞ্জাবি')) {
      return {
        headers: ['Size', 'Chest (বুক)', 'Length (দৈর্ঘ্য)', 'Shoulder (কাঁধ)', 'Sleeve (হাতা)'],
        rows: [
          { Size: '38 (S)', 'Chest (বুক)': '40"', 'Length (দৈর্ঘ্য)': '40"', 'Shoulder (কাঁধ)': '17.5"', 'Sleeve (হাতা)': '24"' },
          { Size: '40 (M)', 'Chest (বুক)': '42"', 'Length (দৈর্ঘ্য)': '42"', 'Shoulder (কাঁধ)': '18"', 'Sleeve (হাতা)': '24.5"' },
          { Size: '42 (L)', 'Chest (বুক)': '44"', 'Length (দৈর্ঘ্য)': '44"', 'Shoulder (কাঁধ)': '18.5"', 'Sleeve (হাতা)': '25"' },
          { Size: '44 (XL)', 'Chest (বুক)': '46"', 'Length (দৈর্ঘ্য)': '45"', 'Shoulder (কাঁধ)': '19"', 'Sleeve (হাতা)': '25.5"' },
          { Size: '46 (XXL)', 'Chest (বুক)': '48"', 'Length (দৈর্ঘ্য)': '46"', 'Shoulder (কাঁধ)': '19.5"', 'Sleeve (হাতা)': '26"' },
        ],
      };
    }
    if (key.includes('three-piece') || key.includes('থ্রি-পিস') || key.includes('kurti')) {
      return {
        headers: ['Size', 'Kameez Chest (কামিজ বুক)', 'Kameez Length (কামিজ দৈর্ঘ্য)', 'Salwar Length (সালোয়ার)', 'Dupatta (ওড়না)'],
        rows: [
          { Size: '36 (S)', 'Kameez Chest (কামিজ বুক)': '36"', 'Kameez Length (কামিজ দৈর্ঘ্য)': '44"', 'Salwar Length (সালোয়ার)': '38"', 'Dupatta (ওড়না)': '৫ হাত (2.5 Mtr)' },
          { Size: '38 (M)', 'Kameez Chest (কামিজ বুক)': '38"', 'Kameez Length (কামিজ দৈর্ঘ্য)': '45"', 'Salwar Length (সালোয়ার)': '39"', 'Dupatta (ওড়না)': '৫ হাত (2.5 Mtr)' },
          { Size: '40 (L)', 'Kameez Chest (কামিজ বুক)': '40"', 'Kameez Length (কামিজ দৈর্ঘ্য)': '46"', 'Salwar Length (সালোয়ার)': '40"', 'Dupatta (ওড়না)': '৫ হাত (2.5 Mtr)' },
          { Size: '42 (XL)', 'Kameez Chest (কামিজ বুক)': '42"', 'Kameez Length (কামিজ দৈর্ঘ্য)': '47"', 'Salwar Length (সালোয়ার)': '40"', 'Dupatta (ওড়না)': '৫ হাত (2.5 Mtr)' },
          { Size: 'Unstitched', 'Kameez Chest (কামিজ বুক)': 'Free / কাস্টমাইজ', 'Kameez Length (কামিজ দৈর্ঘ্য)': '48" Fabric', 'Salwar Length (সালোয়ার)': '2.5 গজ', 'Dupatta (ওড়না)': '৫ হাত কটন/শিফন' },
        ],
      };
    }
    return {
      headers: ['Size', 'Chest (বুক)', 'Length (দৈর্ঘ্য)', 'Sleeve (হাতা)'],
      rows: [
        { Size: 'S', 'Chest (বুক)': '38"', 'Length (দৈর্ঘ্য)': '27"', 'Sleeve (হাতা)': '8"' },
        { Size: 'M', 'Chest (বুক)': '40"', 'Length (দৈর্ঘ্য)': '28"', 'Sleeve (হাতা)': '8.5"' },
        { Size: 'L', 'Chest (বুক)': '42"', 'Length (দৈর্ঘ্য)': '29"', 'Sleeve (হাতা)': '9"' },
        { Size: 'XL', 'Chest (বুক)': '44"', 'Length (দৈর্ঘ্য)': '30"', 'Sleeve (হাতা)': '9.5"' },
        { Size: '2XL', 'Chest (বুক)': '46"', 'Length (দৈর্ঘ্য)': '31"', 'Sleeve (হাতা)': '10"' },
      ],
    };
  };

  const sizeChartData =
    product.sizeChart && product.sizeChart.headers?.length > 0
      ? product.sizeChart
      : getCategoryFallbackSizeChart(product.subCategory, product.category);

  const productDetailsList = product.productDetails || [
    { label: 'Color', value: selectedColor || 'Abyss / Dark Blue' },
    { label: 'Fabric', value: '100% Combed Compact Cotton (220 GSM)' },
    { label: 'Fit', value: 'Relaxed Drop-Shoulder Unisex Fit' },
    { label: 'Embroidery', value: 'Tonal minimalist micro-embroidery at chest' },
    { label: 'Waistband', value: 'Ribbed stretch hem with reinforced side vents' },
    { label: 'Pockets', value: 'Seamless construction, no pockets' },
    { label: 'Stitching', value: 'Twin-needle reinforced topstitching' },
    { label: 'Style', value: 'Modern Athleisure & Streetwear Everyday Staple' },
  ];

  const laundryCareList = product.laundryCare || [
    'Machine wash gentle cycle cold (under 30°C) with similar dark shades',
    'Wash inside out to preserve rich color brilliance and embroidery',
    'Do not bleach or use chlorine-based optical brighteners',
    'Tumble dry low heat or hang dry naturally in shaded breeze',
    'Medium warm steam iron on reverse side; never iron directly on embroidery',
  ];

  const shippingDetailsData = product.shippingDetails || {
    deliveryTime: deliveryConfig.estimatedDeliveryDays || '২৪-৪৮ ঘণ্টা (সিরাজগঞ্জের ভিতর) | ৪৮-৭২ ঘণ্টা (সিরাজগঞ্জের বাইরে সারা বাংলাদেশ)',
    processingTime: '১২ ঘণ্টার মধ্যে প্যাকেজিং ও কুরিয়ারে হ্যান্ডওভার',
    shippingFee: `সিরাজগঞ্জের ভিতর মাত্র ৳${deliveryConfig.insideSirajganjCharge ?? deliveryConfig.insideDhakaCharge ?? 70}, সিরাজগঞ্জের বাইরে ৳${deliveryConfig.outsideSirajganjCharge ?? deliveryConfig.outsideDhakaCharge ?? 130} (৳${deliveryConfig.freeDeliveryThreshold ?? 2000} টাকার বেশি অর্ডারে ফ্রি শিপিং)`,
    invoiceInfo: 'ভ্যাট চালান ও ডিজিটাল কিউআর কোডসহ অফিসিয়াল ইনভয়েস পার্সেলের সাথে সংযুক্ত থাকে',
    notes: 'ক্যাশ অন ডেলিভারি প্রযোজ্য। ডেলিভারিম্যানের সামনে চেক করে নেওয়ার সম্পূর্ণ সুযোগ রয়েছে।',
  };

  return (
    <div className="min-h-screen bg-white text-stone-900 antialiased">
      {/* Top Header Navigation (Mobile-first, clean minimal) */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 border-b border-stone-200">
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={navigateBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-700 hover:text-stone-950 transition-colors cursor-pointer py-1.5 px-2.5 rounded-lg hover:bg-stone-100"
            title="Back"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{language === 'bn' ? 'ফিরে যান' : 'Back'}</span>
          </button>

          <div className="hidden sm:flex items-center gap-2 text-xs text-stone-500 font-medium">
            <span
              onClick={() => navigateToCategory(product.category.toLowerCase())}
              className="hover:text-stone-900 cursor-pointer"
            >
              {product.category}
            </span>
            <span>/</span>
            <span className="text-stone-800">{product.subCategory}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleWishlist(product.id)}
              className={`p-2 rounded-full border transition-colors cursor-pointer ${
                isWishlisted
                  ? 'bg-rose-50 border-rose-200 text-rose-600'
                  : 'bg-white border-stone-200 text-stone-600 hover:text-stone-900'
              }`}
              title="Wishlist"
              aria-label="Wishlist"
            >
              <Heart className={`w-4 h-4 ${isWishlisted ? 'fill-rose-600' : ''}`} />
            </button>

            <button
              onClick={handleCopyLink}
              className="p-2 rounded-full border border-stone-200 bg-white text-stone-600 hover:text-stone-900 transition-colors cursor-pointer"
              title="Share Link"
              aria-label="Share Link"
            >
              {isCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-14 items-start">
          {/* ======================================================
              LEFT COLUMN: PRODUCT IMAGE GALLERY (COMPACT SLIDE BOX)
             ====================================================== */}
          <div className="lg:col-span-7 space-y-3">
            {/* Main Image Container (Compact Reduced Height per User Request) */}
            <div
              className="relative w-full max-h-[175px] sm:max-h-[225px] lg:max-h-[265px] aspect-[16/9] sm:aspect-[16/10] rounded-2xl overflow-hidden bg-stone-50 border border-stone-200/60 select-none group touch-pan-y flex items-center justify-center"
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              <img
                src={activeGalleryImages[activeImageIndex] || product.mainImage}
                alt={product.name}
                className="w-full h-full object-contain object-center transition-opacity duration-200 drop-shadow-sm"
              />

              {/* Product Image Counter: e.g. "1 / 4" */}
              <div className="absolute top-4 right-4 bg-black/65 backdrop-blur-xs text-white text-[11px] font-bold px-3 py-1 rounded-full tracking-wider shadow-sm z-10 pointer-events-none">
                {activeImageIndex + 1} / {activeGalleryImages.length}
              </div>

              {/* Previous Button (<) */}
              {activeGalleryImages.length > 1 && (
                <button
                  onClick={handlePrevImage}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/90 hover:bg-white text-stone-800 flex items-center justify-center shadow-md transition-all active:scale-95 cursor-pointer z-10 sm:opacity-90 sm:hover:opacity-100"
                  aria-label="Previous Image"
                >
                  <ChevronLeft className="w-4 h-4 -ml-0.5" />
                </button>
              )}

              {/* Next Button (>) */}
              {activeGalleryImages.length > 1 && (
                <button
                  onClick={handleNextImage}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white/90 hover:bg-white text-stone-800 flex items-center justify-center shadow-md transition-all active:scale-95 cursor-pointer z-10 sm:opacity-90 sm:hover:opacity-100"
                  aria-label="Next Image"
                >
                  <ChevronRight className="w-4 h-4 -mr-0.5" />
                </button>
              )}
            </div>

            {/* Thumbnail Navigation Row */}
            {activeGalleryImages.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar">
                {activeGalleryImages.map((imgUrl, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImageIndex(idx)}
                    className={`relative w-12 h-14 sm:w-14 sm:h-16 rounded-xl overflow-hidden shrink-0 border-2 transition-all cursor-pointer ${
                      activeImageIndex === idx
                        ? 'border-stone-900 ring-1 ring-stone-900 shadow-xs'
                        : 'border-transparent opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img src={imgUrl} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ======================================================
              RIGHT COLUMN: PRODUCT INFORMATION (EXACT HIERARCHY)
             ====================================================== */}
          <div className="lg:col-span-5 space-y-5">
            {/* 1. Brand / Category */}
            <div className="text-[11px] uppercase tracking-widest text-stone-500 font-semibold">
              <span>{product.brand || 'BASTRA SHOILY'}</span>
              <span className="mx-2">•</span>
              <span>{product.category}</span>
            </div>

            {/* 2. Product Name */}
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-stone-950">
              {language === 'bn' ? product.banglaName || product.name : product.name}
            </h1>

            {/* 3. Price */}
            <div className="flex items-baseline gap-3 pt-0.5">
              <span className="text-2xl sm:text-3xl font-bold text-stone-950">
                ৳{effectivePrice.toLocaleString()}
              </span>
              {hasDiscount && originalPrice && (
                <span className="text-base text-stone-400 line-through">
                  ৳{originalPrice.toLocaleString()}
                </span>
              )}
              {hasDiscount && discountPercentage > 0 && (
                <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                  -{discountPercentage}% ছাড়
                </span>
              )}
            </div>

            {/* 4. COLOR SELECTION (EXACT TO REFERENCE IMAGE) */}
            {availableColors.length > 0 && (
              <div className="space-y-3 pt-2">
                {/* Text: Color    ABYSS */}
                <div className="flex items-center gap-3 text-xs tracking-wider">
                  <span className="font-semibold text-stone-500 uppercase">Color</span>
                  <span className="font-bold text-stone-950 uppercase tracking-widest">
                    {selectedColor}
                  </span>
                </div>

                {/* Circular Color Swatches */}
                <div className="flex items-center gap-3 flex-wrap">
                  {availableColors.map((color) => {
                    const isSelected = selectedColor === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        onClick={() => handleSelectColor(color)}
                        className={`relative w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                          isSelected
                            ? 'ring-2 ring-stone-900 ring-offset-2 ring-offset-white'
                            : 'ring-1 ring-transparent hover:ring-stone-300'
                        }`}
                        title={color}
                        aria-label={`Select color ${color}`}
                      >
                        <span
                          className="w-6 h-6 rounded-full shadow-2xs border border-black/10 block"
                          style={getSwatchStyle(color)}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 5. SIZE SELECTION */}
            {availableSizes.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-stone-500 uppercase tracking-wider">Size</span>
                    <span className="font-bold text-stone-950 uppercase tracking-wider">
                      {selectedSize}
                    </span>
                  </div>
                </div>

                {/* Pill / Rounded Rectangular Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  {availableSizes.map((size) => {
                    const isSelected = selectedSize === size;
                    // Check availability for this color and size combination
                    const matchingVariant = product.variants?.find(
                      (v) => v.size === size && v.color === selectedColor
                    );
                    const isAvailable = (matchingVariant?.stock ?? 0) > 0;

                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => handleSelectSize(size)}
                        disabled={!isAvailable}
                        className={`min-w-12 h-10 px-4 rounded-xl text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-stone-950 text-white border-stone-950 shadow-xs'
                            : isAvailable
                            ? 'bg-white text-stone-900 border-stone-300 hover:border-stone-900'
                            : 'bg-stone-100 text-stone-400 border-stone-200 line-through opacity-50 cursor-not-allowed'
                        }`}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 6. QUANTITY SELECTOR: [-]  1  [+] */}
            <div className="pt-2">
              <div className="inline-flex items-center border border-stone-300 rounded-xl bg-white overflow-hidden shadow-2xs">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                  className="w-10 h-10 flex items-center justify-center text-stone-700 hover:bg-stone-100 disabled:opacity-40 transition-colors text-base font-bold cursor-pointer"
                  aria-label="Decrease quantity"
                >
                  -
                </button>
                <span className="w-12 text-center text-xs font-bold text-stone-950">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity(Math.min(currentStock, quantity + 1))}
                  disabled={quantity >= currentStock}
                  className="w-10 h-10 flex items-center justify-center text-stone-700 hover:bg-stone-100 disabled:opacity-40 transition-colors text-base font-bold cursor-pointer"
                  aria-label="Increase quantity"
                >
                  +
                </button>
              </div>
            </div>

            {/* Validation Error Message if any */}
            {validationError && (
              <p className="text-xs text-rose-600 font-semibold">{validationError}</p>
            )}

            {/* 7. ADD TO CART & 8. BUY NOW BUTTONS */}
            <div className="space-y-3 pt-2">
              {/* Add to Cart (Clean rounded border, minimal) */}
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={currentStock <= 0}
                className="w-full h-12 rounded-xl border border-stone-950 text-stone-950 bg-white hover:bg-stone-50 disabled:opacity-40 font-bold uppercase tracking-wider text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.99]"
              >
                <ShoppingBasket className="w-4 h-4" />
                <span>
                  {currentStock > 0
                    ? language === 'bn'
                      ? 'কার্টে যোগ করুন (Add to Cart)'
                      : 'Add to Cart'
                    : language === 'bn'
                    ? 'স্টক শেষ (Out of Stock)'
                    : 'Out of Stock'}
                </span>
              </button>

              {/* Buy Now (Solid dark button directly below Add to Cart) */}
              <button
                type="button"
                onClick={handleBuyNow}
                disabled={currentStock <= 0}
                className="w-full h-12 rounded-xl bg-stone-950 hover:bg-black text-white disabled:opacity-40 font-bold uppercase tracking-wider text-xs sm:text-sm transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.99]"
              >
                <span>{language === 'bn' ? 'সরাসরি অর্ডার করুন (Buy Now)' : 'Buy Now'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* 9. SHORT DESCRIPTION (Directly below buttons) */}
            <div className="pt-2 text-stone-600 text-xs sm:text-sm leading-relaxed">
              <p className="whitespace-pre-line">
                {product.shortDescription || product.description}
              </p>
            </div>

            {/* ======================================================
                10. ACCORDION SECTIONS (Size Chart, Product Details,
                    Laundry Care, Shipping Details)
               ====================================================== */}
            <div className="border-t border-stone-200 pt-3 divide-y divide-stone-200">
              {/* Accordion 1: Size Chart */}
              <div>
                <button
                  type="button"
                  onClick={() => toggleAccordion('sizeChart')}
                  className="w-full py-4 flex items-center justify-between text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <Ruler className="w-4 h-4 text-stone-700" />
                    <span className="text-xs sm:text-sm font-bold text-stone-950 uppercase tracking-wider">
                      {language === 'bn' ? 'সাইজ চার্ট (Size Chart)' : 'Size Chart'}
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-stone-500 transition-transform duration-200 ${
                      openAccordions.sizeChart ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {openAccordions.sizeChart && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden pb-4"
                    >
                      <div className="border border-stone-200 rounded-xl overflow-x-auto text-xs bg-stone-50">
                        <table className="w-full text-left">
                          <thead className="bg-stone-100 font-bold text-stone-800 uppercase tracking-wider text-[11px]">
                            <tr>
                              {sizeChartData.headers.map((h, i) => (
                                <th key={i} className="p-3 border-b border-stone-200">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-200 bg-white">
                            {sizeChartData.rows.map((row, rIdx) => (
                              <tr key={rIdx} className="hover:bg-stone-50/50">
                                {sizeChartData.headers.map((h, hIdx) => (
                                  <td
                                    key={hIdx}
                                    className={`p-3 ${hIdx === 0 ? 'font-bold text-stone-900' : 'text-stone-600'}`}
                                  >
                                    {row[h] || row[h.toLowerCase()] || '-'}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <p className="text-[11px] text-stone-400 mt-2 italic">
                        * All measurements are in inches. Allow ±0.5" manufacturing tolerance.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Accordion 2: Product Details */}
              <div>
                <button
                  type="button"
                  onClick={() => toggleAccordion('productDetails')}
                  className="w-full py-4 flex items-center justify-between text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <Layers className="w-4 h-4 text-stone-700" />
                    <span className="text-xs sm:text-sm font-bold text-stone-950 uppercase tracking-wider">
                      {language === 'bn' ? 'প্রোডাক্ট বিবরণ (Product Details)' : 'Product Details'}
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-stone-500 transition-transform duration-200 ${
                      openAccordions.productDetails ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {openAccordions.productDetails && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden pb-4"
                    >
                      <div className="border border-stone-200 rounded-xl divide-y divide-stone-200 bg-white text-xs">
                        {productDetailsList.map((item, idx) => (
                          <div key={idx} className="p-3 flex items-start justify-between gap-4">
                            <span className="font-semibold text-stone-600 w-1/3 shrink-0">
                              {item.label}
                            </span>
                            <span className="text-stone-900 w-2/3 text-right font-medium">
                              {item.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Accordion 3: Laundry Care */}
              <div>
                <button
                  type="button"
                  onClick={() => toggleAccordion('laundryCare')}
                  className="w-full py-4 flex items-center justify-between text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-4 h-4 text-stone-700" />
                    <span className="text-xs sm:text-sm font-bold text-stone-950 uppercase tracking-wider">
                      {language === 'bn' ? 'লন্ড্রি ও ওয়াশ কেয়ার (Laundry Care)' : 'Laundry Care'}
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-stone-500 transition-transform duration-200 ${
                      openAccordions.laundryCare ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {openAccordions.laundryCare && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden pb-4"
                    >
                      <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-700 space-y-2">
                        <ul className="space-y-1.5 list-disc list-inside text-stone-600">
                          {laundryCareList.map((rule, idx) => (
                            <li key={idx} className="leading-relaxed">
                              {rule}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Accordion 4: Shipping Details */}
              <div>
                <button
                  type="button"
                  onClick={() => toggleAccordion('shippingDetails')}
                  className="w-full py-4 flex items-center justify-between text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <Truck className="w-4 h-4 text-stone-700" />
                    <span className="text-xs sm:text-sm font-bold text-stone-950 uppercase tracking-wider">
                      {language === 'bn' ? 'শিপিং ও ডেলিভারি (Shipping Details)' : 'Shipping Details'}
                    </span>
                  </div>
                  <ChevronDown
                    className={`w-4 h-4 text-stone-500 transition-transform duration-200 ${
                      openAccordions.shippingDetails ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {openAccordions.shippingDetails && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: 'easeInOut' }}
                      className="overflow-hidden pb-4"
                    >
                      <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-700 space-y-2.5">
                        <div>
                          <span className="font-bold text-stone-900 block mb-0.5">
                            {language === 'bn' ? 'ডেলিভারি সময়:' : 'Delivery Time:'}
                          </span>
                          <p className="text-stone-600">{shippingDetailsData.deliveryTime}</p>
                        </div>

                        <div>
                          <span className="font-bold text-stone-900 block mb-0.5">
                            {language === 'bn' ? 'প্রসেসিং সময়:' : 'Processing Time:'}
                          </span>
                          <p className="text-stone-600">{shippingDetailsData.processingTime}</p>
                        </div>

                        <div>
                          <span className="font-bold text-stone-900 block mb-0.5">
                            {language === 'bn' ? 'শিপিং ফি:' : 'Shipping Fee:'}
                          </span>
                          <p className="text-stone-600">{shippingDetailsData.shippingFee}</p>
                        </div>

                        {shippingDetailsData.invoiceInfo && (
                          <div>
                            <span className="font-bold text-stone-900 block mb-0.5">
                              {language === 'bn' ? 'ইনভয়েস ও ট্র্যাকিং:' : 'Invoice Information:'}
                            </span>
                            <p className="text-stone-600">{shippingDetailsData.invoiceInfo}</p>
                          </div>
                        )}

                        {shippingDetailsData.notes && (
                          <div>
                            <span className="font-bold text-stone-900 block mb-0.5">
                              {language === 'bn' ? 'জরুরি নোট:' : 'Delivery Notes:'}
                            </span>
                            <p className="text-stone-600">{shippingDetailsData.notes}</p>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Reviews Section (Placed below main PDP content) */}
        <div className="mt-16 pt-10 border-t border-stone-200">
          <div className="max-w-4xl space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-stone-950">
                  {language === 'bn' ? 'গ্রাহক রিভিউ ও মতামত' : 'Customer Reviews'}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex items-center text-amber-500">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-4 h-4 ${
                          star <= Math.round(Number(averageRating))
                            ? 'fill-amber-400 text-amber-500'
                            : 'text-stone-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-bold text-stone-800">
                    {averageRating} / 5 ({displayReviews.length}{' '}
                    {language === 'bn' ? 'টি রিভিউ' : 'reviews'})
                  </span>
                </div>
              </div>
            </div>

            {/* Reviews List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {displayReviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-4 rounded-xl border border-stone-200 bg-stone-50 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-stone-900">{rev.userName}</span>
                    <div className="flex items-center gap-0.5 text-amber-400">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3 h-3 ${s <= rev.rating ? 'fill-amber-400' : 'text-stone-300'}`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-stone-600 leading-relaxed">{rev.comment}</p>
                  <span className="text-[10px] text-stone-400 block pt-1">{rev.createdAt}</span>
                </div>
              ))}
            </div>

            {/* Write a Review */}
            <div className="p-5 rounded-2xl border border-stone-200 bg-white space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-stone-900">
                {language === 'bn' ? 'আপনার রিভিউ দিন' : 'Write a Review'}
              </h4>
              <form onSubmit={handleReviewSubmit} className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-stone-600">Rating:</span>
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setReviewRating(s)}
                      className="cursor-pointer"
                    >
                      <Star
                        className={`w-5 h-5 ${
                          s <= reviewRating ? 'fill-amber-400 text-amber-500' : 'text-stone-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  required
                  value={reviewName}
                  onChange={(e) => setReviewName(e.target.value)}
                  placeholder={language === 'bn' ? 'আপনার নাম' : 'Your name'}
                  className="w-full px-3.5 py-2 border border-stone-300 rounded-xl text-xs focus:outline-none focus:border-stone-900"
                />

                <textarea
                  required
                  rows={2}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder={language === 'bn' ? 'আপনার মতামত লিখুন...' : 'Write your feedback...'}
                  className="w-full px-3.5 py-2 border border-stone-300 rounded-xl text-xs focus:outline-none focus:border-stone-900 resize-none"
                />

                <button
                  type="submit"
                  disabled={isSubmittingReview}
                  className="px-5 py-2.5 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  {language === 'bn' ? 'রিভিউ সাবমিট করুন' : 'Submit Review'}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Related Collection */}
        {relatedProducts.length > 0 && (
          <div className="mt-16 pt-10 border-t border-stone-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg sm:text-xl font-bold text-stone-950">
                {language === 'bn' ? 'সংশ্লিষ্ট অন্যান্য পোশাক' : 'You May Also Like'}
              </h3>
              <button
                onClick={() => navigateToCategory(product.category.toLowerCase())}
                className="text-xs font-semibold text-stone-700 hover:text-stone-950 flex items-center gap-1 cursor-pointer"
              >
                <span>{language === 'bn' ? 'সবগুলো দেখুন' : 'View All'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
              {relatedProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
