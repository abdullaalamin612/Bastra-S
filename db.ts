import fs from 'fs';
import path from 'path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'bastra_shoily.sqlite');
export const db = new DatabaseSync(DB_PATH);

// Enable foreign keys and WAL journal mode for high performance, concurrency and data integrity
db.exec('PRAGMA foreign_keys = ON;');
try {
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA busy_timeout = 5000;');
} catch (e) {
  console.warn('SQLite PRAGMA configuration warning:', e);
}

// Password Hashing & Verification via Node.js Scrypt (Memory-Hard & Cryptographically Secure)
// Backwards compatible with legacy PBKDF2 hashes
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt || crypto.randomBytes(16).toString('hex');
  const key = crypto.scryptSync(password.trim(), s, 64, { N: 16384, r: 8, p: 1 });
  return { hash: `scrypt:${key.toString('hex')}`, salt: s };
}

export function verifyPassword(password: string, storedHash?: string, salt?: string): boolean {
  if (!password || !storedHash || !salt) return false;
  const trimmed = password.trim();
  try {
    if (storedHash.startsWith('scrypt:')) {
      const expectedKeyHex = storedHash.slice(7);
      const computedKey = crypto.scryptSync(trimmed, salt, 64, { N: 16384, r: 8, p: 1 });
      const computedBuf = Buffer.from(computedKey.toString('hex'), 'hex');
      const storedBuf = Buffer.from(expectedKeyHex, 'hex');
      if (computedBuf.length !== storedBuf.length) return false;
      return crypto.timingSafeEqual(computedBuf, storedBuf);
    }

    // Backwards-compatible PBKDF2 verification for existing seeds
    const pbkdf2Computed = crypto.pbkdf2Sync(trimmed, salt, 10000, 64, 'sha512').toString('hex');
    const computedBuf = Buffer.from(pbkdf2Computed, 'hex');
    const storedBuf = Buffer.from(storedHash, 'hex');
    if (computedBuf.length === storedBuf.length && crypto.timingSafeEqual(computedBuf, storedBuf)) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// Initialize Database Schema
export function initDatabaseSchema() {
  db.exec(`
    -- Categories
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      bangla_name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      parent_category TEXT DEFAULT 'MEN',
      image TEXT,
      order_num INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Colors
    CREATE TABLE IF NOT EXISTS colors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      bangla_name TEXT NOT NULL,
      hex_code TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Sizes
    CREATE TABLE IF NOT EXISTS sizes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      bangla_name TEXT NOT NULL,
      code TEXT NOT NULL,
      category TEXT DEFAULT 'ALL',
      sort_order INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Products
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      bangla_name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      sku TEXT UNIQUE NOT NULL,
      description TEXT,
      short_description TEXT,
      category_id TEXT,
      sub_category TEXT,
      variant_config TEXT NOT NULL DEFAULT 'color_size', -- 'free_size' or 'color_size'
      brand TEXT DEFAULT 'BASTRA SHOILY',
      price REAL NOT NULL,
      discount_price REAL,
      low_stock_threshold INTEGER DEFAULT 5,
      is_featured INTEGER DEFAULT 0,
      is_new_arrival INTEGER DEFAULT 1,
      is_best_seller INTEGER DEFAULT 0,
      is_offer INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active', -- 'active', 'inactive', 'draft', 'archived'
      main_image TEXT,
      seo_title TEXT,
      seo_description TEXT,
      seo_keywords TEXT,
      sales_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories (id)
    );

    -- Product Variants (Authoritative Purchasable Unit)
    CREATE TABLE IF NOT EXISTS product_variants (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      color_id TEXT NOT NULL,
      size_id TEXT, -- NULL for Free Size / Color-only
      sku TEXT UNIQUE NOT NULL,
      price REAL NOT NULL,
      offer_price REAL,
      weight REAL DEFAULT 0.5,
      stock INTEGER NOT NULL DEFAULT 0,
      low_stock_threshold INTEGER DEFAULT 5,
      active INTEGER DEFAULT 1,
      image TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
      FOREIGN KEY (color_id) REFERENCES colors (id),
      FOREIGN KEY (size_id) REFERENCES sizes (id)
    );

    -- Unique index on product + color + size
    CREATE UNIQUE INDEX IF NOT EXISTS idx_variant_product_color_size 
    ON product_variants (product_id, color_id, COALESCE(size_id, '__FREE_SIZE__'));

    -- Color Galleries (Product + Color -> Multiple Gallery Images)
    CREATE TABLE IF NOT EXISTS color_galleries (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      color_id TEXT NOT NULL,
      image_url TEXT NOT NULL,
      is_main INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products (id) ON DELETE CASCADE,
      FOREIGN KEY (color_id) REFERENCES colors (id)
    );

    -- Variant Gallery Overrides (Optional exceptional gallery for a specific ProductVariant)
    CREATE TABLE IF NOT EXISTS variant_gallery_overrides (
      id TEXT PRIMARY KEY,
      variant_id TEXT NOT NULL,
      image_url TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (variant_id) REFERENCES product_variants (id) ON DELETE CASCADE
    );

    -- Customers
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      email TEXT,
      district TEXT,
      upazila TEXT,
      address TEXT,
      status TEXT DEFAULT 'active', -- 'active', 'blocked'
      total_orders INTEGER DEFAULT 0,
      total_spent REAL DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Orders
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT,
      delivery_address TEXT NOT NULL,
      district TEXT NOT NULL,
      upazila TEXT,
      postal_code TEXT,
      subtotal REAL NOT NULL,
      delivery_charge REAL NOT NULL DEFAULT 60,
      discount REAL NOT NULL DEFAULT 0,
      coupon_code TEXT,
      total REAL NOT NULL,
      payment_method TEXT NOT NULL DEFAULT 'cod',
      payment_status TEXT NOT NULL DEFAULT 'pending',
      payment_txn_id TEXT,
      order_status TEXT NOT NULL DEFAULT 'pending',
      order_source TEXT DEFAULT 'website', -- 'website', 'admin', 'wholesale'
      customer_notes TEXT,
      admin_notes TEXT,
      order_date TEXT DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Order Items (IMMUTABLE SNAPSHOT OF PURCHASABLE UNIT)
    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      variant_id TEXT,
      product_name TEXT NOT NULL,
      bangla_name TEXT,
      sku TEXT NOT NULL,
      color_name TEXT,
      size_name TEXT,
      original_price REAL NOT NULL,
      offer_price REAL,
      discount_amount REAL DEFAULT 0,
      unit_price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      subtotal REAL NOT NULL,
      final_item_price REAL NOT NULL,
      image TEXT,
      FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
    );

    -- Order Timeline / History
    CREATE TABLE IF NOT EXISTS order_timeline (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      note TEXT,
      actor TEXT DEFAULT 'System',
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
    );

    -- Returns & Refunds
    CREATE TABLE IF NOT EXISTS order_returns (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      reason TEXT NOT NULL,
      reason_code TEXT NOT NULL,
      details TEXT,
      status TEXT NOT NULL DEFAULT 'requested', -- 'requested', 'under_review', 'approved', 'item_received', 'inspected', 'refund_approved', 'refund_processing', 'refunded', 'rejected'
      total_refund_amount REAL NOT NULL DEFAULT 0,
      refund_status TEXT DEFAULT 'pending', -- 'pending', 'processed', 'rejected'
      refund_method TEXT,
      refund_txn_id TEXT,
      admin_notes TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (order_id) REFERENCES orders (id)
    );

    -- Inventory Transactions Log
    CREATE TABLE IF NOT EXISTS inventory_transactions (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      variant_id TEXT,
      product_name TEXT NOT NULL,
      sku TEXT NOT NULL,
      transaction_type TEXT NOT NULL, -- 'stock_in', 'sale', 'stock_out', 'adjustment', 'return', 'cancellation_restore'
      previous_stock INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      new_stock INTEGER NOT NULL,
      reference TEXT,
      admin_id TEXT,
      note TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Coupons
    CREATE TABLE IF NOT EXISTS coupons (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      description TEXT,
      discount_type TEXT NOT NULL DEFAULT 'percentage', -- 'percentage', 'fixed'
      discount_value REAL NOT NULL,
      min_order_amount REAL DEFAULT 0,
      max_discount_amount REAL,
      start_date TEXT,
      expiry_date TEXT,
      usage_limit INTEGER DEFAULT 100,
      used_count INTEGER DEFAULT 0,
      per_user_limit INTEGER DEFAULT 1,
      allow_stacking INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Timer Offers (Authoritative Pricing Rule)
    CREATE TABLE IF NOT EXISTS timer_offers (
      id TEXT PRIMARY KEY,
      offer_name TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      discount_type TEXT NOT NULL DEFAULT 'percentage', -- 'percentage', 'fixed'
      discount_value REAL NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      target_type TEXT NOT NULL DEFAULT 'entire_store', -- 'entire_store', 'category', 'product', 'variant'
      target_ids TEXT DEFAULT '[]', -- JSON array of IDs
      min_quantity INTEGER DEFAULT 1,
      min_order_amount REAL DEFAULT 0,
      max_discount REAL,
      status TEXT DEFAULT 'active', -- 'draft', 'scheduled', 'active', 'expired', 'inactive'
      created_by TEXT DEFAULT 'Admin',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Wholesale Customers
    CREATE TABLE IF NOT EXISTS wholesale_customers (
      id TEXT PRIMARY KEY,
      business_name TEXT NOT NULL,
      contact_person TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      email TEXT,
      district TEXT,
      address TEXT,
      credit_limit REAL DEFAULT 50000,
      discount_rate REAL DEFAULT 15,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Wholesale Orders
    CREATE TABLE IF NOT EXISTS wholesale_orders (
      id TEXT PRIMARY KEY,
      wholesale_customer_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      business_name TEXT NOT NULL,
      phone TEXT NOT NULL,
      total_amount REAL NOT NULL,
      items_json TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      payment_terms TEXT DEFAULT '30_days',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Complaints Management
    CREATE TABLE IF NOT EXISTS complaints (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      order_id TEXT,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      priority TEXT DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
      status TEXT DEFAULT 'new', -- 'new', 'in_review', 'waiting_for_customer', 'resolved', 'closed'
      assigned_admin TEXT,
      admin_reply TEXT,
      internal_note TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Internal Admin Tasks
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      assigned_admin TEXT NOT NULL,
      priority TEXT DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
      due_date TEXT,
      status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'cancelled'
      created_by TEXT DEFAULT 'Admin',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Notifications & Messages
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL, -- 'order', 'payment', 'return', 'refund', 'low_stock', 'complaint', 'review'
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      link TEXT,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Product Reviews
    CREATE TABLE IF NOT EXISTS product_reviews (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT NOT NULL,
      admin_reply TEXT,
      status TEXT DEFAULT 'approved', -- 'pending', 'approved', 'hidden'
      is_verified_purchase INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Admins & Staff
    CREATE TABLE IF NOT EXISTS admins (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      role TEXT NOT NULL DEFAULT 'super_admin',
      permissions TEXT DEFAULT '["all"]', -- JSON array
      password_hash TEXT,
      salt TEXT,
      force_password_change INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      avatar TEXT,
      last_login TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Admin Sessions (Auth & CSRF Tracking)
    CREATE TABLE IF NOT EXISTS admin_sessions (
      token TEXT PRIMARY KEY,
      admin_id TEXT NOT NULL,
      csrf_token TEXT NOT NULL,
      ip_address TEXT DEFAULT '127.0.0.1',
      user_agent TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
    );

    -- Audit Logs (Append-Only)
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      admin_name TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT,
      previous_value TEXT,
      new_value TEXT,
      ip_address TEXT DEFAULT '127.0.0.1',
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Login Activity
    CREATE TABLE IF NOT EXISTS login_activity (
      id TEXT PRIMARY KEY,
      admin_name TEXT NOT NULL,
      email TEXT NOT NULL,
      ip_address TEXT DEFAULT '127.0.0.1',
      user_agent TEXT,
      status TEXT DEFAULT 'success',
      reason TEXT,
      timestamp TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- AI Settings
    CREATE TABLE IF NOT EXISTS ai_settings (
      id TEXT PRIMARY KEY,
      enabled INTEGER DEFAULT 1,
      agent_name TEXT DEFAULT 'বাস্ত্র শৈলী এআই সহকারী',
      welcome_message TEXT,
      language TEXT DEFAULT 'bn',
      response_style TEXT DEFAULT 'friendly_expert',
      business_description TEXT,
      business_hours TEXT,
      contact_info TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- AI Knowledge Base
    CREATE TABLE IF NOT EXISTS ai_knowledge (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL, -- 'faq', 'delivery', 'payment', 'return', 'refund', 'product', 'business'
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- AI Conversations Log
    CREATE TABLE IF NOT EXISTS ai_conversations (
      id TEXT PRIMARY KEY,
      customer_name TEXT,
      customer_phone TEXT,
      last_message TEXT,
      message_count INTEGER DEFAULT 1,
      status TEXT DEFAULT 'active', -- 'active', 'waiting', 'human_handoff', 'resolved', 'closed'
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Hero & Store Banners
    CREATE TABLE IF NOT EXISTS banners (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      bangla_title TEXT,
      subtitle TEXT,
      bangla_subtitle TEXT,
      button_text TEXT,
      button_url TEXT,
      desktop_image TEXT NOT NULL,
      mobile_image TEXT,
      display_order INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      tag TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Store & Commerce Settings (Authoritative SQLite Key-Value Store)
    CREATE TABLE IF NOT EXISTS store_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    -- Landing Pages / Product Campaigns (Soft Creation High-Converting Architecture)
    CREATE TABLE IF NOT EXISTS landing_pages (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      product_id TEXT NOT NULL,
      template TEXT DEFAULT 'template_1',
      badge_text TEXT DEFAULT 'সীমিত সময়ের স্পেশাল অফার!',
      headline TEXT NOT NULL,
      subheadline TEXT,
      video_url TEXT,
      benefits_json TEXT,
      highlights_json TEXT,
      customer_reviews_json TEXT,
      offer_price REAL,
      regular_price REAL,
      delivery_inside_dhaka REAL DEFAULT 70,
      delivery_outside_dhaka REAL DEFAULT 120,
      whatsapp_number TEXT DEFAULT '01890123456',
      call_number TEXT DEFAULT '01890123456',
      status TEXT DEFAULT 'active',
      view_count INTEGER DEFAULT 0,
      order_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  try {
    const lpCount = db.prepare('SELECT COUNT(*) as count FROM landing_pages').get() as { count: number };
    if (!lpCount || lpCount.count === 0) {
      const prod = db.prepare(`
        SELECT p.id, p.name, pv.price, pv.offer_price 
        FROM products p 
        LEFT JOIN product_variants pv ON p.id = pv.product_id 
        LIMIT 1
      `).get() as any;
      const prodId = prod?.id || 'prod-1';
      const offerPrice = prod?.offer_price || prod?.price || 1450;
      const regPrice = prod?.price || 1850;

      db.prepare(`
        INSERT INTO landing_pages (
          id, title, slug, product_id, template, badge_text, headline, subheadline, video_url,
          benefits_json, highlights_json, customer_reviews_json, offer_price, regular_price,
          delivery_inside_dhaka, delivery_outside_dhaka, whatsapp_number, call_number, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'lp-1',
        'প্রিমিয়াম হ্যান্ডলুম সুতি লুঙ্গি ও পাঞ্জাবি স্পেশাল অফার',
        'special-handloom-offer',
        prodId,
        'template_1',
        'সীমিত সময়ের ধামাকা অফার! সরাসরি কারখানা থেকে হোম ডেলিভারি',
        'শতভাগ খাঁটি দেশীয় সুতায় তৈরি আরামদায়ক ও আভিজাত্যপূর্ণ পোশাক',
        'অর্ডার করতে নিচের ফর্মটি সঠিক তথ্য দিয়ে পূরণ করুন। ডেলিভারিম্যান পৌঁছানোর পর পণ্য দেখে মূল্য পরিশোধ করুন।',
        'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        JSON.stringify([
          '১০০% খাঁটি সুতি ও আরামদায়ক টেক্সচার',
          'রং পাকা ও দীর্ঘস্থায়ী কোয়ালিটির নিশ্চয়তা',
          'সরাসরি ঐতিহ্যবাহী তাঁতপল্লী থেকে সংগৃহীত',
          'ক্যাশ অন ডেলিভারি (পণ্য হাতে পেয়ে টাকা দেওয়ার সুবিধা)',
          '৭ দিনের সহজ পরিবর্তন ও মানিব্যাক গ্যারান্টি',
        ]),
        JSON.stringify([
          { title: 'স্বাদে গন্ধে ইনস্ট্যান্ট রিচার্জ!', desc: 'শতভাগ আরামদায়ক ও পরিচ্ছন্ন সুতা' },
          { title: '১০০% খাঁটি কোয়ালিটি', desc: 'মজবুত বুনন ও টেকসই সেলাই' },
          { title: 'শতভাগ প্রিমিয়াম নিশ্চয়তা', desc: 'দেখে বুঝে নেওয়ার পূর্ণ সুবিধা' },
        ]),
        JSON.stringify([
          {
            name: 'তানভীর আহমেদ',
            photo: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
            comment: 'কাপড়টা সত্যি অনেক আরামদায়ক। ডেলিভারিও দ্রুত পেয়েছি।',
          },
          {
            name: 'মাহবুবুল হক',
            photo: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
            comment: 'একদম ছবির মতোই পেয়েছি। সবাইকে নেওয়ার পরামর্শ দিচ্ছি।',
          },
        ]),
        offerPrice,
        regPrice,
        70,
        120,
        '01890123456',
        '01890123456',
        'active'
      );
    }

    const existingPromo = db.prepare("SELECT value FROM store_settings WHERE key = 'promo_sub_banners'").get() as any;
    if (!existingPromo) {
      const defaultPromo = [
        {
          id: 'sub-banner-1',
          title: 'SUMMER FASHION SALE',
          badge: '70% OFF',
          subtitle: 'প্রিমিয়াম সামার কালেকশন',
          image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=700',
          link: '/category/women',
          bgGradient: 'from-amber-600/90 to-rose-700/90',
        },
        {
          id: 'sub-banner-2',
          title: 'MEGA FASHION SALE',
          badge: 'SPRING 2026',
          subtitle: 'এক্সক্লুসিভ নতুন ডিজাইন',
          image: 'https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&q=80&w=700',
          link: '/category/men',
          bgGradient: 'from-emerald-700/90 to-teal-900/90',
        },
        {
          id: 'sub-banner-3',
          title: 'Weekend Special Sale',
          badge: '50% OFF',
          subtitle: 'সীমিত সময়ের বিশেষ অফার',
          image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&q=80&w=700',
          link: '/category/all',
          bgGradient: 'from-violet-700/90 to-indigo-950/90',
        },
      ];
      db.prepare("INSERT OR REPLACE INTO store_settings (key, value) VALUES ('promo_sub_banners', ?)").run(
        JSON.stringify(defaultPromo)
      );
    }
  } catch (err) {
    console.warn('Initial landing_pages / promo_sub_banners check warning:', err);
  }
}

