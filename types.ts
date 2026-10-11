export type AdminRole = 'super_admin' | 'product_manager' | 'order_manager' | 'content_manager';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  avatar?: string;
  lastLogin?: string;
}

export interface SizeChartData {
  headers: string[]; // e.g., ['Size', 'Waist', 'Length', 'Thigh']
  rows: Array<Record<string, string>>; // e.g., [{ Size: 'S', Waist: '28-30"', Length: '38"', Thigh: '22"' }]
}

export interface ProductDetailAttribute {
  label: string; // e.g., 'Color', 'Fabric', 'Fit', 'Embroidery', 'Waistband', 'Pockets', 'Stitching', 'Style'
  value: string;
}

export interface ShippingDetailsData {
  deliveryTime?: string;
  processingTime?: string;
  shippingFee?: string;
  invoiceInfo?: string;
  notes?: string;
}

export interface ProductVariant {
  id: string;
  sku: string;
  color: string;
  colorId?: string;
  colorCode?: string;
  colorSwatchPattern?: string;
  size: string; // e.g., 'S', 'M', 'L', 'XL', '2XL', '2.5 হাত', '3 হাত'
  sizeId?: string;
  price: number;
  stock: number;
  image?: string;
  galleryImages?: string[];
  status: 'active' | 'inactive';
}

export interface Product {
  id: string;
  name: string;
  banglaName: string;
  slug: string;
  sku: string;
  description: string;
  shortDescription: string;
  category: string; // 'MEN', 'WOMEN', 'OTHERS'
  subCategory: string; // 'Lungi', 'T-Shirt', 'Panjabi', 'Saree', 'Three-Piece'
  brand: string;
  price: number;
  discountPrice?: number;
  stock: number;
  lowStockThreshold?: number;
  isFeatured: boolean;
  isNewArrival: boolean;
  isBestSeller: boolean;
  isOffer: boolean;
  status: 'active' | 'inactive' | 'archived' | 'draft';
  mainImage: string;
  galleryImages: string[];
  colorGalleries?: Record<string, string[]>;
  imageAlt?: string;
  variants: ProductVariant[];
  sizeChart?: SizeChartData;
  productDetails?: ProductDetailAttribute[];
  laundryCare?: string[];
  shippingDetails?: ShippingDetailsData;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  createdAt: string;
  salesCount?: number;
}

export interface Category {
  id: string;
  name: string;
  banglaName: string;
  slug: string;
  parentCategory: 'MEN' | 'WOMEN' | 'OTHERS';
  image?: string;
  banner?: string;
  description?: string;
  seoTitle?: string;
  seoDescription?: string;
  order: number;
  isActive: boolean;
}

export interface NavDropdownItem {
  id: string;
  label: string;
  banglaLabel: string;
  url: string;
  categorySlug?: string;
  order: number;
  isActive: boolean;
}

export interface NavMenu {
  id: string;
  mainCategory: 'MEN' | 'WOMEN' | 'OTHERS';
  label: string;
  banglaLabel: string;
  order: number;
  isActive: boolean;
  items: NavDropdownItem[];
}

export interface HeroBanner {
  id: string;
  title: string;
  banglaTitle: string;
  subtitle: string;
  banglaSubtitle?: string;
  buttonText: string;
  buttonUrl: string;
  desktopImage: string;
  mobileImage?: string;
  videoUrl?: string;
  mediaType?: 'image' | 'video';
  order: number;
  isActive: boolean;
  tag?: string;
}

export interface CategoryBanner {
  id: string;
  categorySlug: string; // e.g. 'lungi', 'saree', 'panjabi'
  title: string;
  banglaTitle: string;
  description: string;
  desktopImage: string;
  mobileImage?: string;
  ctaText?: string;
  ctaUrl?: string;
  order?: number;
  isActive: boolean;
}

export interface CollectionGridItem {
  id: string;
  title: string;
  banglaTitle: string;
  subtitle: string;
  image: string;
  link: string;
  position: number;
  isActive: boolean;
}

