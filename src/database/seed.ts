/**
 * Seeds master data + bootstrap owner. Idempotent. Run: `npm run seed`.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import * as bcrypt from 'bcryptjs';

const MONGODB_URI =
  process.env.MONGODB_URI ?? 'mongodb://localhost:27017/insurance_crm';

type M = {
  type: string;
  name: string;
  code?: string;
  shortName?: string;
  category?: string;
  colorClass?: string;
  isTerminal?: boolean;
  sortOrder?: number;
};

const MASTERS: M[] = [
  // renewal statuses (pipeline)
  ...[
    ['Not Started', 'not_started', 'gray', false],
    ['Contacted', 'contacted', 'blue', false],
    ['Quote Sent', 'quote_sent', 'indigo', false],
    ['Negotiating', 'negotiating', 'amber', false],
    ['Payment Pending', 'payment_pending', 'amber', false],
    ['Converted', 'converted', 'green', true],
    ['Lost', 'lost', 'red', true],
    ['Lapsed', 'lapsed', 'orange', true],
  ].map(([name, code, colorClass, isTerminal], i) => ({
    type: 'renewal_status', name: name as string, code: code as string,
    colorClass: colorClass as string, isTerminal: isTerminal as boolean, sortOrder: i,
  })),
  // policy types
  ...[
    ['Comprehensive', 'comprehensive'], ['Third Party', 'third_party'],
    ['Own Damage', 'own_damage'], ['Standalone Own Damage', 'standalone_od'],
    ['Bundled (1+3 / 1+5)', 'bundled'],
  ].map(([name, code], i) => ({ type: 'policy_type', name, code, sortOrder: i })),
  // addon types
  ...[
    ['Zero Depreciation', 'zero_dep'], ['Engine Protect', 'engine_protect'],
    ['Roadside Assistance', 'rsa'], ['Return to Invoice', 'rti'],
    ['Consumables', 'consumables'], ['NCB Protection', 'ncb_protect'],
    ['Personal Accident', 'pa_cover'], ['Key Replacement', 'key_replace'],
  ].map(([name, code], i) => ({ type: 'addon_type', name, code, sortOrder: i })),
  // fuel types
  ...['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid', 'LPG'].map((name, i) => ({
    type: 'fuel_type', name, sortOrder: i,
  })),
  // vehicle types
  ...[
    ['Motorcycle', '2-wheeler'], ['Scooter', '2-wheeler'],
    ['Private Car', '4-wheeler'], ['SUV', '4-wheeler'],
    ['Taxi / Cab', 'commercial'], ['Goods Carrier', 'commercial'],
    ['Bus', 'heavy'], ['Truck', 'heavy'], ['Tractor', 'special'],
  ].map(([name, category], i) => ({ type: 'vehicle_type', name, category, sortOrder: i })),
  // insurance companies
  ...[
    ['HDFC ERGO General Insurance', 'HDFC ERGO'],
    ['ICICI Lombard General Insurance', 'ICICI Lombard'],
    ['Bajaj Allianz General Insurance', 'Bajaj Allianz'],
    ['TATA AIG General Insurance', 'TATA AIG'],
    ['New India Assurance', 'New India'],
    ['Reliance General Insurance', 'Reliance'],
    ['SBI General Insurance', 'SBI General'],
    ['Cholamandalam MS', 'Chola MS'],
    ['Digit Insurance', 'Digit'],
    ['Kotak Mahindra General Insurance', 'Kotak'],
  ].map(([name, shortName], i) => ({ type: 'insurance_company', name, shortName, sortOrder: i })),
  // banks
  ...[
    ['HDFC Bank', 'HDFC'], ['State Bank of India', 'SBI'], ['ICICI Bank', 'ICICI'],
    ['Axis Bank', 'Axis'], ['Kotak Mahindra Bank', 'Kotak'], ['Bajaj Finserv', 'Bajaj'],
    ['Mahindra Finance', 'M&M Fin'], ['Tata Capital', 'Tata Cap'],
  ].map(([name, shortName], i) => ({ type: 'bank', name, shortName, sortOrder: i })),
  // States & cities are seeded via the geography seed script (fetched from countrystatecity.in)
];

const BANKS_DATA = [
  { name: 'HDFC Bank', branch: 'Main Branch', bmName: 'Rohit Sharma', bmContact: '9810001001', executive: 'Amit Kumar' },
  { name: 'State Bank of India', branch: 'City Branch', bmName: 'Priya Patel', bmContact: '9810001002', executive: 'Sunita Rao' },
  { name: 'ICICI Bank', branch: 'Sector 17', bmName: 'Vikram Singh', bmContact: '9810001003', executive: 'Kavya Nair' },
  { name: 'Axis Bank', branch: 'MG Road', bmName: 'Deepak Joshi', bmContact: '9810001004', executive: 'Ravi Kumar' },
  { name: 'Kotak Mahindra Bank', branch: 'Ring Road', bmName: 'Anjali Mehta', bmContact: '9810001005', executive: 'Sanjay Reddy' },
  { name: 'Bajaj Finserv', branch: 'Central', bmName: 'Rahul Verma', bmContact: '9810001006', executive: 'Pooja Iyer' },
  { name: 'IDFC First Bank', branch: 'West Zone', bmName: 'Manish Gupta', bmContact: '9810001007', executive: 'Neha Choudhary' },
  { name: 'Mahindra Finance', branch: 'South Extension', bmName: 'Suresh Babu', bmContact: '9810001008', executive: 'Meena Devi' },
];

const DEALERS_DATA = [
  { name: 'Sunrise Auto Works', contact: '9820002001', location: 'Delhi', address: 'Karol Bagh, New Delhi' },
  { name: 'City Motors Pvt Ltd', contact: '9820002002', location: 'Mumbai', address: 'Andheri East, Mumbai' },
  { name: 'Royal Wheels', contact: '9820002003', location: 'Pune', address: 'Kothrud, Pune' },
  { name: 'National Auto Dealers', contact: '9820002004', location: 'Bangalore', address: 'Whitefield, Bangalore' },
  { name: 'Star Vehicle Finance', contact: '9820002005', location: 'Hyderabad', address: 'Banjara Hills, Hyderabad' },
  { name: 'Prime Autos', contact: '9820002006', location: 'Chennai', address: 'Anna Nagar, Chennai' },
  { name: 'Galaxy Motors', contact: '9820002007', location: 'Jaipur', address: 'C-Scheme, Jaipur' },
  { name: 'Laxmi Auto', contact: '9820002008', location: 'Ahmedabad', address: 'CG Road, Ahmedabad' },
];

const COORDINATORS_DATA = [
  { name: 'Arjun Mehta', phone: '9830003001', email: 'arjun.mehta@saicredit.com', region: 'North Delhi' },
  { name: 'Kavya Reddy', phone: '9830003002', email: 'kavya.reddy@saicredit.com', region: 'Mumbai West' },
  { name: 'Sanjay Kumar', phone: '9830003003', email: 'sanjay.kumar@saicredit.com', region: 'Pune' },
  { name: 'Priti Singh', phone: '9830003004', email: 'priti.singh@saicredit.com', region: 'Bangalore' },
  { name: 'Ravi Teja', phone: '9830003005', email: 'ravi.teja@saicredit.com', region: 'Hyderabad' },
  { name: 'Neha Sharma', phone: '9830003006', email: 'neha.sharma@saicredit.com', region: 'South Delhi' },
];

async function main() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db!;
  const masters = db.collection('masters');
  const users = db.collection('users');
  const banks = db.collection('banks');
  const dealers = db.collection('dealers');
  const coordinators = db.collection('coordinators');

  // Upsert masters by (type, code) — or (type, name) where code is absent.
  let upserts = 0;
  for (const m of MASTERS) {
    const key = m.code ? { type: m.type, code: m.code } : { type: m.type, name: m.name };
    await masters.updateOne(
      key,
      { $set: { ...m, isActive: true, metadata: {}, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true },
    );
    upserts++;
  }
  console.log(`✓ seeded ${upserts} master records`);

  // Bootstrap owner.
  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL ?? 'admin@insurancecrm.local').toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? 'Admin@12345';
  const existing = await users.findOne({ email });
  let systemOwnerId: any;
  if (existing) {
    systemOwnerId = existing._id;
    console.log(`• owner ${email} already exists — skipping`);
  } else {
    const res = await users.insertOne({
      email,
      passwordHash: await bcrypt.hash(password, 12),
      firstName: 'System',
      lastName: 'Owner',
      role: 'owner',
      employeeCode: 'EMP-0001',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    systemOwnerId = res.insertedId;
    console.log(`✓ bootstrap owner → ${email} / ${password}`);
  }

  // Seed named users.
  const NAMED_USERS = [
    {
      email: 'karmansingharora01@gmail.com',
      password: '123456',
      firstName: 'Karman',
      lastName: 'Arora',
      role: 'admin',
      employeeCode: 'EMP-0002',
    },
    {
      email: 'karmansingharora03@gmail.com',
      password: '123456',
      firstName: 'Karman',
      lastName: 'Arora',
      role: 'sales_executive',
      employeeCode: 'EMP-0003',
    },
  ];
  for (const u of NAMED_USERS) {
    const exists = await users.findOne({ email: u.email });
    if (exists) {
      console.log(`• user ${u.email} already exists — skipping`);
    } else {
      await users.insertOne({
        email: u.email,
        passwordHash: await bcrypt.hash(u.password, 12),
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        employeeCode: u.employeeCode,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log(`✓ created user ${u.email} (${u.role})`);
    }
  }

  // Seed banks.
  let bankCount = 0;
  for (const b of BANKS_DATA) {
    const exists = await banks.findOne({ name: b.name });
    if (!exists) {
      await banks.insertOne({ ...b, isActive: true, createdBy: systemOwnerId, createdAt: new Date(), updatedAt: new Date() });
      bankCount++;
    }
  }
  console.log(`✓ seeded ${bankCount} banks (${BANKS_DATA.length - bankCount} already existed)`);

  // Seed dealers.
  let dealerCount = 0;
  for (const d of DEALERS_DATA) {
    const exists = await dealers.findOne({ name: d.name });
    if (!exists) {
      await dealers.insertOne({ ...d, isActive: true, createdBy: systemOwnerId, createdAt: new Date(), updatedAt: new Date() });
      dealerCount++;
    }
  }
  console.log(`✓ seeded ${dealerCount} dealers (${DEALERS_DATA.length - dealerCount} already existed)`);

  // Seed coordinators.
  let coordCount = 0;
  for (const c of COORDINATORS_DATA) {
    const exists = await coordinators.findOne({ name: c.name });
    if (!exists) {
      await coordinators.insertOne({ ...c, isActive: true, createdBy: systemOwnerId, createdAt: new Date(), updatedAt: new Date() });
      coordCount++;
    }
  }
  console.log(`✓ seeded ${coordCount} coordinators (${COORDINATORS_DATA.length - coordCount} already existed)`);

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
