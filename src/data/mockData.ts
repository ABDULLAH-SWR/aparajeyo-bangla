import type {
  District, PriorityIssue, NewsCluster, CivicInfo,
} from '@/types';

// ─── Districts ────────────────────────────────────────────────
export const districts: District[] = [
  {
    "districtCode": "bagerhat",
    "nameEn": "Bagerhat",
    "nameBn": "বাগেরহাট",
    "division": "Khulna",
    "divisionBn": "খুলনা",
    "lat": 22.651568,
    "lng": 89.785938
  },
  {
    "districtCode": "bandarban",
    "nameEn": "Bandarban",
    "nameBn": "বান্দরবান",
    "division": "Chattogram",
    "divisionBn": "চট্টগ্রাম",
    "lat": 22.1953275,
    "lng": 92.2183773
  },
  {
    "districtCode": "barguna",
    "nameEn": "Barguna",
    "nameBn": "বরগুনা",
    "division": "Barishal",
    "divisionBn": "বরিশাল",
    "lat": 22.159182,
    "lng": 90.125581
  },
  {
    "districtCode": "barishal",
    "nameEn": "Barishal",
    "nameBn": "বরিশাল",
    "division": "Barishal",
    "divisionBn": "বরিশাল",
    "lat": 22.701,
    "lng": 90.3535,
    "population": 2324310,
    "area": 2791
  },
  {
    "districtCode": "bhola",
    "nameEn": "Bhola",
    "nameBn": "ভোলা",
    "division": "Barishal",
    "divisionBn": "বরিশাল",
    "lat": 22.685923,
    "lng": 90.648179
  },
  {
    "districtCode": "bogra",
    "nameEn": "Bogra",
    "nameBn": "বগুড়া",
    "division": "Rajshahi",
    "divisionBn": "রাজশাহী",
    "lat": 24.8465,
    "lng": 89.3773,
    "population": 3400874,
    "area": 2919
  },
  {
    "districtCode": "brahmanbaria",
    "nameEn": "Brahmanbaria",
    "nameBn": "ব্রাহ্মণবাড়িয়া",
    "division": "Chattogram",
    "divisionBn": "চট্টগ্রাম",
    "lat": 23.9570904,
    "lng": 91.1119286
  },
  {
    "districtCode": "chandpur",
    "nameEn": "Chandpur",
    "nameBn": "চাঁদপুর",
    "division": "Chattogram",
    "divisionBn": "চট্টগ্রাম",
    "lat": 23.2332585,
    "lng": 90.6712912
  },
  {
    "districtCode": "chapainawabganj",
    "nameEn": "Chapainawabganj",
    "nameBn": "চাঁপাইনবাবগঞ্জ",
    "division": "Rajshahi",
    "divisionBn": "রাজশাহী",
    "lat": 24.5965034,
    "lng": 88.2775122
  },
  {
    "districtCode": "chattogram",
    "nameEn": "Chattogram",
    "nameBn": "চট্টগ্রাম",
    "division": "Chattogram",
    "divisionBn": "চট্টগ্রাম",
    "lat": 22.3569,
    "lng": 91.7832,
    "population": 8440042,
    "area": 5283
  },
  {
    "districtCode": "chuadanga",
    "nameEn": "Chuadanga",
    "nameBn": "চুয়াডাঙ্গা",
    "division": "Khulna",
    "divisionBn": "খুলনা",
    "lat": 23.6401961,
    "lng": 88.841841
  },
  {
    "districtCode": "coxs_bazar",
    "nameEn": "Cox's Bazar",
    "nameBn": "কক্সবাজার",
    "division": "Chattogram",
    "divisionBn": "চট্টগ্রাম",
    "lat": 21.4272,
    "lng": 92.0058,
    "population": 2289990,
    "area": 2492
  },
  {
    "districtCode": "cumilla",
    "nameEn": "Cumilla",
    "nameBn": "কুমিল্লা",
    "division": "Chattogram",
    "divisionBn": "চট্টগ্রাম",
    "lat": 23.4607,
    "lng": 91.1809,
    "population": 5387288,
    "area": 3085
  },
  {
    "districtCode": "dhaka",
    "nameEn": "Dhaka",
    "nameBn": "ঢাকা",
    "division": "Dhaka",
    "divisionBn": "ঢাকা",
    "lat": 23.8103,
    "lng": 90.4125,
    "population": 8906039,
    "area": 1463
  },
  {
    "districtCode": "dinajpur",
    "nameEn": "Dinajpur",
    "nameBn": "দিনাজপুর",
    "division": "Rangpur",
    "divisionBn": "রংপুর",
    "lat": 25.6217061,
    "lng": 88.6354504
  },
  {
    "districtCode": "faridpur",
    "nameEn": "Faridpur",
    "nameBn": "ফরিদপুর",
    "division": "Dhaka",
    "divisionBn": "ঢাকা",
    "lat": 23.6070822,
    "lng": 89.8429406
  },
  {
    "districtCode": "feni",
    "nameEn": "Feni",
    "nameBn": "ফেনী",
    "division": "Chattogram",
    "divisionBn": "চট্টগ্রাম",
    "lat": 23.023231,
    "lng": 91.3840844
  },
  {
    "districtCode": "gaibandha",
    "nameEn": "Gaibandha",
    "nameBn": "গাইবান্ধা",
    "division": "Rangpur",
    "divisionBn": "রংপুর",
    "lat": 25.328751,
    "lng": 89.528088
  },
  {
    "districtCode": "gazipur",
    "nameEn": "Gazipur",
    "nameBn": "গাজীপুর",
    "division": "Dhaka",
    "divisionBn": "ঢাকা",
    "lat": 24.0023,
    "lng": 90.4264,
    "population": 3403912,
    "area": 1741
  },
  {
    "districtCode": "gopalganj",
    "nameEn": "Gopalganj",
    "nameBn": "গোপালগঞ্জ",
    "division": "Dhaka",
    "divisionBn": "ঢাকা",
    "lat": 23.0050857,
    "lng": 89.8266059
  },
  {
    "districtCode": "habiganj",
    "nameEn": "Habiganj",
    "nameBn": "হবিগঞ্জ",
    "division": "Sylhet",
    "divisionBn": "সিলেট",
    "lat": 24.374945,
    "lng": 91.41553
  },
  {
    "districtCode": "jamalpur",
    "nameEn": "Jamalpur",
    "nameBn": "জামালপুর",
    "division": "Mymensingh",
    "divisionBn": "ময়মনসিংহ",
    "lat": 24.937533,
    "lng": 89.937775
  },
  {
    "districtCode": "jessore",
    "nameEn": "Jessore",
    "nameBn": "যশোর",
    "division": "Khulna",
    "divisionBn": "খুলনা",
    "lat": 23.16643,
    "lng": 89.2081126
  },
  {
    "districtCode": "jhalokathi",
    "nameEn": "Jhalokathi",
    "nameBn": "ঝালকাঠি",
    "division": "Barishal",
    "divisionBn": "বরিশাল",
    "lat": 22.6422689,
    "lng": 90.2003932
  },
  {
    "districtCode": "jhenaidah",
    "nameEn": "Jhenaidah",
    "nameBn": "ঝিনাইদহ",
    "division": "Khulna",
    "divisionBn": "খুলনা",
    "lat": 23.5448176,
    "lng": 89.1539213
  },
  {
    "districtCode": "joypurhat",
    "nameEn": "Joypurhat",
    "nameBn": "জয়পুরহাট",
    "division": "Rajshahi",
    "divisionBn": "রাজশাহী",
    "lat": 25.09636876,
    "lng": 89.0400428
  },
  {
    "districtCode": "khagrachhari",
    "nameEn": "Khagrachhari",
    "nameBn": "খাগড়াছড়ি",
    "division": "Chattogram",
    "divisionBn": "চট্টগ্রাম",
    "lat": 23.119285,
    "lng": 91.984663
  },
  {
    "districtCode": "khulna",
    "nameEn": "Khulna",
    "nameBn": "খুলনা",
    "division": "Khulna",
    "divisionBn": "খুলনা",
    "lat": 22.8456,
    "lng": 89.5403,
    "population": 2318527,
    "area": 4395
  },
  {
    "districtCode": "kishoreganj",
    "nameEn": "Kishoreganj",
    "nameBn": "কিশোরগঞ্জ",
    "division": "Dhaka",
    "divisionBn": "ঢাকা",
    "lat": 24.444937,
    "lng": 90.776575
  },
  {
    "districtCode": "kurigram",
    "nameEn": "Kurigram",
    "nameBn": "কুড়িগ্রাম",
    "division": "Rangpur",
    "divisionBn": "রংপুর",
    "lat": 25.805445,
    "lng": 89.636174
  },
  {
    "districtCode": "kushtia",
    "nameEn": "Kushtia",
    "nameBn": "কুষ্টিয়া",
    "division": "Khulna",
    "divisionBn": "খুলনা",
    "lat": 23.901258,
    "lng": 89.120482
  },
  {
    "districtCode": "lakshmipur",
    "nameEn": "Lakshmipur",
    "nameBn": "লক্ষ্মীপুর",
    "division": "Chattogram",
    "divisionBn": "চট্টগ্রাম",
    "lat": 22.942477,
    "lng": 90.841184
  },
  {
    "districtCode": "lalmonirhat",
    "nameEn": "Lalmonirhat",
    "nameBn": "লালমনিরহাট",
    "division": "Rangpur",
    "divisionBn": "রংপুর",
    "lat": 25.9165451,
    "lng": 89.4532409
  },
  {
    "districtCode": "madaripur",
    "nameEn": "Madaripur",
    "nameBn": "মাদারীপুর",
    "division": "Dhaka",
    "divisionBn": "ঢাকা",
    "lat": 23.164102,
    "lng": 90.1896805
  },
  {
    "districtCode": "magura",
    "nameEn": "Magura",
    "nameBn": "মাগুরা",
    "division": "Khulna",
    "divisionBn": "খুলনা",
    "lat": 23.487337,
    "lng": 89.419956
  },
  {
    "districtCode": "manikganj",
    "nameEn": "Manikganj",
    "nameBn": "মানিকগঞ্জ",
    "division": "Dhaka",
    "divisionBn": "ঢাকা",
    "lat": 23.8602262,
    "lng": 90.0018293
  },
  {
    "districtCode": "meherpur",
    "nameEn": "Meherpur",
    "nameBn": "মেহেরপুর",
    "division": "Khulna",
    "divisionBn": "খুলনা",
    "lat": 23.762213,
    "lng": 88.631821
  },
  {
    "districtCode": "moulvibazar",
    "nameEn": "Moulvibazar",
    "nameBn": "মৌলভীবাজার",
    "division": "Sylhet",
    "divisionBn": "সিলেট",
    "lat": 24.482934,
    "lng": 91.777417
  },
  {
    "districtCode": "munshiganj",
    "nameEn": "Munshiganj",
    "nameBn": "মুন্সিগঞ্জ",
    "division": "Dhaka",
    "divisionBn": "ঢাকা",
    "lat": 23.5435742,
    "lng": 90.5354327
  },
  {
    "districtCode": "mymensingh",
    "nameEn": "Mymensingh",
    "nameBn": "ময়মনসিংহ",
    "division": "Mymensingh",
    "divisionBn": "ময়মনসিংহ",
    "lat": 24.7471,
    "lng": 90.4203,
    "population": 5110272,
    "area": 4363
  },
  {
    "districtCode": "naogaon",
    "nameEn": "Naogaon",
    "nameBn": "নওগাঁ",
    "division": "Rajshahi",
    "divisionBn": "রাজশাহী",
    "lat": 24.83256191,
    "lng": 88.92485205
  },
  {
    "districtCode": "narail",
    "nameEn": "Narail",
    "nameBn": "নড়াইল",
    "division": "Khulna",
    "divisionBn": "খুলনা",
    "lat": 23.172534,
    "lng": 89.512672
  },
  {
    "districtCode": "narayanganj",
    "nameEn": "Narayanganj",
    "nameBn": "নারায়ণগঞ্জ",
    "division": "Dhaka",
    "divisionBn": "ঢাকা",
    "lat": 23.6238,
    "lng": 90.5,
    "population": 2948217,
    "area": 684
  },
  {
    "districtCode": "narsingdi",
    "nameEn": "Narsingdi",
    "nameBn": "নরসিংদী",
    "division": "Dhaka",
    "divisionBn": "ঢাকা",
    "lat": 23.932233,
    "lng": 90.71541
  },
  {
    "districtCode": "natore",
    "nameEn": "Natore",
    "nameBn": "নাটোর",
    "division": "Rajshahi",
    "divisionBn": "রাজশাহী",
    "lat": 24.420556,
    "lng": 89.000282
  },
  {
    "districtCode": "netrokona",
    "nameEn": "Netrokona",
    "nameBn": "নেত্রকোণা",
    "division": "Mymensingh",
    "divisionBn": "ময়মনসিংহ",
    "lat": 24.870955,
    "lng": 90.727887
  },
  {
    "districtCode": "nilphamari",
    "nameEn": "Nilphamari",
    "nameBn": "নীলফামারী",
    "division": "Rangpur",
    "divisionBn": "রংপুর",
    "lat": 25.931794,
    "lng": 88.856006
  },
  {
    "districtCode": "noakhali",
    "nameEn": "Noakhali",
    "nameBn": "নোয়াখালী",
    "division": "Chattogram",
    "divisionBn": "চট্টগ্রাম",
    "lat": 22.869563,
    "lng": 91.099398
  },
  {
    "districtCode": "pabna",
    "nameEn": "Pabna",
    "nameBn": "পাবনা",
    "division": "Rajshahi",
    "divisionBn": "রাজশাহী",
    "lat": 23.998524,
    "lng": 89.233645
  },
  {
    "districtCode": "panchagarh",
    "nameEn": "Panchagarh",
    "nameBn": "পঞ্চগড়",
    "division": "Rangpur",
    "divisionBn": "রংপুর",
    "lat": 26.3411,
    "lng": 88.5541606
  },
  {
    "districtCode": "patuakhali",
    "nameEn": "Patuakhali",
    "nameBn": "পটুয়াখালী",
    "division": "Barishal",
    "divisionBn": "বরিশাল",
    "lat": 22.3596316,
    "lng": 90.3298712
  },
  {
    "districtCode": "pirojpur",
    "nameEn": "Pirojpur",
    "nameBn": "পিরোজপুর",
    "division": "Barishal",
    "divisionBn": "বরিশাল",
    "lat": 22.5781398,
    "lng": 89.9983909
  },
  {
    "districtCode": "rajbari",
    "nameEn": "Rajbari",
    "nameBn": "রাজবাড়ী",
    "division": "Dhaka",
    "divisionBn": "ঢাকা",
    "lat": 23.7574305,
    "lng": 89.6444665
  },
  {
    "districtCode": "rajshahi",
    "nameEn": "Rajshahi",
    "nameBn": "রাজশাহী",
    "division": "Rajshahi",
    "divisionBn": "রাজশাহী",
    "lat": 24.3745,
    "lng": 88.6042,
    "population": 2595197,
    "area": 2407
  },
  {
    "districtCode": "rangamati",
    "nameEn": "Rangamati",
    "nameBn": "রাঙ্গামাটি",
    "division": "Chattogram",
    "divisionBn": "চট্টগ্রাম",
    "lat": 22.65561018,
    "lng": 92.17541121
  },
  {
    "districtCode": "rangpur",
    "nameEn": "Rangpur",
    "nameBn": "রংপুর",
    "division": "Rangpur",
    "divisionBn": "রংপুর",
    "lat": 25.7439,
    "lng": 89.2752,
    "population": 2881086,
    "area": 2368
  },
  {
    "districtCode": "satkhira",
    "nameEn": "Satkhira",
    "nameBn": "সাতক্ষীরা",
    "division": "Khulna",
    "divisionBn": "খুলনা",
    "lat": 22.7180905,
    "lng": 89.0687033
  },
  {
    "districtCode": "shariatpur",
    "nameEn": "Shariatpur",
    "nameBn": "শরীয়তপুর",
    "division": "Dhaka",
    "divisionBn": "ঢাকা",
    "lat": 23.2060195,
    "lng": 90.3477725
  },
  {
    "districtCode": "sherpur",
    "nameEn": "Sherpur",
    "nameBn": "শেরপুর",
    "division": "Mymensingh",
    "divisionBn": "ময়মনসিংহ",
    "lat": 25.0204933,
    "lng": 90.0152966
  },
  {
    "districtCode": "sirajganj",
    "nameEn": "Sirajganj",
    "nameBn": "সিরাজগঞ্জ",
    "division": "Rajshahi",
    "divisionBn": "রাজশাহী",
    "lat": 24.4533978,
    "lng": 89.7006815
  },
  {
    "districtCode": "sunamganj",
    "nameEn": "Sunamganj",
    "nameBn": "সুনামগঞ্জ",
    "division": "Sylhet",
    "divisionBn": "সিলেট",
    "lat": 25.0658,
    "lng": 91.395,
    "population": 2467968,
    "area": 3670
  },
  {
    "districtCode": "sylhet",
    "nameEn": "Sylhet",
    "nameBn": "সিলেট",
    "division": "Sylhet",
    "divisionBn": "সিলেট",
    "lat": 24.8949,
    "lng": 91.8687,
    "population": 3434188,
    "area": 3490
  },
  {
    "districtCode": "tangail",
    "nameEn": "Tangail",
    "nameBn": "টাঙ্গাইল",
    "division": "Dhaka",
    "divisionBn": "ঢাকা",
    "lat": 24.2513,
    "lng": 89.9164,
    "population": 3605083,
    "area": 3414
  },
  {
    "districtCode": "thakurgaon",
    "nameEn": "Thakurgaon",
    "nameBn": "ঠাকুরগাঁও",
    "division": "Rangpur",
    "divisionBn": "রংপুর",
    "lat": 26.0336945,
    "lng": 88.4616834
  }
];

