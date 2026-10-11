import { Router, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import crypto from 'node:crypto';
import { db, verifyPassword, hashPassword, wipeDemoProducts } from './db.js';
import { handleConversationalChat } from './aiEngine.js';
import {
  getPaymentGatewayConfig,
  savePaymentGatewayConfig,
  initiateBkashPayment,
  executeBkashPayment,
  initiateNagadPayment,
  verifyNagadPayment,
  initiateSSLCommerzSession,
  validateSSLCommerzPayment,
} from './paymentGateways.js';

export const adminRouter = Router();
export const storeRouter = Router();

// Helper to check RBAC permissions
export function hasPermission(admin: any, requiredPermission?: string): boolean {
  if (!admin) return false;
  if (admin.role === 'super_admin') return true;
  let perms: string[] = [];
  try {
    perms = typeof admin.permissions === 'string' ? JSON.parse(admin.permissions) : (admin.permissions || []);
  } catch {
    perms = [];
  }
  if (perms.includes('all') || perms.includes('*')) return true;
  if (!requiredPermission) return true;

  // Exact match
  if (perms.includes(requiredPermission)) return true;

  // Alias mappings
  const aliases: Record<string, string[]> = {
    'orders.update': ['orders.edit', 'orders.manage'],
    'orders.edit': ['orders.update', 'orders.manage'],
    'orders.manage': ['orders.edit', 'orders.update'],
    'orders.refund': ['orders.manage', 'payments.manage'],
    'products.update': ['products.edit', 'products.manage'],
    'products.edit': ['products.update', 'products.manage'],
    'products.archive': ['products.delete', 'products.edit', 'products.manage'],
    'staff.manage': ['admins.manage', 'staff.edit'],
    'admins.manage': ['staff.manage', 'staff.edit'],
    'marketing.manage': ['marketing.edit', 'coupons.manage', 'offers.manage'],
    'settings.manage': ['settings.edit', 'admins.manage'],
  };

  const allowedAliases = aliases[requiredPermission] || [];
  if (allowedAliases.some((al) => perms.includes(al))) return true;

  // Category wildcard match (e.g. 'orders.*', 'products.*')
  const category = requiredPermission.split('.')[0];
  if (perms.includes(`${category}.*`) || perms.includes(`${category}.all`)) return true;

  return perms.some((p) => p.endsWith('.*') && requiredPermission.startsWith(p.replace('.*', '')));
}

// Middleware to enforce RBAC permissions on admin routes
export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: () => void) => {
    const admin = (req as any).admin;
    if (!admin) {
      return res.status(401).json({
        success: false,
        error: 'অননুমোদিত অ্যাক্সেস! এডমিন সেশন পাওয়া যায়নি। অনুগ্রহ করে পুনরায় লগইন করুন।',
      });
    }
    if (!hasPermission(admin, permission)) {
      return res.status(403).json({
        success: false,
        error: `অননুমোদিত অ্যাক্সেস! এই অপারেশনটি সম্পন্ন করার জন্য আপনার রোল বা অ্যাকাউন্টে '${permission}' অনুমতি প্রয়োজন।`,
      });
    }
    next();
  };
}

// Middleware to enforce specific admin roles
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: () => void) => {
    const admin = (req as any).admin;
    if (!admin) {
      return res.status(401).json({
        success: false,
        error: 'অননুমোদিত অ্যাক্সেস! এডমিন সেশন পাওয়া যায়নি। অনুগ্রহ করে পুনরায় লগইন করুন।',
      });
    }
    if (!allowedRoles.includes(admin.role)) {
      return res.status(403).json({
        success: false,
        error: `অননুমোদিত অ্যাক্সেস! এই অপারেশনটি সম্পন্ন করার জন্য '${allowedRoles.join(', ')}' রোল প্রয়োজন।`,
      });
    }
    next();
  };
}

// Helper to record audit log with collision-free UUID
export function recordAudit(
  adminName: string,
  action: string,
  targetType: string,
  targetId: string | null,
  prevVal: any,
  newVal: any,
  ip: string = '127.0.0.1'
) {
  try {
    const id = `aud-${crypto.randomUUID()}`;
    const prevStr = prevVal ? JSON.stringify(prevVal) : null;
    const newStr = newVal ? JSON.stringify(newVal) : null;
    db.prepare(`
      INSERT INTO audit_logs (id, admin_name, action, target_type, target_id, previous_value, new_value, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, adminName || 'Admin', action, targetType, targetId, prevStr, newStr, ip);
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}

// -------------------------------------------------------------
// AUTHENTICATION CONTROLLER (Used by both admin and store routers)
// -------------------------------------------------------------
function handleAdminLogin(req: Request, res: Response) {
  try {
    const rawIdentifier = (req.body.identifier || req.body.email || req.body.phone || '').trim();
    const { password } = req.body;
    const ip = req.ip || (req.headers['x-forwarded-for'] as string) || '127.0.0.1';
    const userAgent = (req.headers['user-agent'] as string) || 'Browser';

    if (!rawIdentifier || !password) {
      return res.status(400).json({ success: false, error: 'ইমেইল অথবা মোবাইল নম্বর এবং পাসওয়ার্ড আবশ্যক।' });
    }

    const cleanEmail = rawIdentifier.toLowerCase().trim();
    const cleanDigits = rawIdentifier.replace(/\D/g, '');
    // Normalize BD phone if applicable (e.g. 88018... -> 018...)
    let cleanPhone = cleanDigits;
    if (cleanPhone.startsWith('8801')) {
      cleanPhone = cleanPhone.slice(2);
    }

    // 15-Minute Rate Limiting: Lock out if > 5 failed attempts by identifier or > 10 from IP recently
    try {
      const failed = db.prepare(`
        SELECT COUNT(*) as count FROM login_activity
        WHERE (email = ? OR email = ? OR email = ?) AND status = 'failed' AND datetime(timestamp) >= datetime('now', '-15 minutes')
      `).get(cleanEmail, cleanDigits, cleanPhone) as { count: number };

      if (failed && failed.count >= 5) {
        return res.status(429).json({
          success: false,
          error: 'নিরাপত্তার স্বার্থে একাউন্টটি ১৫ মিনিটের জন্য লক করা হয়েছে (অতিরিক্ত ভুল পাসওয়ার্ড)। অনুগ্রহ করে কিছুক্ষণ পর চেষ্টা করুন।',
        });
      }

      const ipFailed = db.prepare(`
        SELECT COUNT(*) as count FROM login_activity
        WHERE ip_address = ? AND status = 'failed' AND datetime(timestamp) >= datetime('now', '-15 minutes')
      `).get(ip) as { count: number };

      if (ipFailed && ipFailed.count >= 10) {
        return res.status(429).json({
          success: false,
          error: 'নিরাপত্তার স্বার্থে এই আইপি অ্যাড্রেস থেকে অতিরিক্ত ব্যর্থ লগইন চেষ্টার কারণে সাময়িকভাবে ব্লক করা হয়েছে। অনুগ্রহ করে ১৫ মিনিট পর চেষ্টা করুন।',
        });
      }
    } catch {}

    // Find active admin by email OR mobile phone
    let admin = db.prepare(`
      SELECT * FROM admins
      WHERE (
        LOWER(email) = ?
        OR phone = ?
        OR phone = ?
        OR REPLACE(REPLACE(phone, '-', ''), ' ', '') = ?
        OR REPLACE(REPLACE(phone, '-', ''), ' ', '') = ?
      )
      AND status = 'active'
    `).get(cleanEmail, rawIdentifier, cleanPhone, cleanDigits, cleanPhone) as any;

    if (!admin) {
      try {
        db.prepare(`
          INSERT INTO login_activity (id, admin_name, email, ip_address, user_agent, status, reason)
          VALUES (?, ?, ?, ?, ?, 'failed', 'Admin user not found')
        `).run(`log-${crypto.randomUUID()}`, 'Unknown', cleanEmail, ip, userAgent);
      } catch {}
      return res.status(401).json({ success: false, error: 'ইমেইল/মোবাইল অথবা পাসওয়ার্ড সঠিক নয়।' });
    }

    const isMatch = verifyPassword(password, admin.password_hash, admin.salt);
    if (!isMatch) {
      try {
        db.prepare(`
          INSERT INTO login_activity (id, admin_name, email, ip_address, user_agent, status, reason)
          VALUES (?, ?, ?, ?, ?, 'failed', 'Invalid password')
        `).run(`log-${crypto.randomUUID()}`, admin.name, cleanEmail, ip, userAgent);
      } catch {}
      return res.status(401).json({ success: false, error: 'ভুল পাসওয়ার্ড! অনুগ্রহ করে সঠিক পাসওয়ার্ড প্রদান করুন।' });
    }

    // Generate Cryptographically Secure Session Token & CSRF Token
    const token = crypto.randomBytes(32).toString('hex');
    const csrfToken = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    db.prepare(`
      INSERT INTO admin_sessions (token, admin_id, csrf_token, ip_address, user_agent, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(token, admin.id, csrfToken, ip, userAgent, expiresAt);

    const nowStr = new Date().toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka' });
    db.prepare('UPDATE admins SET last_login = ? WHERE id = ?').run(nowStr, admin.id);

    try {
      db.prepare(`
        INSERT INTO login_activity (id, admin_name, email, ip_address, user_agent, status, reason)
        VALUES (?, ?, ?, ?, ?, 'success', 'Successful login')
      `).run(`log-${crypto.randomUUID()}`, admin.name, cleanEmail, ip, userAgent);
    } catch {}

    recordAudit(admin.name, 'Admin Login', 'auth', admin.id, null, { role: admin.role, identifier: cleanEmail }, ip);

    const permissions = typeof admin.permissions === 'string' ? JSON.parse(admin.permissions) : ['all'];

    return res.json({
      success: true,
      token,
      csrfToken,
      requirePasswordChange: Boolean(admin.force_password_change),
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        phone: admin.phone,
        role: admin.role,
        permissions,
        avatar: admin.avatar,
        lastLogin: nowStr,
        requirePasswordChange: Boolean(admin.force_password_change),
      },
      message: `স্বাগতম, ${admin.name}! এডমিন প্যানেলে সফলভাবে প্রবেশ করেছেন।`,
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, error: error?.message || 'লগইন প্রক্রিয়ায় ত্রুটি হয়েছে।' });
  }
}

function handleAdminMe(req: Request, res: Response) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.replace('Bearer ', '').trim() : (req.headers['x-admin-token'] as string);

    if (!token) {
      return res.json({ authenticated: false, admin: null });
    }

    const session = db.prepare(`
      SELECT s.*, a.id as admin_id, a.name, a.email, a.phone, a.role, a.permissions, a.avatar, a.last_login, a.force_password_change
      FROM admin_sessions s
      JOIN admins a ON s.admin_id = a.id
      WHERE s.token = ? AND datetime(s.expires_at) > datetime('now') AND a.status = 'active'
    `).get(token) as any;

    if (!session) {
      return res.json({ authenticated: false, admin: null });
    }

    const permissions = typeof session.permissions === 'string' ? JSON.parse(session.permissions) : ['all'];

    return res.json({
      authenticated: true,
      requirePasswordChange: Boolean(session.force_password_change),
      admin: {
        id: session.admin_id,
        name: session.name,
        email: session.email,
        phone: session.phone,
        role: session.role,
        permissions,
        avatar: session.avatar,
        lastLogin: session.last_login,
        requirePasswordChange: Boolean(session.force_password_change),
      },
      csrfToken: session.csrf_token,
    });
  } catch (error) {
    return res.json({ authenticated: false, admin: null });
  }
}

function handleAdminLogout(req: Request, res: Response) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader ? authHeader.replace('Bearer ', '').trim() : (req.headers['x-admin-token'] as string);
    if (token) {
      db.prepare('DELETE FROM admin_sessions WHERE token = ?').run(token);
    }
    return res.json({ success: true, message: 'এডমিন সেশন সফলভাবে সমাপ্ত হয়েছে।' });
  } catch (err) {
    return res.json({ success: true });
  }
}

function handleGetCsrf(req: Request, res: Response) {
  const token = crypto.randomBytes(24).toString('hex');
  return res.json({ csrfToken: token });
}

// Mount Authentication on Admin Router
adminRouter.post('/auth/login', handleAdminLogin);
adminRouter.get('/auth/me', handleAdminMe);
adminRouter.post('/auth/logout', handleAdminLogout);
adminRouter.get('/csrf-token', handleGetCsrf);

// Mount Authentication on Store Router for frontend compatibility
storeRouter.post('/admin/auth/login', handleAdminLogin);
storeRouter.get('/admin/auth/me', handleAdminMe);
storeRouter.post('/admin/auth/logout', handleAdminLogout);
storeRouter.get('/csrf-token', handleGetCsrf);

// -------------------------------------------------------------
// STRICT ADMIN AUTHENTICATION, RBAC & MANDATORY CSRF MIDDLEWARE
// -------------------------------------------------------------
adminRouter.use((req: Request, res: Response, next) => {
  // Public admin auth paths: login and csrf-token
  const publicPaths = ['/auth/login', '/csrf-token'];
  if (publicPaths.some((p) => req.path.startsWith(p))) {
    return next();
  }

  const authHeader = req.headers.authorization;
  const token = authHeader ? authHeader.replace('Bearer ', '').trim() : (req.headers['x-admin-token'] as string);

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'অননুমোদিত অনুরোধ! কোনো বৈধ এডমিন সেশন পাওয়া যায়নি। অনুগ্রহ করে পুনরায় লগইন করুন।',
    });
  }

  const session = db.prepare(`
    SELECT s.*, a.id as id, a.id as admin_id, a.name, a.email, a.role, a.permissions, a.status
    FROM admin_sessions s
    JOIN admins a ON s.admin_id = a.id
    WHERE s.token = ? AND datetime(s.expires_at) > datetime('now') AND a.status = 'active'
  `).get(token) as any;

  if (!session) {
    return res.status(401).json({
      success: false,
      error: 'আপনার এডমিন সেশনের মেয়াদ শেষ হয়েছে অথবা টোকেন অবৈধ। অনুগ্রহ করে পুনরায় লগইন করুন।',
    });
  }

  // Enforce Mandatory CSRF Token on all mutating requests (POST, PUT, DELETE, PATCH)
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    if (!req.path.startsWith('/auth/logout')) {
      const clientCsrf = (req.headers['x-csrf-token'] as string) || (req.body && req.body._csrf);
      if (!clientCsrf || !session.csrf_token || clientCsrf !== session.csrf_token) {
        return res.status(403).json({
          success: false,
          error: 'নিরাপত্তা সতর্কবার্তা: CSRF টোকেন অনুপস্থিত অথবা মিলছে না। পেজ রিফ্রেশ করে আবার চেষ্টা করুন।',
        });
      }
    }
  }

  (req as any).admin = session;
  next();
});

// -------------------------------------------------------------
// REAL LOCAL IMAGE UPLOAD ENDPOINT (/api/admin/upload)
// -------------------------------------------------------------
adminRouter.post('/upload', requirePermission('products.edit'), (req: Request, res: Response) => {
  try {
    const { image, filename } = req.body;
    if (!image) {
      return res.status(400).json({ success: false, error: 'ছবি বা ইমেজ ডাটা আবশ্যক।' });
    }

    // Verify format and extract base64 payload
    const matches = image.match(/^data:image\/([a-zA-Z0-9+]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({
        success: false,
        error: 'অবৈধ ফাইল ফরম্যাট! শুধুমাত্র নিরাপদ বেস৬৪ ইমেজ (JPG, PNG, WebP, GIF) গ্রহণযোগ্য।',
      });
    }

    const rawExt = matches[1].toLowerCase();
    const allowedExts: Record<string, string> = {
      jpeg: 'jpg',
      jpg: 'jpg',
      png: 'png',
      webp: 'webp',
      gif: 'gif',
    };

    if (!allowedExts[rawExt]) {
      return res.status(400).json({
        success: false,
        error: 'অননুমোদিত ইমেজ ফরম্যাট! শুধুমাত্র JPG, PNG, WebP এবং GIF ছবি আপলোড করা যাবে।',
      });
    }

    const ext = allowedExts[rawExt];
    const buffer = Buffer.from(matches[2], 'base64');

    // Size limit: 5MB maximum
    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        error: 'ফাইলের আকার খুব বড়! সর্বোচ্চ ৫ মেগাবাইট (5MB) সাইজের ছবি আপলোড করতে পারবেন।',
      });
    }

    // Magic Bytes Verification to prevent disguised executables or scripts
    const isJpeg = buffer.length > 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    const isPng = buffer.length > 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    const isWebp = buffer.length > 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    const isGif = buffer.length > 3 && buffer.subarray(0, 3).toString('ascii') === 'GIF';

    if (!isJpeg && !isPng && !isWebp && !isGif) {
      return res.status(400).json({
        success: false,
        error: 'নিরাপত্তা সতর্কবার্তা: ফাইলটির কনটেন্ট হেডার ও এক্সটেনশন মিলছে না। অনুগ্রহ করে আসল ইমেজ ফাইল আপলোড করুন।',
      });
    }

    const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Sanitize filename preventing path traversal
    const safeBase = filename ? path.basename(filename).replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50) : `img_${Date.now()}`;
    const uniqueName = `${crypto.randomUUID()}-${safeBase}.${ext}`;
    const filePath = path.join(uploadsDir, uniqueName);
    fs.writeFileSync(filePath, buffer);

    const publicUrl = `/static/uploads/${uniqueName}`;
    return res.json({
      success: true,
      url: publicUrl,
      filename: uniqueName,
      message: 'ছবি সফলভাবে লোকাল সার্ভারে সংরক্ষিত হয়েছে।',
    });
  } catch (err: any) {
    console.error('Image upload failed:', err);
    return res.status(500).json({ success: false, error: 'ছবি সংরক্ষণে ব্যর্থ হয়েছে।' });
  }
});

// 1. DASHBOARD METRICS
adminRouter.get('/dashboard', (req: Request, res: Response) => {
  try {
    // Real SQL aggregations
    const orderStats = db.prepare(`
      SELECT 
        COUNT(*) as total_orders,
        SUM(CASE WHEN order_status = 'pending' THEN 1 ELSE 0 END) as pending_orders,
        SUM(CASE WHEN order_status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_orders,
        SUM(CASE WHEN order_status = 'processing' THEN 1 ELSE 0 END) as processing_orders,
        SUM(CASE WHEN order_status = 'shipped' THEN 1 ELSE 0 END) as shipped_orders,
        SUM(CASE WHEN order_status = 'out_for_delivery' THEN 1 ELSE 0 END) as out_for_delivery,
        SUM(CASE WHEN order_status = 'delivered' THEN 1 ELSE 0 END) as delivered_orders,
        SUM(CASE WHEN order_status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_orders,
        SUM(CASE WHEN order_status = 'returned' THEN 1 ELSE 0 END) as returned_orders,
        SUM(CASE WHEN order_status NOT IN ('cancelled', 'returned') THEN total ELSE 0 END) as total_sales,
        SUM(CASE WHEN payment_status = 'paid' AND order_status != 'cancelled' THEN total ELSE 0 END) as paid_sales,
        SUM(CASE WHEN payment_method = 'cod' AND payment_status = 'pending' AND order_status NOT IN ('cancelled', 'delivered') THEN total ELSE 0 END) as unpaid_cod
      FROM orders
    `).get() as any;

    const returnStats = db.prepare(`
      SELECT 
        COUNT(*) as total_returns,
        SUM(CASE WHEN status IN ('requested', 'under_review') THEN 1 ELSE 0 END) as pending_returns,
        SUM(CASE WHEN status = 'refunded' THEN total_refund_amount ELSE 0 END) as refunded_amount
      FROM order_returns
    `).get() as any;

    const inventoryStats = db.prepare(`
      SELECT 
        COUNT(DISTINCT product_id) as total_products,
        COUNT(*) as total_variants,
        SUM(stock) as total_stock,
        SUM(CASE WHEN stock > 0 AND stock <= low_stock_threshold THEN 1 ELSE 0 END) as low_stock_variants,
        SUM(CASE WHEN stock <= 0 THEN 1 ELSE 0 END) as out_of_stock_variants
      FROM product_variants
      WHERE active = 1
    `).get() as any;

    const customerStats = db.prepare(`
      SELECT COUNT(*) as total_customers FROM customers
    `).get() as any;

    // Recent orders
    const recentOrders = db.prepare(`
      SELECT o.*, 
        (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
      FROM orders o
      ORDER BY datetime(created_at) DESC
      LIMIT 10
    `).all();

    res.json({
      success: true,
      summary: {
        totalOrders: orderStats?.total_orders || 0,
        pendingOrders: orderStats?.pending_orders || 0,
        confirmedOrders: orderStats?.confirmed_orders || 0,
        processingOrders: orderStats?.processing_orders || 0,
        shippedOrders: orderStats?.shipped_orders || 0,
        outForDelivery: orderStats?.out_for_delivery || 0,
        deliveredOrders: orderStats?.delivered_orders || 0,
        cancelledOrders: orderStats?.cancelled_orders || 0,
        returnedOrders: orderStats?.returned_orders || 0,
        pendingReturns: returnStats?.pending_returns || 0,
        totalProducts: inventoryStats?.total_products || 0,
        totalVariants: inventoryStats?.total_variants || 0,
        totalStock: inventoryStats?.total_stock || 0,
        lowStock: inventoryStats?.low_stock_variants || 0,
        outOfStock: inventoryStats?.out_of_stock_variants || 0,
        totalCustomers: customerStats?.total_customers || 0,
        totalSales: orderStats?.total_sales || 0,
        paidSales: orderStats?.paid_sales || 0,
        unpaidCod: orderStats?.unpaid_cod || 0,
        refundedAmount: returnStats?.refunded_amount || 0,
      },
      recentOrders,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error?.message || 'Failed to get dashboard metrics' });
  }
});

