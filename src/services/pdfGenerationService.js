const PDFDocument = require('pdfkit');
// ...existing code...
const logger = require('../utils/logger');

class PDFGenerationService {
  /**
   * Generate preapproval letter PDF
   */
  async generatePreapprovalLetter(letterData) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'LETTER',
          margins: {
            top: 50,
            bottom: 50,
            left: 60,
            right: 60
          }
        });

        const buffers = [];
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(buffers);
          resolve(pdfBuffer);
        });
        doc.on('error', reject);

        // Header - Logo and company info
        if (letterData.branding?.logo) {
          // In production, download and embed logo
          // doc.image(logoPath, 60, 50, { width: 150 });
        }
        
        doc.fontSize(10)
           .fillColor('#666666')
           .text('First Alliance Home Mortgage', 60, 50)
           .text(letterData.signatures?.companyNMLS || 'NMLS #00000', 60, 65)
           .moveDown();

        // Co-branding partner logo (if applicable)
        if (letterData.branding?.partnerLogo && letterData.branding?.partnerName) {
          doc.fontSize(10)
             .fillColor('#666666')
             .text(`In partnership with ${letterData.branding.partnerName}`, 400, 50, { align: 'right' });
        }

        doc.moveDown(2);

        // Title
        doc.fontSize(20)
           .fillColor('#003B5C')
           .text('MORTGAGE PRE-APPROVAL LETTER', { align: 'center' })
           .moveDown(2);

        // Date and Letter Number
        const today = new Date().toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
        
        doc.fontSize(10)
           .fillColor('#000000')
           .text(`Date: ${today}`, 60, doc.y)
           .text(`Letter #: ${letterData.letterNumber}`, 60, doc.y)
           .moveDown();

        // Borrower Information
        doc.fontSize(12)
           .fillColor('#003B5C')
           .text('BORROWER INFORMATION', { underline: true })
           .moveDown(0.5);

        doc.fontSize(10)
           .fillColor('#000000')
           .text(`Name: ${letterData.borrowerData.primaryBorrower.name}`, 60, doc.y);
        
        if (letterData.borrowerData.coBorrower?.name) {
          doc.text(`Co-Borrower: ${letterData.borrowerData.coBorrower.name}`, 60, doc.y);
        }
        
        if (letterData.borrowerData.primaryBorrower.address) {
          doc.text(`Address: ${letterData.borrowerData.primaryBorrower.address}`, 60, doc.y);
          doc.text(`${letterData.borrowerData.primaryBorrower.city}, ${letterData.borrowerData.primaryBorrower.state} ${letterData.borrowerData.primaryBorrower.zip}`, 60, doc.y);
        }
        
        doc.moveDown(1.5);

        // Pre-Approval Details
        doc.fontSize(12)
           .fillColor('#003B5C')
           .text('PRE-APPROVAL DETAILS', { underline: true })
           .moveDown(0.5);

        doc.fontSize(10)
           .fillColor('#000000')
           .text(`This letter certifies that ${letterData.borrowerData.primaryBorrower.name} has been pre-approved for a mortgage loan under the following terms:`, 60, doc.y, { align: 'justify' })
           .moveDown();

        doc.text(`Loan Amount: ${this.formatCurrency(letterData.loanData.loanAmount)}`, 80, doc.y);
        
        if (letterData.loanData.purchasePrice) {
          doc.text(`Purchase Price: ${this.formatCurrency(letterData.loanData.purchasePrice)}`, 80, doc.y);
        }
        
        if (letterData.loanData.downPayment) {
          doc.text(`Down Payment: ${this.formatCurrency(letterData.loanData.downPayment)}`, 80, doc.y);
        }
        
        doc.text(`Loan Type: ${this.formatLoanType(letterData.loanData.loanType)}`, 80, doc.y);
        
        if (letterData.loanData.loanTerm) {
          doc.text(`Loan Term: ${letterData.loanData.loanTerm} years`, 80, doc.y);
        }
        
        if (letterData.loanData.interestRate) {
          doc.text(`Estimated Interest Rate: ${letterData.loanData.interestRate}%`, 80, doc.y);
        }
        
        if (letterData.loanData.monthlyPayment) {
          doc.text(`Estimated Monthly Payment: ${this.formatCurrency(letterData.loanData.monthlyPayment)}`, 80, doc.y);
        }

        doc.moveDown(1.5);

        // Property Information
        if (letterData.loanData.propertyAddress) {
          doc.fontSize(12)
             .fillColor('#003B5C')
             .text('PROPERTY INFORMATION', { underline: true })
             .moveDown(0.5);

          doc.fontSize(10)
             .fillColor('#000000')
             .text(`Property Address: ${letterData.loanData.propertyAddress}`, 60, doc.y);
          
          if (letterData.loanData.propertyCity) {
            doc.text(`${letterData.loanData.propertyCity}, ${letterData.loanData.propertyState} ${letterData.loanData.propertyZip}`, 60, doc.y);
          }
          
          doc.text(`Property Type: ${this.formatPropertyType(letterData.loanData.propertyType)}`, 60, doc.y);
          
          doc.moveDown(1.5);
        }

        // Conditions
        if (letterData.conditions && letterData.conditions.length > 0) {
          doc.fontSize(12)
             .fillColor('#003B5C')
             .text('CONDITIONS', { underline: true })
             .moveDown(0.5);

          doc.fontSize(10)
             .fillColor('#000000')
             .text('This pre-approval is subject to the following conditions:', 60, doc.y)
             .moveDown(0.5);

          letterData.conditions.forEach((condition, index) => {
            doc.text(`${index + 1}. ${condition.description}`, 80, doc.y);
          });

          doc.moveDown(1.5);
        }

        // Disclaimers
        doc.fontSize(12)
           .fillColor('#003B5C')
           .text('IMPORTANT DISCLAIMERS', { underline: true })
           .moveDown(0.5);

        const defaultDisclaimers = [
          'This pre-approval letter is valid for 90 days from the date of issue.',
          'This pre-approval is contingent upon verification of all information provided.',
          'This is not a commitment to lend. Final loan approval is subject to property appraisal, title review, and underwriting approval.',
          'Interest rates are subject to change and may vary based on market conditions.',
          'Additional documentation may be required during the final underwriting process.'
        ];

        const disclaimers = letterData.disclaimers?.length > 0 
          ? letterData.disclaimers.sort((a, b) => a.order - b.order).map(d => d.text)
          : defaultDisclaimers;

        doc.fontSize(9)
           .fillColor('#666666');
        
        disclaimers.forEach((disclaimer, index) => {
          doc.text(`${index + 1}. ${disclaimer}`, 60, doc.y, { align: 'justify' });
          doc.moveDown(0.3);
        });

        doc.moveDown(1.5);

        // Expiration
        const expirationDate = letterData.expirationDate 
          ? new Date(letterData.expirationDate).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })
          : new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            });

        doc.fontSize(10)
           .fillColor('#FF0000')
           .text(`This letter expires on: ${expirationDate}`, { align: 'center' })
           .moveDown(2);

        // Signature
        doc.fontSize(10)
           .fillColor('#000000')
           .text('Sincerely,', 60, doc.y)
           .moveDown(2);

        if (letterData.signatures?.loanOfficerSignature) {
          // In production, embed signature image
          // doc.image(signaturePath, 60, doc.y, { width: 150 });
          doc.text('[Digital Signature]', 60, doc.y);
        }

        doc.moveDown(0.5);
        doc.text(letterData.signatures?.loanOfficerName || 'Loan Officer', 60, doc.y);
        doc.text(letterData.signatures?.loanOfficerTitle || 'Senior Loan Officer', 60, doc.y);
        doc.text(`NMLS #${letterData.signatures?.loanOfficerNMLS || '000000'}`, 60, doc.y);
        doc.text(letterData.signatures?.companyName || 'First Alliance Home Mortgage', 60, doc.y);

        // Footer
        doc.fontSize(8)
           .fillColor('#999999')
           .text('This document is confidential and intended solely for the recipient.', 60, 720, { 
             align: 'center' 
           });

        doc.end();

        logger.info('PDF generated successfully', {
          letterNumber: letterData.letterNumber
        });
      } catch (error) {
        logger.error('Error generating PDF:', error);
        reject(error);
      }
    });
  }

  /**
   * Format currency
   */
  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  /**
   * Format loan type
   */
  formatLoanType(type) {
    const types = {
      conventional: 'Conventional',
      fha: 'FHA',
      va: 'VA',
      usda: 'USDA',
      jumbo: 'Jumbo'
    };
    return types[type] || type;
  }

  /**
   * Format property type
   */
  formatPropertyType(type) {
    const types = {
      single_family: 'Single Family',
      condo: 'Condominium',
      townhouse: 'Townhouse',
      multi_family: 'Multi-Family',
      manufactured: 'Manufactured'
    };
    return types[type] || type;
  }
}

module.exports = new PDFGenerationService();
