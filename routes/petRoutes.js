const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { getDB } = require('../config/db');
const { verifyToken } = require('../middleware/verifyToken');

// GET /api/pets - Get all available pets with search, filter, sort & pagination
router.get('/', async (req, res) => {
  try {
    const db = getDB();
    const petsCollection = db.collection('pets');

    const { search, species, sort, page = 1, limit = 12 } = req.query;
    
    // শুধু যে পেটগুলো এখনো অ্যাডপ্ট হয়নি সেগুলো দেখাবে
    const query = { adopted: false };

    // সার্চ ফিল্টার (Case-insensitive)
    if (search) {
      query.petName = { $regex: search, $options: 'i' };
    }

    // স্পিসিস ফিল্টার (কমা সেপারেটেড স্ট্রিং হ্যান্ডলিং)
    if (species) {
      const speciesArray = species.split(',').map(s => s.trim());
      query.species = { $in: speciesArray };
    }

    // সর্টিং লজিক (String to Number টাইপ ফিক্সড)
    let sortOption = { createdAt: -1 };
    if (sort === 'age') sortOption = { age: 1 };
    if (sort === 'fee_asc') sortOption = { adoptionFee: 1 };
    if (sort === 'fee_desc') sortOption = { adoptionFee: -1 };
    if (sort === 'name') sortOption = { petName: 1 };

    // পেজিনেশন ভ্যালু পার্স করা
    const parsedPage = Math.max(1, parseInt(page) || 1);
    const parsedLimit = Math.max(1, parseInt(limit) || 12);
    const skip = (parsedPage - 1) * parsedLimit;

    // প্যারালাল এক্সিকিউশন (পারফরম্যান্স বুস্ট)
    const [total, pets] = await Promise.all([
      petsCollection.countDocuments(query),
      petsCollection
        .find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(parsedLimit)
        .toArray()
    ]);

    res.status(200).json({
      pets,
      totalPages: Math.ceil(total / parsedLimit),
      currentPage: parsedPage,
      total,
    });
  } catch (error) {
    console.error('Get pets error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/pets/my - Get logged-in user's pets (private)
router.get('/my', verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const pets = await db
      .collection('pets')
      .find({ ownerEmail: req.user.email })
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json(pets);
  } catch (error) {
    console.error('Get my pets error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/pets/featured - Get latest 6 available pets
router.get('/featured', async (req, res) => {
  try {
    const db = getDB();
    const pets = await db
      .collection('pets')
      .find({ adopted: false }) // শুধুমাত্র যেগুলো এখনো অ্যাডপ্ট হয়নি
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();

    res.status(200).json(pets);
  } catch (error) {
    console.error('Get featured pets error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/pets/:id - Get a single pet with owner info
router.get('/:id', async (req, res) => {
  try {
    const db = getDB();
    const petsCollection = db.collection('pets');

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid pet ID' });
    }

    const pet = await petsCollection.findOne({
      _id: new ObjectId(req.params.id),
    });

    if (!pet) {
      return res.status(404).json({ message: 'Pet not found' });
    }

    // ওনার ডিটেইলস নিয়ে আসা (পাসওয়ার্ড বা সেনসিটিভ ডেটা বাদ দিয়ে)
    const owner = await db.collection('users').findOne(
      { email: pet.ownerEmail },
      { projection: { name: 1, email: 1, photoURL: 1 } }
    );

    res.status(200).json({ ...pet, owner: owner || null });
  } catch (error) {
    console.error('Get pet error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/pets - Add a new pet (private)
router.post('/', verifyToken, async (req, res) => {
  const {
    petName,
    species,
    breed,
    age,
    gender,
    image,
    healthStatus,
    vaccinationStatus,
    location,
    adoptionFee,
    description,
  } = req.body;

  // রিকোয়ার্ড ফিল্ড ভ্যালিডেশন
  if (!petName || !species || !image) {
    return res
      .status(400)
      .json({ message: 'Pet name, species, and image are required' });
  }

  try {
    const db = getDB();
    const petsCollection = db.collection('pets');

    const newPet = {
      petName: petName.trim(),
      species: species.trim(),
      breed: breed ? breed.trim() : '',
      age: age ? Number(age) : 0, // ডেটা টাইপ নাম্বার নিশ্চিত করা
      gender: gender || 'Unknown',
      image,
      healthStatus: healthStatus || 'Unknown',
      vaccinationStatus: vaccinationStatus || 'Unknown',
      location: location ? location.trim() : '',
      adoptionFee: adoptionFee ? Number(adoptionFee) : 0, // ডেটা টাইপ নাম্বার নিশ্চিত করা
      description: description ? description.trim() : '',
      ownerEmail: req.user.email,
      adopted: false,
      createdAt: new Date(),
    };

    const result = await petsCollection.insertOne(newPet);
    res.status(201).json({
      message: 'Pet added successfully',
      pet: { ...newPet, _id: result.insertedId },
    });
  } catch (error) {
    console.error('Add pet error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/pets/:id - Update pet (owner only - Optimized)
router.patch('/:id', verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const petsCollection = db.collection('pets');

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid pet ID' });
    }

    const updateFields = {};
    const allowedFields = [
      'petName',
      'species',
      'breed',
      'age',
      'gender',
      'image',
      'healthStatus',
      'vaccinationStatus',
      'location',
      'adoptionFee',
      'description',
    ];

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        // এজ এবং ফি আপডেট করার সময় নাম্বার টাইপ কাস্টিং
        if (field === 'age' || field === 'adoptionFee') {
          updateFields[field] = Number(req.body[field]);
        } else {
          updateFields[field] = req.body[field];
        }
      }
    });

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ message: 'No fields provided for update' });
    }

    // এক কোয়েরিতেই ওনারশিপ ভেরিফাই এবং আপডেট (DB hit কমাবে)
    const result = await petsCollection.updateOne(
      { 
        _id: new ObjectId(req.params.id), 
        ownerEmail: req.user.email // শুধুমাত্র ওনার নিজেই আপডেট করতে পারবে
      },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ 
        message: 'Pet not found or you do not have permission to update it' 
      });
    }

    if (result.modifiedCount === 0) {
      return res.status(400).json({ message: 'No changes were made' });
    }

    res.status(200).json({ message: 'Pet updated successfully' });
  } catch (error) {
    console.error('Update pet error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/pets/:id - Delete pet (owner only - Optimized)
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const petsCollection = db.collection('pets');

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid pet ID' });
    }

    // এক কোয়েরিতেই ওনারশিপ চেক ও ডিলিট
    const result = await petsCollection.deleteOne({
      _id: new ObjectId(req.params.id),
      ownerEmail: req.user.email // শুধুমাত্র ওনার নিজেই ডিলিট করতে পারবে
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ 
        message: 'Pet not found or you do not have permission to delete it' 
      });
    }

    res.status(200).json({ message: 'Pet deleted successfully' });
  } catch (error) {
    console.error('Delete pet error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;