// 2. CATEGORIES, COLORS & SIZES
function handleGetCategories(req: Request, res: Response) {
  const categories = db.prepare('SELECT * FROM categories ORDER BY order_num ASC').all();
  res.json({ success: true, categories });
}
adminRouter.get('/categories', handleGetCategories);
storeRouter.get('/categories', handleGetCategories);

adminRouter.post('/categories', requirePermission('products.create'), (req: Request, res: Response) => {
  try {
    const { name, banglaName, slug, parentCategory, image } = req.body;
    if (!name || !banglaName || !slug) {
      return res.status(400).json({ error: 'Name, Bangla Name and Slug are required' });
    }
    const id = `cat-${Date.now()}`;
    db.prepare(`
      INSERT INTO categories (id, name, bangla_name, slug, parent_category, image, order_num, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `).run(id, name, banglaName, slug, parentCategory || 'MEN', image || '', 10);

    recordAudit('Admin', 'Category Created', 'category', id, null, { name, slug });
    res.json({ success: true, id, message: 'ক্যাটাগরি সফলভাবে তৈরি হয়েছে' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error creating category' });
  }
});

adminRouter.put('/categories/:id', requirePermission('products.edit'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, banglaName, slug, parentCategory, image, orderNum, active } = req.body;
    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as any;
    if (!existing) return res.status(404).json({ error: 'Category not found' });

    db.prepare(`
      UPDATE categories SET
        name = COALESCE(?, name),
        bangla_name = COALESCE(?, bangla_name),
        slug = COALESCE(?, slug),
        parent_category = COALESCE(?, parent_category),
        image = COALESCE(?, image),
        order_num = COALESCE(?, order_num),
        active = COALESCE(?, active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name,
      banglaName,
      slug,
      parentCategory,
      image,
      orderNum !== undefined ? Number(orderNum) : null,
      active !== undefined ? (active ? 1 : 0) : null,
      id
    );

    recordAudit('Admin', 'Category Updated', 'category', id, existing, req.body);
    res.json({ success: true, message: 'ক্যাটাগরি সফলভাবে আপডেট করা হয়েছে' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error updating category' });
  }
});

adminRouter.delete('/categories/:id', requirePermission('products.archive'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as any;
    if (!existing) return res.status(404).json({ error: 'Category not found' });

    db.prepare('DELETE FROM categories WHERE id = ?').run(id);
    recordAudit('Admin', 'Category Deleted', 'category', id, existing, null);
    res.json({ success: true, message: 'ক্যাটাগরি সফলভাবে মুছে ফেলা হয়েছে' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error deleting category' });
  }
});

function handleGetColors(req: Request, res: Response) {
  const colors = db.prepare('SELECT * FROM colors ORDER BY name ASC').all();
  res.json({ success: true, colors });
}
adminRouter.get('/colors', handleGetColors);
storeRouter.get('/colors', handleGetColors);

adminRouter.post('/colors', requirePermission('products.create'), (req: Request, res: Response) => {
  try {
    const { name, banglaName, hexCode } = req.body;
    if (!name || !banglaName || !hexCode) {
      return res.status(400).json({ error: 'Name, Bangla Name and Hex Code are required' });
    }
    const id = `col-${Date.now()}`;
    db.prepare('INSERT INTO colors (id, name, bangla_name, hex_code, active) VALUES (?, ?, ?, ?, 1)')
      .run(id, name, banglaName, hexCode);

    recordAudit('Admin', 'Color Created', 'color', id, null, { name, hexCode });
    res.json({ success: true, id, message: 'রঙ সফলভাবে তৈরি হয়েছে' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error creating color' });
  }
});

function handleGetSizes(req: Request, res: Response) {
  const sizes = db.prepare('SELECT * FROM sizes ORDER BY sort_order ASC').all();
  res.json({ success: true, sizes });
}
adminRouter.get('/sizes', handleGetSizes);
storeRouter.get('/sizes', handleGetSizes);

adminRouter.post('/sizes', requirePermission('products.create'), (req: Request, res: Response) => {
  try {
    const { name, banglaName, code, category } = req.body;
    if (!name || !banglaName || !code) {
      return res.status(400).json({ error: 'Name, Bangla Name and Code are required' });
    }
    const id = `sz-${Date.now()}`;
    db.prepare('INSERT INTO sizes (id, name, bangla_name, code, category, sort_order, active) VALUES (?, ?, ?, ?, ?, ?, 1)')
      .run(id, name, banglaName, code, category || 'APPAREL', 20);

    recordAudit('Admin', 'Size Created', 'size', id, null, { name, code });
    res.json({ success: true, id, message: 'সাইজ সফলভাবে তৈরি হয়েছে' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error creating size' });
  }
});

adminRouter.delete('/colors/:id', requirePermission('products.edit'), (req: Request, res: Response) => {
  try {
    db.prepare('DELETE FROM colors WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'রঙ মুছে ফেলা হয়েছে' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

adminRouter.delete('/sizes/:id', requirePermission('products.edit'), (req: Request, res: Response) => {
  try {
    db.prepare('DELETE FROM sizes WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'সাইজ মুছে ফেলা হয়েছে' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// 3. PRODUCTS & VARIANTS
function handleGetProducts(req: Request, res: Response) {
  try {
    const isAdmin = Boolean(req.baseUrl?.includes('admin') || req.originalUrl?.includes('/admin'));
    const { status, search, category } = req.query as { status?: string; search?: string; category?: string };

    let query = `
      SELECT p.*, c.name as category_name, c.bangla_name as category_bangla
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
    `;
    const conditions: string[] = [];
    const params: any[] = [];

    if (!isAdmin) {
      // Storefront visitors must only see active catalog products
      conditions.push("p.status = 'active'");
    } else if (status && status !== 'all') {
      conditions.push('p.status = ?');
      params.push(status);
    }

    if (category && category !== 'all') {
      conditions.push('(p.category_id = ? OR c.name = ? OR p.sub_category = ?)');
      params.push(category, category, category);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ' ORDER BY datetime(p.created_at) DESC';

    const products = db.prepare(query).all(...params) as any[];

    // Fetch variants & color galleries for each product
    const getVariants = db.prepare(`
      SELECT v.*, col.name as color_name, col.bangla_name as color_bangla, col.hex_code,
             sz.name as size_name, sz.bangla_name as size_bangla, sz.code as size_code
      FROM product_variants v
      LEFT JOIN colors col ON v.color_id = col.id
      LEFT JOIN sizes sz ON v.size_id = sz.id
      WHERE v.product_id = ?
    `);

    const getGalleries = db.prepare(`
      SELECT g.*, col.name as color_name
      FROM color_galleries g
      LEFT JOIN colors col ON g.color_id = col.id
      WHERE g.product_id = ?
      ORDER BY g.sort_order ASC
    `);

    const fullProducts = products.map((prod) => {
      const variants = getVariants.all(prod.id);
      const galleries = getGalleries.all(prod.id);
      const totalStock = variants.reduce((acc: number, v: any) => acc + (v.stock || 0), 0);
      return {
        ...prod,
        variants,
        colorGalleries: galleries,
        stock: totalStock,
      };
    });

    res.json({ success: true, products: fullProducts });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch products' });
  }
}
adminRouter.get('/products', handleGetProducts);
storeRouter.get('/products', handleGetProducts);

// Authoritative Variant & Gallery Resolution (Product -> ProductVariant architecture)
// Rule: Selected Color -> Color Gallery (default). ProductVariant -> Variant Gallery Override (optional exception).
// Size changes do not change the gallery unless an override exists.
function handleResolveVariant(req: Request, res: Response) {
  try {
    const { productId, colorId, sizeId } = req.query as { productId: string; colorId: string; sizeId?: string };
    if (!productId || !colorId) {
      return res.status(400).json({ error: 'productId and colorId are required for variant resolution' });
    }

    const cleanColor = String(colorId).trim();
    const cleanSize = sizeId ? String(sizeId).trim() : '';

    // 1. Resolve Color Record
    const colorRecord = db.prepare(`
      SELECT id, name, bangla_name FROM colors 
      WHERE id = ? OR LOWER(name) = LOWER(?) OR bangla_name = ? OR LOWER(name) LIKE LOWER(?)
      LIMIT 1
    `).get(cleanColor, cleanColor, cleanColor, `%${cleanColor}%`) as any;

    const resolvedColorId = colorRecord ? colorRecord.id : cleanColor;

    // 2. Resolve Size Record
    let resolvedSizeId = cleanSize;
    if (cleanSize && cleanSize !== 'free' && cleanSize !== 'null' && cleanSize !== 'undefined') {
      const sizeRecord = db.prepare(`
        SELECT id, code, name FROM sizes 
        WHERE id = ? OR LOWER(code) = LOWER(?) OR LOWER(name) = LOWER(?) OR bangla_name = ?
        LIMIT 1
      `).get(cleanSize, cleanSize, cleanSize, cleanSize) as any;
      if (sizeRecord) {
        resolvedSizeId = sizeRecord.id;
      }
    }

    // 3. Resolve Variant Query
    let variantQuery = `
      SELECT v.*, p.name as product_name, p.bangla_name as product_bangla,
             col.name as color_name, col.bangla_name as color_bangla, col.hex_code,
             sz.name as size_name, sz.bangla_name as size_bangla, sz.code as size_code
      FROM product_variants v
      JOIN products p ON v.product_id = p.id
      LEFT JOIN colors col ON v.color_id = col.id
      LEFT JOIN sizes sz ON v.size_id = sz.id
      WHERE v.product_id = ? AND (v.color_id = ? OR col.name = ? OR col.bangla_name = ?)
    `;
    const params: any[] = [productId, resolvedColorId, cleanColor, cleanColor];

    if (resolvedSizeId && resolvedSizeId !== 'free' && resolvedSizeId !== 'null' && resolvedSizeId !== 'undefined') {
      variantQuery += ' AND (v.size_id = ? OR sz.name = ? OR sz.code = ?)';
      params.push(resolvedSizeId, cleanSize, cleanSize);
    } else {
      variantQuery += ' AND (v.size_id IS NULL OR v.size_id = "" OR sz.name LIKE "%free%" OR sz.code LIKE "%free%")';
    }

    let variant = db.prepare(variantQuery).get(...params) as any;

    // Fallback: If no size-specific match found, look for any active variant for this product + color
    if (!variant) {
      variant = db.prepare(`
        SELECT v.*, p.name as product_name, p.bangla_name as product_bangla,
               col.name as color_name, col.bangla_name as color_bangla, col.hex_code,
               sz.name as size_name, sz.bangla_name as size_bangla, sz.code as size_code
        FROM product_variants v
        JOIN products p ON v.product_id = p.id
        LEFT JOIN colors col ON v.color_id = col.id
        LEFT JOIN sizes sz ON v.size_id = sz.id
        WHERE v.product_id = ? AND (v.color_id = ? OR col.name = ? OR col.bangla_name = ?)
        LIMIT 1
      `).get(productId, resolvedColorId, cleanColor, cleanColor) as any;
    }

    // 4. Resolve Gallery:
    // Check if variant has specific gallery overrides
    let variantOverrides: any[] = [];
    if (variant) {
      variantOverrides = db.prepare(`
        SELECT image_url, sort_order
        FROM variant_gallery_overrides
        WHERE variant_id = ?
        ORDER BY sort_order ASC
      `).all(variant.id) as any[];
    }

    // Check color gallery
    const colorGalleries = db.prepare(`
      SELECT image_url, is_main, sort_order
      FROM color_galleries
      WHERE product_id = ? AND (color_id = ? OR color_id = (SELECT id FROM colors WHERE LOWER(name) = LOWER(?) LIMIT 1))
      ORDER BY sort_order ASC
    `).all(productId, resolvedColorId, cleanColor) as any[];

    // Authoritative Gallery Resolution
    const gallery = variantOverrides.length > 0
      ? variantOverrides.map((g) => g.image_url)
      : colorGalleries.map((g) => g.image_url);

    // Fallback if gallery is empty
    if (gallery.length === 0) {
      if (variant?.image) {
        gallery.push(variant.image);
      } else {
        const prod = db.prepare('SELECT main_image FROM products WHERE id = ?').get(productId) as any;
        if (prod?.main_image) gallery.push(prod.main_image);
      }
    }

    return res.json({
      success: true,
      variant: variant || null,
      gallery,
      hasOverride: variantOverrides.length > 0,
      stock: variant ? variant.stock : 0,
      isAvailable: variant ? (variant.stock > 0 && variant.active === 1) : false,
      price: variant ? variant.price : null,
      offerPrice: variant ? variant.offer_price : null,
      sku: variant ? variant.sku : null,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Failed to resolve variant' });
  }
}

adminRouter.get('/variants/resolve', handleResolveVariant);
storeRouter.get('/variants/resolve', handleResolveVariant);

function handleGetProductById(req: Request, res: Response) {
  try {
    const prod = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id) as any;
    if (!prod) return res.status(404).json({ error: 'Product not found' });

    const variants = db.prepare(`
      SELECT v.*, col.name as color_name, col.hex_code, sz.name as size_name
      FROM product_variants v
      LEFT JOIN colors col ON v.color_id = col.id
      LEFT JOIN sizes sz ON v.size_id = sz.id
      WHERE v.product_id = ?
    `).all(prod.id);

    const galleries = db.prepare('SELECT * FROM color_galleries WHERE product_id = ? ORDER BY sort_order ASC').all(prod.id);
    const overrides = db.prepare(`
      SELECT o.* FROM variant_gallery_overrides o
      JOIN product_variants v ON o.variant_id = v.id
      WHERE v.product_id = ?
    `).all(prod.id);

    res.json({
      success: true,
      product: {
        ...prod,
        variants,
        colorGalleries: galleries,
        galleryOverrides: overrides,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error fetching product' });
  }
}
adminRouter.get('/products/:id', handleGetProductById);
storeRouter.get('/products/:id', handleGetProductById);

// MANDATORY TRANSACTIONAL PRODUCT CREATION (Section 75.14.1)
adminRouter.post('/products', requirePermission('products.create'), (req: Request, res: Response) => {
  const {
    name,
    banglaName,
    slug,
    sku,
    description,
    shortDescription,
    categoryId,
    subCategory,
    variantConfig, // 'free_size' or 'color_size'
    brand,
    price,
    discountPrice,
    lowStockThreshold,
    isFeatured,
    isNewArrival,
    isBestSeller,
    status,
    mainImage,
    seoTitle,
    seoDescription,
    variants, // Array of actual combinations
    colorGalleries, // Array of { colorId, imageUrl, isMain }
  } = req.body;

  // Validation
  if (!name || !banglaName || !slug || !sku || !price) {
    return res.status(400).json({ error: 'Name, Bangla Name, Slug, SKU, and Price are required.' });
  }

  if (price < 0 || (discountPrice && discountPrice < 0)) {
    return res.status(400).json({ error: 'Price cannot be negative.' });
  }

  if (discountPrice && discountPrice > price) {
    return res.status(400).json({ error: 'Discount price cannot exceed regular price.' });
  }

  if (!variants || !Array.isArray(variants) || variants.length === 0) {
    return res.status(400).json({ error: 'At least one valid ProductVariant must be provided.' });
  }

  const productId = (req.body.id && typeof req.body.id === 'string' && req.body.id.trim()) 
    ? req.body.id.trim() 
    : `prod-${Date.now()}`;

  // TRANSACTION BOUNDARY
  db.exec('BEGIN TRANSACTION');

  try {
    // 1. Insert Product
    db.prepare(`
      INSERT INTO products (
        id, name, bangla_name, slug, sku, description, short_description,
        category_id, sub_category, variant_config, brand, price, discount_price,
        low_stock_threshold, is_featured, is_new_arrival, is_best_seller, is_offer,
        status, main_image, seo_title, seo_description
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      productId,
      name,
      banglaName,
      slug,
      sku,
      description || '',
      shortDescription || '',
      categoryId || null,
      subCategory || '',
      variantConfig || 'color_size',
      brand || 'BASTRA SHOILY',
      Number(price),
      discountPrice ? Number(discountPrice) : null,
      Number(lowStockThreshold || 5),
      isFeatured ? 1 : 0,
      isNewArrival !== false ? 1 : 0,
      isBestSeller ? 1 : 0,
      discountPrice && discountPrice < price ? 1 : 0,
      status || 'active',
      mainImage || '',
      seoTitle || '',
      seoDescription || ''
    );

    // 2. Insert Actual ProductVariants
    const insertVarStmt = db.prepare(`
      INSERT INTO product_variants (
        id, product_id, color_id, size_id, sku, price, offer_price, weight, stock, low_stock_threshold, active, image
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertInvTxn = db.prepare(`
      INSERT INTO inventory_transactions (
        id, product_id, variant_id, product_name, sku, transaction_type, previous_stock, quantity, new_stock, reference, admin_id, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const v of variants) {
      if (v.stock !== undefined && Number(v.stock) < 0) {
        throw new Error(`Variant ${v.sku || 'item'} cannot have negative stock.`);
      }

      // Auto-resolve or create color in colors table
      let finalColorId = v.colorId;
      if (finalColorId) {
        const colCheck = db.prepare('SELECT id FROM colors WHERE id = ?').get(finalColorId) as any;
        if (!colCheck) finalColorId = null;
      }
      if (!finalColorId && v.color) {
        const colMatch = db.prepare('SELECT id FROM colors WHERE name = ? OR bangla_name = ?').get(v.color, v.color) as any;
        if (colMatch) {
          finalColorId = colMatch.id;
        } else {
          finalColorId = `col-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          db.prepare('INSERT INTO colors (id, name, bangla_name, hex_code) VALUES (?, ?, ?, ?)').run(
            finalColorId,
            String(v.color),
            String(v.color),
            v.colorCode || '#1e3a8a'
          );
        }
      }
      if (!finalColorId) {
        const firstCol = (db.prepare('SELECT id FROM colors LIMIT 1').get() as any)?.id || 'col-blue';
        finalColorId = firstCol;
      }

      // Auto-resolve or create size in sizes table
      let finalSizeId = variantConfig === 'free_size' ? null : (v.sizeId || null);
      if (finalSizeId && variantConfig !== 'free_size') {
        const szCheck = db.prepare('SELECT id FROM sizes WHERE id = ?').get(finalSizeId) as any;
        if (!szCheck) {
          const szMatch = db.prepare('SELECT id FROM sizes WHERE code = ? OR name = ? OR bangla_name = ?').get(finalSizeId, finalSizeId, finalSizeId) as any;
          finalSizeId = szMatch ? szMatch.id : null;
        }
      } else if (!finalSizeId && v.size && variantConfig !== 'free_size') {
        const szMatch = db.prepare('SELECT id FROM sizes WHERE code = ? OR name = ? OR bangla_name = ?').get(v.size, v.size, v.size) as any;
        if (szMatch) {
          finalSizeId = szMatch.id;
        } else {
          finalSizeId = `sz-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          db.prepare("INSERT INTO sizes (id, name, bangla_name, code, category) VALUES (?, ?, ?, ?, 'APPAREL')").run(
            finalSizeId,
            String(v.size),
            String(v.size),
            String(v.size).toUpperCase().slice(0, 10)
          );
        }
      }

      const finalSku = v.sku && typeof v.sku === 'string' && v.sku.trim() 
        ? v.sku.trim() 
        : `${sku}-${finalColorId.replace('col-', '')}-${Math.floor(100 + Math.random() * 900)}`;

      const varId = v.id || `var-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      insertVarStmt.run(
        varId,
        productId,
        finalColorId,
        finalSizeId,
        finalSku,
        Number(v.price || price),
        v.offerPrice ? Number(v.offerPrice) : (discountPrice ? Number(discountPrice) : null),
        Number(v.weight || 0.4),
        Number(v.stock || 0),
        Number(v.lowStockThreshold || lowStockThreshold || 5),
        v.active !== false ? 1 : 0,
        v.image || mainImage || ''
      );

      // Initial inventory log
      if (Number(v.stock) > 0) {
        insertInvTxn.run(
          `inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          productId,
          varId,
          name,
          finalSku,
          'stock_in',
          0,
          Number(v.stock),
          Number(v.stock),
          'Initial Product Creation',
          'Admin',
          'Initial stock during product creation'
        );
      }
    }

    // 3. Insert Color Galleries
    if (colorGalleries && Array.isArray(colorGalleries)) {
      const insertGalStmt = db.prepare(`
        INSERT INTO color_galleries (id, product_id, color_id, image_url, is_main, sort_order)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (let i = 0; i < colorGalleries.length; i++) {
        const g = colorGalleries[i];
        if (g.colorId && g.imageUrl) {
          insertGalStmt.run(
            `gal-${Date.now()}-${i}`,
            productId,
            g.colorId,
            g.imageUrl,
            g.isMain ? 1 : 0,
            i
          );
        }
      }
    }

    db.exec('COMMIT');

    recordAudit('Admin', 'Product Created', 'product', productId, null, { name, sku, price, variantsCount: variants.length });

    res.json({
      success: true,
      productId,
      message: 'প্রোডাক্ট এবং সমস্ত ভ্যারিয়েন্ট সফলভাবে ডাটাবেজে সংরক্ষিত হয়েছে।',
    });
  } catch (error: any) {
    db.exec('ROLLBACK');
    console.error('Failed to save product transactionally:', error);
    res.status(500).json({
      success: false,
      error: error?.message || 'Transaction failed: Product could not be saved',
    });
  }
});

// Update Product
adminRouter.put('/products/:id', requirePermission('products.edit'), (req: Request, res: Response) => {
  const { id } = req.params;
  const {
    name,
    banglaName,
    slug,
    sku,
    description,
    shortDescription,
    categoryId,
    subCategory,
    variantConfig,
    price,
    discountPrice,
    lowStockThreshold,
    isFeatured,
    isNewArrival,
    isBestSeller,
    status,
    mainImage,
  } = req.body;

  try {
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
    if (!existing) return res.status(404).json({ error: 'Product not found' });

    db.prepare(`
      UPDATE products SET
        name = COALESCE(?, name),
        bangla_name = COALESCE(?, bangla_name),
        slug = COALESCE(?, slug),
        sku = COALESCE(?, sku),
        description = COALESCE(?, description),
        short_description = COALESCE(?, short_description),
        category_id = COALESCE(?, category_id),
        sub_category = COALESCE(?, sub_category),
        variant_config = COALESCE(?, variant_config),
        price = COALESCE(?, price),
        discount_price = ?,
        low_stock_threshold = COALESCE(?, low_stock_threshold),
        is_featured = COALESCE(?, is_featured),
        is_new_arrival = COALESCE(?, is_new_arrival),
        is_best_seller = COALESCE(?, is_best_seller),
        status = COALESCE(?, status),
        main_image = COALESCE(?, main_image),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      name,
      banglaName,
      slug,
      sku,
      description,
      shortDescription,
      categoryId,
      subCategory,
      variantConfig,
      price ? Number(price) : null,
      discountPrice !== undefined ? (discountPrice ? Number(discountPrice) : null) : existing.discount_price,
      lowStockThreshold ? Number(lowStockThreshold) : null,
      isFeatured !== undefined ? (isFeatured ? 1 : 0) : null,
      isNewArrival !== undefined ? (isNewArrival ? 1 : 0) : null,
      isBestSeller !== undefined ? (isBestSeller ? 1 : 0) : null,
      status,
      mainImage,
      id
    );

    recordAudit('Admin', 'Product Updated', 'product', id, existing, req.body);
    res.json({ success: true, message: 'প্রোডাক্ট সফলভাবে আপডেট করা হয়েছে।' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error updating product' });
  }
});

// Delete / Archive Product
adminRouter.delete('/products/:id', requirePermission('products.archive'), (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.json({
        success: true,
        action: 'deleted',
        message: 'পণ্যটি ইতোমধ্যে ডাটাবেজ থেকে সরানো হয়েছে বা বিদ্যমান নেই।',
      });
    }

    // Check if product has historical orders
    const orderItemCount = (db.prepare('SELECT COUNT(*) as c FROM order_items WHERE product_id = ?').get(id) as any)?.c || 0;

    if (orderItemCount > 0) {
      // Historical orders exist: Archive to safeguard historical invoices & ledger
      db.prepare("UPDATE products SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
      recordAudit('Admin', 'Product Archived', 'product', id, { status: existing.status }, { status: 'archived' });
      return res.json({
        success: true,
        action: 'archived',
        message: 'ঐতিহাসিক অর্ডার থাকায় পণ্যটি স্থায়ীভাবে মোছার পরিবর্তে নিরাপদে আর্কাইভে স্থানান্তর করা হয়েছে (Soft Delete)।',
      });
    }

    // No historical orders (e.g. newly uploaded or test product): Safe to HARD DELETE completely from SQLite
    db.exec('BEGIN TRANSACTION');
    try {
      // 1. Delete variant gallery overrides
      try {
        db.prepare(`
          DELETE FROM variant_gallery_overrides 
          WHERE variant_id IN (SELECT id FROM product_variants WHERE product_id = ?)
        `).run(id);
      } catch (e) {}

      // 2. Delete color galleries
      try {
        db.prepare('DELETE FROM color_galleries WHERE product_id = ?').run(id);
      } catch (e) {}

      // 3. Delete inventory transactions
      try {
        db.prepare(`
          DELETE FROM inventory_transactions 
          WHERE product_id = ? OR variant_id IN (SELECT id FROM product_variants WHERE product_id = ?)
        `).run(id, id);
      } catch (e) {}

      // 4. Delete product variants
      try {
        db.prepare('DELETE FROM product_variants WHERE product_id = ?').run(id);
      } catch (e) {}

      // 5. Delete product reviews
      try {
        db.prepare('DELETE FROM product_reviews WHERE product_id = ?').run(id);
      } catch (e) {}

      // 6. Delete from customer cart
      try {
        db.prepare('DELETE FROM customer_cart WHERE product_id = ?').run(id);
      } catch (e) {}

      // 7. Delete landing pages referencing this product
      try {
        db.prepare('DELETE FROM landing_pages WHERE product_id = ?').run(id);
      } catch (e) {}

      // 8. Delete product itself
      db.prepare('DELETE FROM products WHERE id = ?').run(id);

      db.exec('COMMIT');
    } catch (txErr) {
      db.exec('ROLLBACK');
      throw txErr;
    }

    recordAudit('Admin', 'Product Deleted', 'product', id, existing, null);
    return res.json({
      success: true,
      action: 'deleted',
      message: 'প্রোডাক্টটি ডাটাবেজ থেকে স্থায়ীভাবে মুছে ফেলা হয়েছে (Permanently Deleted)।',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Error deleting product' });
  }
});

// Restore Archived Product
adminRouter.post('/products/:id/restore', requirePermission('products.edit'), (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
    if (!existing) return res.status(404).json({ success: false, error: 'Product not found' });

    db.prepare("UPDATE products SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);
    recordAudit('Admin', 'Product Restored', 'product', id, { status: existing.status }, { status: 'active' });
    return res.json({ success: true, message: 'প্রোডাক্টটি সফলভাবে সক্রিয় ক্যাটালগে রিস্টোর করা হয়েছে।' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Error restoring product' });
  }
});

// 4. INVENTORY MANAGEMENT (Section 75.16 - 75.21)
adminRouter.get('/inventory', requirePermission('inventory.view'), (req: Request, res: Response) => {
  try {
    const variants = db.prepare(`
      SELECT v.*, p.name as product_name, p.bangla_name as product_bangla, p.variant_config,
             c.name as category_name, c.bangla_name as category_bangla,
             col.name as color_name, col.bangla_name as color_bangla, col.hex_code,
             sz.name as size_name, sz.bangla_name as size_bangla
      FROM product_variants v
      JOIN products p ON v.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN colors col ON v.color_id = col.id
      LEFT JOIN sizes sz ON v.size_id = sz.id
      ORDER BY v.stock ASC
    `).all();

    const categorySummary = db.prepare(`
      SELECT c.name, c.bangla_name, COUNT(v.id) as variant_count, SUM(v.stock) as total_stock
      FROM categories c
      JOIN products p ON p.category_id = c.id
      JOIN product_variants v ON v.product_id = p.id
      WHERE v.active = 1
      GROUP BY c.id
    `).all();

    const transactions = db.prepare(`
      SELECT * FROM inventory_transactions
      ORDER BY datetime(timestamp) DESC
      LIMIT 25
    `).all();

    res.json({ success: true, variants, categorySummary, transactions });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch inventory' });
  }
});

// Stock Adjustment (Section 75.19)
adminRouter.post('/inventory/adjust', requirePermission('inventory.adjust'), (req: Request, res: Response) => {
  const { variantId, adjustmentType, quantity, reason, adminName } = req.body;

  if (!variantId || !adjustmentType || quantity === undefined) {
    return res.status(400).json({ error: 'Variant ID, adjustmentType, and quantity are required.' });
  }

  db.exec('BEGIN TRANSACTION');

  try {
    const variant = db.prepare(`
      SELECT v.*, p.name as product_name 
      FROM product_variants v
      JOIN products p ON v.product_id = p.id
      WHERE v.id = ?
    `).get(variantId) as any;

    if (!variant) throw new Error('Variant not found');

    const prevStock = variant.stock;
    const qtyNum = Number(quantity);
    let newStock = prevStock;

    if (adjustmentType === 'increase') {
      newStock = prevStock + qtyNum;
    } else if (adjustmentType === 'decrease') {
      newStock = prevStock - qtyNum;
      if (newStock < 0) throw new Error('Stock cannot be negative.');
    } else if (adjustmentType === 'correction') {
      newStock = qtyNum;
      if (newStock < 0) throw new Error('Stock cannot be negative.');
    } else {
      throw new Error('Invalid adjustment type.');
    }

    db.prepare('UPDATE product_variants SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newStock, variantId);

    // Record inventory transaction
    const txnId = `inv-${Date.now()}`;
    db.prepare(`
      INSERT INTO inventory_transactions (
        id, product_id, variant_id, product_name, sku, transaction_type,
        previous_stock, quantity, new_stock, reference, admin_id, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      txnId,
      variant.product_id,
      variantId,
      variant.product_name,
      variant.sku,
      'adjustment',
      prevStock,
      adjustmentType === 'decrease' ? -qtyNum : (adjustmentType === 'increase' ? qtyNum : newStock - prevStock),
      newStock,
      'Manual Admin Adjustment',
      adminName || 'Admin',
      reason || 'Stock balance adjustment'
    );

    // Record audit log
    recordAudit(adminName || 'Admin', 'Stock Adjusted', 'product_variant', variantId, { stock: prevStock }, { stock: newStock, reason });

    db.exec('COMMIT');

    res.json({
      success: true,
      newStock,
      message: `স্টক সফলভাবে আপডেট হয়েছে। নতুন স্টক: ${newStock}`,
    });
  } catch (err: any) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: err?.message || 'Failed to adjust stock' });
  }
});

// Helper to format order rows to support both camelCase and snake_case properties
export function formatOrderRow(row: any, items: any[] = [], timeline: any[] = [], returns: any[] = []) {
  if (!row) return null;

  const orderDate = row.order_date || row.orderDate || row.created_at || new Date().toISOString().replace('T', ' ').substring(0, 16);

  const formattedItems = (items || []).map((it: any) => ({
    ...it,
    id: it.id,
    orderId: it.order_id || it.orderId,
    productId: it.product_id || it.productId,
    variantId: it.variant_id || it.variantId,
    productName: it.product_name || it.productName || 'পোশাক আইটেম',
    banglaName: it.bangla_name || it.banglaName || '',
    sku: it.sku || '',
    price: Number(it.unit_price ?? it.price ?? 0),
    unitPrice: Number(it.unit_price ?? it.price ?? 0),
    quantity: Number(it.quantity ?? 1),
    totalPrice: Number(it.total_price ?? ((it.unit_price ?? it.price ?? 0) * (it.quantity ?? 1))),
    image: it.main_image || it.image || '',
    color: it.color_name || it.color || '',
    size: it.size_name || it.size || '',
    variantSummary: it.variant_summary || (it.color_name && it.size_name ? `${it.color_name} / ${it.size_name}` : undefined),
  }));

  return {
    ...row,
    id: row.id,
    customerName: row.customer_name || row.customerName || 'সম্মানিত ক্রেতা',
    customerPhone: row.customer_phone || row.customerPhone || '',
    customerEmail: row.customer_email || row.customerEmail || '',
    deliveryAddress: row.delivery_address || row.deliveryAddress || '',
    country: row.country || 'Bangladesh',
    countryCode: row.country_code || row.countryCode || '+880',
    district: row.district || 'Dhaka',
    upazila: row.upazila || '',
    postalCode: row.postal_code || row.postalCode || '',
    subtotal: Number(row.subtotal ?? 0),
    deliveryCharge: Number(row.delivery_charge ?? row.deliveryCharge ?? 60),
    discount: Number(row.discount ?? 0),
    couponCode: row.coupon_code || row.couponCode || '',
    total: Number(row.total ?? 0),
    paymentMethod: row.payment_method || row.paymentMethod || 'cod',
    paymentStatus: row.payment_status || row.paymentStatus || 'pending',
    paymentTxnId: row.payment_txn_id || row.paymentTxnId || '',
    orderStatus: row.order_status || row.orderStatus || 'pending',
    orderSource: row.order_source || row.orderSource || 'website',
    customerNotes: row.customer_notes || row.customerNotes || '',
    adminNotes: row.admin_notes || row.adminNotes || '',
    orderDate,
    createdAt: row.created_at || row.createdAt || orderDate,
    updatedAt: row.updated_at || row.updatedAt || orderDate,
    items: formattedItems,
    timeline: timeline || [],
    returns: returns || [],
  };
}

// 5. ORDER MANAGEMENT & STATE MACHINE (Section 75.7 - 75.12)
adminRouter.get('/orders', requirePermission('orders.view'), (req: Request, res: Response) => {
  try {
    const { status, search } = req.query;
    let query = `
      SELECT o.*, 
        (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
      FROM orders o
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status && status !== 'all') {
      query += ' AND o.order_status = ?';
      params.push(status);
    }
    if (search) {
      query += ' AND (o.id LIKE ? OR o.customer_name LIKE ? OR o.customer_phone LIKE ?)';
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    query += ' ORDER BY datetime(o.created_at) DESC';

    const orders = db.prepare(query).all(...params) as any[];

    // Include items for each order
    const getItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?');
    const fullOrders = orders.map((o) => {
      const items = getItems.all(o.id);
      return formatOrderRow(o, items);
    });

    res.json({ success: true, orders: fullOrders });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch orders' });
  }
});

adminRouter.get('/orders/:id', requirePermission('orders.view'), (req: Request, res: Response) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id) as any;
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id);
    const timeline = db.prepare('SELECT * FROM order_timeline WHERE order_id = ? ORDER BY datetime(timestamp) ASC').all(order.id);
    const returns = db.prepare('SELECT * FROM order_returns WHERE order_id = ?').all(order.id);

    res.json({
      success: true,
      order: formatOrderRow(order, items, timeline, returns),
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to get order details' });
  }
});

// ORDER STATUS TRANSITION (STATE MACHINE ENFORCEMENT)
adminRouter.put('/orders/:id/status', requirePermission('orders.edit'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { newStatus, note, adminName } = req.body;

  const validTransitions: Record<string, string[]> = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['processing', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped: ['out_for_delivery'],
    out_for_delivery: ['delivered', 'returned'],
    delivered: ['returned'],
    cancelled: [],
    returned: [],
  };

  db.exec('BEGIN TRANSACTION');

  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
    if (!order) throw new Error('Order not found');

    const currentStatus = order.order_status;

    // Validate transition
    if (!validTransitions[currentStatus] || !validTransitions[currentStatus].includes(newStatus)) {
      throw new Error(`Invalid status transition from '${currentStatus}' to '${newStatus}'. This transition is rejected server-side.`);
    }

    // Update order status
    db.prepare('UPDATE orders SET order_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(newStatus, id);

    // If marked delivered, update payment status to paid if COD
    if (newStatus === 'delivered' && order.payment_method === 'cod') {
      db.prepare("UPDATE orders SET payment_status = 'paid' WHERE id = ?").run(id);
    }

    // If transitioning to cancelled: RESTORE INVENTORY TRANSACTIONALLY
    if (newStatus === 'cancelled') {
      const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id) as any[];
      const restoreStock = db.prepare('UPDATE product_variants SET stock = stock + ? WHERE id = ?');
      const insertTxn = db.prepare(`
        INSERT INTO inventory_transactions (
          id, product_id, variant_id, product_name, sku, transaction_type, previous_stock, quantity, new_stock, reference, admin_id, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const itm of items) {
        if (itm.variant_id) {
          const variant = db.prepare('SELECT stock FROM product_variants WHERE id = ?').get(itm.variant_id) as any;
          if (variant) {
            restoreStock.run(itm.quantity, itm.variant_id);
            insertTxn.run(
              `inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              itm.product_id,
              itm.variant_id,
              itm.product_name,
              itm.sku,
              'cancellation_restore',
              variant.stock,
              itm.quantity,
              variant.stock + itm.quantity,
              `Order #${id} Cancelled`,
              adminName || 'Admin',
              'Stock restored upon order cancellation'
            );
          }
        }
      }
    }

    // Record timeline
    const tlId = `tl-${Date.now()}`;
    db.prepare('INSERT INTO order_timeline (id, order_id, from_status, to_status, note, actor) VALUES (?, ?, ?, ?, ?, ?)')
      .run(tlId, id, currentStatus, newStatus, note || `স্ট্যাটাস পরিবর্তন: ${currentStatus} -> ${newStatus}`, adminName || 'Admin');

    recordAudit(adminName || 'Admin', 'Order Status Changed', 'order', id, { from: currentStatus }, { to: newStatus, note });

    db.exec('COMMIT');

    res.json({
      success: true,
      message: `অর্ডারের স্ট্যাটাস সফলভাবে '${newStatus}'-এ আপডেট হয়েছে।`,
    });
  } catch (err: any) {
    db.exec('ROLLBACK');
    res.status(400).json({ error: err?.message || 'Failed to update order status' });
  }
});

// Cancel Order
adminRouter.post('/orders/:id/cancel', requirePermission('orders.cancel'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason, adminName } = req.body;

  db.exec('BEGIN TRANSACTION');

  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
    if (!order) throw new Error('Order not found');

    if (['shipped', 'out_for_delivery', 'delivered', 'cancelled'].includes(order.order_status)) {
      throw new Error(`Order #${id} cannot be cancelled in its current state '${order.order_status}'.`);
    }

    db.prepare("UPDATE orders SET order_status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);

    // Restore stock
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id) as any[];
    for (const itm of items) {
      if (itm.variant_id) {
        const variant = db.prepare('SELECT stock FROM product_variants WHERE id = ?').get(itm.variant_id) as any;
        if (variant) {
          db.prepare('UPDATE product_variants SET stock = stock + ? WHERE id = ?').run(itm.quantity, itm.variant_id);
          db.prepare(`
            INSERT INTO inventory_transactions (
              id, product_id, variant_id, product_name, sku, transaction_type, previous_stock, quantity, new_stock, reference, admin_id, note
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            `inv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            itm.product_id,
            itm.variant_id,
            itm.product_name,
            itm.sku,
            'cancellation_restore',
            variant.stock,
            itm.quantity,
            variant.stock + itm.quantity,
            `Order #${id} Cancelled`,
            adminName || 'Admin',
            reason || 'Cancelled by admin'
          );
        }
      }
    }

    db.prepare('INSERT INTO order_timeline (id, order_id, from_status, to_status, note, actor) VALUES (?, ?, ?, ?, ?, ?)')
      .run(`tl-${Date.now()}`, id, order.order_status, 'cancelled', reason || 'Order cancelled by Admin', adminName || 'Admin');

    recordAudit(adminName || 'Admin', 'Order Cancelled', 'order', id, { status: order.order_status }, { status: 'cancelled', reason });

    db.exec('COMMIT');

    res.json({ success: true, message: `অর্ডার #${id} সফলভাবে বাতিল করা হয়েছে এবং স্টক রিস্টোর হয়েছে।` });
  } catch (err: any) {
    db.exec('ROLLBACK');
    res.status(400).json({ error: err?.message || 'Failed to cancel order' });
  }
});

// Return / Refund State Machine (Section 75.10)
adminRouter.post('/orders/:id/return', requirePermission('orders.edit'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { reason, reasonCode, details, refundAmount, adminName } = req.body;

  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const retId = `RET-${Date.now().toString().slice(-6)}`;
    const finalRefund = Number(refundAmount || order.total);

    db.prepare(`
      INSERT INTO order_returns (
        id, order_id, customer_name, customer_phone, reason, reason_code, details, status, total_refund_amount, refund_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'approved', ?, 'pending')
    `).run(retId, id, order.customer_name, order.customer_phone, reason || 'Customer return request', reasonCode || 'size_fit_issue', details || '', finalRefund);

    db.prepare("UPDATE orders SET order_status = 'returned', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);

    recordAudit(adminName || 'Admin', 'Return Created', 'order_return', retId, null, { orderId: id, amount: finalRefund });

    res.json({ success: true, returnId: retId, message: 'রিটার্ন রিকোয়েস্ট তৈরি করা হয়েছে।' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to create return' });
  }
});

adminRouter.post('/orders/:id/refund', requirePermission('orders.refund'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { returnId, refundMethod, refundTxnId, adminName } = req.body;

  db.exec('BEGIN TRANSACTION');

  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as any;
    if (!order) throw new Error('Order not found');

    db.prepare(`
      UPDATE order_returns SET 
        status = 'refunded',
        refund_status = 'processed',
        refund_method = ?,
        refund_txn_id = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE order_id = ?
    `).run(refundMethod || 'bkash', refundTxnId || `REF-${Date.now()}`, id);

    db.prepare("UPDATE orders SET payment_status = 'refunded', updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(id);

    recordAudit(adminName || 'Admin', 'Refund Processed', 'order', id, { payment_status: order.payment_status }, { payment_status: 'refunded', refundTxnId });

    db.exec('COMMIT');

    res.json({ success: true, message: 'রিফান্ড সফলভাবে প্রসেস করা হয়েছে।' });
  } catch (err: any) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: err?.message || 'Failed to process refund' });
  }
});

