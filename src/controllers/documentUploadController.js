const createError = require('http-errors');
const { validationResult } = require('express-validator');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const DocumentUpload = require('../models/DocumentUpload');
const LoanApplication = require('../models/LoanApplication');
const Notification = require('../models/Notification');
const azureBlobService = require('../services/azureBlobService');
const posUploadService = require('../services/posUploadService');
const logger = require('../utils/logger');

/**
 * Upload document to loan
 * POST /api/v1/documents/upload
 */
exports.uploadDocument = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(createError(400, { errors: errors.array() }));
    }

    const { loanId, documentType, description, posSystem = 'blend' } = req.body;
    const uploadedBy = req.user._id;

    // Validate loan exists and user has access
    const loan = await LoanApplication.findById(loanId);
    if (!loan) {
      return next(createError(404, 'Loan not found'));
    }

    // Check access rights
    const isBorrower = loan.borrower.toString() === uploadedBy.toString();
    const isOfficer = loan.assignedOfficer?.toString() === uploadedBy.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isBorrower && !isOfficer && !isAdmin) {
      return next(createError(403, 'You do not have permission to upload documents for this loan'));
    }

    // Check if files were uploaded
    if (!req.files || req.files.length === 0) {
      return next(createError(400, 'No files uploaded'));
    }

    const uploadedDocuments = [];
    const failedUploads = [];

    // Process each file
    for (const file of req.files) {
      try {
        // Generate unique filename
        const fileExt = path.extname(file.originalname);
        const uniqueFileName = `${loanId}/${documentType}/${uuidv4()}${fileExt}`;

        // Upload to Azure Blob Storage
        const blobResult = await azureBlobService.uploadFile(
          uniqueFileName,
          file.buffer,
          file.mimetype,
          {
            loanId,
            documentType,
            uploadedBy: uploadedBy.toString(),
            originalFileName: file.originalname
          }
        );

        // Create document record
        const documentUpload = new DocumentUpload({
          loan: loanId,
          uploadedBy,
          fileName: uniqueFileName,
          originalFileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          documentType,
          description,
          blobUrl: blobResult.blobUrl,
          blobContainer: blobResult.blobContainer,
          blobName: blobResult.blobName,
          status: 'uploaded',
          metadata: {
            uploadSource: 'mobile_app',
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
          }
        });

        await documentUpload.save();

        // Push to POS system in background
        setImmediate(async () => {
          try {
            const fileBuffer = await azureBlobService.downloadFile(blobResult.blobName);
            
            let posResult;
            if (posSystem === 'blend') {
              posResult = await posUploadService.uploadToBlend(
                loanId,
                fileBuffer,
                file.originalname,
                documentType,
                { description }
              );
            } else if (posSystem === 'big_pos') {
              posResult = await posUploadService.uploadToBigPOS(
                loanId,
                fileBuffer,
                file.originalname,
                documentType,
                { description }
              );
            } else if (posSystem === 'encompass') {
              posResult = await posUploadService.uploadToEncompass(
                loanId,
                fileBuffer,
                file.originalname,
                documentType,
                { description }
              );
            }

            if (posResult.success) {
              if (posResult.posDocumentId) {
                await documentUpload.markSyncedToPOS(posResult.posSystem, posResult.posDocumentId);
              } else if (posResult.encompassDocId) {
                await documentUpload.markSyncedToEncompass(posResult.encompassDocId);
              }
              logger.info('Document synced to POS', {
                documentId: documentUpload._id,
                posSystem,
                posDocumentId: posResult.posDocumentId || posResult.encompassDocId
              });
            }
          } catch (posError) {
            logger.error('Failed to sync document to POS:', posError);
            await documentUpload.markFailed([{
              field: 'posSync',
              message: posError.message
            }]);
          }
        });

        // Notify LO and processor
        setImmediate(async () => {
          try {
            if (loan.assignedOfficer) {
              const notification = new Notification({
                user: loan.assignedOfficer,
                type: 'document_uploaded',
                title: 'New Document Uploaded',
                message: `${req.user.name} uploaded ${documentType} for loan ${loan.loanNumber || loanId}`,
                data: {
                  loanId,
                  documentId: documentUpload._id,
                  documentType
                }
              });
              await notification.save();
              await documentUpload.notifyLO();
            }
          } catch (notifError) {
            logger.error('Failed to send notification:', notifError);
          }
        });

        uploadedDocuments.push({
          id: documentUpload._id,
          fileName: file.originalname,
          documentType,
          status: documentUpload.status,
          uploadedAt: documentUpload.createdAt
        });

        logger.info('Document uploaded successfully', {
          userId: uploadedBy,
          loanId,
          documentId: documentUpload._id,
          fileName: file.originalname
        });
      } catch (fileError) {
        logger.error('Error uploading file:', fileError);
        failedUploads.push({
          fileName: file.originalname,
          error: fileError.message
        });
      }
    }

    return res.json({
      success: true,
      data: {
        uploaded: uploadedDocuments,
        failed: failedUploads
      },
      message: `${uploadedDocuments.length} file(s) uploaded successfully${failedUploads.length > 0 ? `, ${failedUploads.length} failed` : ''}`
    });
  } catch (error) {
    logger.error('Error in document upload:', error);
    next(error);
  }
};

/**
 * Get documents for a loan
 * GET /api/v1/documents/loan/:loanId
 */
