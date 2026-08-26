import { DataSource, Like } from 'typeorm';
import { Logger } from '@nestjs/common';
import { Video } from '../src/modules/videos/entities/video.entity';
import { BusinessProfile } from '../src/modules/businesses/entities/business-profile.entity';
import { Offer } from '../src/modules/offers/entities/offer.entity';
import { User } from '../src/modules/users/entities/user.entity';
import { VideoType, VideoCategory, VideoStatus, UserRole, BusinessStatus, OfferStatus } from '../src/common/enums';
import { SeededUsersResult } from './01-seed-users';
import { SeededBusinessesResult } from './02-seed-businesses';
import { SeededOffersResult } from './03-seed-offers';

export interface SeededVideosResult {
  allVideos: Video[];
}

interface VideoSeedTemplate {
  businessSearch: string; // Used to find the matching business in DB
  title: string;
  description: string;
  video_url: string;
  thumbnail_url?: string | null;
  video_type: VideoType;
  category: VideoCategory;
  tags: string[];
  cta_title?: string | null;
  cta_url?: string | null;
  status?: VideoStatus;
  views_count: number;
  likes_count: number;
  linkOffer?: boolean;
}

const SEED_VIDEO_TEMPLATES: VideoSeedTemplate[] = [
  // 1. Food & Dining - Dum Biryani Handi (Vertical Reel / Short)
  {
    businessSearch: 'Restaurants & Dining',
    title: '🔥 Hyderabadi Dum Biryani Live Handi Prep & Secret Masala Reveal',
    description: 'Watch our master chef prep the legendary slow-cooked aromatic Dum Biryani with saffron rice & tender marinated cuts. Exclusive 25% discount for BizzDeal members!',
    video_url: 'https://www.youtube.com/shorts/5v1P_1t_rU8',
    thumbnail_url: 'https://img.youtube.com/vi/5v1P_1t_rU8/hqdefault.jpg',
    video_type: VideoType.SHORT_PORTRAIT,
    category: VideoCategory.OFFER,
    tags: ['biryani', 'foodie', 'vizagfood', 'sale', 'specialoffer', '50off', 'restaurant'],
    cta_title: 'Claim 25% Off Deal',
    cta_url: 'https://wa.me/919876543210?text=Hi%20Apex%20Dining%20I%20saw%20your%20BizzDeal%20Biryani%20video',
    status: VideoStatus.ACTIVE,
    views_count: 24500,
    likes_count: 890,
    linkOffer: true,
  },
  // 2. Mobiles & Electronics - 5G Smartphone Unboxing (Vertical Reel / Short)
  {
    businessSearch: 'Mobiles & Electronics',
    title: '📱 Flagship Smartphone 5G Unboxing & 200MP Camera Test in 60s',
    description: 'Quick unboxing of the newest flagship smartphone! Super AMOLED 120Hz display and 200MP Nightography test. Grab Flat ₹150 instant discount today.',
    video_url: 'https://www.youtube.com/shorts/kJQP7kiw5Fk',
    thumbnail_url: 'https://img.youtube.com/vi/kJQP7kiw5Fk/hqdefault.jpg',
    video_type: VideoType.SHORT_PORTRAIT,
    category: VideoCategory.PRODUCT_DEMO,
    tags: ['gadgets', 'smartphone', 'unboxing', 'techdeals', 'electronics', 'trending'],
    cta_title: 'Get ₹150 Voucher',
    cta_url: 'https://wa.me/919876543211?text=Inquiry%20Smartphone%20Offer',
    status: VideoStatus.ACTIVE,
    views_count: 38200,
    likes_count: 1420,
    linkOffer: true,
  },
  // 3. Furniture & Interiors - Showroom Tour (16:9 Landscape)
  {
    businessSearch: 'Furniture & Interiors',
    title: '🏬 Luxury Living Room & Modular Kitchen Showroom Walkthrough',
    description: 'Take a virtual tour of our 10,000 sq.ft designer showroom in Visakhapatnam. Explore ergonomic recliners, Italian marble dining sets, and custom modular kitchens.',
    video_url: 'https://www.youtube.com/watch?v=hOgVAYpHPCc',
    thumbnail_url: 'https://img.youtube.com/vi/hOgVAYpHPCc/hqdefault.jpg',
    video_type: VideoType.LANDSCAPE,
    category: VideoCategory.BUSINESS_TOUR,
    tags: ['storetour', 'furniture', 'interiors', 'homedecor', 'exclusive', 'vizag'],
    cta_title: 'Book Free Consultation',
    cta_url: 'https://wa.me/919876543212?text=Hello%20Furniture%20Interiors%20Inquiry',
    status: VideoStatus.ACTIVE,
    views_count: 12800,
    likes_count: 430,
    linkOffer: false,
  },
  // 4. Fashion & Clothing - Silk Saree Collection (Vertical Reel / Short)
  {
    businessSearch: 'Fashion & Clothing',
    title: '✨ Grand Festive Kanjivaram Silk Saree & Bridal Lehenga Showcase',
    description: 'Pure zari woven pure silk sarees and handcrafted designer bridal lehengas for the upcoming wedding season. Enjoy 25% festival savings with your BizzDeal membership.',
    video_url: 'https://www.youtube.com/shorts/3f4Y2N4wUJE',
    thumbnail_url: 'https://img.youtube.com/vi/3f4Y2N4wUJE/hqdefault.jpg',
    video_type: VideoType.SHORT_PORTRAIT,
    category: VideoCategory.OFFER,
    tags: ['fashion', 'silk', 'lehenga', 'wedding', 'megadeal', 'trending', 'sale'],
    cta_title: 'View 25% Deal',
    cta_url: 'https://wa.me/919876543213?text=Hi%20Fashion%20Store%20Silk%20Saree%20Enquiry',
    status: VideoStatus.ACTIVE,
    views_count: 31400,
    likes_count: 1120,
    linkOffer: true,
  },
  // 5. Fitness & Gyms - Arena Tour (16:9 Landscape)
  {
    businessSearch: 'Fitness & Gyms',
    title: '💪 High-Intensity Crossfit & Strength Arena Tour',
    description: 'State-of-the-art strength training machinery, Olympic lifting platforms, certified personal trainers, and steam bath recovery. Get 15% instant cashback on annual plans!',
    video_url: 'https://www.youtube.com/watch?v=JGwWNGJdvx8',
    thumbnail_url: 'https://img.youtube.com/vi/JGwWNGJdvx8/hqdefault.jpg',
    video_type: VideoType.LANDSCAPE,
    category: VideoCategory.BUSINESS_TOUR,
    tags: ['fitness', 'gym', 'workout', 'cashback', 'health', 'training', 'vizag'],
    cta_title: 'Join Today - 15% Cashback',
    cta_url: 'https://wa.me/919876543214?text=Interested%20in%20Gym%20Membership',
    status: VideoStatus.ACTIVE,
    views_count: 15600,
    likes_count: 580,
    linkOffer: true,
  },
  // 6. Jewellery & Watches - Gold & Diamond Shimmer (Vertical Reel / Short)
  {
    businessSearch: 'Jewellery & Watches',
    title: '💎 22K Hallmark Gold Choker & Diamond Solitaire Sparkle Reel',
    description: 'Exquisite BIS 916 hallmarked antique bridal gold choker and VVS clarity diamond jewellery. Earn 100 extra Bizz Coins on every booking!',
    video_url: 'https://www.youtube.com/shorts/hL9n24-5XQk',
    thumbnail_url: 'https://img.youtube.com/vi/hL9n24-5XQk/hqdefault.jpg',
    video_type: VideoType.SHORT_PORTRAIT,
    category: VideoCategory.PRODUCT_DEMO,
    tags: ['jewellery', 'gold', 'diamonds', 'wedding', 'bizzdeal', 'cashback', 'luxury'],
    cta_title: 'Claim Gold Offer',
    cta_url: 'https://wa.me/919876543215?text=Gold%20Jewellery%20Inquiry',
    status: VideoStatus.ACTIVE,
    views_count: 42000,
    likes_count: 1680,
    linkOffer: true,
  },
  // 7. Supermarket & Grocery - Customer Testimonial (Vertical Reel / Short)
  {
    businessSearch: 'Supermarket & Grocery',
    title: '⭐ "Saved ₹4,500 on Monthly Groceries with Bizz Coins!" - Customer Review',
    description: 'Listen to Mrs. Swathi share how redeeming Bizz Coins at our supermarket saved her family ₹4,500 on monthly staples and fresh organic produce.',
    video_url: 'https://www.youtube.com/shorts/eM8_w4n2-XQ',
    thumbnail_url: 'https://img.youtube.com/vi/eM8_w4n2-XQ/hqdefault.jpg',
    video_type: VideoType.SHORT_PORTRAIT,
    category: VideoCategory.TESTIMONIAL,
    tags: ['testimonial', 'review', 'savings', 'bizzcoins', 'happycustomer', 'supermarket', 'groceries'],
    cta_title: 'Earn Double Bizz Coins',
    cta_url: 'https://wa.me/919876543216?text=Hi%20Supermarket%20Order%20Inquiry',
    status: VideoStatus.ACTIVE,
    views_count: 19800,
    likes_count: 760,
    linkOffer: true,
  },
  // 8. Automobiles - Ceramic Coating (16:9 Landscape)
  {
    businessSearch: 'Automobiles',
    title: '🚗 9H Ceramic Coating & Super Hydrophobic Water Beading Test',
    description: 'Complete paint correction and 9H dual-layer nano ceramic shield applied to a luxury SUV. Experience mirror finish protection against swirls, scratches, and UV damage.',
    video_url: 'https://www.youtube.com/watch?v=L_LUpnjgPso',
    thumbnail_url: 'https://img.youtube.com/vi/L_LUpnjgPso/hqdefault.jpg',
    video_type: VideoType.LANDSCAPE,
    category: VideoCategory.PRODUCT_DEMO,
    tags: ['autodetailing', 'ceramiccoating', 'carservice', 'automobiles', 'vizag', 'cashback'],
    cta_title: 'Book ₹300 Cashback Wash',
    cta_url: 'https://wa.me/919876543217?text=Car%20Detailing%20Slot%20Booking',
    status: VideoStatus.ACTIVE,
    views_count: 9400,
    likes_count: 310,
    linkOffer: true,
  },
  // 9. Beauty Salons & Spa - HydraFacial Routine (Vertical Reel / Short)
  {
    businessSearch: 'Beauty Salons & Spa',
    title: '💆 Relaxing Korean Glass-Skin HydraFacial Step-by-Step Routine',
    description: 'Deep pore extraction, hyaluronic acid infusion, and LED phototherapy for glowing radiant skin. Pamper yourself with 25% off this weekend!',
    video_url: 'https://www.youtube.com/shorts/qR8YV_L2U0s',
    thumbnail_url: 'https://img.youtube.com/vi/qR8YV_L2U0s/hqdefault.jpg',
    video_type: VideoType.SHORT_PORTRAIT,
    category: VideoCategory.PRODUCT_DEMO,
    tags: ['salon', 'spa', 'hydrafacial', 'skincare', 'glow', 'offer', 'beauty'],
    cta_title: 'Book Appointment',
    cta_url: 'https://wa.me/919876543218?text=Book%20HydraFacial%20Appointment',
    status: VideoStatus.ACTIVE,
    views_count: 27500,
    likes_count: 940,
    linkOffer: true,
  },
  // 10. Hospitals & Healthcare - Robotic Surgery Suite (16:9 Landscape)
  {
    businessSearch: 'Hospitals & Healthcare',
    title: '🏥 State-of-the-Art Robotic Surgery Suite & 24/7 Emergency Care',
    description: 'Meet our senior surgeons and tour our advanced 4K minimally invasive laparoscopy and robotic operation theaters with high-definition patient monitoring.',
    video_url: 'https://www.youtube.com/watch?v=fJ9rUzIMcZQ',
    thumbnail_url: 'https://img.youtube.com/vi/fJ9rUzIMcZQ/hqdefault.jpg',
    video_type: VideoType.LANDSCAPE,
    category: VideoCategory.BUSINESS_TOUR,
    tags: ['healthcare', 'hospital', 'roboticsurgery', 'emergency', 'vizag', 'doctors'],
    cta_title: 'Consult Specialist',
    cta_url: 'https://wa.me/919876543219?text=Healthcare%20Consultation%20Appointment',
    status: VideoStatus.ACTIVE,
    views_count: 8200,
    likes_count: 250,
    linkOffer: false,
  },
  // 11. Eye Care - Blade-Free LASIK (16:9 Landscape)
  {
    businessSearch: 'Eye Care',
    title: '👁️ Custom Robotic LASIK Procedure: 100% Blade-Free Vision Correction',
    description: 'Dr. Srinivas explains how Femtosecond laser technology corrects myopia and astigmatism in just 10 minutes with pain-free recovery and 20/20 vision clarity.',
    video_url: 'https://www.youtube.com/watch?v=kJQP7kiw5Fk',
    thumbnail_url: 'https://img.youtube.com/vi/kJQP7kiw5Fk/hqdefault.jpg',
    video_type: VideoType.LANDSCAPE,
    category: VideoCategory.GENERAL,
    tags: ['eyecare', 'lasik', 'vision', 'healthcare', 'consultation', 'offer'],
    cta_title: 'Claim ₹150 OFF Checkup',
    cta_url: 'https://wa.me/919876543220?text=Lasik%20Consultation%20Inquiry',
    status: VideoStatus.ACTIVE,
    views_count: 14100,
    likes_count: 480,
    linkOffer: true,
  },
  // 12. Bakeries & Confectionery - Truffle Cake Piping (Vertical Reel / Short)
  {
    businessSearch: 'Bakeries & Confectionery',
    title: '🎂 3-Tier Belgian Dark Truffle Cake Piping & Mirror Glaze Time-Lapse',
    description: 'Artisan cake decorating in action! Layered with rich 70% dark Belgian chocolate ganache and edible gold leafing. Order customized designer cakes with 25% off!',
    video_url: 'https://www.youtube.com/shorts/5v1P_1t_rU8',
    thumbnail_url: 'https://img.youtube.com/vi/5v1P_1t_rU8/hqdefault.jpg',
    video_type: VideoType.SHORT_PORTRAIT,
    category: VideoCategory.PRODUCT_DEMO,
    tags: ['bakery', 'cake', 'chocolate', 'truffle', 'vizagfood', 'desserts', 'celebration'],
    cta_title: 'Order Birthday Cake',
    cta_url: 'https://wa.me/919876543221?text=Order%20Custom%20Cake',
    status: VideoStatus.ACTIVE,
    views_count: 36000,
    likes_count: 1350,
    linkOffer: true,
  },
  // 13. Real Estate - Sea-Facing Villa (16:9 Landscape)
  {
    businessSearch: 'Real Estate',
    title: '🏡 Ultra-Luxury 4BHK Sea-Facing Gated Villa Tour | Beach Road Vizag',
    description: 'Experience panoramic Bay of Bengal ocean views, private infinity plunge pool, smart home integration, and double-height ceiling living hall in this ultra-exclusive villa.',
    video_url: 'https://www.youtube.com/watch?v=hOgVAYpHPCc',
    thumbnail_url: 'https://img.youtube.com/vi/hOgVAYpHPCc/hqdefault.jpg',
    video_type: VideoType.LANDSCAPE,
    category: VideoCategory.BUSINESS_TOUR,
    tags: ['realestate', 'villatour', 'luxuryhomes', 'beachroad', 'vizag', 'property'],
    cta_title: 'Schedule Site Visit',
    cta_url: 'https://wa.me/919876543222?text=Schedule%20Villa%20Site%20Visit',
    status: VideoStatus.ACTIVE,
    views_count: 21000,
    likes_count: 670,
    linkOffer: false,
  },
  // 14. Footwear - All-Terrain Sneaker Test (Vertical Reel / Short)
  {
    businessSearch: 'Footwear',
    title: '👟 Waterproof All-Terrain Sneaker Durability & Water Resistance Test',
    description: 'Submerging our best-selling breathable waterproof trail running sneakers under running water and mud. 100% dry feet guaranteed! Get 15% instant cashback.',
    video_url: 'https://www.youtube.com/shorts/kJQP7kiw5Fk',
    thumbnail_url: 'https://img.youtube.com/vi/kJQP7kiw5Fk/hqdefault.jpg',
    video_type: VideoType.SHORT_PORTRAIT,
    category: VideoCategory.PRODUCT_DEMO,
    tags: ['footwear', 'sneakers', 'streetwear', 'trending', 'sale', 'cashback'],
    cta_title: 'Claim 15% Cashback',
    cta_url: 'https://wa.me/919876543223?text=Sneakers%20Offer%20Enquiry',
    status: VideoStatus.ACTIVE,
    views_count: 18400,
    likes_count: 620,
    linkOffer: true,
  },
  // 15. Hotels & Resorts - Infinity Pool Suite (16:9 Landscape)
  {
    businessSearch: 'Hotels & Resorts',
    title: '🌅 Sunset Infinity Pool & Presidential Suite Experience',
    description: 'Looking for the ultimate weekend getaway? Relax in our ocean-view infinity pool, luxury cabanas, multi-cuisine beachfront diner, and private balcony jacuzzi.',
    video_url: 'https://www.youtube.com/watch?v=JGwWNGJdvx8',
    thumbnail_url: 'https://img.youtube.com/vi/JGwWNGJdvx8/hqdefault.jpg',
    video_type: VideoType.LANDSCAPE,
    category: VideoCategory.BUSINESS_TOUR,
    tags: ['resort', 'vacation', 'staycation', 'hospitality', 'exclusive', 'hotel'],
    cta_title: 'Earn Double Bizz Coins',
    cta_url: 'https://wa.me/919876543224?text=Resort%20Room%20Booking',
    status: VideoStatus.ACTIVE,
    views_count: 16900,
    likes_count: 530,
    linkOffer: true,
  },
  // 16. Opticians & Eyewear - Polarized Sunglasses (Square 1:1)
  {
    businessSearch: 'Opticians',
    title: '🕶️ Polarized UV400 Aviator Sunglasses Summer Collection 2026',
    description: 'Premium lightweight titanium frame sunglasses with scratch-resistant polarized lenses. Ideal for driving and beach outings. Flat ₹150 off for BizzDeal members.',
    video_url: 'https://www.youtube.com/watch?v=L_LUpnjgPso',
    thumbnail_url: 'https://img.youtube.com/vi/L_LUpnjgPso/hqdefault.jpg',
    video_type: VideoType.SQUARE,
    category: VideoCategory.PRODUCT_DEMO,
    tags: ['eyewear', 'sunglasses', 'summerstyle', 'fashion', 'deals', 'accessories'],
    cta_title: 'Claim ₹150 Voucher',
    cta_url: 'https://wa.me/919876543225?text=Sunglasses%20Offer',
    status: VideoStatus.ACTIVE,
    views_count: 11200,
    likes_count: 390,
    linkOffer: true,
  },
  // 17. Cafes & Coffee Shops - Hazelnut Latte Art (Vertical Reel / Short)
  {
    businessSearch: 'Cafes',
    title: '☕ Artisan Pour-Over Coffee & Handcrafted Hazelnut Latte Art',
    description: 'Freshly roasted single-origin Arabica beans extracted to perfection. Pair your handcrafted coffee with warm chocolate croissants at 25% discount!',
    video_url: 'https://www.youtube.com/shorts/3f4Y2N4wUJE',
    thumbnail_url: 'https://img.youtube.com/vi/3f4Y2N4wUJE/hqdefault.jpg',
    video_type: VideoType.SHORT_PORTRAIT,
    category: VideoCategory.PRODUCT_DEMO,
    tags: ['coffee', 'latteart', 'cafe', 'foodie', 'hangout', 'barista', 'discount'],
    cta_title: 'Get 25% Off Coffee',
    cta_url: 'https://wa.me/919876543226?text=Cafe%20Deal%20Coupon',
    status: VideoStatus.ACTIVE,
    views_count: 22100,
    likes_count: 810,
    linkOffer: true,
  },
  // 18. Draft / Inactive Video (For Member Management Testing)
  {
    businessSearch: 'Restaurants & Dining',
    title: '📝 [Draft Preview] Upcoming Monsoon Food Fest Promo Clip',
    description: 'Internal draft preview clip for the upcoming Monsoon Food Festival. Scheduled to go live next week.',
    video_url: 'https://www.youtube.com/watch?v=hOgVAYpHPCc',
    thumbnail_url: 'https://img.youtube.com/vi/hOgVAYpHPCc/hqdefault.jpg',
    video_type: VideoType.LANDSCAPE,
    category: VideoCategory.GENERAL,
    tags: ['draft', 'upcoming', 'foodfest', 'preview'],
    cta_title: 'Coming Soon',
    cta_url: null,
    status: VideoStatus.INACTIVE,
    views_count: 45,
    likes_count: 3,
    linkOffer: false,
  },
];

