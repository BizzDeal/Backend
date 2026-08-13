import { DataSource } from 'typeorm';
import { Logger } from '@nestjs/common';
import { BusinessProfile } from '../src/modules/businesses/entities/business-profile.entity';
import { BusinessCategory } from '../src/modules/businesses/entities/business-category.entity';
import { BusinessStatus } from '../src/common/enums';
import { SeededUsersResult } from './01-seed-users';
import { State } from '../src/modules/location/entities/state.entity';
import { District } from '../src/modules/location/entities/district.entity';

export interface SeededBusinessesResult {
  business1: BusinessProfile;
  business2: BusinessProfile;
  business3: BusinessProfile;
  business4: BusinessProfile;
  allBusinesses: BusinessProfile[];
}

const CATEGORY_DEFINITIONS = [
  { name: 'IT Services', slug: 'it-services', description: 'Information Technology and Software Services' },
  { name: 'Restaurant', slug: 'restaurant', description: 'Food, Dining, and Restaurants' },
  { name: 'Hotels', slug: 'hotels', description: 'Hotels, Resorts, and Hospitality' },
  { name: 'Healthcare', slug: 'healthcare', description: 'Hospitals, Clinics, and Healthcare Providers' },
  { name: 'Real Estate', slug: 'real-estate', description: 'Real Estate Agencies, Brokers, and Properties' },
  { name: 'Education', slug: 'education', description: 'Schools, Colleges, and Educational Institutes' },
  { name: 'Retail', slug: 'retail', description: 'Retail Stores, Shopping, and E-commerce' },
  { name: 'Automotive', slug: 'automotive', description: 'Automotive, Auto Repair, and Dealerships' },
  { name: 'Beauty & Spa', slug: 'beauty-and-spa', description: 'Salons, Spas, and Personal Care' },
  { name: 'Fitness & Gyms', slug: 'fitness-and-gyms', description: 'Gyms, Yoga, and Fitness Centers' },
  { name: 'Home Services', slug: 'home-services', description: 'Plumbing, Cleaning, and Repairs' },
  { name: 'Professional Services', slug: 'professional-services', description: 'Legal, Accounting, and Consulting' },
  { name: 'Travel & Tourism', slug: 'travel-and-tourism', description: 'Travel Agencies, and Tour Operators' },
  { name: 'Entertainment', slug: 'entertainment', description: 'Theaters, Amusements, and Events' },
];