exports.getDocumentsByLoan = async (req, res, next) => {
  try {
    const { loanId } = req.params;
    const { status, documentType } = req.query;

    // Validate loan exists and user has access
    const loan = await LoanApplication.findById(loanId);
    if (!loan) {
      return next(createError(404, 'Loan not found'));
    }

    const isBorrower = loan.borrower.toString() === req.user._id.toString();
    const isOfficer = loan.assignedOfficer?.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isBorrower && !isOfficer && !isAdmin) {
      return next(createError(403, 'You do not have permission to view documents for this loan'));
    }

    const filter = { loan: loanId };
    if (status) filter.status = status;
    if (documentType) filter.documentType = documentType;

    const documents = await DocumentUpload.find(filter)
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 });

    logger.info('Documents retrieved for loan', {
      userId: req.user._id,
      loanId,
      count: documents.length
    });

    return res.json({
      success: true,
      data: documents
    });
  } catch (error) {
    logger.error('Error fetching loan documents:', error);
    next(error);
  }
};

/**
 * Get single document
 * GET /api/v1/documents/:id
 */
exports.getDocument = async (req, res, next) => {
  try {
    const { id } = req.params;

    const document = await DocumentUpload.findById(id)
      .populate('uploadedBy', 'name email')
      .populate('loan', 'loanNumber borrower assignedOfficer');

    if (!document) {
      return next(createError(404, 'Document not found'));
    }

    // Check access rights
    const isBorrower = document.loan.borrower.toString() === req.user._id.toString();
    const isOfficer = document.loan.assignedOfficer?.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isBorrower && !isOfficer && !isAdmin) {
      return next(createError(403, 'You do not have permission to view this document'));
    }

    logger.info('Document retrieved', {
      userId: req.user._id,
      documentId: id
    });

    return res.json({
      success: true,
      data: document
    });
  } catch (error) {
    logger.error('Error fetching document:', error);
    next(error);
  }
};

/**
 * Download document
 * GET /api/v1/documents/:id/download
 */
exports.downloadDocument = async (req, res, next) => {
  try {
    const { id } = req.params;

    const document = await DocumentUpload.findById(id)
      .populate('loan', 'borrower assignedOfficer');

    if (!document) {
      return next(createError(404, 'Document not found'));
    }

    // Check access rights
    const isBorrower = document.loan.borrower.toString() === req.user._id.toString();
    const isOfficer = document.loan.assignedOfficer?.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isBorrower && !isOfficer && !isAdmin) {
      return next(createError(403, 'You do not have permission to download this document'));
    }

    // Download from Azure Blob
    const fileBuffer = await azureBlobService.downloadFile(document.blobName);

    // Set headers
    res.setHeader('Content-Type', document.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${document.originalFileName}"`);
    res.setHeader('Content-Length', fileBuffer.length);

    logger.info('Document downloaded', {
      userId: req.user._id,
      documentId: id
    });

    return res.send(fileBuffer);
  } catch (error) {
    logger.error('Error downloading document:', error);
    next(error);
  }
};

/**
 * Delete document
 * DELETE /api/v1/documents/:id
 */
exports.deleteDocument = async (req, res, next) => {
  try {
    const { id } = req.params;

    const document = await DocumentUpload.findById(id)
      .populate('loan', 'borrower assignedOfficer');

    if (!document) {
      return next(createError(404, 'Document not found'));
    }

    // Only borrower, LO, or admin can delete
    const isBorrower = document.loan.borrower.toString() === req.user._id.toString();
    const isOfficer = document.loan.assignedOfficer?.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isBorrower && !isOfficer && !isAdmin) {
      return next(createError(403, 'You do not have permission to delete this document'));
    }

    // Delete from Azure Blob
    await azureBlobService.deleteFile(document.blobName);

    // Mark as deleted
    document.status = 'deleted';
    document.deletedAt = new Date();
    await document.save();

    logger.info('Document deleted', {
      userId: req.user._id,
      documentId: id
    });

    return res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    logger.error('Error deleting document:', error);
    next(error);
  }
};

/**
 * Retry POS sync for failed document
 * POST /api/v1/documents/:id/retry-sync
 */
exports.retrySyncToPOS = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { posSystem = 'blend' } = req.body;

    const document = await DocumentUpload.findById(id)
      .populate('loan', 'borrower assignedOfficer');

    if (!document) {
      return next(createError(404, 'Document not found'));
    }

    // Only LO or admin can retry sync
    const isOfficer = document.loan.assignedOfficer?.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOfficer && !isAdmin) {
      return next(createError(403, 'You do not have permission to retry sync'));
    }

    // Download from Azure Blob
    const fileBuffer = await azureBlobService.downloadFile(document.blobName);

    // Retry upload to POS
    let posResult;
    if (posSystem === 'blend') {
      posResult = await posUploadService.uploadToBlend(
        document.loan._id,
        fileBuffer,
        document.originalFileName,
        document.documentType,
        { description: document.description }
      );
    } else if (posSystem === 'big_pos') {
      posResult = await posUploadService.uploadToBigPOS(
        document.loan._id,
        fileBuffer,
        document.originalFileName,
        document.documentType,
        { description: document.description }
      );
    } else if (posSystem === 'encompass') {
      posResult = await posUploadService.uploadToEncompass(
        document.loan._id,
        fileBuffer,
        document.originalFileName,
        document.documentType,
        { description: document.description }
      );
    }

    if (posResult.success) {
      if (posResult.posDocumentId) {
        await document.markSyncedToPOS(posResult.posSystem, posResult.posDocumentId);
      } else if (posResult.encompassDocId) {
        await document.markSyncedToEncompass(posResult.encompassDocId);
      }

      logger.info('Document sync retried successfully', {
        userId: req.user._id,
        documentId: id,
        posSystem
      });

      return res.json({
        success: true,
        message: 'Document synced successfully',
        data: {
          posSystem,
          posDocumentId: posResult.posDocumentId || posResult.encompassDocId,
          status: document.status
        }
      });
    } else {
      throw new Error('POS sync failed');
    }
  } catch (error) {
    logger.error('Error retrying POS sync:', error);
    next(error);
  }
};

module.exports = exports;