export interface OfferSectionConfig {
  isActive: boolean;
  title: string;
  banglaTitle: string;
  subtitle: string;
  bannerImage: string;
  endDate: string;
  discountPercentage: number;
  featuredProductIds: string[];
  showCountdown?: boolean;
}

export interface CategoryOfferItem {
  id: string;
  categoryName: string;
  categorySlug: string;
  offerBadge: string;
  headline: string;
  discountSummary: string;
  couponCode: string;
  minAmount: number;
}

export interface OrderItem {
  id?: string;
  orderId?: string;
  productId: string;
  productName: string; // IMMUTABLE SNAPSHOT of product name at purchase
  banglaName?: string; // IMMUTABLE SNAPSHOT of Bangla name
  variantId?: string;
  variantSummary?: string; // e.g., 'Blue / L' or 'Free Size'
  sku: string; // IMMUTABLE SNAPSHOT of SKU at purchase
  price: number; // Unit price snapshot at purchase time
  originalPrice?: number; // Regular unit price snapshot
  discountAmount?: number; // Discount per item snapshot
  quantity: number;
  totalPrice?: number; // unit_price * quantity snapshot
  image: string; // Image URL snapshot at purchase time
  attributesSnapshot?: {
    color?: string;
    size?: string;
    fabric?: string;
    category?: string;
    subCategory?: string;
  };
}

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered'
  | 'cancelled'
  | 'return_requested'
  | 'returned';

export type Language = 'bn' | 'en';

export type PaymentMethod =
  | 'cod'
  | 'bkash'
  | 'nagad'
  | 'rocket'
  | 'sslcommerz'
  | 'card'
  | 'international_card'
  | 'bank_transfer';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refund_pending' | 'refunded' | 'partially_refunded';

export interface OrderTimeline {
  date: string;
  status: string;
  note: string;
  actor?: string;
}

export interface OrderStatusHistory {
  id: string;
  orderId: string;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  changedBy: string;
  changeReason?: string;
  timestamp: string;
}

export type ReturnReasonCode =
  | 'size_fit_issue'
  | 'defective_damaged'
  | 'wrong_item_received'
  | 'color_mismatch'
  | 'quality_issue'
  | 'customer_mind_change';

export type ReturnCondition = 'sellable' | 'damaged' | 'defective';

export type ReturnWorkflowStatus =
  | 'requested'
  | 'approved'
  | 'item_received'
  | 'inspected'
  | 'completed'
  | 'rejected';

export interface ReturnItem {
  id: string;
  returnId: string;
  orderItemId?: string;
  productId: string;
  variantId?: string;
  productName: string;
  sku: string;
  variantSummary?: string;
  quantity: number;
  unitPrice: number;
  refundAmount: number;
  condition: ReturnCondition;
  restocked: boolean;
  restockedAt?: string;
  damagedLogged?: boolean;
}

export interface OrderReturn {
  id: string; // e.g. 'RET-2026-001'
  orderId: string;
  customerName: string;
  customerPhone: string;
  reason: string;
  reasonCode: ReturnReasonCode;
  details?: string;
  status: ReturnWorkflowStatus;
  items: ReturnItem[];
  totalRefundAmount: number;
  refundStatus: 'not_applicable' | 'pending' | 'processed' | 'rejected';
  refundMethod?: PaymentMethod | 'wallet' | 'cash';
  refundTxnId?: string;
  createdAt: string;
  processedAt?: string;
  adminNotes?: string;
}

export interface Order {
  id: string; // e.g. 'BS-1082'
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  deliveryAddress: string;
  country?: string;
  countryCode?: string;
  district: string;
  upazila?: string;
  postalCode?: string;
  stateProvince?: string;
  items: OrderItem[];
  subtotal: number;
  deliveryCharge: number;
  discount: number;
  couponCode?: string;
  total: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  paymentTxnId?: string;
  orderStatus: OrderStatus;
  orderDate: string;
  customerNotes?: string;
  adminNotes?: string;
  timeline: OrderTimeline[];
  statusHistory?: OrderStatusHistory[];
  returnRequests?: OrderReturn[];
  refundAmount?: number;
  refundTxnId?: string;
}

