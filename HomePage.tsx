import React, { useState, useEffect } from 'react';
import { useShop } from '../context/ShopContext';
import { ProductCard } from '../components/ProductCard';
import { BrandLogoSlider } from '../components/BrandLogoSlider';
import { FestiveOfferSlider } from '../components/FestiveOfferSlider';
import { BrandArtisanPartnersSection } from '../components/BrandArtisanPartnersSection';
import { PromoSubBannersSection } from '../components/PromoSubBannersSection';
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';

export const HomePage: React.FC = () => {
  const {
    heroBanners,
    collections,
    products,
    howToOrderSteps,
    navigateToCategory,
    navigateToCmsGuide,
    navigateToClothingGuide,
  } = useShop();

  const [activeSlide, setActiveSlide] = useState(0);
  const activeBanners = heroBanners.filter((b) => b.isActive).sort((a, b) => a.order - b.order);

  // Auto-slide effect
  useEffect(() => {
    if (activeBanners.length <= 1) return;
    const timer = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % activeBanners.length);
    }, 5500);
    return () => clearInterval(timer);
  }, [activeBanners.length]);

  const nextSlide = () => {
    setActiveSlide((prev) => (prev + 1) % activeBanners.length);
  };
  const prevSlide = () => {
    setActiveSlide((prev) => (prev - 1 + activeBanners.length) % activeBanners.length);
  };

  const activeProducts = products.filter((p) => p.status !== 'archived' && p.status !== 'inactive');
  const newArrivals = (activeProducts.filter((p) => p.isNewArrival).length > 0
    ? activeProducts.filter((p) => p.isNewArrival)
    : activeProducts
  ).slice(0, 8);
  const bestSellers = (activeProducts.filter((p) => p.isBestSeller).length > 0
    ? activeProducts.filter((p) => p.isBestSeller)
    : activeProducts
  ).slice(0, 8);
  const offerProducts = (activeProducts.filter((p) => p.isOffer).length > 0
    ? activeProducts.filter((p) => p.isOffer)
    : activeProducts
  ).slice(0, 4);

  return (
    <div className="space-y-16 sm:space-y-24 pb-20">
      {/* 5. Hero Banner Slider (Compact Height with 100% Full Visual Visibility) */}
      <section className="relative w-full overflow-hidden bg-stone-950 text-white">
        {activeBanners.length > 0 && (
          <div className="relative h-[160px] sm:h-[210px] md:h-[250px] lg:h-[280px] w-full">
            {activeBanners.map((banner, index) => {
              const isCurrent = index === activeSlide;
              const isVideo = banner.mediaType === 'video' || (banner.videoUrl && banner.videoUrl.trim().length > 0);
              return (
                <div
                  key={banner.id}
                  className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                    isCurrent ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                  }`}
                >
                  {/* Ambient Background Fill to Prevent Empty Space */}
                  <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
                    {isVideo ? (
                      <video
                        src={banner.videoUrl}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-cover blur-2xl opacity-35 scale-110"
                      />
                    ) : (
                      <img
                        src={banner.desktopImage}
                        alt=""
                        className="w-full h-full object-cover blur-2xl opacity-35 scale-110"
                      />
                    )}
                    <div className="absolute inset-0 bg-stone-950/40" />
                  </div>

                  {/* Foreground Media: 100% full image/video visible inside slide box without being cut off */}
                  <div className="relative w-full h-full flex items-center justify-center p-1 sm:p-2">
                    {isVideo ? (
                      <video
                        src={banner.videoUrl}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="w-full h-full object-contain object-center drop-shadow-xl"
                      />
                    ) : (
                      <img
                        src={banner.desktopImage}
                        alt={banner.title}
                        className="w-full h-full object-contain object-center drop-shadow-xl"
                      />
                    )}
                  </div>

                  {/* Bottom Gradient Scrim for Floating Navigation Links */}
                  <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-stone-950/80 via-stone-950/40 to-transparent pointer-events-none" />

                  {/* Content: Floating Shop for men & Shop for women positioned at bottom-right inside banner */}
                  <div className="absolute inset-0 max-w-7xl mx-auto px-4 sm:px-8 lg:px-10 flex items-end justify-end pb-3 sm:pb-4 lg:pb-5 z-10">
                    <div className="flex flex-wrap items-center gap-3 sm:gap-4 justify-end animate-in fade-in slide-in-from-bottom-2 duration-400">
                      <button
                        id="hero-men-collection-btn"
                        onClick={() => navigateToCategory('men')}
                        className="group flex items-center gap-1.5 text-white hover:text-amber-400 font-bold text-sm sm:text-base lg:text-lg tracking-wide uppercase transition-all cursor-pointer drop-shadow-lg active:scale-95 bg-transparent border-0 p-0"
                      >
                        <span className="relative">
                          Shop for men
                          <span className="block h-0.5 w-0 group-hover:w-full bg-amber-400 transition-all duration-300" />
                        </span>
                        <ArrowRight className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-amber-400 group-hover:translate-x-1 transition-transform" />
                      </button>

                      <span className="text-white/40 text-sm sm:text-base font-light select-none">|</span>

                      <button
                        id="hero-women-collection-btn"
                        onClick={() => navigateToCategory('women')}
                        className="group flex items-center gap-1.5 text-white hover:text-amber-400 font-bold text-sm sm:text-base lg:text-lg tracking-wide uppercase transition-all cursor-pointer drop-shadow-lg active:scale-95 bg-transparent border-0 p-0"
                      >
                        <span className="relative">
                          Shop for women
                          <span className="block h-0.5 w-0 group-hover:w-full bg-amber-400 transition-all duration-300" />
                        </span>
                        <ArrowRight className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-amber-400 group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Slider Navigation Arrows */}
            {activeBanners.length > 1 && (
              <>
                <button
                  onClick={prevSlide}
                  className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-stone-900/70 hover:bg-amber-500 text-white hover:text-stone-950 border border-white/15 flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Previous slide"
                >
                  <ChevronLeft className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
                <button
                  onClick={nextSlide}
                  className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-stone-900/70 hover:bg-amber-500 text-white hover:text-stone-950 border border-white/15 flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Next slide"
                >
                  <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>

                {/* Indicators */}
                <div className="absolute bottom-2.5 sm:bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5">
                  {activeBanners.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveSlide(idx)}
                      className={`h-1.5 rounded-full transition-all ${
                        idx === activeSlide ? 'w-6 bg-amber-500' : 'w-1.5 bg-white/40 hover:bg-white/70'
                      }`}
                      aria-label={`Go to slide ${idx + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </section>

      {/* 6. Collection Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-8 pb-4 border-b border-stone-200 gap-3">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-stone-900">
              কালেকশন গ্যালারি
            </h2>
            <p className="text-sm text-stone-500 mt-1">
              লুঙ্গি, পাঞ্জাবি, শাড়ি থেকে শুরু করে আধুনিক টি-শার্টের প্রিমিয়াম বৈচিত্র্য
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 sm:gap-6">
          {collections
            .filter((c) => c.isActive)
            .sort((a, b) => a.position - b.position)
            .map((col) => (
              <div
                key={col.id}
                onClick={() => {
                  const slug = col.link.replace('/category/', '');
                  navigateToCategory(slug);
                }}
                className="group relative aspect-4/5 rounded-2xl overflow-hidden bg-stone-100 cursor-pointer shadow-sm hover:shadow-xl transition-all duration-300"
              >
                <img
                  src={col.image}
                  alt={col.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/30 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <span className="text-xs text-amber-300 font-medium line-clamp-1 mb-1 block">
                    {col.subtitle}
                  </span>
                  <h3 className="font-bold text-base sm:text-lg leading-tight">
                    {col.banglaTitle || col.title}
                  </h3>
                  <span className="mt-2 text-xs font-bold text-white/90 flex items-center gap-1 group-hover:text-amber-400 transition-colors">
                    <span>এক্সপ্লোর করুন</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            ))}
        </div>
      </section>

      {/* 7. Latest / New Arrivals */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-8 pb-4 border-b border-stone-200 gap-3">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-stone-900">
              নতুন পোশাক (New Arrivals)
            </h2>
          </div>
          <button
            onClick={() => navigateToCategory('all')}
            className="text-sm font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1.5 transition-colors"
          >
            <span>সবগুলো দেখুন ({newArrivals.length})</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {newArrivals.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* 8. Best Selling Products */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-8 pb-4 border-b border-stone-200 gap-3">
          <div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-stone-900">
              বেস্ট সেলিং প্রোডাক্ট (Best Sellers)
            </h2>
          </div>
          <button
            onClick={() => navigateToCategory('all')}
            className="text-sm font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1.5 transition-colors"
          >
            <span>বেস্ট সেলার দেখুন</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {bestSellers.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* বিশেষ মেগা উৎসব ছাড়! (Mega Festival Offer Slider with Live Countdown Timer) */}
      <FestiveOfferSlider />

      {/* ঐতিহ্য ও ব্র্যান্ড পার্টনার (Brand & Artisan Partners 4-Box Slider with Detailed Modal) */}
      <BrandArtisanPartnersSection />
    </div>
  );
};
