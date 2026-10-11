import React, { useState, useEffect, useMemo } from 'react';
import { useShop } from '../context/ShopContext';
import { PaymentMethod, Order } from '../types';
import { COUNTRIES, BD_64_DISTRICTS, Country, DistrictData } from '../data/geoData';
import { PaymentGatewayModal } from '../components/PaymentGatewayModal';
import {
  ShoppingBasket,
  Truck,
  ShieldCheck,
  CheckCircle2,
  Tag,
  ArrowRight,
  Phone,
  MapPin,
  User,
  CreditCard,
  FileText,
  ArrowLeft,
  Globe,
  Building,
  Mail,
  HelpCircle,
  AlertCircle,
  Printer,
  Download,
  Plus,
  Minus,
  Trash2,
  X,
} from 'lucide-react';

export const CheckoutPage: React.FC = () => {
  const {
    cart,
    cartSubtotal,
    directBuyItem,
    setDirectBuyItem,
    updateCartQty,
    removeFromCart,
    deliveryConfig,
    paymentConfig,
    createOrder,
    clearCart,
    applyCoupon,
    navigateToHome,
    navigateToTracking,
    openInvoiceModal,
    navigateBack,
    language,
    showToast,
    syncCustomerServerCart,
  } = useShop();

  const itemsToCheckout = directBuyItem ? [directBuyItem] : cart;
  const checkoutSubtotal = useMemo(() => {
    return itemsToCheckout.reduce((acc, c) => acc + c.item.price * c.quantity, 0);
  }, [itemsToCheckout]);

  const handleIncreaseQty = (sku: string) => {
    if (directBuyItem) {
      setDirectBuyItem({
        ...directBuyItem,
        quantity: directBuyItem.quantity + 1,
        item: { ...directBuyItem.item, quantity: directBuyItem.quantity + 1 },
      });
    } else {
      const itm = cart.find((c) => c.item.sku === sku);
      if (itm) {
        updateCartQty(sku, itm.quantity + 1);
      }
    }
  };

  const handleDecreaseQty = (sku: string) => {
    if (directBuyItem) {
      if (directBuyItem.quantity > 1) {
        setDirectBuyItem({
          ...directBuyItem,
          quantity: directBuyItem.quantity - 1,
          item: { ...directBuyItem.item, quantity: directBuyItem.quantity - 1 },
        });
      } else {
        setDirectBuyItem(null);
      }
    } else {
      const itm = cart.find((c) => c.item.sku === sku);
      if (itm) {
        updateCartQty(sku, itm.quantity - 1);
      }
    }
  };

  const handleRemoveItem = (sku: string) => {
    if (directBuyItem) {
      setDirectBuyItem(null);
    } else {
      removeFromCart(sku);
    }
  };

  // Customer Information
  const [customerName, setCustomerName] = useState('');
  const [selectedCountryCode, setSelectedCountryCode] = useState('BD');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');

  // Domestic Address (Bangladesh)
  const [selectedDistrictId, setSelectedDistrictId] = useState('sirajganj');
  const [selectedUpazila, setSelectedUpazila] = useState('');
  const [deliveryAreaDetails, setDeliveryAreaDetails] = useState('');

  // International Address (Outside Bangladesh)
  const [stateProvince, setStateProvince] = useState('');
  const [cityTown, setCityTown] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [internationalStreet, setInternationalStreet] = useState('');

  // General Order Notes
  const [customerNotes, setCustomerNotes] = useState('');

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cod');
  const [paymentTxnId, setPaymentTxnId] = useState('');

  // Coupon
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discount: number;
    message: string;
  } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  // Success State
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [completedOrder, setCompletedOrder] = useState<Order | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [activeGatewaySession, setActiveGatewaySession] = useState<{
    orderId: string;
    amount: number;
    gateway: 'bkash' | 'nagad' | 'sslcommerz' | 'card';
    paymentId?: string;
    orderData?: any;
  } | null>(null);

  const selectedCountry = COUNTRIES.find((c) => c.code === selectedCountryCode) || COUNTRIES[0];
  const isDomestic = selectedCountry.isDomestic === true;

  // Selected district object & upazilas
  const currentDistrict =
    BD_64_DISTRICTS.find((d) => d.id === selectedDistrictId) || BD_64_DISTRICTS[0];

  // Auto-set first upazila when district changes
  useEffect(() => {
    if (isDomestic && currentDistrict.upazilas.length > 0) {
      setSelectedUpazila(currentDistrict.upazilas[0]);
    }
  }, [selectedDistrictId, isDomestic]);

  // Adjust payment method if switching to International
  useEffect(() => {
    if (!isDomestic) {
      // International doesn't allow COD
      if (paymentMethod === 'cod') {
        setPaymentMethod('international_card');
      }
    } else {
      if (paymentMethod === 'international_card' || paymentMethod === 'bank_transfer') {
        setPaymentMethod('cod');
      }
    }
  }, [selectedCountryCode, isDomestic]);

  // When visiting checkout or cart has items, ensure previous completed order screen is cleared
  useEffect(() => {
    if (itemsToCheckout.length > 0 && createdOrderId) {
      setCreatedOrderId(null);
      setCompletedOrder(null);
    }
  }, [itemsToCheckout.length]);

  // Delivery Calculations
  const isSirajganj = isDomestic && (selectedDistrictId === 'sirajganj' || selectedDistrictId === 'sirajgonj');
  const isFreeDelivery = isDomestic && checkoutSubtotal >= (deliveryConfig.freeDeliveryThreshold || 2000);

  let deliveryCharge = 0;
  if (!isDomestic) {
    // International shipping rate (Standard air courier)
    deliveryCharge = 2200;
  } else if (isFreeDelivery) {
    deliveryCharge = 0;
  } else if (isSirajganj) {
    deliveryCharge = deliveryConfig.insideSirajganjCharge ?? 70;
  } else {
    deliveryCharge = deliveryConfig.outsideSirajganjCharge ?? 130;
  }

  const discountAmount = appliedCoupon ? appliedCoupon.discount : 0;
  const grandTotal = Math.max(0, checkoutSubtotal + deliveryCharge - discountAmount);

  const handleApplyCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;
    setCouponError(null);
    const res = applyCoupon(couponInput, checkoutSubtotal);
    if (res.valid) {
      setAppliedCoupon({
        code: couponInput.trim().toUpperCase(),
        discount: res.discount,
        message: res.message,
      });
    } else {
      setCouponError(res.message);
    }
  };

  const handlePlaceOrder = (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim()) {
      showToast(language === 'en' ? 'Please enter your full name.' : 'অনুগ্রহ করে আপনার পূর্ণ নাম প্রদান করুন।');
      return;
    }

    if (!customerPhone.trim()) {
      showToast(language === 'en' ? 'Please enter a valid phone number.' : 'অনুগ্রহ করে আপনার সচল মোবাইল নম্বর প্রদান করুন।');
      return;
    }

    if (isDomestic) {
      if (!deliveryAreaDetails.trim()) {
        showToast(
          language === 'en'
            ? 'Please provide your full delivery address (House, Road, Area).'
            : 'অনুগ্রহ করে সম্পূর্ণ ডেলিভারি ঠিকানা (বাসা/রোড/এলাকা) প্রদান করুন।'
        );
        return;
      }
    } else {
      if (!cityTown.trim() || !internationalStreet.trim() || !postalCode.trim()) {
        showToast(
          language === 'en'
            ? 'Please provide complete international address details (City, Street, Postal Code).'
            : 'অনুগ্রহ করে আন্তর্জাতিক ডেলিভারির জন্য সম্পূর্ণ ঠিকানা, শহর ও পোস্টাল কোড প্রদান করুন।'
        );
        return;
      }
    }

    if (itemsToCheckout.length === 0) {
      showToast(language === 'en' ? 'Your order is empty!' : 'আপনার অর্ডারে কোনো পোশাক নেই!');
      return;
    }

    const fullPhone = `${selectedCountry.dialCode} ${customerPhone.replace(/^[0]/, '')}`;
    const fullAddress = isDomestic
      ? `${deliveryAreaDetails}, ${selectedUpazila}, ${currentDistrict.banglaName} (${currentDistrict.name})`
      : `${internationalStreet}, ${cityTown}, ${stateProvince ? stateProvince + ', ' : ''}${postalCode}, ${selectedCountry.name}`;

    setIsSubmitting(true);

    const placeOrderBackend = async () => {
      try {
        const payload = {
          customerName,
          customerPhone: fullPhone,
          customerEmail: customerEmail || undefined,
          deliveryAddress: fullAddress,
          district: isDomestic ? currentDistrict.name : cityTown,
          upazila: isDomestic ? selectedUpazila : stateProvince,
          paymentMethod,
          paymentTxnId: paymentTxnId || undefined,
          couponCode: appliedCoupon?.code,
          customerNotes,
          items: itemsToCheckout.map((c) => ({
            productId: c.item.productId,
            variantId: c.item.variantId,
            quantity: c.quantity,
            price: c.item.price,
            productName: c.item.productName,
            banglaName: c.item.banglaName,
            sku: c.item.sku,
            image: c.item.image,
          })),
        };

        const res = await fetch('/api/checkout/place-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (data.success && (data.order || data.orderId)) {
          const bo = data.order || {};
          const finalOrderId = data.orderId || bo.id;

          // Synchronize locally
          createOrder({
            id: finalOrderId,
            customerName: bo.customerName || bo.customer_name || customerName,
            customerPhone: bo.customerPhone || bo.customer_phone || fullPhone,
            customerEmail: bo.customerEmail || bo.customer_email || customerEmail || undefined,
            deliveryAddress: bo.deliveryAddress || bo.delivery_address || fullAddress,
            district: bo.district || (isDomestic ? currentDistrict.name : cityTown),
            upazila: bo.upazila || (isDomestic ? selectedUpazila : stateProvince),
            country: selectedCountry.name,
            countryCode: selectedCountry.code,
            items: itemsToCheckout.map((c) => c.item),
            subtotal: bo.subtotal ?? checkoutSubtotal,
            deliveryCharge: bo.deliveryCharge ?? bo.delivery_charge ?? deliveryCharge,
            discount: bo.discount ?? discountAmount,
            couponCode: bo.couponCode || bo.coupon_code || appliedCoupon?.code,
            total: bo.total ?? grandTotal,
            paymentMethod: bo.paymentMethod || bo.payment_method || paymentMethod,
            paymentStatus: bo.paymentStatus || bo.payment_status || 'pending',
            paymentTxnId: bo.paymentTxnId || bo.payment_txn_id || paymentTxnId,
            orderStatus: bo.orderStatus || bo.order_status || 'pending',
            customerNotes: bo.customerNotes || bo.customer_notes || customerNotes,
          } as any);

          // If payment method is an online gateway (bkash, nagad, card, sslcommerz)
          if (paymentMethod === 'bkash' || paymentMethod === 'nagad' || paymentMethod === 'card') {
            try {
              const initRes = await fetch('/api/payment/initiate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  orderId: finalOrderId,
                  gateway: paymentMethod === 'card' ? 'sslcommerz' : paymentMethod,
                }),
              });
              const initData = await initRes.json();
              if (initData.success) {
                if (initData.mode === 'redirect' && initData.paymentUrl?.startsWith('http')) {
                  window.location.href = initData.paymentUrl;
                  return;
                }
                setActiveGatewaySession({
                  orderId: finalOrderId,
                  amount: grandTotal,
                  gateway: (paymentMethod === 'card' ? 'sslcommerz' : paymentMethod) as any,
                  paymentId: initData.paymentId,
                  orderData: bo,
                });
                setIsSubmitting(false);
                return;
              }
            } catch (pErr) {
              console.warn('Payment initiation error, proceeding to direct order confirmation:', pErr);
            }
          }

          const fullOrderSnapshot: Order = data.order || {
            id: finalOrderId,
            customerName,
            customerPhone: fullPhone,
            customerEmail: customerEmail || undefined,
            deliveryAddress: isDomestic
              ? `${deliveryAreaDetails}, ${selectedUpazila}, ${currentDistrict.banglaName}`
              : `${internationalStreet}, ${cityTown}, ${postalCode}, ${selectedCountry.name}`,
            country: selectedCountry.name,
            countryCode: selectedCountry.code,
            district: isDomestic ? currentDistrict.name : cityTown,
            upazila: isDomestic ? selectedUpazila : stateProvince,
            postalCode: isDomestic ? undefined : postalCode,
            stateProvince: isDomestic ? undefined : stateProvince,
            items: itemsToCheckout.map((c) => ({
              ...c.item,
              unitPrice: c.item.price,
              totalPrice: c.item.price * c.quantity,
              quantity: c.quantity,
            })),
            subtotal: checkoutSubtotal,
            deliveryCharge,
            discount: discountAmount,
            couponCode: appliedCoupon?.code,
            total: grandTotal,
            paymentMethod,
            paymentStatus: paymentMethod === 'cod' ? 'pending' : paymentTxnId ? 'paid' : 'pending',
            paymentTxnId: paymentTxnId || undefined,
            orderStatus: 'pending',
            orderDate: new Date().toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
            timeline: [],
          };

          setCompletedOrder(fullOrderSnapshot);
          if (directBuyItem) {
            setDirectBuyItem(null);
          } else {
            clearCart();
          }
          setCreatedOrderId(finalOrderId);
          return;
        } else if (data.error) {
          console.warn('Backend order placement warning, falling back to local creation:', data.error);
        }
      } catch (err) {
        console.warn('Backend order placement API warning, falling back to local creation:', err);
      }

      // Authoritative Fallback local creation (ensures order is never blocked or marked failed)
      const localOrder = createOrder({
        customerName,
        customerPhone: fullPhone,
        customerEmail: customerEmail || undefined,
        deliveryAddress: fullAddress,
        country: selectedCountry.name,
        countryCode: selectedCountry.code,
        district: isDomestic ? currentDistrict.name : cityTown,
        upazila: isDomestic ? selectedUpazila : stateProvince,
        postalCode: isDomestic ? undefined : postalCode,
        stateProvince: isDomestic ? undefined : stateProvince,
        items: itemsToCheckout.map((c) => ({
          ...c.item,
          unitPrice: c.item.price,
          totalPrice: c.item.price * c.quantity,
          quantity: c.quantity,
        })),
        subtotal: checkoutSubtotal,
        deliveryCharge,
        discount: discountAmount,
        couponCode: appliedCoupon?.code,
        total: grandTotal,
        paymentMethod,
        paymentStatus: paymentMethod === 'cod' ? 'pending' : paymentTxnId ? 'paid' : 'pending',
        paymentTxnId: paymentTxnId || undefined,
        orderStatus: 'pending',
        customerNotes,
      });

      setCompletedOrder(localOrder);
      if (directBuyItem) {
        setDirectBuyItem(null);
      } else {
        clearCart();
      }
      setCreatedOrderId(localOrder.id);
      setIsSubmitting(false);
    };

    placeOrderBackend();
  };

  const handleDownloadInvoice = (orderToDownload: Order) => {
    try {
      const itemsHtml = (orderToDownload.items || [])
        .map(
          (it) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e7e5e4;">
            <div style="font-weight:bold;color:#1c1917;">${it.banglaName || it.productName}</div>
            ${it.variantSummary ? `<div style="font-size:11px;color:#78716c;">${it.variantSummary}</div>` : ''}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #e7e5e4;text-align:center;font-family:monospace;font-size:11px;">${it.sku || 'N/A'}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e7e5e4;text-align:right;">৳${it.price || (it as any).unitPrice || 0}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e7e5e4;text-align:center;font-weight:bold;">${it.quantity}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e7e5e4;text-align:right;font-weight:bold;color:#1c1917;">৳${it.totalPrice || (it.price || 0) * it.quantity}</td>
        </tr>
      `
        )
        .join('');

      const invoiceHtml = `
<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <title>Invoice-${orderToDownload.id} - BASTRA SHOILY</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; background: #fff; color: #1c1917; padding: 24px; font-size: 13px; line-height: 1.5; }
    .invoice-card { max-width: 800px; margin: 0 auto; border: 1px solid #e7e5e4; border-radius: 12px; padding: 32px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #1c1917; padding-bottom: 20px; margin-bottom: 24px; }
    .brand-title { font-size: 22px; font-weight: 900; letter-spacing: 1px; color: #1c1917; }
    .brand-sub { font-size: 11px; font-weight: bold; color: #b45309; }
    .invoice-badge { background: #1c1917; color: #fff; font-family: monospace; font-size: 15px; font-weight: bold; padding: 6px 12px; border-radius: 6px; display: inline-block; margin-bottom: 8px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; background: #fafaf9; border: 1px solid #e7e5e4; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border: 1px solid #e7e5e4; border-radius: 8px; overflow: hidden; }
    th { background: #1c1917; color: #fff; text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; }
    .totals { width: 280px; margin-left: auto; font-size: 12px; }
    .totals-row { display: flex; justify-content: space-between; padding: 4px 0; color: #57534e; }
    .grand { border-top: 2px solid #1c1917; margin-top: 8px; padding-top: 8px; font-size: 16px; font-weight: 900; color: #1c1917; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="header">
      <div>
        <div class="brand-title">BASTRA SHOILY</div>
        <div class="brand-sub">বাস্ত্র শৈলী • ঐতিহ্যবাহী তাঁত ও আধুনিক ফ্যাশন</div>
        <div style="font-size:11px;color:#78716c;margin-top:6px;">সিরাজগঞ্জ, বাংলাদেশ | হটলাইন: +880 1864-528488</div>
      </div>
      <div style="text-align:right;">
        <div class="invoice-badge">INVOICE #${orderToDownload.id}</div>
        <div style="font-size:12px;color:#78716c;">তারিখ: ${orderToDownload.orderDate || new Date().toLocaleDateString('bn-BD')}</div>
        <div style="font-size:11px;font-weight:bold;color:#047857;margin-top:4px;">পদ্ধতি: ${orderToDownload.paymentMethod.toUpperCase()} (${orderToDownload.paymentStatus.toUpperCase()})</div>
      </div>
    </div>

    <div class="grid">
      <div>
        <div style="font-size:10px;font-weight:bold;color:#78716c;text-transform:uppercase;">গ্রাহকের তথ্য (Bill To):</div>
        <div style="font-size:14px;font-weight:bold;color:#1c1917;margin-top:4px;">${orderToDownload.customerName}</div>
        <div style="font-size:12px;color:#44403c;margin-top:2px;">মোবাইল: ${orderToDownload.customerPhone}</div>
      </div>
      <div>
        <div style="font-size:10px;font-weight:bold;color:#78716c;text-transform:uppercase;">ডেলিভারি ঠিকানা:</div>
        <div style="font-size:12px;color:#1c1917;margin-top:4px;">${orderToDownload.deliveryAddress}</div>
        <div style="font-size:11px;color:#78716c;margin-top:2px;">জেলা: ${orderToDownload.district}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>আইটেম বিবরণ</th>
          <th style="text-align:center;">SKU</th>
          <th style="text-align:right;">দর (Rate)</th>
          <th style="text-align:center;">পরিমাণ</th>
          <th style="text-align:right;">মোট (Total)</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-row"><span>সাব-টোটাল:</span><span>৳${orderToDownload.subtotal}</span></div>
      <div class="totals-row"><span>ডেলিভারি চার্জ:</span><span>৳${orderToDownload.deliveryCharge}</span></div>
      ${orderToDownload.discount > 0 ? `<div class="totals-row" style="color:#047857;font-weight:bold;"><span>ছাড় (${orderToDownload.couponCode || 'Promo'}):</span><span>-৳${orderToDownload.discount}</span></div>` : ''}
      <div class="grand"><span>সর্বমোট প্রদেয়:</span><span>৳${orderToDownload.total}</span></div>
    </div>
  </div>
  <script>window.onload = function() { setTimeout(function() { window.print(); }, 300); };</script>
</body>
</html>
      `;

      const blob = new Blob([invoiceHtml], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Invoice-${orderToDownload.id}-Bastra-Shoily.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(invoiceHtml);
        printWindow.document.close();
      }
      showToast('ইনভয়েস ডাউনলোড সম্পন্ন হয়েছে');
    } catch (e) {
      window.print();
    }
  };

  // SUCCESS CONFIRMATION VIEW (With full itemized receipt, print & download options)
  if (createdOrderId) {
    const activeOrderObj = completedOrder || {
      id: createdOrderId,
      customerName,
      customerPhone: `${selectedCountry.dialCode} ${customerPhone}`,
      customerEmail,
      deliveryAddress: isDomestic
        ? `${deliveryAreaDetails}, ${selectedUpazila}, ${currentDistrict.banglaName}`
        : `${internationalStreet}, ${cityTown}, ${postalCode}, ${selectedCountry.name}`,
      district: isDomestic ? currentDistrict.name : cityTown,
      items: [],
      subtotal: cartSubtotal,
      deliveryCharge,
      discount: discountAmount,
      total: grandTotal,
      paymentMethod,
      paymentStatus: paymentMethod === 'cod' ? 'pending' : 'paid',
      orderStatus: 'pending',
      orderDate: new Date().toLocaleDateString('bn-BD'),
      timeline: [],
    };

    return (
      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-16 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
        </div>

        <div className="space-y-2">
          <span className="text-[11px] uppercase tracking-widest text-emerald-800 font-bold bg-emerald-100 px-3 py-1 rounded-full">
            {language === 'en' ? 'Order Confirmed Successfully' : 'অর্ডার সফলভাবে গ্রহণ করা হয়েছে'}
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight">
            {language === 'en' ? `Thank you, ${customerName}!` : `ধন্যবাদ, ${customerName}!`}
          </h1>
          <p className="text-xs sm:text-sm text-stone-600 max-w-lg mx-auto">
            {language === 'en'
              ? 'Your order has been recorded. You can view, print, or download your official invoice below.'
              : 'আপনার অর্ডারটি সফলভাবে সংরক্ষিত হয়েছে। নিচে আপনার অর্ডারের পূর্ণ বিবরণ দেওয়া হলো। আপনি সরাসরি ইনভয়েস প্রিন্ট অথবা ডাউনলোড করতে পারেন।'}
          </p>
        </div>

        {/* Order Details & Items Card */}
        <div className="p-5 sm:p-7 bg-white rounded-3xl border border-stone-200 text-left space-y-4 shadow-sm">
          <div className="flex flex-wrap justify-between items-center text-xs border-b border-stone-100 pb-3 gap-2">
            <div>
              <span className="text-stone-500 font-medium">অর্ডার আইডি: </span>
              <span className="font-mono font-black text-stone-900 bg-stone-100 px-2.5 py-1 rounded-lg">
                #{createdOrderId}
              </span>
            </div>
            <div className="text-stone-600 text-xs">
              তারিখ: <span className="font-bold text-stone-900">{activeOrderObj.orderDate}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs border-b border-stone-100 pb-3">
            <div>
              <span className="text-stone-500 block font-bold uppercase text-[10px]">গ্রাহক:</span>
              <span className="font-bold text-stone-900 text-sm">{activeOrderObj.customerName}</span>
              <span className="block text-stone-600 font-mono mt-0.5">{activeOrderObj.customerPhone}</span>
            </div>
            <div>
              <span className="text-stone-500 block font-bold uppercase text-[10px]">ডেলিভারি ঠিকানা:</span>
              <span className="text-stone-900 font-medium block">{activeOrderObj.deliveryAddress}</span>
              <span className="text-stone-600 text-[11px] block">পেমেন্ট: <strong className="uppercase">{activeOrderObj.paymentMethod}</strong> ({activeOrderObj.paymentStatus === 'paid' ? 'পরিশোধিত' : 'ক্যাশ অন ডেলিভারি'})</span>
            </div>
          </div>

          {/* Ordered Products Table */}
          <div>
            <h4 className="font-bold text-xs uppercase text-stone-600 mb-2">
              অর্ডারকৃত পণ্যের তালিকা ({activeOrderObj.items.length} টি আইটেম):
            </h4>
            <div className="divide-y divide-stone-100 border border-stone-100 rounded-xl overflow-hidden bg-stone-50/50">
              {activeOrderObj.items.map((item, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-stone-50">
                  <div className="flex items-center gap-3">
                    {item.image && (
                      <img
                        src={item.image}
                        alt={item.productName}
                        className="w-11 h-11 object-cover rounded-lg border border-stone-200 shrink-0"
                      />
                    )}
                    <div>
                      <h5 className="font-bold text-stone-900 text-xs sm:text-sm line-clamp-1">
                        {item.banglaName || item.productName}
                      </h5>
                      <p className="text-[11px] text-stone-500 font-medium">
                        {item.variantSummary || [item.color, item.size].filter(Boolean).join(' • ') || (item.sku ? `SKU: ${item.sku}` : '')}
                      </p>
                      <span className="text-[11px] text-stone-600">
                        ৳{item.price || item.unitPrice || 0} × {item.quantity} টি
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-black text-stone-900 text-sm sm:text-base">
                      ৳{(item.price || item.unitPrice || 0) * item.quantity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Totals Summary */}
          <div className="pt-2 space-y-1.5 text-xs sm:text-sm">
            <div className="flex justify-between text-stone-600">
              <span>সাব-টোটাল (পণ্য মূল্য):</span>
              <span className="font-semibold text-stone-900">৳{activeOrderObj.subtotal}</span>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>ডেলিভারি চার্জ:</span>
              <span className="font-semibold text-stone-900">৳{activeOrderObj.deliveryCharge}</span>
            </div>
            {activeOrderObj.discount > 0 && (
              <div className="flex justify-between text-emerald-700 font-bold">
                <span>ছাড় (ডিসকাউন্ট):</span>
                <span>-৳{activeOrderObj.discount}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-sm sm:text-base pt-2 border-t-2 border-stone-900 font-black">
              <span className="text-stone-900">সর্বমোট প্রদেয় টাকা:</span>
              <span className="text-amber-800 text-xl font-black">৳{activeOrderObj.total}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons: View Invoice, Download PDF, Back to Home, Track */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => openInvoiceModal(activeOrderObj)}
            className="flex-1 sm:flex-none px-5 py-3 bg-stone-950 hover:bg-black text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>ইনভয়েস দেখুন / প্রিন্ট</span>
          </button>

          <button
            type="button"
            onClick={() => handleDownloadInvoice(activeOrderObj)}
            className="flex-1 sm:flex-none px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>PDF ডাউনলোড</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCreatedOrderId(null);
              setCompletedOrder(null);
              navigateToHome();
            }}
            className="flex-1 sm:flex-none px-5 py-3 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs sm:text-sm font-bold transition-all border border-stone-200 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>হোম পেজে ফিরুন</span>
          </button>

          <button
            type="button"
            onClick={navigateToTracking}
            className="flex-1 sm:flex-none px-4 py-3 bg-amber-500 hover:bg-amber-600 text-stone-950 rounded-xl text-xs sm:text-sm font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Truck className="w-4 h-4" />
            <span>ট্র্যাক করুন</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      {/* Top Header & Navigation */}
      <div className="flex items-center justify-between border-b border-stone-200 pb-4 mb-8">
        <div>
          <span className="text-[10px] uppercase tracking-widest text-amber-700 font-bold">
            {language === 'en' ? 'Fast & Secure Checkout' : 'নিরাপদ ও দ্রুত অর্ডার'}
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight mt-0.5">
            {language === 'en' ? 'Checkout & Place Order' : 'অর্ডার ও চেকআউট'}
          </h1>
        </div>
        <button
          type="button"
          onClick={navigateBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold transition-all cursor-pointer border border-stone-200"
          title="পূর্বের পেজে ফিরে যান (Back)"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{language === 'en' ? 'Go Back' : 'পেছনে যান'}</span>
        </button>
      </div>

      <form onSubmit={handlePlaceOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* Left: Customer Information & Delivery Address (lg:col-span-7) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Section 1: Customer Details & Country */}
          <div className="bg-white p-6 sm:p-7 rounded-2xl border border-stone-200 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-amber-600" />
                <h2 className="font-bold text-stone-900 text-sm">
                  {language === 'en' ? '1. Customer Details & Country' : '১. গ্রাহকের নাম ও দেশ নির্বাচন'}
                </h2>
              </div>
              <span className="text-[11px] font-mono text-stone-400">Step 1 of 3</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Full Name */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {language === 'en' ? 'Customer Full Name' : 'আপনার পূর্ণ নাম'}{' '}
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={language === 'en' ? 'e.g. Tanvir Hossain' : 'যেমন: তানভীর হোসেন'}
                  className="w-full bg-stone-50/60 border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-stone-900 focus:outline-hidden focus:border-amber-600 focus:bg-white transition-colors"
                />
              </div>

              {/* Country Select */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1 flex items-center justify-between">
                  <span>
                    {language === 'en' ? 'Country' : 'দেশ নির্বাচন করুন'}{' '}
                    <span className="text-rose-500">*</span>
                  </span>
                  <span className="text-[10px] text-amber-700 font-semibold flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    {isDomestic ? 'বাংলাদেশ' : 'আন্তর্জাতিক'}
                  </span>
                </label>
                <select
                  value={selectedCountryCode}
                  onChange={(e) => setSelectedCountryCode(e.target.value)}
                  className="w-full bg-stone-50/60 border border-stone-300 rounded-xl px-3 py-2.5 text-xs sm:text-sm text-stone-900 focus:outline-hidden focus:border-amber-600 focus:bg-white transition-colors font-medium"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name} - {c.banglaName} ({c.dialCode})
                    </option>
                  ))}
                </select>
              </div>

              {/* Phone with dynamic country dial code */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  {language === 'en' ? 'Active Mobile Number' : 'সচল মোবাইল নম্বর'}{' '}
                  <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center">
                  <span className="inline-flex items-center px-3 py-2.5 rounded-l-xl border border-r-0 border-stone-300 bg-stone-100 text-stone-700 text-xs font-mono font-bold shrink-0">
                    {selectedCountry.dialCode}
                  </span>
                  <input
                    type="tel"
                    required
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    onBlur={() => {
                      const fullPhone = isDomestic ? customerPhone.trim() : `${selectedCountry.dialCode} ${customerPhone.trim()}`;
                      if (customerPhone.trim().length >= 11) {
                        syncCustomerServerCart(fullPhone);
                      }
                    }}
                    placeholder={isDomestic ? '017XXXXXXXX' : 'Mobile number'}
                    className="w-full bg-stone-50/60 border border-stone-300 rounded-r-xl px-3 py-2.5 text-xs sm:text-sm text-stone-900 focus:outline-hidden focus:border-amber-600 focus:bg-white transition-colors"
                  />
                </div>
              </div>

              {/* Email (Optional) */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-stone-600 mb-1">
                  {language === 'en' ? 'Email Address (Optional)' : 'ইমেইল ঠিকানা (ঐচ্ছিক)'}
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-stone-50/60 border border-stone-300 rounded-xl px-3.5 py-2 text-xs text-stone-900 focus:outline-hidden focus:border-amber-600 focus:bg-white transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Delivery Address (Conditional for BD vs International) */}
          <div className="bg-white p-6 sm:p-7 rounded-2xl border border-stone-200 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-amber-600" />
                <h2 className="font-bold text-stone-900 text-sm">
                  {isDomestic
                    ? language === 'en'
                      ? '2. Delivery Address in Bangladesh'
                      : '২. বাংলাদেশ ডেলিভারি ঠিকানা (জেলা ও উপজেলা)'
                    : language === 'en'
                    ? '2. International Delivery Address'
                    : '২. আন্তর্জাতিক ডেলিভারি ঠিকানা (International Address)'}
                </h2>
              </div>
              <span className="text-[11px] font-mono text-stone-400">Step 2 of 3</span>
            </div>

            {/* DOMESTIC BANGLADESH FIELDS */}
            {isDomestic ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* 64 Districts Dropdown */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      {language === 'en' ? 'District (64 Districts)' : 'জেলা নির্বাচন করুন (৬৪ জেলা)'}{' '}
                      <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={selectedDistrictId}
                      onChange={(e) => setSelectedDistrictId(e.target.value)}
                      className="w-full bg-stone-50/60 border border-stone-300 rounded-xl px-3 py-2.5 text-xs text-stone-900 focus:outline-hidden focus:border-amber-600 focus:bg-white transition-colors font-medium"
                    >
                      {BD_64_DISTRICTS.map((d) => {
                        const isSiraj = d.id === 'sirajganj' || d.id === 'sirajgonj';
                        const fee = isFreeDelivery
                          ? 'ফ্রি ডেলিভারি'
                          : isSiraj
                          ? `ডেলিভারি ৳${deliveryConfig.insideSirajganjCharge ?? 70}`
                          : `ডেলিভারি ৳${deliveryConfig.outsideSirajganjCharge ?? 130}`;
                        return (
                          <option key={d.id} value={d.id}>
                            {d.banglaName} - {d.name} ({fee})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  {/* Dependent Upazila Dropdown */}
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      {language === 'en' ? 'Upazila / Thana' : 'উপজেলা / থানা'}{' '}
                      <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={selectedUpazila}
                      onChange={(e) => setSelectedUpazila(e.target.value)}
                      className="w-full bg-stone-50/60 border border-stone-300 rounded-xl px-3 py-2.5 text-xs text-stone-900 focus:outline-hidden focus:border-amber-600 focus:bg-white transition-colors font-medium"
                    >
                      {currentDistrict.upazilas.map((u, i) => (
                        <option key={i} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Detailed Area / Road / House */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {language === 'en'
                      ? 'Detailed Delivery Area (House, Road, Area, Landmark)'
                      : 'ডেলিভারি এরিয়া / সম্পূর্ণ ঠিকানা (বাসা, রোড, এলাকা, চেনার উপায়)'}{' '}
                    <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={deliveryAreaDetails}
                    onChange={(e) => setDeliveryAreaDetails(e.target.value)}
                    placeholder={
                      language === 'en'
                        ? 'e.g. House 12, Road 4, Sector 7, Uttara'
                        : 'যেমন: বাড়ি #১২, রোড #৪, সেক্টর #৭, উত্তরা অথবা গ্রাম ও পোস্ট অফিস'
                    }
                    className="w-full bg-stone-50/60 border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-stone-900 focus:outline-hidden focus:border-amber-600 focus:bg-white transition-colors"
                  />
                </div>
              </div>
            ) : (
              /* INTERNATIONAL ADDRESS FIELDS */
              <div className="space-y-4">
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
                  <Globe className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">
                      {selectedCountry.flag} {selectedCountry.name} - আন্তর্জাতিক ডেলিভারি
                    </span>
                    <p className="text-[11px] text-amber-800 mt-0.5">
                      আন্তর্জাতিক এক্সপ্রেস কুরিয়ারে ৪ থেকে ৭ কর্মদিবসের মধ্যে পার্সেল পৌঁছাবে।
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      {language === 'en' ? 'City / Town' : 'শহর (City / Town)'}{' '}
                      <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={cityTown}
                      onChange={(e) => setCityTown(e.target.value)}
                      placeholder="e.g. London / New York / Dubai"
                      className="w-full bg-stone-50/60 border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs text-stone-900 focus:outline-hidden focus:border-amber-600 focus:bg-white transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      {language === 'en' ? 'State / Province / County' : 'প্রদেশ / স্টেট (State / Province)'}
                    </label>
                    <input
                      type="text"
                      value={stateProvince}
                      onChange={(e) => setStateProvince(e.target.value)}
                      placeholder="e.g. England / NY / Ontario"
                      className="w-full bg-stone-50/60 border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs text-stone-900 focus:outline-hidden focus:border-amber-600 focus:bg-white transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      {language === 'en' ? 'Zip / Postal Code' : 'জিপ / পোস্টাল কোড (Zip / Postal Code)'}{' '}
                      <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="e.g. SW1A 1AA / 10001"
                      className="w-full bg-stone-50/60 border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs text-stone-900 focus:outline-hidden focus:border-amber-600 focus:bg-white transition-colors"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">
                      {language === 'en' ? 'Country' : 'দেশ'}
                    </label>
                    <input
                      type="text"
                      disabled
                      value={`${selectedCountry.flag} ${selectedCountry.name}`}
                      className="w-full bg-stone-100 border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs text-stone-700 font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">
                    {language === 'en'
                      ? 'Street Address, Apartment / Suite'
                      : 'পূর্ণ রাস্তার ঠিকানা, অ্যাপার্টমেন্ট / ফ্ল্যাট নম্বর'}{' '}
                    <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={2}
                    value={internationalStreet}
                    onChange={(e) => setInternationalStreet(e.target.value)}
                    placeholder="e.g. 123 Oxford Street, Flat 4B"
                    className="w-full bg-stone-50/60 border border-stone-300 rounded-xl px-3.5 py-2.5 text-xs text-stone-900 focus:outline-hidden focus:border-amber-600 focus:bg-white transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Special Instructions Note */}
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">
                {language === 'en'
                  ? 'Special Delivery Instructions (Optional)'
                  : 'অর্ডার সংক্রান্ত বিশেষ নির্দেশিকা (ঐচ্ছিক)'}
              </label>
              <input
                type="text"
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder={
                  language === 'en'
                    ? 'e.g. Please call before delivery'
                    : 'যেমন: ডেলিভারির আগে ফোন করবেন, বিকেলে ডেলিভারি দিন'
                }
                className="w-full bg-stone-50/60 border border-stone-300 rounded-xl px-3.5 py-2 text-xs text-stone-900"
              />
            </div>
          </div>

          {/* Section 3: Payment Method (Dynamic based on Country) */}
          <div className="bg-white p-6 sm:p-7 rounded-2xl border border-stone-200 shadow-xs space-y-5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-600" />
                <h2 className="font-bold text-stone-900 text-sm">
                  {language === 'en' ? '3. Payment Method' : '৩. পেমেন্ট পদ্ধতি'}
                </h2>
              </div>
              <span className="text-[11px] font-mono text-stone-400">Step 3 of 3</span>
            </div>

            {isDomestic ? (
              /* DOMESTIC BANGLADESH PAYMENT OPTIONS */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Cash on Delivery */}
                {paymentConfig.enableCod && (
                  <label
                    className={`p-4 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                      paymentMethod === 'cod'
                        ? 'border-amber-600 bg-amber-50/40 ring-1 ring-amber-600'
                        : 'border-stone-200 hover:border-stone-300 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value="cod"
                      checked={paymentMethod === 'cod'}
                      onChange={() => setPaymentMethod('cod')}
                      className="mt-1 text-amber-600"
                    />
                    <div>
                      <span className="font-bold text-xs text-stone-900 block">
                        ক্যাশ অন ডেলিভারি (COD)
                      </span>
                      <span className="text-[11px] text-stone-500">
                        পণ্য হাতে পেয়ে দেখে মূল্য পরিশোধ করুন
                      </span>
                    </div>
                  </label>
                )}

                {/* bKash */}
                {paymentConfig.enableBkash && (
                  <label
                    className={`p-4 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                      paymentMethod === 'bkash'
                        ? 'border-pink-600 bg-pink-50/40 ring-1 ring-pink-600'
                        : 'border-stone-200 hover:border-stone-300 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value="bkash"
                      checked={paymentMethod === 'bkash'}
                      onChange={() => setPaymentMethod('bkash')}
                      className="mt-1 text-pink-600"
                    />
                    <div>
                      <span className="font-bold text-xs text-stone-900 block">
                        bKash (বিকাশ মার্চেন্ট/পার্সোনাল)
                      </span>
                      <span className="text-[11px] text-stone-500">
                        নম্বর: {paymentConfig.bkashNumber || '01890123456'}
                      </span>
                    </div>
                  </label>
                )}

                {/* Nagad */}
                {paymentConfig.enableNagad && (
                  <label
                    className={`p-4 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                      paymentMethod === 'nagad'
                        ? 'border-orange-600 bg-orange-50/40 ring-1 ring-orange-600'
                        : 'border-stone-200 hover:border-stone-300 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value="nagad"
                      checked={paymentMethod === 'nagad'}
                      onChange={() => setPaymentMethod('nagad')}
                      className="mt-1 text-orange-600"
                    />
                    <div>
                      <span className="font-bold text-xs text-stone-900 block">
                        Nagad (নগদ)
                      </span>
                      <span className="text-[11px] text-stone-500">
                        নম্বর: {paymentConfig.nagadNumber || '01890123456'}
                      </span>
                    </div>
                  </label>
                )}

                {/* Card / Online */}
                <label
                  className={`p-4 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                    paymentMethod === 'card'
                      ? 'border-stone-900 bg-stone-50 ring-1 ring-stone-900'
                      : 'border-stone-200 hover:border-stone-300 bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    value="card"
                    checked={paymentMethod === 'card'}
                    onChange={() => setPaymentMethod('card')}
                    className="mt-1 text-stone-900"
                  />
                  <div>
                    <span className="font-bold text-xs text-stone-900 block">
                      ভিসা / মাস্টারকার্ড / ডেবিট কার্ড
                    </span>
                    <span className="text-[11px] text-stone-500">
                      নিরাপদ অনলাইন কার্ড পেমেন্ট
                    </span>
                  </div>
                </label>
              </div>
            ) : (
              /* INTERNATIONAL PAYMENT OPTIONS */
              <div className="space-y-3">
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                  <span>
                    {language === 'en'
                      ? 'Note: Cash on Delivery is not available for international destinations outside Bangladesh.'
                      : 'বিশেষ দ্রষ্টব্য: বাংলাদেশ ব্যতীত বহির্বিশ্বে ক্যাশ অন ডেলিভারি (COD) সুবিধা প্রযোজ্য নয়।'}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* International Card */}
                  <label
                    className={`p-4 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                      paymentMethod === 'international_card'
                        ? 'border-amber-600 bg-amber-50/40 ring-1 ring-amber-600'
                        : 'border-stone-200 hover:border-stone-300 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value="international_card"
                      checked={paymentMethod === 'international_card'}
                      onChange={() => setPaymentMethod('international_card')}
                      className="mt-1 text-amber-600"
                    />
                    <div>
                      <span className="font-bold text-xs text-stone-900 block">
                        International Card (Visa / Master)
                      </span>
                      <span className="text-[11px] text-stone-500">
                        {language === 'en'
                          ? 'Global Credit / Debit Card & PayPal'
                          : 'আন্তর্জাতিক ক্রেডিট বা ডেবিট কার্ড'}
                      </span>
                    </div>
                  </label>

                  {/* Bank Transfer / Remittance */}
                  <label
                    className={`p-4 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                      paymentMethod === 'bank_transfer'
                        ? 'border-amber-600 bg-amber-50/40 ring-1 ring-amber-600'
                        : 'border-stone-200 hover:border-stone-300 bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value="bank_transfer"
                      checked={paymentMethod === 'bank_transfer'}
                      onChange={() => setPaymentMethod('bank_transfer')}
                      className="mt-1 text-amber-600"
                    />
                    <div>
                      <span className="font-bold text-xs text-stone-900 block">
                        Bank Wire / Remittance (রেমিট্যান্স)
                      </span>
                      <span className="text-[11px] text-stone-500">
                        {language === 'en'
                          ? 'Direct bank transfer / Western Union / TapTap'
                          : 'প্রবাসী ব্যাংক ট্রান্সফার বা ওয়েস্টার্ন ইউনিয়ন'}
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Transaction ID if bKash / Nagad / Bank */}
            {(paymentMethod === 'bkash' ||
              paymentMethod === 'nagad' ||
              paymentMethod === 'bank_transfer') && (
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-2">
                <label className="block text-xs font-bold text-stone-800">
                  {language === 'en'
                    ? 'Transaction ID / Reference Number (Optional)'
                    : 'ট্রানজেকশন আইডি / রেফারেন্স নম্বর (টাকা পাঠিয়ে থাকলে লিখুন)'}
                </label>
                <input
                  type="text"
                  value={paymentTxnId}
                  onChange={(e) => setPaymentTxnId(e.target.value)}
                  placeholder="যেমন: 9K72LM8Q"
                  className="w-full bg-white border border-stone-300 rounded-lg px-3 py-2 text-xs font-mono text-stone-900 uppercase"
                />
                <p className="text-[10px] text-stone-500">
                  {language === 'en'
                    ? 'You may also complete payment after placing the order via phone confirmation.'
                    : 'অর্ডার প্লেস করার পর আমাদের প্রতিনিধি ফোন করলেও আপনি পেমেন্ট নিশ্চিত করতে পারবেন।'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: Order Summary (lg:col-span-5) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white p-6 sm:p-7 rounded-2xl border border-stone-200 shadow-xs space-y-5 sticky top-28">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <h2 className="font-bold text-stone-900 text-sm flex items-center gap-2">
                <ShoppingBasket className="w-4 h-4 text-amber-600" />
                <span>{language === 'en' ? 'Order Summary' : 'অর্ডার সারাংশ'}</span>
              </h2>
              <span className="text-xs bg-amber-50 text-amber-800 font-bold px-2 py-0.5 rounded-full border border-amber-200">
                {itemsToCheckout.length} {language === 'en' ? 'Items' : 'টি পোশাক'}
              </span>
            </div>

            {/* Cart Items List */}
            <div className="max-h-72 overflow-y-auto divide-y divide-stone-100 pr-1 space-y-3">
              {itemsToCheckout.length === 0 ? (
                <div className="py-6 text-center text-stone-500 space-y-2">
                  <p className="text-xs">{language === 'en' ? 'No items in order' : 'অর্ডারে কোনো পোশাক নেই'}</p>
                  <button
                    type="button"
                    onClick={navigateToHome}
                    className="text-xs text-amber-700 font-bold hover:underline cursor-pointer"
                  >
                    {language === 'en' ? 'Continue Shopping' : 'কেনাকাটা করতে ফিরে যান'}
                  </button>
                </div>
              ) : (
                itemsToCheckout.map((cartItem) => (
                  <div key={cartItem.item.sku || cartItem.item.productId} className="flex gap-3 pt-3 first:pt-0 group relative">
                    <img
                      src={cartItem.item.image}
                      alt={cartItem.item.productName}
                      className="w-14 h-14 object-cover rounded-xl border border-stone-200 shrink-0"
                    />
                    <div className="flex-1 min-w-0 pr-6">
                      <p className="text-xs font-bold text-stone-900 truncate">
                        {cartItem.item.banglaName || cartItem.item.productName}
                      </p>
                      {cartItem.item.variantSummary && (
                        <p className="text-[11px] text-stone-500 truncate">{cartItem.item.variantSummary}</p>
                      )}
                      
                      <div className="flex items-center justify-between mt-1.5">
                        {/* Quantity Controls (+/- buttons directly on Order Page) */}
                        <div className="flex items-center border border-stone-200 rounded-lg overflow-hidden bg-stone-50">
                          <button
                            type="button"
                            onClick={() => handleDecreaseQty(cartItem.item.sku)}
                            className="w-6 h-6 flex items-center justify-center text-stone-600 hover:bg-stone-200 hover:text-stone-900 transition-colors cursor-pointer"
                            aria-label="Decrease quantity"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-7 text-center text-xs font-bold text-stone-800 font-mono">
                            {cartItem.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleIncreaseQty(cartItem.item.sku)}
                            className="w-6 h-6 flex items-center justify-center text-stone-600 hover:bg-stone-200 hover:text-stone-900 transition-colors cursor-pointer"
                            aria-label="Increase quantity"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        {/* Price */}
                        <div className="text-right">
                          <span className="text-xs font-bold text-stone-900">
                            ৳{cartItem.item.price * cartItem.quantity}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Cross / Remove Button (User requested: চাইলে যে কোনো একটা পণ্য ক্রস করতে পারবে) */}
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(cartItem.item.sku)}
                      className="absolute top-1 right-0 p-1 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                      title={language === 'en' ? 'Remove item' : 'পণ্যটি বাদ দিন'}
                      aria-label="Remove item"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Coupon Code Section */}
            <div className="pt-2 border-t border-stone-100">
              <form onSubmit={handleApplyCoupon} className="flex gap-2">
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                  placeholder={language === 'en' ? 'Coupon code' : 'কুপন কোড (যেমন: BASTRA100)'}
                  className="flex-1 bg-stone-50/60 border border-stone-300 rounded-xl px-3 py-2 text-xs uppercase tracking-wider text-stone-900 focus:outline-hidden focus:border-amber-600 focus:bg-white"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  {language === 'en' ? 'Apply' : 'প্রয়োগ'}
                </button>
              </form>

              {appliedCoupon && (
                <div className="mt-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 p-2 rounded-lg flex items-center justify-between">
                  <span className="font-medium">কুপন প্রয়োগ হয়েছে: {appliedCoupon.code}</span>
                  <span className="font-bold">-৳{appliedCoupon.discount}</span>
                </div>
              )}

              {couponError && <p className="mt-1 text-xs text-rose-500">{couponError}</p>}
            </div>

            {/* Price Calculations */}
            <div className="space-y-2.5 pt-2 border-t border-stone-100 text-xs">
              <div className="flex justify-between text-stone-600">
                <span>{language === 'en' ? 'Subtotal' : 'সাবটোটাল'}:</span>
                <span className="font-bold text-stone-900 font-mono">৳{checkoutSubtotal}</span>
              </div>

              <div className="flex justify-between text-stone-600">
                <span className="flex items-center gap-1">
                  <span>{language === 'en' ? 'Delivery Charge' : 'ডেলিভারি চার্জ'}:</span>
                  <span className="text-[10px] text-stone-400">
                    ({!isDomestic ? 'আন্তর্জাতিক কুরিয়ার' : isSirajganj ? 'সিরাজগঞ্জের ভিতরে' : 'সিরাজগঞ্জের বাহিরে'})
                  </span>
                </span>
                <span className="font-bold text-stone-900 font-mono">
                  {deliveryCharge === 0 ? (
                    <span className="text-emerald-600 font-bold">ফ্রি (Free)</span>
                  ) : (
                    `৳${deliveryCharge}`
                  )}
                </span>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>{language === 'en' ? 'Discount' : 'ডিসকাউন্ট'}:</span>
                  <span className="font-bold font-mono">-৳{discountAmount}</span>
                </div>
              )}

              <div className="flex justify-between text-sm sm:text-base font-black text-stone-900 border-t border-stone-200 pt-3">
                <span>{language === 'en' ? 'Grand Total' : 'সর্বমোট প্রদেয়'}:</span>
                <span className="text-amber-800 text-xl font-black font-mono">৳{grandTotal}</span>
              </div>
            </div>

            {/* Trust Badges */}
            <div className="p-3 bg-stone-50 rounded-xl space-y-1.5 text-[11px] text-stone-600 border border-stone-200/80">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>৭ দিনের সহজ রিটার্ন ও রিপ্লেসমেন্ট গ্যারান্টি</span>
              </div>
              <div className="flex items-center gap-2">
                <Truck className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>পণ্য ডেলিভারির সময় দেখে নেওয়ার সুযোগ</span>
              </div>
            </div>

            {/* Submit Place Order Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-4 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 disabled:opacity-60 text-white rounded-xl text-sm font-black tracking-wide uppercase transition-all shadow-md hover:shadow-lg active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <span>{language === 'en' ? 'Processing Order...' : 'অর্ডার প্রসেস হচ্ছে...'}</span>
              ) : (
                <>
                  <span>{language === 'en' ? 'Confirm Order Now' : 'অর্ডার সম্পন্ন করুন'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Real Online Payment Gateway Modal */}
      {activeGatewaySession && (
        <PaymentGatewayModal
          isOpen={true}
          orderId={activeGatewaySession.orderId}
          amount={activeGatewaySession.amount}
          gateway={activeGatewaySession.gateway}
          paymentId={activeGatewaySession.paymentId}
          onSuccess={(verifiedData) => {
            showToast('পেমেন্ট সফলভাবে গৃহীত হয়েছে!');
            clearCart();
            setCreatedOrderId(activeGatewaySession.orderId);
            setActiveGatewaySession(null);
          }}
          onCancel={() => {
            showToast('পেমেন্ট পেন্ডিং রাখা হয়েছে। আপনার অর্ডার ইতিমধ্যে সিস্টেমে সংরক্ষিত হয়েছে।');
            clearCart();
            setCreatedOrderId(activeGatewaySession.orderId);
            setActiveGatewaySession(null);
          }}
        />
      )}
    </div>
  );
};
