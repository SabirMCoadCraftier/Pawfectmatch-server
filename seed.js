/**
 * 🐾 Pet Adoption Platform — Database Seeder
 *
 * Seeds the MongoDB database with:
 * - Admin user (admin@pawfectmatch.com)
 * - Test user  (jane@pawfectmatch.com)
 * - 0 sample pets (Clean database)
 * - 0 sample adoption requests (Clean database)
 *
 * Usage:
 * npm run seed        — Insert seed data (skips existing users/pets)
 * npm run seed:force  — Drop all collections first, then seed fresh
 *
 * Note: Users must first sign up via Firebase Auth with the matching email.
 * The seed script only creates the MongoDB user documents with correct roles.
 */

require('dotenv').config();
const { connectDB } = require('./config/db');

// ─── Environment validation ────────────────────────────────
const requiredVars = ['DB_NAME'];
const missing = requiredVars.filter((v) => !process.env[v]);
if (missing.length > 0) {
  console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
  console.error('   Make sure your server/.env file is configured correctly.');
  process.exit(1);
}

// ──────────────────────────── DATA ────────────────────────────

const SEED_USERS = [
  {
    email: 'admin@pawfectmatch.com',
    name: 'Admin User',
    photoURL: 'https://ui-avatars.com/api/?name=Admin+User&background=8b5cf6&color=fff',
    role: 'admin',
    createdAt: new Date('2025-01-01'),
  },
  {
    email: 'jane@pawfectmatch.com',
    name: 'Jane Foster',
    photoURL: 'https://ui-avatars.com/api/?name=Jane+Foster&background=f472b6&color=fff',
    role: 'user',
    createdAt: new Date('2025-01-15'),
  },
];

// Removed dummy pets for a clean start
const SEED_PETS = [];

// Removed dummy adoption requests for a clean start
const SEED_REQUESTS = [];

// ──────────────────────────── SEED LOGIC ────────────────────────────

async function seed() {
  const force = process.argv.includes('--force') || process.argv.includes('-f');

  try {
    console.log('\n🔌 Connecting to MongoDB...');
    const db = await connectDB();
    console.log(`✅ Connected to database: ${db.databaseName}\n`);

    // ── Drop existing data (force mode) ──
    if (force) {
      console.log('⚠️  Force mode enabled — dropping all existing data...\n');
      await db.collection('users').deleteMany({});
      await db.collection('pets').deleteMany({});
      await db.collection('adoptionRequests').deleteMany({});
      console.log('✅ All collections cleared\n');
    }

    const adminEmail = SEED_USERS[0].email;

    // ── Users ──
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  👤 Seeding Users');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const usersCollection = db.collection('users');

    for (const user of SEED_USERS) {
      const existing = await usersCollection.findOne({ email: user.email });
      if (!existing) {
        await usersCollection.insertOne(user);
        console.log(`  ✨ Created  → ${user.email} (${user.role})`);
      } else {
        // Ensure existing user has the correct role
        if (existing.role !== user.role) {
          await usersCollection.updateOne({ email: user.email }, { $set: { role: user.role } });
          console.log(`  🔄 Updated  → ${user.email} (role → ${user.role})`);
        } else {
          console.log(`  ✅ Exists    → ${user.email}`);
        }
      }
    }

    // ── Pets ──
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  🐾 Seeding Pets');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const petsCollection = db.collection('pets');

    for (const petData of SEED_PETS) {
      const existing = await petsCollection.findOne({
        petName: petData.petName,
        ownerEmail: petData.ownerEmail,
      });

      if (!existing) {
        await petsCollection.insertOne(petData);
        const ownerLabel = petData.ownerEmail === adminEmail ? 'Admin' : 'User';
        console.log(`  ✨ Created  → ${petData.petName} (${petData.species}, ${ownerLabel})`);
      } else {
        console.log(`  ✅ Exists    → ${petData.petName}`);
      }
    }

    // ── Adoption Requests ──
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  📋 Seeding Adoption Requests');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Resolve pet references using composite key (ownerEmail + petName)
    const allPets = await petsCollection.find({}).toArray();
    const petByKey = {};
    for (const p of allPets) {
      petByKey[`${p.ownerEmail}|${p.petName}`] = p;
    }

    const requestsCollection = db.collection('adoptionRequests');

    for (const reqData of SEED_REQUESTS) {
      const petKey = `${reqData.ownerEmail}|${reqData.petName}`;
      const pet = petByKey[petKey];

      if (!pet) {
        console.log(`  ⚠️  Skipped  → Request for "${reqData.petName}" (pet not found)`);
        continue;
      }

      const requestDoc = {
        petId: pet._id.toString(),
        petName: reqData.petName,
        petImage: pet.image,
        requesterName: reqData.requesterName,
        requesterEmail: reqData.requesterEmail,
        ownerEmail: reqData.ownerEmail,
        pickupDate: reqData.pickupDate,
        message: reqData.message || '',
        status: reqData.status,
        createdAt: reqData.createdAt,
      };

      if (reqData.updatedAt) {
        requestDoc.updatedAt = reqData.updatedAt;
      }

      const existing = await requestsCollection.findOne({
        requesterEmail: requestDoc.requesterEmail,
        petId: requestDoc.petId,
      });

      if (!existing) {
        await requestsCollection.insertOne(requestDoc);
        const requester = reqData.requesterName.split(' ')[0];
        console.log(`  ✨ Created  → ${requester} → ${reqData.petName} (${reqData.status})`);
      } else {
        console.log(`  ✅ Exists    → Request for ${reqData.petName}`);
      }
    }

    // ── Summary ──
    const userCount = await usersCollection.countDocuments();
    const petCount = await petsCollection.countDocuments();
    const requestCount = await requestsCollection.countDocuments();

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  📊 Seed Summary');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  👤 Users:              ${userCount}`);
    console.log(`  🐾 Pets:               ${petCount}`);
    console.log(`  📋 Adoption Requests:  ${requestCount}`);
    console.log('──────────────────────────────────────────');
    console.log('\n  🔑 Admin login:  admin@pawfectmatch.com');
    console.log('      (Sign up via Firebase Auth with this email first)');
    console.log('  🔑 Test login:   jane@pawfectmatch.com');
    console.log('      (Sign up via Firebase Auth with this email first)');
    console.log('\n✅ Seeding complete!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Seed failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

seed();