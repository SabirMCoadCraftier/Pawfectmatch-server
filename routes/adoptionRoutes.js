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

  try {
    const db = getDB();
    const requestsCollection = db.collection('adoptionRequests');
    const petsCollection = db.collection('pets');

    if (!ObjectId.isValid(petId)) {
      return res.status(400).json({ message: 'Invalid pet ID' });
    }

    const pet = await petsCollection.findOne({ _id: new ObjectId(petId) });

    if (!pet) {
      return res.status(404).json({ message: 'Pet not found' });
    }

    // Prevent self-adoption
    if (pet.ownerEmail === req.user.email) {
      return res
        .status(400)
        .json({ message: 'You cannot adopt your own pet' });
    }

    // Check if already adopted
    if (pet.adopted) {
      return res
        .status(400)
        .json({ message: 'This pet has already been adopted' });
    }

    // Check for duplicate pending request
    const existingRequest = await requestsCollection.findOne({
      petId,
      requesterEmail: req.user.email,
      status: { $in: ['pending', 'approved'] },
    });

    if (existingRequest) {
      return res
        .status(400)
        .json({ message: 'You already have a pending or approved request for this pet' });
    }

    const newRequest = {
      petId,
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

// GET /api/adoption-requests/pending/:petId - Get pending requests for a pet (owner only)
router.get('/pending/:petId', verifyToken, async (req, res) => {
  try {
    const db = getDB();
    const { petId } = req.params;

    const pet = await db.collection('pets').findOne({ _id: new ObjectId(petId) });

    if (!pet) {
      return res.status(404).json({ message: 'Pet not found' });
    }

    if (pet.ownerEmail !== req.user.email) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const requests = await db
      .collection('adoptionRequests')
      .find({ petId, status: { $in: ['pending', 'approved', 'rejected'] } })
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

// PATCH /api/adoption-requests/:id/approve - Approve request
router.patch('/:id/approve', verifyToken, async (req, res) => {
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

    // Verify ownership
    const pet = await petsCollection.findOne({ _id: new ObjectId(request.petId) });
    if (!pet || pet.ownerEmail !== req.user.email) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Check if already adopted
    if (pet.adopted) {
      return res
        .status(400)
        .json({ message: 'This pet has already been adopted' });
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
    await petsCollection.updateOne(
      { _id: new ObjectId(request.petId) },
      { $set: { adopted: true } }
    );

    res.status(200).json({ message: 'Request approved successfully' });
  } catch (error) {
    console.error('Approve request error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// PATCH /api/adoption-requests/:id/reject - Reject request
router.patch('/:id/reject', verifyToken, async (req, res) => {
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

    // Verify ownership
    const pet = await db.collection('pets').findOne({ _id: new ObjectId(request.petId) });
    if (!pet || pet.ownerEmail !== req.user.email) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    await requestsCollection.updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { status: 'rejected', updatedAt: new Date() } }
    );

    res.status(200).json({ message: 'Request rejected' });
  } catch (error) {
    console.error('Reject request error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// DELETE /api/adoption-requests/:id - Delete/cancel request
router.delete('/:id', verifyToken, async (req, res) => {
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

    // Only the requester can cancel their request
    if (request.requesterEmail !== req.user.email) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    if (request.status === 'approved') {
      return res
        .status(400)
        .json({ message: 'Cannot cancel an approved request' });
    }

    await requestsCollection.deleteOne({ _id: new ObjectId(req.params.id) });

    res.status(200).json({ message: 'Request cancelled successfully' });
  } catch (error) {
    console.error('Delete request error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