export interface InventoryTransaction {
  id: string;
  productId: string;
  productName: string;
  variantSummary?: string;
  sku: string;
  previousStock: number;
  newStock: number;
  difference: number;
  reason: 'restock' | 'adjustment' | 'order_placed' | 'order_cancelled' | 'damaged' | 'return';
  timestamp: string;
  performedBy: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address?: string;
  district?: string;
  registrationDate: string;
  joinedDate?: string;
  lastOrderDate?: string;
  totalOrders: number;
  totalSpent: number;
  status: 'active' | 'blocked';
  notes?: string;
}

export interface Coupon {
  id: string;
  code: string;
  description?: string;
  discountType: 'percentage' | 'fixed' | 'percent';
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount?: number;
  startDate?: string;
  expiryDate: string;
  expiryTime?: string;
  usageLimit: number;
  usedCount: number;
  perUserLimit?: number;
  allowStacking?: boolean;
  isActive?: boolean;
  status?: 'active' | 'expired' | 'disabled';
}

export interface CustomDeliveryZone {
  id: string;
  name: string;
  nameBn: string;
  charge: number;
  estimatedDays: string;
  isActive?: boolean;
}

export interface DeliveryConfig {
  insideSirajganjLabel?: string;
  insideSirajganjCharge?: number;
  outsideSirajganjLabel?: string;
  outsideSirajganjCharge?: number;
  insideDhakaCharge: number;
  outsideDhakaCharge: number;
  freeDeliveryThreshold: number;
  estimatedInsideDhakaDays?: string;
  estimatedOutsideDhakaDays?: string;
  estimatedDeliveryDays?: string;
  customZones?: CustomDeliveryZone[];
  freeDeliveryOnOnlinePayment?: boolean;
  onlinePaymentFreeNotice?: string;
}

export interface CustomPaymentMethod {
  id: string;
  name: string;
  nameBn: string;
  accountNumber: string;
  accountType?: string;
  instructions?: string;
  logoUrl?: string;
  isActive: boolean;
}

export interface PaymentConfig {
  enableCod: boolean;
  enableBkash: boolean;
  bkashNumber: string;
  bkashType: 'merchant' | 'personal';
  enableNagad: boolean;
  nagadNumber: string;
  enableRocket: boolean;
  rocketNumber: string;
  enableSslCommerz: boolean;
  instructions: {
    bkash: string;
    nagad: string;
    rocket: string;
    cod: string;
  };
  customMethods?: CustomPaymentMethod[];
}

export interface BlogPost {
  id: string;
  title: string;
  banglaTitle: string;
  slug: string;
  excerpt: string;
  content: string;
  featuredImage: string;
  category: string;
  author: string;
  isPublished: boolean;
  publishedAt: string;
  seoTitle?: string;
  seoDescription?: string;
}

export interface CMSStep {
  stepNumber: number;
  title: string;
  banglaTitle: string;
  description: string;
  iconName: string;
  image?: string;
}

export interface ClothingVideoItem {
  id: string;
  title: string;
  banglaTitle: string;
  category: string; // 'Lungi', 'Saree', 'Panjabi', 'Three-Piece', 'T-Shirt'
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  makingProcessText: string;
  howToWearText?: string;
}

export interface FooterLinkItem {
  id: string;
  title: string;
  url: string;
  target?: '_blank' | '_self';
  isActive?: boolean;
}

export interface FooterPolicyItem {
  id: string;
  title: string;
  content: string;
  isActive?: boolean;
}

export interface FooterContactItem {
  id: string;
  type: 'address' | 'phone' | 'email' | 'whatsapp' | 'other';
  label: string;
  value: string;
  link?: string;
  isActive?: boolean;
}

export interface FooterConfig {
  aboutUs: string;
  phone: string;
  email: string;
  address: string;
  facebookUrl: string;
  instagramUrl: string;
  youtubeUrl: string;
  whatsappUrl?: string;
  privacyPolicy: string;
  termsAndConditions: string;
  returnPolicy: string;
  shippingPolicy: string;
  quickLinks?: FooterLinkItem[];
  policies?: FooterPolicyItem[];
  contactItems?: FooterContactItem[];
  copyrightText?: string;
}

