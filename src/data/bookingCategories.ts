export const DEFAULT_BENGALI_BOOKING_CATEGORIES: string[] = [
  'চা ও স্মোক ব্রেক আড্ডা (Tea & Smoke Break Hangout)',
  'শান্তিপূর্ণ গ্যাঞ্জাম ও বন্ধু আড্ডা (Casual Group Hangout)',
  'মেয়ে বন্ধু / কফি ও পাবলিক আউটিং (Public Coffee & Outing)',
  'ভাই / বন্ধু সঙ্গী (Bhai / Brother Companion)',
  'ইভেন্ট, পার্টি ও দাওয়াত সঙ্গী (Events & Gatherings)',
  'শপিং ও শহর ঘোরাঘুরি (Shopping & City Guide)',
  'কর্পোরেট ও অফিসিয়াল সহায়তা (Corporate & Official Assistance)',
];

const BANGLA_DIGIT_MAP: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

export function normalizeBanglaDigits(input: string): string {
  return String(input || '').replace(/[০-৯]/g, (d) => BANGLA_DIGIT_MAP[d] || d);
}

const VIOLENCE_BN_TERMS = [
  'মারমু',
  'মারবো',
  'মারব',
  'মারা হবে',
  'স্যারকে মারা',
  'স্যারকে মার',
  'স্যাররে মার',
  'পিটানো',
  'পিটামু',
  'পিটাবো',
  'মারামারি',
  'হামলা',
  'খুন',
  'ভাঙচুর',
  'ছুরি',
  'গুলি',
  'রক্তপাত',
  'অস্ত্র',
];

const VIOLENCE_EN_REGEXES: RegExp[] = [
  /\bmarmu\b/i,
  /\bmarbo\b/i,
  /\bmaramari\b/i,
  /\bpitamu\b/i,
  /\bpitabo\b/i,
  /\bhamla\b/i,
  /\bbeat\s*(up|him|her|sir|someone|teacher)\b/i,
  /\bsir\s*re\s*mar\w*\b/i,
  /\bteacher\b.*\b(beat|hit|attack)\b/i,
  /\b(assault|murder|homicide|weapon|knife|pistol|gun|riot|brawl|revenge\s*attack)\b/i,
];

export const VIOLENCE_SAFETY_MESSAGE_BN =
  'নিরাপত্তা নীতিমালা: কাউকে মারা, স্যার বা কারো ওপর হামলা, মারামারি বা যেকোনো সহিংস কাজের জন্য ক্যাটাগরি বা বুকিং গ্রহণ করা হয় না। LOGEASI.COM শুধুমাত্র ১৮+ শান্তিপূর্ণ সামাজিক আড্ডা, চা/কফি ও বৈধ সহায়তার জন্য।';

export function containsUnsafeViolenceTerm(text: string): boolean {
  const raw = String(text || '').trim();
  if (!raw) return false;
  const lower = raw.toLowerCase();
  for (const term of VIOLENCE_BN_TERMS) {
    if (lower.includes(term)) return true;
  }
  for (const rx of VIOLENCE_EN_REGEXES) {
    if (rx.test(lower)) return true;
  }
  return false;
}

