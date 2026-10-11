import React, { useState, useEffect, useMemo } from 'react';
import { Product, ProductVariant, Category, SizeChartData } from '../../types';
import { useShop } from '../../context/ShopContext';
import { adminFetch } from '../adminApi';
import {
  X,
  ChevronRight,
  ChevronLeft,
  Upload,
  Plus,
  Trash2,
  Check,
  Eye,
  Sparkles,
  Layers,
  Palette,
  Ruler,
  DollarSign,
  Send,
  Save,
  Tag,
  ArrowRight,
  ArrowLeft,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  Copy,
  Star,
  RotateCcw,
} from 'lucide-react';

interface ProductUploadWizardProps {
  initialProduct?: Partial<Product> | null;
  categories: Category[];
  onSave: (product: Product) => void;
  onCancel: () => void;
}

// Preset color options with Bengali and English names
interface ColorOption {
  id: string;
  name: string;
  banglaName: string;
  hex: string;
}

const PRESET_COLORS: ColorOption[] = [
  { id: 'black', name: 'Black', banglaName: 'কালো', hex: '#18181b' },
  { id: 'blue', name: 'Blue', banglaName: 'নীল', hex: '#1e40af' },
  { id: 'green', name: 'Green', banglaName: 'সবুজ', hex: '#15803d' },
  { id: 'red', name: 'Red', banglaName: 'লাল', hex: '#b91c1c' },
  { id: 'white', name: 'White', banglaName: 'সাদা', hex: '#f8fafc' },
  { id: 'maroon', name: 'Maroon', banglaName: 'মেরুন', hex: '#881337' },
  { id: 'navy', name: 'Navy', banglaName: 'নেভি ব্লু', hex: '#0f172a' },
  { id: 'mustard', name: 'Mustard', banglaName: 'সরিষা হলুদ', hex: '#ca8a04' },
  { id: 'olive', name: 'Olive', banglaName: 'জলপাই', hex: '#4d7c0f' },
  { id: 'brown', name: 'Brown', banglaName: 'বাদামি', hex: '#78350f' },
  { id: 'grey', name: 'Grey', banglaName: 'ধূসর', hex: '#64748b' },
  { id: 'offwhite', name: 'Off-White', banglaName: 'অফ-হোয়াইট', hex: '#fef3c7' },
];

// Preset size templates with realistic Bangladeshi textile measurement charts
export interface SizeTemplate {
  id: string;
  name: string;
  banglaName: string;
  defaultSizes: string[];
  defaultChart: SizeChartData;
}

export const SIZE_TEMPLATES: SizeTemplate[] = [
  {
    id: 'lungi_chart',
    name: 'Lungi Size & Length (লুঙ্গি সাইজ ও হাত মাপ চার্ট)',
    banglaName: '২.৫ হাত, ২.৭৫ হাত, ৩ হাত, Free Size (দৈর্ঘ্য ও ঘের)',
    defaultSizes: ['২.৫ হাত', '২.৭৫ হাত', '৩ হাত', 'Free Size'],
    defaultChart: {
      headers: ['Size', 'Length (দৈর্ঘ্য)', 'Width (ঘের/প্রস্থ)', 'Recommended For (উপযোগী)'],
      rows: [
        { Size: '২.৫ হাত', 'Length (দৈর্ঘ্য)': '45 Inch', 'Width (ঘের/প্রস্থ)': '82 Inch', 'Recommended For (উপযোগী)': 'উচ্চতা ৫\'২" - ৫\'৫"' },
        { Size: '২.৭৫ হাত', 'Length (দৈর্ঘ্য)': '48 Inch', 'Width (ঘের/প্রস্থ)': '88 Inch', 'Recommended For (উপযোগী)': 'উচ্চতা ৫\'৬" - ৫\'১০" (স্ট্যান্ডার্ড)' },
        { Size: '৩ হাত', 'Length (দৈর্ঘ্য)': '52 Inch', 'Width (ঘের/প্রস্থ)': '92 Inch', 'Recommended For (উপযোগী)': 'উচ্চতা ৫\'১০"+ (লম্বা মানুষদের)' },
        { Size: 'Free Size', 'Length (দৈর্ঘ্য)': '48 Inch', 'Width (ঘের/প্রস্থ)': '88 Inch', 'Recommended For (উপযোগী)': 'রেগুলার যেকোনো উচ্চতা' },
      ],
    },
  },
  {
    id: 'saree_chart',
    name: 'Saree Standard (শাড়ি সাইজ ও আঁচল/ব্লাউজ চার্ট)',
    banglaName: '১২ হাত, ১২.৫ হাত, ১৪ হাত, Free Size (দৈর্ঘ্য ও ব্লাউজ পিস)',
    defaultSizes: ['১২ হাত (Standard)', '১২.৫ হাত (With Blouse)', 'Free Size'],
    defaultChart: {
      headers: ['Size', 'Length (দৈর্ঘ্য)', 'Blouse Piece (ব্লাউজ পিস)', 'Aanchal / Pallu (আঁচল)'],
      rows: [
        { Size: '১২ হাত (Standard)', 'Length (দৈর্ঘ্য)': '5.5 Meter', 'Blouse Piece (ব্লাউজ পিস)': 'Without Blouse Piece', 'Aanchal / Pallu (আঁচল)': 'Traditional Woven' },
        { Size: '১২.৫ হাত (With Blouse)', 'Length (দৈর্ঘ্য)': '6.0 Meter', 'Blouse Piece (ব্লাউজ পিস)': 'Included (0.8 Meter)', 'Aanchal / Pallu (আঁচল)': 'Designer Zari/Resham' },
        { Size: 'Free Size', 'Length (দৈর্ঘ্য)': '5.5 Meter (১২ হাত)', 'Blouse Piece (ব্লাউজ পিস)': 'রানিং ব্লাউজ পিস সহ', 'Aanchal / Pallu (আঁচল)': 'অভিজাত ট্র্যাডিশনাল' },
      ],
    },
  },
  {
    id: 'panjabi_chart',
    name: 'Panjabi Standard Fit (পাঞ্জাবি সাইজ ও মাপ চার্ট)',
    banglaName: '৩৮, ৪০, ৪২, ৪৪, ৪৬ (বুক, দৈর্ঘ্য, কাঁধ ও হাতা)',
    defaultSizes: ['38 (S)', '40 (M)', '42 (L)', '44 (XL)', '46 (XXL)'],
    defaultChart: {
      headers: ['Size', 'Chest (বুক)', 'Length (দৈর্ঘ্য)', 'Shoulder (কাঁধ)', 'Sleeve (হাতা)'],
      rows: [
        { Size: '38 (S)', 'Chest (বুক)': '40"', 'Length (দৈর্ঘ্য)': '40"', 'Shoulder (কাঁধ)': '17.5"', 'Sleeve (হাতা)': '24"' },
        { Size: '40 (M)', 'Chest (বুক)': '42"', 'Length (দৈর্ঘ্য)': '42"', 'Shoulder (কাঁধ)': '18"', 'Sleeve (হাতা)': '24.5"' },
        { Size: '42 (L)', 'Chest (বুক)': '44"', 'Length (দৈর্ঘ্য)': '44"', 'Shoulder (কাঁধ)': '18.5"', 'Sleeve (হাতা)': '25"' },
        { Size: '44 (XL)', 'Chest (বুক)': '46"', 'Length (দৈর্ঘ্য)': '45"', 'Shoulder (কাঁধ)': '19"', 'Sleeve (হাতা)': '25.5"' },
        { Size: '46 (XXL)', 'Chest (বুক)': '48"', 'Length (দৈর্ঘ্য)': '46"', 'Shoulder (কাঁধ)': '19.5"', 'Sleeve (হাতা)': '26"' },
      ],
    },
  },
  {
    id: 'tshirt_chart',
    name: 'T-Shirt & Shirt (টি-শার্ট ও শার্ট সাইজ চার্ট)',
    banglaName: 'S, M, L, XL, XXL (বুক, বডি দৈর্ঘ্য ও হাতা)',
    defaultSizes: ['S', 'M', 'L', 'XL', 'XXL'],
    defaultChart: {
      headers: ['Size', 'Chest (বুক)', 'Length (দৈর্ঘ্য)', 'Sleeve (হাতা)'],
      rows: [
        { Size: 'S', 'Chest (বুক)': '38"', 'Length (দৈর্ঘ্য)': '27"', 'Sleeve (হাতা)': '8"' },
        { Size: 'M', 'Chest (বুক)': '40"', 'Length (দৈর্ঘ্য)': '28"', 'Sleeve (হাতা)': '8.5"' },
        { Size: 'L', 'Chest (বুক)': '42"', 'Length (দৈর্ঘ্য)': '29"', 'Sleeve (হাতা)': '9"' },
        { Size: 'XL', 'Chest (বুক)': '44"', 'Length (দৈর্ঘ্য)': '30"', 'Sleeve (হাতা)': '9.5"' },
        { Size: 'XXL', 'Chest (বুক)': '46"', 'Length (দৈর্ঘ্য)': '31"', 'Sleeve (হাতা)': '10"' },
      ],
    },
  },
  {
    id: 'threepiece_chart',
    name: 'Three-Piece & Kurti (থ্রি-পিস ও কুর্তি সাইজ চার্ট)',
    banglaName: '৩৬, ৩৮, ৪০, ৪২, Unstitched (কামিজ, সালোয়ার ও ওড়না)',
    defaultSizes: ['36 (S)', '38 (M)', '40 (L)', '42 (XL)', 'Unstitched'],
    defaultChart: {
      headers: ['Size', 'Kameez Chest (কামিজ বুক)', 'Kameez Length (কামিজ দৈর্ঘ্য)', 'Salwar Length (সালোয়ার)', 'Dupatta (ওড়না)'],
      rows: [
        { Size: '36 (S)', 'Kameez Chest (কামিজ বুক)': '36"', 'Kameez Length (কামিজ দৈর্ঘ্য)': '44"', 'Salwar Length (সালোয়ার)': '38"', 'Dupatta (ওড়না)': '৫ হাত (2.5 Mtr)' },
        { Size: '38 (M)', 'Kameez Chest (কামিজ বুক)': '38"', 'Kameez Length (কামিজ দৈর্ঘ্য)': '45"', 'Salwar Length (সালোয়ার)': '39"', 'Dupatta (ওড়না)': '৫ হাত (2.5 Mtr)' },
        { Size: '40 (L)', 'Kameez Chest (কামিজ বুক)': '40"', 'Kameez Length (কামিজ দৈর্ঘ্য)': '46"', 'Salwar Length (সালোয়ার)': '40"', 'Dupatta (ওড়না)': '৫ হাত (2.5 Mtr)' },
        { Size: '42 (XL)', 'Kameez Chest (কামিজ বুক)': '42"', 'Kameez Length (কামিজ দৈর্ঘ্য)': '47"', 'Salwar Length (সালোয়ার)': '40"', 'Dupatta (ওড়না)': '৫ হাত (2.5 Mtr)' },
        { Size: 'Unstitched', 'Kameez Chest (কামিজ বুক)': 'Free / কাস্টমাইজ', 'Kameez Length (কামিজ দৈর্ঘ্য)': '48" Fabric', 'Salwar Length (সালোয়ার)': '2.5 গজ', 'Dupatta (ওড়না)': '৫ হাত কটন/শিফন' },
      ],
    },
  },
  {
    id: 'pajama_chart',
    name: 'Pajama Standard (পায়জামা সাইজ চার্ট)',
    banglaName: '৩৮, ৪০, ৪২, ৪৪ (কোমর, দৈর্ঘ্য ও পায়ের মোহরী)',
    defaultSizes: ['38', '40', '42', '44'],
    defaultChart: {
      headers: ['Size', 'Waist (কোমর)', 'Length (দৈর্ঘ্য)', 'Bottom Opening (পায়ের ঘের)'],
      rows: [
        { Size: '38', 'Waist (কোমর)': '30-34"', 'Length (দৈর্ঘ্য)': '38"', 'Bottom Opening (পায়ের ঘের)': '15"' },
        { Size: '40', 'Waist (কোমর)': '32-36"', 'Length (দৈর্ঘ্য)': '40"', 'Bottom Opening (পায়ের ঘের)': '16"' },
        { Size: '42', 'Waist (কোমর)': '34-38"', 'Length (দৈর্ঘ্য)': '42"', 'Bottom Opening (পায়ের ঘের)': '16.5"' },
        { Size: '44', 'Waist (কোমর)': '36-40"', 'Length (দৈর্ঘ্য)': '44"', 'Bottom Opening (পায়ের ঘের)': '17"' },
      ],
    },
  },
  {
    id: 'kids_chart',
    name: 'Kids Age Wise (বাচ্চাদের সাইজ চার্ট)',
    banglaName: '২-৩ বছর, ৪-৫ বছর, ৬-৭ বছর, ৮-৯ বছর, ১০-১২ বছর',
    defaultSizes: ['2-3 Y', '4-5 Y', '6-7 Y', '8-9 Y', '10-12 Y'],
    defaultChart: {
      headers: ['Size', 'Chest (বুক)', 'Length (দৈর্ঘ্য)', 'Waist (কোমর)'],
      rows: [
        { Size: '2-3 Y', 'Chest (বুক)': '24"', 'Length (দৈর্ঘ্য)': '20"', 'Waist (কোমর)': '20"' },
        { Size: '4-5 Y', 'Chest (বুক)': '26"', 'Length (দৈর্ঘ্য)': '23"', 'Waist (কোমর)': '22"' },
        { Size: '6-7 Y', 'Chest (বুক)': '28"', 'Length (দৈর্ঘ্য)': '26"', 'Waist (কোমর)': '24"' },
        { Size: '8-9 Y', 'Chest (বুক)': '30"', 'Length (দৈর্ঘ্য)': '29"', 'Waist (কোমর)': '26"' },
        { Size: '10-12 Y', 'Chest (বুক)': '32"', 'Length (দৈর্ঘ্য)': '32"', 'Waist (কোমর)': '28"' },
      ],
    },
  },
  {
    id: 'custom',
    name: 'Custom Chart (নিজস্ব কাস্টম সাইজ ও মাপ)',
    banglaName: 'অ্যাডমিন নিজের ইচ্ছামতো সাইজ ও পরিমাপ কলাম তৈরি করবেন',
    defaultSizes: ['Free Size'],
    defaultChart: {
      headers: ['Size', 'Measurement (মাপ)', 'Notes (মন্তব্য)'],
      rows: [
        { Size: 'Free Size', 'Measurement (মাপ)': 'Standard', 'Notes (মন্তব্য)': 'Regular Fit' },
      ],
    },
  },
];