// Seed Initial Authentic Data
export function seedDatabaseIfEmpty() {
  const catCount = db.prepare('SELECT COUNT(*) as count FROM categories').get() as { count: number };
  if (catCount && catCount.count > 0) {
    return; // Already seeded
  }

  db.exec('BEGIN TRANSACTION');

  try {
    // 1. Categories
    const insertCat = db.prepare(
      'INSERT INTO categories (id, name, bangla_name, slug, parent_category, image, order_num, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    insertCat.run('cat-lungi', 'Lungi', 'লুঙ্গি', 'lungi', 'MEN', 'https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?auto=format&fit=crop&w=800&q=80', 1, 1);
    insertCat.run('cat-panjabi', 'Panjabi', 'পাঞ্জাবি', 'panjabi', 'MEN', 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80', 2, 1);
    insertCat.run('cat-saree', 'Saree', 'শাড়ি ও জামদানি', 'saree', 'WOMEN', 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80', 3, 1);
    insertCat.run('cat-tshirt', 'T-Shirt', 'টি-শার্ট', 'tshirt', 'MEN', 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=800&q=80', 4, 1);
    insertCat.run('cat-three-piece', 'Three-Piece', 'থ্রি-পিস', 'three-piece', 'WOMEN', 'https://images.unsplash.com/photo-1583391733975-22d7efd0ce24?auto=format&fit=crop&w=800&q=80', 5, 1);

    // 2. Colors
    const insertColor = db.prepare('INSERT INTO colors (id, name, bangla_name, hex_code, active) VALUES (?, ?, ?, ?, ?)');
    insertColor.run('col-blue', 'Royal Blue', 'রয়্যাল ব্লু', '#1e3a8a', 1);
    insertColor.run('col-red', 'Ruby Red', 'রুবি রেড', '#dc2626', 1);
    insertColor.run('col-green', 'Forest Green', 'ফরেস্ট গ্রিন', '#15803d', 1);
    insertColor.run('col-black', 'Midnight Black', 'মিডনাইট ব্ল্যাক', '#18181b', 1);
    insertColor.run('col-white', 'Pure White', 'পিউর হোয়াইট', '#f8fafc', 1);
    insertColor.run('col-brown', 'Warm Brown', 'চকলেট ব্রাউন', '#78350f', 1);
    insertColor.run('col-maroon', 'Deep Maroon', 'মেরুন', '#831843', 1);

    // 3. Sizes
    const insertSize = db.prepare('INSERT INTO sizes (id, name, bangla_name, code, category, sort_order, active) VALUES (?, ?, ?, ?, ?, ?, ?)');
    insertSize.run('sz-25h', '2.5 হাত', '২.৫ হাত (স্ট্যান্ডার্ড)', '2.5H', 'LUNGI', 1, 1);
    insertSize.run('sz-30h', '3 হাত', '৩ হাত (লম্বা)', '3.0H', 'LUNGI', 2, 1);
    insertSize.run('sz-s', 'S', 'স্মল (৩৮)', 'S', 'APPAREL', 3, 1);
    insertSize.run('sz-m', 'M', 'মিডিয়াম (৪০)', 'M', 'APPAREL', 4, 1);
    insertSize.run('sz-l', 'L', 'লার্জ (৪২)', 'L', 'APPAREL', 5, 1);
    insertSize.run('sz-xl', 'XL', 'এক্সেল (৪৪)', 'XL', 'APPAREL', 6, 1);
    insertSize.run('sz-xxl', 'XXL', 'ডাবল এক্সেল (৪৬)', 'XXL', 'APPAREL', 7, 1);
    insertSize.run('sz-free', 'Free Size', 'ফ্রি সাইজ', 'FREE', 'FREE_SIZE', 8, 1);

    // 4. Products & Variants (Authoritative ProductVariant architecture)
    const insertProd = db.prepare(`
      INSERT INTO products (
        id, name, bangla_name, slug, sku, description, short_description, 
        category_id, sub_category, variant_config, brand, price, discount_price, 
        low_stock_threshold, is_featured, is_new_arrival, is_best_seller, is_offer, 
        status, main_image, seo_title, seo_description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertVar = db.prepare(`
      INSERT INTO product_variants (
        id, product_id, color_id, size_id, sku, price, offer_price, weight, stock, low_stock_threshold, active, image
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertGallery = db.prepare(`
      INSERT INTO color_galleries (id, product_id, color_id, image_url, is_main, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    // PRODUCT 1: সিরাজগঞ্জ সুতি তাঁতের লুঙ্গি (Free Size / Color-only)
    insertProd.run(
      'prod-lungi-01',
      'Sirajganj Pure Cotton Handloom Lungi',
      'সিরাজগঞ্জ প্রিমিয়াম সুতি তাঁতের লুঙ্গি',
      'sirajganj-pure-cotton-handloom-lungi',
      'BS-LUN-001',
      '১০০% খাঁটি সিরাজগঞ্জের সুতি সুতায় বোনা এই লুঙ্গিটি অত্যন্ত নরম, আরামদায়ক ও টেকসই। গরমের দিনে পরার জন্য এটি একদম পারফেক্ট। ওয়াশের পরও ১০০% রঙ পাকা থাকে।',
      '১০০% খাঁটি দেশীয় সুতি হ্যান্ডলুম লুঙ্গি, প্রিমিয়াম আরামদায়ক বুনন।',
      'cat-lungi',
      'Lungi',
      'free_size',
      'BASTRA SHOILY',
      950,
      850,
      5,
      1,
      1,
      1,
      1,
      'active',
      'https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?auto=format&fit=crop&w=800&q=80',
      'সিরাজগঞ্জ সুতি তাঁতের লুঙ্গি - BASTRA SHOILY',
      'খাঁটি সুতি তাঁতের তৈরি আরামদায়ক লুঙ্গি।'
    );

    // Free size variants for 3 colors
    insertVar.run('var-lun-blue-free', 'prod-lungi-01', 'col-blue', null, 'LUN-BLU-001', 950, 850, 0.4, 25, 5, 1, 'https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?auto=format&fit=crop&w=800&q=80');
    insertVar.run('var-lun-red-free', 'prod-lungi-01', 'col-red', null, 'LUN-RED-001', 950, 850, 0.4, 18, 5, 1, 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=800&q=80');
    insertVar.run('var-lun-green-free', 'prod-lungi-01', 'col-green', null, 'LUN-GRN-001', 950, 850, 0.4, 12, 5, 1, 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80');

    // Color galleries for Product 1
    insertGallery.run('gal-lun-blu-1', 'prod-lungi-01', 'col-blue', 'https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?auto=format&fit=crop&w=800&q=80', 1, 1);
    insertGallery.run('gal-lun-blu-2', 'prod-lungi-01', 'col-blue', 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=800&q=80', 0, 2);
    insertGallery.run('gal-lun-red-1', 'prod-lungi-01', 'col-red', 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=800&q=80', 1, 1);
    insertGallery.run('gal-lun-grn-1', 'prod-lungi-01', 'col-green', 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=80', 1, 1);

    // PRODUCT 2: রয়্যাল সেমি সিল্ক এমব্রয়ডারি পাঞ্জাবি (Color + Size)
    insertProd.run(
      'prod-panjabi-01',
      'Royal Embroidered Semi-Silk Panjabi',
      'রয়্যাল সেমি সিল্ক এমব্রয়ডারি পাঞ্জাবি',
      'royal-semi-silk-embroidered-panjabi',
      'BS-PAN-001',
      'উৎসব কিংবা যেকোনো আভিজাত্যের আয়োজনে এই পাঞ্জাবিটি সেরা। বুক ও কলার জুড়ে নিখুঁত মেশিন এমব্রয়ডারি ওয়ার্ক এবং আরামদায়ক প্রিমিয়াম সিল্ক-কটন মিক্সড ফেব্রিক।',
      'উৎসবের আভিজাত্যে রাজকীয় এমব্রয়ডারি সিল্ক পাঞ্জাবি।',
      'cat-panjabi',
      'Panjabi',
      'color_size',
      'BASTRA SHOILY',
      2450,
      2150,
      4,
      1,
      1,
      1,
      1,
      'active',
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80',
      'রয়্যাল এমব্রয়ডারি পাঞ্জাবি - BASTRA SHOILY',
      'আভিজাত্য ও রুচির সেরা পাঞ্জাবি কালেকশন।'
    );

    // Actual combinations for Royal Blue (M, L, XL)
    insertVar.run('var-pan-blu-m', 'prod-panjabi-01', 'col-blue', 'sz-m', 'PAN-BLU-M', 2450, 2150, 0.5, 14, 3, 1, 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80');
    insertVar.run('var-pan-blu-l', 'prod-panjabi-01', 'col-blue', 'sz-l', 'PAN-BLU-L', 2450, 2150, 0.5, 20, 4, 1, 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80');
    insertVar.run('var-pan-blu-xl', 'prod-panjabi-01', 'col-blue', 'sz-xl', 'PAN-BLU-XL', 2450, 2150, 0.5, 8, 2, 1, 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80');

    // Actual combinations for Midnight Black (M, L)
    insertVar.run('var-pan-blk-m', 'prod-panjabi-01', 'col-black', 'sz-m', 'PAN-BLK-M', 2450, 2150, 0.5, 12, 3, 1, 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80');
    insertVar.run('var-pan-blk-l', 'prod-panjabi-01', 'col-black', 'sz-l', 'PAN-BLK-L', 2450, 2150, 0.5, 16, 4, 1, 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80');

    // Color Galleries for Panjabi
    insertGallery.run('gal-pan-blu-1', 'prod-panjabi-01', 'col-blue', 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&w=800&q=80', 1, 1);
    insertGallery.run('gal-pan-blu-2', 'prod-panjabi-01', 'col-blue', 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80', 0, 2);
    insertGallery.run('gal-pan-blk-1', 'prod-panjabi-01', 'col-black', 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80', 1, 1);

    // PRODUCT 3: ঐতিহ্যবাহী ঢাকাই জামদানি শাড়ি (Free Size / Color-only)
    insertProd.run(
      'prod-saree-01',
      'Traditional Dhakai Jamdani Handloom Saree',
      'ঐতিহ্যবাহী ঢাকাই জামদানি তাঁতের শাড়ি',
      'traditional-dhakai-jamdani-handloom-saree',
      'BS-SAR-001',
      'রূপালী ও সুতি জরির নিখুঁত নকশায় হাতে বোনা অভিজাত জামদানি শাড়ি। প্রতিটি শাড়ি তৈরিতে তাঁতিদের সময় লেগেছে ১৫ থেকে ২০ দিন।',
      'খাঁটি ঢাকাই জামদানি, রূপালী জরি ও সুতি সুতায় হাতে বোনা।',
      'cat-saree',
      'Saree',
      'free_size',
      'BASTRA SHOILY',
      4500,
      3850,
      3,
      1,
      1,
      1,
      1,
      'active',
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80',
      'ঢাকাই জামদানি শাড়ি - BASTRA SHOILY',
      'বাংলার ঐতিহ্যবাহী জামদানি শাড়ির সেরা সমাহার।'
    );

    insertVar.run('var-sar-mar-free', 'prod-saree-01', 'col-maroon', null, 'SAR-MAR-001', 4500, 3850, 0.7, 7, 2, 1, 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80');
    insertVar.run('var-sar-blu-free', 'prod-saree-01', 'col-blue', null, 'SAR-BLU-001', 4500, 3850, 0.7, 5, 2, 1, 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=800&q=80');
    insertGallery.run('gal-sar-mar-1', 'prod-saree-01', 'col-maroon', 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80', 1, 1);
    insertGallery.run('gal-sar-blu-1', 'prod-saree-01', 'col-blue', 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&w=800&q=80', 1, 1);

    // 5. Admins
    const insertAdmin = db.prepare(`
      INSERT INTO admins (id, name, email, phone, role, permissions, status, avatar, last_login)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertAdmin.run(
      'admin-1',
      'Abdullah (Owner)',
      process.env.INITIAL_ADMIN_EMAIL || 'admin@bastrashoily.com',
      '01890123456',
      'super_admin',
      '["all", "products.view", "products.create", "products.edit", "products.archive", "orders.view", "orders.edit", "orders.cancel", "orders.refund", "inventory.view", "inventory.adjust", "customers.view", "customers.edit", "payments.manage", "reports.view", "settings.manage", "admins.manage"]',
      'active',
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
      'সদ্য সক্রিয়'
    );

    // 6. Promotional Starter Coupons
    const insertCoupon = db.prepare(`
      INSERT INTO coupons (id, code, description, discount_type, discount_value, min_order_amount, max_discount_amount, expiry_date, usage_limit, used_count, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertCoupon.run('cp-1', 'BASTRA100', '১০০ টাকা ইনস্ট্যান্ট ক্যাশ ছাড়', 'fixed', 100, 1000, 100, '2026-12-31', 500, 0, 1);
    insertCoupon.run('cp-2', 'FESTIVE200', 'উৎসবের কেনাকাটায় ২০০ টাকা ছাড়', 'fixed', 200, 2000, 200, '2026-12-31', 200, 0, 1);
    insertCoupon.run('cp-3', 'LUNGI25', '৩টি লুঙ্গি কিনলে ২৫% ছাড়', 'percentage', 25, 1200, 500, '2026-12-31', 300, 0, 1);

    // 9. Timer Offers
    const insertTimerOffer = db.prepare(`
      INSERT INTO timer_offers (id, offer_name, title, description, discount_type, discount_value, start_time, end_time, target_type, target_ids, min_quantity, min_order_amount, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertTimerOffer.run(
      'to-1',
      'উৎসব মেগা অফার ২০২৬',
      'সিরাজগঞ্জ তাঁতের কাপড়ে বিশেষ ছাড়',
      'সীমিত সময়ের জন্য সমস্ত পাঞ্জাবি ও শাড়িতে ১৫% ইনস্ট্যান্ট ছাড়!',
      'percentage',
      15,
      new Date().toISOString(),
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      'category',
      '["cat-panjabi", "cat-saree"]',
      1,
      1500,
      'active'
    );

    // 7. Audit Logs
    const insertAudit = db.prepare(`
      INSERT INTO audit_logs (id, admin_name, action, target_type, target_id, previous_value, new_value, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertAudit.run('aud-1', 'Abdullah (Owner)', 'System Initialized', 'system', 'bastra_shoily', null, 'Initial schema and clean system initialized', '127.0.0.1');

    // 8. AI Settings
    const insertAISettings = db.prepare(`
      INSERT INTO ai_settings (id, enabled, agent_name, welcome_message, language, response_style, business_description, business_hours, contact_info)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertAISettings.run(
      'default',
      1,
      'বাস্ত্র শৈলী এআই কনসালট্যান্ট',
      'আসসালামু আলাইকুম! বাস্ত্র শৈলীতে আপনাকে স্বাগতম। আপনি কি লুঙ্গি, পাঞ্জাবি, জামদানি শাড়ি কিংবা সাইজ সম্পর্কে জানতে চাচ্ছেন?',
      'bn',
      'friendly_expert',
      'বাস্ত্র শৈলী সিরাজগঞ্জ ও পাবনার সেরা তাঁতের লুঙ্গি, ঐতিহ্যবাহী ঢাকাই জামদানি এবং প্রিমিয়াম পাঞ্জাবির অনলাইন শপ।',
      'সকাল ৯টা থেকে রাত ১১টা (সপ্তাহে ৭ দিন)',
      'হটলাইন: +8801890-123456, ইমেইল: support@bastrashoily.com'
    );

    // 15. AI Knowledge
    const insertAIKnowledge = db.prepare(`
      INSERT INTO ai_knowledge (id, category, title, content, active)
      VALUES (?, ?, ?, ?, ?)
    `);
    insertAIKnowledge.run('kno-1', 'delivery', 'ডেলিভারি চার্জ ও সময়', 'সিরাজগঞ্জ জেলায় লোকাল ডেলিভারি চার্জ মাত্র ৭০ টাকা (২৪ ঘণ্টার মধ্যে)। সিরাজগঞ্জের বাইরে সারা বাংলাদেশে ১৩০ টাকা (২-৩ দিনের মধ্যে)। ২,০০০ টাকার বেশি যেকোনো অর্ডারে সারা দেশে সম্পূর্ণ ফ্রি ডেলিভারি!', 1);
    insertAIKnowledge.run('kno-2', 'return', 'রিটার্ন ও এক্সচেঞ্জ পলিসি', 'ডেলিভারি ম্যানের সামনে প্রোডাক্ট চেক করে নেওয়ার সুযোগ রয়েছে। কোনো সাইজ বা ত্রুটি থাকলে ৭ দিনের মধ্যে সম্পূর্ণ বিনামূল্যে এক্সচেঞ্জ করে দেওয়া হয়।', 1);
    insertAIKnowledge.run('kno-3', 'payment', 'পেমেন্ট মাধ্যম', 'ক্যাশ অন ডেলিভারি (পণ্য হাতে পেয়ে মূল্য পরিশোধ) ছাড়াও বিকাশ, নগদ ও কার্ডের মাধ্যমে নিরাপদ অনলাইন পেমেন্ট করার সুযোগ রয়েছে।', 1);

    db.exec('COMMIT');
    console.log('[DB] Bastra Shoily SQLite database seeded successfully.');
  } catch (error) {
    db.exec('ROLLBACK');
    console.error('[DB] Failed to seed database:', error);
  }
}

// Ensure all seeded admins have password hashes and salt
export function ensureAdminCredentials() {
  try {
    const adminCols = db.prepare('PRAGMA table_info(admins)').all().map((c: any) => c.name);
    if (!adminCols.includes('password_hash')) db.exec('ALTER TABLE admins ADD COLUMN password_hash TEXT;');
    if (!adminCols.includes('salt')) db.exec('ALTER TABLE admins ADD COLUMN salt TEXT;');
    if (!adminCols.includes('force_password_change')) db.exec('ALTER TABLE admins ADD COLUMN force_password_change INTEGER DEFAULT 0;');
  } catch {
    try { db.exec('ALTER TABLE admins ADD COLUMN force_password_change INTEGER DEFAULT 0;'); } catch {}
  }

  try {
    const orderCols = db.prepare('PRAGMA table_info(orders)').all().map((c: any) => c.name);
    if (!orderCols.includes('timer_offer_name')) db.exec('ALTER TABLE orders ADD COLUMN timer_offer_name TEXT;');
    if (!orderCols.includes('timer_offer_discount')) db.exec('ALTER TABLE orders ADD COLUMN timer_offer_discount REAL DEFAULT 0;');
    if (!orderCols.includes('courier_provider')) db.exec('ALTER TABLE orders ADD COLUMN courier_provider TEXT;');
    if (!orderCols.includes('courier_tracking_code')) db.exec('ALTER TABLE orders ADD COLUMN courier_tracking_code TEXT;');
    if (!orderCols.includes('courier_consignment_id')) db.exec('ALTER TABLE orders ADD COLUMN courier_consignment_id TEXT;');
    if (!orderCols.includes('courier_status')) db.exec('ALTER TABLE orders ADD COLUMN courier_status TEXT;');
  } catch {}

  try {
    db.exec('CREATE TABLE IF NOT EXISTS store_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);');
  } catch {}

  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS customer_cart (
        id TEXT PRIMARY KEY,
        customer_phone TEXT NOT NULL,
        product_id TEXT NOT NULL,
        variant_id TEXT,
        quantity INTEGER NOT NULL DEFAULT 1,
        price REAL NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(customer_phone, product_id, variant_id)
      );
    `);
  } catch {}

  let initialPassword = process.env.INITIAL_ADMIN_PASSWORD;
  let forceChange = 0;

  if (!initialPassword) {
    initialPassword = crypto.randomBytes(12).toString('base64url');
    forceChange = 1;
    if (process.env.NODE_ENV !== 'production') {
      console.warn('================================================================');
      console.warn('⚠️  [SECURITY NOTICE] INITIAL_ADMIN_PASSWORD not set in .env!');
      console.warn(`Generated One-Time Bootstrap Admin Password: ${initialPassword}`);
      console.warn('Admins MUST change this password upon first login.');
      console.warn('================================================================');
    } else {
      console.warn('[SECURITY NOTICE] Production initialized without INITIAL_ADMIN_PASSWORD. Use secure CLI admin creation or environment variable.');
    }
  }

  const admins = db.prepare('SELECT id, email, password_hash FROM admins').all() as any[];
  const updateStmt = db.prepare('UPDATE admins SET password_hash = ?, salt = ?, force_password_change = ? WHERE id = ?');

  for (const admin of admins) {
    if (!admin.password_hash) {
      const { hash, salt } = hashPassword(initialPassword);
      updateStmt.run(hash, salt, forceChange, admin.id);
      if (!process.env.INITIAL_ADMIN_PASSWORD) {
        console.warn(`[Security Warning] Admin ${admin.email} initialized with temporary initial password. Password change is enforced.`);
      }
    }
  }

  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  } catch {}
}

// Wipe all demo products, variants, orders, customers, and non-owner staff for production
export function wipeAllDemoData(): {
  deletedProducts: number;
  deletedVariants: number;
  deletedOrders: number;
  deletedCustomers: number;
} {
  db.exec('BEGIN IMMEDIATE;');
  try {
    const pCount = (db.prepare('SELECT COUNT(*) as count FROM products').get() as any).count;
    const vCount = (db.prepare('SELECT COUNT(*) as count FROM product_variants').get() as any).count;
    const oCount = (db.prepare('SELECT COUNT(*) as count FROM orders').get() as any).count;
    const cCount = (db.prepare('SELECT COUNT(*) as count FROM customers').get() as any).count;

    db.exec('DELETE FROM order_timeline;');
    db.exec('DELETE FROM order_items;');
    db.exec('DELETE FROM orders;');
    db.exec('DELETE FROM customers;');
    db.exec('DELETE FROM customer_cart;');
    db.exec('DELETE FROM color_galleries;');
    db.exec('DELETE FROM variant_gallery_overrides;');
    db.exec('DELETE FROM product_variants;');
    db.exec('DELETE FROM product_reviews;');
    db.exec('DELETE FROM inventory_transactions;');
    db.exec('DELETE FROM products;');
    db.exec('DELETE FROM complaints;');
    db.exec('DELETE FROM tasks;');
    db.exec('DELETE FROM notifications;');
    // Retain only primary super admin
    db.exec("DELETE FROM admins WHERE id != 'admin-1' AND role != 'super_admin';");

    db.prepare(`
      INSERT INTO store_settings (key, value, updated_at)
      VALUES ('catalog_cleaned', 'true', CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = 'true', updated_at = CURRENT_TIMESTAMP
    `).run();

    db.exec('COMMIT;');

    try {
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch {}

    return {
      deletedProducts: pCount,
      deletedVariants: vCount,
      deletedOrders: oCount,
      deletedCustomers: cCount,
    };
  } catch (err) {
    try {
      db.exec('ROLLBACK;');
    } catch {}
    throw err;
  }
}

export const wipeDemoProducts = wipeAllDemoData;

// Ensure all authentic products with variants and color galleries are present
export function ensureAllProductsSeeded() {
  if (process.env.SKIP_DEMO_SEED === 'true' || process.env.NODE_ENV === 'production') {
    return;
  }
  try {
    const cleaned = db.prepare("SELECT value FROM store_settings WHERE key = 'catalog_cleaned'").get() as any;
    if (cleaned && cleaned.value === 'true') {
      return; // Admin requested clean store
    }
  } catch {}
  const countObj = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
  if (countObj && countObj.count >= 8) return;

  const insertProd = db.prepare(`
    INSERT OR IGNORE INTO products (
      id, name, bangla_name, slug, sku, description, short_description, 
      category_id, sub_category, variant_config, brand, price, discount_price, 
      low_stock_threshold, is_featured, is_new_arrival, is_best_seller, is_offer, 
      status, main_image, seo_title, seo_description
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertVar = db.prepare(`
    INSERT OR IGNORE INTO product_variants (
      id, product_id, color_id, size_id, sku, price, offer_price, weight, stock, low_stock_threshold, active, image
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertGallery = db.prepare(`
    INSERT OR IGNORE INTO color_galleries (id, product_id, color_id, image_url, is_main, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Product 4: Ultimate Relaxed Heavyweight Combed Cotton Tee
  insertProd.run(
    'prod-0',
    'Ultimate Unisex Relaxed Heavyweight Tee',
    'প্রিমিয়াম হেভিওয়েট রিল্যাক্সড কটন টি-শার্ট',
    'ultimate-unisex-relaxed-heavyweight-tee',
    'TS-ULT-01',
    'Crafted from 100% long-staple compact combed cotton (220 GSM), the Ultimate Unisex Tee features a signature relaxed silhouette, reinforced ribbed crew neckline, and breathable handfeel.',
    '১০০% কম্বড কমপ্যাক্ট কটন ২২০ জিএসএম রিল্যাক্সড টি-শার্ট।',
    'cat-tshirt',
    'T-Shirt',
    'color_size',
    'BASTRA SHOILY',
    2000,
    1850,
    5,
    1,
    1,
    1,
    0,
    'active',
    'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&q=80&w=1000',
    'Ultimate Unisex Relaxed Heavyweight Tee | BASTRA SHOILY',
    'Shop premium 220 GSM combed cotton heavyweight t-shirt in Bangladesh.'
  );

  insertVar.run('var-0-aby-s', 'prod-0', 'col-black', 'sz-s', 'TS-ABY-S', 2000, 1850, 0.3, 8, 2, 1, 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&q=80&w=1000');
  insertVar.run('var-0-aby-m', 'prod-0', 'col-black', 'sz-m', 'TS-ABY-M', 2000, 1850, 0.3, 10, 2, 1, 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&q=80&w=1000');
  insertVar.run('var-0-aby-l', 'prod-0', 'col-black', 'sz-l', 'TS-ABY-L', 2000, 1850, 0.3, 6, 2, 1, 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&q=80&w=1000');
  insertVar.run('var-0-brn-m', 'prod-0', 'col-brown', 'sz-m', 'TS-BRN-M', 2100, 1950, 0.3, 8, 2, 1, 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&q=80&w=1000');
  insertVar.run('var-0-brn-l', 'prod-0', 'col-brown', 'sz-l', 'TS-BRN-L', 2100, 1950, 0.3, 7, 2, 1, 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&q=80&w=1000');

  insertGallery.run('gal-0-blk-1', 'prod-0', 'col-black', 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&q=80&w=1000', 1, 1);
  insertGallery.run('gal-0-brn-1', 'prod-0', 'col-brown', 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&q=80&w=1000', 1, 1);

  // Product 5: Premium Handloom Check Lungi (Olive Green & Red)
  insertProd.run(
    'prod-1',
    'Heritage Handloom Cotton Check Lungi',
    'ঐতিহ্যবাহী সিরাজগঞ্জ চেক তাঁতের সুতি লুঙ্গি',
    'heritage-handloom-cotton-check-lungi',
    'LUN-CHK-002',
    'খাঁটি সুতি সুতায় সিরাজগঞ্জের অভিজ্ঞ তাঁতিদের দক্ষ হাতে বোনা আরামদায়ক চেক লুঙ্গি। পাকা রঙ এবং টেকসই ফিনিশিং।',
    'সিরাজগঞ্জের ঐতিহ্যবাহী ১০০ কাউন্ট চেক সুতি লুঙ্গি।',
    'cat-lungi',
    'Lungi',
    'free_size',
    'BASTRA SHOILY',
    1150,
    980,
    5,
    1,
    0,
    1,
    1,
    'active',
    'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=800',
    'Heritage Handloom Cotton Check Lungi | BASTRA SHOILY',
    'Authentic Sirajganj check lungi handloom cotton.'
  );
  insertVar.run('var-1-grn-free', 'prod-1', 'col-green', null, 'LUN-CHK-GRN', 1150, 980, 0.4, 15, 3, 1, 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=800');
  insertVar.run('var-1-red-free', 'prod-1', 'col-red', null, 'LUN-CHK-RED', 1150, 980, 0.4, 12, 3, 1, 'https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?auto=format&fit=crop&q=80&w=800');
  insertGallery.run('gal-1-grn-1', 'prod-1', 'col-green', 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=800', 1, 1);
  insertGallery.run('gal-1-red-1', 'prod-1', 'col-red', 'https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?auto=format&fit=crop&q=80&w=800', 1, 1);

  // Product 6: Festive White Cotton Panjabi
  insertProd.run(
    'prod-2',
    'Classic Festive Pure White Cotton Panjabi',
    'ক্লাসিক উৎসব পিউর হোয়াইট সুতি পাঞ্জাবি',
    'classic-festive-pure-white-cotton-panjabi',
    'PAN-WHT-003',
    'জুমার নামাজ, ঈদ কিংবা যেকোনো পারিবারিক আয়োজনে খাঁটি সুতি ফেব্রিকের এই সাদা পাঞ্জাবিটি ব্যক্তিত্বে এনে দেয় অনন্য স্নিগ্ধতা।',
    'আভিজাত্যের প্রতীক ধবধবে সাদা পিউর কটন পাঞ্জাবি।',
    'cat-panjabi',
    'Panjabi',
    'color_size',
    'BASTRA SHOILY',
    1950,
    1750,
    4,
    1,
    1,
    0,
    0,
    'active',
    'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=800',
    'Classic Festive White Panjabi | BASTRA SHOILY',
    'Pure white cotton panjabi with exquisite embroidery neckline.'
  );
  insertVar.run('var-2-wht-m', 'prod-2', 'col-white', 'sz-m', 'PAN-WHT-M', 1950, 1750, 0.5, 14, 3, 1, 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=800');
  insertVar.run('var-2-wht-l', 'prod-2', 'col-white', 'sz-l', 'PAN-WHT-L', 1950, 1750, 0.5, 18, 4, 1, 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=800');
  insertVar.run('var-2-wht-xl', 'prod-2', 'col-white', 'sz-xl', 'PAN-WHT-XL', 1950, 1750, 0.5, 9, 2, 1, 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=800');
  insertGallery.run('gal-2-wht-1', 'prod-2', 'col-white', 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&q=80&w=800', 1, 1);

  // Product 7: Designer Embroidered Three-Piece
  insertProd.run(
    'prod-3',
    'Handloom Cotton Designer Three-Piece',
    'হ্যান্ডলুম কটন ডিজাইনার এমব্রয়ডারি থ্রি-পিস',
    'handloom-cotton-designer-three-piece',
    'TP-DES-001',
    'সূক্ষ্ম হাতের কাজ ও আরামদায়ক প্রিমিয়াম সুতি কাপড়ের থ্রি-পিস সেট। কামিজ, সালোয়ার ও ওড়নার মেলবন্ধনে অত্যন্ত রুচিশীল কালেকশন।',
    'আরামদায়ক সুতি ফ্যাব্রিকে ডিজাইনার এমব্রয়ডারি থ্রি-পিস।',
    'cat-three-piece',
    'Three-Piece',
    'free_size',
    'BASTRA SHOILY',
    3200,
    2850,
    4,
    1,
    1,
    1,
    1,
    'active',
    'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&q=80&w=800',
    'Designer Cotton Three Piece Set | BASTRA SHOILY',
    'Graceful embroidered cotton three-piece suits for festive occasions.'
  );
  insertVar.run('var-3-blu-free', 'prod-3', 'col-blue', null, 'TP-DES-BLU', 3200, 2850, 0.8, 9, 2, 1, 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&q=80&w=800');
  insertVar.run('var-3-red-free', 'prod-3', 'col-red', null, 'TP-DES-RED', 3200, 2850, 0.8, 7, 2, 1, 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800');
  insertGallery.run('gal-3-blu-1', 'prod-3', 'col-blue', 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&q=80&w=800', 1, 1);
  insertGallery.run('gal-3-red-1', 'prod-3', 'col-red', 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800', 1, 1);

  // Product 8: Rajshahi Pure Silk Saree
  insertProd.run(
    'prod-4',
    'Exclusive Rajshahi Pure Silk Floral Saree',
    'এক্সক্লুসিভ রাজশাহী পিউর সিল্ক ফ্লোরাল শাড়ি',
    'exclusive-rajshahi-pure-silk-floral-saree',
    'SAR-RAJ-002',
    'বাংলার ঐতিহ্যবাহী রাজশাহী সিল্কের অতুলনীয় কোমলতা ও আকর্ষণীয় ফ্লোরাল আঁচল প্রিন্ট। যেকোনো অভিজাত সন্ধ্যার জন্য নিখুঁত সাজ।',
    'খাঁটি রাজশাহী রেশম সুতার রাজকীয় সিল্ক শাড়ি।',
    'cat-saree',
    'Saree',
    'free_size',
    'BASTRA SHOILY',
    5200,
    4600,
    3,
    1,
    0,
    1,
    0,
    'active',
    'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800',
    'Rajshahi Pure Silk Saree | BASTRA SHOILY',
    'Finest handwoven pure silk saree from Rajshahi silk looms.'
  );
  insertVar.run('var-4-mar-free', 'prod-4', 'col-maroon', null, 'SAR-RAJ-MAR', 5200, 4600, 0.6, 6, 2, 1, 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800');
  insertGallery.run('gal-4-mar-1', 'prod-4', 'col-maroon', 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800', 1, 1);
}

// Ensure hero & store banners are seeded
export function ensureBannersTableAndSeeded() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS banners (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      bangla_title TEXT,
      subtitle TEXT,
      bangla_subtitle TEXT,
      button_text TEXT,
      button_url TEXT,
      desktop_image TEXT NOT NULL,
      mobile_image TEXT,
      display_order INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      tag TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Unconditionally remove any legacy banners outside the 5 required collections
  try {
    db.exec("DELETE FROM banners WHERE id IN ('hero-men', 'hero-women');");
  } catch {}

  const countObj = db.prepare('SELECT COUNT(*) as count FROM banners').get() as { count: number };
  if (!countObj || countObj.count < 5) {
    const insertBanner = db.prepare(`
      INSERT OR REPLACE INTO banners (id, title, bangla_title, subtitle, bangla_subtitle, button_text, button_url, desktop_image, mobile_image, display_order, is_active, tag)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // 1. Lungi Banner
    insertBanner.run(
      'hero-lungi',
      'LUNGI COLLECTION',
      'সিরাজগঞ্জ তাঁতের লুঙ্গি',
      '১০০% সুতি, আরামদায়ক ও নিখুঁত বুননের প্রিমিয়াম তাঁতের লুঙ্গি কালেকশন',
      '১০০% সুতি, আরামদায়ক ও নিখুঁত বুননের প্রিমিয়াম তাঁতের লুঙ্গি কালেকশন',
      'লুঙ্গি দেখুন (Shop Lungi)',
      '/category/lungi',
      'https://images.unsplash.com/photo-1607344645866-009c320b5ab8?auto=format&fit=crop&q=80&w=1600',
      'https://images.unsplash.com/photo-1607344645866-009c320b5ab8?auto=format&fit=crop&q=80&w=800',
      1,
      1,
      'Lungi'
    );

    // 2. Saree Banner
    insertBanner.run(
      'hero-saree',
      'SAREE COLLECTION',
      'ঢাকাই জামদানি ও সিল্ক শাড়ি',
      'বাংলার ঐতিহ্যবাহী তাঁত, জামদানি ও সিল্ক শাড়ির অনন্য আভিজাত্য',
      'বাংলার ঐতিহ্যবাহী তাঁত, জামদানি ও সিল্ক শাড়ির অনন্য আভিজাত্য',
      'শাড়ি দেখুন (Shop Saree)',
      '/category/saree',
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=1600',
      'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800',
      2,
      1,
      'Saree'
    );

    // 3. T-Shirt Banner
    insertBanner.run(
      'hero-tshirt',
      'T-SHIRT COLLECTION',
      'প্রিমিয়াম কম্বড কটন টি-শার্ট',
      'রং ও ফেব্রিক গ্যারান্টি সহ আধুনিক ক্যাজুয়াল ও ট্রেন্ডি লুক',
      'রং ও ফেব্রিক গ্যারান্টি সহ আধুনিক ক্যাজুয়াল ও ট্রেন্ডি লুক',
      'টি-শার্ট দেখুন (Shop T-Shirt)',
      '/category/tshirt',
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&q=80&w=1600',
      'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&q=80&w=800',
      3,
      1,
      'T-Shirt'
    );

    // 4. Panjabi Banner
    insertBanner.run(
      'hero-panjabi',
      'PANJABI COLLECTION',
      'রয়েল কটন ও এম্ব্রয়ডারি পাঞ্জাবি',
      'উৎসব ও শুভানুষ্ঠানে আভিজাত্যপূর্ণ প্রিমিয়াম ডিজাইনার পাঞ্জাবি',
      'উৎসব ও শুভানুষ্ঠানে আভিজাত্যপূর্ণ প্রিমিয়াম ডিজাইনার পাঞ্জাবি',
      'পাঞ্জাবি দেখুন (Shop Panjabi)',
      '/category/panjabi',
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=1600',
      'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=800',
      4,
      1,
      'Panjabi'
    );

    // 5. Three Piece Banner
    insertBanner.run(
      'hero-three-piece',
      'THREE PIECE COLLECTION',
      'এক্সক্লুসিভ ডিজাইনার থ্রি-পিস',
      'আভিজাত্যপূর্ণ সুতি ও জর্জেটের দৃষ্টিনন্দন পার্টি ও ক্যাজুয়াল থ্রি-পিস',
      'আভিজাত্যপূর্ণ সুতি ও জর্জেটের দৃষ্টিনন্দন পার্টি ও ক্যাজুয়াল থ্রি-পিস',
      'থ্রি-পিস দেখুন (Shop Three-Piece)',
      '/category/three-piece',
      'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&q=80&w=1600',
      'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&q=80&w=800',
      5,
      1,
      'Three-Piece'
    );
  }
}

// Ensure store_settings table and initial configs
export function ensureStoreSettings() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS store_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const initialSettings: Record<string, any> = {
    home_collections: [
      {
        id: 'col-lungi',
        title: 'Lungi Collection',
        banglaTitle: 'লুঙ্গি কালেকশন',
        subtitle: 'সিরাজগঞ্জের খাঁটি তাঁতের সুতি লুঙ্গি',
        position: 1,
        link: '/category/lungi',
        image: 'https://images.unsplash.com/photo-1607344645866-009c320b5ab8?auto=format&fit=crop&q=80&w=800',
        isActive: true,
      },
      {
        id: 'col-saree',
        title: 'Saree Collection',
        banglaTitle: 'শাড়ি কালেকশন',
        subtitle: 'ঐতিহ্যবাহী জামদানি ও সিল্ক শাড়ি',
        position: 2,
        link: '/category/saree',
        image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800',
        isActive: true,
      },
      {
        id: 'col-tshirt',
        title: 'T-Shirt Collection',
        banglaTitle: 'টি-শার্ট কালেকশন',
        subtitle: '১০০% প্রিমিয়াম সুতি কম্বড ফেব্রিক',
        position: 3,
        link: '/category/tshirt',
        image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&q=80&w=800',
        isActive: true,
      },
      {
        id: 'col-three-piece',
        title: 'Three Piece Collection',
        banglaTitle: 'থ্রি-পিস কালেকশন',
        subtitle: 'ডিজাইনার সুতি ও জর্জেট পার্টি থ্রি-পিস',
        position: 4,
        link: '/category/three-piece',
        image: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&q=80&w=800',
        isActive: true,
      },
      {
        id: 'col-panjabi',
        title: 'Panjabi Collection',
        banglaTitle: 'পাঞ্জাবি কালেকশন',
        subtitle: 'রয়েল কটন ও নিখুঁত এম্ব্রয়ডারি উৎসব পাঞ্জাবি',
        position: 5,
        link: '/category/panjabi',
        image: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=800',
        isActive: true,
      },
    ],
    category_banners: [
      {
        id: 'cat-ban-men',
        categorySlug: 'men',
        title: 'Men Collection Banner',
        banglaTitle: 'পুরুষদের এক্সক্লুসিভ কালেকশন',
        description: 'তাঁতের লুঙ্গি, প্রিমিয়াম পাঞ্জাবি এবং স্মার্ট ক্যাজুয়াল টি-শার্টের সেরা সমাহার',
        desktopImage: 'https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?auto=format&fit=crop&q=80&w=1200',
        isActive: true,
      },
      {
        id: 'cat-ban-women',
        categorySlug: 'women',
        title: 'Women Collection Banner',
        banglaTitle: 'মহিলাদের ঐতিহ্য ও আধুনিক ফ্যাশন',
        description: 'ঢাকাই জামদানি, সুতি ও সিল্ক শাড়ির সাথে আকর্ষণীয় ডিজাইনার থ্রি-পিস',
        desktopImage: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=1200',
        isActive: true,
      },
      {
        id: 'cat-ban-lungi',
        categorySlug: 'lungi',
        title: 'Lungi Banner',
        banglaTitle: 'সিরাজগঞ্জ তাঁতের লুঙ্গি',
        description: '১০০% সুতি, দীর্ঘস্থায়ী আরামদায়ক খাঁটি দেশীয় তাঁতের লুঙ্গি',
        desktopImage: 'https://images.unsplash.com/photo-1607344645866-009c320b5ab8?auto=format&fit=crop&q=80&w=1200',
        isActive: true,
      },
      {
        id: 'cat-ban-saree',
        categorySlug: 'saree',
        title: 'Saree Banner',
        banglaTitle: 'ঐতিহ্যবাহী জামদানি ও তাঁতের শাড়ি',
        description: 'অভিজাত্যের প্রতীক খাঁটি সুতা ও রেশমি তাঁতের শাড়ির সম্ভার',
        desktopImage: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=1200',
        isActive: true,
      },
      {
        id: 'cat-ban-panjabi',
        categorySlug: 'panjabi',
        title: 'Panjabi Banner',
        banglaTitle: 'রয়েল কটন ও এম্ব্রয়ডারি পাঞ্জাবি',
        description: 'উৎসব ও আভিজাত্যের শুভ রঙে প্রিমিয়াম ডিজাইনার পাঞ্জাবি',
        desktopImage: 'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?auto=format&fit=crop&q=80&w=1200',
        isActive: true,
      },
      {
        id: 'cat-ban-tshirt',
        categorySlug: 'tshirt',
        title: 'T-Shirt Banner',
        banglaTitle: 'প্রিমিয়াম কম্বড কটন টি-শার্ট',
        description: '১০০% কটন, প্রি-ওয়াশড এবং টেকসই রঙের আরামদায়ক টি-শার্ট',
        desktopImage: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&q=80&w=1200',
        isActive: true,
      },
      {
        id: 'cat-ban-threepiece',
        categorySlug: 'three-piece',
        title: 'Three Piece Banner',
        banglaTitle: 'ডিজাইনার থ্রি-পিস কালেকশন',
        description: 'আভিজাত্যপূর্ণ সুতি ও জর্জেটের দৃষ্টিনন্দন পার্টি ও ক্যাজুয়াল থ্রি-পিস',
        desktopImage: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&q=80&w=1200',
        isActive: true,
      },
    ],
    offer_config: {
      headline: 'বিশেষ মেগা উৎসব ছাড়!',
      subHeadline: 'সীমিত সময়ের ধামাকা অফার! সরাসরি তাঁতপল্লী থেকে হোম ডেলিভারি। যেকোনো ৩টি পণ্য ক্রয়ে নিশ্চিত বিশেষ উপহার ও ফ্রি শিপিং।',
      targetDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      isActive: true,
    },
    delivery_config: {
      insideSirajganjLabel: 'সিরাজগঞ্জ জেলা (লোকাল ডেলিভারি)',
      insideSirajganjCharge: 70,
      outsideSirajganjLabel: 'সিরাজগঞ্জের বাইরে সারা বাংলাদেশ',
      outsideSirajganjCharge: 130,
      insideDhakaCharge: 70,
      outsideDhakaCharge: 130,
      freeDeliveryThreshold: 2000,
      estimatedInsideDhakaDays: '১-২ দিন',
      estimatedOutsideDhakaDays: '২-৪ দিন',
      estimatedDeliveryDays: '২-৩ দিন',
      freeDeliveryOnOnlinePayment: false,
    },
    payment_config: {
      enableCod: true,
      enableBkash: true,
      bkashNumber: '01712-345678',
      bkashType: 'merchant',
      enableNagad: true,
      nagadNumber: '01812-345678',
      enableRocket: false,
      rocketNumber: '01912-345678',
      enableSslCommerz: false,
      instructions: {
        bkash: 'বিকাশ মার্চেন্ট নাম্বারে পেমেন্ট করুন অথবা সেন্ড মানি করুন। পেমেন্ট শেষে ট্রানজেকশন আইডি (TrxID) প্রদান করুন।',
        nagad: 'নগদ নাম্বারে পেমেন্ট করে প্রাপ্ত TrxID প্রদান করুন।',
        rocket: 'রকেট একাউন্টে পেমেন্ট করুন।',
        cod: 'পণ্য হাতে পেয়ে ডেলিভারিম্যানকে মূল্য পরিশোধ করুন।',
      },
    },
    general_settings: {
      siteName: 'BASTRA SHOILY | বাস্ত্র শৈলী',
      tagline: 'সিরাজগঞ্জের ঐতিহ্যবাহী তাঁত ও আধুনিক ফ্যাশন',
      phone: '+880 1712-345678',
      email: 'support@bastrashoily.com',
      address: 'তাঁতপল্লী রোড, বেলকুচি, সিরাজগঞ্জ, বাংলাদেশ',
      returnPolicyDays: 7,
      facebookUrl: 'https://facebook.com/bastrashoily',
      instagramUrl: 'https://instagram.com/bastrashoily',
      whatsappUrl: 'https://wa.me/8801712345678',
      whatsappNumber: '+8801712345678',
      logoUrl: '',
      youtubeUrl: '',
      copyrightText: '© ২০২৬ বাস্ত্র শৈলী (BASTRA SHOILY) - সর্বস্বত্ব সংরক্ষিত।',
    },
    footer_config: {
      aboutUs: 'বাস্ত্র শৈলী বাংলাদেশের সমৃদ্ধ ঐতিহ্যবাহী সিরাজগঞ্জ ও পাবনার তাঁতের সেরা সুতি লুঙ্গি, প্রিমিয়াম পাঞ্জাবি ও ঢাকাই জামদানি শাড়ির নির্ভরযোগ্য অনলাইন প্রতিষ্ঠান।',
      phone: '+880 1712-345678',
      email: 'support@bastrashoily.com',
      address: 'তাঁতপল্লী রোড, বেলকুচি, সিরাজগঞ্জ, বাংলাদেশ',
      facebookUrl: 'https://facebook.com/bastrashoily',
      instagramUrl: 'https://instagram.com/bastrashoily',
      youtubeUrl: '',
      whatsappUrl: 'https://wa.me/8801712345678',
      privacyPolicy: 'বাস্ত্র শৈলী গ্রাহকদের তথ্যের গোপনীয়তা কঠোরভাবে রক্ষা করে।',
      termsAndConditions: 'সকল তথ্যাদি ও পণ্যের গুণমান খাঁটি ও অথেন্টিক রাখার নিশ্চয়তা দেওয়া হয়।',
      returnPolicy: 'ডেলিভারির সময় চেক করুন। সাইজ বা ফিটিং সমস্যা হলে ৭ দিনের ভেতর সহজ এক্সচেঞ্জ সুবিধা পাবেন।',
      shippingPolicy: 'সিরাজগঞ্জে ২৪ ঘণ্টার মধ্যে এবং দেশের যেকোনো প্রান্তে ২-৩ দিনে নিরাপদ ডেলিভারি।',
      copyrightText: '© ২০২৬ বাস্ত্র শৈলী (BASTRA SHOILY) - সর্বস্বত্ব সংরক্ষিত।',
    },
    seo_config: {
      siteTitle: 'বাস্ত্র শৈলী | ঐতিহ্যবাহী তাঁত ও আধুনিক ফ্যাশন',
      metaDescription: 'খাঁটি সিরাজগঞ্জের তাঁতের সুতি লুঙ্গি, প্রিমিয়াম পাঞ্জাবি, ঢাকাই জামদানি ও সিল্ক শাড়ির নির্ভরযোগ্য অনলাইন শপ।',
      keywords: 'বাস্ত্র শৈলী, bastra shoily, সিরাজগঞ্জের লুঙ্গি, তাঁতের শাড়ি, পাঞ্জাবি, জামদানি',
      ogImage: 'https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?auto=format&fit=crop&q=80&w=1200',
      canonicalUrl: 'https://bastrashoily.com',
      robotsTxt: 'User-agent: *\nAllow: /',
      sitemapEnabled: true,
    },
    courier_config: {
      provider: 'steadfast',
      steadfastApiKey: process.env.STEADFAST_API_KEY || '',
      steadfastSecretKey: process.env.STEADFAST_SECRET_KEY || '',
      steadfastBaseUrl: 'https://portal.steadfast.com.bd/api/v1',
      isSandbox: true,
    },
    invoice_config: {
      headerTitle: 'BASTRA SHOILY',
      headerSubtitle: 'বাস্ত্র শৈলী - ঐতিহ্যবাহী পোশাক ও খাঁটি তাঁত পণ্য',
      authoritySignatureTitle: 'BASTRA SHOILY Authority',
      authorityName: 'Authorized Signature',
      showProductImage: true,
      termsTitle: 'পরামর্শ ও শর্তাবলী:',
      terms: [
        { id: 'term-1', text: 'পণ্য গ্রহণের সময় ডেলিভারি ম্যানের উপস্থিতিতে চেক করে নিন।' },
        { id: 'term-2', text: '৭ দিনের মধ্যে রিটার্ন বা সাইজ এক্সচেঞ্জের সুবিধা রয়েছে।' },
        { id: 'term-3', text: 'কোনো সমস্যা বা তথ্যের জন্য কাস্টমার কেয়ারে যোগাযোগ করুন।' },
      ],
      footerNote: 'আমাদের সাথে কেনাকাটা করার জন্য আন্তরিক ধন্যবাদ!',
      customerServiceNote: 'বাস্ত্র শৈলি ডিজিটাল ইনভয়েস সিস্টেম',
    },
  };

  const getStmt = db.prepare('SELECT key FROM store_settings WHERE key = ?');
  const insertStmt = db.prepare('INSERT INTO store_settings (key, value) VALUES (?, ?)');

  for (const [key, val] of Object.entries(initialSettings)) {
    const exists = getStmt.get(key);
    if (!exists) {
      insertStmt.run(key, JSON.stringify(val));
    }
  }
}

// Initialize on import
initDatabaseSchema();
seedDatabaseIfEmpty();
ensureAdminCredentials();
ensureAllProductsSeeded();
ensureBannersTableAndSeeded();
ensureStoreSettings();
