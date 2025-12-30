jest.mock('express-validator', () => ({ validationResult: jest.fn() }));
jest.mock('../../src/services/azureBlobService');
jest.mock('../../src/models/LoanApplication');
jest.mock('../../src/models/Document');

// ...existing code...
const { validationResult } = require('express-validator');
const azureBlobService = require('../../src/services/azureBlobService');
const LoanApplication = require('../../src/models/LoanApplication');
const Document = require('../../src/models/Document');
const controller = require('../../src/controllers/documentUploadController');

describe('documentUploadController.createPresignedUpload', () => {
  const makeRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    validationResult.mockReturnValue({ isEmpty: () => true, array: () => [] });
    azureBlobService.generateSasUrl.mockResolvedValue('https://blob/test-sas');
  });

  it('returns presigned URL when borrower owns the loan', async () => {
    LoanApplication.findById.mockResolvedValue({
      _id: 'loan1',
      borrower: { toString: () => 'user1' },
      assignedOfficer: { toString: () => 'officer1' },
    });
    Document.create.mockResolvedValue({ _id: 'doc1' });

    const req = {
      body: {
        loanId: 'loan1',
        documentType: 'paystub',
        fileName: 'paystub.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
      },
      user: { _id: 'user1', role: 'borrower' },
    };
    const res = makeRes();
    const next = jest.fn();

    await controller.createPresignedUpload(req, res, next);

    expect(azureBlobService.generateSasUrl).toHaveBeenCalled();
    expect(Document.create).toHaveBeenCalledWith(
      expect.objectContaining({ loan: 'loan1', uploadedBy: 'user1' })
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ uploadUrl: 'https://blob/test-sas', documentId: 'doc1' }),
      })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects when user lacks access to the loan', async () => {
    LoanApplication.findById.mockResolvedValue({
      _id: 'loan1',
      borrower: { toString: () => 'otherUser' },
      assignedOfficer: null,
    });

    const req = {
      body: {
        loanId: 'loan1',
        documentType: 'paystub',
        fileName: 'paystub.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
      },
      user: { _id: 'user1', role: 'borrower' },
    };
    const res = makeRes();
    const next = jest.fn();

    await controller.createPresignedUpload(req, res, next);

    const err = next.mock.calls[0][0];
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(403);
    expect(res.status).not.toHaveBeenCalled();
  });
});