const CATEGORY_BUSINESSES: Record<string, Array<{ name: string; description: string; address: string }>> = {
  'it-services': [
    { name: 'CloudTech Solutions Vizag', description: 'Cloud Consulting, AWS & Azure Migration and Software Development.', address: 'Plot 101, IT SEZ, Rushikonda, Visakhapatnam' },
    { name: 'CodeCraft Software Vijayawada', description: 'Full-stack Web & Mobile App Development with Next.js & NestJS.', address: 'D.No 40-1-12, Benz Circle, Vijayawada' },
    { name: 'CyberShield IT Systems', description: 'Cybersecurity, Firewall Installation, and Enterprise Network Security.', address: 'D.No 12-5, VIP Road, Visakhapatnam' },
    { name: 'Apex AI & Data Labs', description: 'Machine Learning, Data Engineering, and Predictive Analytics.', address: 'Plot 45, Tech Park, Guntur' },
    { name: 'Quantum Byte Technologies', description: 'Custom ERP, CRM, and SaaS Product Engineering.', address: 'D.No 89-2, Main Road, Tirupati' },
    { name: 'Nexus Infotech Guntur', description: 'IT Hardware, Server Infrastructure, and Cloud Maintenance.', address: 'D.No 14-1, Brodipet, Guntur' },
    { name: 'PixelMatrix Digital Studios', description: 'UI/UX Design, Web Applications, and Modern Branding.', address: 'D.No 5-2, MVP Colony, Visakhapatnam' },
    { name: 'SmartCloud Managed Services', description: '24/7 Server Management, DevOps, and Infrastructure Monitoring.', address: 'D.No 22-8, Ring Road, Vijayawada' },
    { name: 'InnovateX Software Solutions', description: 'Native Android & iOS Application Development.', address: 'D.No 7-3, Governorpet, Vijayawada' },
    { name: 'TechVantage Systems Tirupati', description: 'Enterprise Software Solutions & E-commerce Integration.', address: 'D.No 19-4, KT Road, Tirupati' },
  ],
  'restaurant': [
    { name: 'Spicy Bites Multi-Cuisine Restaurant', description: 'Authentic South Indian & North Indian Tandoori delicacies.', address: 'Plot 14, Beach Road, Siripuram, Visakhapatnam' },
    { name: 'Royal Biryani House & Tandoor', description: 'Hyderabadi Dum Biryani, Kebabs, and Mughlai Delights.', address: 'D.No 33-1-5, M.G. Road, Vijayawada' },
    { name: 'Sea Breeze Seafood Restaurant', description: 'Fresh Coastal Seafood, Prawn Fry, and Crab Curry.', address: 'Lawsons Bay Colony, Beach Road, Visakhapatnam' },
    { name: 'Saffron Fine Dining & Lounge', description: 'Luxury Indian & Pan-Asian Fine Dining experience.', address: 'D.No 10-2, Dwaraka Nagar, Visakhapatnam' },
    { name: 'Urban Bistro & Cafe', description: 'Artisan Coffee, Pastas, Burgers, and Continental Breakfast.', address: 'D.No 45-2, Bandar Road, Vijayawada' },
    { name: 'Spice Garden Pure Veg Restaurant', description: '100% Pure Veg Traditional Andhra & North Indian Thalis.', address: 'D.No 89-1, Main Bazaar, Tirupati' },
    { name: 'Bamboo Hut Chinese Kitchen', description: 'Authentic Hakka Noodles, Momos, and Manchurian.', address: 'D.No 12-4, Arundelpet, Guntur' },
    { name: 'Tandoori Junction Express', description: 'Sizzling Tandoori Chicken, Naan, and Kathi Rolls.', address: 'D.No 8-2, Cinema Road, Kakinada' },
    { name: 'Coastal Flavors Family Restaurant', description: 'Traditional Royyala Iguru and Gongura Mutton Meals.', address: 'D.No 15-3, Trunk Road, Nellore' },
    { name: 'Sweet Tooth Dessert Cafe', description: 'Fresh Waffles, Crepes, Sundaes, and Specialty Shakes.', address: 'D.No 3-1, Sampath Vinayaka Temple Road, Visakhapatnam' },
  ],
  'hotels': [
    { name: 'Grand Bay Resort & Spa', description: '5-Star Beachfront Resort with Infinity Pool and Ocean Views.', address: 'Beach Road, Maharani Peta, Visakhapatnam' },
    { name: 'Crown Plaza Executive Hotel', description: 'Business Hotel with Conference Halls and Executive Suites.', address: 'M.G. Road, Vijayawada' },
    { name: 'Sunrise Heritage Hotel', description: 'Boutique Heritage Stay with Authentic Local Architecture.', address: 'Near Railway Station, Tirupati' },
    { name: 'Royal Palms Luxury Hotel', description: 'Luxury Accommodations with 24/7 Room Service & Dining.', address: 'D.No 12-1, VIP Road, Visakhapatnam' },
    { name: 'Harbor View Hotel & Banquet', description: 'Panoramic Harbor Views and Grand Banquet Halls.', address: 'Port Area, Visakhapatnam' },
    { name: 'Coastal Inn Express', description: 'Modern Budget Hotel for Business & Family Travelers.', address: 'Eluru Road, Vijayawada' },
    { name: 'Serene Hills Resort & Villa', description: 'Eco-friendly Hillside Resort surrounded by nature.', address: 'Araku Valley Road, Visakhapatnam District' },
    { name: 'Park Premium Suites', description: 'Serviced Luxury Apartments for Short & Long Stays.', address: 'Siripuram Junction, Visakhapatnam' },
    { name: 'Blue Lagoon Waterfront Hotel', description: 'Waterfront Dining, Swimming Pool & Spa Resort.', address: 'Kakinada Beach Road, Kakinada' },
    { name: 'Emerald Bay Grand Hotel', description: 'Spacious Suites, Fine Dining, and Event Banquets.', address: 'GNT Road, Guntur' },
  ],
  'healthcare': [
    { name: 'Apollo Care Multi-Specialty Hospital', description: 'Advanced Emergency, Cardiology, Orthopedics & Intensive Care.', address: 'Health City, Arilova, Visakhapatnam' },
    { name: 'Sunrise Dental & Orthodontic Clinic', description: 'Laser Dentistry, Teeth Whitening & Invisible Aligners.', address: 'D.No 40-1, Benz Circle, Vijayawada' },
    { name: 'Lotus Eye Care & Vision Center', description: 'LASIK Surgery, Cataract Treatment & Pediatric Ophthalmology.', address: 'D.No 10-5, Ram Nagar, Visakhapatnam' },
    { name: 'PrimeCare Diagnostic & Path Labs', description: 'Fully Automated MRI, CT Scan, and Pathology Lab.', address: 'D.No 14-2, Brodipet, Guntur' },
    { name: 'Healing Touch Physiotherapy & Rehab', description: 'Spine & Joint Rehabilitation, Sports Injury Recovery.', address: 'D.No 8-1, MVP Colony, Visakhapatnam' },
    { name: 'Skin & Aesthetic Dermatology Clinic', description: 'Laser Hair Removal, Acne Treatment & Anti-Aging Care.', address: 'D.No 45-3, M.G. Road, Vijayawada' },
    { name: 'Mother & Child Specialty Hospital', description: 'Pediatric Care, Obstetrics, Gynaecology & Neonatal ICU.', address: 'D.No 19-2, KT Road, Tirupati' },
    { name: 'MedPlus Family Health Clinic', description: 'General Physician Consultations, Vaccinations & Pharmacy.', address: 'D.No 6-4, Main Bazaar, Kakinada' },
    { name: 'Apex Cardiac & Heart Institute', description: 'Interventional Cardiology, Bypass Surgery & Angioplasty.', address: 'D.No 12-8, Maharani Peta, Visakhapatnam' },
    { name: 'Sanjeevani Ayurveda & Wellness Center', description: 'Authentic Panchakarma, Abhyanga & Ayurvedic Therapies.', address: 'D.No 3-2, Subhash Nagar, Tirupati' },
  ],
  'real-estate': [
    { name: 'Prime Properties & Builders', description: 'Luxury 3BHK & 4BHK Apartments and Gated Community Villas.', address: 'D.No 10-1, Siripuram, Visakhapatnam' },
    { name: 'Coastal Heights Real Estate', description: 'Beachfront Land Plots, Commercial Buildings & Investment Properties.', address: 'Beach Road, Visakhapatnam' },
    { name: 'Apex Urban Developers', description: 'HMDA & APCRDA Approved Residential Townships.', address: 'Amaravati Road, Guntur' },
    { name: 'Sunrise Real Estate Advisory', description: 'Property Buying, Selling, Valuation & Legal Verification.', address: 'Bandar Road, Vijayawada' },
    { name: 'Emerald City Infrastructure', description: 'Open Plots, Farm Lands & Integrated Gated Layouts.', address: 'Renigunta Road, Tirupati' },
    { name: 'Heritage Homes & Construction', description: 'Turnkey Civil Construction, Villa Architecture & Contracting.', address: 'MVP Colony, Visakhapatnam' },
    { name: 'Green Acres Land Developers', description: 'Organic Farmlands, Mango Groves & Hill View Resorts.', address: 'Anakapalle Road, Visakhapatnam' },
    { name: 'Skyline Commercial Spaces', description: 'IT Office Space, Retail Showroom Leases & Warehousing.', address: 'Auto Nagar, Vijayawada' },
    { name: 'Fortune Realtors & Brokers', description: 'Commercial & Residential Brokerage and Lease Management.', address: 'Brodipet, Guntur' },
    { name: 'Blue Chip Realty Visakhapatnam', description: 'High Return Real Estate Investments & Joint Ventures.', address: 'Dwaraka Nagar, Visakhapatnam' },
  ],
  'education': [
    { name: 'Apex Academy & Coaching', description: 'IIT-JEE, NEET & EAPCET Coaching by Top Faculty.', address: 'D.No 10-2, Dwaraka Nagar, Visakhapatnam' },
    { name: 'Cambridge International School', description: 'CBSE & IB Curriculum K-12 World School.', address: 'Rushikonda, Visakhapatnam' },
    { name: 'Bright Minds Early Learning Preschool', description: 'Montessori Preschool, Daycare & Activity Center.', address: 'MVP Colony, Visakhapatnam' },
    { name: 'Future Tech Coding & Robotics Academy', description: 'Coding, Artificial Intelligence & Robotics for Kids & Students.', address: 'Benz Circle, Vijayawada' },
    { name: 'Global Language & IELTS Institute', description: 'IELTS, TOEFL, GRE Prep & Spoken English Training.', address: 'Governorpet, Vijayawada' },
    { name: 'Spectrum Degree & PG College', description: 'B.Sc, B.Com, BBA & M.Sc Degree Programs.', address: 'GNT Road, Guntur' },
    { name: 'Scholar Choice Career Guidance', description: 'Overseas Education Consulting for USA, UK, Canada & Australia.', address: 'Dwaraka Nagar, Visakhapatnam' },
    { name: 'Masterminds Commerce & CA Academy', description: 'CA Foundation, Inter & Final Specialized Coaching.', address: 'Arundelpet, Guntur' },
    { name: 'Excellence Music & Arts Academy', description: 'Carnatic Vocal, Guitar, Piano, Dance & Fine Arts.', address: 'KT Road, Tirupati' },
    { name: 'Apex Skill Development Center', description: 'Full Stack Web Dev, Data Science & Digital Marketing Courses.', address: 'Main Road, Kakinada' },
  ],
  'retail': [
    { name: 'Trends Fashion Hub', description: 'Exclusive Ethnic Wear, Sarees, Designer Suits & Casual Apparel.', address: 'D.No 45-2, MG Road, Vijayawada' },
    { name: 'Green Grocers Organic Supermarket', description: '100% Organic Fresh Fruits, Vegetables & Cold Pressed Oils.', address: 'D.No 89-1-2, Main Bazaar, Tirupati' },
    { name: 'Digital World Electronics & Mobiles', description: 'Latest Laptops, Smartphones, Smart TVs & Home Appliances.', address: 'D.No 10-4, Jagadamba Centre, Visakhapatnam' },
    { name: 'Jewel Craft Gold & Diamond Silvers', description: 'Handcrafted Hallmark Gold Jewelry & Antique Silverware.', address: 'D.No 12-1, Main Bazaar, Vijayawada' },
    { name: 'Urban Living Furniture Studio', description: 'Teak Wood Sofas, Dining Tables, Beds & Modular Furniture.', address: 'Auto Nagar, Visakhapatnam' },
    { name: 'Bookworm Bookstore & Stationers', description: 'Bestselling Books, Academic Texts, Art Supplies & Gift Items.', address: 'Dwaraka Nagar, Visakhapatnam' },
    { name: 'Footwear Kingdom & Sneakers', description: 'Branded Sports Shoes, Leather Boots & Formal Footwear.', address: 'Brodipet, Guntur' },
    { name: 'Home Decor & Kitchen Appliances', description: 'Modular Kitchen Accessories, Air Fryers & Crockery.', address: 'Trunk Road, Nellore' },
    { name: 'Toy Land & Kids Planet', description: 'Educational Toys, Tricycles, Board Games & Soft Toys.', address: 'MVP Colony, Visakhapatnam' },
    { name: 'Sports Hub & Fitness Gear', description: 'Cricket Bats, Football Gear, Gym Accessories & Sportswear.', address: 'Eluru Road, Vijayawada' },
  ],
  'automotive': [
    { name: 'Apex Auto Spares & Detailing', description: 'Multi-brand Car Servicing, Ceramic Coating & Genuine Spares.', address: 'D.No 99-0-1, Old Town, Guntur' },
    { name: 'Royal Motors Bike Workshop', description: 'Superbike Servicing, Engine Overhaul & Performance Exhausts.', address: 'D.No 12-2, Auto Nagar, Visakhapatnam' },
    { name: 'Express Car Wash & Ceramic Care', description: '3M Car Polish, Foam Wash & Paint Protection Film (PPF).', address: 'M.G. Road, Vijayawada' },
    { name: 'Speed Track Tire & Alloy Station', description: 'Computerized Wheel Alignment, Balancing & Branded Tires.', address: 'Dwaraka Nagar, Visakhapatnam' },
    { name: 'Autopro EV Station & Accessories', description: 'Electric Scooter Sales, Battery Swap & EV Charger Fitting.', address: 'Benz Circle, Vijayawada' },
    { name: 'Heritage Classic Car Restorations', description: 'Vintage Automobile Restoration & Custom Body Paint.', address: 'Rushikonda, Visakhapatnam' },
    { name: 'Drive Safe Auto Insurance & Claims', description: 'Cashless Car Insurance Claims & Breakdown Roadside Assistance.', address: 'Brodipet, Guntur' },
    { name: 'Precision Engine Tuning & Diagnostics', description: 'ECU Rebuilding, Scanning & Transmission Diagnostics.', address: 'Renigunta Road, Tirupati' },
    { name: 'Shine & Drive Car Spa', description: 'Steam Deep Cleaning, Odor Removal & Leather Conditioning.', address: 'Trunk Road, Nellore' },
    { name: 'City Motors Spare Parts & Batteries', description: 'Exide & Amaron Car Batteries, Oils & Original Spares.', address: 'Main Road, Kakinada' },
  ],
  'beauty-and-spa': [
    { name: 'Glamour Glow Unisex Salon', description: 'Hairstyling, Smoothening, Keratin & HydraFacial Treatments.', address: 'Siripuram, Visakhapatnam' },
    { name: 'Aura Luxury Spa & Wellness', description: 'Deep Tissue Massage, Swedish Scrub & Hot Stone Therapy.', address: 'Beach Road, Visakhapatnam' },
    { name: 'Velvet Touch Nails & Lash Bar', description: 'Nail Art Extensions, Gel Polish & Eyelash Extension Studio.', address: 'M.G. Road, Vijayawada' },
    { name: 'Blossom Herbal Beauty Parlour', description: 'Herbal Facials, Ayurvedic Hair Spa & Organic Threading.', address: 'Dwaraka Nagar, Visakhapatnam' },
    { name: 'Royal Grooming Barbershop for Men', description: 'Beard Styling, Hair Coloring & Relaxing Head Massage.', address: 'Brodipet, Guntur' },
    { name: 'Zen Holistic Therapy Center', description: 'Reflexology, Aromatherapy & Stress Relief Body Spa.', address: 'Bandar Road, Vijayawada' },
    { name: 'Mirror Mirror Bridal Studio', description: 'Professional HD Bridal Makeup, Hairdo & Saree Draping.', address: 'MVP Colony, Visakhapatnam' },
    { name: 'Urban Hair Studio & Color Lab', description: 'Balayage, Hair Botox, Highlights & Scalp Treatments.', address: 'KT Road, Tirupati' },
    { name: 'Radiance Aesthetic & Skin Clinic', description: 'Micro-needling, Anti-Aging & Laser Glow Treatments.', address: 'Arilova, Visakhapatnam' },
    { name: 'Body & Soul Rejuvenation Center', description: 'Full Body Scrub, Milk Bath & Detoxing Wellness Packages.', address: 'Main Bazaar, Kakinada' },
  ],
  'fitness-and-gyms': [
    { name: 'Powerhouse Gym & Fitness Center', description: 'Heavy Weightlifting, Bodybuilding & Cardio Zone.', address: 'MVP Colony, Visakhapatnam' },
    { name: 'Cult Fit Workout & Cardio Studio', description: 'Group HIIT Workouts, Crossfit, Dance Fitness & Zumba.', address: 'M.G. Road, Vijayawada' },
    { name: 'Prana Yoga & Meditation Center', description: 'Hatha Yoga, Power Yoga, Pranayama & Stress Relief.', address: 'Beach Road, Visakhapatnam' },
    { name: 'Iron Cave Heavy Weightlifting Gym', description: 'Personalized Strength Training & Powerlifting Equipment.', address: 'Brodipet, Guntur' },
    { name: 'Velocity Boxing & MMA Academy', description: 'Kickboxing, Muay Thai, Boxing & Self-Defense Training.', address: 'Dwaraka Nagar, Visakhapatnam' },
    { name: 'Pulse Fitness & Pilates Studio', description: 'Reformer Pilates, Core Conditioning & Flexibility Rehab.', address: 'Benz Circle, Vijayawada' },
    { name: 'Olympic Gold Swimming & Fitness', description: 'Temperature Controlled Swimming Pool & Aquatics Fitness.', address: 'Siripuram, Visakhapatnam' },
    { name: 'FitLife Nutrition & Health Cafe', description: 'Calorie Counted Meal Prep, Protein Shakes & Smoothies.', address: 'Governorpet, Vijayawada' },
    { name: 'Synergy Calisthenics & Bodyweight Park', description: 'Street Workout, Gymnastics Rings & Calisthenics Bars.', address: 'KT Road, Tirupati' },
    { name: 'Titan Athletics & Fitness Arena', description: '24/7 Premium Gym with Certified Trainers & Steam Bath.', address: 'Trunk Road, Nellore' },
  ],
  'home-services': [
    { name: 'FastFix Plumbing & Electrical', description: '24/7 Emergency Electrician & Plumbing Repairs.', address: 'Siripuram, Visakhapatnam' },
    { name: 'Sparkle Clean Home Deep Cleaning', description: 'Full Home Cleaning, Sofa Shampooing & Bathroom Sanitization.', address: 'Benz Circle, Vijayawada' },
    { name: 'Cool Air HVAC & AC Service', description: 'Split & Window AC Installation, Gas Refilling & Servicing.', address: 'MVP Colony, Visakhapatnam' },
    { name: 'Safe Guard Pest Control Services', description: 'Termite Proofing, Cockroach & Rodent Extermination.', address: 'Brodipet, Guntur' },
    { name: 'Green Thumb Landscape & Gardening', description: 'Terrace Garden Setup, Balcony Plants & Lawn Maintenance.', address: 'Dwaraka Nagar, Visakhapatnam' },
    { name: 'Wood Craft Carpentry & Repairs', description: 'Custom Wooden Cabinets, Door Locks & Furniture Repairs.', address: 'Governorpet, Vijayawada' },
    { name: 'Fresh Wash Laundry & Dry Cleaning', description: 'Steam Press, Premium Suits & Blanket Dry Cleaning.', address: 'KT Road, Tirupati' },
    { name: 'Master Painter & Waterproofing', description: 'Asian Paints Interior Painting & Roof Leak Proofing.', address: 'Main Road, Kakinada' },
    { name: 'Solar Tech Roof Installation', description: 'On-Grid & Off-Grid Solar Power Systems for Homes.', address: 'Trunk Road, Nellore' },
    { name: 'Smart Home Automation & Security', description: 'CCTV Camera Setup, Smart Video Doorphones & Locks.', address: 'Auto Nagar, Visakhapatnam' },
  ],
  'professional-services': [
    { name: 'Apex Legal Associates & Advocates', description: 'High Court Legal Counsel, Corporate Contracts & Property Deeds.', address: 'Maharani Peta, Visakhapatnam' },
    { name: 'Precision Tax & Accounting Advisors', description: 'Chartered Accountants, Income Tax Filing & GST Audits.', address: 'M.G. Road, Vijayawada' },
    { name: 'Visionary Business Consultants', description: 'Company Registration, FSSAI License & Startup Funding Advisory.', address: 'Siripuram, Visakhapatnam' },
    { name: 'Capital Finance & Loan Advisors', description: 'Home Loans, Business Loans & MSME Subsidy Processing.', address: 'Brodipet, Guntur' },
    { name: 'Brand Catalyst Digital Marketing', description: 'SEO, Google Ads, Meta Marketing & Content Creation.', address: 'Benz Circle, Vijayawada' },
    { name: 'Horizon HR Solutions & Staffing', description: 'Corporate Talent Acquisition, Payroll & IT Staffing.', address: 'Dwaraka Nagar, Visakhapatnam' },
    { name: 'Intellectual Property & Patent Hub', description: 'Trademark Filing, Patent Registration & Copyright Law.', address: 'Governorpet, Vijayawada' },
    { name: 'Trust ISO Certification Services', description: 'ISO 9001, ISO 27001 Compliance & Quality Management.', address: 'KT Road, Tirupati' },
    { name: 'Elite Detective & Background Check', description: 'Corporate Due Diligence, Verification & Asset Search.', address: 'Main Road, Kakinada' },
    { name: 'Financial Freedom Wealth Management', description: 'Mutual Fund SIPs, Wealth Portfolios & Retirement Planning.', address: 'Trunk Road, Nellore' },
  ],
  'travel-and-tourism': [
    { name: 'Royal Heritage Tours & Travels', description: 'Araku Valley Sightseeing, Borra Caves & Lambasingi Packages.', address: 'Dwaraka Nagar, Visakhapatnam' },
    { name: 'Sky High Flight & Visa Services', description: 'International Flight Tickets, Passport & Tourist Visa Assistance.', address: 'Benz Circle, Vijayawada' },
    { name: 'Ocean Cruiser Yacht & Boat Rentals', description: 'Private Yacht Charters, Sunset Cruises & Speedboat Rides.', address: 'Fishing Harbour, Visakhapatnam' },
    { name: 'Wayfarer Car Rental & Self Drive', description: 'Innova, Swift & SUV Self Drive Car Rentals.', address: 'Beach Road, Visakhapatnam' },
    { name: 'Temple Yatra Pilgrimage Services', description: 'VIP Darshan Packages for Tirupati Balaji & Srisailam.', address: 'Main Bazaar, Tirupati' },
    { name: 'Island Hopper Beach Camping', description: 'Coastal Tent Camping, Bonfire, BBQ & Kayaking.', address: 'Bheemili Beach, Visakhapatnam' },
    { name: 'Global Safari Expeditions', description: 'Wildlife Safaris, Jungle Treks & Eco Camping Tours.', address: 'Governorpet, Vijayawada' },
    { name: 'Luxury Coach & Bus Charters', description: 'AC Volvo Bus Bookings for Weddings & Corporate Outings.', address: 'GNT Road, Guntur' },
    { name: 'Wanderlust Eco Travels', description: 'Offbeat Eco-Tourism, Tribal Village Stays & Hiking.', address: 'KT Road, Tirupati' },
    { name: 'Dream Vacation Honeymoon Planners', description: 'Customized Honeymoon Packages for Kerala, Goa & Himachal.', address: 'Main Road, Kakinada' },
  ],
  'entertainment': [
    { name: 'CineMax 4K Dolby Atmos Multiplex', description: 'Premium 4K Laser Projection, Recliner Seats & Gourmet Snacks.', address: 'Siripuram, Visakhapatnam' },
    { name: 'Apex Game Zone & VR Arena', description: 'Virtual Reality Motion Simulators, Arcade Games & Racing.', address: 'M.G. Road, Vijayawada' },
    { name: 'Bowling Alley & Strike Lounge', description: '8-Lane Cosmic Bowling, Snooker & Sports Bar.', address: 'Beach Road, Visakhapatnam' },
    { name: 'Mystery Escape Rooms & Quest', description: 'Live Puzzle Games, Horror Rooms & Mystery Challenges.', address: 'MVP Colony, Visakhapatnam' },
    { name: 'Aqua Splash Water World', description: 'High Speed Water Slides, Wave Pool & Rain Dance.', address: 'Anakapalle Highway, Visakhapatnam' },
    { name: 'Laugh Out Loud Comedy Club', description: 'Live Standup Comedy Shows, Open Mics & Acoustic Music.', address: 'Benz Circle, Vijayawada' },
    { name: 'Fun World Trampoline Arena', description: 'Wall-to-Wall Trampolines, Foam Pit & Ninja Warrior Course.', address: 'Brodipet, Guntur' },
    { name: 'Laser Tag Battle Arena', description: 'Fog & LED Tactical Laser Tag Arena for Teams.', address: 'Dwaraka Nagar, Visakhapatnam' },
    { name: 'Play Land Soft Play Area for Kids', description: 'Safe Soft Play Area, Ball Pit & Birthday Party Venue.', address: 'KT Road, Tirupati' },
    { name: 'Star Karaoke & Gaming Lounge', description: 'Private Soundproof Karaoke Rooms & PS5 Gaming Pods.', address: 'Main Road, Kakinada' },
  ],
};