// ─── Priority Issues ──────────────────────────────────────────
export const priorityIssues: PriorityIssue[] = [
  {
    id: 'pri-001', districtCode: 'sylhet', severity: 'Critical',
    title: 'Flash Floods in Sylhet — Thousands Displaced',
    titleBn: 'সিলেটে আকস্মিক বন্যা — হাজার হাজার মানুষ বাস্তুচ্যুত',
    description: 'Heavy monsoon rains have caused severe flash flooding across Sylhet division. Over 50,000 people have been displaced. Army and navy rescue operations are underway.',
    descriptionBn: 'ভারী বর্ষণে সিলেট বিভাগজুড়ে ভয়াবহ বন্যা। ৫০,০০০-এরও বেশি মানুষ বাস্তুচ্যুত। সেনা ও নৌবাহিনীর উদ্ধার অভিযান চলছে।',
    source: 'DGDA / Relief Web', timestamp: '2026-11-19T14:30:00Z', isActive: true, category: 'Disaster',
  },
  {
    id: 'pri-002', districtCode: 'dhaka', severity: 'High',
    title: 'Severe Air Quality Alert — Dhaka AQI Exceeds 300',
    titleBn: 'তীব্র বায়ু দূষণ সতর্কতা — ঢাকার AQI ৩০০ ছাড়িয়েছে',
    description: 'Dhaka\'s Air Quality Index has crossed hazardous levels. Authorities advise wearing N95 masks and limiting outdoor activities.',
    descriptionBn: 'ঢাকার বায়ু মান সূচক ক্ষতিকর মাত্রা ছাড়িয়েছে। কর্তৃপক্ষ N95 মাস্ক পরতে এবং বাইরের কার্যকলাপ সীমিত করতে পরামর্শ দিয়েছে।',
    source: 'DoE Bangladesh', timestamp: '2026-11-19T08:00:00Z', isActive: true, category: 'Disaster',
  },
  {
    id: 'pri-003', districtCode: 'coxs_bazar', severity: 'High',
    title: 'Rohingya Camp Fire — Emergency Response Activated',
    titleBn: 'রোহিঙ্গা ক্যাম্পে আগুন — জরুরি সাড়া সক্রিয়',
    description: 'A major fire broke out in Kutupalong refugee camp, destroying over 1,200 shelters. UNHCR and local fire services are responding.',
    descriptionBn: 'কুতুপালং শরণার্থী শিবিরে ভয়াবহ আগুন, ১,২০০-এরও বেশি আশ্রয়স্থল ধ্বংস। UNHCR ও স্থানীয় দমকলবাহিনী কাজ করছে।',
    source: 'UNHCR / RRRC', timestamp: '2026-11-19T16:45:00Z', isActive: true, category: 'Disaster',
  },
  {
    id: 'pri-004', districtCode: 'chattogram', severity: 'Advisory',
    title: 'Port Operations Disrupted Due to Nor\'wester',
    titleBn: 'কালবৈশাখীর কারণে বন্দর কার্যক্রম ব্যাহত',
    description: 'Chattogram port has suspended outer anchorage operations due to approaching nor\'wester. Ships advised to take precaution.',
    descriptionBn: 'আসন্ন কালবৈশাখীর কারণে চট্টগ্রাম বন্দরে বহির্নোঙর কার্যক্রম স্থগিত। জাহাজগুলোকে সতর্ক থাকতে বলা হয়েছে।',
    source: 'CPA', timestamp: '2026-11-19T12:00:00Z', isActive: true, category: 'Infrastructure',
  },
  {
    id: 'pri-005', districtCode: 'rajshahi', severity: 'Advisory',
    title: 'Padma Water Level Rising — Low-Lying Areas Alert',
    titleBn: 'পদ্মার পানি বাড়ছে — নিচু এলাকায় সতর্কতা',
    description: 'Water level of Padma river at Rajshahi point is rising steadily. Residents in low-lying areas advised to remain vigilant.',
    descriptionBn: 'রাজশাহী পয়েন্টে পদ্মা নদীর পানি ক্রমাগত বাড়ছে। নিচু এলাকার বাসিন্দাদের সতর্ক থাকতে বলা হয়েছে।',
    source: 'BWDB', timestamp: '2026-11-19T10:30:00Z', isActive: true, category: 'Disaster',
  },
  {
    id: 'pri-006', districtCode: 'khulna', severity: 'Critical',
    title: 'Cyclone Warning — Khulna Coast on High Alert',
    titleBn: 'ঘূর্ণিঝড় সতর্কতা — খুলনা উপকূলে উচ্চ সতর্কতা',
    description: 'Bangladesh Meteorological Department has issued danger signal No. 7 for Khulna coastal areas. Evacuation orders issued for 3 upazilas.',
    descriptionBn: 'বাংলাদেশ আবহাওয়া অধিদপ্তর খুলনা উপকূলীয় এলাকায় ৭ নম্বর বিপদ সংকেত জারি করেছে। ৩টি উপজেলায় সরিয়ে নেওয়ার নির্দেশ।',
    source: 'BMD', timestamp: '2026-11-19T18:00:00Z', isActive: true, category: 'Disaster',
  },
  {
    id: 'pri-007', districtCode: 'sunamganj', severity: 'High',
    title: 'Haor Embankment Breach — Crop Damage Alert',
    titleBn: 'হাওর বাঁধ ভেঙেছে — ফসল ক্ষতির সতর্কতা',
    description: 'Embankment breach in Dekar Haor has submerged over 5,000 hectares of Boro rice. Emergency repair teams deployed.',
    descriptionBn: 'দেকার হাওরে বাঁধ ভেঙে ৫,০০০ হেক্টরের বেশি বোরো ধান ডুবে গেছে। জরুরি মেরামত দল পাঠানো হয়েছে।',
    source: 'BWDB / DC Office', timestamp: '2026-11-19T06:00:00Z', isActive: true, category: 'Disaster',
  },
  {
    id: 'pri-008', districtCode: 'gazipur', severity: 'High',
    title: 'RMG Factory Fire — Workers Evacuated',
    titleBn: 'গার্মেন্টস কারখানায় আগুন — শ্রমিকদের সরিয়ে নেওয়া হয়েছে',
    description: 'Fire broke out at a garment factory in Gazipur BSCIC industrial area. All workers safely evacuated. 8 fire units responding.',
    descriptionBn: 'গাজীপুর বিসিক শিল্পনগরীতে একটি গার্মেন্টস কারখানায় আগুন। সকল শ্রমিককে নিরাপদে সরিয়ে নেওয়া হয়েছে।',
    source: 'Fire Service HQ', timestamp: '2026-11-19T15:20:00Z', isActive: true, category: 'Disaster',
  },
];

