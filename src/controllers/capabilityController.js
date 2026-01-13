const Capability = require('../models/Capability');
const createError = require('http-errors');
const { audit } = require('../utils/audit');
const { validationResult } = require('express-validator');

// GET /capabilities - list all capabilities
exports.getCapabilities = async (req, res, next) => {
  try {
    const { category } = req.query;
    const filter = category ? { category } : {};
    
    const capabilities = await Capability.find(filter)
      .sort({ category: 1, name: 1 });
    
    await audit({ 
      action: 'capabilities.list', 
      entityType: 'Capability', 
      status: 'success',
      metadata: { count: capabilities.length, filter }
    }, req);
    
    res.json(capabilities);
  } catch (error) {
    await audit({ 
      action: 'capabilities.list', 
      status: 'error', 
      metadata: { message: error.message } 
    }, req);
    next(error);
  }
};

// GET /capabilities/:id - get a single capability
exports.getCapability = async (req, res, next) => {
  try {
    const { id } = req.params;
    const capability = await Capability.findById(id);
    
    if (!capability) {
      return next(createError(404, 'Capability not found'));
    }
    
    await audit({ 
      action: 'capabilities.read', 
      entityType: 'Capability', 
      entityId: id,
      status: 'success'
    }, req);
    
    res.json(capability);
  } catch (error) {
    await audit({ 
      action: 'capabilities.read', 
      status: 'error', 
      metadata: { message: error.message } 
    }, req);
    next(error);
  }
};

// POST /capabilities - create a new capability
exports.createCapability = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }
    
    const { name, description, category } = req.body;
    
    if (!name) {
      return next(createError(400, 'Capability name is required'));
    }
    
    const exists = await Capability.findOne({ name });
    if (exists) {
      return next(createError(409, 'Capability already exists'));
    }
    
    // Generate slug from name
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]/g, '');
    
    const capability = await Capability.create({ 
      name,
      slug,
      description,
      category: category || 'other'
    });
    
    await audit({ 
      action: 'capabilities.create', 
      entityType: 'Capability', 
      entityId: capability._id,
      status: 'success',
      metadata: { name: capability.name }
    }, req);
    
    res.status(201).json(capability);
  } catch (error) {
    await audit({ 
      action: 'capabilities.create', 
      status: 'error', 
      metadata: { message: error.message } 
    }, req);
    next(error);
  }
};

// PUT /capabilities/:id - update a capability
exports.updateCapability = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }
    
    const { id } = req.params;
    const { name, description, category } = req.body;
    
    const capability = await Capability.findById(id);
    if (!capability) {
      return next(createError(404, 'Capability not found'));
    }
    
    // Check for name conflict if name is being changed
    if (name && name !== capability.name) {
      const exists = await Capability.findOne({ name, _id: { $ne: id } });
      if (exists) {
        return next(createError(409, 'Another capability with this name already exists'));
      }
      
      capability.name = name;
      capability.slug = name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]/g, '');
    }
    
    if (description !== undefined) capability.description = description;
    if (category) capability.category = category;
    
    await capability.save();
    
    await audit({ 
      action: 'capabilities.update', 
      entityType: 'Capability', 
      entityId: id,
      status: 'success',
      metadata: { name: capability.name }
    }, req);
    
    res.json(capability);
  } catch (error) {
    await audit({ 
      action: 'capabilities.update', 
      entityType: 'Capability',
      entityId: req.params.id,
      status: 'error', 
      metadata: { message: error.message } 
    }, req);
    next(error);
  }
};

// DELETE /capabilities/:id - delete a capability
exports.deleteCapability = async (req, res, next) => {
  try {
    const { id } = req.params;
    const capability = await Capability.findByIdAndDelete(id);
    
    if (!capability) {
      return next(createError(404, 'Capability not found'));
    }
    
    await audit({ 
      action: 'capabilities.delete', 
      entityType: 'Capability', 
      entityId: id,
      status: 'success',
      metadata: { name: capability.name }
    }, req);
    
    res.json({ message: 'Capability deleted', id });
  } catch (error) {
    await audit({ 
      action: 'capabilities.delete', 
      entityType: 'Capability',
      entityId: req.params.id,
      status: 'error', 
      metadata: { message: error.message } 
    }, req);
    next(error);
  }
};