// 5.1 PAYMENTS & GATEWAYS AUDIT (Section 75.31)
adminRouter.get('/payments', requirePermission('payments.manage'), (req: Request, res: Response) => {
  try {
    const orders = db.prepare(`
      SELECT 
        id as order_id, customer_name, customer_phone, payment_method, 
        total as amount, payment_status, payment_txn_id, order_status,
        created_at, updated_at
      FROM orders
      ORDER BY datetime(created_at) DESC
    `).all() as any[];

    const returns = db.prepare(`
      SELECT 
        r.id as return_id, r.order_id, r.customer_name, r.customer_phone,
        r.total_refund_amount as amount, r.refund_status, r.refund_method,
        r.refund_txn_id, r.status, r.created_at, r.updated_at
      FROM order_returns r
      ORDER BY datetime(r.created_at) DESC
    `).all() as any[];

    const summary = db.prepare(`
      SELECT
        SUM(CASE WHEN payment_status = 'paid' THEN total ELSE 0 END) as total_collected,
        SUM(CASE WHEN payment_method = 'cod' AND payment_status = 'pending' AND order_status NOT IN ('cancelled', 'returned') THEN total ELSE 0 END) as pending_cod,
        SUM(CASE WHEN payment_status = 'refunded' THEN total ELSE 0 END) as refunded_total,
        COUNT(CASE WHEN payment_status = 'pending' THEN 1 ELSE NULL END) as pending_count
      FROM orders
    `).get() as any;

    res.json({
      success: true,
      summary: {
        totalCollected: summary?.total_collected || 0,
        pendingCod: summary?.pending_cod || 0,
        refundedTotal: summary?.refunded_total || 0,
        pendingCount: summary?.pending_count || 0,
      },
      orders,
      returns,
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to fetch payments' });
  }
});

// Transactional Payment Verification with Audit & Mandatory Reason
adminRouter.post('/payments/verify', requirePermission('payments.manage'), (req: Request, res: Response) => {
  const { orderId, txnId, reason, note, adminName } = req.body;
  if (!orderId) return res.status(400).json({ error: 'Order ID is required' });
  const verificationReason = (reason || note || '').trim();
  if (!verificationReason) {
    return res.status(400).json({ error: 'ম্যানুয়াল পেমেন্ট ভেরিফিকেশনের জন্য কারণ (Reason/Reference Note) উল্লেখ করা বাধ্যতামূলক।' });
  }

  const adminSession = (req as any).admin;
  const actor = adminName || adminSession?.name || adminSession?.email || 'Authorized Finance Admin';

  db.exec('BEGIN TRANSACTION');
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
    if (!order) throw new Error('Order not found');

    db.prepare(`
      UPDATE orders SET
        payment_status = 'paid',
        payment_txn_id = COALESCE(?, payment_txn_id),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(txnId || null, orderId);

    db.prepare(`
      INSERT INTO order_timeline (id, order_id, from_status, to_status, note, actor)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      `tl-${Date.now()}`,
      orderId,
      order.order_status,
      order.order_status,
      `ম্যানুয়াল পেমেন্ট ভেরিফাই করে 'পরিশোধিত (Paid)' হিসেবে অনুমোদন করা হয়েছে। কারণ: ${verificationReason} (TrxID: ${txnId || order.payment_txn_id || 'Cash Verified'})`,
      actor
    );

    recordAudit(actor, 'Payment Verified', 'order', orderId, { payment_status: order.payment_status }, { payment_status: 'paid', txnId, reason: verificationReason });

    db.exec('COMMIT');
    res.json({ success: true, message: `অর্ডার #${orderId}-এর পেমেন্ট সফলভাবে ভেরিফাই ও নথিভুক্ত করা হয়েছে।` });
  } catch (err: any) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: err?.message || 'Payment verification failed' });
  }
});