// ─── News Clusters ────────────────────────────────────────────
const outlets = {
  prothomAlo: { name: 'Prothom Alo', nameBn: 'প্রথম আলো', url: 'https://www.prothomalo.com', logoColor: '#E74C3C' },
  dailyStar: { name: 'The Daily Star', nameBn: 'দ্য ডেইলি স্টার', url: 'https://www.thedailystar.net', logoColor: '#2E86C1' },
  banglaTribune: { name: 'Bangla Tribune', nameBn: 'বাংলা ট্রিবিউন', url: 'https://www.banglatribune.com', logoColor: '#27AE60' },
  jamunaTV: { name: 'Jamuna TV', nameBn: 'যমুনা টিভি', url: 'https://www.jamuna.tv', logoColor: '#8E44AD' },
  somoyNews: { name: 'Somoy News', nameBn: 'সময় নিউজ', url: 'https://www.somoynews.tv', logoColor: '#E67E22' },
  bdNews24: { name: 'bdnews24.com', nameBn: 'বিডিনিউজ২৪', url: 'https://bdnews24.com', logoColor: '#C0392B' },
  dhakaPost: { name: 'Dhaka Post', nameBn: 'ঢাকা পোস্ট', url: 'https://www.dhakapost.com', logoColor: '#1ABC9C' },
};

