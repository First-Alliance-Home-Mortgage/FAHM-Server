const multer = require('multer');

const {
  handleMulterError,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE,
  fileFilter,
} = require('../../src/middleware/uploadMiddleware');

describe('uploadMiddleware fileFilter', () => {
  it('accepts allowed mime and extension', (done) => {
    const cb = (err, pass) => {
      expect(err).toBeNull();
      expect(pass).toBe(true);
      done();
    };
    const file = { mimetype: ALLOWED_MIME_TYPES[0], originalname: 'doc.pdf' };
    fileFilter({}, file, cb);
  });

  it('rejects disallowed mime', (done) => {
    const cb = (err) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toContain('Invalid file type');
      done();
    };
    const file = { mimetype: 'text/plain', originalname: 'note.txt' };
    fileFilter({}, file, cb);
  });

  it('rejects disallowed extension', (done) => {
    const cb = (err) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toContain('Invalid file extension');
      done();
    };
    const file = { mimetype: ALLOWED_MIME_TYPES[0], originalname: 'script.exe' };
    fileFilter({}, file, cb);
  });
});

describe('uploadMiddleware handleMulterError', () => {
  const makeRes = () => {
    const res = { statusCode: 200 };
    res.status = jest.fn().mockImplementation((code) => {
      res.statusCode = code;
      return res;
    });
    res.json = jest.fn().mockReturnValue(res);
    return res;
  };

  it('handles file size limit', () => {
    const err = new multer.MulterError('LIMIT_FILE_SIZE');
    const res = makeRes();

    handleMulterError(err, {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    });
  });

  it('handles file count limit', () => {
    const err = new multer.MulterError('LIMIT_FILE_COUNT');
    const res = makeRes();

    handleMulterError(err, {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Too many files. Maximum 5 files per upload',
    });
  });

  it('handles unexpected field', () => {
    const err = new multer.MulterError('LIMIT_UNEXPECTED_FILE');
    const res = makeRes();

    handleMulterError(err, {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Unexpected field in upload',
    });
  });

  it('bubbles unknown errors', () => {
    const err = new Error('custom');
    const res = makeRes();
    const next = jest.fn();

    handleMulterError(err, {}, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'custom',
    });
  });
});