const DIVISION_KEYWORD_MAP: Array<{ division: string; terms: string[] }> = [
  {
    division: 'Dhaka',
    terms: [
      'ঢাকা',
      'dhaka',
      'গুলশান',
      'gulshan',
      'বনানী',
      'banani',
      'ধানমন্ডি',
      'dhanmondi',
      'উত্তরা',
      'uttara',
      'মিরপুর',
      'mirpur',
      'বসুন্ধরা',
      'bashundhara',
      'মোহাম্মদপুর',
      'mohammadpur',
      'মতিঝিল',
      'motijheel',
      'গাজীপুর',
      'gazipur',
      'নারায়ণগঞ্জ',
      'narayanganj',
      'সাভার',
      'savar',
    ],
  },
  {
    division: 'Chittagong',
    terms: [
      'চট্টগ্রাম',
      'চট্রগ্রাম',
      'chittagong',
      'chattogram',
      'ctg',
      'আগ্রাবাদ',
      'agrabad',
      'কক্সবাজার',
      'cox',
      'কুমিল্লা',
      'cumilla',
    ],
  },
  {
    division: 'Sylhet',
    terms: ['সিলেট', 'sylhet', 'জিন্দাবাজার', 'zindabazar', 'সুনামগঞ্জ', 'sunamganj', 'মৌলভীবাজার'],
  },
  {
    division: 'Rajshahi',
    terms: ['রাজশাহী', 'rajshahi', 'বগুড়া', 'bogura', 'পাবনা', 'pabna'],
  },
  {
    division: 'Khulna',
    terms: ['খুলনা', 'khulna', 'যশোর', 'jashore', 'jessore', 'কুষ্টিয়া', 'kushtia'],
  },
  {
    division: 'Barishal',
    terms: ['বরিশাল', 'barishal', 'barisal', 'পটুয়াখালী', 'patuakhali'],
  },
  {
    division: 'Rangpur',
    terms: ['রংপুর', 'rangpur', 'দিনাজপুর', 'dinajpur'],
  },
  {
    division: 'Mymensingh',
    terms: ['ময়মনসিংহ', 'mymensingh', 'জামালপুর', 'jamalpur', 'নেত্রকোনা'],
  },
];

const BILINGUAL_CONCEPT_MAP: Array<{ triggers: string[]; expansions: string[] }> = [
  {
    triggers: ['চা', 'tea', 'cha', 'টং', 'tong', 'কফি', 'coffee', 'cafe', 'লাঞ্চ', 'ডিনার', 'dining'],
    expansions: ['tea', 'coffee', 'dining', 'চা', 'কফি', 'স্মোক', 'আউটিং'],
  },
  {
    triggers: ['স্মোক', 'smoke', 'সিগারেট', 'cigarette', 'sigret', 'সিগ্রেট', 'চায়ের'],
    expansions: ['tea', 'smoke', 'hangout', 'স্মোক', 'চা', 'আড্ডা', 'গ্যাঞ্জাম'],
  },
  {
    triggers: ['আড্ডা', 'গ্যাঞ্জাম', 'genjam', 'adda', 'hangout', 'বন্ধু', 'bandhu', 'chill', 'কথা', 'গল্প'],
    expansions: ['hangout', 'social', 'outings', 'bhai', 'আড্ডা', 'গ্যাঞ্জাম', 'বন্ধু'],
  },
  {
    triggers: ['মেয়ে', 'মেয়ে', 'maya', 'meye', 'female', 'girl', 'woman', 'lady', 'বান্ধবী', 'আন্টি', 'আপু', 'apu'],
    expansions: ['female', 'women', 'girl', 'coffee', 'outing', 'dining', 'cultural', 'মেয়ে', 'কফি', 'আউটিং'],
  },
  {
    triggers: ['ভাই', 'ছেলে', 'bhai', 'brother', 'bro', 'chele', 'boy', 'male'],
    expansions: ['bhai', 'brother', 'male', 'ভাই'],
  },
  {
    triggers: ['ইভেন্ট', 'পার্টি', 'দাওয়াত', 'বিয়ে', 'event', 'party', 'wedding', 'gathering', 'concert'],
    expansions: ['event', 'public', 'corporate', 'gathering', 'ইভেন্ট', 'পার্টি', 'দাওয়াত'],
  },
  {
    triggers: ['শপিং', 'মার্কেট', 'ঘোরা', 'ঘোরাঘুরি', 'ট্যুর', 'shopping', 'guide', 'errand', 'tour', 'city'],
    expansions: ['shopping', 'guide', 'errands', 'city', 'শপিং', 'ঘোরাঘুরি'],
  },
  {
    triggers: ['অফিস', 'কর্পোরেট', 'মিটিং', 'সহায়তা', 'কাজ', 'office', 'corporate', 'business', 'assistance'],
    expansions: ['corporate', 'official', 'business', 'assistance', 'কর্পোরেট', 'অফিসিয়াল'],
  },
];