// Category Automatic Parent Mapping
// e.g. Lungi -> lungi_chart, Saree -> saree_chart, Panjabi -> panjabi_chart
export const CATEGORY_MAPPINGS: Record<
  string,
  { parent: 'MEN' | 'WOMEN' | 'OTHERS'; bangla: string; defaultTemplate: string; skuPrefix: string }
> = {
  Lungi: { parent: 'MEN', bangla: 'লুঙ্গি', defaultTemplate: 'lungi_chart', skuPrefix: 'LNG' },
  Saree: { parent: 'WOMEN', bangla: 'শাড়ি', defaultTemplate: 'saree_chart', skuPrefix: 'SAR' },
  Panjabi: { parent: 'MEN', bangla: 'পাঞ্জাবি', defaultTemplate: 'panjabi_chart', skuPrefix: 'PAN' },
  'T-Shirt': { parent: 'MEN', bangla: 'টি-শার্ট', defaultTemplate: 'tshirt_chart', skuPrefix: 'TSH' },
  'Three-Piece': { parent: 'WOMEN', bangla: 'থ্রি-পিস', defaultTemplate: 'threepiece_chart', skuPrefix: '3PC' },
  Kurti: { parent: 'WOMEN', bangla: 'কুর্তি', defaultTemplate: 'threepiece_chart', skuPrefix: 'KUR' },
  Pajama: { parent: 'MEN', bangla: 'পায়জামা', defaultTemplate: 'pajama_chart', skuPrefix: 'PAJ' },
  Fotua: { parent: 'MEN', bangla: 'ফতুয়া', defaultTemplate: 'tshirt_chart', skuPrefix: 'FOT' },
  'Hijab/Abaya': { parent: 'WOMEN', bangla: 'হিজাব / আবায়া', defaultTemplate: 'saree_chart', skuPrefix: 'HIJ' },
  'Chadar/Shawl': { parent: 'OTHERS', bangla: 'চাদর / শাল', defaultTemplate: 'lungi_chart', skuPrefix: 'SHL' },
  'Kids Item': { parent: 'OTHERS', bangla: 'বাচ্চাদের কালেকশন', defaultTemplate: 'kids_chart', skuPrefix: 'KID' },
};

