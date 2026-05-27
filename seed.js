/**
 * 🐾 Pet Adoption Platform — Database Seeder
 *
 * Seeds the MongoDB database with:
 *   - Admin user (admin@pawfectmatch.com)
 *   - Test user  (jane@pawfectmatch.com)
 *   - 8 sample pets (dogs, cats, birds, rabbits)
 *   - 3 sample adoption requests (pending, approved, rejected)
 *
 * Usage:
 *   npm run seed          — Insert seed data (skips existing users/pets)
 *   npm run seed:force    — Drop all collections first, then seed fresh
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

const SEED_PETS = [
  {
    petName: 'Buddy',
    species: 'Dog',
    breed: 'Golden Retriever',
    age: 3,
    gender: 'Male',
    image: 'https://images.unsplash.com/photo-1552053831-71594a27632d?w=600&h=600&fit=crop',
    healthStatus: 'Vaccinated',
    vaccinationStatus: 'Up to date',
    location: 'New York, NY',
    adoptionFee: 150,
    description: 'Buddy is a friendly and energetic Golden Retriever who loves playing fetch and going on long walks. He is great with children and other pets. Fully house-trained and knows basic commands.',
    ownerEmail: 'jane@pawfectmatch.com',
    adopted: false,
    createdAt: new Date('2025-02-01'),
  },
  {
    petName: 'Luna',
    species: 'Cat',
    breed: 'Siamese',
    age: 2,
    gender: 'Female',
    image: 'https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?w=600&h=600&fit=crop',
    healthStatus: 'Vaccinated',
    vaccinationStatus: 'Up to date',
    location: 'Los Angeles, CA',
    adoptionFee: 100,
    description: 'Luna is a graceful Siamese cat with striking blue eyes. She is calm, affectionate, and enjoys lounging in sunny spots. Loves chin scratches and feather toys.',
    ownerEmail: 'jane@pawfectmatch.com',
    adopted: false,
    createdAt: new Date('2025-02-05'),
  },
  {
    petName: 'Max',
    species: 'Dog',
    breed: 'German Shepherd',
    age: 5,
    gender: 'Male',
    image: 'https://images.unsplash.com/photo-1568572933382-74d440642117?w=600&h=600&fit=crop',
    healthStatus: 'Vaccinated',
    vaccinationStatus: 'Up to date',
    location: 'Chicago, IL',
    adoptionFee: 200,
    description: 'Max is a loyal and intelligent German Shepherd. He is well-trained, protective, and would make an excellent companion for an active family. Knows advanced commands and loves agility training.',
    ownerEmail: 'admin@pawfectmatch.com',
    adopted: false,
    createdAt: new Date('2025-02-10'),
  },
  {
    petName: 'Coco',
    species: 'Bird',
    breed: 'Cockatiel',
    age: 1,
    gender: 'Female',
    image: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?w=600&h=600&fit=crop',
    healthStatus: 'Healthy',
    vaccinationStatus: 'Up to date',
    location: 'Austin, TX',
    adoptionFee: 75,
    description: 'Coco is a cheerful cockatiel who loves to whistle and mimic sounds. She is hand-tamed, enjoys sitting on shoulders, and has a beautiful yellow crest.',
    ownerEmail: 'admin@pawfectmatch.com',
    adopted: false,
    createdAt: new Date('2025-02-15'),
  },
  {
    petName: 'Oreo',
    species: 'Rabbit',
    breed: 'Holland Lop',
    age: 1,
    gender: 'Male',
    image: 'https://images.unsplash.com/photo-1535241749838-299277b6305f?w=600&h=600&fit=crop',
    healthStatus: 'Healthy',
    vaccinationStatus: 'Up to date',
    location: 'Seattle, WA',
    adoptionFee: 50,
    description: 'Oreo is a adorable Holland Lop bunny with floppy ears and a sweet disposition. He is litter-box trained, loves fresh veggies, and enjoys being petted.',
    ownerEmail: 'jane@pawfectmatch.com',
    adopted: true,
    createdAt: new Date('2025-02-20'),
  },
  {
    petName: 'Milo',
    species: 'Cat',
    breed: 'Maine Coon',
    age: 4,
    gender: 'Male',
    image: 'https://images.unsplash.com/photo-1574158622682-e40e69881006?w=600&h=600&fit=crop',
    healthStatus: 'Vaccinated',
    vaccinationStatus: 'Up to date',
    location: 'Denver, CO',
    adoptionFee: 120,
    description: 'Milo is a majestic Maine Coon with a fluffy coat and a gentle personality. He is great with dogs and children. Loves to follow you around the house and "help" with chores.',
    ownerEmail: 'admin@pawfectmatch.com',
    adopted: false,
    createdAt: new Date('2025-03-01'),
  },
  {
    petName: 'Daisy',
    species: 'Dog',
    breed: 'Beagle',
    age: 2,
    gender: 'Female',
    image: 'https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=600&h=600&fit=crop',
    healthStatus: 'Vaccinated',
    vaccinationStatus: 'Up to date',
    location: 'Portland, OR',
    adoptionFee: 130,
    description: 'Daisy is a curious and playful Beagle with an adorable howl. She has a great sense of smell and loves puzzle toys. Perfect for an active family who enjoys outdoor adventures.',
    ownerEmail: 'jane@pawfectmatch.com',
    adopted: false,
    createdAt: new Date('2025-03-05'),
  },
  {
    petName: 'Hammy',
    species: 'Other',
    breed: 'Syrian Hamster',
    age: 0,
    gender: 'Male',
    image: 'https://images.unsplash.com/photo-1559072356-bd95e58e0db0?w=600&h=600&fit=crop',
    healthStatus: 'Healthy',
    vaccinationStatus: 'Not required',
    location: 'Miami, FL',
    adoptionFee: 20,
    description: 'Hammy is a tiny Syrian hamster full of energy. He loves his exercise wheel, building nests, and stuffing his cheeks with treats. Comes with a starter cage and accessories.',
    ownerEmail: 'admin@pawfectmatch.com',
    adopted: false,
    createdAt: new Date('2025-03-10'),
  },
];

const SEED_REQUESTS = [
  {
    requesterName: 'Admin User',
    requesterEmail: 'admin@pawfectmatch.com',
    petName: 'Buddy',
    ownerEmail: 'jane@pawfectmatch.com',
    pickupDate: new Date('2025-04-15'),
    message: 'I have a large fenced yard and another Golden Retriever who would love a playmate!',
    status: 'pending',
    createdAt: new Date('2025-03-20'),
  },
  {
    requesterName: 'Jane Foster',
    requesterEmail: 'jane@pawfectmatch.com',
    petName: 'Milo',
    ownerEmail: 'admin@pawfectmatch.com',
    pickupDate: new Date('2025-04-20'),
    message: 'We are a cat-loving family and Milo seems like the perfect fit!',
    status: 'approved',
    createdAt: new Date('2025-03-22'),
    updatedAt: new Date('2025-03-25'),
  },
  {
    requesterName: 'Jane Foster',
    requesterEmail: 'jane@pawfectmatch.com',
    petName: 'Coco',
    ownerEmail: 'admin@pawfectmatch.com',
    pickupDate: new Date('2025-04-10'),
    message: 'I have experience caring for birds and would love to give Coco a home.',
    status: 'rejected',
    createdAt: new Date('2025-03-18'),
    updatedAt: new Date('2025-03-19'),
  },
];

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
          console.log(`  ✅ Exists   → ${user.email}`);
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
        console.log(`  ✅ Exists   → ${petData.petName}`);
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
        console.log(`  ✅ Exists   → Request for ${reqData.petName}`);
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