export async function seedDummyVideos(
  dataSource: DataSource,
  users?: SeededUsersResult,
  businesses?: SeededBusinessesResult,
  offers?: SeededOffersResult,
): Promise<SeededVideosResult> {
  const logger = new Logger('SeedDummyVideos');
  logger.log('Seeding dummy member videos across multiple orientations, categories, and tags...');

  const videoRepo = dataSource.getRepository(Video);
  const bizRepo = dataSource.getRepository(BusinessProfile);
  const offerRepo = dataSource.getRepository(Offer);
  const userRepo = dataSource.getRepository(User);

  // Fetch or use active businesses
  let allBusinesses: BusinessProfile[] = [];
  if (businesses?.allBusinesses?.length) {
    allBusinesses = businesses.allBusinesses;
  } else {
    allBusinesses = await bizRepo.find({
      where: { status: BusinessStatus.ACTIVE },
      relations: { category: true },
    });
  }

  if (allBusinesses.length === 0) {
    logger.warn('No active businesses found in database to link videos to. Aborting video seed.');
    return { allVideos: [] };
  }

  // Fetch fallback owners
  const dummyOwners = await userRepo.find({
    where: { email: Like('owner%@bizzdeal.com') },
  });

  const allSeededVideos: Video[] = [];

  for (let i = 0; i < SEED_VIDEO_TEMPLATES.length; i++) {
    const tpl = SEED_VIDEO_TEMPLATES[i];

    // Find the best matching business based on search keyword in business name or category
    let matchedBiz = allBusinesses.find(
      (b) =>
        b.name.toLowerCase().includes(tpl.businessSearch.toLowerCase()) ||
        b.category?.name.toLowerCase().includes(tpl.businessSearch.toLowerCase())
    );

    if (!matchedBiz) {
      matchedBiz = allBusinesses[i % allBusinesses.length];
    }

    // Determine the owner ID
    let ownerId = matchedBiz.owner_id;
    if (!ownerId && dummyOwners.length > 0) {
      ownerId = dummyOwners[i % dummyOwners.length].id;
    }
    if (!ownerId) {
      const firstUser = await userRepo.findOne({ where: {} });
      if (firstUser) ownerId = firstUser.id;
    }
    if (!ownerId) {
      logger.warn(`Could not determine owner ID for video: ${tpl.title}. Skipping.`);
      continue;
    }

    // Find an offer for this business if requested
    let matchedOfferId: string | null = null;
    if (tpl.linkOffer && matchedBiz.id) {
      const bizOffer = await offerRepo.findOne({
        where: { business_id: matchedBiz.id, status: OfferStatus.APPROVED },
      });
      if (bizOffer) {
        matchedOfferId = bizOffer.id;
      }
    }

    // Check if video already exists by title
    let video = await videoRepo.findOne({ where: { title: tpl.title } });

    if (!video) {
      video = videoRepo.create({
        user_id: ownerId,
        business_id: matchedBiz.id,
        offer_id: matchedOfferId,
        title: tpl.title,
        description: tpl.description,
        video_url: tpl.video_url,
        thumbnail_url: tpl.thumbnail_url || null,
        video_type: tpl.video_type,
        category: tpl.category,
        tags: tpl.tags,
        cta_title: tpl.cta_title || null,
        cta_url: tpl.cta_url || null,
        status: tpl.status || VideoStatus.ACTIVE,
        views_count: tpl.views_count,
        likes_count: tpl.likes_count,
      });
    } else {
      // Update existing video to keep data synchronized
      video.user_id = ownerId;
      video.business_id = matchedBiz.id;
      video.offer_id = matchedOfferId;
      video.description = tpl.description;
      video.video_url = tpl.video_url;
      video.thumbnail_url = tpl.thumbnail_url || video.thumbnail_url;
      video.video_type = tpl.video_type;
      video.category = tpl.category;
      video.tags = tpl.tags;
      video.cta_title = tpl.cta_title || null;
      video.cta_url = tpl.cta_url || null;
      video.status = tpl.status || VideoStatus.ACTIVE;
      video.views_count = tpl.views_count;
      video.likes_count = tpl.likes_count;
    }

    const savedVideo = await videoRepo.save(video);
    allSeededVideos.push(savedVideo);
    logger.log(`[${tpl.video_type}] Seeded video: "${tpl.title.substring(0, 45)}..." for ${matchedBiz.name}`);
  }

  logger.log(`Successfully seeded ${allSeededVideos.length} member videos!`);
  return { allVideos: allSeededVideos };
}