export const ProductUploadWizard: React.FC<ProductUploadWizardProps> = ({
  initialProduct,
  categories,
  onSave,
  onCancel,
}) => {
  const { showToast } = useShop();
  // 5 Step Wizard state (1 to 5)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // STEP 1: Basic Info
  const [productName, setProductName] = useState(initialProduct?.name || '');
  const [banglaName, setBanglaName] = useState(initialProduct?.banglaName || '');
  const [category, setCategory] = useState(initialProduct?.subCategory || 'Lungi');
  const [description, setDescription] = useState(
    initialProduct?.description ||
      '১০০% খাঁটি দেশীয় সুতা ও নিখুঁত ফিনিশিংয়ে তৈরি বস্ত্র শৈলীর প্রিমিয়াম কালেকশন।'
  );
  const [shortDescription, setShortDescription] = useState(
    initialProduct?.shortDescription || 'আরামদায়ক ও ঐতিহ্যবাহী হস্তশিল্প।'
  );
  const [brand, setBrand] = useState(initialProduct?.brand || 'BASTRA SHOILY');
  const [tags, setTags] = useState<string[]>(
    initialProduct?.seoKeywords ? initialProduct.seoKeywords.split(',').map((s) => s.trim()) : ['Cotton', 'Premium']
  );
  const [tagInput, setTagInput] = useState('');
  const [isFeatured, setIsFeatured] = useState(initialProduct?.isFeatured || false);
  const [isNewArrival, setIsNewArrival] = useState(initialProduct?.isNewArrival ?? true);
  const [isBestSeller, setIsBestSeller] = useState(initialProduct?.isBestSeller || false);
  const [isOffer, setIsOffer] = useState(initialProduct?.isOffer || false);

  // STEP 2: Colors & Gallery Mapping
  // Color -> Gallery Images array
  const [selectedColors, setSelectedColors] = useState<ColorOption[]>(() => {
    if (initialProduct?.variants && initialProduct.variants.length > 0) {
      const uniqueNames = Array.from(new Set(initialProduct.variants.map((v) => String(v.color)))) as string[];
      return uniqueNames.map((name: string) => {
        const found = PRESET_COLORS.find((c) => c.name.toLowerCase() === name.toLowerCase());
        return (
          found || {
            id: name.toLowerCase().replace(/\s+/g, '-'),
            name,
            banglaName: name,
            hex: initialProduct.variants?.find((v) => v.color === name)?.colorCode || '#3b82f6',
          }
        );
      });
    }
    return [PRESET_COLORS[0], PRESET_COLORS[1]]; // Black & Blue by default
  });

  // Dedicated Color Galleries (starts clean, populated by admin file uploads)
  const [colorGalleries, setColorGalleries] = useState<Record<string, string[]>>(() => {
    const map: Record<string, string[]> = {};
    if (initialProduct?.colorGalleries) {
      Object.assign(map, initialProduct.colorGalleries);
    } else if (initialProduct?.variants) {
      initialProduct.variants.forEach((v) => {
        if (v.color && v.galleryImages && v.galleryImages.length > 0) {
          map[v.color] = v.galleryImages;
        }
      });
    }
    return map;
  });

  const [activeGalleryColor, setActiveGalleryColor] = useState<string>('Black');
  const [bulkUrlInput, setBulkUrlInput] = useState('');
  const [showAddCustomColor, setShowAddCustomColor] = useState(false);
  const [customColorName, setCustomColorName] = useState('');
  const [customColorBangla, setCustomColorBangla] = useState('');
  const [customColorHex, setCustomColorHex] = useState('#6366f1');

  // STEP 2: Custom Main Image selection
  const [customMainImage, setCustomMainImage] = useState<string>(initialProduct?.mainImage || '');

  // STEP 3: Size Selection & Dynamic Size Chart
  const [selectedSizeTemplate, setSelectedSizeTemplate] = useState<string>(() => {
    const defaultCat = CATEGORY_MAPPINGS[initialProduct?.subCategory || 'Lungi'];
    return defaultCat?.defaultTemplate || 'lungi_chart';
  });

  const [activeSizes, setActiveSizes] = useState<string[]>(() => {
    if (initialProduct?.variants && initialProduct.variants.length > 0) {
      return Array.from(new Set(initialProduct.variants.map((v) => String(v.size)))) as string[];
    }
    const defaultCat = CATEGORY_MAPPINGS[initialProduct?.subCategory || 'Lungi'];
    const tmpl = SIZE_TEMPLATES.find((t) => t.id === defaultCat?.defaultTemplate) || SIZE_TEMPLATES[0];
    return tmpl.defaultSizes;
  });

  const [customSizeInput, setCustomSizeInput] = useState('');

  // Editable Size Chart State (rows & headers)
  const [sizeChart, setSizeChart] = useState<SizeChartData>(() => {
    if (initialProduct?.sizeChart && initialProduct.sizeChart.headers?.length > 0) {
      return JSON.parse(JSON.stringify(initialProduct.sizeChart));
    }
    const defaultCat = CATEGORY_MAPPINGS[initialProduct?.subCategory || 'Lungi'];
    const tmpl = SIZE_TEMPLATES.find((t) => t.id === defaultCat?.defaultTemplate) || SIZE_TEMPLATES[0];
    return tmpl?.defaultChart
      ? JSON.parse(JSON.stringify(tmpl.defaultChart))
      : {
          headers: ['Size', 'Length (দৈর্ঘ্য)', 'Width (ঘের/প্রস্থ)', 'Recommended For (উপযোগী)'],
          rows: [
            { Size: '২.৫ হাত', 'Length (দৈর্ঘ্য)': '45 Inch', 'Width (ঘের/প্রস্থ)': '82 Inch', 'Recommended For (উপযোগী)': 'উচ্চতা ৫\'২" - ৫\'৫"' },
            { Size: '২.৭৫ হাত', 'Length (দৈর্ঘ্য)': '48 Inch', 'Width (ঘের/প্রস্থ)': '88 Inch', 'Recommended For (উপযোগী)': 'উচ্চতা ৫\'৬" - ৫\'১০" (স্ট্যান্ডার্ড)' },
            { Size: '৩ হাত', 'Length (দৈর্ঘ্য)': '52 Inch', 'Width (ঘের/প্রস্থ)': '92 Inch', 'Recommended For (উপযোগী)': 'উচ্চতা ৫\'১০"+ (লম্বা মানুষদের)' },
            { Size: 'Free Size', 'Length (দৈর্ঘ্য)': '48 Inch', 'Width (ঘের/প্রস্থ)': '88 Inch', 'Recommended For (উপযোগী)': 'রেগুলার যেকোনো উচ্চতা' },
          ],
        };
  });

  const [newColumnName, setNewColumnName] = useState('');
  const [showAddColumn, setShowAddColumn] = useState(false);

  // STEP 4: Price & Variant Matrix
  const [basePrice, setBasePrice] = useState<number>(initialProduct?.price || 900);
  const [baseOfferPrice, setBaseOfferPrice] = useState<number>(initialProduct?.discountPrice || 720);
  const [baseStock, setBaseStock] = useState<number>(initialProduct?.stock || 20);
  const [skuPrefix, setSkuPrefix] = useState<string>(() => {
    return CATEGORY_MAPPINGS[initialProduct?.subCategory || 'Lungi']?.skuPrefix || 'LNG';
  });

  // Auto generated variants matrix
  const [variantsMatrix, setVariantsMatrix] = useState<
    Array<{
      id: string;
      color: string;
      colorCode: string;
      size: string;
      sku: string;
      price: number;
      offerPrice: number;
      stock: number;
      enabled: boolean;
    }>
  >([]);

  // Auto-generate SKUs and matrix whenever colors, sizes, or base prices change
  useEffect(() => {
    // Check if initialProduct had specific variants
    const initialMap: Record<string, ProductVariant> = {};
    if (initialProduct?.variants) {
      initialProduct.variants.forEach((v) => {
        initialMap[`${v.color}-${v.size}`] = v;
      });
    }

    const newMatrix: typeof variantsMatrix = [];
    selectedColors.forEach((color) => {
      activeSizes.forEach((size) => {
        const key = `${color.name}-${size}`;
        const existing = initialMap[key];

        // Format clean Auto SKU: PREFIX-COLOR-SIZE
        const colorCodeStr = color.name.slice(0, 3).toUpperCase();
        const sizeCodeStr = size.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase() || 'FS';
        const autoSku = `${skuPrefix}-${colorCodeStr}-${sizeCodeStr}`;

        newMatrix.push({
          id: existing?.id || `v-${Date.now()}-${color.name.toLowerCase()}-${size.toLowerCase()}`,
          color: color.name,
          colorCode: color.hex,
          size,
          sku: existing?.sku || autoSku,
          price: existing?.price || basePrice,
          offerPrice: (existing as any)?.discountPrice || baseOfferPrice,
          stock: existing?.stock ?? baseStock,
          enabled: existing ? existing.status === 'active' : true,
        });
      });
    });

    setVariantsMatrix(newMatrix);
  }, [selectedColors, activeSizes, skuPrefix]);

  // When category changes, auto-suggest template, size chart, and SKU prefix
  const handleCategoryChange = (newCat: string) => {
    setCategory(newCat);
    const mapping = CATEGORY_MAPPINGS[newCat];
    if (mapping) {
      setSelectedSizeTemplate(mapping.defaultTemplate);
      setSkuPrefix(mapping.skuPrefix);
      const tmpl = SIZE_TEMPLATES.find((t) => t.id === mapping.defaultTemplate);
      if (tmpl) {
        if (tmpl.defaultSizes && tmpl.defaultSizes.length > 0) {
          setActiveSizes(tmpl.defaultSizes);
        }
        if (tmpl.defaultChart) {
          setSizeChart(JSON.parse(JSON.stringify(tmpl.defaultChart)));
          showToast(`${mapping.bangla} (${newCat}) অনুযায়ী সাইজ চার্ট ও মাপের তালিকা লোড হয়েছে!`);
        }
      }
    }
  };

  // When size template changes
  const handleSizeTemplateChange = (templateId: string) => {
    setSelectedSizeTemplate(templateId);
    const tmpl = SIZE_TEMPLATES.find((t) => t.id === templateId);
    if (tmpl) {
      if (tmpl.defaultSizes.length > 0) {
        setActiveSizes(tmpl.defaultSizes);
      }
      if (tmpl.defaultChart) {
        setSizeChart(JSON.parse(JSON.stringify(tmpl.defaultChart)));
        showToast(`${tmpl.name} লোড হয়েছে!`);
      }
    }
  };

  // Size Chart interactive row & cell editing
  const handleChartCellChange = (rowIndex: number, header: string, value: string) => {
    setSizeChart((prev) => {
      const updatedRows = [...prev.rows];
      updatedRows[rowIndex] = {
        ...updatedRows[rowIndex],
        [header]: value,
      };
      return {
        ...prev,
        rows: updatedRows,
      };
    });
  };

  // Add new measurement row to chart
  const handleAddChartRow = () => {
    setSizeChart((prev) => {
      const newRow: Record<string, string> = {};
      prev.headers.forEach((h) => {
        newRow[h] = h === 'Size' ? `Custom ${prev.rows.length + 1}` : '';
      });
      return {
        ...prev,
        rows: [...prev.rows, newRow],
      };
    });
    showToast('নতুন সাইজ রো যোগ হয়েছে। মাপ লিখুন।');
  };

  // Delete measurement row from chart
  const handleRemoveChartRow = (rowIndex: number) => {
    if (sizeChart.rows.length <= 1) {
      showToast('চার্টে অন্তত একটি সাইজ রো থাকতে হবে।');
      return;
    }
    setSizeChart((prev) => ({
      ...prev,
      rows: prev.rows.filter((_, i) => i !== rowIndex),
    }));
    showToast('সাইজ রো মুছে ফেলা হয়েছে।');
  };

  // Add new measurement column
  const handleAddChartColumn = () => {
    const colName = newColumnName.trim();
    if (!colName) return;
    if (sizeChart.headers.includes(colName)) {
      showToast('এই কলামটি ইতিমধ্যে চার্টে রয়েছে।');
      return;
    }
    setSizeChart((prev) => ({
      headers: [...prev.headers, colName],
      rows: prev.rows.map((row) => ({ ...row, [colName]: '' })),
    }));
    setNewColumnName('');
    setShowAddColumn(false);
    showToast(`'${colName}' কলাম যুক্ত হয়েছে!`);
  };

  // Remove measurement column
  const handleRemoveChartColumn = (colName: string) => {
    if (colName === 'Size') {
      showToast('Size কলাম মোছা যাবে না।');
      return;
    }
    setSizeChart((prev) => ({
      headers: prev.headers.filter((h) => h !== colName),
      rows: prev.rows.map((row) => {
        const copy = { ...row };
        delete copy[colName];
        return copy;
      }),
    }));
    showToast(`'${colName}' কলাম মুছে ফেলা হয়েছে।`);
  };

  // Reset chart to current category template default
  const handleResetChartToTemplate = () => {
    const tmpl = SIZE_TEMPLATES.find((t) => t.id === selectedSizeTemplate);
    if (tmpl?.defaultChart) {
      setSizeChart(JSON.parse(JSON.stringify(tmpl.defaultChart)));
      showToast('সাইজ চার্ট টেমপ্লেটের ডিফল্ট মাপে রিসেট হয়েছে!');
    }
  };

  // Color selection toggler
  const toggleColor = (col: ColorOption) => {
    if (selectedColors.some((c) => c.name === col.name)) {
      if (selectedColors.length <= 1) {
        showToast('অন্তত একটি রং নির্বাচন করা থাকতে হবে।');
        return;
      }
      setSelectedColors(selectedColors.filter((c) => c.name !== col.name));
    } else {
      setSelectedColors([...selectedColors, col]);
      // Initialize gallery for this color if not present
      if (!colorGalleries[col.name]) {
        setColorGalleries((prev) => ({
          ...prev,
          [col.name]: prev[col.name] || [],
        }));
      }
    }
  };

  // Add custom color
  const handleAddCustomColor = () => {
    if (!customColorName.trim()) return;
    const newCol: ColorOption = {
      id: customColorName.toLowerCase().replace(/\s+/g, '-'),
      name: customColorName.trim(),
      banglaName: customColorBangla.trim() || customColorName.trim(),
      hex: customColorHex,
    };
    setSelectedColors([...selectedColors, newCol]);
    setColorGalleries((prev) => ({
      ...prev,
      [newCol.name]: [],
    }));
    setActiveGalleryColor(newCol.name);
    setCustomColorName('');
    setCustomColorBangla('');
    setShowAddCustomColor(false);
  };

  // Bulk images add for active color
  const handleAddBulkUrls = () => {
    if (!bulkUrlInput.trim()) return;
    const urls = bulkUrlInput
      .split(/[\n,]+/)
      .map((u) => u.trim())
      .filter((u) => u.startsWith('http') || u.startsWith('/'));
    if (urls.length === 0) {
      showToast('সঠিক ইমেজ URL দিন (https://...)');
      return;
    }
    setColorGalleries((prev) => ({
      ...prev,
      [activeGalleryColor]: [...(prev[activeGalleryColor] || []), ...urls],
    }));
    setBulkUrlInput('');
  };

  const [isUploading, setIsUploading] = useState(false);

  // Authoritative server-side image upload handler (/api/admin/upload -> /public/uploads/)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    const token = localStorage.getItem('bastra_admin_token');
    const csrf = localStorage.getItem('bastra_csrf_token');

    try {
      const fileList = Array.from(files) as File[];
      for (const file of fileList) {
        // Read file as Base64 data URL
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // Upload to server-side endpoint saving to /public/uploads/
        const res = await adminFetch('/api/admin/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: base64Data,
            filename: file.name,
          }),
        });

        const data = await res.json();
        if (data.success && data.url) {
          const uploadedUrl = data.url;
          setColorGalleries((prev) => ({
            ...prev,
            [activeGalleryColor]: [...(prev[activeGalleryColor] || []), uploadedUrl],
          }));
          if (!customMainImage) {
            setCustomMainImage(uploadedUrl);
          }
        } else {
          // If server upload failed, fallback to local dataUrl so user work isn't lost
          setColorGalleries((prev) => ({
            ...prev,
            [activeGalleryColor]: [...(prev[activeGalleryColor] || []), base64Data],
          }));
          if (data.error) showToast(data.error);
        }
      }
      showToast('ছবি সফলভাবে সার্ভারে আপলোড ও গ্যালারিতে যুক্ত হয়েছে।');
    } catch (err) {
      console.error('File upload error:', err);
      showToast('ছবি আপলোডে সমস্যা হয়েছে।');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  // Remove image from active color gallery (with instant delete cross)
  const handleRemoveImage = (colorName: string, index: number) => {
    const targetUrl = colorGalleries[colorName]?.[index];
    setColorGalleries((prev) => ({
      ...prev,
      [colorName]: (prev[colorName] || []).filter((_, i) => i !== index),
    }));
    if (targetUrl && customMainImage === targetUrl) {
      setCustomMainImage('');
    }
    showToast('ছবিটি মুছে ফেলা হয়েছে।');
  };

  // Move image left/right (ordering)
  const handleMoveImage = (colorName: string, index: number, direction: 'left' | 'right') => {
    const list = [...(colorGalleries[colorName] || [])];
    const targetIdx = direction === 'left' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;
    setColorGalleries((prev) => ({ ...prev, [colorName]: list }));
  };

  // Set as global primary/main image for the entire product
  const handleSetGlobalMainImage = (colorName: string, index: number) => {
    const list = [...(colorGalleries[colorName] || [])];
    if (!list[index]) return;
    const picked = list[index];
    // Reorder so it is at index 0 of this color
    if (index > 0) {
      list.splice(index, 1);
      list.unshift(picked);
      setColorGalleries((prev) => ({ ...prev, [colorName]: list }));
    }
    setCustomMainImage(picked);
    showToast('এই ছবিটি পণ্যের প্রধান কভার ছবি (Main Photo) হিসেবে সেট হয়েছে!');
  };

  // Apply base price/stock to all variants
  const handleApplyBaseToAll = () => {
    setVariantsMatrix((prev) =>
      prev.map((v) => ({
        ...v,
        price: basePrice,
        offerPrice: baseOfferPrice,
        stock: baseStock,
      }))
    );
  };

  // Total stock across enabled variants
  const totalCalculatedStock = useMemo(() => {
    return variantsMatrix.filter((v) => v.enabled).reduce((sum, v) => sum + (v.stock || 0), 0);
  }, [variantsMatrix]);

  // Overall primary main image
  const resolvedMainImage = useMemo(() => {
    if (customMainImage) return customMainImage;
    const firstColor = selectedColors[0]?.name;
    const colorImages = firstColor ? colorGalleries[firstColor] : [];
    if (colorImages && colorImages.length > 0) return colorImages[0];
    for (const col of Object.keys(colorGalleries)) {
      if (colorGalleries[col] && colorGalleries[col].length > 0) return colorGalleries[col][0];
    }
    return (
      initialProduct?.mainImage ||
      '/bastra-shoily-logo.svg'
    );
  }, [customMainImage, selectedColors, colorGalleries, initialProduct]);

  // Category parent mapping info
  const categoryInfo = CATEGORY_MAPPINGS[category] || {
    parent: 'MEN',
    bangla: category,
    defaultTemplate: 'free_size',
    skuPrefix: 'BS',
  };

  // Final Publish or Save as Draft
  const handleFinalSubmit = (status: 'active' | 'draft') => {
    if (!productName.trim()) {
      showToast('দয়া করে পণ্যের নাম লিখুন (Step 1)।');
      setCurrentStep(1);
      return;
    }
    if (variantsMatrix.filter((v) => v.enabled).length === 0) {
      showToast('অন্তত একটি সক্রিয় ভ্যারিয়েন্ট থাকতে হবে (Step 4)।');
      setCurrentStep(4);
      return;
    }

    // Build ProductVariant list
    const finalVariants: ProductVariant[] = variantsMatrix
      .filter((v) => v.enabled)
      .map((v) => {
        const colorImgs = colorGalleries[v.color] || [];
        const matchedColor = selectedColors.find((c) => c.name === v.color);
        return {
          id: v.id,
          sku: v.sku,
          color: v.color,
          colorId: matchedColor?.id || `col-${v.color.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
          colorCode: v.colorCode || matchedColor?.hex,
          size: v.size,
          sizeId: v.size ? `sz-${v.size.toLowerCase().replace(/[^a-z0-9]+/g, '-')}` : undefined,
          price: v.offerPrice || v.price,
          stock: v.stock,
          image: colorImgs[0] || resolvedMainImage,
          galleryImages: colorImgs,
          status: 'active' as const,
        };
      });

    // Collect all unique gallery images
    const allGalleryImages = Array.from(
      new Set(Object.values(colorGalleries).flatMap((imgs) => imgs))
    );

    const latinSlug = productName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
    const cleanUnicodeSlug = productName
      .toLowerCase()
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/(^-|-$)+/g, '');
    const fallbackSlug = `product-${Date.now()}`;
    const slug = initialProduct?.slug?.trim() || latinSlug || cleanUnicodeSlug || fallbackSlug;

    const newProductPayload: Product = {
      id: initialProduct?.id || `prod-${Date.now()}`,
      name: productName.trim(),
      banglaName: banglaName.trim() || productName.trim(),
      slug,
      sku: `${skuPrefix}-${Math.floor(1000 + Math.random() * 9000)}`,
      category: categoryInfo.parent,
      subCategory: category,
      brand: brand.trim() || 'BASTRA SHOILY',
      price: basePrice,
      discountPrice: baseOfferPrice < basePrice ? baseOfferPrice : undefined,
      stock: totalCalculatedStock,
      lowStockThreshold: 5,
      description,
      shortDescription,
      mainImage: resolvedMainImage,
      galleryImages: allGalleryImages.length > 0 ? allGalleryImages : [resolvedMainImage],
      colorGalleries: Object.keys(colorGalleries).length > 0 ? colorGalleries : undefined,
      variants: finalVariants,
      status,
      isFeatured,
      isNewArrival,
      isBestSeller,
      isOffer: baseOfferPrice < basePrice,
      seoKeywords: tags.join(', '),
      createdAt: initialProduct?.createdAt || new Date().toISOString().split('T')[0],
      salesCount: initialProduct?.salesCount || 0,
      sizeChart: sizeChart && sizeChart.headers && sizeChart.headers.length > 0 ? sizeChart : undefined,
    };

    onSave(newProductPayload);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-stone-200 w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95">
        
        {/* Header Bar */}
        <div className="bg-stone-900 text-white px-5 py-3.5 sm:px-6 sm:py-4 flex items-center justify-between border-b border-stone-800 shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-bold uppercase tracking-wider">
                5-Step Wizard
              </span>
              <h2 className="text-sm sm:text-base font-bold">
                {initialProduct?.id ? 'প্রোডাক্ট এডিট করুন (Edit Product)' : 'নতুন প্রোডাক্ট আপলোড (Add New Product)'}
              </h2>
            </div>
            <p className="text-[11px] text-stone-400 mt-0.5 font-sans">
              সহজ ধাপে পণ্য বিবরণ, কালার গ্যালারি, সাইজ ও লাইভ প্রিভিউ সহ প্রকাশ করুন
            </p>
          </div>

          <button
            onClick={onCancel}
            className="p-2 text-stone-400 hover:text-white rounded-xl hover:bg-stone-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 5-Step Progress Stepper */}
        <div className="bg-stone-50 border-b border-stone-200 px-4 sm:px-8 py-3 shrink-0">
          <div className="flex items-center justify-between max-w-3xl mx-auto">
            {[
              { num: 1, title: 'Basic Info', bangla: '১. মৌলিক তথ্য', icon: Tag },
              { num: 2, title: 'Color & Photos', bangla: '২. কালার ও ছবি', icon: Palette },
              { num: 3, title: 'Size', bangla: '৩. সাইজ', icon: Ruler },
              { num: 4, title: 'Price & Stock', bangla: '৪. মূল্য ও স্টক', icon: DollarSign },
              { num: 5, title: 'Preview & Publish', bangla: '৫. প্রিভিউ ও প্রকাশ', icon: Eye },
            ].map((step, idx) => {
              const Icon = step.icon;
              const isActive = currentStep === step.num;
              const isPassed = currentStep > step.num;

              return (
                <div key={step.num} className="flex items-center flex-1 last:flex-initial">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(step.num)}
                    className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2.5 text-center sm:text-left group cursor-pointer focus:outline-none"
                  >
                    <div
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-xs ${
                        isActive
                          ? 'bg-amber-600 text-white ring-4 ring-amber-100 scale-105'
                          : isPassed
                          ? 'bg-emerald-600 text-white'
                          : 'bg-stone-200 text-stone-600 group-hover:bg-stone-300'
                      }`}
                    >
                      {isPassed ? <Check className="w-4 h-4" /> : step.num}
                    </div>
                    <div className="hidden sm:block">
                      <span className={`text-xs font-bold block ${isActive ? 'text-amber-900' : 'text-stone-700'}`}>
                        {step.bangla}
                      </span>
                      <span className="text-[10px] text-stone-400 block font-sans">{step.title}</span>
                    </div>
                  </button>

                  {idx < 4 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 hidden sm:block ${
                        currentStep > idx + 1 ? 'bg-emerald-500' : 'bg-stone-200'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Wizard Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-stone-50/50">
          
          {/* ================= STEP 1: BASIC INFORMATION ================= */}
          {currentStep === 1 && (
            <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-right-2">
              <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-5">
                <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2 border-b border-stone-100 pb-3">
                  <Tag className="w-4 h-4 text-amber-600" />
                  <span>পণ্যের সাধারণ তথ্য (Product Basic Information)</span>
                </h3>

                {/* Product Name (English & Bangla) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Product Name (English) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Premium Cotton Lungi"
                      value={productName}
                      onChange={(e) => setProductName(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:border-amber-600 bg-white text-stone-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      পণ্যের নাম (বাংলায়)
                    </label>
                    <input
                      type="text"
                      placeholder="যেমন: প্রিমিয়াম কটন লুঙ্গি"
                      value={banglaName}
                      onChange={(e) => setBanglaName(e.target.value)}
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:border-amber-600 bg-white text-stone-900"
                    />
                  </div>
                </div>

                {/* Category Selection with Automatic Mapping */}
                <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200/80 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="text-xs font-bold text-stone-900">
                      Category (ক্যাটাগরি নির্বাচন করুন) *
                    </label>
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      ওয়েবসাইটে যাবে: <strong>{categoryInfo.parent} → {category}</strong>
                    </span>
                  </div>

                  <select
                    value={category}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-stone-900 focus:outline-none focus:border-amber-600 font-bold"
                  >
                    {Object.keys(CATEGORY_MAPPINGS).map((catName) => (
                      <option key={catName} value={catName}>
                        {catName} ({CATEGORY_MAPPINGS[catName].bangla}) — {CATEGORY_MAPPINGS[catName].parent}
                      </option>
                    ))}
                  </select>

                  <p className="text-[11px] text-stone-600">
                    💡 আপনাকে আলাদা করে Men বা Women সিলেক্ট করতে হবে না। <strong>{category}</strong> সিলেক্ট করায় স্বয়ংক্রিয়ভাবে <strong>{categoryInfo.parent}</strong> মেনুর অন্তর্ভুক্ত হবে।
                  </p>
                </div>

                {/* Brand */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      Brand (ব্র্যান্ড)
                    </label>
                    <input
                      type="text"
                      value={brand}
                      onChange={(e) => setBrand(e.target.value)}
                      placeholder="BASTRA SHOILY"
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:border-amber-600 bg-white text-stone-900"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      SKU Prefix
                    </label>
                    <input
                      type="text"
                      value={skuPrefix}
                      onChange={(e) => setSkuPrefix(e.target.value.toUpperCase())}
                      placeholder="LNG"
                      className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:border-amber-600 bg-white text-stone-900 font-mono font-bold"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Description (পণ্যের বিস্তারিত বিবরণ)
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="পণ্যের বিস্তারিত বিবরণ লিখুন..."
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-stone-300 focus:outline-none focus:border-amber-600 bg-white text-stone-900"
                  />
                </div>

                {/* Tags & Collections */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    Tags (ট্যাগ ও কিওয়ার্ড)
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (tagInput.trim() && !tags.includes(tagInput.trim())) {
                            setTags([...tags, tagInput.trim()]);
                            setTagInput('');
                          }
                        }
                      }}
                      placeholder="ট্যাগ লিখে Enter চাপুন (যেমন: Cotton, Lungi, Handloom)"
                      className="flex-1 text-xs px-3.5 py-2 rounded-xl border border-stone-300 focus:outline-none focus:border-amber-600 bg-white text-stone-900"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (tagInput.trim() && !tags.includes(tagInput.trim())) {
                          setTags([...tags, tagInput.trim()]);
                          setTagInput('');
                        }
                      }}
                      className="px-3.5 py-2 bg-stone-900 text-white rounded-xl text-xs font-bold hover:bg-black transition cursor-pointer"
                    >
                      যুক্ত করুন
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((t, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-100 text-stone-700 text-xs font-medium"
                      >
                        <span>{t}</span>
                        <button
                          type="button"
                          onClick={() => setTags(tags.filter((_, idx) => idx !== i))}
                          className="text-stone-400 hover:text-rose-600"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Special Collections Badges */}
                <div className="pt-2 border-t border-stone-100">
                  <label className="block text-xs font-bold text-stone-700 mb-2">
                    বিশেষ কালেকশন নির্বাচন (Special Badges)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <label className="flex items-center gap-2 p-2.5 rounded-xl border border-stone-200 hover:bg-stone-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isNewArrival}
                        onChange={(e) => setIsNewArrival(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-xs font-medium text-stone-800">New Arrival</span>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 rounded-xl border border-stone-200 hover:bg-stone-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isFeatured}
                        onChange={(e) => setIsFeatured(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-xs font-medium text-stone-800">Featured</span>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 rounded-xl border border-stone-200 hover:bg-stone-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isBestSeller}
                        onChange={(e) => setIsBestSeller(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-xs font-medium text-stone-800">Best Seller</span>
                    </label>

                    <label className="flex items-center gap-2 p-2.5 rounded-xl border border-stone-200 hover:bg-stone-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isOffer}
                        onChange={(e) => setIsOffer(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span className="text-xs font-medium text-stone-800">Special Offer</span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 2: COLORS + GALLERY MAPPING ================= */}
          {currentStep === 2 && (
            <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-right-2">
              {/* Color Selection Palette */}
              <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                      <Palette className="w-4 h-4 text-amber-600" />
                      <span>রং নির্বাচন করুন (Select Product Colors)</span>
                    </h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                      যে যে রঙের পণ্য রয়েছে সেগুলো টিক দিন। প্রতিটি রঙের জন্য নিচে আলাদা ফটো গ্যালারি তৈরি হবে।
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAddCustomColor(!showAddCustomColor)}
                    className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>নতুন রং</span>
                  </button>
                </div>

                {/* Custom color form */}
                {showAddCustomColor && (
                  <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 flex flex-wrap items-center gap-3">
                    <input
                      type="text"
                      placeholder="Color Name (e.g. Lavender)"
                      value={customColorName}
                      onChange={(e) => setCustomColorName(e.target.value)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-stone-300 bg-white"
                    />
                    <input
                      type="text"
                      placeholder="রং এর বাংলা নাম (যেমন: ল্যাভেন্ডার)"
                      value={customColorBangla}
                      onChange={(e) => setCustomColorBangla(e.target.value)}
                      className="text-xs px-3 py-1.5 rounded-lg border border-stone-300 bg-white"
                    />
                    <input
                      type="color"
                      value={customColorHex}
                      onChange={(e) => setCustomColorHex(e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer border border-stone-300 p-0.5"
                    />
                    <button
                      type="button"
                      onClick={handleAddCustomColor}
                      className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition"
                    >
                      যুক্ত করুন
                    </button>
                  </div>
                )}

                {/* Preset Colors Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {PRESET_COLORS.map((col) => {
                    const isChecked = selectedColors.some((c) => c.name === col.name);
                    return (
                      <button
                        key={col.id}
                        type="button"
                        onClick={() => toggleColor(col)}
                        className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2.5 transition text-left cursor-pointer ${
                          isChecked
                            ? 'border-amber-800 bg-amber-50/80 text-amber-950 font-bold ring-2 ring-amber-700/20'
                            : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
                        }`}
                      >
                        <span
                          className="w-4 h-4 rounded-full border border-stone-300 shrink-0 shadow-xs"
                          style={{ backgroundColor: col.hex }}
                        />
                        <span className="truncate">{col.name} ({col.banglaName})</span>
                        {isChecked && <Check className="w-3.5 h-3.5 text-amber-800 ml-auto shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Color Gallery Auto Mapping Section */}
              <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
                <div className="border-b border-stone-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">
                      Color Gallery Auto Mapping
                    </span>
                    <h3 className="text-sm font-bold text-stone-900">
                      প্রতিটি রঙের জন্য আলাদা ফটো গ্যালারি
                    </h3>
                  </div>
                  <p className="text-xs text-stone-500 mt-1">
                    কাস্টমার যে রঙের অপশনে ক্লিক করবে স্বয়ংক্রিয়ভাবে শুধু সেই রঙের ছবিগুলোই দেখাবে।
                  </p>
                </div>

                {/* Global Main Cover Image Selection Banner */}
                <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-16 rounded-xl border-2 border-amber-600 overflow-hidden shadow-xs shrink-0 relative bg-white">
                      <img
                        src={resolvedMainImage}
                        alt="Main Cover"
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-0 inset-x-0 bg-amber-600 text-white text-[8px] font-black text-center py-0.5">
                        MAIN COVER
                      </span>
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Star className="w-4 h-4 text-amber-600 fill-amber-500" />
                        <h4 className="text-xs font-bold text-stone-900">
                          পণ্যের প্রধান কভার ছবি (Primary Main Photo)
                        </h4>
                      </div>
                      <p className="text-[11px] text-stone-600 mt-0.5 max-w-lg">
                        হোমপেজ ও ক্যাটালগে এই ছবিটি প্রথমে দেখাবে। আপলোড করা যেকোনো ছবির উপরের <strong>'★ প্রধান ছবি'</strong> বাটনে ক্লিক করলেই সেটি প্রধান কভার হিসেবে সেট হবে। ভুল হলে লাল <strong>'✕'</strong> বাটনে চাপ দিয়ে ছবি মুছে ফেলা যাবে।
                      </p>
                    </div>
                  </div>
                  {customMainImage && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomMainImage('');
                        showToast('স্বয়ংক্রিয় প্রথম ছবিতে রিসেট করা হয়েছে।');
                      }}
                      className="text-[11px] text-amber-900 hover:text-amber-950 font-semibold underline shrink-0 cursor-pointer"
                    >
                      অটো সিলেকশনে ফিরুন
                    </button>
                  )}
                </div>

                {/* Color Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {selectedColors.map((col) => {
                    const imgCount = colorGalleries[col.name]?.length || 0;
                    const isTabActive = activeGalleryColor === col.name;
                    return (
                      <button
                        key={col.name}
                        type="button"
                        onClick={() => setActiveGalleryColor(col.name)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition shrink-0 cursor-pointer ${
                          isTabActive
                            ? 'bg-stone-900 text-white shadow-sm'
                            : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                        }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full border border-white/50"
                          style={{ backgroundColor: col.hex }}
                        />
                        <span>{col.name}</span>
                        <span
                          className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                            isTabActive ? 'bg-stone-800 text-amber-300' : 'bg-stone-200 text-stone-600'
                          }`}
                        >
                          {imgCount}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Active Color's Gallery Uploader & Manager */}
                <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-stone-800">
                      🎨 <strong>{activeGalleryColor}</strong> রঙের ছবিসমূহ ({colorGalleries[activeGalleryColor]?.length || 0} টি)
                    </span>

                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>{isUploading ? 'সার্ভারে আপলোড হচ্ছে...' : 'ছবি সরাসরি /uploads-এ সেভ হবে'}</span>
                    </div>
                  </div>

                  {/* Upload Controls (Bulk Files + Bulk URL) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Local File Upload */}
                    <label className="p-4 bg-white rounded-xl border-2 border-dashed border-stone-300 hover:border-amber-600 transition flex flex-col items-center justify-center gap-1 cursor-pointer text-center">
                      <Upload className="w-5 h-5 text-stone-400" />
                      <span className="text-xs font-bold text-stone-700">কম্পিউটার/মোবাইল থেকে ছবি আপলোড</span>
                      <span className="text-[10px] text-stone-400">একসাথে একাধিক ছবি সিলেক্ট করা যাবে</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>

                    {/* Bulk URLs Input */}
                    <div className="p-3 bg-white rounded-xl border border-stone-200 flex flex-col justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-stone-700 block">ইমেজ লিংক (Bulk URLs)</span>
                        <span className="text-[10px] text-stone-400 block mb-1">কমা বা নতুন লাইনে লিংক পেস্ট করুন</span>
                      </div>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={bulkUrlInput}
                          onChange={(e) => setBulkUrlInput(e.target.value)}
                          placeholder="https://...jpg, https://...png"
                          className="flex-1 text-[11px] px-2.5 py-1.5 rounded-lg border border-stone-300 focus:outline-none focus:border-amber-600"
                        />
                        <button
                          type="button"
                          onClick={handleAddBulkUrls}
                          className="px-3 py-1.5 bg-stone-900 text-white rounded-lg text-xs font-bold hover:bg-black transition cursor-pointer"
                        >
                          যোগ
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Gallery Thumbnails List with Prominent Cross Delete and Set Main Photo */}
                  {colorGalleries[activeGalleryColor] && colorGalleries[activeGalleryColor].length > 0 ? (
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-stone-500 mb-2">
                        <span>ছবি ভুল মনে হলে লাল <strong>'✕'</strong> বাটনে চাপ দিন। যেকোনো ছবিকে প্রধান করতে <strong>'প্রধান ছবি'</strong> চাপুন।</span>
                        <span className="font-mono">মোট {colorGalleries[activeGalleryColor].length} টি</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 pt-1">
                        {colorGalleries[activeGalleryColor].map((imgUrl, idx) => {
                          const isGlobalMain = resolvedMainImage === imgUrl;
                          return (
                            <div
                              key={idx}
                              className={`group relative bg-white rounded-xl border overflow-hidden shadow-xs hover:shadow-md transition aspect-3/4 flex flex-col ${
                                isGlobalMain
                                  ? 'border-amber-500 ring-2 ring-amber-500/40'
                                  : 'border-stone-200'
                              }`}
                            >
                              <img
                                src={imgUrl}
                                alt={`${activeGalleryColor} ${idx}`}
                                className="w-full h-full object-cover"
                              />

                              {/* PROMINENT DELETE CROSS BUTTON (User requested: "vul Mone hole cros kora jay") */}
                              <button
                                type="button"
                                onClick={() => handleRemoveImage(activeGalleryColor, idx)}
                                title="ছবিটি ডিলিট করুন (Cross Delete)"
                                className="absolute top-2 right-2 z-20 w-7 h-7 rounded-full bg-rose-600 hover:bg-rose-700 active:scale-90 text-white flex items-center justify-center shadow-lg transition-transform cursor-pointer border border-white"
                              >
                                <X className="w-4 h-4 stroke-[2.5]" />
                              </button>

                              {/* PROMINENT MAIN IMAGE BADGE / BUTTON (User requested: "upload kora product theke jekono Ekta main chobi hisebe rakhte parbe") */}
                              {isGlobalMain ? (
                                <div className="absolute top-2 left-2 z-20 bg-amber-500 text-stone-950 text-[10px] font-black px-2 py-0.5 rounded-md shadow-md flex items-center gap-1 border border-amber-300">
                                  <Star className="w-3 h-3 fill-stone-950" />
                                  <span>মূল কভার</span>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleSetGlobalMainImage(activeGalleryColor, idx)}
                                  title="এই ছবিটিকে পণ্যের প্রধান কভার ছবি করুন"
                                  className="absolute top-2 left-2 z-20 bg-stone-900/85 hover:bg-amber-600 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow-md transition flex items-center gap-1 cursor-pointer"
                                >
                                  <Star className="w-3 h-3" />
                                  <span>প্রধান ছবি</span>
                                </button>
                              )}

                              {/* Bottom Order / Move Controls Overlay */}
                              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-stone-950/80 via-stone-950/40 to-transparent p-2 text-white flex justify-between items-center z-10 opacity-90 group-hover:opacity-100 transition">
                                <button
                                  type="button"
                                  disabled={idx === 0}
                                  onClick={() => handleMoveImage(activeGalleryColor, idx, 'left')}
                                  className="p-1 rounded bg-black/40 hover:bg-black/80 disabled:opacity-30 cursor-pointer"
                                  title="বামে সরান"
                                >
                                  <ArrowLeft className="w-3.5 h-3.5" />
                                </button>
                                <span className="text-[10px] font-mono text-stone-200">
                                  #{idx + 1}
                                </span>
                                <button
                                  type="button"
                                  disabled={idx === (colorGalleries[activeGalleryColor]?.length || 0) - 1}
                                  onClick={() => handleMoveImage(activeGalleryColor, idx, 'right')}
                                  className="p-1 rounded bg-black/40 hover:bg-black/80 disabled:opacity-30 cursor-pointer"
                                  title="ডানে সরান"
                                >
                                  <ArrowRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-stone-400 bg-white rounded-xl border border-dashed border-stone-200">
                      <ImageIcon className="w-6 h-6 mx-auto mb-1 text-stone-300" />
                      <p className="text-xs">{activeGalleryColor} রঙের কোনো ছবি এখনও যোগ করা হয়নি।</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 3: SIZE TEMPLATES & DYNAMIC SIZE CHART ================= */}
          {currentStep === 3 && (
            <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-right-2">
              {/* Category Info Banner */}
              <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-amber-600 text-white text-[10px] font-bold">
                      অটোমেটিক ক্যাটাগরি ম্যাপিং
                    </span>
                    <h4 className="text-xs font-bold text-stone-900">
                      নির্বাচিত ক্যাটাগরি: <strong>{category}</strong> ({categoryInfo.bangla})
                    </h4>
                  </div>
                  <p className="text-[11px] text-stone-600 mt-1">
                    লুঙ্গি বা শাড়ি সিলেক্ট করলে হাত/ঘের/ব্লাউজ চার্ট, এবং পাঞ্জাবি, টি-শার্ট, থ্রি-পিস সিলেক্ট করলে সেই অনুযায়ী বুক, দৈর্ঘ্য ও হাতার পরিমাপ চার্ট আসবে। অ্যাডমিন যেকোনো সাইজের মাপ কম/বেশি করতে পারেন।
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleResetChartToTemplate}
                  className="px-3 py-1.5 rounded-xl border border-amber-300 bg-white text-amber-900 hover:bg-amber-100 text-xs font-bold transition flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>ডিফল্ট চার্ট লোড করুন</span>
                </button>
              </div>

              {/* Template Selector Radio Cards */}
              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                      <Ruler className="w-4 h-4 text-amber-600" />
                      <span>সাইজ টেমপ্লেট নির্বাচন করুন (Size Template)</span>
                    </h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                      অন্য ক্যাটাগরির সাইজ টেমপ্লেট প্রয়োজন হলে এখান থেকে বদলাতে পারেন:
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {SIZE_TEMPLATES.map((tmpl) => {
                    const isSelected = selectedSizeTemplate === tmpl.id;
                    return (
                      <label
                        key={tmpl.id}
                        className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                          isSelected
                            ? 'border-amber-800 bg-amber-50/70 text-amber-950 font-bold ring-2 ring-amber-600/20'
                            : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <input
                            type="radio"
                            name="size_template"
                            checked={isSelected}
                            onChange={() => handleSizeTemplateChange(tmpl.id)}
                            className="text-amber-600 focus:ring-amber-500"
                          />
                          <div>
                            <span className="text-xs font-bold block">{tmpl.name}</span>
                            <span className="text-[11px] text-stone-500 block line-clamp-1">{tmpl.banglaName}</span>
                          </div>
                        </div>

                        {tmpl.defaultSizes.length > 0 && (
                          <div className="hidden lg:flex gap-1 shrink-0">
                            {tmpl.defaultSizes.slice(0, 3).map((s, i) => (
                              <span
                                key={i}
                                className="px-1.5 py-0.5 rounded bg-stone-100 text-stone-700 text-[9px] font-mono"
                              >
                                {s}
                              </span>
                            ))}
                            {tmpl.defaultSizes.length > 3 && (
                              <span className="text-[9px] text-stone-400 self-center">+{tmpl.defaultSizes.length - 3}</span>
                            )}
                          </div>
                        )}
                      </label>
                    );
                  })}
                </div>

                {/* Active Sizes Pill Checkboxes */}
                <div className="pt-4 border-t border-stone-100">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-bold text-stone-900">
                      উপলব্ধ সক্রিয় সাইজসমূহ (Active Sizes)
                    </label>
                    <span className="text-[11px] text-stone-500 font-mono">
                      {activeSizes.length} টি সাইজ সক্রিয়
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {Array.from(
                      new Set([
                        ...(SIZE_TEMPLATES.find((t) => t.id === selectedSizeTemplate)?.defaultSizes || []),
                        ...activeSizes,
                      ])
                    ).map((sz) => {
                      const isChecked = activeSizes.includes(sz);
                      return (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => {
                            if (isChecked) {
                              if (activeSizes.length <= 1) {
                                showToast('অন্তত একটি সাইজ নির্বাচিত থাকতে হবে।');
                                return;
                              }
                              setActiveSizes(activeSizes.filter((s) => s !== sz));
                            } else {
                              setActiveSizes([...activeSizes, sz]);
                            }
                          }}
                          className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                            isChecked
                              ? 'bg-stone-900 text-white shadow-xs'
                              : 'bg-stone-100 text-stone-600 hover:bg-stone-200 border border-stone-200'
                          }`}
                        >
                          <span>{sz}</span>
                          {isChecked && <Check className="w-3.5 h-3.5 text-amber-400" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Add Custom Size Input */}
                  <div className="mt-3 flex gap-2 max-w-md">
                    <input
                      type="text"
                      placeholder="নতুন সাইজ লিখুন (যেমন: 48, ৩.৫ হাত)"
                      value={customSizeInput}
                      onChange={(e) => setCustomSizeInput(e.target.value)}
                      className="flex-1 text-xs px-3 py-1.5 rounded-xl border border-stone-300 focus:outline-none focus:border-amber-600"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (customSizeInput.trim() && !activeSizes.includes(customSizeInput.trim())) {
                          const newSz = customSizeInput.trim();
                          setActiveSizes([...activeSizes, newSz]);
                          // Also add a corresponding row in the size chart if not present
                          if (!sizeChart.rows.some((r) => r.Size === newSz)) {
                            const newRow: Record<string, string> = { Size: newSz };
                            sizeChart.headers.forEach((h) => {
                              if (h !== 'Size') newRow[h] = 'Standard';
                            });
                            setSizeChart((prev) => ({ ...prev, rows: [...prev.rows, newRow] }));
                          }
                          setCustomSizeInput('');
                          showToast(`'${newSz}' সাইজ যোগ হয়েছে!`);
                        }
                      }}
                      className="px-3.5 py-1.5 bg-stone-900 text-white rounded-xl text-xs font-bold hover:bg-black transition cursor-pointer"
                    >
                      + সাইজ যোগ
                    </button>
                  </div>
                </div>
              </div>

              {/* DYNAMIC EDITABLE SIZE CHART TABLE (User requested: "admin chayle size kom besi korte pare") */}
              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        Interactive Size Chart Editor
                      </span>
                      <h3 className="text-sm font-bold text-stone-900">
                        সাইজ চার্ট ও মাপের তালিকা (এডমিন এডিটর)
                      </h3>
                    </div>
                    <p className="text-xs text-stone-500 mt-1">
                      প্রতিটি সাইজের দৈর্ঘ্য, প্রস্থ, বুক বা হাতার মাপ সরাসরি লিখে কম/বেশি করতে পারেন। কাস্টমার পণ্য দেখার সময় এই মাপগুলো চার্টে দেখতে পাবে।
                    </p>
                  </div>

                  {/* Actions: Add Row & Add Column */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleAddChartRow}
                      className="px-3 py-1.5 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ মাপের রো</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddColumn(!showAddColumn)}
                      className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ নতুন কলাম</span>
                    </button>
                  </div>
                </div>

                {/* Add Custom Column Form */}
                {showAddColumn && (
                  <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="কলামের নাম (যেমন: Waist / কোমর, Hip, Thigh)"
                      value={newColumnName}
                      onChange={(e) => setNewColumnName(e.target.value)}
                      className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-stone-300 bg-white focus:outline-none focus:border-amber-600"
                    />
                    <button
                      type="button"
                      onClick={handleAddChartColumn}
                      className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
                    >
                      কলাম যোগ
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddColumn(false)}
                      className="px-2.5 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-lg text-xs font-bold transition cursor-pointer"
                    >
                      বাতিল
                    </button>
                  </div>
                )}

                {/* Editable Table */}
                <div className="overflow-x-auto rounded-xl border border-stone-200">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-stone-100 text-stone-800 border-b border-stone-200">
                        {sizeChart.headers.map((header) => (
                          <th key={header} className="p-2.5 font-bold whitespace-nowrap">
                            <div className="flex items-center justify-between gap-1.5">
                              <span>{header}</span>
                              {header !== 'Size' && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveChartColumn(header)}
                                  title="কলামটি মুছুন"
                                  className="text-stone-400 hover:text-rose-600 p-0.5 rounded cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </th>
                        ))}
                        <th className="p-2.5 font-bold text-center w-14">অ্যাকশন</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                      {sizeChart.rows.map((row, rowIdx) => (
                        <tr key={rowIdx} className="hover:bg-amber-50/40 transition">
                          {sizeChart.headers.map((header) => {
                            const val = row[header] || '';
                            const isSizeCol = header === 'Size';
                            return (
                              <td key={header} className="p-2 min-w-[120px]">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="text"
                                    value={val}
                                    onChange={(e) => handleChartCellChange(rowIdx, header, e.target.value)}
                                    className={`w-full text-xs px-2.5 py-1.5 rounded-lg border focus:outline-none transition ${
                                      isSizeCol
                                        ? 'bg-amber-50/50 border-amber-300 font-bold text-stone-900'
                                        : 'bg-white border-stone-300 text-stone-700 focus:border-amber-600'
                                    }`}
                                  />
                                </div>
                              </td>
                            );
                          })}
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveChartRow(rowIdx)}
                              title="রো মুছে ফেলুন"
                              className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition inline-flex items-center justify-center cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Real-Time Customer View Preview Card */}
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-stone-600 mb-1">
                    <Eye className="w-3.5 h-3.5 text-stone-500" />
                    <span>কাস্টমার ভিউ প্রিভিউ (Live Customer Preview):</span>
                  </div>
                  <p className="text-[11px] text-stone-500">
                    কাস্টমাররা প্রোডাক্ট পেইজে "সাইজ চার্ট ও মাপের নির্দেশিকা" বোতামে ক্লিক করলে ঠিক এই পরিমাপগুলো দেখতে পাবে।
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 4: PRICE + VARIANT MATRIX ================= */}
          {currentStep === 4 && (
            <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-right-2">
              {/* Batch Price & Stock Controls */}
              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-stone-900 flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-amber-600" />
                      <span>মূল্য ও স্টক ব্যাচ সেটআপ (Base Price & Bulk Apply)</span>
                    </h3>
                    <p className="text-xs text-stone-500 mt-0.5">
                      একক মূল্য দিলে সিস্টেম স্বয়ংক্রিয়ভাবে সকল ভ্যারিয়েন্টে তা কার্যকর করবে।
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleApplyBaseToAll}
                    className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                  >
                    সকল ভ্যারিয়েন্টে কার্যকর করুন
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      রেগুলার মূল্য (Regular Price ৳) *
                    </label>
                    <input
                      type="number"
                      value={basePrice}
                      onChange={(e) => setBasePrice(Number(e.target.value))}
                      className="w-full text-xs font-mono font-bold px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:border-amber-600"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      অফার মূল্য (Offer Price ৳)
                    </label>
                    <input
                      type="number"
                      value={baseOfferPrice}
                      onChange={(e) => setBaseOfferPrice(Number(e.target.value))}
                      className="w-full text-xs font-mono font-bold px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:border-amber-600 text-amber-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      ডিফল্ট স্টক (Default Stock pcs)
                    </label>
                    <input
                      type="number"
                      value={baseStock}
                      onChange={(e) => setBaseStock(Number(e.target.value))}
                      className="w-full text-xs font-mono font-bold px-3 py-2 rounded-xl border border-stone-300 focus:outline-none focus:border-amber-600"
                    />
                  </div>
                </div>
              </div>

              {/* Auto Generated Variant Table */}
              <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
                <div className="p-4 bg-stone-50 border-b border-stone-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-stone-800">
                    ভ্যারিয়েন্ট তালিকা ({variantsMatrix.length} টি কম্বিনেশন তৈরি হয়েছে)
                  </span>
                  <span className="text-xs text-stone-500 font-mono">
                    মোট স্টক: <strong>{totalCalculatedStock}</strong> টি
                  </span>
                </div>

                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-stone-100 text-stone-600 font-bold border-b border-stone-200 uppercase text-[11px] sticky top-0 z-10">
                      <tr>
                        <th className="p-3">রং ও সাইজ</th>
                        <th className="p-3">Auto SKU (এডিটেবল)</th>
                        <th className="p-3">মূল্য (৳)</th>
                        <th className="p-3">অফার মূল্য (৳)</th>
                        <th className="p-3">স্টক (pcs)</th>
                        <th className="p-3 text-center">সক্রিয়</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {variantsMatrix.map((v, idx) => (
                        <tr key={idx} className={v.enabled ? 'hover:bg-stone-50' : 'bg-stone-100/60 opacity-60'}>
                          <td className="p-3 font-medium">
                            <div className="flex items-center gap-2">
                              <span
                                className="w-3.5 h-3.5 rounded-full border border-stone-300 shrink-0 shadow-xs"
                                style={{ backgroundColor: v.colorCode }}
                              />
                              <span className="font-bold text-stone-900">{v.color}</span>
                              <span className="text-stone-400">/</span>
                              <span className="text-stone-700 font-mono">{v.size}</span>
                            </div>
                          </td>

                          <td className="p-3">
                            <input
                              type="text"
                              value={v.sku}
                              onChange={(e) => {
                                const val = e.target.value;
                                setVariantsMatrix((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, sku: val } : item))
                                );
                              }}
                              className="w-28 text-[11px] font-mono px-2 py-1 rounded border border-stone-300 bg-white"
                            />
                          </td>

                          <td className="p-3">
                            <input
                              type="number"
                              value={v.price}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setVariantsMatrix((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, price: val } : item))
                                );
                              }}
                              className="w-20 text-[11px] font-mono px-2 py-1 rounded border border-stone-300 bg-white"
                            />
                          </td>

                          <td className="p-3">
                            <input
                              type="number"
                              value={v.offerPrice}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setVariantsMatrix((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, offerPrice: val } : item))
                                );
                              }}
                              className="w-20 text-[11px] font-mono px-2 py-1 rounded border border-stone-300 bg-white text-amber-800 font-bold"
                            />
                          </td>

                          <td className="p-3">
                            <input
                              type="number"
                              value={v.stock}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setVariantsMatrix((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, stock: val } : item))
                                );
                              }}
                              className="w-16 text-[11px] font-mono font-bold px-2 py-1 rounded border border-stone-300 bg-white"
                            />
                          </td>

                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={v.enabled}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setVariantsMatrix((prev) =>
                                  prev.map((item, i) => (i === idx ? { ...item, enabled: checked } : item))
                                );
                              }}
                              className="rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 5: PREVIEW → PUBLISH ================= */}
          {currentStep === 5 && (
            <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in slide-in-from-right-2">
              <div className="bg-white rounded-3xl border border-stone-200 shadow-md p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <h3 className="text-sm font-bold text-stone-900">
                      লাইভ ওয়েবসাইট প্রিভিউ (Customer Storefront Preview)
                    </h3>
                  </div>
                  <span className="text-[11px] text-stone-500 bg-stone-100 px-2.5 py-1 rounded-full">
                    মেনু: <strong>{categoryInfo.parent} → {category}</strong>
                  </span>
                </div>

                {/* Simulated Storefront Card */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-6">
                  {/* Photo Display */}
                  <div className="sm:col-span-5 space-y-2">
                    <div className="aspect-3/4 rounded-2xl overflow-hidden bg-stone-100 border border-stone-200 relative">
                      <img
                        src={resolvedMainImage}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                      {baseOfferPrice < basePrice && (
                        <span className="absolute top-2 left-2 bg-rose-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs">
                          {Math.round(((basePrice - baseOfferPrice) / basePrice) * 100)}% ছাড়
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Info Display */}
                  <div className="sm:col-span-7 space-y-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-amber-800 block">
                        {brand}
                      </span>
                      <h4 className="text-base sm:text-lg font-bold text-stone-900 font-serif">
                        {banglaName || productName}
                      </h4>
                      <p className="text-xs text-stone-500 font-mono">{productName}</p>
                    </div>

                    {/* Price */}
                    <div className="flex items-baseline gap-2 pt-1">
                      <span className="text-xl font-black font-mono text-stone-900">
                        ৳{baseOfferPrice || basePrice}
                      </span>
                      {baseOfferPrice < basePrice && (
                        <span className="text-xs text-stone-400 font-mono line-through">
                          ৳{basePrice}
                        </span>
                      )}
                    </div>

                    {/* Colors Swatches */}
                    <div>
                      <span className="text-[11px] font-bold text-stone-600 block mb-1.5">
                        রং ({selectedColors.length} টি):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedColors.map((c) => (
                          <span
                            key={c.name}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-stone-200 text-[11px] bg-white text-stone-800"
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full border border-stone-300"
                              style={{ backgroundColor: c.hex }}
                            />
                            <span>{c.banglaName}</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Sizes Pills */}
                    <div>
                      <span className="text-[11px] font-bold text-stone-600 block mb-1.5">
                        সাইজ ({activeSizes.length} টি):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {activeSizes.map((s) => (
                          <span
                            key={s}
                            className="px-2.5 py-1 rounded-lg bg-stone-100 text-stone-800 text-[11px] font-medium"
                          >
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Stock Summary */}
                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-xs">
                      <span className="text-stone-500">মোট ইনভেন্টরি:</span>
                      <span className="font-bold text-emerald-700 font-mono">
                        {totalCalculatedStock} টি পণ্য স্টকে থাকবে
                      </span>
                    </div>
                  </div>
                </div>

                {/* Publish actions */}
                <div className="pt-4 border-t border-stone-200 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => handleFinalSubmit('draft')}
                    className="flex-1 py-3 px-4 rounded-xl border border-stone-300 hover:bg-stone-100 text-stone-700 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>Save as Draft (খসড়া সংরক্ষণ)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleFinalSubmit('active')}
                    className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-black uppercase tracking-wider transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>Publish to Website (প্রকাশ করুন)</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation Bar (Sticky Bottom) */}
        <div className="bg-white border-t border-stone-200 px-5 py-3 sm:px-8 sm:py-4 flex items-center justify-between shrink-0">
          <button
            type="button"
            disabled={currentStep === 1}
            onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
            className="px-4 py-2 rounded-xl text-xs font-bold border border-stone-300 text-stone-700 hover:bg-stone-50 disabled:opacity-40 disabled:pointer-events-none transition flex items-center gap-1.5 cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>পেছনে (Back)</span>
          </button>

          <span className="text-xs text-stone-400 font-medium">
            ধাপ {currentStep} / ৫
          </span>

          {currentStep < 5 ? (
            <button
              type="button"
              onClick={() => {
                if (currentStep === 1 && !productName.trim()) {
                  showToast('দয়া করে পণ্যের নাম লিখুন।');
                  return;
                }
                setCurrentStep((prev) => Math.min(5, prev + 1));
              }}
              className="px-5 py-2 bg-stone-900 hover:bg-black text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <span>সামনে যান (Next)</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleFinalSubmit('active')}
              className="px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <span>পাবলিশ করুন (Publish)</span>
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
