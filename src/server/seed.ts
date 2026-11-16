import { adminDb } from '../lib/firebase-admin.ts';
import { DEFAULT_BENGALI_BOOKING_CATEGORIES } from '../data/bookingCategories.ts';
import { ALL_PERMISSIONS, DEFAULT_ROLE_DEFINITIONS } from './rbac.ts';
import { generateStrongRandomPassword, hashPassword, verifyPassword } from './security.ts';

let seedPromise: Promise<void> | null = null;

export async function ensurePlatformSeeded(): Promise<void> {
  if (seedPromise) return seedPromise;
  seedPromise = runSeed().catch((err) => {
    seedPromise = null;
    console.error('Seed failed:', err);
  });
  return seedPromise;
}

const DHAKA_DIRECTORY_ADDITIONS = [
  {
    uid: 'cmp_bhai_tanvir',
    displayName: 'Tanvir Ahmed (Bhai)',
    headline: 'Trusted Bhai Companion · Bank, Embassy & Hospital Escort in Dhaka',
    bio: 'Reliable elder-brother style companion based in Mirpur & Dhanmondi for daytime errands, medical appointments, corporate document pickups, and city navigation across Dhaka Division.',
    city: 'Dhaka',
    division: 'Dhaka',
    areas: ['Mirpur', 'Dhanmondi', 'Savar'],
    languages: ['Bengali', 'English'],
    categories: ['Bhai / Brother Companion', 'Everyday Assistance', 'City Guide & Errands'],
    hourlyRateBdt: 1200,
    sessionRateBdt: 3600,
    availabilityDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Sat'],
    availabilityHours: '8:30 AM – 8:30 PM',
    isAvailableNow: true,
    verificationStatus: 'approved',
    ratingAvg: 4.92,
    reviewCount: 54,
    completedBookings: 68,
    gender: 'male',
    photoUrl: '',
  },
  {
    uid: 'cmp_bhai_sabbir',
    displayName: 'Sabbir Hossain (Bhai)',
    headline: 'Business & Travel Companion · Gazipur, Tongi & Uttara Sector Host',
    bio: 'Industrial coordinator offering punctual accompaniment for factory visits in Gazipur, business meetings in Uttara, and safe family travel coordination within Dhaka Bibhag.',
    city: 'Gazipur',
    division: 'Dhaka',
    areas: ['Tongi', 'Uttara', 'Gazipur'],
    languages: ['Bengali', 'English'],
    categories: ['Bhai / Brother Companion', 'Corporate Events', 'City Guide & Errands'],
    hourlyRateBdt: 1400,
    sessionRateBdt: 4000,
    availabilityDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    availabilityHours: '9:00 AM – 9:00 PM',
    isAvailableNow: true,
    verificationStatus: 'approved',
    ratingAvg: 4.88,
    reviewCount: 39,
    completedBookings: 51,
    gender: 'male',
    photoUrl: '',
  },
  {
    uid: 'cmp_bhai_mehedi',
    displayName: 'Mehedi Hasan (Bhai)',
    headline: 'Shopping, Wedding Logistics & Event Plus-One · Narayanganj & Motijheel',
    bio: 'Friendly, organized Dhaka Division companion assisting families with Eid/wedding shopping in Bashundhara City & Jamuna Future Park, plus corporate event hosting.',
    city: 'Narayanganj',
    division: 'Dhaka',
    areas: ['Narayanganj Sadar', 'Motijheel', 'Bashundhara R/A'],
    languages: ['Bengali', 'English'],
    categories: ['Bhai / Brother Companion', 'Shopping & Errands', 'Family Functions'],
    hourlyRateBdt: 1100,
    sessionRateBdt: 3200,
    availabilityDays: ['Sun', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    availabilityHours: '10:00 AM – 10:00 PM',
    isAvailableNow: true,
    verificationStatus: 'approved',
    ratingAvg: 4.86,
    reviewCount: 33,
    completedBookings: 44,
    gender: 'male',
    photoUrl: '',
  },
  {
    uid: 'cmp_bhai_imran',
    displayName: 'Imran Chowdhury (Bhai)',
    headline: 'Dhaka Airport Arrival, Hotel Check-In & Gulshan Networking Escort',
    bio: 'Bilingual hospitality specialist assisting returning NRBs and corporate guests with Hazrat Shahjalal Airport welcomes, local SIM/banking errands, and Gulshan dining.',
    city: 'Dhaka',
    division: 'Dhaka',
    areas: ['Uttara', 'Gulshan', 'Banani'],
    languages: ['Bengali', 'English', 'Hindi'],
    categories: ['Bhai / Brother Companion', 'Corporate Events', 'Dining & Coffee'],
    hourlyRateBdt: 1900,
    sessionRateBdt: 5200,
    availabilityDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    availabilityHours: '7:00 AM – 11:00 PM',
    isAvailableNow: true,
    verificationStatus: 'approved',
    ratingAvg: 4.94,
    reviewCount: 47,
    completedBookings: 59,
    gender: 'male',
    photoUrl: '',
  },
  {
    uid: 'cmp_sumaiya_rahman',
    displayName: 'Sumaiya Rahman',
    headline: 'University Campus Tour, Book Fair & Cultural Event Companion · Dhanmondi',
    bio: 'Literature graduate available for Ekushey Boi Mela walks, museum afternoons, café study chats, and family events across Dhaka and Tangail.',
    city: 'Tangail',
    division: 'Dhaka',
    areas: ['Dhanmondi', 'Mohammadpur', 'Tangail'],
    languages: ['Bengali', 'English'],
    categories: ['Cultural & Galleries', 'Dining & Coffee', 'Public Events'],
    hourlyRateBdt: 1350,
    sessionRateBdt: 3800,
    availabilityDays: ['Fri', 'Sat', 'Sun', 'Tue'],
    availabilityHours: '11:00 AM – 8:00 PM',
    isAvailableNow: false,
    verificationStatus: 'approved',
    ratingAvg: 4.89,
    reviewCount: 25,
    completedBookings: 31,
    gender: 'female',
    photoUrl: '',
  },
  {
    uid: 'cmp_bhai_ashik',
    displayName: 'Ashikur Rahman (Bhai)',
    headline: 'Senior Care, Pharmacy & Diagnostic Center Companion · Narsingdi & Dhaka',
    bio: 'Patient, respectful companion supporting elderly parents during hospital visits in Dhaka Medical, Evercare, Square, or Narsingdi clinics.',
    city: 'Narsingdi',
    division: 'Dhaka',
    areas: ['Narsingdi', 'Bashundhara R/A', 'Badda'],
    languages: ['Bengali', 'English'],
    categories: ['Bhai / Brother Companion', 'Senior Support', 'Everyday Assistance'],
    hourlyRateBdt: 1000,
    sessionRateBdt: 2800,
    availabilityDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Sat'],
    availabilityHours: '8:00 AM – 7:00 PM',
    isAvailableNow: true,
    verificationStatus: 'approved',
    ratingAvg: 4.91,
    reviewCount: 31,
    completedBookings: 42,
    gender: 'male',
    photoUrl: '',
  },
  {
    uid: 'cmp_bhai_shakil',
    displayName: 'Shakil Mahmud (Bhai)',
    headline: 'Tech Event, Startup Demo Day & Mohakhali Co-Working Buddy',
    bio: 'Software product mentor available for startup meetups, tech conferences, coffee brainstorming, and public networking evenings in Mohakhali and Banani.',
    city: 'Dhaka',
    division: 'Dhaka',
    areas: ['Mohakhali', 'Banani', 'Gulshan'],
    languages: ['Bengali', 'English'],
    categories: ['Bhai / Brother Companion', 'Corporate Events', 'Social Outings'],
    hourlyRateBdt: 1650,
    sessionRateBdt: 4600,
    availabilityDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    availabilityHours: '10:00 AM – 10:00 PM',
    isAvailableNow: true,
    verificationStatus: 'approved',
    ratingAvg: 4.87,
    reviewCount: 22,
    completedBookings: 29,
    gender: 'male',
    photoUrl: '',
  },
  {
    uid: 'cmp_bhai_faisal',
    displayName: 'Faisal Karim (Bhai)',
    headline: 'Padma Bridge Weekend Excursion & Munshiganj / Faridpur Travel Host',
    bio: 'Experienced Dhaka Bibhag road-trip & heritage companion for group day outings to Munshiganj, Mawa, Rajbari, and Faridpur riverfront spots.',
    city: 'Munshiganj',
    division: 'Dhaka',
    areas: ['Munshiganj', 'Faridpur', 'Keraniganj'],
    languages: ['Bengali', 'English'],
    categories: ['Bhai / Brother Companion', 'City Guide & Errands', 'Social Outings'],
    hourlyRateBdt: 1250,
    sessionRateBdt: 3500,
    availabilityDays: ['Thu', 'Fri', 'Sat', 'Sun'],
    availabilityHours: '7:00 AM – 9:00 PM',
    isAvailableNow: true,
    verificationStatus: 'approved',
    ratingAvg: 4.84,
    reviewCount: 18,
    completedBookings: 26,
    gender: 'male',
    photoUrl: '',
  },
];

const REGIONAL_BANGLADESH_COMPANIONS = [
  {
    uid: 'cmp_ctg_mahbub',
    displayName: 'Mahbubul Alam (Bhai)',
    headline: 'Port City Business, Agrabad Banking & GEC Circle Social Companion',
    bio: 'Trusted Chattogram (Chittagong) local coordinator helping visiting executives and families with Agrabad commercial errands, GEC Circle meetings, and evening dining.',
    city: 'Chattogram',
    division: 'Chattogram',
    areas: ['GEC Circle', 'Nasirabad', 'Agrabad'],
    languages: ['Bengali', 'English'],
    categories: ['Bhai / Brother Companion', 'Corporate Events', 'City Guide & Errands'],
    hourlyRateBdt: 1450,
    sessionRateBdt: 4100,
    availabilityDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Sat'],
    availabilityHours: '9:00 AM – 9:30 PM',
    isAvailableNow: true,
    verificationStatus: 'approved',
    ratingAvg: 4.91,
    reviewCount: 41,
    completedBookings: 56,
    gender: 'male',
    photoUrl: '',
  },
  {
    uid: 'cmp_ctg_tanjina',
    displayName: 'Tanjina Akter',
    headline: "Cox's Bazar Sea-View Tour, Family Event & Patenga Outing Host",
    bio: "Certified hospitality graduate serving Chittagong Division guests across Cox's Bazar Kolatoli, Panchlaish cafés, and weekend family coastal excursions.",
    city: "Cox's Bazar",
    division: 'Chattogram',
    areas: ['Kolatoli', 'Panchlaish', 'Patenga'],
    languages: ['Bengali', 'English'],
    categories: ['Social Outings', 'Dining & Coffee', 'Public Events'],
    hourlyRateBdt: 1600,
    sessionRateBdt: 4500,
    availabilityDays: ['Thu', 'Fri', 'Sat', 'Sun', 'Mon'],
    availabilityHours: '9:30 AM – 8:30 PM',
    isAvailableNow: true,
    verificationStatus: 'approved',
    ratingAvg: 4.89,
    reviewCount: 29,
    completedBookings: 37,
    gender: 'female',
    photoUrl: '',
  },
  {
    uid: 'cmp_syl_kamrul',
    displayName: 'Kamrul Islam (Bhai)',
    headline: 'Sylhet Zindabazar City Host, Shrine & Tea-Estate Escort Companion',
    bio: 'Warm Sylheti and bilingual companion guiding UK/NRB visitors and families through Zindabazar errands, Amberkhana hospitality, and day trips across Sylhet Division.',
    city: 'Sylhet',
    division: 'Sylhet',
    areas: ['Zindabazar', 'Amberkhana', 'Shahjalal Upashahar'],
    languages: ['Bengali', 'English'],
    categories: ['Bhai / Brother Companion', 'City Guide & Errands', 'Family Functions'],
    hourlyRateBdt: 1350,
    sessionRateBdt: 3800,
    availabilityDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    availabilityHours: '8:30 AM – 9:00 PM',
    isAvailableNow: true,
    verificationStatus: 'approved',
    ratingAvg: 4.93,
    reviewCount: 38,
    completedBookings: 49,
    gender: 'male',
    photoUrl: '',
  },
  {
    uid: 'cmp_syl_tasnim',
    displayName: 'Tasnim Chowdhury',
    headline: 'Sreemangal Tea Garden Walk, Cultural Salon & Café Companion · Sylhet',
    bio: 'Moulvibazar & Sylhet based host available for scenic Sreemangal outings, literary events, and calm public dining meetups.',
    city: 'Moulvibazar',
    division: 'Sylhet',
    areas: ['Sreemangal', 'Zindabazar', 'Tilagor'],
    languages: ['Bengali', 'English'],
    categories: ['Cultural & Galleries', 'Dining & Coffee', 'Social Outings'],
    hourlyRateBdt: 1400,
    sessionRateBdt: 3900,
    availabilityDays: ['Thu', 'Fri', 'Sat', 'Sun'],
    availabilityHours: '10:00 AM – 8:00 PM',
    isAvailableNow: true,
    verificationStatus: 'approved',
    ratingAvg: 4.88,
    reviewCount: 21,
    completedBookings: 28,
    gender: 'female',
    photoUrl: '',
  },
  {
    uid: 'cmp_raj_shafiq',
    displayName: 'Shafiqul Islam (Bhai)',
    headline: 'Rajshahi Padma Riverfront, University & Bogura Business Companion',
    bio: 'Courteous northern-region companion assisting visitors with Rajshahi Shaheb Bazar errands, campus tours, Varendra museum visits, and Bogura commercial stops.',
    city: 'Rajshahi',
    division: 'Rajshahi',
    areas: ['Shaheb Bazar', 'Padma Residential', 'Bogura'],
    languages: ['Bengali', 'English'],
    categories: ['Bhai / Brother Companion', 'Cultural & Galleries', 'City Guide & Errands'],
    hourlyRateBdt: 1100,
    sessionRateBdt: 3100,
    availabilityDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Sat'],
    availabilityHours: '9:00 AM – 8:30 PM',
    isAvailableNow: true,
    verificationStatus: 'approved',
    ratingAvg: 4.86,
    reviewCount: 24,
    completedBookings: 33,
    gender: 'male',
    photoUrl: '',
  },
  {
    uid: 'cmp_khl_reza',
    displayName: 'Rezaul Karim (Bhai)',
    headline: 'Khulna Shibbari, Jashore Transit & Sundarbans Gateway Coordinator',
    bio: 'Dependable Khulna Division companion for local civic errands, hospital accompaniment in Sonadanga, and regional business travel logistics.',
    city: 'Khulna',
    division: 'Khulna',
    areas: ['Shibbari', 'Sonadanga', 'Jashore'],
    languages: ['Bengali', 'English'],
    categories: ['Bhai / Brother Companion', 'Everyday Assistance', 'Corporate Events'],
    hourlyRateBdt: 1150,
    sessionRateBdt: 3200,
    availabilityDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
    availabilityHours: '8:30 AM – 8:30 PM',
    isAvailableNow: true,
    verificationStatus: 'approved',
    ratingAvg: 4.87,
    reviewCount: 27,
    completedBookings: 35,
    gender: 'male',
    photoUrl: '',
  },
  {
    uid: 'cmp_bar_jahid',
    displayName: 'Jahidul Hasan (Bhai)',
    headline: 'Barishal River Port, Sadar Road & Kuakata Family Travel Escort',
    bio: 'Reliable Barishal Division host helping families and senior citizens with launch-terminal arrivals, Sadar Road appointments, and coastal Kuakata day trips.',
    city: 'Barishal',
    division: 'Barishal',
    areas: ['Sadar Road', 'Band Road', 'Kuakata'],
    languages: ['Bengali', 'English'],
    categories: ['Bhai / Brother Companion', 'Senior Support', 'City Guide & Errands'],
    hourlyRateBdt: 1050,
    sessionRateBdt: 2950,
    availabilityDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Sat'],
    availabilityHours: '8:00 AM – 8:00 PM',
    isAvailableNow: true,
    verificationStatus: 'approved',
    ratingAvg: 4.85,
    reviewCount: 19,
    completedBookings: 25,
    gender: 'male',
    photoUrl: '',
  },
  {
    uid: 'cmp_rng_rubel',
    displayName: 'Rubel Mia (Bhai)',
    headline: 'Rangpur City, Dinajpur Heritage & Northern Medical Errand Buddy',
    bio: 'Patient, well-connected companion in Rangpur Division assisting with medical consultations, college admissions visits, and Tajhat Palace outings.',
    city: 'Rangpur',
    division: 'Rangpur',
    areas: ['Jahaj Company More', 'Dhap', 'Dinajpur'],
    languages: ['Bengali', 'English'],
    categories: ['Bhai / Brother Companion', 'Everyday Assistance', 'Cultural & Galleries'],
    hourlyRateBdt: 1000,
    sessionRateBdt: 2800,
    availabilityDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Sat'],
    availabilityHours: '8:30 AM – 8:00 PM',
    isAvailableNow: true,
    verificationStatus: 'approved',
    ratingAvg: 4.84,
    reviewCount: 17,
    completedBookings: 22,
    gender: 'male',
    photoUrl: '',
  },
  {
    uid: 'cmp_mym_nazmul',
    displayName: 'Nazmul Huda (Bhai)',
    headline: 'Mymensingh Town Hall, BAU Campus & Netrokona Outing Companion',
    bio: 'Educated local companion supporting students, visiting families, and seniors across Mymensingh Division for official errands and Brahmaputra riverfront walks.',
    city: 'Mymensingh',
    division: 'Mymensingh',
    areas: ['Town Hall', 'Charpara', 'Netrokona'],
    languages: ['Bengali', 'English'],
    categories: ['Bhai / Brother Companion', 'Everyday Assistance', 'Social Outings'],
    hourlyRateBdt: 1050,
    sessionRateBdt: 2900,
    availabilityDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    availabilityHours: '8:30 AM – 8:30 PM',
    isAvailableNow: true,
    verificationStatus: 'approved',
    ratingAvg: 4.88,
    reviewCount: 23,
    completedBookings: 30,
    gender: 'male',
    photoUrl: '',
  },
];

async function runSeed(): Promise<void> {
  const settingsRef = adminDb.collection('platform_settings').doc('main');
  const settingsSnap = await settingsRef.get();
  const now = new Date().toISOString();

  if (!settingsSnap.exists) {
    await settingsRef.set({
      key: 'main',
      serviceFeePercent: 12,
      paymentMode: process.env.PAYMENT_MODE === 'live' ? 'live' : 'sandbox',
      merchantApproved: false,
      cashPaymentEnabled: true,
      maxCashBookingBdt: 3000,
      bkashPersonalNumber: '01700-000000',
      nagadPersonalNumber: '01877pokpok',
      customPaymentLabel: '৩. অ্যাডমিন পার্সোনাল রকেট / কাস্টম সেন্ড মানি',
      customPaymentNumber: '01700-000000',
      customPaymentInstructions: 'বুকিং নিশ্চিত করতে মোট টাকার ৫০% অ্যাডমিন পার্সোনাল নম্বরে সেন্ড মানি করে TrxID জমা দিন।',
      bensonPaymentLabel: '৪. বেনসন সিগারেট পেমেন্ট (১,০০০৳ = ৩ প্যাকেট)',
      bensonBaseBdt: 1000,
      bensonPacketsPerBase: 3,
      bensonItemName: 'প্যাকেট বেনসন সিগারেট',
      bensonContactNumber: '01700-000000',
      bensonPaymentInstructions:
        'প্রতি ১,০০০ টাকা সমান ৩ প্যাকেট বেনসন সিগারেট। নির্ধারিত প্যাকেট হস্তান্তর করে ডেলিভারি রেফারেন্স/ফোন নম্বর লিখে জমা দিন।',
      noticeBoardTitle: 'জরুরি নোটিশ বোর্ড — LOGEASI.COM',
      noticeBoardMessage:
        'টপ ১০০ সামাজিক সঙ্গী ডিরেক্টরিতে স্বাগতম! যেকোনো সহায়তা, ভেরিফিকেশন বা পেমেন্ট সংক্রান্ত বিষয়ে নিচের অ্যাডমিন যোগাযোগ মাধ্যমে সরাসরি যোগাযোগ করুন। বুকিংয়ের পর প্রথমে ৫০% অ্যাডভান্স পেমেন্ট সম্পন্ন করুন।',
      adminContactUsername: 'sheik_siam0077',
      adminContactEmail: 'mdsiam0908i@gmail.com',
      adminContactInstagram: '@sheik_siam0077',
      allowedDivision: 'সকল বাংলাদেশ বিভাগ (All 8 Divisions)',
      rootAdminUid: '',
      announcementBanner:
        'বাংলাদেশের ৮টি বিভাগেই ১৮+ যাচাইকৃত নিরাপদ সামাজিক সঙ্গী ও টপ ১০০ ভাই/বন্ধু ডিরেক্টরি।',
      safetyNotice:
        'বাংলাদেশ জরুরি হেল্পলাইন: ৯৯৯ (জাতীয় জরুরি সেবা) · ১০৯ (নারী ও শিশু হেল্পলাইন)। সর্বদা পাবলিক স্থানে দেখা করুন।',
      featuredHeadline:
        'বাংলাদেশের যেকোনো প্রান্তে চা-কফি আড্ডা, ঘোরাফেরা, ইভেন্ট ও শান্তিপূর্ণ কাজের সহায়তার জন্য বিশ্বস্ত ১৮+ সঙ্গী বুক করুন।',
      bookingCategories: [...DEFAULT_BENGALI_BOOKING_CATEGORIES],
      updatedAt: now,
    });

    const batch = adminDb.batch();
    for (const perm of ALL_PERMISSIONS) {
      batch.set(adminDb.collection('admin_permissions').doc(perm.key), perm);
    }

    for (const [roleKey, roleDef] of Object.entries(DEFAULT_ROLE_DEFINITIONS)) {
      batch.set(adminDb.collection('admin_roles').doc(roleKey), {
        roleKey,
        label: roleDef.label,
        permissions: roleDef.permissions,
        isSystemProtected: roleDef.isSystemProtected,
      });
    }

    const coreCompanions = [
      {
        uid: 'cmp_tariq_mahmud',
        displayName: 'Tariq Mahmud (Bhai)',
        headline: 'Corporate Event & Diplomatic Gala Companion · Gulshan & Banani',
        bio: 'Management consultant based in Gulshan-2 with 6+ years hosting international visitors, attending corporate summits, chamber networking dinners, and formal cultural events across Dhaka Division.',
        city: 'Dhaka',
        division: 'Dhaka',
        areas: ['Gulshan', 'Banani', 'Baridhara'],
        languages: ['Bengali', 'English', 'Hindi'],
        categories: ['Bhai / Brother Companion', 'Corporate Events', 'Social Outings', 'Dining & Coffee'],
        hourlyRateBdt: 2200,
        sessionRateBdt: 6000,
        availabilityDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        availabilityHours: '10:00 AM – 10:00 PM',
        isAvailableNow: true,
        verificationStatus: 'approved',
        ratingAvg: 4.96,
        reviewCount: 64,
        completedBookings: 82,
        pendingBalanceBdt: 0,
        availableBalanceBdt: 14500,
        gender: 'male',
        photoUrl: '/src/assets/images/companion_tariq_portrait_1794647508607.jpg',
        updatedAt: now,
      },
      {
        uid: 'cmp_nusrat_jahan',
        displayName: 'Nusrat Jahan',
        headline: 'Art Exhibition, Literary Salon & Wedding Reception Plus-One · Banani',
        bio: 'Curator and bilingual presenter in Banani. Available for art gallery openings at Bengal Shilpalay, family reception attendance, museum tours, and thoughtful coffee conversations in public spaces.',
        city: 'Dhaka',
        division: 'Dhaka',
        areas: ['Banani', 'Dhanmondi', 'Gulshan'],
        languages: ['Bengali', 'English'],
        categories: ['Public Events', 'Cultural & Galleries', 'Family Functions', 'Dining & Coffee'],
        hourlyRateBdt: 2000,
        sessionRateBdt: 5500,
        availabilityDays: ['Sun', 'Tue', 'Wed', 'Fri', 'Sat'],
        availabilityHours: '11:00 AM – 9:00 PM',
        isAvailableNow: true,
        verificationStatus: 'approved',
        ratingAvg: 4.95,
        reviewCount: 58,
        completedBookings: 74,
        pendingBalanceBdt: 0,
        availableBalanceBdt: 19800,
        gender: 'female',
        photoUrl: '/src/assets/images/companion_nusrat_portrait_1794647509413.jpg',
        updatedAt: now,
      },
      {
        uid: 'cmp_farhana_kabir',
        displayName: 'Farhana Kabir',
        headline: 'Everyday Assistance, Hospital & Embassy Escort · Uttara & Gulshan',
        bio: 'Former hospitality coordinator offering calm, reliable daytime assistance for senior family members, medical appointment accompaniment, shopping errands, and airport hospitality greetings.',
        city: 'Dhaka',
        division: 'Dhaka',
        areas: ['Uttara', 'Gulshan', 'Bashundhara R/A'],
        languages: ['Bengali', 'English'],
        categories: ['Everyday Assistance', 'Shopping & Errands', 'Dining & Coffee', 'Senior Support'],
        hourlyRateBdt: 1600,
        sessionRateBdt: 4500,
        availabilityDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Sat'],
        availabilityHours: '9:00 AM – 8:00 PM',
        isAvailableNow: true,
        verificationStatus: 'approved',
        ratingAvg: 4.9,
        reviewCount: 44,
        completedBookings: 53,
        pendingBalanceBdt: 0,
        availableBalanceBdt: 8200,
        gender: 'female',
        photoUrl: '/src/assets/images/companion_farhana_portrait_1794647509204.jpg',
        updatedAt: now,
      },
      {
        uid: 'cmp_rafiq_hasan',
        displayName: 'Rafiq Hasan (Bhai)',
        headline: 'Conversational Companion & Old Dhaka Heritage Walk Host · Dhanmondi',
        bio: 'Architect and culinary enthusiast hosting curated café meetups, book club discussions, and weekend architectural walks across Dhanmondi, Old Dhaka, and Savar.',
        city: 'Dhaka',
        division: 'Dhaka',
        areas: ['Dhanmondi', 'Old Dhaka', 'Savar'],
        languages: ['Bengali', 'English'],
        categories: ['Bhai / Brother Companion', 'City Guide & Errands', 'Cultural & Galleries', 'Dining & Coffee'],
        hourlyRateBdt: 1500,
        sessionRateBdt: 4200,
        availabilityDays: ['Mon', 'Wed', 'Thu', 'Fri', 'Sat'],
        availabilityHours: '10:00 AM – 9:30 PM',
        isAvailableNow: true,
        verificationStatus: 'approved',
        ratingAvg: 4.89,
        reviewCount: 36,
        completedBookings: 45,
        pendingBalanceBdt: 0,
        availableBalanceBdt: 6400,
        gender: 'male',
        photoUrl: '/src/assets/images/companion_rafiq_portrait_1794647511362.jpg',
        updatedAt: now,
      },
    ];

    const allCompanions = [
      ...coreCompanions,
      ...DHAKA_DIRECTORY_ADDITIONS.map((c) => ({
        ...c,
        pendingBalanceBdt: 0,
        availableBalanceBdt: 4500,
        updatedAt: now,
      })),
      ...REGIONAL_BANGLADESH_COMPANIONS.map((c) => ({
        ...c,
        pendingBalanceBdt: 0,
        availableBalanceBdt: 4200,
        updatedAt: now,
      })),
    ];

    for (const cmp of allCompanions) {
      const handleSlug = cmp.uid.replace(/^cmp_/, '').replace(/_/g, '.');
      const enrichedCmp = {
        ...cmp,
        instagramHandle: (cmp as any).instagramHandle || `@${handleSlug}.logeasi`,
        whatsappNumber: (cmp as any).whatsappNumber || '+8801700000000',
        contactEmail: (cmp as any).contactEmail || `${handleSlug}@companions.logeasi.com`,
      };
      batch.set(adminDb.collection('companion_profiles').doc(cmp.uid), enrichedCmp);
      batch.set(adminDb.collection('users').doc(cmp.uid), {
        uid: cmp.uid,
        email: `${cmp.uid}@directory.logeasi.internal`,
        phone: '+8801700000000',
        fullName: cmp.displayName,
        role: 'companion',
        isAdultVerified18Plus: true,
        phoneVerified: true,
        emailVerified: true,
        twoFactorEnabled: false,
        status: 'active',
        photoUrl: cmp.photoUrl,
        city: cmp.city,
        createdAt: now,
      });
      batch.set(adminDb.collection('verification_requests').doc(`VER_${cmp.uid}`), {
        id: `VER_${cmp.uid}`,
        uid: cmp.uid,
        fullName: cmp.displayName,
        documentType: 'nid',
        documentNumberMasked: '******4821',
        dateOfBirth: '1995-05-14',
        calculatedAge: 31,
        city: cmp.city,
        status: 'approved',
        reviewerNote: `${cmp.division} Division marketplace NID & 18+ age verification completed.`,
        reviewedByUid: 'system_bootstrap',
        createdAt: now,
      });
    }

    const reviews = [
      {
        id: 'REV_SEED_1',
        bookingId: 'BKG_SEED_1',
        customerUid: 'cust_demo_01',
        companionUid: 'cmp_tariq_mahmud',
        customerName: 'Arif Chowdhury',
        rating: 5,
        comment: 'Punctual, articulate, and made our visiting Singapore partners feel completely at ease during the Gulshan chamber dinner.',
        createdAt: now,
      },
      {
        id: 'REV_SEED_2',
        bookingId: 'BKG_SEED_2',
        customerUid: 'cust_demo_02',
        companionUid: 'cmp_nusrat_jahan',
        customerName: 'Sadia Rahman',
        rating: 5,
        comment: 'Attended my cousin’s wedding reception in Banani with me. Graceful conversation and zero awkwardness.',
        createdAt: now,
      },
      {
        id: 'REV_SEED_3',
        bookingId: 'BKG_SEED_3',
        customerUid: 'cust_demo_03',
        companionUid: 'cmp_farhana_kabir',
        customerName: 'Mahmudul Islam',
        rating: 5,
        comment: 'Helped my mother navigate her United Hospital consultation and pharmacy pickup smoothly. Truly dependable.',
        createdAt: now,
      },
    ];

    for (const rev of reviews) {
      batch.set(adminDb.collection('reviews').doc(rev.id), rev);
    }

    await batch.commit();
  } else {
    // Ensure existing store receives personal bKash/Nagad, custom option, notice board, Bengali copy & 10 Bengali categories
    const cur = settingsSnap.data() || {};
    const hasOldCats = !Array.isArray(cur.bookingCategories) || cur.bookingCategories.length < 10 || cur.bookingCategories.some((c: string) => c.includes('(Tea & Smoke Break Hangout)'));
    const hasOldBanner = !cur.announcementBanner || String(cur.announcementBanner).startsWith('All 8 Bangladesh Divisions Supported');
    const missingNoticeOrCustom =
      !cur.noticeBoardTitle ||
      !cur.adminContactEmail ||
      !cur.adminContactInstagram ||
      !cur.adminContactUsername ||
      !cur.customPaymentLabel ||
      !cur.bensonPaymentLabel;
    if (!cur.nagadPersonalNumber || !cur.allowedDivision || hasOldCats || hasOldBanner || missingNoticeOrCustom) {
      await settingsRef.set(
        {
          bkashPersonalNumber: cur.bkashPersonalNumber || '01700-000000',
          nagadPersonalNumber: cur.nagadPersonalNumber || '01877pokpok',
          customPaymentLabel: cur.customPaymentLabel || '৩. অ্যাডমিন পার্সোনাল রকেট / কাস্টম সেন্ড মানি',
          customPaymentNumber: cur.customPaymentNumber || '01700-000000',
          customPaymentInstructions:
            cur.customPaymentInstructions ||
            'বুকিং নিশ্চিত করতে মোট টাকার ৫০% অ্যাডমিন পার্সোনাল নম্বরে সেন্ড মানি করে TrxID জমা দিন।',
          bensonPaymentLabel: cur.bensonPaymentLabel || '৪. বেনসন সিগারেট পেমেন্ট (১,০০০৳ = ৩ প্যাকেট)',
          bensonBaseBdt: Number(cur.bensonBaseBdt || 1000),
          bensonPacketsPerBase: Number(cur.bensonPacketsPerBase || 3),
          bensonItemName: cur.bensonItemName || 'প্যাকেট বেনসন সিগারেট',
          bensonContactNumber: cur.bensonContactNumber || cur.bkashPersonalNumber || '01700-000000',
          bensonPaymentInstructions:
            cur.bensonPaymentInstructions ||
            'প্রতি ১,০০০ টাকা সমান ৩ প্যাকেট বেনসন সিগারেট। নির্ধারিত প্যাকেট হস্তান্তর করে ডেলিভারি রেফারেন্স/ফোন নম্বর লিখে জমা দিন।',
          noticeBoardTitle: cur.noticeBoardTitle || 'জরুরি নোটিশ বোর্ড — LOGEASI.COM',
          noticeBoardMessage:
            cur.noticeBoardMessage ||
            'টপ ১০০ সামাজিক সঙ্গী ডিরেক্টরিতে স্বাগতম! যেকোনো সহায়তা, ভেরিফিকেশন বা পেমেন্ট সংক্রান্ত বিষয়ে নিচের অ্যাডমিন যোগাযোগ মাধ্যমে সরাসরি যোগাযোগ করুন। বুকিংয়ের পর প্রথমে ৫০% অ্যাডভান্স পেমেন্ট সম্পন্ন করুন।',
          adminContactUsername: cur.adminContactUsername || 'sheik_siam0077',
          adminContactEmail: cur.adminContactEmail || 'mdsiam0908i@gmail.com',
          adminContactInstagram: cur.adminContactInstagram || '@sheik_siam0077',
          allowedDivision: 'সকল বাংলাদেশ বিভাগ (All 8 Divisions)',
          announcementBanner: hasOldBanner
            ? 'বাংলাদেশের ৮টি বিভাগেই ১৮+ যাচাইকৃত নিরাপদ সামাজিক সঙ্গী ও টপ ১০০ ভাই/বন্ধু ডিরেক্টরি।'
            : cur.announcementBanner,
          safetyNotice:
            !cur.safetyNotice || String(cur.safetyNotice).startsWith('Emergency Helpline Bangladesh')
              ? 'বাংলাদেশ জরুরি হেল্পলাইন: ৯৯৯ (জাতীয় জরুরি সেবা) · ১০৯ (নারী ও শিশু হেল্পলাইন)। সর্বদা পাবলিক স্থানে দেখা করুন।'
              : cur.safetyNotice,
          featuredHeadline:
            !cur.featuredHeadline || String(cur.featuredHeadline).startsWith('Trusted Bangladesh social companionship')
              ? 'বাংলাদেশের যেকোনো প্রান্তে চা-কফি আড্ডা, ঘোরাফেরা, ইভেন্ট ও শান্তিপূর্ণ কাজের সহায়তার জন্য বিশ্বস্ত ১৮+ সঙ্গী বুক করুন।'
              : cur.featuredHeadline,
          bookingCategories: hasOldCats ? [...DEFAULT_BENGALI_BOOKING_CATEGORIES] : cur.bookingCategories,
          updatedAt: now,
        },
        { merge: true }
      );
    }

    // Backfill division & social handles on existing seeded companions if missing
    const existingCmpSnap = await adminDb.collection('companion_profiles').get();
    for (const doc of existingCmpSnap.docs) {
      const data = doc.data();
      const patch: Record<string, any> = {};
      if (!data.division) patch.division = 'Dhaka';
      if (!data.gender) {
        const isFemaleSeed = ['cmp_nusrat_jahan', 'cmp_farhana_kabir', 'cmp_sumaiya_rahman', 'cmp_ctg_tanjina', 'cmp_syl_tasnim'].includes(String(data.uid));
        const isBhaiName = /\(bhai\)|\bbhai\b|\bbrother\b/i.test(String(data.displayName || ''));
        if (isFemaleSeed) patch.gender = 'female';
        else if (isBhaiName) patch.gender = 'male';
      }
      if (data.uid?.startsWith('cmp_') && !data.instagramHandle) {
        const handleSlug = String(data.uid).replace(/^cmp_/, '').replace(/_/g, '.');
        patch.instagramHandle = `@${handleSlug}.logeasi`;
        patch.whatsappNumber = '+8801700000000';
        patch.contactEmail = `${handleSlug}@companions.logeasi.com`;
      }
      if (Object.keys(patch).length > 0) {
        patch.updatedAt = now;
        await doc.ref.update(patch);
      }
    }

    // Seed any missing Dhaka or Regional Bangladesh companions
    const combinedSeeds = [...DHAKA_DIRECTORY_ADDITIONS, ...REGIONAL_BANGLADESH_COMPANIONS];
    for (const cmp of combinedSeeds) {
      const snap = await adminDb.collection('companion_profiles').doc(cmp.uid).get();
      if (!snap.exists) {
        const handleSlug = cmp.uid.replace(/^cmp_/, '').replace(/_/g, '.');
        await adminDb.collection('companion_profiles').doc(cmp.uid).set({
          ...cmp,
          instagramHandle: `@${handleSlug}.logeasi`,
          whatsappNumber: '+8801700000000',
          contactEmail: `${handleSlug}@companions.logeasi.com`,
          pendingBalanceBdt: 0,
          availableBalanceBdt: 4200,
          updatedAt: now,
        });
      }
    }
  }

  await ensurePrimaryRootAdminAndRbac(now);
}

async function ensurePrimaryRootAdminAndRbac(now: string): Promise<void> {
  // Guarantee RBAC role & permission catalogs exist even on existing databases
  for (const perm of ALL_PERMISSIONS) {
    const pRef = adminDb.collection('admin_permissions').doc(perm.key);
    const pSnap = await pRef.get();
    if (!pSnap.exists) {
      await pRef.set(perm);
    }
  }

  for (const [roleKey, roleDef] of Object.entries(DEFAULT_ROLE_DEFINITIONS)) {
    const rRef = adminDb.collection('admin_roles').doc(roleKey);
    const rSnap = await rRef.get();
    if (!rSnap.exists) {
      await rRef.set({
        roleKey,
        label: roleDef.label,
        permissions: roleDef.permissions,
        isSystemProtected: roleDef.isSystemProtected,
      });
    }
  }

  const rootUid = 'adm_46c6f85e';
  const rootUsername = (process.env.PRIMARY_ADMIN_USERNAME || 'adm_46c6f85e').trim().toLowerCase();
  const envRootPassword = (process.env.PRIMARY_ADMIN_PASSWORD || '').trim();
  const rootEmail = 'admin@logeasi.com';

  const userRef = adminDb.collection('users').doc(rootUid);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    await userRef.set({
      uid: rootUid,
      username: rootUsername,
      email: rootEmail,
      phone: '',
      fullName: 'LOGEASI Root Super Admin',
      role: 'root_super_admin',
      isAdultVerified18Plus: true,
      phoneVerified: true,
      emailVerified: true,
      twoFactorEnabled: false,
      status: 'active',
      photoUrl: '',
      city: 'Dhaka',
      profileCompleted: true,
      profileDeadlineAt: '',
      referralCreditsBdt: 0,
      referralCount: 0,
      createdAt: now,
    });
  } else {
    const u = userSnap.data() || {};
    await userRef.set(
      {
        username: rootUsername,
        role: 'root_super_admin',
        status: 'active',
        profileCompleted: true,
        email: u.email || rootEmail,
      },
      { merge: true }
    );
  }

  const adminRef = adminDb.collection('admin_accounts').doc(rootUid);
  const adminSnap = await adminRef.get();
  if (!adminSnap.exists) {
    await adminRef.set({
      uid: rootUid,
      adminId: 'ADM-ROOT-0001',
      username: rootUsername,
      email: rootEmail,
      phone: '',
      fullName: 'LOGEASI Root Super Admin',
      role: 'root_super_admin',
      isRootOwner: true,
      status: 'active',
      createdByUid: 'system_bootstrap',
      createdAt: now,
    });
  } else {
    await adminRef.set(
      {
        username: rootUsername,
        role: 'root_super_admin',
        isRootOwner: true,
        status: 'active',
      },
      { merge: true }
    );
  }

  const privRef = userRef.collection('private').doc('security');
  const privSnap = await privRef.get();
  const privData = privSnap.data() || {};
  const existingHash = typeof privData.passwordHash === 'string' ? privData.passwordHash : '';

  if (envRootPassword) {
    const matchesEnv = existingHash ? await verifyPassword(envRootPassword, existingHash) : false;
    if (!matchesEnv) {
      const passwordHash = await hashPassword(envRootPassword);
      await privRef.set(
        {
          uid: rootUid,
          passwordHash,
          failedLoginAttempts: 0,
          lockedUntil: '',
          lastLoginAt: privData.lastLoginAt || '',
        },
        { merge: true }
      );
    } else if (privData.lockedUntil || Number(privData.failedLoginAttempts || 0) > 0) {
      await privRef.set({ failedLoginAttempts: 0, lockedUntil: '' }, { merge: true });
    }
  } else if (!existingHash) {
    const generatedInitialPassword = generateStrongRandomPassword(16);
    const passwordHash = await hashPassword(generatedInitialPassword);
    await privRef.set(
      {
        uid: rootUid,
        passwordHash,
        failedLoginAttempts: 0,
        lockedUntil: '',
        lastLoginAt: privData.lastLoginAt || '',
      },
      { merge: true }
    );
    console.info(
      `[LOGEASI SECURITY] Generated initial bootstrap password for ${rootUsername}: ${generatedInitialPassword}`
    );
  }

  const rootLockRef = adminDb.collection('platform_settings').doc('root_lock');
  const rootLockSnap = await rootLockRef.get();
  if (!rootLockSnap.exists || !rootLockSnap.data()?.rootAdminUid) {
    await rootLockRef.set({
      key: 'root_lock',
      rootAdminUid: rootUid,
      createdAt: now,
    });
  }

  const mainRef = adminDb.collection('platform_settings').doc('main');
  const mainSnap = await mainRef.get();
  if (mainSnap.exists && !mainSnap.data()?.rootAdminUid) {
    await mainRef.set({ rootAdminUid: rootUid, updatedAt: now }, { merge: true });
  }
}