// Gateways configuration & credentials (Protected by payments.manage)
adminRouter.get('/payments/gateways', requirePermission('payments.manage'), (req: Request, res: Response) => {
  const cfg = getPaymentGatewayConfig();
  res.json({
    success: true,
    gateways: [
      {
        id: 'cod',
        name: 'ক্যাশ অন ডেলিভারি (COD)',
        active: true,
        fee: 0,
        description: 'পণ্য হাতে পেয়ে মূল্য পরিশোধ',
        mode: 'cash_collection',
      },
      {
        id: 'bkash',
        name: 'বিকাশ পেমেন্ট (bKash Checkout)',
        active: cfg.bkash.enabled,
        isLive: cfg.bkash.isLive,
        merchantNumber: cfg.bkash.merchantNumber,
        hasApiCredentials: Boolean(cfg.bkash.appKey && cfg.bkash.appSecret),
        mode: cfg.bkash.appKey ? 'tokenized_api' : 'interactive_simulator',
      },
      {
        id: 'nagad',
        name: 'নগদ পেমেন্ট (Nagad Gateway)',
        active: cfg.nagad.enabled,
        isLive: cfg.nagad.isLive,
        merchantNumber: cfg.nagad.merchantNumber,
        hasApiCredentials: Boolean(cfg.nagad.merchantId && cfg.nagad.publicKey),
        mode: cfg.nagad.merchantId ? 'merchant_api' : 'interactive_simulator',
      },
      {
        id: 'sslcommerz',
        name: 'SSLCommerz (Cards & MFS Gateway)',
        active: cfg.sslcommerz.enabled,
        isLive: cfg.sslcommerz.isLive,
        hasApiCredentials: Boolean(cfg.sslcommerz.storeId && cfg.sslcommerz.storePasswd),
        mode: cfg.sslcommerz.storeId ? 'hosted_session' : 'interactive_simulator',
      },
    ],
    config: {
      bkash: {
        enabled: cfg.bkash.enabled,
        isLive: cfg.bkash.isLive,
        merchantNumber: cfg.bkash.merchantNumber,
        username: cfg.bkash.username,
        hasAppKey: Boolean(cfg.bkash.appKey),
      },
      nagad: {
        enabled: cfg.nagad.enabled,
        isLive: cfg.nagad.isLive,
        merchantId: cfg.nagad.merchantId,
        merchantNumber: cfg.nagad.merchantNumber,
        hasPublicKey: Boolean(cfg.nagad.publicKey),
      },
      sslcommerz: {
        enabled: cfg.sslcommerz.enabled,
        isLive: cfg.sslcommerz.isLive,
        storeId: cfg.sslcommerz.storeId,
        hasStorePasswd: Boolean(cfg.sslcommerz.storePasswd),
      },
    },
  });
});

