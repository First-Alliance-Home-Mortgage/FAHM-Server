const { BlobServiceClient } = require('@azure/storage-blob');
const logger = require('../utils/logger');

class AzureBlobService {
  constructor() {
    this.connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    this.containerName = process.env.AZURE_BLOB_CONTAINER || 'loan-documents';
    
    if (!this.connectionString) {
      logger.warn('AZURE_STORAGE_CONNECTION_STRING not set - Azure Blob uploads will fail');
      this.blobServiceClient = null;
    } else {
      this.blobServiceClient = BlobServiceClient.fromConnectionString(this.connectionString);
    }
  }

  /**
   * Upload file buffer to Azure Blob Storage
   */
  async uploadFile(fileName, fileBuffer, mimeType, metadata = {}) {
    try {
      if (!this.blobServiceClient) {
        throw new Error('Azure Blob Storage not configured');
      }

      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      
      // Create container if it doesn't exist
      await containerClient.createIfNotExists({
        access: 'private'
      });

      const blockBlobClient = containerClient.getBlockBlobClient(fileName);

      const uploadOptions = {
        blobHTTPHeaders: {
          blobContentType: mimeType
        },
        metadata
      };

      await blockBlobClient.uploadData(fileBuffer, uploadOptions);

      const blobUrl = blockBlobClient.url;

      logger.info('File uploaded to Azure Blob Storage', {
        fileName,
        blobUrl,
        size: fileBuffer.length
      });

      return {
        blobUrl,
        blobName: fileName,
        blobContainer: this.containerName
      };
    } catch (error) {
      logger.error('Error uploading to Azure Blob Storage:', error);
      throw error;
    }
  }

  /**
   * Download file from Azure Blob Storage
   */
  async downloadFile(blobName) {
    try {
      if (!this.blobServiceClient) {
        throw new Error('Azure Blob Storage not configured');
      }

      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      const downloadResponse = await blockBlobClient.download();
      const buffer = await this.streamToBuffer(downloadResponse.readableStreamBody);

      logger.info('File downloaded from Azure Blob Storage', {
        blobName,
        size: buffer.length
      });

      return buffer;
    } catch (error) {
      logger.error('Error downloading from Azure Blob Storage:', error);
      throw error;
    }
  }

  /**
   * Delete file from Azure Blob Storage
   */
  async deleteFile(blobName) {
    try {
      if (!this.blobServiceClient) {
        throw new Error('Azure Blob Storage not configured');
      }

      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      await blockBlobClient.delete();

      logger.info('File deleted from Azure Blob Storage', {
        blobName
      });

      return true;
    } catch (error) {
      logger.error('Error deleting from Azure Blob Storage:', error);
      throw error;
    }
  }

  /**
   * Generate SAS URL for temporary access
   */
  async generateSasUrl(blobName, expiryMinutes = 60) {
    try {
      if (!this.blobServiceClient) {
        throw new Error('Azure Blob Storage not configured');
      }

      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      const expiresOn = new Date();
      expiresOn.setMinutes(expiresOn.getMinutes() + expiryMinutes);

      // Note: For SAS token generation, you need SharedKeyCredential
      // This is a simplified version - in production, implement proper SAS generation
      const sasUrl = blockBlobClient.url;

      logger.info('SAS URL generated', {
        blobName,
        expiresOn
      });

      return sasUrl;
    } catch (error) {
      logger.error('Error generating SAS URL:', error);
      throw error;
    }
  }

  /**
   * Helper: Convert stream to buffer
   */
  async streamToBuffer(readableStream) {
    return new Promise((resolve, reject) => {
      const chunks = [];
      readableStream.on('data', (data) => {
        chunks.push(data instanceof Buffer ? data : Buffer.from(data));
      });
      readableStream.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      readableStream.on('error', reject);
    });
  }

  /**
   * Check if blob exists
   */
  async blobExists(blobName) {
    try {
      if (!this.blobServiceClient) {
        return false;
      }

      const containerClient = this.blobServiceClient.getContainerClient(this.containerName);
      const blockBlobClient = containerClient.getBlockBlobClient(blobName);

      return await blockBlobClient.exists();
    } catch (error) {
      logger.error('Error checking blob existence:', error);
      return false;
    }
  }
}

module.exports = new AzureBlobService();
