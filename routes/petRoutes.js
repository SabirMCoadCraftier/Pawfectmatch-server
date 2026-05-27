const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { getDB } = require('../config/db');
const { verifyToken } = require('../middleware/verifyToken');

// GET /api/pets - Get all pets with search, filter, sort
router.get('/', async (req, res) => {
  const { search, species, sort, page = 1, limit = 12 } = req.query;

  try {
    const db = getDB();
    const petsCollection = db.collection('pets');

    const query = {};

    if (search) {
      query.petName = { $regex: search, $options: 'i' };
    }

    if (species) {
      const speciesArray = species.split(',');
      query.species = { $in: speciesArray };
    }

    let sortOption = { createdAt: -1 };
    if (sort === 'age') sortOption = { age: 1 };
    if (sort === 'fee_asc') sortOption = { adoptionFee: 1 };
    if (sort === 'fee_desc') sortOption = { adoptionFee: -1 };
    if (sort === 'name') sortOption = { petName: 1 };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await petsCollection.countDocuments(query);

    const pets = await petsCollection
      .find(query)
      .sort(sortOption)
      .skip(skip)
      .limit(parseInt(limit))
      .toArray();

    res.status(200).json({
      pets,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      total,
    });
  } catch (error) {
    console.error('Get pets error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/pets/my - Get my pets (private)
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

// GET /api/pets/featured - Get featured pets (latest 6)
router.get('/featured', async (req, res) => {
  try {
    const db = getDB();
    const pets = await db
      .collection('pets')
      .find({})
      .sort({ createdAt: -1 })
      .limit(6)
      .toArray();

    res.status(200).json(pets);
  } catch (error) {
    console.error('Get featured pets error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/pets/:id - Get single pet
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

    // Get owner info
    const owner = await db.collection('users').findOne(
      { email: pet.ownerEmail },
      { projection: { name: 1, email: 1, photoURL: 1 } }
    );

    res.status(200).json({ ...pet, owner });
  } catch (error) {
    console.error('Get pet error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/pets - Add new pet (private)
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

  if (!petName || !species || !image) {
    return res
      .status(400)
      .json({ message: 'Pet name, species, and image are required' });
  }

  try {
    const db = getDB();
    const petsCollection = db.collection('pets');

    const newPet = {
      petName,
      species,
      breed: breed || '',
      age: age || 0,
      gender: gender || 'Unknown',
      image,
      healthStatus: healthStatus || 'Unknown',
      vaccinationStatus: vaccinationStatus || 'Unknown',
      location: location || '',
      adoptionFee: adoptionFee || 0,
      description: description || '',
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

// PATCH /api/pets/:id - Update pet (owner only)
router.patch('/:id', verifyToken, async (req, res) => {
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

    if (pet.ownerEmail !== req.user.email) {
      return res
        .status(403)
        .json({ message: 'You can only update your own pets' });
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
        updateFields[field] = req.body[field];
      }
    });

    const result = await petsCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: updateFields }
    );

    if (result.modifiedCount === 0) {
      return res.status(400).json({ message: 'No changes made' });
    }

    res.status(200).json({ message: 'Pet updated successfully' });
  } catch (error) {
    console.error('Update pet error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/pets/:id - Delete pet (owner only)
router.delete('/:id', verifyToken, async (req, res) => {
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

    if (pet.ownerEmail !== req.user.email) {
      return res
        .status(403)
        .json({ message: 'You can only delete your own pets' });
    }

    await petsCollection.deleteOne({ _id: new ObjectId(req.params.id) });

    res.status(200).json({ message: 'Pet deleted successfully' });
  } catch (error) {
    console.error('Delete pet error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