export interface InvoiceTermItem {
  id: string;
  text: string;
}

export interface InvoiceConfig {
  headerTitle: string;
  headerSubtitle: string;
  authoritySignatureTitle: string;
  authorityName: string;
  showProductImage: boolean;
  termsTitle: string;
  terms: InvoiceTermItem[];
  footerNote: string;
  customerServiceNote: string;
}

export interface SEOConfig {
  siteTitle: string;
  metaDescription: string;
  keywords: string;
  ogImage: string;
  canonicalUrl: string;
  robotsTxt: string;
  sitemapEnabled: boolean;
}

export interface AuditLog {
  id: string;
  action: string;
  details: string;
  adminName: string;
  timestamp: string;
  category: 'product' | 'order' | 'inventory' | 'settings' | 'auth' | 'cms' | 'banner';
}

// Aliases and auxiliary configurations for modular admin panels
export type AdminStaff = AdminUser & {
  status?: 'active' | 'inactive';
  permissions?: string[];
};

export interface GeneralSettings {
  siteName: string;
  tagline: string;
  phone: string;
  officePhone?: string;
  helplinePhone?: string;
  email: string;
  storeEmail?: string;
  address: string;
  storeAddress?: string;
  storeDescription?: string;
  facebookUrl: string;
  instagramUrl: string;
  youtubeUrl?: string;
  whatsappNumber: string;
  logoUrl: string;
}

export interface BrandPartnerStory {
  id: string;
  orderNumber: number;
  title: string;
  titleEn: string;
  shortDesc: string;
  shortDescEn?: string;
  image: string;
  detailedText: string;
  detailedTextEn?: string;
  videoUrl?: string;
  videoTitle?: string;
  isActive: boolean;
}

export type HowToOrderStep = CMSStep;
export type ClothingStory = ClothingVideoItem & {
  thumbnail?: string;
  duration?: string;
  isActive?: boolean;
};

export interface ProductPageSettings {
  showSku: boolean;
  showStockCount: boolean;
  showShareButton: boolean;
  showSizeGuide: boolean;
}

export type CollectionItem = CollectionGridItem;
export type NavigationMenu = NavMenu;
export type NavigationMenuItem = NavDropdownItem;

export interface ProductReview {
  id: string;
  productId: string;
  customerName: string;
  rating: number; // 1 to 5
  comment: string;
  createdAt: string;
  isVerifiedPurchase?: boolean;
}

export interface LandingPageHighlight {
  title: string;
  desc: string;
}

export interface LandingPageReview {
  name: string;
  photo?: string;
  comment: string;
}

export interface LandingPage {
  id: string;
  title: string;
  slug: string;
  product_id: string;
  template: string;
  badge_text: string;
  headline: string;
  subheadline?: string;
  video_url?: string;
  benefits: string[];
  highlights: LandingPageHighlight[];
  customerReviews: LandingPageReview[];
  offer_price: number;
  regular_price: number;
  delivery_inside_dhaka: number;
  delivery_outside_dhaka: number;
  whatsapp_number: string;
  call_number: string;
  status: 'active' | 'inactive';
  view_count: number;
  order_count: number;
  created_at?: string;
  updated_at?: string;
}

export interface PixelSettings {
  pixelId: string;
  capiToken: string;
  testCode: string;
  gtmId: string;
  status: 'active' | 'inactive';
}

export interface ColorItem {
  id: string;
  name: string;
  bangla_name: string;
  hex_code: string;
  active: number;
}

export interface HomeSideBanner {
  id: string;
  position: 'top' | 'bottom';
  badge: string;
  title: string;
  subtitle: string;
  priceText: string;
  buttonText: string;
  link: string;
  image: string;
  bgGradient?: string;
  isActive: boolean;
}

export interface SizeItem {
  id: string;
  name: string;
  bangla_name: string;
  code: string;
  category?: string;
  sort_order: number;
  active: number;
}


