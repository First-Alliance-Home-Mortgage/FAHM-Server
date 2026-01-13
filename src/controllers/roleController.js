const Role = require('../models/Role');
const Capability = require('../models/Capability');
const createError = require('http-errors');

// GET /roles - list all roles
exports.getRoles = async (req, res, next) => {
  try {
    const roles = await Role.find()
      .populate('capabilities')
      .sort({ name: 1 });
    res.json(roles);
  } catch (error) {
    next(error);
  }
};

// POST /roles - create a new role
exports.createRole = async (req, res, next) => {
  try {
    const { name, capabilities } = req.body;
    if (!name) return next(createError(400, 'Role name is required'));

    const exists = await Role.findOne({ name: name.toLowerCase() });
    if (exists) return next(createError(409, 'Role already exists'));

    // Validate capabilities
    if (capabilities && !Array.isArray(capabilities)) {
      return next(createError(400, 'Capabilities must be an array'));
    }

    const validCapabilities = await Capability.find({ _id: { $in: capabilities } });
    if (capabilities && validCapabilities.length !== capabilities.length) {
      return next(createError(400, 'Some capabilities are invalid'));
    }

    // Generate slug from name
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^\w-]/g, '');

    const role = await Role.create({ 
      name: name.toLowerCase(),
      slug,
      capabilities: validCapabilities.map(cap => cap._id)
    });

    res.status(201).json(role);
  } catch (error) {
    next(error);
  }
};

// PUT /roles/:id - update a role
exports.updateRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, capabilities } = req.body;

    if (!name) return next(createError(400, 'Role name is required'));

    const role = await Role.findById(id);
    if (!role) return next(createError(404, 'Role not found'));

    // Check for name conflict
    const exists = await Role.findOne({ name: name, _id: { $ne: id } });
    if (exists) return next(createError(409, 'Another role with this name already exists'));

    // Validate capabilities
    if (capabilities && !Array.isArray(capabilities)) {
      return next(createError(400, 'Capabilities must be an array'));
    }

    const validCapabilities = await Capability.find({ _id: { $in: capabilities } });
    if (capabilities && validCapabilities.length !== capabilities.length) {
      return next(createError(400, 'Some capabilities are invalid'));
    }

    // Update name, slug, and capabilities
    role.name = name;
    role.slug = name
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^\w-]/g, '');
    role.capabilities = validCapabilities.map(cap => cap._id);

    await role.save();
    res.json(role);
  } catch (error) {
    next(error);
  }
};

// DELETE /roles/:id - delete a role
exports.deleteRole = async (req, res, next) => {
  try {
    const { id } = req.params;
    const role = await Role.findByIdAndDelete(id);
    if (!role) return next(createError(404, 'Role not found'));
    res.json({ message: 'Role deleted', id });
  } catch (error) {
    next(error);
  }
};
