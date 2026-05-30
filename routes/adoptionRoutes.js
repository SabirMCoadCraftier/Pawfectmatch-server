const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const { getDB } = require('../config/db');
const { verifyToken } = require('../middleware/verifyToken');

// POST /api/adoption-requests - Create adoption request
router.post('/', verifyToken, async (req, res) => {
  const { petId, pickupDate, message } = req.body;

  if (!petId || !pickupDate) {
    return res.status(400).json({ message: 'Pet ID and pickup date are required' });
  }

  if (!ObjectId.isValid(petId)) {
    return res.status(400).json({ message: 'Invalid pet ID' });
  }

  try {
    const db = getDB();
    const requestsCollection = db.collection('adoptionRequests');
    const petsCollection = db.collection('pets');

    const pet = await petsCollection.findOne({ _id: new ObjectId(petId) });

    if (!pet) {
      return res.status(404).json({ message: 'Pet not found' });
    }

    // Prevent self-adoption
    if (pet.ownerEmail === req.user.email) {
      return res.status(400).json({ message: 'You cannot adopt your own pet' });
    }

    // Check if already adopted
    if (pet.adopted) {
      return res.status(400).json({ message: 'This pet has already been adopted' });
    }

    // Check for duplicate pending or approved request
    const existingRequest = await requestsCollection.findOne({
      petId: new ObjectId(petId),
      requesterEmail: req.user.email,
      status: { $in: ['pending', 'approved'] },
    });

    if (existingRequest) {
      return res.status(400).json({ 
        message: 'You already have a pending or approved request for this pet' 
      });
    }

    const newRequest = {
      petId: new ObjectId(petId),
      petName: pet.petName,
      petImage: pet.image,
      requesterEmail: req.user.email,
      requesterName: req.user.name,
      ownerEmail: pet.ownerEmail,
      pickupDate: new Date(pickupDate),
      message: message || '',
      status: 'pending',
      createdAt: new Date(),
    };

    const result = await requestsCollection.insertOne(newRequest);

    res.status(201).json({
      message: 'Adoption request submitted successfully',
      request: { ...newRequest, _id: result.insertedId },
    });
  } catch (error) {
    console.error('Create adoption request error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/adoption-requests/my - Get my requests (as requester)
router.get('/my', verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const requests = await db
      .collection('adoptionRequests')
      .find({ requesterEmail: req.user.email })
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json(requests);
  } catch (error) {
    console.error('Get my requests error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/adoption-requests/pending/:petId - Get all requests for a specific pet (owner only)
router.get('/pending/:petId', verifyToken, async (req, res) => {
  const { petId } = req.params;

  if (!ObjectId.isValid(petId)) {
    return res.status(400).json({ message: 'Invalid pet ID' });
  }

  try {
    const db = getDB();
    
    // একবারে চেক করে নেওয়া যে পেটটি এক্সিস্ট করে এবং রিকোয়েস্টকারীই এর ওনার
    const pet = await db.collection('pets').findOne({ 
      _id: new ObjectId(petId),
      ownerEmail: req.user.email 
    });

    if (!pet) {
      return res.status(404).json({ message: 'Pet not found or unauthorized' });
    }

    const requests = await db
      .collection('adoptionRequests')
      .find({ petId: new ObjectId(petId) })
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json(requests);
  } catch (error) {
    console.error('Get pending requests error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/adoption-requests/my-pets - Get requests for my pets (as owner)
router.get('/my-pets', verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const requests = await db
      .collection('adoptionRequests')
      .find({ ownerEmail: req.user.email })
      .sort({ createdAt: -1 })
      .toArray();

    res.status(200).json(requests);
  } catch (error) {
    console.error('Get my pets requests error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/adoption-requests/:id/approve - Approve request (Atomic & Safe)
router.patch('/:id/approve', verifyToken, async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Invalid request ID' });
  }

  try {
    const db = getDB();
    const requestsCollection = db.collection('adoptionRequests');
    const petsCollection = db.collection('pets');

    // রিকোয়েস্টটি খুঁজে বের করা এবং ওনারশিপ একবারে নিশ্চিত করা
    const request = await requestsCollection.findOne({
      _id: new ObjectId(req.params.id),
      ownerEmail: req.user.email
    });

    if (!request) {
      return res.status(404).json({ message: 'Request not found or unauthorized' });
    }

    // রিকোয়েস্ট অলরেডি পেন্ডিং ছাড়া অন্য স্টেটে থাকলে আটকে দেওয়া
    if (request.status !== 'pending') {
      return res.status(400).json({ message: `Request is already ${request.status}` });
    }

    const pet = await petsCollection.findOne({ _id: new ObjectId(request.petId) });
    if (!pet) {
      return res.status(404).json({ message: 'Associated pet not found' });
    }

    if (pet.adopted) {
      return res.status(400).json({ message: 'This pet has already been adopted by someone else' });
    }

    // ১. কারেন্ট রিকোয়েস্ট Approve করা
    await requestsCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { status: 'approved', updatedAt: new Date() } }
    );

    // ২. বাকি সব পেন্ডিং রিকোয়েস্ট Reject করা
    await requestsCollection.updateMany(
      {
        petId: new ObjectId(request.petId),
        _id: { $ne: new ObjectId(req.params.id) },
        status: 'pending',
      },
      { $set: { status: 'rejected', updatedAt: new Date() } }
    );

    // ৩. পেট কালেকশনে adopted: true মার্ক করা
    await petsCollection.updateOne(
      { _id: new ObjectId(request.petId) },
      { $set: { adopted: true } }
    );

    res.status(200).json({ message: 'Request approved successfully. Other pending requests have been rejected.' });
  } catch (error) {
    console.error('Approve request error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/adoption-requests/:id/reject - Reject request
router.patch('/:id/reject', verifyToken, async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Invalid request ID' });
  }

  try {
    const db = getDB();
    const requestsCollection = db.collection('adoptionRequests');

    // রিকোয়েস্ট ও ওনারশিপ একসাথে চেক
    const request = await requestsCollection.findOne({
      _id: new ObjectId(req.params.id),
      ownerEmail: req.user.email
    });

    if (!request) {
      return res.status(404).json({ message: 'Request not found or unauthorized' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: `Request is already ${request.status}` });
    }

    await requestsCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { status: 'rejected', updatedAt: new Date() } }
    );

    res.status(200).json({ message: 'Request rejected successfully' });
  } catch (error) {
    console.error('Reject request error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/adoption-requests/:id - Delete/cancel request (By Requester)
router.delete('/:id', verifyToken, async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ message: 'Invalid request ID' });
  }

  try {
    const db = getDB();
    const requestsCollection = db.collection('adoptionRequests');

    const request = await requestsCollection.findOne({
      _id: new ObjectId(req.params.id),
      requesterEmail: req.user.email // রিকোয়েস্টকারী নিজে কিনা ভেরিফাই করা
    });

    if (!request) {
      return res.status(404).json({ message: 'Request not found or unauthorized' });
    }

    // অলরেডি অ্যাপ্রুভড হয়ে গেলে রিকোয়েস্ট ডিলিট/ক্যান্সেল করতে দেওয়া যাবে না
    if (request.status === 'approved') {
      return res.status(400).json({ message: 'Cannot cancel an already approved request' });
    }

    await requestsCollection.deleteOne({ _id: new ObjectId(req.params.id) });

    res.status(200).json({ message: 'Adoption request cancelled successfully' });
  } catch (error) {
    console.error('Delete request error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;