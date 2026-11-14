import { DHAKA_DIVISION_DISTRICTS, DHAKA_METRO_AREAS } from './dhakaDivision.ts';

export interface BangladeshDivision {
  id:
    | 'Dhaka'
    | 'Chattogram'
    | 'Sylhet'
    | 'Rajshahi'
    | 'Khulna'
    | 'Barishal'
    | 'Rangpur'
    | 'Mymensingh';
  label: string;
  shortLabel: string;
  aliases: string[];
  districts: string[];
  metroAreas: string[];
}

export const BANGLADESH_DIVISIONS: BangladeshDivision[] = [
  {
    id: 'Dhaka',
    label: 'Dhaka Division',
    shortLabel: 'Dhaka',
    aliases: ['dhaka', 'dhaka division', 'dhaka bibhag'],
    districts: [...DHAKA_DIVISION_DISTRICTS],
    metroAreas: [...DHAKA_METRO_AREAS, 'Keraniganj'],
  },
  {
    id: 'Chattogram',
    label: 'Chittagong (Chattogram) Division',
    shortLabel: 'Chittagong',
    aliases: ['chittagong', 'chattogram', 'chittagong division', 'chattogram division', 'ctg'],
    districts: [
      'Chattogram',
      'Chittagong',
      "Cox's Bazar",
      'Cumilla',
      'Brahmanbaria',
      'Chandpur',
      'Feni',
      'Noakhali',
      'Lakshmipur',
      'Rangamati',
      'Bandarban',
      'Khagrachhari',
    ],
    metroAreas: ['GEC Circle', 'Nasirabad', 'Agrabad', 'Panchlaish', 'Patenga', 'Halishahar', 'Kolatoli'],
  },
  {
    id: 'Sylhet',
    label: 'Sylhet Division',
    shortLabel: 'Sylhet',
    aliases: ['sylhet', 'sylhet division'],
    districts: ['Sylhet', 'Moulvibazar', 'Habiganj', 'Sunamganj'],
    metroAreas: ['Zindabazar', 'Shahjalal Upashahar', 'Amberkhana', 'Sreemangal', 'Tilagor'],
  },
  {
    id: 'Rajshahi',
    label: 'Rajshahi Division',
    shortLabel: 'Rajshahi',
    aliases: ['rajshahi', 'rajshahi division'],
    districts: [
      'Rajshahi',
      'Bogura',
      'Pabna',
      'Sirajganj',
      'Natore',
      'Naogaon',
      'Chapainawabganj',
      'Joypurhat',
    ],
    metroAreas: ['Shaheb Bazar', 'Padma Residential', 'Motihar', 'Satmatha'],
  },
  {
    id: 'Khulna',
    label: 'Khulna Division',
    shortLabel: 'Khulna',
    aliases: ['khulna', 'khulna division'],
    districts: [
      'Khulna',
      'Jashore',
      'Kushtia',
      'Satkhira',
      'Bagerhat',
      'Jhenaidah',
      'Magura',
      'Narail',
      'Chuadanga',
      'Meherpur',
    ],
    metroAreas: ['Shibbari', 'Sonadanga', 'Khalishpur', 'Boyra'],
  },
  {
    id: 'Barishal',
    label: 'Barishal (Barisal) Division',
    shortLabel: 'Barishal',
    aliases: ['barishal', 'barisal', 'barishal division', 'barisal division'],
    districts: ['Barishal', 'Barisal', 'Patuakhali', 'Bhola', 'Pirojpur', 'Barguna', 'Jhalokati'],
    metroAreas: ['Sadar Road', 'Band Road', 'Nathullabad', 'Kuakata'],
  },
  {
    id: 'Rangpur',
    label: 'Rangpur Division',
    shortLabel: 'Rangpur',
    aliases: ['rangpur', 'rangpur division'],
    districts: [
      'Rangpur',
      'Dinajpur',
      'Gaibandha',
      'Kurigram',
      'Lalmonirhat',
      'Nilphamari',
      'Panchagarh',
      'Thakurgaon',
    ],
    metroAreas: ['Jahaj Company More', 'Dhap', 'Carmichael College Area'],
  },
  {
    id: 'Mymensingh',
    label: 'Mymensingh Division',
    shortLabel: 'Mymensingh',
    aliases: ['mymensingh', 'mymensingh division'],
    districts: ['Mymensingh', 'Jamalpur', 'Netrokona', 'Sherpur'],
    metroAreas: ['Town Hall', 'Charpara', 'BAU Campus'],
  },
];

export function normalizeDivisionKey(value?: string | null): string {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw || raw === 'all') return '';
  for (const div of BANGLADESH_DIVISIONS) {
    if (div.id.toLowerCase() === raw || div.aliases.includes(raw) || div.label.toLowerCase() === raw) {
      return div.id;
    }
  }
  return '';
}

export function resolveDivisionForLocation(location?: string | null): string {
  const raw = String(location || '').trim().toLowerCase();
  if (!raw) return '';

  const directDiv = normalizeDivisionKey(raw);
  if (directDiv) return directDiv;

  for (const div of BANGLADESH_DIVISIONS) {
    const allLocs = [...div.districts, ...div.metroAreas].map((l) => l.toLowerCase());
    if (allLocs.some((loc) => loc === raw || raw.includes(loc))) {
      return div.id;
    }
  }
  return '';
}

export function getLocationsForDivision(divisionId?: string | null): string[] {
  const key = normalizeDivisionKey(divisionId);
  if (!key) {
    const unique = new Set<string>();
    for (const div of BANGLADESH_DIVISIONS) {
      for (const area of div.metroAreas.slice(0, 4)) unique.add(area);
      for (const dist of div.districts) {
        if (dist !== 'Chittagong' && dist !== 'Barisal') unique.add(dist);
      }
    }
    return Array.from(unique);
  }
  const found = BANGLADESH_DIVISIONS.find((d) => d.id === key);
  if (!found) return [];
  const merged = [...found.metroAreas, ...found.districts].filter(
    (d) => d !== 'Chittagong' && d !== 'Barisal'
  );
  return Array.from(new Set(merged));
}

export function isKnownBangladeshLocation(location?: string | null): boolean {
  return Boolean(resolveDivisionForLocation(location));
}