export interface ParsedPreferenceQuery {
  rawText: string;
  unsafeViolence: boolean;
  detectedDivision?: string;
  extractedMinRate?: number;
  extractedMaxRate?: number;
  extractedTargetRate?: number;
  searchTokens: string[];
  preferredGender?: 'female' | 'male';
}

export function parseBengaliPreferenceQuery(rawText: string): ParsedPreferenceQuery {
  const cleanRaw = String(rawText || '').trim();
  if (!cleanRaw) {
    return { rawText: '', unsafeViolence: false, searchTokens: [] };
  }

  const unsafeViolence = containsUnsafeViolenceTerm(cleanRaw);
  const normalized = normalizeBanglaDigits(cleanRaw).toLowerCase().replace(/(\d),(\d)/g, '$1$2');

  // Extract BDT budget / rate numbers (typical range 300 - 100000)
  const numberMatches = Array.from(normalized.matchAll(/\b(\d{3,6})\b/g))
    .map((m) => Number(m[1]))
    .filter((n) => n >= 300 && n <= 100000);

  let extractedMinRate: number | undefined;
  let extractedMaxRate: number | undefined;
  let extractedTargetRate: number | undefined;

  if (numberMatches.length >= 2) {
    const sorted = [...numberMatches].sort((a, b) => a - b);
    extractedMinRate = sorted[0];
    extractedMaxRate = sorted[sorted.length - 1];
    extractedTargetRate = Math.round((extractedMinRate + extractedMaxRate) / 2);
  } else if (numberMatches.length === 1) {
    const n = numberMatches[0];
    const hasCeilingCue = /(মধ্যে|নিচে|কম|সর্বোচ্চ|under|below|max|within|upto|up to|budget)/.test(normalized);
    if (hasCeilingCue) {
      extractedMaxRate = n;
      extractedTargetRate = n;
    } else {
      extractedTargetRate = n;
      extractedMaxRate = Math.round(n * 1.25);
    }
  }

  // Detect administrative division
  let detectedDivision: string | undefined;
  for (const div of DIVISION_KEYWORD_MAP) {
    if (div.terms.some((t) => normalized.includes(t))) {
      detectedDivision = div.division;
      break;
    }
  }

  // Preferred companion vibe / gender hint
  let preferredGender: 'female' | 'male' | undefined;
  if (/(মেয়ে|মেয়ে|maya|meye|female|girl|woman|apu|আপু|বান্ধবী)/.test(normalized)) {
    preferredGender = 'female';
  } else if (/(ভাই|ছেলে|bhai|brother|chele|boy|male)/.test(normalized)) {
    preferredGender = 'male';
  }

  // Collect bilingual search tokens
  const tokens = new Set<string>();
  for (const concept of BILINGUAL_CONCEPT_MAP) {
    if (concept.triggers.some((t) => normalized.includes(t))) {
      concept.expansions.forEach((e) => tokens.add(e));
    }
  }

  // Add raw words excluding tiny filler words & pure digits
  const rawWords = normalized
    .split(/[\s,।.;:!?/\\()\-]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3 && !/^\d+$/.test(w));
  const stopWords = new Set([
    'taka',
    'bdt',
    'টাকা',
    'টাকার',
    'মধ্যে',
    'চাই',
    'লাগবে',
    'হবে',
    'আছে',
    'জন্য',
    'সাথে',
    'নিয়ে',
    'দরকার',
    'রকম',
    'ধরনের',
    'রেটের',
    'রেট',
    'rate',
    'want',
    'need',
    'with',
    'for',
    'under',
    'companion',
    'সঙ্গী',
  ]);
  for (const w of rawWords) {
    if (!stopWords.has(w)) tokens.add(w);
  }

  return {
    rawText: cleanRaw,
    unsafeViolence,
    detectedDivision,
    extractedMinRate,
    extractedMaxRate,
    extractedTargetRate,
    searchTokens: Array.from(tokens),
    preferredGender,
  };
}
