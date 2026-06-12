/**
 * One-off script: creates the two named users if they don't already exist.
 * Run: NODE_OPTIONS='--experimental-global-webcrypto' npx tsx src/database/create-users.ts
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import * as bcrypt from 'bcryptjs';

const MONGODB_URI =
  process.env.MONGODB_URI ?? 'mongodb://localhost:27017/insurance_crm';

const USERS = [
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

async function main() {
  await mongoose.connect(MONGODB_URI);
  const users = mongoose.connection.db!.collection('users');

  for (const u of USERS) {
    const existing = await users.findOne({ email: u.email });
    if (existing) {
      console.log(`• ${u.email} already exists — skipping`);
      continue;
    }
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
    console.log(`✓ created ${u.email}  (${u.role})`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