export async function seedDummyBusinesses(
  dataSource: DataSource,
  users: SeededUsersResult,
): Promise<SeededBusinessesResult> {
  const logger = new Logger('SeedDummyBusinesses');
  logger.log('Seeding 10 dummy businesses per category across all 14 categories (140 businesses total)...');

  const bizRepo = dataSource.getRepository(BusinessProfile);
  const catRepo = dataSource.getRepository(BusinessCategory);
  const stateRepo = dataSource.getRepository(State);
  const districtRepo = dataSource.getRepository(District);

  // Fetch or create categories
  const categoryMap = new Map<string, BusinessCategory>();
  for (const cDef of CATEGORY_DEFINITIONS) {
    let cat = await catRepo.findOne({ where: [{ slug: cDef.slug }, { name: cDef.name }] });
    if (!cat) {
      cat = await catRepo.save(
        catRepo.create({
          name: cDef.name,
          slug: cDef.slug,
          description: cDef.description,
          is_active: true,
        }),
      );
    }
    categoryMap.set(cDef.slug, cat);
  }

  const apState = await stateRepo.findOne({ where: { name: 'Andhra Pradesh' } });
  const visakhaDistrict =
    (await districtRepo.findOne({ where: { name: 'Visakhapatnam' } })) ||
    (await districtRepo.findOne({ where: {} }));

  const allOwners = users.allOwners || [];
  let ownerIndex = 0;

  const allSeededBusinesses: BusinessProfile[] = [];
  const resultMap: Record<string, BusinessProfile> = {};

  for (const cDef of CATEGORY_DEFINITIONS) {
    const cat = categoryMap.get(cDef.slug);
    if (!cat) continue;

    const bizList = CATEGORY_BUSINESSES[cDef.slug] || [];
    let catBizIdx = 0;

    for (const bData of bizList) {
      const owner = allOwners[ownerIndex % allOwners.length];
      ownerIndex++;

      let status = BusinessStatus.ACTIVE;
      if (catBizIdx === 7) status = BusinessStatus.SUSPENDED;
      if (catBizIdx === 8) status = BusinessStatus.PENDING;
      if (catBizIdx === 9) status = BusinessStatus.REJECTED;

      const isFeatured = catBizIdx < 3; // First 3 in each category featured

      let biz = await bizRepo.findOne({ where: { owner_id: owner.id } });
      if (!biz) {
        biz = bizRepo.create({
          owner_id: owner.id,
          category_id: cat.id,
          name: bData.name,
          description: bData.description,
          website: `https://${bData.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
          gst_number: `37AAAAA${(1000 + ownerIndex).toString()}1Z5`,
          address: bData.address,
          state_id: apState ? apState.id : null,
          district_id: visakhaDistrict ? visakhaDistrict.id : null,
          status,
          is_featured: isFeatured,
        });
        biz = await bizRepo.save(biz);
      } else {
        biz.category_id = cat.id;
        biz.name = bData.name;
        biz.description = bData.description;
        biz.address = bData.address;
        biz.status = status;
        biz.is_featured = isFeatured;
        if (apState) biz.state_id = apState.id;
        if (visakhaDistrict) biz.district_id = visakhaDistrict.id;
        biz = await bizRepo.save(biz);
      }

      allSeededBusinesses.push(biz);

      // Key legacy references
      if (allSeededBusinesses.length === 1) resultMap['business1'] = biz;
      if (allSeededBusinesses.length === 2) resultMap['business2'] = biz;
      if (allSeededBusinesses.length === 3) resultMap['business3'] = biz;
      if (allSeededBusinesses.length === 4) resultMap['business4'] = biz;

      catBizIdx++;
    }
  }

  logger.log(`Successfully seeded ${allSeededBusinesses.length} businesses across ${CATEGORY_DEFINITIONS.length} categories.`);

  resultMap['allBusinesses'] = allSeededBusinesses as unknown as BusinessProfile;

  return resultMap as unknown as SeededBusinessesResult;
}
