import React, { useState, useRef, useEffect } from 'react';
import { useShop } from '../context/ShopContext';
import {
  Bot,
  X,
  Send,
  Sparkles,
  MessageCircle,
  HelpCircle,
  ShoppingBasket,
  Truck,
  RotateCcw,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Phone,
  Image as ImageIcon,
  Camera,
} from 'lucide-react';

export interface ProductCardItem {
  id?: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  slug: string;
  category?: string;
  inStock?: boolean;
}

interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
  isFallback?: boolean;
  image?: string;
  suggestedAction?: {
    label: string;
    action: () => void;
  };
  productCard?: ProductCardItem;
  productCards?: ProductCardItem[];
}

export const AiAssistantModal: React.FC = () => {
  const {
    isAiAssistantOpen,
    closeAiAssistant,
    products,
    navigateToProduct,
    navigateToCategory,
    navigateToTracking,
    openSizeGuideModal,
    generalSettings,
    deliveryConfig,
  } = useShop();

  const [inputQuery, setInputQuery] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageMime, setSelectedImageMime] = useState<string>('image/jpeg');
  const [previewModalImage, setPreviewModalImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      sender: 'ai',
      text: 'আসসালামু আলাইকুম! বাস্ত্র শৈলী স্মার্ট AI সহকারীতে আপনাকে স্বাগতম। আমাদের খাঁটি সুতি তাঁতের লুঙ্গি, প্রিমিয়াম পাঞ্জাবি, শাড়ি, সাইজ গাইড, ডেলিভারি চার্জ বা যেকোনো পোশাকের ছবি দেখতে আমাকে বলতে পারেন। এছাড়া আপনি নিজের পছন্দের পোশাকের ছবিও আমাকে ইনবক্সে পাঠাতে পারেন!',
      timestamp: 'এখন',
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('অনুগ্রহ করে ছবি ফাইল নির্বাচন করুন');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('ছবির আকার সর্বোচ্চ ৫ মেগাবাইট হতে হবে');
      return;
    }

    setSelectedImageMime(file.type);
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setSelectedImage(uploadEvent.target?.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  if (!isAiAssistantOpen) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputQuery).trim();
    const imageToSend = selectedImage;
    const mimeToSend = selectedImageMime;

    if (!text && !imageToSend) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: text || (imageToSend ? '📷 কাস্টমার পোশাকের ছবি পাঠিয়েছেন' : ''),
      image: imageToSend || undefined,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setSelectedImage(null);
    setIsTyping(true);

    try {
      // Call server-side conversational AI endpoint (powered by aiEngine & aiTools)
      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          imageBase64: imageToSend,
          mimeType: mimeToSend,
          history: messages.slice(-10).map((m) => ({
            sender: m.sender,
            text: m.text,
            productCards: m.productCards,
          })),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.reply) {
          const aiMsg: ChatMessage = {
            id: `ai-${Date.now()}`,
            sender: 'ai',
            text: data.reply,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            productCards: data.productCards && data.productCards.length > 0 ? data.productCards : undefined,
          };

          setMessages((prev) => [...prev, aiMsg]);
          setIsTyping(false);
          return;
        }
      }
    } catch (err) {
      console.warn('AI API fetch failed:', err);
    }

    // Clean conversational fallback (BUG 7: No large keyword matching system)
    const fallbackMsg: ChatMessage = {
      id: `ai-${Date.now()}`,
      sender: 'ai',
      text: 'দুঃখিত, এই মুহূর্তে আমি তথ্যটি যাচাই করতে পারছি না। আপনি চাইলে আমাদের কাস্টমার কেয়ারে (+880 1864-528488) সরাসরি যোগাযোগ করতে পারেন অথবা উপরের প্রোডাক্ট মেনু থেকে আমাদের ঐতিহ্যবাহী তাঁতের পোশাক সংগ্রহ ঘুরে দেখতে পারেন।',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, fallbackMsg]);
    setIsTyping(false);
  };

  const openWhatsAppDirect = () => {
    const phone = generalSettings.whatsappNumber?.replace(/[^0-9]/g, '') || '8801864528488';
    const text = encodeURIComponent('আসসালামু আলাইকুম, বাস্ত্র শৈলী থেকে একটি বিষয়ে সরাসরি তথ্য জানতে যোগাযোগ করছি।');
    window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
  };

  return (
    <div
      id="ai-assistant-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        id="ai-assistant-modal-box"
        className="relative w-full max-w-lg h-[620px] max-h-[92vh] bg-white rounded-2xl border border-stone-200 shadow-2xl flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="bg-stone-900 text-stone-100 p-4 flex items-center justify-between shrink-0 border-b border-stone-800">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Bot className="w-5 h-5" />
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-stone-900 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-stone-100">বাস্ত্র শৈলী AI সহকারী</h3>
                <span className="text-[10px] bg-amber-500/20 text-amber-300 font-mono px-2 py-0.5 rounded-full border border-amber-500/30">
                  Smart Agent
                </span>
              </div>
              <p className="text-[11px] text-stone-400">পণ্য, সাইজ ও ডেলিভারির রিয়েল-টাইম তথ্য</p>
            </div>
          </div>

          <button
            onClick={closeAiAssistant}
            className="p-1.5 text-stone-400 hover:text-stone-100 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Suggestion Chips */}
        <div className="bg-stone-50 border-b border-stone-200 px-3 py-2 flex items-center gap-2 overflow-x-auto text-[11px] no-scrollbar shrink-0">
          <span className="text-stone-400 shrink-0 font-medium flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            দ্রুত প্রশ্ন:
          </span>
          {[
            'পাঞ্জাবির সাইজ কত?',
            'লুঙ্গির মাপ ও বহর কেমন?',
            'ডেলিভারি চার্জ ও সময় কত?',
            'ক্যাশ অন ডেলিভারি আছে?',
            '৭ দিনের রিটার্ন পলিসি কি?',
            'পাঞ্জাবি কালেকশন ও দাম',
            'অর্ডার ট্র্যাক করব কিভাবে?',
          ].map((prompt, i) => (
            <button
              key={i}
              onClick={() => handleSendMessage(prompt)}
              className="bg-white hover:bg-stone-200 border border-stone-200 text-stone-700 px-2.5 py-1 rounded-full whitespace-nowrap transition-colors cursor-pointer shrink-0 active:scale-95"
            >
              {prompt}
            </button>
          ))}
        </div>

        {/* Chat Message Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-stone-50/50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-[13px] leading-relaxed whitespace-pre-line shadow-2xs ${
                  msg.sender === 'user'
                    ? 'bg-amber-600 text-white rounded-br-none'
                    : 'bg-white text-stone-800 border border-stone-200 rounded-bl-none'
                }`}
              >
                {/* User Uploaded Image in Chat */}
                {msg.image && (
                  <div className="mb-2">
                    <img
                      src={msg.image}
                      alt="Customer attached"
                      onClick={() => setPreviewModalImage(msg.image!)}
                      className="max-w-[220px] max-h-[180px] rounded-xl object-cover border-2 border-white/60 cursor-pointer shadow-xs hover:opacity-90 transition-opacity"
                    />
                  </div>
                )}

                {msg.text}

                {/* Multiple Product Cards with Images if AI returned products */}
                {msg.productCards && msg.productCards.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="text-[11px] font-bold text-amber-900 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200/80 flex items-center justify-between">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                        বাস্ত্র শৈলী কালেকশন পণ্য ({msg.productCards.length}টি)
                      </span>
                      <span className="text-[10px] text-stone-500 font-normal">ছবিতে ক্লিক করে বড় দেখুন</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {msg.productCards.map((p, pIdx) => (
                        <div
                          key={pIdx}
                          className="p-2.5 bg-stone-50 hover:bg-stone-100 rounded-xl border border-stone-200 flex flex-col justify-between gap-2 shadow-2xs group"
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className="relative w-14 h-14 rounded-lg overflow-hidden bg-white border border-stone-200 shrink-0 cursor-pointer"
                              onClick={() => setPreviewModalImage(p.image)}
                              title="বড় করে ছবি দেখুন"
                            >
                              <img
                                src={p.image}
                                alt={p.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                              />
                              <span className="absolute bottom-0 right-0 bg-black/60 text-white text-[8px] px-1 rounded-tl">ছবি</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-stone-900 text-xs line-clamp-1">{p.name}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="font-black text-amber-700 text-xs">৳{p.price}</span>
                                {p.originalPrice && p.originalPrice > p.price && (
                                  <span className="text-[10px] text-stone-400 line-through">৳{p.originalPrice}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              closeAiAssistant();
                              navigateToProduct(p.slug);
                            }}
                            className="w-full py-1.5 px-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] rounded-lg flex items-center justify-center gap-1 transition-colors cursor-pointer"
                          >
                            <span>বিস্তারিত ও কিনুন</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Single Product Card Attachment Fallback */}
                {msg.productCard && (!msg.productCards || msg.productCards.length === 0) && (
                  <div
                    onClick={() => {
                      closeAiAssistant();
                      navigateToProduct(msg.productCard!.slug);
                    }}
                    className="mt-3 p-2.5 bg-stone-50 hover:bg-stone-100 rounded-xl border border-stone-200 flex items-center gap-3 cursor-pointer transition-colors"
                  >
                    <img
                      src={msg.productCard.image}
                      alt={msg.productCard.name}
                      className="w-12 h-14 object-cover rounded-lg shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-stone-900 text-xs truncate">
                        {msg.productCard.name}
                      </p>
                      <p className="font-bold text-amber-700 text-xs mt-0.5">
                        ৳{msg.productCard.price}
                      </p>
                      <span className="text-[10px] text-stone-500 flex items-center gap-1 mt-0.5">
                        বিস্তারিত দেখুন <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                )}

                {/* Direct Action Button */}
                {msg.suggestedAction && (
                  <button
                    onClick={msg.suggestedAction.action}
                    className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-stone-900 text-stone-100 hover:bg-black rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <span>{msg.suggestedAction.label}</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}

                {/* Fallback WhatsApp Button (Requirement: Fallback to WhatsApp for unknown topics) */}
                {msg.isFallback && (
                  <div className="mt-3 pt-3 border-t border-stone-100">
                    <button
                      onClick={openWhatsAppDirect}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4 fill-white text-emerald-600" />
                      <span>সরাসরি WhatsApp-এ কথা বলুন ({generalSettings.phone || '+880 1864-528488'})</span>
                    </button>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-stone-400 px-1 mt-1 font-mono">{msg.timestamp}</span>
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex items-center gap-2 text-stone-500 text-xs bg-white border border-stone-200 w-fit px-3 py-2 rounded-2xl rounded-bl-none shadow-2xs">
              <Bot className="w-4 h-4 text-amber-500 animate-spin" />
              <span>বাস্ত্র শৈলী AI ভাবছে...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar with Image Upload & Send */}
        <div className="p-3 bg-white border-t border-stone-200 shrink-0">
          {/* Selected Image Preview with Remove Button */}
          {selectedImage && (
            <div className="relative inline-flex items-center gap-2 mb-2 p-1.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-950 animate-in fade-in">
              <img
                src={selectedImage}
                alt="Selected"
                className="w-12 h-12 rounded-lg object-cover border border-amber-300"
              />
              <div className="pr-6">
                <p className="font-bold text-[11px]">ছবি সংযুক্ত হয়েছে</p>
                <p className="text-[10px] text-stone-500">মেসেজ লিখে বা সরাসরি পাঠান</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="absolute top-1.5 right-1.5 p-1 bg-stone-200 hover:bg-rose-100 hover:text-rose-600 rounded-full transition-colors cursor-pointer"
                title="ছবি বাতিল করুন"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            {/* Hidden file input for image upload */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />

            {/* Photo Attachment Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2.5 text-stone-600 hover:text-amber-700 hover:bg-amber-50 rounded-xl border border-stone-200 transition-colors cursor-pointer shrink-0"
              title="পোশাক বা পণ্যের ছবি পাঠান"
            >
              <ImageIcon className="w-4.5 h-4.5" />
            </button>

            <input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder={selectedImage ? 'এই ছবিটি সম্পর্কে কিছু বলতে চান? (ঐচ্ছিক)...' : 'যেকোনো পোশাক, সাইজ, ডেলিভারি বা ছবি দেখতে লিখুন...'}
              className="flex-1 bg-stone-100 border border-stone-200 rounded-xl px-4 py-2.5 text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:border-amber-500 focus:bg-white transition-colors"
            />
            <button
              type="submit"
              disabled={!inputQuery.trim() && !selectedImage}
              className="p-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white rounded-xl transition-colors cursor-pointer shrink-0"
              title="পাঠান"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Modal for Zooming / Enlarged Photo Preview */}
        {previewModalImage && (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setPreviewModalImage(null)}
          >
            <div
              className="relative max-w-lg max-h-[85vh] bg-stone-900 rounded-2xl overflow-hidden p-2 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={previewModalImage}
                alt="Enlarged view"
                className="max-w-full max-h-[75vh] object-contain rounded-xl mx-auto"
              />
              <button
                onClick={() => setPreviewModalImage(null)}
                className="absolute top-3 right-3 bg-black/70 hover:bg-black text-white p-2 rounded-full cursor-pointer transition-colors"
                title="বন্ধ করুন"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