export const newsClusters: NewsCluster[] = [
  {
    id: 'news-001', districtCode: 'dhaka', category: 'Politics',
    headline: 'Interim Government Announces Municipal Election Timeline',
    headlineBn: 'অন্তর্বর্তী সরকার পৌরসভা নির্বাচনের সময়সূচি ঘোষণা করেছে',
    summary: 'The interim government has announced elections for 320 municipalities will be held within the next 6 months, with voter registration beginning next month.',
    summaryBn: 'অন্তর্বর্তী সরকার ঘোষণা করেছে যে ৩২০টি পৌরসভার নির্বাচন আগামী ৬ মাসের মধ্যে অনুষ্ঠিত হবে।',
    outlets: [outlets.prothomAlo, outlets.dailyStar, outlets.bdNews24, outlets.jamunaTV],
    timestamp: '2026-11-19T09:00:00Z', storyCount: 4,
  },
  {
    id: 'news-002', districtCode: 'dhaka', category: 'Economy',
    headline: 'Bangladesh Bank Raises Repo Rate to Combat Inflation',
    headlineBn: 'মূল্যস্ফীতি নিয়ন্ত্রণে বাংলাদেশ ব্যাংক রেপো রেট বাড়িয়েছে',
    summary: 'The central bank raised its key policy rate by 50 basis points to 8.5%, citing persistent inflation above 9%.',
    summaryBn: 'কেন্দ্রীয় ব্যাংক মূল নীতি হার ৫০ বেসিস পয়েন্ট বাড়িয়ে ৮.৫% করেছে।',
    outlets: [outlets.dailyStar, outlets.bdNews24, outlets.dhakaPost],
    timestamp: '2026-11-19T11:30:00Z', storyCount: 3,
  },
  {
    id: 'news-003', districtCode: 'chattogram', category: 'Infrastructure',
    headline: 'Karnaphuli Tunnel Second Tube Completion Delayed',
    headlineBn: 'কর্ণফুলী টানেলের দ্বিতীয় টিউবের কাজ বিলম্বিত',
    summary: 'The second tube of Bangabandhu Karnaphuli Tunnel faces 6-month delay due to supply chain issues.',
    summaryBn: 'সরবরাহ সমস্যার কারণে বঙ্গবন্ধু কর্ণফুলী টানেলের দ্বিতীয় টিউবের কাজ ৬ মাস বিলম্বিত।',
    outlets: [outlets.prothomAlo, outlets.banglaTribune, outlets.somoyNews],
    timestamp: '2026-11-19T07:15:00Z', storyCount: 3,
  },
  {
    id: 'news-004', districtCode: 'sylhet', category: 'Disaster',
    headline: 'Flood Relief Operations Scale Up in Sylhet',
    headlineBn: 'সিলেটে বন্যা ত্রাণ কার্যক্রম জোরদার',
    summary: 'Government and NGOs ramp up relief distribution. 200+ shelters activated across the district.',
    summaryBn: 'সরকার ও এনজিওগুলো ত্রাণ বিতরণ বাড়িয়ে দিয়েছে। জেলাজুড়ে ২০০+ আশ্রয়কেন্দ্র সক্রিয়।',
    outlets: [outlets.prothomAlo, outlets.dailyStar, outlets.jamunaTV, outlets.somoyNews, outlets.bdNews24],
    timestamp: '2026-11-19T15:00:00Z', storyCount: 5,
  },
  {
    id: 'news-005', districtCode: 'rajshahi', category: 'Economy',
    headline: 'Mango Export Revenue Hits Record High',
    headlineBn: 'আমের রপ্তানি আয় রেকর্ড উচ্চতায়',
    summary: 'Rajshahi mango exports earned $45M this season, a 35% increase over the previous year.',
    summaryBn: 'রাজশাহীর আম রপ্তানি এই মৌসুমে $৪৫ মিলিয়ন আয় করেছে, যা আগের বছরের তুলনায় ৩৫% বেশি।',
    outlets: [outlets.prothomAlo, outlets.dailyStar],
    timestamp: '2026-11-18T14:00:00Z', storyCount: 2,
  },
  {
    id: 'news-006', districtCode: 'khulna', category: 'Disaster',
    headline: 'Cyclone Shelter Preparedness Underway in Khulna',
    headlineBn: 'খুলনায় ঘূর্ণিঝড় আশ্রয়কেন্দ্র প্রস্তুতি চলছে',
    summary: 'District administration activates 450 cyclone shelters. Navy vessels deployed for coastal rescue operations.',
    summaryBn: 'জেলা প্রশাসন ৪৫০টি সাইক্লোন শেল্টার সক্রিয় করেছে। উপকূলীয় উদ্ধার অভিযানে নৌবাহিনীর জাহাজ মোতায়েন।',
    outlets: [outlets.prothomAlo, outlets.banglaTribune, outlets.jamunaTV, outlets.somoyNews],
    timestamp: '2026-11-19T17:30:00Z', storyCount: 4,
  },
  {
    id: 'news-007', districtCode: 'coxs_bazar', category: 'Local',
    headline: 'Marine Drive Extension Project Inaugurated',
    headlineBn: 'মেরিন ড্রাইভ সম্প্রসারণ প্রকল্প উদ্বোধন',
    summary: 'The 80km Marine Drive extension from Teknaf to Cox\'s Bazar has been inaugurated, boosting tourism infrastructure.',
    summaryBn: 'টেকনাফ থেকে কক্সবাজার পর্যন্ত ৮০ কিমি মেরিন ড্রাইভ সম্প্রসারণ উদ্বোধন হয়েছে।',
    outlets: [outlets.dailyStar, outlets.dhakaPost, outlets.banglaTribune],
    timestamp: '2026-11-18T10:00:00Z', storyCount: 3,
  },
  {
    id: 'news-008', districtCode: 'rangpur', category: 'Economy',
    headline: 'Cold Storage Shortage Threatens Potato Farmers',
    headlineBn: 'হিমাগারের অভাবে হুমকিতে আলু চাষিরা',
    summary: 'Rangpur potato farmers face massive losses as cold storage facilities are insufficient for this year\'s bumper harvest.',
    summaryBn: 'এবারের বাম্পার ফলনে হিমাগার অপ্রতুল হওয়ায় রংপুরের আলু চাষিরা ব্যাপক ক্ষতির মুখে।',
    outlets: [outlets.prothomAlo, outlets.somoyNews],
    timestamp: '2026-11-18T16:00:00Z', storyCount: 2,
  },
  {
    id: 'news-009', districtCode: 'barishal', category: 'Infrastructure',
    headline: 'Padma Bridge Rail Link Progress Update',
    headlineBn: 'পদ্মা সেতু রেল সংযোগের অগ্রগতি',
    summary: 'The Dhaka-Barishal rail link via Padma Bridge is now 65% complete, with full operations expected by mid-2027.',
    summaryBn: 'পদ্মা সেতু দিয়ে ঢাকা-বরিশাল রেল সংযোগ এখন ৬৫% সম্পন্ন। ২০২৭ সালের মাঝামাঝি পূর্ণ চালু হওয়ার কথা।',
    outlets: [outlets.dailyStar, outlets.prothomAlo, outlets.banglaTribune],
    timestamp: '2026-11-17T12:00:00Z', storyCount: 3,
  },
  {
    id: 'news-010', districtCode: 'mymensingh', category: 'Local',
    headline: 'BAU Research Breakthrough in Flood-Resistant Rice',
    headlineBn: 'বাকৃবি-তে বন্যা প্রতিরোধী ধানে গবেষণায় সাফল্য',
    summary: 'Bangladesh Agricultural University researchers develop new rice variety that can survive 20 days of submersion.',
    summaryBn: 'বাংলাদেশ কৃষি বিশ্ববিদ্যালয়ের গবেষকরা ২০ দিন জলমগ্ন থাকতে পারে এমন নতুন ধানের জাত উদ্ভাবন করেছেন।',
    outlets: [outlets.prothomAlo, outlets.dailyStar, outlets.bdNews24],
    timestamp: '2026-11-18T08:30:00Z', storyCount: 3,
  },
  {
    id: 'news-011', districtCode: 'tangail', category: 'Crime',
    headline: 'Major Drug Trafficking Ring Busted in Tangail',
    headlineBn: 'টাঙ্গাইলে বড় মাদক চোরাচালান চক্র গ্রেপ্তার',
    summary: 'RAB arrests 12 members of an interstate drug trafficking network in Tangail. Yaba tablets worth Tk 5 crore seized.',
    summaryBn: 'টাঙ্গাইলে র‍্যাব আন্তঃরাজ্য মাদক চোরাচালান চক্রের ১২ সদস্যকে গ্রেপ্তার করেছে। ৫ কোটি টাকার ইয়াবা উদ্ধার।',
    outlets: [outlets.jamunaTV, outlets.somoyNews, outlets.dhakaPost],
    timestamp: '2026-11-19T06:45:00Z', storyCount: 3,
  },
  {
    id: 'news-012', districtCode: 'cumilla', category: 'Politics',
    headline: 'Student Union Elections Resume After 3-Year Hiatus',
    headlineBn: '৩ বছর পর ছাত্র সংসদ নির্বাচন পুনরায় শুরু',
    summary: 'Cumilla University and Victoria College hold student union elections for the first time since 2023.',
    summaryBn: 'কুমিল্লা বিশ্ববিদ্যালয় ও ভিক্টোরিয়া কলেজে ২০২৩ সালের পর প্রথমবার ছাত্র সংসদ নির্বাচন।',
    outlets: [outlets.prothomAlo, outlets.bdNews24],
    timestamp: '2026-11-19T13:00:00Z', storyCount: 2,
  },
  {
    id: 'news-013', districtCode: 'sunamganj', category: 'Disaster',
    headline: 'Haor Communities Demand Better Embankment Maintenance',
    headlineBn: 'হাওর এলাকার মানুষ ভালো বাঁধ রক্ষণাবেক্ষণের দাবি জানিয়েছে',
    summary: 'After recurrent breaches, Sunamganj residents stage peaceful protests demanding BWDB accountability.',
    summaryBn: 'বারবার বাঁধ ভাঙার পর সুনামগঞ্জবাসী পানি উন্নয়ন বোর্ডের জবাবদিহিতার দাবিতে শান্তিপূর্ণ বিক্ষোভ।',
    outlets: [outlets.prothomAlo, outlets.banglaTribune, outlets.jamunaTV],
    timestamp: '2026-11-19T08:00:00Z', storyCount: 3,
  },
  {
    id: 'news-014', districtCode: 'gazipur', category: 'Economy',
    headline: 'RMG Exports Surge 18% Year-on-Year',
    headlineBn: 'পোশাক রপ্তানি বছরে ১৮% বেড়েছে',
    summary: 'Gazipur-based garment factories report strong Q3 performance with $4.2B in exports.',
    summaryBn: 'গাজীপুরের গার্মেন্টস কারখানাগুলোর তৃতীয় প্রান্তিকে $৪.২ বিলিয়ন রপ্তানি।',
    outlets: [outlets.dailyStar, outlets.bdNews24, outlets.dhakaPost],
    timestamp: '2026-11-18T11:00:00Z', storyCount: 3,
  },
  {
    id: 'news-015', districtCode: 'narayanganj', category: 'Crime',
    headline: 'River Pollution Crackdown — 5 Factories Sealed',
    headlineBn: 'নদী দূষণ রোধে ৫ কারখানা সিলগালা',
    summary: 'DoE seals 5 dyeing factories in Narayanganj for discharging untreated effluent into Shitalakshya river.',
    summaryBn: 'নারায়ণগঞ্জে শীতলক্ষ্যা নদীতে অপরিশোধিত বর্জ্য ছাড়ার অভিযোগে পরিবেশ অধিদপ্তর ৫টি ডাইং কারখানা সিলগালা করেছে।',
    outlets: [outlets.prothomAlo, outlets.somoyNews, outlets.jamunaTV],
    timestamp: '2026-11-19T10:15:00Z', storyCount: 3,
  },
  {
    id: 'news-016', districtCode: 'bogra', category: 'Local',
    headline: 'Mahasthangarh Heritage Site Restoration Begins',
    headlineBn: 'মহাস্থানগড় ঐতিহ্যস্থল সংস্কার শুরু',
    summary: 'UNESCO-funded restoration of the ancient Mahasthangarh archaeological site begins with a $2.5M budget.',
    summaryBn: 'ইউনেস্কো অর্থায়নে প্রাচীন মহাস্থানগড় প্রত্নতাত্ত্বিক স্থানের $২.৫ মিলিয়ন বাজেটে সংস্কার শুরু।',
    outlets: [outlets.dailyStar, outlets.prothomAlo],
    timestamp: '2026-11-17T09:00:00Z', storyCount: 2,
  },
];

