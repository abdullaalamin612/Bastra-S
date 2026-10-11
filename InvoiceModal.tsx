import React, { useEffect } from 'react';
import { useShop } from '../context/ShopContext';
import { Logo } from './Logo';
import {
  Printer,
  X,
  Download,
  ArrowLeft,
  Truck,
  MapPin,
  Phone,
  Mail,
  Calendar,
  ShieldCheck,
  ShoppingBasket,
  ExternalLink,
} from 'lucide-react';

export const InvoiceModal: React.FC = () => {
  const {
    activeInvoiceOrder,
    closeInvoiceModal,
    footerConfig,
    invoiceConfig,
    products,
    navigateToHome,
    navigateToTracking,
    showToast,
  } = useShop();

  // Close on Escape key press
  useEffect(() => {
    if (!activeInvoiceOrder) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeInvoiceModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeInvoiceOrder, closeInvoiceModal]);

  if (!activeInvoiceOrder) return null;

  const order = activeInvoiceOrder;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    try {
      const printableElement = document.getElementById('printable-invoice-content');
      if (!printableElement) {
        window.print();
        return;
      }

      // Generate a standalone, self-contained printable HTML document
      const invoiceHtml = `
<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <title>Invoice-${order.id} - BASTRA SHOILY</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background: #fff; color: #1c1917; padding: 24px; font-size: 13px; line-height: 1.5; }
    .invoice-card { max-width: 800px; margin: 0 auto; border: 1px solid #e7e5e4; border-radius: 12px; padding: 32px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1c1917; padding-bottom: 20px; margin-bottom: 24px; }
    .brand-title { font-size: 24px; font-weight: 900; letter-spacing: 1px; color: #1c1917; text-transform: uppercase; }
    .brand-subtitle { font-size: 11px; font-weight: bold; color: #b45309; letter-spacing: 2px; }
    .brand-meta { font-size: 11px; color: #78716c; margin-top: 6px; line-height: 1.6; }
    .invoice-badge { background: #1c1917; color: #fff; font-family: monospace; font-size: 16px; font-weight: bold; padding: 6px 14px; border-radius: 6px; display: inline-block; margin-bottom: 8px; }
    .date-row { font-size: 12px; color: #57534e; margin-bottom: 4px; }
    .status-tag { display: inline-block; background: #ecfdf5; color: #047857; font-weight: bold; padding: 3px 10px; border-radius: 12px; border: 1px solid #a7f3d0; font-size: 11px; }
    .customer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 8px; padding: 16px; margin-bottom: 24px; }
    .sec-title { font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #78716c; margin-bottom: 6px; }
    .cust-name { font-size: 15px; font-weight: bold; color: #1c1917; }
    .cust-line { font-size: 12px; color: #44403c; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; border: 1px solid #e7e5e4; border-radius: 8px; overflow: hidden; }
    th { background: #1c1917; color: #fff; text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; font-weight: 700; }
    td { padding: 12px; border-bottom: 1px solid #e7e5e4; font-size: 12px; }
    tr:last-child td { border-bottom: none; }
    .totals-area { display: flex; justify-content: space-between; align-items: flex-start; margin-top: 16px; }
    .terms { max-width: 320px; font-size: 11px; color: #78716c; line-height: 1.6; }
    .totals-box { width: 260px; font-size: 12px; }
    .totals-row { display: flex; justify-content: space-between; padding: 4px 0; color: #57534e; }
    .grand-total { border-top: 2px solid #1c1917; margin-top: 8px; padding-top: 8px; font-size: 16px; font-weight: 900; color: #1c1917; display: flex; justify-content: space-between; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e7e5e4; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #78716c; }
    .signature { text-align: right; font-style: italic; font-size: 13px; font-weight: bold; color: #1c1917; border-top: 1px solid #1c1917; padding-top: 4px; margin-top: 16px; }
    @media print {
      body { padding: 0; }
      .invoice-card { border: none; padding: 0; }
    }
  </style>
</head>
<body>
  <div class="invoice-card">
    ${printableElement.innerHTML}
  </div>
  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 300);
    };
  </script>
</body>
</html>
      `;

      // Trigger direct download of clean standalone HTML invoice
      const blob = new Blob([invoiceHtml], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Invoice-${order.id}-Bastra-Shoily.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      showToast('ইনভয়েস ফাইল ডাউনলোড সম্পন্ন হয়েছে');
    } catch (err: any) {
      console.warn('PDF download fallback to print:', err);
      window.print();
    }
  };

  const handleBackToShopping = () => {
    closeInvoiceModal();
    navigateToHome();
  };

  const handleTrackOrder = () => {
    closeInvoiceModal();
    navigateToTracking();
  };

  return (
    <div
      id="invoice-modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeInvoiceModal();
        }
      }}
      className="fixed inset-0 z-50 overflow-y-auto bg-stone-950/75 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-stone-200 w-full max-w-3xl overflow-hidden my-auto flex flex-col max-h-[96vh]">
        {/* Top Header / Action Bar */}
        <div className="no-print bg-stone-900 text-white px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between shrink-0 shadow-md gap-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={handleBackToShopping}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 hover:text-white text-xs font-bold transition-all border border-stone-700 cursor-pointer shadow-xs active:scale-95"
              title="হোমে ফিরে যান"
            >
              <ArrowLeft className="w-4 h-4 text-amber-400" />
              <span>হোমে ফিরুন</span>
            </button>
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0" />
              <span className="font-bold text-xs sm:text-base tracking-tight line-clamp-1">
                ইনভয়েস #{order.id}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Print Button */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 font-black px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm transition-all shadow-md active:scale-95 cursor-pointer"
              title="প্রিন্ট করুন"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden md:inline">প্রিন্ট (Print)</span>
            </button>

            {/* Quick Download PDF Button */}
            <button
              onClick={handleDownloadPdf}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm transition-all shadow-md active:scale-95 cursor-pointer"
              title="ডাউনলোড করুন"
            >
              <Download className="w-4 h-4" />
              <span className="hidden md:inline">ডাউনলোড</span>
            </button>

            {/* Close Button */}
            <button
              onClick={closeInvoiceModal}
              className="p-2 text-stone-400 hover:text-white rounded-xl hover:bg-stone-800 transition-colors cursor-pointer"
              aria-label="Close"
              title="বন্ধ করুন"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Invoice Body (Scrollable) */}
        <div className="overflow-y-auto flex-1 p-5 sm:p-8 md:p-10 bg-white text-stone-900 text-sm">
          <div id="printable-invoice-content" className="bg-white">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-stone-800 pb-6 gap-6">
              <div>
                <Logo />
                <p className="text-xs text-stone-600 mt-2 max-w-xs">{footerConfig.address}</p>
                <p className="text-xs text-stone-600">হটলাইন: {footerConfig.phone}</p>
                <p className="text-xs text-stone-600">ইমেইল: {footerConfig.email}</p>
                <p className="text-xs font-mono text-stone-500 mt-1">ওয়েবসাইট: bastrashoily.com</p>
              </div>

              <div className="text-left sm:text-right">
                <div className="inline-block bg-stone-900 text-white font-mono font-bold px-3 py-1 rounded-lg text-base sm:text-lg mb-2">
                  INVOICE #{order.id}
                </div>
                <p className="text-xs text-stone-600 flex items-center sm:justify-end gap-1">
                  <Calendar className="w-3.5 h-3.5 text-stone-400" />
                  <span>তারিখ: {order.orderDate || (order as any).order_date || new Date().toLocaleDateString('bn-BD')}</span>
                </p>
                <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <span>স্ট্যাটাস: {(order.orderStatus || (order as any).order_status || 'CONFIRMED').toUpperCase()}</span>
                </div>
              </div>
            </div>

            {/* Customer & Delivery Information */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 my-6 p-4 sm:p-5 bg-stone-50 rounded-2xl border border-stone-200/90">
              <div>
                <h4 className="text-xs font-black text-stone-500 uppercase tracking-wider mb-2">
                  গ্রাহকের তথ্য (Bill To):
                </h4>
                <p className="font-bold text-stone-900 text-base">{order.customerName}</p>
                <p className="text-stone-700 flex items-center gap-1.5 mt-1 text-xs sm:text-sm font-mono font-medium">
                  <Phone className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>{order.customerPhone}</span>
                </p>
                {order.customerEmail && (
                  <p className="text-stone-700 flex items-center gap-1.5 text-xs sm:text-sm">
                    <Mail className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>{order.customerEmail}</span>
                  </p>
                )}
              </div>

              <div>
                <h4 className="text-xs font-black text-stone-500 uppercase tracking-wider mb-2">
                  ডেলিভারি ঠিকানা ও পেমেন্ট:
                </h4>
                <p className="text-stone-700 flex items-start gap-1.5 text-xs sm:text-sm">
                  <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    {order.deliveryAddress}
                    {order.district && !order.deliveryAddress.includes(order.district) ? `, ${order.district}` : ''}
                  </span>
                </p>
                <div className="mt-2 text-xs sm:text-sm text-stone-800">
                  পেমেন্ট পদ্ধতি: <span className="uppercase font-bold">{order.paymentMethod}</span> (
                  <span
                    className={
                      order.paymentStatus === 'paid'
                        ? 'text-emerald-700 font-black'
                        : 'text-amber-800 font-bold'
                    }
                  >
                    {order.paymentStatus === 'paid' ? 'PAID / পরিশোধিত' : 'COD / পণ্য পেয়ে পরিশোধ'}
                  </span>
                  )
                </div>
                {order.paymentTxnId && (
                  <p className="text-xs font-mono text-stone-600 mt-0.5">TrxID: {order.paymentTxnId}</p>
                )}
              </div>
            </div>

            {/* Items Table with Product Images & Offer Details */}
            <div className="border border-stone-200 rounded-2xl overflow-hidden mb-6">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-stone-900 text-white text-xs uppercase font-bold">
                    <th className="p-3 sm:p-3.5">পণ্য ও ছবি (Product & Image)</th>
                    <th className="p-3 sm:p-3.5 text-center">SKU</th>
                    <th className="p-3 sm:p-3.5 text-right">মূল্য (Rate)</th>
                    <th className="p-3 sm:p-3.5 text-center">পরিমাণ</th>
                    <th className="p-3 sm:p-3.5 text-right">মোট (Total)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 text-xs sm:text-sm">
                  {order.items && order.items.length > 0 ? (
                    order.items.map((item, idx) => {
                      const itemPrice = item.price || item.unitPrice || 0;
                      const itemQty = item.quantity || 1;
                      const itemTotal = item.totalPrice || itemPrice * itemQty;
                      const matchedProduct = products.find(
                        (p) =>
                          p.id === item.productId ||
                          p.name.toLowerCase() === item.productName.toLowerCase() ||
                          (p.banglaName && p.banglaName === item.productName) ||
                          (p.sku && item.sku && p.sku === item.sku)
                      );
                      const itemImage =
                        item.image ||
                        matchedProduct?.mainImage ||
                        matchedProduct?.featuredImage ||
                        (matchedProduct?.images && matchedProduct.images[0]) ||
                        '';

                      return (
                        <tr key={idx} className="hover:bg-stone-50/80">
                          <td className="p-3 sm:p-3.5">
                            <div className="flex items-center gap-3">
                              {invoiceConfig?.showProductImage !== false && itemImage && (
                                <img
                                  src={itemImage}
                                  alt={item.productName}
                                  className="w-12 h-12 rounded-xl object-contain bg-stone-50 border border-stone-200 shrink-0 shadow-2xs"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              )}
                              <div>
                                <p className="font-bold text-stone-900">{item.productName}</p>
                                {(item.variantSummary || item.color || item.size) && (
                                  <p className="text-xs text-stone-600 mt-0.5">
                                    {item.variantSummary || [item.color, item.size].filter(Boolean).join(' • ')}
                                  </p>
                                )}
                                {order.discount > 0 && idx === 0 && (
                                  <span className="inline-block mt-1 text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                    অফার ছাড় যুক্ত: {order.couponCode || 'উৎসব প্রমো'} (-৳{order.discount})
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="p-3 sm:p-3.5 text-center font-mono text-xs text-stone-600">
                            {item.sku || 'N/A'}
                          </td>
                          <td className="p-3 sm:p-3.5 text-right text-stone-700">৳{itemPrice}</td>
                          <td className="p-3 sm:p-3.5 text-center font-bold text-stone-900">{itemQty}</td>
                          <td className="p-3 sm:p-3.5 text-right font-black text-stone-900">৳{itemTotal}</td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-stone-500">
                        কোনো পণ্য পাওয়া যায়নি
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Totals Calculation & Customizable Terms */}
            <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-t border-stone-200 pt-4">
              <div className="max-w-md text-xs text-stone-600 space-y-1.5">
                <p className="font-bold text-stone-800">
                  {invoiceConfig?.termsTitle || 'পরামর্শ ও শর্তাবলী:'}
                </p>
                {invoiceConfig?.terms && invoiceConfig.terms.length > 0 ? (
                  invoiceConfig.terms.map((term) => (
                    <p key={term.id} className="text-stone-700 leading-relaxed">• {term.text}</p>
                  ))
                ) : (
                  <>
                    <p>• পণ্য গ্রহণের সময় ডেলিভারি ম্যানের উপস্থিতিতে চেক করে নিন।</p>
                    <p>• ৭ দিনের মধ্যে রিটার্ন বা সাইজ এক্সচেঞ্জের সুবিধা রয়েছে।</p>
                    <p>• কোনো সমস্যা হলে কাস্টমার কেয়ারে যোগাযোগ করুন।</p>
                  </>
                )}
                {order.customerNotes && (
                  <div className="mt-2 p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-amber-900">
                    <span className="font-bold">গ্রাহকের নোট:</span> {order.customerNotes}
                  </div>
                )}
              </div>

              <div className="w-full sm:w-72 space-y-2 text-xs sm:text-sm bg-stone-50 p-4 rounded-2xl border border-stone-200">
                <div className="flex justify-between text-stone-600">
                  <span>সাব-টোটাল (Subtotal):</span>
                  <span className="font-bold text-stone-900">৳{order.subtotal}</span>
                </div>
                <div className="flex justify-between text-stone-600">
                  <span>ডেলিভারি চার্জ:</span>
                  <span className="font-bold text-stone-900">৳{order.deliveryCharge}</span>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-bold">
                    <span>অফার ছাড় ({order.couponCode || 'Promo'}):</span>
                    <span>-৳{order.discount}</span>
                  </div>
                )}
                <div className="border-t-2 border-stone-900 pt-2 flex justify-between text-base sm:text-lg font-black text-stone-900">
                  <span>সর্বমোট প্রদেয়:</span>
                  <span className="text-amber-800">৳{order.total}</span>
                </div>
              </div>
            </div>

            {/* Footer Signature */}
            <div className="mt-8 pt-6 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between text-xs text-stone-500 gap-4">
              <div>
                <p className="font-mono font-medium text-stone-700">
                  {invoiceConfig?.customerServiceNote || 'বাস্ত্র শৈলি ডিজিটাল ইনভয়েস সিস্টেম'}
                </p>
                <p>{invoiceConfig?.footerNote || 'আমাদের সাথে কেনাকাটা করার জন্য আন্তরিক ধন্যবাদ!'}</p>
              </div>
              <div className="text-center sm:text-right">
                <div className="h-8 flex items-center justify-center sm:justify-end text-stone-900 font-serif italic text-sm">
                  {invoiceConfig?.authorityName || 'Authorized Signature'}
                </div>
                <p className="font-bold text-stone-900 border-t border-stone-900 pt-1">
                  {invoiceConfig?.authoritySignatureTitle || 'BASTRA SHOILY Authority'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Prominent Sticky Action Bar (Ensures User Can Always Go Back, Print or Download) */}
        <div className="no-print bg-stone-100 border-t border-stone-200 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handleBackToShopping}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-bold text-xs sm:text-sm transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4 text-amber-400" />
              <span>কেনাকাটায় ফিরে যান</span>
            </button>

            <button
              onClick={handleTrackOrder}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs sm:text-sm transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <Truck className="w-4 h-4" />
              <span className="hidden sm:inline">অর্ডার ট্র্যাক করুন</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPdf}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs sm:text-sm transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>PDF ডাউনলোড</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-black text-xs sm:text-sm transition-all shadow-sm active:scale-95 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>প্রিন্ট করুন</span>
            </button>

            <button
              onClick={closeInvoiceModal}
              className="px-3.5 py-2.5 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold text-xs sm:text-sm transition-all cursor-pointer"
            >
              বন্ধ করুন
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