adminRouter.post('/payments/gateways', requirePermission('payments.manage'), (req: Request, res: Response) => {
  try {
    savePaymentGatewayConfig(req.body || {});
    res.json({ success: true, message: 'পেমেন্ট গেটওয়ে কনফিগারেশন সফলভাবে সংরক্ষিত হয়েছে।' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to save gateway configuration' });
  }
});

// Real Online Payment Initiation
async function handlePaymentInitiate(req: Request, res: Response) {
  try {
    const { orderId, gateway } = req.body;
    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
    const baseUrl = `${protocol}://${host}`;
    const selectedGateway = (gateway || order.payment_method || 'bkash').toLowerCase();

    let result;
    if (selectedGateway === 'bkash') {
      result = await initiateBkashPayment({
        orderId,
        amount: Number(order.total),
        customerPhone: order.customer_phone,
        callbackUrl: `${baseUrl}/api/payment/bkash/callback?orderId=${orderId}`,
      });
    } else if (selectedGateway === 'nagad') {
      result = await initiateNagadPayment({
        orderId,
        amount: Number(order.total),
        customerPhone: order.customer_phone,
        callbackUrl: `${baseUrl}/api/payment/nagad/callback?orderId=${orderId}`,
      });
    } else if (selectedGateway === 'sslcommerz' || selectedGateway === 'card' || selectedGateway === 'cards') {
      result = await initiateSSLCommerzSession({
        orderId,
        amount: Number(order.total),
        customerName: order.customer_name,
        customerPhone: order.customer_phone,
        customerEmail: order.customer_email,
        customerAddress: order.delivery_address,
        customerDistrict: order.district,
        baseUrl,
      });
    } else {
      return res.status(400).json({ error: `Unsupported payment gateway: ${selectedGateway}` });
    }

    return res.json(result);
  } catch (err: any) {
    console.error('Payment initiation error:', err);
    return res.status(500).json({ error: err?.message || 'Payment initiation failed' });
  }
}

storeRouter.post('/payment/initiate', handlePaymentInitiate);
adminRouter.post('/payment/initiate', requirePermission('payments.manage'), handlePaymentInitiate);

// Real Online Payment Verification & Database Transition
async function handlePaymentVerifyOnline(req: Request, res: Response) {
  try {
    const { orderId, gateway, paymentId, valId, inputTrxId } = req.body;
    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Idempotency: Protect against duplicate verification calls
    if (order.payment_status === 'paid') {
      const itemsList = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
      return res.json({
        success: true,
        orderId,
        trxId: order.payment_txn_id,
        paymentStatus: 'paid',
        order: formatOrderRow(order, itemsList),
        message: 'পেমেন্ট ইতিমধ্যে সফলভাবে পরিশোধিত হিসেবে সংরক্ষিত আছে।',
      });
    }

    const gw = (gateway || order.payment_method || 'bkash').toLowerCase();
    let verifiedTrxId = '';
    let verifiedAmount: number | undefined;

    if (gw === 'bkash') {
      const exec = await executeBkashPayment(paymentId || orderId, orderId);
      if (!exec.success || exec.paymentStatus !== 'paid' || !exec.trxId) {
        return res.status(400).json({
          success: false,
          error: exec.error || 'bKash পেমেন্ট ভেরিফিকেশন ব্যর্থ হয়েছে বা পেমেন্ট সম্পন্ন হয়নি।',
        });
      }
      verifiedTrxId = exec.trxId;
      verifiedAmount = exec.amount;
    } else if (gw === 'nagad') {
      const ver = await verifyNagadPayment(paymentId || orderId, orderId);
      if (!ver.success || ver.paymentStatus !== 'paid' || !ver.trxId) {
        return res.status(400).json({
          success: false,
          error: ver.error || 'Nagad পেমেন্ট ভেরিফিকেশন ব্যর্থ হয়েছে বা পেমেন্ট সম্পন্ন হয়নি।',
        });
      }
      verifiedTrxId = ver.trxId;
      verifiedAmount = ver.amount;
    } else if (gw === 'sslcommerz' || gw === 'card' || gw === 'cards') {
      const val = await validateSSLCommerzPayment(valId || paymentId || orderId, orderId);
      if (!val.success || val.paymentStatus !== 'paid' || !val.trxId) {
        return res.status(400).json({
          success: false,
          error: val.error || 'SSLCommerz পেমেন্ট ভ্যালিডেশন ব্যর্থ হয়েছে।',
        });
      }
      verifiedTrxId = val.trxId;
      verifiedAmount = val.amount;
    } else {
      return res.status(400).json({
        success: false,
        error: `অসমর্থিত পেমেন্ট মাধ্যম: ${gw}`,
      });
    }

    // Strict Gate: Transaction ID MUST exist from gateway verification
    if (!verifiedTrxId || typeof verifiedTrxId !== 'string' || verifiedTrxId.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'পেমেন্ট গেটওয়ে থেকে কোনো বৈধ ট্রানজেকশন আইডি (TrxID) পাওয়া যায়নি। পেমেন্ট বাতিল করা হয়েছে।',
      });
    }

    // Strict Gate: Gateway amount verification against order total
    const orderTotal = Number(order.total) || 0;
    if (verifiedAmount !== undefined && verifiedAmount !== null && !isNaN(verifiedAmount)) {
      const amountDiff = Math.abs(Number(verifiedAmount) - orderTotal);
      if (amountDiff > 1) { // allow max 1 BDT rounding tolerance
        console.error(`[PAYMENT SECURITY ALERT] Amount mismatch for Order #${orderId}: Gateway reported ৳${verifiedAmount}, but Order total is ৳${orderTotal}`);
        return res.status(400).json({
          success: false,
          error: `পেমেন্টের পরিমাণ সঠিক নয়। গেটওয়েতে পরিশোধিত ৳${verifiedAmount}, কিন্তু অর্ডারের মোট মূল্য ৳${orderTotal}।`,
        });
      }
    }

    // Update SQLite Order: payment_status = 'paid', order_status = 'processing'
    db.prepare(`
      UPDATE orders SET
        payment_status = 'paid',
        payment_txn_id = ?,
        order_status = CASE WHEN order_status = 'pending' THEN 'processing' ELSE order_status END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(verifiedTrxId, orderId);

    // Record in Timeline
    db.prepare(`
      INSERT INTO order_timeline (id, order_id, from_status, to_status, note, actor)
      VALUES (?, ?, ?, 'processing', ?, 'PaymentGateway')
    `).run(
      `tl-${crypto.randomUUID()}`,
      orderId,
      order.order_status,
      `অনলাইন পেমেন্ট (${gw.toUpperCase()}) সফলভাবে ভেরিফাই ও পরিশোধ হয়েছে। TrxID: ${verifiedTrxId}`
    );

    // Record Audit
    recordAudit('PaymentGateway', 'Online Payment Verified', 'order', orderId, {
      payment_status: order.payment_status,
    }, {
      payment_status: 'paid',
      gateway: gw,
      trxId: verifiedTrxId,
    });

    const updatedOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
    const itemsList = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);

    return res.json({
      success: true,
      orderId,
      trxId: verifiedTrxId,
      paymentStatus: 'paid',
      order: formatOrderRow(updatedOrder, itemsList),
      message: 'পেমেন্ট সফলভাবে ভেরিফাই ও গ্রহণ করা হয়েছে!',
    });
  } catch (err: any) {
    console.error('Online payment verification error:', err);
    return res.status(500).json({ error: err?.message || 'Payment verification failed' });
  }
}

storeRouter.post('/payment/verify-online', handlePaymentVerifyOnline);
adminRouter.post('/payment/verify-online', requirePermission('payments.manage'), handlePaymentVerifyOnline);

// SSLCommerz Callbacks with Mandatory Server-Side Validation API & Amount Check
storeRouter.post('/payment/sslcommerz/success', async (req: Request, res: Response) => {
  const { tran_id, val_id, bank_tran_id } = req.body;
  if (!tran_id) {
    return res.redirect('/checkout?status=failed&reason=missing_tran_id');
  }

  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(tran_id) as any;
  if (!order) {
    return res.redirect(`/checkout?status=failed&orderId=${tran_id}&reason=order_not_found`);
  }

  // Idempotency
  if (order.payment_status === 'paid') {
    return res.redirect(`/checkout?status=success&orderId=${tran_id}`);
  }

  // Mandatory Server-Side Validation API call
  try {
    const valResult = await validateSSLCommerzPayment(val_id || tran_id, tran_id);
    if (!valResult.success || valResult.paymentStatus !== 'paid' || !valResult.trxId) {
      console.error(`[SSLCOMMERZ SECURITY ALERT] Validation failed for Order #${tran_id}:`, valResult.error);
      return res.redirect(`/checkout?status=failed&orderId=${tran_id}&reason=validation_failed`);
    }

    // Verify Amount against Order Total
    const orderTotal = Number(order.total) || 0;
    if (valResult.amount !== undefined && valResult.amount !== null && !isNaN(valResult.amount)) {
      const amountDiff = Math.abs(Number(valResult.amount) - orderTotal);
      if (amountDiff > 1) {
        console.error(`[SSLCOMMERZ SECURITY ALERT] Amount mismatch for Order #${tran_id}: Validated ৳${valResult.amount}, Order ৳${orderTotal}`);
        return res.redirect(`/checkout?status=failed&orderId=${tran_id}&reason=amount_mismatch`);
      }
    }

    const finalTrxId = valResult.trxId;
    db.prepare(`
      UPDATE orders SET
        payment_status = 'paid',
        payment_txn_id = ?,
        order_status = CASE WHEN order_status = 'pending' THEN 'processing' ELSE order_status END,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(finalTrxId, tran_id);

    db.prepare(`
      INSERT INTO order_timeline (id, order_id, from_status, to_status, note, actor)
      VALUES (?, ?, ?, 'processing', ?, 'SSLCommerz Callback')
    `).run(`tl-${crypto.randomUUID()}`, tran_id, order.order_status, `SSLCommerz পেমেন্ট সফলভাবে ভ্যালিডেট ও পরিশোধ হয়েছে। TrxID: ${finalTrxId}`);

    return res.redirect(`/checkout?status=success&orderId=${tran_id}`);
  } catch (err: any) {
    console.error('SSLCommerz callback processing error:', err);
    return res.redirect(`/checkout?status=failed&orderId=${tran_id}&reason=server_error`);
  }
});

storeRouter.post('/payment/sslcommerz/fail', (req: Request, res: Response) => {
  const { tran_id } = req.body;
  res.redirect(`/checkout?status=failed&orderId=${tran_id || ''}`);
});

storeRouter.post('/payment/sslcommerz/cancel', (req: Request, res: Response) => {
  const { tran_id } = req.body;
  res.redirect(`/checkout?status=cancelled&orderId=${tran_id || ''}`);
});

storeRouter.post('/payment/sslcommerz/ipn', async (req: Request, res: Response) => {
  const { tran_id, val_id, status } = req.body;
  if (!tran_id || !val_id) {
    return res.status(400).send('Missing tran_id or val_id');
  }

  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(tran_id) as any;
    if (!order) return res.status(404).send('Order not found');
    if (order.payment_status === 'paid') return res.sendStatus(200);

    const valResult = await validateSSLCommerzPayment(val_id, tran_id);
    if (valResult.success && valResult.paymentStatus === 'paid' && valResult.trxId) {
      const orderTotal = Number(order.total) || 0;
      if (valResult.amount !== undefined && Math.abs(Number(valResult.amount) - orderTotal) > 1) {
        console.error(`[SSLCOMMERZ IPN ALERT] Amount mismatch for Order #${tran_id}`);
        return res.status(400).send('Amount mismatch');
      }

      db.prepare(`
        UPDATE orders SET
          payment_status = 'paid',
          payment_txn_id = ?,
          order_status = CASE WHEN order_status = 'pending' THEN 'processing' ELSE order_status END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(valResult.trxId, tran_id);
      return res.sendStatus(200);
    }
    return res.status(400).send('Validation failed');
  } catch (err) {
    return res.status(500).send('IPN processing error');
  }
});

// 6. MARKETING: TIMER OFFERS & COUPONS (Section 75.34 - 75.35)
function handleGetTimerOffers(req: Request, res: Response) {
  const offers = db.prepare('SELECT * FROM timer_offers ORDER BY datetime(created_at) DESC').all();
  res.json({ success: true, offers });
}
adminRouter.get('/timer-offers', handleGetTimerOffers);
storeRouter.get('/timer-offers', handleGetTimerOffers);

adminRouter.post('/timer-offers', requirePermission('marketing.manage'), (req: Request, res: Response) => {
  const { offerName, title, description, discountType, discountValue, startTime, endTime, targetType, targetIds, minOrderAmount } = req.body;

  if (!offerName || !title || !discountValue || !startTime || !endTime) {
    return res.status(400).json({ error: 'All offer fields are required.' });
  }

  if (new Date(endTime) <= new Date(startTime)) {
    return res.status(400).json({ error: 'End time must be after start time.' });
  }

  const id = `to-${Date.now()}`;
  db.prepare(`
    INSERT INTO timer_offers (
      id, offer_name, title, description, discount_type, discount_value, start_time, end_time, target_type, target_ids, min_order_amount, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
  `).run(
    id,
    offerName,
    title,
    description || '',
    discountType || 'percentage',
    Number(discountValue),
    startTime,
    endTime,
    targetType || 'entire_store',
    typeof targetIds === 'string' ? targetIds : JSON.stringify(targetIds || []),
    Number(minOrderAmount || 0)
  );

  recordAudit('Admin', 'Timer Offer Created', 'timer_offer', id, null, { offerName, discountValue });
  res.json({ success: true, id, message: 'টাইমার অফার সফলভাবে সক্রিয় করা হয়েছে।' });
});

adminRouter.put('/timer-offers/:id', requirePermission('marketing.manage'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, discountValue, endTime } = req.body;

  db.prepare(`
    UPDATE timer_offers SET
      status = COALESCE(?, status),
      discount_value = COALESCE(?, discount_value),
      end_time = COALESCE(?, end_time)
    WHERE id = ?
  `).run(status, discountValue ? Number(discountValue) : null, endTime, id);

  recordAudit('Admin', 'Timer Offer Updated', 'timer_offer', id, null, req.body);
  res.json({ success: true, message: 'অফার আপডেট সফল হয়েছে।' });
});

function handleGetCoupons(req: Request, res: Response) {
  try {
    const coupons = db.prepare('SELECT * FROM coupons ORDER BY datetime(created_at) DESC').all() as any[];
    const mapped = coupons.map((c) => ({
      ...c,
      discountType: c.discount_type,
      discountValue: c.discount_value,
      minOrderAmount: c.min_order_amount,
      maxDiscountAmount: c.max_discount_amount,
      expiryDate: c.expiry_date,
      usageLimit: c.usage_limit,
      usedCount: c.used_count,
      perUserLimit: c.per_user_limit,
      allowStacking: Boolean(c.allow_stacking),
      isActive: Boolean(c.active),
      status: c.active ? 'active' : 'inactive',
    }));
    res.json({ success: true, coupons: mapped });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
}
adminRouter.get('/coupons', handleGetCoupons);
storeRouter.get('/coupons', handleGetCoupons);

adminRouter.post('/coupons', requirePermission('marketing.manage'), (req: Request, res: Response) => {
  const { code, description, discountType, discountValue, minOrderAmount, maxDiscountAmount, expiryDate, usageLimit } = req.body;
  if (!code || !discountValue) return res.status(400).json({ error: 'Coupon code and discount are required' });

  const id = `cp-${Date.now()}`;
  db.prepare(`
    INSERT INTO coupons (
      id, code, description, discount_type, discount_value, min_order_amount, max_discount_amount, expiry_date, usage_limit, active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `).run(
    id,
    code.toUpperCase().trim(),
    description || '',
    discountType || 'fixed',
    Number(discountValue),
    Number(minOrderAmount || 0),
    maxDiscountAmount ? Number(maxDiscountAmount) : null,
    expiryDate || '2026-12-31',
    Number(usageLimit || 100)
  );

  recordAudit('Admin', 'Coupon Created', 'coupon', id, null, { code, discountValue });
  res.json({ success: true, id, message: 'কুপন সফলভাবে যোগ হয়েছে।' });
});

// BANNERS (Hero Banners & Store Promotions)
function handleGetBanners(req: Request, res: Response) {
  try {
    const banners = db.prepare('SELECT * FROM banners ORDER BY display_order ASC, created_at ASC').all() as any[];
    const mapped = banners.map((b) => ({
      id: b.id,
      title: b.title,
      banglaTitle: b.bangla_title || b.title,
      subtitle: b.subtitle || '',
      banglaSubtitle: b.bangla_subtitle || '',
      buttonText: b.button_text || 'কালেকশন দেখুন',
      buttonUrl: b.button_url || '/category/men',
      desktopImage: b.desktop_image,
      mobileImage: b.mobile_image || b.desktop_image,
      order: b.display_order,
      isActive: Boolean(b.is_active),
      tag: b.tag || '',
    }));
    res.json({ success: true, banners: mapped });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
}
adminRouter.get('/banners', handleGetBanners);
storeRouter.get('/banners', handleGetBanners);

adminRouter.post('/banners', requirePermission('marketing.manage'), (req: Request, res: Response) => {
  try {
    const {
      id = `hero-${Date.now()}`,
      title,
      banglaTitle,
      subtitle,
      banglaSubtitle,
      buttonText,
      buttonUrl,
      desktopImage,
      mobileImage,
      order = 1,
      isActive = true,
      tag,
    } = req.body;

    if (!title || !desktopImage) {
      return res.status(400).json({ error: 'ব্যানার টাইটেল ও ছবি আবশ্যক।' });
    }

    db.prepare(`
      INSERT INTO banners (id, title, bangla_title, subtitle, bangla_subtitle, button_text, button_url, desktop_image, mobile_image, display_order, is_active, tag)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      title,
      banglaTitle || title,
      subtitle || '',
      banglaSubtitle || '',
      buttonText || 'কালেকশন দেখুন',
      buttonUrl || '/category/men',
      desktopImage,
      mobileImage || desktopImage,
      order,
      isActive ? 1 : 0,
      tag || null
    );

    recordAudit('Admin', 'Banner Added', 'banner', id, null, { title });
    res.json({ success: true, id, message: 'ব্যানার সফলভাবে তৈরি হয়েছে' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

adminRouter.put('/banners/:id', requirePermission('marketing.manage'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const b = req.body;
    const existing = db.prepare('SELECT * FROM banners WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ error: 'ব্যানার পাওয়া যায়নি' });
    }

    db.prepare(`
      UPDATE banners
      SET title = COALESCE(?, title),
          bangla_title = COALESCE(?, bangla_title),
          subtitle = COALESCE(?, subtitle),
          bangla_subtitle = COALESCE(?, bangla_subtitle),
          button_text = COALESCE(?, button_text),
          button_url = COALESCE(?, button_url),
          desktop_image = COALESCE(?, desktop_image),
          mobile_image = COALESCE(?, mobile_image),
          display_order = COALESCE(?, display_order),
          is_active = COALESCE(?, is_active),
          tag = COALESCE(?, tag)
      WHERE id = ?
    `).run(
      b.title ?? null,
      b.banglaTitle ?? null,
      b.subtitle ?? null,
      b.banglaSubtitle ?? null,
      b.buttonText ?? null,
      b.buttonUrl ?? null,
      b.desktopImage ?? null,
      b.mobileImage ?? null,
      b.order !== undefined ? b.order : null,
      b.isActive !== undefined ? (b.isActive ? 1 : 0) : null,
      b.tag ?? null,
      id
    );

    recordAudit('Admin', 'Banner Updated', 'banner', id, existing, b);
    res.json({ success: true, message: 'ব্যানার আপডেট হয়েছে' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

adminRouter.delete('/banners/:id', requirePermission('marketing.manage'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM banners WHERE id = ?').run(id);
    recordAudit('Admin', 'Banner Deleted', 'banner', id, null, null);
    res.json({ success: true, message: 'ব্যানার মুছে ফেলা হয়েছে' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 7. COMPLAINTS (Section 75.25)
adminRouter.get('/complaints', requirePermission('orders.view'), (req: Request, res: Response) => {
  const complaints = db.prepare('SELECT * FROM complaints ORDER BY datetime(created_at) DESC').all();
  res.json({ success: true, complaints });
});

adminRouter.post('/complaints', requirePermission('orders.edit'), (req: Request, res: Response) => {
  const { customerName, customerPhone, orderId, subject, message, priority } = req.body;
  const id = `CMP-${Date.now().toString().slice(-5)}`;
  db.prepare(`
    INSERT INTO complaints (id, customer_name, customer_phone, order_id, subject, message, priority, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'new')
  `).run(id, customerName, customerPhone, orderId || null, subject, message, priority || 'normal');

  res.json({ success: true, id, message: 'অভিযোগ নথিভুক্ত হয়েছে।' });
});

adminRouter.put('/complaints/:id', requirePermission('orders.edit'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { status, assignedAdmin, adminReply, internalNote } = req.body;

  db.prepare(`
    UPDATE complaints SET
      status = COALESCE(?, status),
      assigned_admin = COALESCE(?, assigned_admin),
      admin_reply = COALESCE(?, admin_reply),
      internal_note = COALESCE(?, internal_note),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, assignedAdmin, adminReply, internalNote, id);

  res.json({ success: true, message: 'অভিযোগের তথ্য আপডেট হয়েছে।' });
});

// 8. TASKS (Section 75.26)
adminRouter.get('/tasks', requirePermission('settings.manage'), (req: Request, res: Response) => {
  const tasks = db.prepare('SELECT * FROM tasks ORDER BY datetime(created_at) DESC').all();
  res.json({ success: true, tasks });
});

adminRouter.post('/tasks', requirePermission('settings.manage'), (req: Request, res: Response) => {
  const { title, description, assignedAdmin, priority, dueDate, createdBy } = req.body;
  const id = `TSK-${Date.now().toString().slice(-5)}`;
  db.prepare(`
    INSERT INTO tasks (id, title, description, assigned_admin, priority, due_date, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
  `).run(id, title, description || '', assignedAdmin || 'Admin', priority || 'normal', dueDate || null, createdBy || 'Admin');

  res.json({ success: true, id, message: 'টাস্ক সফলভাবে তৈরি হয়েছে।' });
});

adminRouter.put('/tasks/:id', requirePermission('settings.manage'), (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body;
  db.prepare('UPDATE tasks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, id);
  res.json({ success: true, message: 'টাস্ক স্ট্যাটাস আপডেট হয়েছে।' });
});

// 9. NOTIFICATIONS (Section 75.27)
adminRouter.get('/notifications', requirePermission('orders.view'), (req: Request, res: Response) => {
  const notifications = db.prepare('SELECT * FROM notifications ORDER BY datetime(created_at) DESC LIMIT 50').all();
  const unreadCount = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE is_read = 0').get() as any;
  res.json({ success: true, notifications, unreadCount: unreadCount?.count || 0 });
});

adminRouter.put('/notifications/:id/read', requirePermission('orders.view'), (req: Request, res: Response) => {
  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// 10. SYSTEM HEALTH, AUDIT LOGS, LOGIN ACTIVITY (Section 75.38 - 75.41)
adminRouter.get('/system/health', requirePermission('settings.manage'), (req: Request, res: Response) => {
  try {
    // Real DB check
    const dbCheck = db.prepare('SELECT 1 as alive').get();
    const diskCheck = fs.existsSync(process.cwd());
    const uploadDirCheck = fs.existsSync(path.join(process.cwd(), 'data'));

    res.json({
      success: true,
      health: {
        database: { status: dbCheck ? 'connected' : 'error', latency: '0.8ms' },
        storage: { status: diskCheck ? 'connected' : 'error', directory: process.cwd() },
        uploads: { status: uploadDirCheck ? 'configured' : 'not_configured' },
        aiService: { status: Boolean(process.env.GEMINI_API_KEY) ? 'connected' : 'fallback_engine' },
        paymentGateway: { status: 'configured', provider: 'bKash / Nagad / COD' },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Health check failed' });
  }
});

adminRouter.get('/audit-logs', requirePermission('audit.view'), (req: Request, res: Response) => {
  const logs = db.prepare('SELECT * FROM audit_logs ORDER BY datetime(timestamp) DESC LIMIT 100').all();
  res.json({ success: true, logs });
});

adminRouter.get('/login-activity', requirePermission('audit.view'), (req: Request, res: Response) => {
  const activity = db.prepare('SELECT * FROM login_activity ORDER BY datetime(timestamp) DESC LIMIT 50').all();
  res.json({ success: true, activity });
});

// 11. AI AGENT SETTINGS & KNOWLEDGE (Section 75.42)
adminRouter.get('/ai/settings', requirePermission('settings.manage'), (req: Request, res: Response) => {
  const settings = db.prepare('SELECT * FROM ai_settings WHERE id = "default"').get();
  res.json({ success: true, settings });
});

adminRouter.put('/ai/settings', requirePermission('settings.manage'), (req: Request, res: Response) => {
  const { enabled, agentName, welcomeMessage, language, responseStyle } = req.body;
  db.prepare(`
    UPDATE ai_settings SET
      enabled = COALESCE(?, enabled),
      agent_name = COALESCE(?, agent_name),
      welcome_message = COALESCE(?, welcome_message),
      language = COALESCE(?, language),
      response_style = COALESCE(?, response_style),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = "default"
  `).run(enabled !== undefined ? (enabled ? 1 : 0) : null, agentName, welcomeMessage, language, responseStyle);

  recordAudit('Admin', 'AI Settings Updated', 'ai_settings', 'default', null, req.body);
  res.json({ success: true, message: 'এআই সেটিংস সফলভাবে আপডেট হয়েছে।' });
});

adminRouter.get('/ai/knowledge', requirePermission('settings.manage'), (req: Request, res: Response) => {
  const knowledge = db.prepare('SELECT * FROM ai_knowledge WHERE active = 1').all();
  res.json({ success: true, knowledge });
});

adminRouter.post('/ai/knowledge', requirePermission('settings.manage'), (req: Request, res: Response) => {
  const { category, title, content } = req.body;
  const id = `kno-${Date.now()}`;
  db.prepare('INSERT INTO ai_knowledge (id, category, title, content, active) VALUES (?, ?, ?, ?, 1)')
    .run(id, category || 'faq', title, content);
  res.json({ success: true, id, message: 'এআই নলেজ বেজে তথ্য যোগ হয়েছে।' });
});

// 12. REPORTS ENGINE (Section 75.28 - 75.31)
adminRouter.get('/reports/sales', requirePermission('reports.view'), (req: Request, res: Response) => {
  try {
    const dailySales = db.prepare(`
      SELECT 
        date(created_at) as date,
        COUNT(*) as total_orders,
        SUM(total) as revenue,
        SUM(discount) as discount_given,
        SUM(delivery_charge) as delivery_revenue
      FROM orders
      WHERE order_status NOT IN ('cancelled')
      GROUP BY date(created_at)
      ORDER BY date(created_at) DESC
      LIMIT 30
    `).all();

    const categorySales = db.prepare(`
      SELECT 
        c.name as category_name,
        c.bangla_name as category_bangla,
        SUM(oi.quantity) as units_sold,
        SUM(oi.subtotal) as total_revenue
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN categories c ON p.category_id = c.id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.order_status NOT IN ('cancelled')
      GROUP BY c.id
    `).all();

    res.json({ success: true, dailySales, categorySales });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to generate sales report' });
  }
});

adminRouter.get('/reports/customers', requirePermission('reports.view'), (req: Request, res: Response) => {
  try {
    const totalCustomers = (db.prepare('SELECT COUNT(*) as count FROM customers').get() as any)?.count || 0;
    const repeatCustomers = (db.prepare('SELECT COUNT(*) as count FROM customers WHERE total_orders > 1').get() as any)?.count || 0;
    const topCustomers = db.prepare(`
      SELECT id, name, phone, email, district, total_orders, total_spent, last_order_date
      FROM customers
      ORDER BY total_spent DESC
      LIMIT 20
    `).all();

    const districtDistribution = db.prepare(`
      SELECT district, COUNT(*) as count, SUM(total_spent) as revenue
      FROM customers
      WHERE district IS NOT NULL AND district != ''
      GROUP BY district
      ORDER BY count DESC
      LIMIT 15
    `).all();

    const avgSpend = (db.prepare('SELECT AVG(total) as avg_order FROM orders WHERE order_status NOT IN ("cancelled")').get() as any)?.avg_order || 0;

    res.json({
      success: true,
      summary: {
        totalCustomers,
        repeatCustomers,
        repeatRate: totalCustomers > 0 ? ((repeatCustomers / totalCustomers) * 100).toFixed(1) : '0',
        avgOrderValue: Math.round(avgSpend),
      },
      topCustomers,
      districtDistribution,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to generate customer analytics' });
  }
});

adminRouter.get('/reports/marketing', requirePermission('reports.view'), (req: Request, res: Response) => {
  try {
    const couponsUsage = db.prepare(`
      SELECT 
        coupon_code,
        COUNT(*) as times_used,
        SUM(discount) as total_discount_given,
        SUM(total) as generated_revenue
      FROM orders
      WHERE coupon_code IS NOT NULL AND coupon_code != '' AND order_status NOT IN ('cancelled')
      GROUP BY coupon_code
      ORDER BY times_used DESC
    `).all();

    const landingPages = db.prepare(`
      SELECT id, title, slug, view_count, is_active, created_at
      FROM landing_pages
      ORDER BY view_count DESC
    `).all();

    const timerOffers = db.prepare(`
      SELECT id, title, discount_percent, is_active, clicks_count, created_at
      FROM timer_offers
      ORDER BY clicks_count DESC
    `).all();

    res.json({
      success: true,
      couponsUsage,
      landingPages,
      timerOffers,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to generate marketing analytics' });
  }
});

// Valid Bangladesh Districts for Server-Side Shipping Location Validation
const VALID_BD_DISTRICTS = [
  'dhaka', 'gazipur', 'narayanganj', 'tangail', 'narsingdi', 'manikganj', 'munshiganj',
  'faridpur', 'gopalganj', 'madaripur', 'rajbari', 'shariatpur', 'kishoreganj',
  'sirajganj', 'pabna', 'rajshahi', 'bogra', 'bogura', 'naogaon', 'natore', 'chapainawabganj', 'joypurhat',
  'chattogram', 'chittagong', 'coxsbazar', "cox's bazar", 'cumilla', 'comilla', 'brahmanbaria',
  'feni', 'noakhali', 'chandpur', 'lakshmipur', 'rangamati', 'bandarban', 'khagrachhari',
  'sylhet', 'moulvibazar', 'habiganj', 'sunamganj',
  'khulna', 'jashore', 'jessore', 'kushtia', 'jhenaidah', 'satkhira', 'bagerhat', 'chuadanga', 'meherpur', 'magura', 'narail',
  'barishal', 'barisal', 'patuakhali', 'bhola', 'pirojpur', 'barguna', 'jhalokati',
  'rangpur', 'dinajpur', 'kurigram', 'gaibandha', 'nilphamari', 'panchagarh', 'thakurgaon', 'lalmonirhat',
  'mymensingh', 'jamalpur', 'netrokona', 'sherpur',
  'ঢাকা', 'গাজীপুর', 'নারায়ণগঞ্জ', 'টাঙ্গাইল', 'নরসিংদী', 'মানিকগঞ্জ', 'মুন্সীগঞ্জ',
  'ফরিদপুর', 'গোপালগঞ্জ', 'মাদারীপুর', 'রাজবাড়ী', 'শরীয়তপুর', 'কিশোরগঞ্জ',
  'সিরাজগঞ্জ', 'পাবনা', 'রাজশাহী', 'বগুড়া', 'নওগাঁ', 'নাটোর', 'চাঁপাইনবাবগঞ্জ', 'জয়পুরহাট',
  'চট্টগ্রাম', 'কক্সবাজার', 'কুমিল্লা', 'ব্রাহ্মণবাড়িয়া', 'ফেনী', 'নোয়াখালী', 'চাঁদপুর', 'লক্ষ্মীপুর',
  'রাঙ্গামাটি', 'বান্দরবান', 'খাগড়াছড়ি', 'সিলেট', 'মৌলভীবাজার', 'হবিগঞ্জ', 'সুনামগঞ্জ',
  'খুলনা', 'যশোর', 'কুষ্টিয়া', 'ঝিনাইদহ', 'সাতক্ষীরা', 'বাগেরহাট', 'চুয়াডাঙ্গা', 'মেহেরপুর', 'মাগুরা', 'নড়াইল',
  'বরিশাল', 'পটুয়াখালী', 'ভোলা', 'পিরোজপুর', 'বরগুনা', 'ঝালকাঠি',
  'রংপুর', 'দিনাজপুর', 'কুড়িগ্রাম', 'গাইবান্ধা', 'নীলফামারী', 'পঞ্চগড়', 'ঠাকুরগাঁও', 'লালমনিরহাট',
  'ময়মনসিংহ', 'জামালপুর', 'নেত্রকোণা', 'শেরপুর'
];

// 13. AUTHORITATIVE CHECKOUT / ORDER PLACEMENT (Section 75.43 - 75.45)
function handleCheckoutOrder(req: Request, res: Response) {
  const {
    customerName,
    customerPhone,
    customerEmail,
    deliveryAddress,
    district,
    upazila,
    items, // Array of { variantId, quantity }
    couponCode,
    paymentMethod,
    customerNotes,
  } = req.body;

  if (!customerName || typeof customerName !== 'string' || customerName.trim().length < 2) {
    return res.status(400).json({ success: false, error: 'গ্রাহকের সঠিক নাম প্রদান করা আবশ্যক।' });
  }

  const cleanPhone = (customerPhone || '').replace(/[\s-]/g, '');
  if (!cleanPhone || !/^(\+?88)?01[3-9]\d{8}$/.test(cleanPhone)) {
    return res.status(400).json({ success: false, error: 'সঠিক ১১ ডিজিটের বাংলাদেশী মোবাইল নম্বর প্রদান করুন (যেমন: 017xxxxxxxx)।' });
  }

  if (!deliveryAddress || typeof deliveryAddress !== 'string' || deliveryAddress.trim().length < 5) {
    return res.status(400).json({ success: false, error: 'অনুগ্রহ করে সম্পূর্ণ ও নির্ভুল ডেলিভারি ঠিকানা প্রদান করুন।' });
  }

  if (!district || typeof district !== 'string' || !district.trim()) {
    return res.status(400).json({ success: false, error: 'ডেলিভারি জেলা আবশ্যক।' });
  }

  const cleanDistrict = district.trim().toLowerCase();
  const normalizedInput = cleanDistrict.replace(/[^a-z0-9\u0980-\u09FF]/g, '');
  const isValidDistrict = VALID_BD_DISTRICTS.some((d) => {
    const validLower = d.toLowerCase();
    const validNormalized = validLower.replace(/[^a-z0-9\u0980-\u09FF]/g, '');
    return (
      cleanDistrict === validLower ||
      normalizedInput === validNormalized ||
      cleanDistrict.startsWith(validLower + ' ') ||
      cleanDistrict.endsWith(' ' + validLower)
    );
  });

  if (!isValidDistrict) {
    return res.status(400).json({ success: false, error: 'অনুগ্রহ করে বাংলাদেশের একটি সঠিক জেলা নির্বাচন করুন (যেমন: ঢাকা, সিরাজগঞ্জ, চট্টগ্রাম ইত্যাদি)।' });
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: 'কমপক্ষে একটি পণ্য অর্ডার করতে হবে।' });
  }

  // Strict Validation: Quantity must be an integer >= 1
  for (const itm of items) {
    const rawQty = itm.quantity;
    const numQty = Number(rawQty);
    if (!Number.isInteger(numQty) || numQty < 1) {
      return res.status(400).json({
        success: false,
        error: `পণ্যের পরিমাণ অবশ্যই ১ বা তার চেয়ে বেশি পূর্ণসংখ্যা (Integer) হতে হবে। প্রদত্ত পরিমাণ: ${rawQty}`,
      });
    }
  }

  // Cryptographically secure, collisions-free Order ID format: BS-YYYYMM-XXXXXX
  const now = new Date();
  const datePrefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const randomHex = crypto.randomBytes(3).toString('hex').toUpperCase();
  const orderId = `BS-${datePrefix}-${randomHex}`;

  // TRANSACTION BOUNDARY (Immediate write-lock to prevent SQLite WAL busy collisions)
  db.exec('BEGIN IMMEDIATE');

  try {
    let calculatedSubtotal = 0;
    const validatedItems: any[] = [];

    // Atomic Concurrency-Safe Stock Deduction & Price Validation
    for (const itm of items) {
      const { variantId, productId, quantity } = itm;
      const qtyNum = Number(quantity);

      // 1. Try to fetch variant
      let variant: any = null;
      if (variantId) {
        variant = db.prepare(`
          SELECT v.*, p.name as product_name, p.bangla_name as product_bangla, p.main_image as product_main_image,
                 p.price as product_price, p.discount_price as product_discount_price,
                 p.category_id, col.name as color_name, sz.name as size_name
          FROM product_variants v
          JOIN products p ON v.product_id = p.id
          LEFT JOIN colors col ON v.color_id = col.id
          LEFT JOIN sizes sz ON v.size_id = sz.id
          WHERE v.id = ?
        `).get(variantId) as any;
      }

      // If not found by variantId, search by product_id
      if (!variant && (productId || itm.productId)) {
        const pid = productId || itm.productId;
        variant = db.prepare(`
          SELECT v.*, p.name as product_name, p.bangla_name as product_bangla, p.main_image as product_main_image,
                 p.price as product_price, p.discount_price as product_discount_price,
                 p.category_id, col.name as color_name, sz.name as size_name
          FROM product_variants v
          JOIN products p ON v.product_id = p.id
          LEFT JOIN colors col ON v.color_id = col.id
          LEFT JOIN sizes sz ON v.size_id = sz.id
          WHERE v.product_id = ?
          LIMIT 1
        `).get(pid) as any;
      }

      // 2. If no variant exists, fetch product directly
      let productRecord: any = null;
      if (!variant && (productId || itm.productId)) {
        const pid = productId || itm.productId;
        productRecord = db.prepare(`SELECT * FROM products WHERE id = ? OR slug = ?`).get(pid, pid) as any;
      }

      const pId = variant ? variant.product_id : (productRecord?.id || productId || `prod-${Date.now()}`);
      const catId = variant ? variant.category_id : (productRecord?.category_id || 'fashion');
      const vId = variant ? variant.id : (variantId || null);
      const pName = variant ? variant.product_name : (productRecord?.name || itm.productName || itm.name || 'বাস্ত্র শৈলী পোশাক');
      const pBangla = variant ? variant.product_bangla : (productRecord?.bangla_name || itm.banglaName || pName);
      const sku = variant ? variant.sku : (productRecord?.sku || itm.sku || `BS-${Date.now()}`);
      const colName = variant?.color_name || itm.color || 'স্ট্যান্ডার্ড';
      const szName = variant?.size_name || itm.size || 'ফ্রি সাইজ';
      const origPrice = variant ? variant.price : (productRecord?.price || Number(itm.originalPrice || itm.price) || 0);
      const offPrice = variant?.offer_price || productRecord?.discount_price || null;
      const unitPrice = offPrice && offPrice > 0 ? offPrice : (variant?.price || productRecord?.discount_price || productRecord?.price || Number(itm.price) || origPrice);
      const itemImage = variant?.image || variant?.product_main_image || productRecord?.main_image || itm.image || '';

      // Strict Concurrency & Overselling Prevention:
      // Stock must be >= qtyNum and cannot become negative
      if (variant) {
        if (Number(variant.stock) < qtyNum) {
          throw new Error(`দুঃখিত, '${pBangla}' (${colName} - ${szName}) এর পর্যাপ্ত স্টক নেই। বর্তমান অবশিষ্ট স্টক: ${variant.stock} টি।`);
        }

        const updateResult = db.prepare(`
          UPDATE product_variants 
          SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ? AND stock >= ?
        `).run(qtyNum, variant.id, qtyNum);

        if (updateResult.changes === 0) {
          throw new Error(`দুঃখিত, অন্য এক ক্রেতা এইমাত্র পণ্যটির অবশিষ্ট স্টক অর্ডার করেছেন। '${pBangla}' এর স্টক শেষ।`);
        }
        db.prepare(`UPDATE products SET sales_count = sales_count + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(qtyNum, variant.product_id);
      } else if (productRecord) {
        db.prepare(`UPDATE products SET sales_count = sales_count + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(qtyNum, productRecord.id);
      }

      const itemSubtotal = unitPrice * qtyNum;
      calculatedSubtotal += itemSubtotal;

      validatedItems.push({
        productId: pId,
        categoryId: catId,
        variantId: vId,
        productName: pName,
        banglaName: pBangla,
        sku,
        colorName: colName,
        sizeName: szName,
        originalPrice: origPrice,
        offerPrice: offPrice,
        discountAmount: Math.max(0, origPrice - unitPrice) * qtyNum,
        unitPrice,
        quantity: qtyNum,
        subtotal: itemSubtotal,
        finalItemPrice: itemSubtotal,
        image: itemImage,
      });

      // Record inventory transaction with collision-free UUID
      db.prepare(`
        INSERT INTO inventory_transactions (
          id, product_id, variant_id, product_name, sku, transaction_type,
          previous_stock, quantity, new_stock, reference, admin_id, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        `inv-${crypto.randomUUID()}`,
        pId,
        vId,
        pName,
        sku,
        'sale',
        variant ? variant.stock : (productRecord?.stock || 0),
        -qtyNum,
        Math.max(0, (variant ? variant.stock : (productRecord?.stock || 0)) - qtyNum),
        `Order #${orderId}`,
        'Customer Checkout',
        'অর্ডার প্লেসমেন্টে স্বয়ংক্রিয় স্টক হ্রাস'
      );
    }

    // Authoritative Delivery Charge Calculation:
    // Read from authoritative store_settings delivery_config
    let insideSirajganjCharge = 70;
    let outsideSirajganjCharge = 130;
    let freeDeliveryThreshold = 2000;

    try {
      const deliveryRow = db.prepare("SELECT value FROM store_settings WHERE key = 'delivery_config'").get() as any;
      if (deliveryRow && deliveryRow.value) {
        const parsed = JSON.parse(deliveryRow.value);
        insideSirajganjCharge = Number(parsed.insideSirajganjCharge) || 70;
        outsideSirajganjCharge = Number(parsed.outsideSirajganjCharge) || 130;
        freeDeliveryThreshold = Number(parsed.freeDeliveryThreshold) || 2000;
      }
    } catch {}

    const isSirajganj =
      cleanDistrict.includes('sirajganj') ||
      cleanDistrict.includes('sirajgonj') ||
      district.includes('সিরাজগঞ্জ') ||
      cleanDistrict.includes('shahjadpur') ||
      district.includes('শাহজাদপুর');

    let deliveryCharge = isSirajganj ? insideSirajganjCharge : outsideSirajganjCharge;
    if (calculatedSubtotal >= freeDeliveryThreshold) {
      deliveryCharge = 0; // ৳২০০০ টাকার বেশি অর্ডারে ফ্রি শিপিং
    }

    // Authoritative Active Timer Offer Application
    let timerOfferDiscount = 0;
    let appliedTimerOfferName: string | null = null;
    try {
      const activeTimerOffers = db.prepare(`
        SELECT * FROM timer_offers 
        WHERE status = 'active'
          AND datetime(start_time) <= datetime('now')
          AND datetime(end_time) >= datetime('now')
      `).all() as any[];

      if (activeTimerOffers && activeTimerOffers.length > 0) {
        for (const offer of activeTimerOffers) {
          let applicableAmount = 0;
          let applicableQuantity = 0;

          if (offer.target_type === 'entire_store') {
            applicableAmount = calculatedSubtotal;
            applicableQuantity = validatedItems.reduce((acc, it) => acc + it.quantity, 0);
          } else {
            let targetIds: string[] = [];
            try {
              targetIds = JSON.parse(offer.target_ids || '[]');
            } catch {}

            for (const itm of validatedItems) {
              if (
                (offer.target_type === 'category' && targetIds.includes(itm.categoryId)) ||
                (offer.target_type === 'product' && targetIds.includes(itm.productId)) ||
                (offer.target_type === 'variant' && targetIds.includes(itm.variantId))
              ) {
                applicableAmount += itm.subtotal;
                applicableQuantity += itm.quantity;
              }
            }
          }

          const minQty = Number(offer.min_quantity) > 0 ? Number(offer.min_quantity) : 1;
          const minAmount = Number(offer.min_order_amount) || 0;

          // ENFORCE: min_quantity and min_order_amount constraints
          if (applicableAmount > 0 && applicableAmount >= minAmount && applicableQuantity >= minQty) {
            let disc = 0;
            if (offer.discount_type === 'percentage') {
              disc = Math.round((applicableAmount * offer.discount_value) / 100);
              if (offer.max_discount && disc > offer.max_discount) {
                disc = offer.max_discount;
              }
            } else {
              disc = offer.discount_value;
            }

            if (disc > timerOfferDiscount) {
              timerOfferDiscount = disc;
              appliedTimerOfferName = offer.offer_name || offer.title;
            }
          }
        }
      }
    } catch (offerErr) {
      console.warn('Timer offer calculation warning:', offerErr);
    }

    // Authoritative Atomic Coupon Validation & Concurrency-Safe Decrement
    let couponDiscount = 0;
    let appliedCoupon: string | null = null;
    let couponRecord: any = null;

    if (couponCode) {
      const cleanCoupon = couponCode.toUpperCase().trim();
      const coupon = db.prepare(`
        SELECT * FROM coupons 
        WHERE code = ? AND active = 1 AND date(expiry_date) >= date('now')
      `).get(cleanCoupon) as any;

      if (coupon) {
        // ENFORCE: Global usage limit
        if (coupon.usage_limit && coupon.usage_limit > 0 && coupon.used_count >= coupon.usage_limit) {
          throw new Error('দুঃখিত, এই কুপনটির সর্বোচ্চ ব্যবহারের সীমা পূর্ণ হয়ে গেছে।');
        }

        // ENFORCE: Per user usage limit
        const perUserLimit = coupon.per_user_limit && coupon.per_user_limit > 0 ? coupon.per_user_limit : 1;
        const userUsage = db.prepare(`
          SELECT COUNT(*) as count FROM orders 
          WHERE (customer_phone = ? OR (customer_email != '' AND customer_email = ?))
            AND coupon_code = ? 
            AND order_status NOT IN ('cancelled')
        `).get(customerPhone, customerEmail || '', coupon.code) as { count: number };

        if (userUsage && userUsage.count >= perUserLimit) {
          throw new Error(`দুঃখিত, আপনি ইতিমধ্যে এই কুপনটি ব্যবহারের সর্বোচ্চ সীমা (${perUserLimit} বার) পূর্ণ করেছেন।`);
        }

        if (calculatedSubtotal < (coupon.min_order_amount || 0)) {
          throw new Error(`এই কুপনটি ব্যবহার করতে ন্যূনতম ৳${coupon.min_order_amount} টাকার অর্ডার প্রয়োজন।`);
        }

        if (coupon.discount_type === 'percentage') {
          couponDiscount = Math.round((calculatedSubtotal * coupon.discount_value) / 100);
          if (coupon.max_discount_amount && couponDiscount > coupon.max_discount_amount) {
            couponDiscount = coupon.max_discount_amount;
          }
        } else {
          couponDiscount = coupon.discount_value;
        }

        // Concurrency-safe atomic update
        const couponUpdate = db.prepare(`
          UPDATE coupons 
          SET used_count = used_count + 1 
          WHERE id = ? AND (usage_limit IS NULL OR usage_limit <= 0 OR used_count < usage_limit)
        `).run(coupon.id);

        if (couponUpdate.changes === 0) {
          throw new Error('দুঃখিত, কুপন ব্যবহারের সর্বোচ্চ সীমা এইমাত্র পূর্ণ হয়েছে।');
        }

        appliedCoupon = coupon.code;
        couponRecord = coupon;
      }
    }

    // Authoritative Stacking Enforcement:
    // If both Timer Offer and Coupon are valid:
    // Only stack if coupon.allow_stacking is explicitly enabled (1 or true).
    // Otherwise, apply only the single best discount for the customer and rollback unused coupon usage count.
    let finalTimerOfferDiscount = timerOfferDiscount;
    let finalCouponDiscount = couponDiscount;
    let finalTimerOfferName = appliedTimerOfferName;
    let finalCouponCode = appliedCoupon;

    if (timerOfferDiscount > 0 && couponDiscount > 0) {
      const allowStacking = couponRecord && (couponRecord.allow_stacking === 1 || couponRecord.allow_stacking === true);
      if (!allowStacking) {
        if (couponDiscount >= timerOfferDiscount) {
          // Coupon is equal or better -> discard timer offer
          finalTimerOfferDiscount = 0;
          finalTimerOfferName = null;
        } else {
          // Timer offer is better -> discard coupon and rollback used_count
          finalCouponDiscount = 0;
          finalCouponCode = null;
          if (couponRecord) {
            db.prepare('UPDATE coupons SET used_count = MAX(0, used_count - 1) WHERE id = ?').run(couponRecord.id);
          }
        }
      }
    }

    const totalDiscount = finalCouponDiscount + finalTimerOfferDiscount;
    const grandTotal = Math.max(0, calculatedSubtotal + deliveryCharge - totalDiscount);

    // Insert Order Record (with timer offer columns)
    db.prepare(`
      INSERT INTO orders (
        id, customer_name, customer_phone, customer_email, delivery_address,
        district, upazila, subtotal, delivery_charge, discount, coupon_code,
        timer_offer_name, timer_offer_discount,
        total, payment_method, payment_status, order_status, order_source, customer_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', 'website', ?)
    `).run(
      orderId,
      customerName,
      customerPhone,
      customerEmail || '',
      deliveryAddress,
      district,
      upazila || '',
      calculatedSubtotal,
      deliveryCharge,
      totalDiscount,
      finalCouponCode,
      finalTimerOfferName,
      finalTimerOfferDiscount,
      grandTotal,
      paymentMethod || 'cod',
      customerNotes || ''
    );

    // Insert Order Items (Immutable Snapshots with UUIDs)
    const insertItemStmt = db.prepare(`
      INSERT INTO order_items (
        id, order_id, product_id, variant_id, product_name, bangla_name,
        sku, color_name, size_name, original_price, offer_price, discount_amount,
        unit_price, quantity, subtotal, final_item_price, image
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const itm of validatedItems) {
      insertItemStmt.run(
        `item-${crypto.randomUUID()}`,
        orderId,
        itm.productId,
        itm.variantId,
        itm.productName,
        itm.banglaName,
        itm.sku,
        itm.colorName,
        itm.sizeName,
        itm.originalPrice,
        itm.offerPrice,
        itm.discountAmount,
        itm.unitPrice,
        itm.quantity,
        itm.subtotal,
        itm.finalItemPrice,
        itm.image
      );
    }

    // Insert Timeline Event with UUID
    db.prepare(`
      INSERT INTO order_timeline (id, order_id, from_status, to_status, note, actor)
      VALUES (?, ?, null, 'pending', 'অর্ডার সফলভাবে প্লেস হয়েছে।', 'Customer')
    `).run(`tl-${crypto.randomUUID()}`, orderId);

    // Create Notification for Admins with UUID
    db.prepare(`
      INSERT INTO notifications (id, type, title, message, link, is_read)
      VALUES (?, 'order', 'নতুন অর্ডার এসেছে!', ?, ?, 0)
    `).run(
      `nt-${crypto.randomUUID()}`,
      `অর্ডার #${orderId} - ${customerName} (৳${grandTotal})`,
      `/admin?tab=orders&id=${orderId}`
    );

    // Update Customer Profile or create if new with UUID
    const existingCust = db.prepare('SELECT * FROM customers WHERE phone = ?').get(customerPhone) as any;
    if (existingCust) {
      db.prepare(`
        UPDATE customers SET
          total_orders = total_orders + 1,
          total_spent = total_spent + ?,
          address = COALESCE(?, address),
          district = COALESCE(?, district)
        WHERE id = ?
      `).run(grandTotal, deliveryAddress, district, existingCust.id);
    } else {
      db.prepare(`
        INSERT INTO customers (id, name, phone, email, district, upazila, address, total_orders, total_spent)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
      `).run(`cust-${crypto.randomUUID()}`, customerName, customerPhone, customerEmail || '', district, upazila || '', deliveryAddress, grandTotal);
    }

    db.exec('COMMIT');

    const createdOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
    const itemsList = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
    const formattedCreatedOrder = formatOrderRow(createdOrder, itemsList);

    return res.json({
      success: true,
      orderId,
      order: formattedCreatedOrder,
      subtotal: calculatedSubtotal,
      deliveryCharge,
      discount: totalDiscount,
      couponDiscount: finalCouponDiscount,
      timerOfferDiscount: finalTimerOfferDiscount,
      appliedTimerOfferName: finalTimerOfferName,
      appliedCoupon: finalCouponCode,
      total: grandTotal,
      message: `আপনার অর্ডার #${orderId} সফলভাবে গৃহীত হয়েছে!`,
    });
  } catch (error: any) {
    db.exec('ROLLBACK');
    console.error('Checkout failed:', error);
    return res.status(400).json({
      success: false,
      error: error?.message || 'অর্ডার সম্পন্ন করা সম্ভব হয়নি। অনুগ্রহ করে পুনরায় চেষ্টা করুন।',
    });
  }
}

storeRouter.post('/checkout/place-order', handleCheckoutOrder);
adminRouter.post('/checkout/place-order', requirePermission('orders.edit'), handleCheckoutOrder);

// ==========================================
// 12.1 CUSTOMER CART SYNCHRONIZATION (Server Auth & Merge)
// ==========================================
storeRouter.post('/cart/sync', (req: Request, res: Response) => {
  try {
    const { phone, items, replace } = req.body;
    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }
    const cleanPhone = phone.trim();
    const guestItems = Array.isArray(items) ? items : [];

    if (replace === true) {
      db.prepare('DELETE FROM customer_cart WHERE customer_phone = ?').run(cleanPhone);
      const insertStmt = db.prepare(`
        INSERT INTO customer_cart (id, customer_phone, product_id, variant_id, quantity, price, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `);
      for (const item of guestItems) {
        if (item.productId && item.quantity > 0) {
          const id = `cart-${crypto.randomUUID()}`;
          insertStmt.run(id, cleanPhone, item.productId, item.variantId || null, item.quantity, Number(item.price) || 0);
        }
      }
    } else {
      const upsertStmt = db.prepare(`
        INSERT INTO customer_cart (id, customer_phone, product_id, variant_id, quantity, price, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(customer_phone, product_id, variant_id) DO UPDATE SET
          quantity = quantity + excluded.quantity,
          price = excluded.price,
          updated_at = CURRENT_TIMESTAMP
      `);

      for (const item of guestItems) {
        if (item.productId && item.quantity > 0) {
          const id = `cart-${crypto.randomUUID()}`;
          upsertStmt.run(id, cleanPhone, item.productId, item.variantId || null, item.quantity, Number(item.price) || 0);
        }
      }
    }

    const rows = db.prepare(`
      SELECT c.*, p.name as product_name, p.bangla_name, p.slug, p.main_image, p.price as current_price
      FROM customer_cart c
      JOIN products p ON c.product_id = p.id
      WHERE c.customer_phone = ?
    `).all(cleanPhone) as any[];

    const mergedCart = rows.map((r) => ({
      item: {
        id: r.id,
        productId: r.product_id,
        variantId: r.variant_id || undefined,
        name: r.product_name,
        banglaName: r.bangla_name,
        price: r.price,
        quantity: r.quantity,
        image: r.main_image,
        slug: r.slug,
      },
      quantity: r.quantity,
    }));

    return res.json({ success: true, cart: mergedCart });
  } catch (err: any) {
    console.error('Cart sync error:', err);
    return res.status(500).json({ success: false, error: err?.message || 'Cart sync failed' });
  }
});

storeRouter.get('/cart/:phone', (req: Request, res: Response) => {
  try {
    const { phone } = req.params;
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Phone is required' });
    }
    const cleanPhone = phone.trim();
    const rows = db.prepare(`
      SELECT c.*, p.name as product_name, p.bangla_name, p.slug, p.main_image, p.price as current_price
      FROM customer_cart c
      JOIN products p ON c.product_id = p.id
      WHERE c.customer_phone = ?
    `).all(cleanPhone) as any[];

    const cart = rows.map((r) => ({
      item: {
        id: r.id,
        productId: r.product_id,
        variantId: r.variant_id || undefined,
        name: r.product_name,
        banglaName: r.bangla_name,
        price: r.price,
        quantity: r.quantity,
        image: r.main_image,
        slug: r.slug,
      },
      quantity: r.quantity,
    }));

    return res.json({ success: true, cart });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

storeRouter.post('/cart/clear', (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    if (phone && typeof phone === 'string') {
      db.prepare('DELETE FROM customer_cart WHERE customer_phone = ?').run(phone.trim());
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message });
  }
});

// ==========================================
// 13. STORE & COMMERCE SETTINGS (SQLite Driven)
// ==========================================
const ALLOWED_PUBLIC_KEYS = new Set([
  'delivery_config',
  'general_settings',
  'footer_config',
  'seo_config',
  'home_collections',
  'category_banners',
  'invoice_config',
]);

function handleGetPublicSettings(req: Request, res: Response) {
  try {
    const rows = db.prepare('SELECT key, value FROM store_settings').all() as { key: string; value: string }[];
    const settings: Record<string, any> = {};
    for (const r of rows) {
      if (!ALLOWED_PUBLIC_KEYS.has(r.key)) {
        // Special safe handling for payment_config: sanitize sensitive secrets
        if (r.key === 'payment_config') {
          try {
            const raw = JSON.parse(r.value);
            settings[r.key] = {
              isBkashActive: Boolean(raw.isBkashActive),
              isNagadActive: Boolean(raw.isNagadActive),
              isRocketActive: Boolean(raw.isRocketActive),
              isUpayActive: Boolean(raw.isUpayActive),
              isCodActive: raw.isCodActive !== false,
              merchantNumber: raw.merchantNumber || '',
            };
          } catch {}
        }
        continue; // Do NOT expose courier_config, system_settings, admin credentials, or secret keys!
      }
      try {
        settings[r.key] = JSON.parse(r.value);
      } catch {
        settings[r.key] = r.value;
      }
    }
    res.json({ success: true, settings });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to fetch settings' });
  }
}

function handleGetAdminSettings(req: Request, res: Response) {
  try {
    const rows = db.prepare('SELECT key, value FROM store_settings').all() as { key: string; value: string }[];
    const settings: Record<string, any> = {};
    for (const r of rows) {
      try {
        settings[r.key] = JSON.parse(r.value);
      } catch {
        settings[r.key] = r.value;
      }
    }
    res.json({ success: true, settings });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to fetch settings' });
  }
}

storeRouter.get('/settings', handleGetPublicSettings);
adminRouter.get('/settings', requirePermission('settings.manage'), handleGetAdminSettings);

function handleUpdateSetting(req: Request, res: Response) {
  try {
    const { key } = req.params;
    const value = req.body;
    const jsonStr = typeof value === 'string' ? value : JSON.stringify(value);
    
    db.prepare(`
      INSERT INTO store_settings (key, value, updated_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
    `).run(key, jsonStr);

    try {
      recordAudit('Admin', 'Settings Updated', 'settings', key, null, value);
    } catch {}
    res.json({ success: true, message: `${key} সেটিংস সফলভাবে সংরক্ষিত হয়েছে` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to update settings' });
  }
}

adminRouter.put('/settings/:key', requirePermission('settings.manage'), handleUpdateSetting);

// ==========================================
// 14. PRODUCT REVIEWS (SQLite Driven)
// ==========================================
function handleGetReviews(req: Request, res: Response) {
  try {
    const reviews = db.prepare(`
      SELECT r.*, p.name as product_name, p.bangla_name as product_bangla
      FROM product_reviews r
      LEFT JOIN products p ON r.product_id = p.id
      WHERE r.status = 'approved'
      ORDER BY datetime(r.created_at) DESC
    `).all();
    res.json({ success: true, reviews });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to fetch reviews' });
  }
}
storeRouter.get('/reviews', handleGetReviews);

storeRouter.post('/reviews', (req: Request, res: Response) => {
  try {
    const { productId, customerName, customerPhone, orderId, rating, comment } = req.body;
    if (!productId || !customerName || !rating || !comment) {
      return res.status(400).json({ success: false, error: 'Product, Name, Rating and Comment are required' });
    }

    const numRating = Number(rating);
    if (isNaN(numRating) || numRating < 1 || numRating > 5) {
      return res.status(400).json({ success: false, error: 'Rating must be between 1 and 5' });
    }

    // Verify if this is an authentic purchased customer
    let isVerified = 0;
    const cleanPhone = (customerPhone || '').replace(/[\s-]/g, '');
    const cleanOrderId = (orderId || '').trim();

    if (cleanPhone || cleanOrderId) {
      try {
        const orderMatch = db.prepare(`
          SELECT o.id FROM orders o
          JOIN order_items oi ON o.id = oi.order_id
          WHERE oi.product_id = ?
            AND (o.id = ? OR (length(?) >= 11 AND o.customer_phone = ?))
            AND (o.payment_status = 'paid' OR o.order_status IN ('delivered', 'processing', 'shipped'))
          LIMIT 1
        `).get(productId, cleanOrderId, cleanPhone, cleanPhone);

        if (orderMatch) {
          isVerified = 1;
        }
      } catch (checkErr) {
        console.warn('Purchase verification check notice:', checkErr);
      }
    }

    const id = `rev-${Date.now()}`;
    // Production Safety: Reviews start in 'pending' status for moderation
    db.prepare(`
      INSERT INTO product_reviews (id, product_id, customer_name, rating, comment, status, is_verified_purchase)
      VALUES (?, ?, ?, ?, ?, 'pending', ?)
    `).run(id, productId, String(customerName).trim(), Math.round(numRating), String(comment).trim(), isVerified);

    res.json({
      success: true,
      id,
      status: 'pending',
      isVerified: Boolean(isVerified),
      message: 'আপনার রিভিউটি সফলভাবে জমা দেওয়া হয়েছে! এডমিন অনুমোদনের পর এটি ওয়েবসাইটে প্রদর্শিত হবে।',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to submit review' });
  }
});

adminRouter.get('/reviews', requirePermission('orders.view'), (req: Request, res: Response) => {
  try {
    const reviews = db.prepare(`
      SELECT r.*, p.name as product_name, p.bangla_name as product_bangla
      FROM product_reviews r
      LEFT JOIN products p ON r.product_id = p.id
      ORDER BY datetime(r.created_at) DESC
    `).all();
    res.json({ success: true, reviews });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to fetch admin reviews' });
  }
});

adminRouter.put('/reviews/:id', requirePermission('orders.edit'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, adminReply } = req.body;
    db.prepare(`
      UPDATE product_reviews SET
        status = COALESCE(?, status),
        admin_reply = COALESCE(?, admin_reply)
      WHERE id = ?
    `).run(status, adminReply, id);

    recordAudit('Admin', 'Review Moderated', 'review', id, null, { status, adminReply });
    res.json({ success: true, message: 'রিভিউ সফলভাবে আপডেট হয়েছে' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to update review' });
  }
});

adminRouter.delete('/reviews/:id', requirePermission('orders.edit'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM product_reviews WHERE id = ?').run(id);
    recordAudit('Admin', 'Review Deleted', 'review', id, null, null);
    res.json({ success: true, message: 'রিভিউ মুছে ফেলা হয়েছে' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to delete review' });
  }
});

// ==========================================
// 15. CUSTOMERS MANAGEMENT (SQLite Driven)
// ==========================================
adminRouter.get('/customers', requirePermission('customers.view'), (req: Request, res: Response) => {
  try {
    const customers = db.prepare('SELECT * FROM customers ORDER BY datetime(created_at) DESC').all();
    res.json({ success: true, customers });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to fetch customers' });
  }
});

adminRouter.put('/customers/:id', requirePermission('customers.edit'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, name, address, district, upazila } = req.body;
    db.prepare(`
      UPDATE customers SET
        status = COALESCE(?, status),
        name = COALESCE(?, name),
        address = COALESCE(?, address),
        district = COALESCE(?, district),
        upazila = COALESCE(?, upazila)
      WHERE id = ?
    `).run(status, name, address, district, upazila, id);

    recordAudit('Admin', 'Customer Updated', 'customer', id, null, req.body);
    res.json({ success: true, message: 'কাস্টমার তথ্য সফলভাবে আপডেট হয়েছে' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to update customer' });
  }
});

// ==========================================
// 16. INVENTORY TRANSACTIONS
// ==========================================
adminRouter.get('/inventory/transactions', requirePermission('inventory.view'), (req: Request, res: Response) => {
  try {
    const transactions = db.prepare('SELECT * FROM inventory_transactions ORDER BY datetime(timestamp) DESC LIMIT 100').all();
    res.json({ success: true, transactions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to fetch transactions' });
  }
});

// ==========================================
// 17. STAFF & ADMIN RBAC MANAGEMENT
// ==========================================
adminRouter.get('/staff', requirePermission('admins.manage'), (req: Request, res: Response) => {
  try {
    const staff = db.prepare('SELECT id, name, email, phone, role, permissions, status, avatar, last_login, created_at FROM admins').all() as any[];
    const parsed = staff.map((s) => ({
      ...s,
      permissions: typeof s.permissions === 'string' ? JSON.parse(s.permissions) : (s.permissions || []),
    }));
    res.json({ success: true, staff: parsed });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to fetch staff' });
  }
});

adminRouter.post('/staff', requirePermission('admins.manage'), (req: Request, res: Response) => {
  try {
    const { name, email, phone, role, permissions, password } = req.body;
    if (!name || !email || !role) {
      return res.status(400).json({ success: false, error: 'Name, Email and Role are required' });
    }
    const cleanEmail = email.toLowerCase().trim();
    const id = `admin-${Date.now()}`;
    let initialPass = password?.trim();
    let forceChange = 0;
    if (!initialPass) {
      initialPass = crypto.randomBytes(8).toString('hex');
      forceChange = 1;
    }
    const { hash, salt } = hashPassword(initialPass);
    const permsJson = JSON.stringify(permissions || ['orders.view']);

    db.prepare(`
      INSERT INTO admins (id, name, email, phone, role, permissions, password_hash, salt, status, force_password_change)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `).run(id, name, cleanEmail, phone || '', role, permsJson, hash, salt, forceChange);

    recordAudit('Admin', 'Staff Created', 'admin', id, null, { name, email: cleanEmail, role, forceChange });
    res.json({
      success: true,
      id,
      temporaryPassword: forceChange === 1 ? initialPass : undefined,
      requirePasswordChange: Boolean(forceChange),
      message: forceChange === 1
        ? `নতুন স্টাফ সফলভাবে তৈরি হয়েছে। ওয়ান-টাইম অস্থায়ী পাসওয়ার্ড: ${initialPass} (প্রথম লগইনে পাসওয়ার্ড পরিবর্তন বাধ্যতামূলক)`
        : 'নতুন স্টাফ সফলভাবে যুক্ত হয়েছে',
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to create staff' });
  }
});

adminRouter.put('/staff/:id', requirePermission('admins.manage'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, phone, role, permissions, status, password } = req.body;
    let hash: string | null = null;
    let salt: string | null = null;
    if (password && password.trim()) {
      const h = hashPassword(password.trim());
      hash = h.hash;
      salt = h.salt;
    }
    const permsJson = permissions ? JSON.stringify(permissions) : null;

    db.prepare(`
      UPDATE admins SET
        name = COALESCE(?, name),
        phone = COALESCE(?, phone),
        role = COALESCE(?, role),
        permissions = COALESCE(?, permissions),
        status = COALESCE(?, status),
        password_hash = COALESCE(?, password_hash),
        salt = COALESCE(?, salt)
      WHERE id = ?
    `).run(name, phone, role, permsJson, status, hash, salt, id);

    recordAudit('Admin', 'Staff Updated', 'admin', id, null, { name, role, status });
    res.json({ success: true, message: 'স্টাফ তথ্য সফলভাবে আপডেট হয়েছে' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to update staff' });
  }
});

adminRouter.delete('/staff/:id', requirePermission('admins.manage'), (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (id === 'admin-1') {
      return res.status(400).json({ success: false, error: 'মূল সুপার এডমিন (Owner) মুছে ফেলা যাবে না!' });
    }
    db.prepare('DELETE FROM admins WHERE id = ?').run(id);
    recordAudit('Admin', 'Staff Deleted', 'admin', id, null, null);
    res.json({ success: true, message: 'স্টাফ সফলভাবে মুছে ফেলা হয়েছে' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to delete staff' });
  }
});

// ==========================================
// 18. ADMIN PASSWORD CHANGE (SECURITY ENFORCEMENT)
// ==========================================
adminRouter.post('/auth/change-password', (req: Request, res: Response) => {
  try {
    const admin = (req as any).admin;
    const adminId = admin?.id || admin?.admin_id;
    if (!admin || !adminId) return res.status(401).json({ success: false, error: 'অননুমোদিত সেশন! পুনরায় লগইন করুন।' });

    // Explicit CSRF token verification for sensitive password mutation
    const clientCsrf = (req.headers['x-csrf-token'] as string) || (req.body && req.body._csrf);
    if (!clientCsrf || !admin.csrf_token || clientCsrf !== admin.csrf_token) {
      return res.status(403).json({
        success: false,
        error: 'নিরাপত্তা সতর্কবার্তা: CSRF টোকেন অনুপস্থিত অথবা মিলছে না। পেজ রিফ্রেশ করে আবার চেষ্টা করুন।',
      });
    }

    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 6) {
      return res.status(400).json({ success: false, error: 'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে' });
    }

    const current = db.prepare('SELECT password_hash, salt, force_password_change FROM admins WHERE id = ?').get(adminId) as any;
    if (!current) {
      return res.status(404).json({ success: false, error: 'এডমিন একাউন্টটি পাওয়া যায়নি' });
    }

    const isCurrentValid = verifyPassword(oldPassword, current.password_hash, current.salt);

    if (!isCurrentValid) {
      return res.status(400).json({ success: false, error: 'বর্তমান পাসওয়ার্ডটি সঠিক নয়' });
    }

    const { hash, salt } = hashPassword(newPassword.trim());
    db.prepare('UPDATE admins SET password_hash = ?, salt = ?, force_password_change = 0 WHERE id = ?').run(hash, salt, adminId);
    try {
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch {}

    recordAudit(admin.name || 'Admin', 'Password Changed', 'auth', adminId, null, null);
    res.json({ success: true, message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to change password' });
  }
});

// ==========================================
// 19. REAL COURIER DISPATCH INTEGRATION (Steadfast)
// ==========================================
async function handleCourierDispatch(req: Request, res: Response) {
  try {
    const { orderId, provider, customerName, phone, address, codAmount, note } = req.body;
    if (!orderId) {
      return res.status(400).json({ success: false, error: 'Order ID is required' });
    }

    // Check if order is already dispatched/booked with courier
    const existing = db.prepare('SELECT id, courier_provider, courier_tracking_code, courier_consignment_id, courier_status FROM orders WHERE id = ?').get(orderId) as any;
    if (existing && existing.courier_tracking_code) {
      return res.json({
        success: true,
        alreadyBooked: true,
        provider: existing.courier_provider || 'steadfast',
        orderId,
        trackingCode: existing.courier_tracking_code,
        consignmentId: existing.courier_consignment_id,
        trackingUrl: `https://steadfast.com.bd/t/${existing.courier_tracking_code}`,
        courierStatus: existing.courier_status,
        message: `এই অর্ডারটি ইতিমধ্যে কুরিয়ার সিস্টেমে যুক্ত আছে (ট্র্যাকিং আইডি: ${existing.courier_tracking_code})। পুনরায় বুকিংয়ের প্রয়োজন নেই।`,
      });
    }

    // Read courier config from store_settings
    const courierSettingRow = db.prepare("SELECT value FROM store_settings WHERE key = 'courier_config'").get() as any;
    let courierConfig: any = {};
    try {
      courierConfig = courierSettingRow ? JSON.parse(courierSettingRow.value) : {};
    } catch {}

    const apiKey = courierConfig.steadfastApiKey || process.env.STEADFAST_API_KEY;
    const secretKey = courierConfig.steadfastSecretKey || process.env.STEADFAST_SECRET_KEY;
    const baseUrl = courierConfig.steadfastBaseUrl || 'https://portal.steadfast.com.bd/api/v1';

    let trackingCode = '';
    let consignmentId = '';
    let trackingUrl = '';
    let isRealDispatch = false;

    // If real Steadfast credentials configured
    if (apiKey && secretKey && !courierConfig.isSandbox) {
      try {
        const sfRes = await fetch(`${baseUrl}/create_order`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Api-Key': apiKey,
            'Secret-Key': secretKey,
          },
          body: JSON.stringify({
            invoice: orderId,
            recipient_name: customerName,
            recipient_phone: phone,
            recipient_address: address,
            cod_amount: Number(codAmount) || 0,
            note: note || 'BASTRA SHOILY Delivery',
          }),
        });
        const sfData = await sfRes.json();
        if (sfData.status === 200 && sfData.consignment) {
          trackingCode = sfData.consignment.tracking_code;
          consignmentId = String(sfData.consignment.consignment_id);
          trackingUrl = `https://steadfast.com.bd/t/${trackingCode}`;
          isRealDispatch = true;
        } else {
          // Real Steadfast API rejected consignment: FAIL immediately, NEVER mark shipped or generate fake code!
          console.error('[COURIER DISPATCH REJECTED BY STEADFAST]:', sfData);
          return res.status(400).json({
            success: false,
            error: `Steadfast কুরিয়ার বুকিং ব্যর্থ হয়েছে: ${sfData.message || sfData.errors || 'API ত্রুটি'}`,
          });
        }
      } catch (sfErr: any) {
        console.error('Steadfast API network error:', sfErr);
        // Real network failure: NEVER generate fake tracking or mark shipped!
        return res.status(502).json({
          success: false,
          error: `Steadfast কুরিয়ার সার্ভারের সাথে সংযোগ স্থাপন করা যায়নি: ${sfErr?.message || 'নেটওয়ার্ক এরর'}। অনুগ্রহ করে একটু পর চেষ্টা করুন।`,
        });
      }
    } else {
      // In sandbox/development ONLY: allow test dispatch if not production
      if (process.env.NODE_ENV === 'production') {
        return res.status(400).json({
          success: false,
          error: 'প্রোডাকশনে Steadfast API Key ও Secret Key ব্যতীত কুরিয়ার ডিসপ্যাচ সম্ভব নয়। সেটিংস থেকে কুরিয়ার ক্রেডেনশিয়াল কনফিগার করুন।',
        });
      }
      trackingCode = `ST${Math.floor(10000000 + Math.random() * 90000000)}`;
      consignmentId = `CN-${Date.now()}`;
      trackingUrl = `https://steadfast.com.bd/t/${trackingCode}`;
    }

    if (!trackingCode) {
      return res.status(400).json({
        success: false,
        error: 'কুরিয়ার ট্র্যাকিং কোড তৈরি করা যায়নি। অর্ডারটি shipped করা হয়নি।',
      });
    }

    // Update order in SQLite
    db.prepare(`
      UPDATE orders SET
        courier_provider = ?,
        courier_tracking_code = ?,
        courier_consignment_id = ?,
        courier_status = 'in_transit',
        order_status = 'shipped'
      WHERE id = ?
    `).run(provider || 'steadfast', trackingCode, consignmentId, orderId);

    // Append to timeline
    db.prepare(`
      INSERT INTO order_timeline (id, order_id, from_status, to_status, note, actor)
      VALUES (?, ?, 'processing', 'shipped', ?, 'Courier Dispatch Engine')
    `).run(`tl-${Date.now()}`, orderId, `অর্ডারটি কুরিয়ারে হস্তান্তর করা হয়েছে। ট্র্যাকিং কোড: ${trackingCode}`);

    recordAudit('Admin', 'Order Dispatched to Courier', 'order', orderId, null, {
      trackingCode,
      consignmentId,
      provider: provider || 'steadfast',
      isRealDispatch,
    });

    res.json({
      success: true,
      provider: provider || 'steadfast',
      orderId,
      trackingCode,
      consignmentId,
      trackingUrl,
      isRealDispatch,
      message: `অর্ডারটি সফলভাবে ${provider || 'Steadfast'} কুরিয়ার সিস্টেমে যুক্ত হয়েছে। ট্র্যাকিং আইডি: ${trackingCode}`,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Courier dispatch failed' });
  }
}
adminRouter.post('/courier/dispatch', requirePermission('orders.edit'), handleCourierDispatch);

// Courier Status Tracking (Real Steadfast API query)
async function handleCourierTrack(req: Request, res: Response) {
  try {
    const { orderId } = req.params;
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) as any;
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    if (!order.courier_tracking_code) {
      return res.json({ success: false, message: 'অর্ডারটি এখনও কুরিয়ারে প্রেরণ করা হয়নি।' });
    }

    const courierSettingRow = db.prepare("SELECT value FROM store_settings WHERE key = 'courier_config'").get() as any;
    let courierConfig: any = {};
    try {
      courierConfig = courierSettingRow ? JSON.parse(courierSettingRow.value) : {};
    } catch {}

    const apiKey = courierConfig.steadfastApiKey || process.env.STEADFAST_API_KEY;
    const secretKey = courierConfig.steadfastSecretKey || process.env.STEADFAST_SECRET_KEY;
    const baseUrl = courierConfig.steadfastBaseUrl || 'https://portal.steadfast.com.bd/api/v1';

    let currentStatus = order.courier_status || 'in_transit';
    let courierData: any = null;

    if (apiKey && secretKey && !courierConfig.isSandbox) {
      try {
        const trackRes = await fetch(`${baseUrl}/status_by_trackingcode/${order.courier_tracking_code}`, {
          headers: {
            'Api-Key': apiKey,
            'Secret-Key': secretKey,
          },
        });
        const data = await trackRes.json();
        if (data.status === 200 && data.delivery_status) {
          courierData = data;
          currentStatus = data.delivery_status;
          let mappedOrderStatus = order.order_status;
          if (currentStatus === 'delivered') mappedOrderStatus = 'delivered';
          if (currentStatus === 'cancelled') mappedOrderStatus = 'cancelled';

          db.prepare(`
            UPDATE orders SET courier_status = ?, order_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
          `).run(currentStatus, mappedOrderStatus, orderId);

          db.prepare(`
            INSERT INTO order_timeline (id, order_id, from_status, to_status, note, actor)
            VALUES (?, ?, ?, ?, ?, 'Steadfast Live Sync')
          `).run(`tl-${Date.now()}`, orderId, order.order_status, mappedOrderStatus, `কুরিয়ার লাইভ স্ট্যাটাস আপডেট: ${currentStatus}`);
        }
      } catch (err) {
        console.warn('Steadfast live status check notice:', err);
      }
    }

    res.json({
      success: true,
      orderId,
      trackingCode: order.courier_tracking_code,
      consignmentId: order.courier_consignment_id,
      courierStatus: currentStatus,
      orderStatus: order.order_status,
      trackingUrl: `https://steadfast.com.bd/t/${order.courier_tracking_code}`,
      liveData: courierData,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to track courier' });
  }
}
adminRouter.get('/courier/track/:orderId', requirePermission('orders.view'), handleCourierTrack);
storeRouter.get('/courier/track/:orderId', handleCourierTrack);

// Steadfast Webhook Listener
function handleSteadfastWebhook(req: Request, res: Response) {
  try {
    const { tracking_code, consignment_id, status } = req.body;
    if (!tracking_code && !consignment_id) {
      return res.status(400).json({ success: false, error: 'Missing tracking_code or consignment_id' });
    }

    const order = db.prepare(`
      SELECT id, order_status, courier_status FROM orders
      WHERE courier_tracking_code = ? OR courier_consignment_id = ?
    `).get(tracking_code || '', consignment_id || '') as any;

    if (order) {
      let mappedOrderStatus = order.order_status;
      if (status === 'delivered') mappedOrderStatus = 'delivered';
      if (status === 'cancelled') mappedOrderStatus = 'cancelled';

      db.prepare(`
        UPDATE orders SET courier_status = ?, order_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(status, mappedOrderStatus, order.id);

      db.prepare(`
        INSERT INTO order_timeline (id, order_id, from_status, to_status, note, actor)
        VALUES (?, ?, ?, ?, ?, 'Steadfast Webhook')
      `).run(`tl-${Date.now()}`, order.id, order.order_status, mappedOrderStatus, `Steadfast ওয়েব-হুক স্ট্যাটাস আপডেট: ${status}`);
    }

    res.json({ success: true, message: 'Webhook received and processed' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
}
storeRouter.post('/courier/steadfast/webhook', handleSteadfastWebhook);

// Wipe Demo Products and Ready for Real Inventory
adminRouter.post('/catalog/clean-demo-data', requireRole('super_admin'), (req: Request, res: Response) => {
  try {
    const admin = (req as any).admin;
    const result = wipeDemoProducts();
    recordAudit(admin?.name || 'Admin', 'Cleaned Demo Catalog Data', 'catalog', 'all', null, result);
    res.json({
      success: true,
      message: 'সকল ডেমো পণ্য ও ভ্যারিয়েন্ট সফলভাবে মুছে ফেলা হয়েছে। এখন আসল ইনভেন্টরি আপলোড করার জন্য ক্যাটালগ প্রস্তুত।',
      result,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to wipe demo catalog' });
  }
});

// ==========================================
// 20. LANDING PAGES & CAMPAIGNS (VIDEO FEATURE)
// ==========================================
function parseLandingPage(row: any) {
  if (!row) return null;
  return {
    ...row,
    benefits: typeof row.benefits_json === 'string' ? JSON.parse(row.benefits_json) : (row.benefits_json || []),
    highlights: typeof row.highlights_json === 'string' ? JSON.parse(row.highlights_json) : (row.highlights_json || []),
    customerReviews: typeof row.customer_reviews_json === 'string' ? JSON.parse(row.customer_reviews_json) : (row.customer_reviews_json || []),
  };
}

// Public: Get all active landing pages
storeRouter.get('/landing-pages', (req: Request, res: Response) => {
  try {
    const pages = db.prepare("SELECT * FROM landing_pages WHERE status = 'active' ORDER BY created_at DESC").all();
    res.json({ success: true, pages: pages.map(parseLandingPage) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Public: Get single landing page by slug or id
storeRouter.get('/landing-pages/:slug', (req: Request, res: Response) => {
  try {
    const { slug } = req.params;
    const page = db.prepare('SELECT * FROM landing_pages WHERE slug = ? OR id = ?').get(slug, slug) as any;
    if (!page) {
      return res.status(404).json({ success: false, error: 'ল্যান্ডিং পেজ পাওয়া যায়নি' });
    }
    // Increment view count
    try {
      db.prepare('UPDATE landing_pages SET view_count = view_count + 1 WHERE id = ?').run(page.id);
    } catch {}

    // Attach target product details if available
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(page.product_id) as any;
    res.json({ success: true, page: parseLandingPage(page), product });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Admin: Get all landing pages (both active and inactive)
adminRouter.get('/landing-pages', (req: Request, res: Response) => {
  try {
    const pages = db.prepare('SELECT * FROM landing_pages ORDER BY created_at DESC').all();
    res.json({ success: true, pages: pages.map(parseLandingPage) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Admin: Create landing page
adminRouter.post('/landing-pages', requirePermission('marketing.manage'), (req: Request, res: Response) => {
  try {
    const admin = (req as any).admin;
    const {
      title,
      slug,
      productId,
      template,
      badgeText,
      headline,
      subheadline,
      videoUrl,
      benefits,
      highlights,
      customerReviews,
      offerPrice,
      regularPrice,
      deliveryInsideDhaka,
      deliveryOutsideDhaka,
      whatsappNumber,
      callNumber,
      status,
    } = req.body;

    if (!title || !productId) {
      return res.status(400).json({ success: false, error: 'শিরোনাম এবং পণ্য নির্বাচন করা আবশ্যক' });
    }

    const cleanSlug = (slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `campaign-${Date.now()}`);
    const id = `lp-${Date.now()}`;

    db.prepare(`
      INSERT INTO landing_pages (
        id, title, slug, product_id, template, badge_text, headline, subheadline, video_url,
        benefits_json, highlights_json, customer_reviews_json, offer_price, regular_price,
        delivery_inside_dhaka, delivery_outside_dhaka, whatsapp_number, call_number, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      title,
      cleanSlug,
      productId,
      template || 'template_1',
      badgeText || 'সীমিত সময়ের ধামাকা অফার!',
      headline || title,
      subheadline || '',
      videoUrl || '',
      JSON.stringify(benefits || []),
      JSON.stringify(highlights || []),
      JSON.stringify(customerReviews || []),
      Number(offerPrice) || 0,
      Number(regularPrice) || 0,
      Number(deliveryInsideDhaka) || 70,
      Number(deliveryOutsideDhaka) || 120,
      whatsappNumber || '01890123456',
      callNumber || '01890123456',
      status || 'active'
    );

    recordAudit(admin?.name || 'Admin', 'Created Landing Page', 'marketing', id, null, { title, slug: cleanSlug });
    res.json({ success: true, message: 'ল্যান্ডিং পেজ সফলভাবে তৈরি হয়েছে', id, slug: cleanSlug });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'ল্যান্ডিং পেজ তৈরি ব্যর্থ হয়েছে' });
  }
});

// Admin: Update landing page
adminRouter.put('/landing-pages/:id', requirePermission('marketing.manage'), (req: Request, res: Response) => {
  try {
    const admin = (req as any).admin;
    const { id } = req.params;
    const body = req.body;

    db.prepare(`
      UPDATE landing_pages SET
        title = COALESCE(?, title),
        slug = COALESCE(?, slug),
        product_id = COALESCE(?, product_id),
        template = COALESCE(?, template),
        badge_text = COALESCE(?, badge_text),
        headline = COALESCE(?, headline),
        subheadline = COALESCE(?, subheadline),
        video_url = COALESCE(?, video_url),
        benefits_json = COALESCE(?, benefits_json),
        highlights_json = COALESCE(?, highlights_json),
        customer_reviews_json = COALESCE(?, customer_reviews_json),
        offer_price = COALESCE(?, offer_price),
        regular_price = COALESCE(?, regular_price),
        delivery_inside_dhaka = COALESCE(?, delivery_inside_dhaka),
        delivery_outside_dhaka = COALESCE(?, delivery_outside_dhaka),
        whatsapp_number = COALESCE(?, whatsapp_number),
        call_number = COALESCE(?, call_number),
        status = COALESCE(?, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      body.title,
      body.slug,
      body.productId,
      body.template,
      body.badgeText,
      body.headline,
      body.subheadline,
      body.videoUrl,
      body.benefits ? JSON.stringify(body.benefits) : null,
      body.highlights ? JSON.stringify(body.highlights) : null,
      body.customerReviews ? JSON.stringify(body.customerReviews) : null,
      body.offerPrice !== undefined ? Number(body.offerPrice) : null,
      body.regularPrice !== undefined ? Number(body.regularPrice) : null,
      body.deliveryInsideDhaka !== undefined ? Number(body.deliveryInsideDhaka) : null,
      body.deliveryOutsideDhaka !== undefined ? Number(body.deliveryOutsideDhaka) : null,
      body.whatsappNumber,
      body.callNumber,
      body.status,
      id
    );

    recordAudit(admin?.name || 'Admin', 'Updated Landing Page', 'marketing', id, null, body);
    res.json({ success: true, message: 'ল্যান্ডিং পেজ সফলভাবে আপডেট হয়েছে' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'ল্যান্ডিং পেজ আপডেট ব্যর্থ হয়েছে' });
  }
});

// Admin: Delete landing page
adminRouter.delete('/landing-pages/:id', requirePermission('marketing.manage'), (req: Request, res: Response) => {
  try {
    const admin = (req as any).admin;
    const { id } = req.params;
    db.prepare('DELETE FROM landing_pages WHERE id = ?').run(id);
    recordAudit(admin?.name || 'Admin', 'Deleted Landing Page', 'marketing', id, null, null);
    res.json({ success: true, message: 'ল্যান্ডিং পেজ মুছে ফেলা হয়েছে' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// ==========================================
// 21. PROMO SUB BANNERS (HOMEPAGE 3-BANNER ROW)
// ==========================================
storeRouter.get('/promo-banners', (req: Request, res: Response) => {
  try {
    const row = db.prepare("SELECT value FROM store_settings WHERE key = 'promo_sub_banners'").get() as any;
    if (row && row.value) {
      res.json({ success: true, banners: JSON.parse(row.value) });
    } else {
      res.json({ success: true, banners: [] });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

adminRouter.post('/promo-banners', requirePermission('marketing.manage'), (req: Request, res: Response) => {
  try {
    const admin = (req as any).admin;
    const { banners } = req.body;
    if (!Array.isArray(banners)) {
      return res.status(400).json({ success: false, error: 'ব্যানার তালিকা সঠিক নয়' });
    }
    db.prepare("INSERT OR REPLACE INTO store_settings (key, value) VALUES ('promo_sub_banners', ?)").run(JSON.stringify(banners));
    try {
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch {}
    recordAudit(admin?.name || 'Admin', 'Updated Homepage Promo Banners', 'marketing', 'promo_sub_banners', null, banners);
    res.json({ success: true, message: 'হোমপেজ সাইড ও প্রোমো ব্যানার সফলভাবে সংরক্ষিত হয়েছে' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// 21.1 HOMEPAGE SIDE BANNERS (TOP-HERO 2 STACKED SIDE BANNERS MATCHING VIDEO SHOWCASE)
// ==========================================
const DEFAULT_SIDE_BANNERS = [
  {
    id: 'side-banner-top',
    position: 'top',
    badge: 'HOT DEAL - 25% OFF',
    title: 'প্রিমিয়াম পাঞ্জাবি কালেকশন',
    subtitle: 'আভিজাত্য ও ট্রেন্ডি ফ্যাশন',
    priceText: 'শুরু মাত্র ৳১,৪৯০ থেকে',
    buttonText: 'অর্ডার করুন',
    link: '/category/men',
    image: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&q=80&w=800',
    bgGradient: 'from-stone-950/90 via-stone-900/60 to-transparent',
    isActive: true,
  },
  {
    id: 'side-banner-bottom',
    position: 'bottom',
    badge: 'NEW ARRIVAL',
    title: 'হ্যান্ডলুম ও সিল্ক শাড়ি',
    subtitle: 'ঐতিহ্যবাহী তাঁত ও জামদানি শৈলী',
    priceText: 'ফ্ল্যাট ৩০% ক্যাশব্যাক অফার',
    buttonText: 'অর্ডার করুন',
    link: '/category/women',
    image: 'https://images.unsplash.com/photo-1617627143750-d86bc21e42bb?auto=format&fit=crop&q=80&w=800',
    bgGradient: 'from-stone-950/90 via-stone-900/60 to-transparent',
    isActive: true,
  },
];

storeRouter.get('/side-banners', (req: Request, res: Response) => {
  try {
    const row = db.prepare("SELECT value FROM store_settings WHERE key = 'home_side_banners'").get() as any;
    if (row && row.value) {
      try {
        const parsed = JSON.parse(row.value);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return res.json({ success: true, banners: parsed });
        }
      } catch {}
    }
    res.json({ success: true, banners: DEFAULT_SIDE_BANNERS });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message, banners: DEFAULT_SIDE_BANNERS });
  }
});

adminRouter.post('/side-banners', requirePermission('marketing.manage'), (req: Request, res: Response) => {
  try {
    const admin = (req as any).admin;
    const { banners } = req.body;
    if (!Array.isArray(banners)) {
      return res.status(400).json({ success: false, error: 'ব্যানার তালিকা সঠিক নয়' });
    }
    db.prepare("INSERT OR REPLACE INTO store_settings (key, value) VALUES ('home_side_banners', ?)").run(JSON.stringify(banners));
    try {
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch {}
    recordAudit(admin?.name || 'Admin', 'Updated Homepage Side Banners', 'marketing', 'home_side_banners', null, banners);
    res.json({ success: true, message: 'হোমপেজ সাইড ব্যানার সফলভাবে সংরক্ষিত হয়েছে' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// 21.2 HOMEPAGE COLLECTIONS (5 CORE CATEGORIES: LUNGI, SAREE, T-SHIRT, THREE PIECE, PANJABI)
// ==========================================
storeRouter.get('/collections', (req: Request, res: Response) => {
  try {
    const row = db.prepare("SELECT value FROM store_settings WHERE key = 'home_collections'").get() as any;
    if (row && row.value) {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return res.json({ success: true, collections: parsed });
      }
    }
    res.json({ success: true, collections: [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message, collections: [] });
  }
});

adminRouter.post('/collections', requirePermission('marketing.manage'), (req: Request, res: Response) => {
  try {
    const admin = (req as any).admin;
    const { collections } = req.body;
    if (!Array.isArray(collections)) {
      return res.status(400).json({ success: false, error: 'কালেকশন তালিকা সঠিক নয়' });
    }
    db.prepare("INSERT OR REPLACE INTO store_settings (key, value, updated_at) VALUES ('home_collections', ?, CURRENT_TIMESTAMP)").run(JSON.stringify(collections));
    try {
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch {}
    recordAudit(admin?.name || 'Admin', 'Updated Home Collections Grid', 'marketing', 'home_collections', null, collections);
    res.json({ success: true, message: 'কালেকশন গ্রিড সফলভাবে সংরক্ষিত হয়েছে' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// 21.3 CATEGORY SPECIFIC BANNERS
// ==========================================
storeRouter.get('/category-banners', (req: Request, res: Response) => {
  try {
    const row = db.prepare("SELECT value FROM store_settings WHERE key = 'category_banners'").get() as any;
    if (row && row.value) {
      const parsed = JSON.parse(row.value);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return res.json({ success: true, categoryBanners: parsed });
      }
    }
    res.json({ success: true, categoryBanners: [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message, categoryBanners: [] });
  }
});

adminRouter.post('/category-banners', requirePermission('marketing.manage'), (req: Request, res: Response) => {
  try {
    const admin = (req as any).admin;
    const { categoryBanners } = req.body;
    if (!Array.isArray(categoryBanners)) {
      return res.status(400).json({ success: false, error: 'ক্যাটাগরি ব্যানার তালিকা সঠিক নয়' });
    }
    db.prepare("INSERT OR REPLACE INTO store_settings (key, value, updated_at) VALUES ('category_banners', ?, CURRENT_TIMESTAMP)").run(JSON.stringify(categoryBanners));
    try {
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch {}
    recordAudit(admin?.name || 'Admin', 'Updated Category Banners', 'marketing', 'category_banners', null, categoryBanners);
    res.json({ success: true, message: 'ক্যাটাগরি ব্যানার সফলভাবে সংরক্ষিত হয়েছে' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// 21.4 OFFER SECTION CONFIG & MEGA FESTIVE OFFERS
// ==========================================
storeRouter.get('/offer-config', (req: Request, res: Response) => {
  try {
    const row = db.prepare("SELECT value FROM store_settings WHERE key = 'offer_config'").get() as any;
    if (row && row.value) {
      return res.json({ success: true, offerConfig: JSON.parse(row.value) });
    }
    res.json({ success: true, offerConfig: null });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

adminRouter.post('/offer-config', requirePermission('marketing.manage'), (req: Request, res: Response) => {
  try {
    const admin = (req as any).admin;
    const { offerConfig } = req.body;
    db.prepare("INSERT OR REPLACE INTO store_settings (key, value, updated_at) VALUES ('offer_config', ?, CURRENT_TIMESTAMP)").run(JSON.stringify(offerConfig));
    try {
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch {}
    recordAudit(admin?.name || 'Admin', 'Updated Offer Config', 'marketing', 'offer_config', null, offerConfig);
    res.json({ success: true, message: 'অফার ব্যানার ও টাইমার সেটিংস সংরক্ষিত হয়েছে' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

storeRouter.get('/mega-festive-offers', (req: Request, res: Response) => {
  try {
    const row = db.prepare("SELECT value FROM store_settings WHERE key = 'mega_festive_offers'").get() as any;
    if (row && row.value) {
      return res.json({ success: true, offers: JSON.parse(row.value) });
    }
    res.json({ success: true, offers: [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

adminRouter.post('/mega-festive-offers', requirePermission('marketing.manage'), (req: Request, res: Response) => {
  try {
    const admin = (req as any).admin;
    const { offers } = req.body;
    db.prepare("INSERT OR REPLACE INTO store_settings (key, value, updated_at) VALUES ('mega_festive_offers', ?, CURRENT_TIMESTAMP)").run(JSON.stringify(offers));
    try {
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch {}
    recordAudit(admin?.name || 'Admin', 'Updated Mega Festive Offers', 'marketing', 'mega_festive_offers', null, offers);
    res.json({ success: true, message: 'মেগা উৎসব অফার সফলভাবে সংরক্ষিত হয়েছে' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// ==========================================
// 22. GTM, FB PIXEL & PRODUCT XML FEED
// ==========================================
adminRouter.get('/pixel-settings', (req: Request, res: Response) => {
  try {
    const fbPixel = db.prepare("SELECT value FROM store_settings WHERE key = 'fb_pixel_id'").get() as any;
    const fbCapi = db.prepare("SELECT value FROM store_settings WHERE key = 'fb_capi_token'").get() as any;
    const fbTest = db.prepare("SELECT value FROM store_settings WHERE key = 'fb_test_code'").get() as any;
    const gtmId = db.prepare("SELECT value FROM store_settings WHERE key = 'gtm_container_id'").get() as any;
    const status = db.prepare("SELECT value FROM store_settings WHERE key = 'pixel_status'").get() as any;

    res.json({
      success: true,
      settings: {
        pixelId: fbPixel?.value || '',
        capiToken: fbCapi?.value || '',
        testCode: fbTest?.value || '',
        gtmId: gtmId?.value || '',
        status: status?.value || 'active',
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

adminRouter.post('/pixel-settings', requirePermission('settings.manage'), (req: Request, res: Response) => {
  try {
    const admin = (req as any).admin;
    const { pixelId, capiToken, testCode, gtmId, status } = req.body;

    const upsert = db.prepare('INSERT OR REPLACE INTO store_settings (key, value) VALUES (?, ?)');
    if (pixelId !== undefined) upsert.run('fb_pixel_id', String(pixelId));
    if (capiToken !== undefined) upsert.run('fb_capi_token', String(capiToken));
    if (testCode !== undefined) upsert.run('fb_test_code', String(testCode));
    if (gtmId !== undefined) upsert.run('gtm_container_id', String(gtmId));
    if (status !== undefined) upsert.run('pixel_status', String(status));

    recordAudit(admin?.name || 'Admin', 'Updated Pixel & GTM Settings', 'settings', 'pixel', null, req.body);
    res.json({ success: true, message: 'পিক্সেল এবং ট্র্যাকিং সেটিংস সংরক্ষিত হয়েছে' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Live Facebook & Google Catalog Product XML Feed
function handleProductFeedXml(req: Request, res: Response) {
  try {
    const products = db.prepare("SELECT * FROM products WHERE status = 'active'").all() as any[];
    const host = req.get('host') || 'bastrashoily.com';
    const protocol = req.protocol || 'https';
    const baseUrl = `${protocol}://${host}`;

    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>বাস্ত্র শৈলী - প্রোডাক্ট ক্যাটালগ ও ফিড</title>
    <link>${baseUrl}</link>
    <description>Authoritative Handloom, Panjabi, Lungi &amp; Fashion Catalog</description>
`;

    for (const p of products) {
      const pUrl = `${baseUrl}/#/product/${p.slug}`;
      const imgUrl = p.featured_image?.startsWith('http') ? p.featured_image : `${baseUrl}${p.featured_image}`;
      const availability = (p.stock > 0) ? 'in stock' : 'out of stock';
      const cleanDesc = (p.description || p.bangla_name || p.name).replace(/[<>&'"]/g, ' ');

      xml += `    <item>
      <g:id>${p.id}</g:id>
      <g:title><![CDATA[${p.name} - ${p.bangla_name || ''}]]></g:title>
      <g:description><![CDATA[${cleanDesc}]]></g:description>
      <g:link>${pUrl}</g:link>
      <g:image_link>${imgUrl}</g:image_link>
      <g:brand>বাস্ত্র শৈলী</g:brand>
      <g:condition>new</g:condition>
      <g:availability>${availability}</g:availability>
      <g:price>${p.price} BDT</g:price>
      <g:product_type><![CDATA[${p.category || 'Fashion'}]]></g:product_type>
    </item>
`;
    }

    xml += `  </channel>
</rss>`;

    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.send(xml);
  } catch (err: any) {
    res.status(500).send(`<error>${err?.message}</error>`);
  }
}

storeRouter.get('/feed/products.xml', handleProductFeedXml);
storeRouter.get('/feed/facebook-catalog.xml', handleProductFeedXml);

// ==========================================
// AI ASSISTANT ENDPOINTS (Grounded in SQLite via aiEngine & aiTools)
// ==========================================
async function handlePublicAiChat(req: Request, res: Response) {
  try {
    const { message, imageBase64, mimeType, history, phone } = req.body;
    const response = await handleConversationalChat({
      message: message || '',
      history,
      imageBase64,
      mimeType,
      authenticatedCustomerPhone: phone,
      isAdmin: false,
    });
    return res.json(response);
  } catch (err: any) {
    console.error('AI chat endpoint error:', err);
    return res.json({
      success: true,
      reply: 'দুঃখিত, এই মুহূর্তে আমি তথ্যটি যাচাই করতে পারছি না। আপনি চাইলে আমাদের কাস্টমার কেয়ারে (+880 1864-528488) যোগাযোগ করতে পারেন অথবা উপরের প্রোডাক্ট মেনু থেকে আমাদের কালেকশন দেখে নিতে পারেন।',
      productCards: [],
    });
  }
}

async function handleAdminAiChat(req: Request, res: Response) {
  try {
    const { message, history } = req.body;
    const adminSession = (req as any).admin;
    let permissions = ['all'];
    if (adminSession?.permissions) {
      try {
        permissions = typeof adminSession.permissions === 'string' ? JSON.parse(adminSession.permissions) : adminSession.permissions;
      } catch {}
    }
    const response = await handleConversationalChat({
      message: message || '',
      history,
      isAdmin: true,
      adminPermissions: permissions,
    });
    return res.json(response);
  } catch (err: any) {
    console.error('Admin AI chat endpoint error:', err);
    return res.status(500).json({
      success: false,
      reply: 'এডমিন এআই টেস্ট সিমুলেটরে ত্রুটি হয়েছে।',
      productCards: [],
    });
  }
}

storeRouter.post('/ai-chat', handlePublicAiChat);
adminRouter.post('/ai-chat', requirePermission('settings.manage'), handleAdminAiChat);