// ─── Civic Info ───────────────────────────────────────────────
const defaultEmergency = [
  { label: 'National Emergency', labelBn: 'জাতীয় জরুরি সেবা', number: '999' },
  { label: 'Fire Service', labelBn: 'ফায়ার সার্ভিস', number: '16163' },
  { label: 'Ambulance', labelBn: 'অ্যাম্বুলেন্স', number: '199' },
  { label: 'Police', labelBn: 'পুলিশ', number: '100' },
];

export const civicInfoMap: Record<string, CivicInfo> = {
  dhaka: {
    districtCode: 'dhaka', overviewEn: 'Dhaka is the capital and largest city of Bangladesh, serving as the economic, political, and cultural center of the country. It is one of the most densely populated cities in the world.',
    overviewBn: 'ঢাকা বাংলাদেশের রাজধানী ও বৃহত্তম শহর। এটি দেশের অর্থনৈতিক, রাজনৈতিক ও সাংস্কৃতিক কেন্দ্র।',
    emergencyNumbers: [...defaultEmergency, { label: 'Dhaka Medical College', labelBn: 'ঢাকা মেডিকেল কলেজ', number: '02-55165088' }],
    notices: [{ titleEn: 'Water supply maintenance Nov 20-21', titleBn: 'নভেম্বর ২০-২১ পানি সরবরাহ রক্ষণাবেক্ষণ', date: '2026-11-18' }, { titleEn: 'DNCC mosquito fogging schedule updated', titleBn: 'ডিএনসিসি মশা নিধন সময়সূচি আপডেট', date: '2026-11-17' }],
    adminInfo: [{ labelEn: 'DC Office', labelBn: 'ডিসি অফিস', value: 'Dhaka DC', valueBn: 'ঢাকা ডিসি' }, { labelEn: 'Division', labelBn: 'বিভাগ', value: 'Dhaka', valueBn: 'ঢাকা' }, { labelEn: 'Area', labelBn: 'আয়তন', value: '1,463 km²', valueBn: '১,৪৬৩ বর্গ কিমি' }],
  },
  chattogram: {
    districtCode: 'chattogram', overviewEn: 'Chattogram is Bangladesh\'s main seaport city and the second-largest city. It is a major commercial and industrial hub.',
    overviewBn: 'চট্টগ্রাম বাংলাদেশের প্রধান সমুদ্র বন্দর নগরী এবং দ্বিতীয় বৃহত্তম শহর।',
    emergencyNumbers: [...defaultEmergency, { label: 'CMCH', labelBn: 'চমেক', number: '031-630335' }],
    notices: [{ titleEn: 'Port operations schedule for November', titleBn: 'নভেম্বরের বন্দর কার্যক্রম সময়সূচি', date: '2026-11-15' }],
    adminInfo: [{ labelEn: 'DC Office', labelBn: 'ডিসি অফিস', value: 'Chattogram DC', valueBn: 'চট্টগ্রাম ডিসি' }, { labelEn: 'Division', labelBn: 'বিভাগ', value: 'Chattogram', valueBn: 'চট্টগ্রাম' }, { labelEn: 'Area', labelBn: 'আয়তন', value: '5,283 km²', valueBn: '৫,২৮৩ বর্গ কিমি' }],
  },
  sylhet: {
    districtCode: 'sylhet', overviewEn: 'Sylhet is known for its tea gardens, natural beauty, and significant expatriate population. It is a major spiritual and cultural center.',
    overviewBn: 'সিলেট চা বাগান, প্রাকৃতিক সৌন্দর্য এবং উল্লেখযোগ্য প্রবাসী জনগোষ্ঠীর জন্য পরিচিত।',
    emergencyNumbers: [...defaultEmergency, { label: 'SUST Medical Center', labelBn: 'শাবিপ্রবি মেডিকেল', number: '0821-713850' }],
    notices: [{ titleEn: 'Flood relief distribution centers active', titleBn: 'বন্যা ত্রাণ বিতরণ কেন্দ্র সক্রিয়', date: '2026-11-19' }],
    adminInfo: [{ labelEn: 'DC Office', labelBn: 'ডিসি অফিস', value: 'Sylhet DC', valueBn: 'সিলেট ডিসি' }, { labelEn: 'Division', labelBn: 'বিভাগ', value: 'Sylhet', valueBn: 'সিলেট' }, { labelEn: 'Area', labelBn: 'আয়তন', value: '3,490 km²', valueBn: '৩,৪৯০ বর্গ কিমি' }],
  },
};

// Generate fallback civic info for districts without specific data
export function getCivicInfo(districtCode: string): CivicInfo {
  if (civicInfoMap[districtCode]) return civicInfoMap[districtCode];
  const district = districts.find((d) => d.districtCode === districtCode);
  return {
    districtCode,
    overviewEn: `${district?.nameEn ?? districtCode} is a district in the ${district?.division ?? ''} division of Bangladesh.`,
    overviewBn: `${district?.nameBn ?? districtCode} বাংলাদেশের ${district?.divisionBn ?? ''} বিভাগের একটি জেলা।`,
    emergencyNumbers: defaultEmergency,
    notices: [],
    adminInfo: [
      { labelEn: 'Division', labelBn: 'বিভাগ', value: district?.division ?? '', valueBn: district?.divisionBn ?? '' },
      { labelEn: 'Area', labelBn: 'আয়তন', value: district?.area ? `${district.area.toLocaleString()} km²` : 'N/A', valueBn: district?.area ? `${district.area.toLocaleString()} বর্গ কিমি` : 'N/A' },
    ],
  };
}
