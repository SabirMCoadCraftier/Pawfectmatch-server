const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { getDB } = require('../config/db');
const { verifyToken, verifyAdmin } = require('../middleware/verifyToken');

// All admin routes require both verifyToken and verifyAdmin
router.use(verifyToken, verifyAdmin);

// ==================== DASHBOARD STATS ====================

// GET /api/admin/stats - Get dashboard statistics
router.get('/stats', async (req, res) => {
  try {
    const db = getDB();

    const totalUsers = await db.collection('users').countDocuments();
    const totalPets = await db.collection('pets').countDocuments();
    const totalAdopted = await db
      .collection('pets')
      .countDocuments({ adopted: true });
    const totalAvailable = await db
      .collection('pets')
      .countDocuments({ adopted: false });
    const totalRequests = await db
      .collection('adoptionRequests')
      .countDocuments();
    const pendingRequests = await db
      .collection('adoptionRequests')
      .countDocuments({ status: 'pending' });
    const approvedRequests = await db
      .collection('adoptionRequests')
      .countDocuments({ status: 'approved' });
    const rejectedRequests = await db
      .collection('adoptionRequests')
      .countDocuments({ status: 'rejected' });

    // Pets by species
    const petsBySpecies = await db
      .collection('pets')
      .aggregate([
        { $group: { _id: '$species', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ])
      .toArray();

    // Recent activity (last 10 requests)
    const recentRequests = await db
      .collection('adoptionRequests')
      .find()
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    res.status(200).json({
      totalUsers,
      totalPets,
      totalAdopted,
      totalAvailable,
      totalRequests,
      pendingRequests,
      approvedRequests,
      rejectedRequests,
      petsBySpecies,
      recentRequests,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ==================== USER MANAGEMENT ====================

// GET /api/admin/users - Get all users
router.get('/users', async (req, res) => {
  const { page = 1, limit = 20, search } = req.query;

  try {
    const db = getDB();
    const usersCollection = db.collection('users');

    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await usersCollection.countDocuments(query);
    const users = await usersCollection
      .find(query)
      .project({ _id: 0, email: 1, name: 1, photoURL: 1, role: 1, createdAt: 1 })
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .toArray();

    res.status(200).json({
      users,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      total,
    });
  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/admin/users/:email/role - Update user role
router.patch('/users/:email/role', async (req, res) => {
  const { role } = req.body;

  if (!role || !['user', 'admin'].includes(role)) {
    return res.status(400).json({ message: 'Invalid role. Must be "user" or "admin"' });
  }

  try {
    const db = getDB();
    const usersCollection = db.collection('users');

    // Prevent self-demotion
    if (req.params.email === req.user.email && role !== 'admin') {
      return res.status(400).json({ message: 'You cannot demote yourself' });
    }

    const result = await usersCollection.updateOne(
      { email: req.params.email },
      { $set: { role } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ message: `User role updated to ${role}` });
  } catch (error) {
    console.error('Admin update role error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/admin/users/:email - Delete user
router.delete('/users/:email', async (req, res) => {
  try {
    const db = getDB();

    // Prevent self-deletion
    if (req.params.email === req.user.email) {
      return res.status(400).json({ message: 'You cannot delete yourself' });
    }

    const result = await db.collection('users').deleteOne({ email: req.params.email });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Admin delete user error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ==================== PET MANAGEMENT ====================

// GET /api/admin/pets - Get all pets (admin view)
router.get('/pets', async (req, res) => {
  const { page = 1, limit = 20, search, species, adopted } = req.query;

  try {
    const db = getDB();
    const petsCollection = db.collection('pets');

    const query = {};
    if (search) {
      query.petName = { $regex: search, $options: 'i' };
    }
    if (species) {
      query.species = species;
    }
    if (adopted !== undefined) {
      query.adopted = adopted === 'true';
    }

    const total = await petsCollection.countDocuments(query);
    const pets = await petsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .toArray();

    res.status(200).json({
      pets,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      total,
    });
  } catch (error) {
    console.error('Admin get pets error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/admin/pets/:id - Update any pet (admin)
router.patch('/pets/:id', async (req, res) => {
  try {
    const db = getDB();
    const petsCollection = db.collection('pets');

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid pet ID' });
    }

    const allowedFields = [
      'petName', 'species', 'breed', 'age', 'gender', 'image',
      'healthStatus', 'vaccinationStatus', 'location', 'adoptionFee',
      'description', 'adopted',
    ];

    const updateFields = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateFields[field] = req.body[field];
      }
    });

    const result = await petsCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ message: 'Pet not found' });
    }

    res.status(200).json({ message: 'Pet updated successfully' });
  } catch (error) {
    console.error('Admin update pet error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/admin/pets/:id - Delete any pet (admin)
router.delete('/pets/:id', async (req, res) => {
  try {
    const db = getDB();

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid pet ID' });
    }

    const result = await db.collection('pets').deleteOne({
      _id: new ObjectId(req.params.id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Pet not found' });
    }

    res.status(200).json({ message: 'Pet deleted successfully' });
  } catch (error) {
    console.error('Admin delete pet error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// ==================== ADOPTION REQUEST MANAGEMENT ====================

// GET /api/admin/adoption-requests - Get all adoption requests
router.get('/adoption-requests', async (req, res) => {
  const { page = 1, limit = 20, status, search } = req.query;

  try {
    const db = getDB();
    const requestsCollection = db.collection('adoptionRequests');

    const query = {};
    if (status) {
      query.status = status;
    }
    if (search) {
      query.$or = [
        { requesterName: { $regex: search, $options: 'i' } },
        { requesterEmail: { $regex: search, $options: 'i' } },
        { petName: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await requestsCollection.countDocuments(query);
    const requests = await requestsCollection
      .find(query)
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .toArray();

    res.status(200).json({
      requests,
      totalPages: Math.ceil(total / parseInt(limit)),
      currentPage: parseInt(page),
      total,
    });
  } catch (error) {
    console.error('Admin get requests error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/admin/adoption-requests/:id/approve - Approve any request (admin override)
router.patch('/adoption-requests/:id/approve', async (req, res) => {
  try {
    const db = getDB();
    const requestsCollection = db.collection('adoptionRequests');
    const petsCollection = db.collection('pets');

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid request ID' });
    }

    const request = await requestsCollection.findOne({
      _id: new ObjectId(req.params.id),
    });

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (request.status === 'approved') {
      return res.status(400).json({ message: 'Request is already approved' });
    }

    // Check pet adoption status
    const pet = await petsCollection.findOne({ _id: new ObjectId(request.petId) });
    if (pet && pet.adopted) {
      return res.status(400).json({ message: 'This pet has already been adopted' });
    }

    // Approve the request
    await requestsCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { status: 'approved', updatedAt: new Date() } }
    );

    // Reject all other pending requests for this pet
    await requestsCollection.updateMany(
      {
        petId: request.petId,
        _id: { $ne: new ObjectId(req.params.id) },
        status: 'pending',
      },
      { $set: { status: 'rejected', updatedAt: new Date() } }
    );

    // Mark pet as adopted
    if (pet) {
      await petsCollection.updateOne(
        { _id: new ObjectId(request.petId) },
        { $set: { adopted: true } }
      );
    }

    res.status(200).json({ message: 'Request approved by admin' });
  } catch (error) {
    console.error('Admin approve request error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/admin/adoption-requests/:id/reject - Reject any request (admin)
router.patch('/adoption-requests/:id/reject', async (req, res) => {
  try {
    const db = getDB();
    const requestsCollection = db.collection('adoptionRequests');

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid request ID' });
    }

    const request = await requestsCollection.findOne({
      _id: new ObjectId(req.params.id),
    });

    if (!request) {
      return res.status(404).json({ message: 'Request not found' });
    }

    await requestsCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { status: 'rejected', updatedAt: new Date() } }
    );

    res.status(200).json({ message: 'Request rejected by admin' });
  } catch (error) {
    console.error('Admin reject request error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/admin/adoption-requests/:id - Delete any request (admin)
router.delete('/adoption-requests/:id', async (req, res) => {
  try {
    const db = getDB();

    if (!ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid request ID' });
    }

    const result = await db.collection('adoptionRequests').deleteOne({
      _id: new ObjectId(req.params.id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Request not found' });
    }

    res.status(200).json({ message: 'Request deleted successfully' });
  } catch (error) {
    console.error('Admin delete request error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
