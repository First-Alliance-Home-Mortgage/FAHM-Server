jest.mock('../../src/models/Document');
jest.mock('../../src/utils/audit', () => ({ audit: jest.fn() }));
jest.mock('express-validator', () => ({
  validationResult: jest.fn(),
}));

// ...existing code...
const Document = require('../../src/models/Document');
const { audit } = require('../../src/utils/audit');
const { validationResult } = require('express-validator');
const documentController = require('../../src/controllers/documentController');

const makeRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};
const makeNext = () => jest.fn();

describe('documentController.upload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    validationResult.mockReturnValue({ isEmpty: () => true });
  });

  it('rejects unsupported file type', async () => {
    const req = { body: { type: 'exe', size: 100, loan: 'l1', name: 'bad', url: 'u', hash: 'h' } };
    const res = makeRes();
    const next = makeNext();

    await documentController.upload(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err.status).toBe(400);
    expect(err.message).toContain('Unsupported file type');
  });

  it('returns existing document for duplicate hash', async () => {
    const existing = { _id: 'd1' };
    const req = {
      body: { loan: 'l1', name: 'doc', type: 'pdf', url: 'u', size: 100, hash: 'hash1' },
      user: { _id: 'u1' },
    };
    const res = makeRes();
    const next = makeNext();
    Document.findOne.mockResolvedValue(existing);

    await documentController.upload(req, res, next);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(existing);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'document.upload.duplicate', entityId: 'd1' }),
      req,
    );
    expect(Document.create).not.toHaveBeenCalled();
  });

  it('creates document and audits on success', async () => {
    const req = {
      body: { loan: 'l1', name: 'doc', type: 'pdf', url: 'u', size: 100, hash: 'hash1' },
      user: { _id: 'u1' },
    };
    const res = makeRes();
    const next = makeNext();
    Document.findOne.mockResolvedValue(null);
    const created = { _id: 'd2' };
    Document.create.mockResolvedValue(created);

    await documentController.upload(req, res, next);

    expect(Document.create).toHaveBeenCalledWith(expect.objectContaining({
      loan: 'l1',
      uploadedBy: 'u1',
      name: 'doc',
      type: 'pdf',
      url: 'u',
      size: 100,
      hash: 'hash1',
      status: 'pending',
    }));
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(created);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'document.upload', entityId: 'd2' }),
      req,
    );
  });
});

describe('documentController.listForLoan', () => {
  it('returns documents for loan', async () => {
    const docs = [{ _id: 'd1' }];
    const req = { params: { loanId: 'l1' } };
    const res = makeRes();
    Document.find.mockReturnValue({ populate: jest.fn().mockResolvedValue(docs) });

    await documentController.listForLoan(req, res, jest.fn());

    expect(res.json).toHaveBeenCalledWith(docs);
  });
});

describe('documentController.markSynced', () => {
  it('marks document as synced', async () => {
    const doc = { _id: 'd1', status: 'pending', loan: 'l1', save: jest.fn().mockResolvedValue() };
    const req = { params: { id: 'd1' } };
    const res = makeRes();
    const next = makeNext();
    Document.findById.mockResolvedValue(doc);

    await documentController.markSynced(req, res, next);

    expect(doc.status).toBe('synced');
    expect(doc.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(doc);
  });

  it('handles missing document', async () => {
    Document.findById.mockResolvedValue(null);
    const next = makeNext();

    await documentController.markSynced({ params: { id: 'missing' } }, makeRes(), next);

    const err = next.mock.calls[0][0];
    expect(err.status).toBe(404);
    expect(err.message).toBe('Document not found');
  });
});

