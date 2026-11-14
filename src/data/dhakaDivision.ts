export const DHAKA_DIVISION_DISTRICTS = [
  'Dhaka',
  'Gazipur',
  'Narayanganj',
  'Narsingdi',
  'Tangail',
  'Kishoreganj',
  'Manikganj',
  'Munshiganj',
  'Rajbari',
  'Madaripur',
  'Gopalganj',
  'Faridpur',
  'Shariatpur',
] as const;

export const DHAKA_METRO_AREAS = [
  'Gulshan',
  'Banani',
  'Baridhara',
  'Dhanmondi',
  'Uttara',
  'Mirpur',
  'Bashundhara R/A',
  'Mohakhali',
  'Motijheel',
  'Old Dhaka',
  'Mohammadpur',
  'Badda',
  'Savar',
  'Tongi',
  'Narayanganj Sadar',
] as const;

export const ALL_DHAKA_BIBHAG_LOCATIONS = [
  ...DHAKA_METRO_AREAS,
  ...DHAKA_DIVISION_DISTRICTS.filter((d) => d !== 'Dhaka'),
];
