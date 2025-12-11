const axios = require('axios');
const logger = require('../utils/logger');

class AzureADB2CService {
  constructor() {
    this.tenantName = process.env.AZURE_AD_B2C_TENANT_NAME;
    this.clientId = process.env.AZURE_AD_B2C_CLIENT_ID;
    this.clientSecret = process.env.AZURE_AD_B2C_CLIENT_SECRET;
    this.policyName = process.env.AZURE_AD_B2C_POLICY_NAME || 'B2C_1_SignUpSignIn';
    this.scope = process.env.AZURE_AD_B2C_SCOPE || 'openid profile email';
    
    this.authority = `https://${this.tenantName}.b2clogin.com/${this.tenantName}.onmicrosoft.com/${this.policyName}`;
    this.tokenEndpoint = `${this.authority}/oauth2/v2.0/token`;
    this.jwksUri = `${this.authority}/discovery/v2.0/keys`;
    
    this.initialized = false;
    this.jwksCache = null;
    this.jwksCacheExpiry = null;
  }

  /**
   * Initialize Azure AD B2C service
   */
  async initialize() {
    try {
      if (!this.tenantName || !this.clientId) {
        logger.warn('Azure AD B2C not configured. Authentication will use JWT only.');
        return;
      }

      // Fetch JWKS for token validation
      await this.refreshJWKS();
      this.initialized = true;
      
      logger.info('Azure AD B2C service initialized', {
        tenantName: this.tenantName,
        policyName: this.policyName
      });
    } catch (error) {
      logger.error('Failed to initialize Azure AD B2C service:', error);
    }
  }

  /**
   * Refresh JWKS cache
   */
  async refreshJWKS() {
    try {
      const response = await axios.get(this.jwksUri);
      this.jwksCache = response.data;
      this.jwksCacheExpiry = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
      logger.info('JWKS cache refreshed');
    } catch (error) {
      logger.error('Failed to fetch JWKS:', error);
      throw error;
    }
  }

  /**
   * Validate Azure AD B2C token
   */
  async validateToken(token) {
    try {
      if (!this.initialized) {
        throw new Error('Azure AD B2C service not initialized');
      }

      // Refresh JWKS if expired
      if (Date.now() > this.jwksCacheExpiry) {
        await this.refreshJWKS();
      }

      // In production, use jsonwebtoken library to verify signature
      // For now, decode and validate claims
      const decoded = this.decodeToken(token);

      if (!decoded) {
        throw new Error('Invalid token format');
      }

      // Validate issuer
      const expectedIssuer = `https://${this.tenantName}.b2clogin.com/${this.tenantName}.onmicrosoft.com/v2.0/`;
      if (!decoded.iss.startsWith(expectedIssuer)) {
        throw new Error('Invalid token issuer');
      }

      // Validate audience
      if (decoded.aud !== this.clientId) {
        throw new Error('Invalid token audience');
      }

      // Validate expiration
      if (decoded.exp && decoded.exp < Date.now() / 1000) {
        throw new Error('Token expired');
      }

      return decoded;
    } catch (error) {
      logger.error('Token validation failed:', error);
      throw error;
    }
  }

  /**
   * Decode JWT token (without signature verification)
   * In production, use jsonwebtoken library
   */
  decodeToken(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const payload = Buffer.from(parts[1], 'base64').toString('utf8');
      return JSON.parse(payload);
    } catch (error) {
      return null;
    }
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code, redirectUri) {
    try {
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: redirectUri,
        scope: this.scope
      });

      const response = await axios.post(this.tokenEndpoint, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return {
        accessToken: response.data.access_token,
        idToken: response.data.id_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in
      };
    } catch (error) {
      logger.error('Failed to exchange code for tokens:', error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken) {
    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        scope: this.scope
      });

      const response = await axios.post(this.tokenEndpoint, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      return {
        accessToken: response.data.access_token,
        idToken: response.data.id_token,
        refreshToken: response.data.refresh_token,
        expiresIn: response.data.expires_in
      };
    } catch (error) {
      logger.error('Failed to refresh access token:', error);
      throw error;
    }
  }

  /**
   * Provision user from Azure AD B2C claims
   */
  async provisionUser(claims) {
    try {
      const User = require('../models/User');

      // Map Azure AD B2C claims to FAHM user schema
      const userData = {
        email: claims.emails?.[0] || claims.email,
        name: claims.name || `${claims.given_name} ${claims.family_name}`,
        azureAdB2CId: claims.sub || claims.oid,
        role: this.mapClaimsToRole(claims),
        phone: claims.phone_number,
        isActive: true,
        emailVerified: claims.email_verified || false
      };

      // Check if user already exists
      let user = await User.findOne({ azureAdB2CId: userData.azureAdB2CId });

      if (user) {
        // Update existing user
        user.name = userData.name;
        user.email = userData.email;
        user.phone = userData.phone;
        user.emailVerified = userData.emailVerified;
        await user.save();
      } else {
        // Create new user
        user = await User.create(userData);
      }

      logger.info('User provisioned from Azure AD B2C', {
        userId: user._id,
        email: user.email,
        role: user.role
      });

      return user;
    } catch (error) {
      logger.error('Failed to provision user:', error);
      throw error;
    }
  }

  /**
   * Map Azure AD B2C claims to FAHM role
   */
  mapClaimsToRole(claims) {
    // Custom claim mapping based on Azure AD B2C extension attributes
    // Example: claims.extension_Role = 'LoanOfficer'
    
    if (claims.extension_Role) {
      const roleMapping = {
        Borrower: 'borrower',
        LoanOfficerTPO: 'loan_officer_tpo',
        LoanOfficerRetail: 'loan_officer_retail',
        Broker: 'broker',
        BranchManager: 'branch_manager',
        Realtor: 'realtor',
        Admin: 'admin'
      };

      return roleMapping[claims.extension_Role] || 'borrower';
    }

    // Default to borrower if no role claim
    return 'borrower';
  }

  /**
   * Get authorization URL for OAuth flow
   */
  getAuthorizationUrl(redirectUri, state) {
    const params = new URLSearchParams({
      client_id: this.clientId,
      response_type: 'code',
      redirect_uri: redirectUri,
      scope: this.scope,
      state: state || Math.random().toString(36).substring(7),
      prompt: 'login'
    });

    return `${this.authority}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  /**
   * Get logout URL
   */
  getLogoutUrl(postLogoutRedirectUri) {
    const params = new URLSearchParams({
      post_logout_redirect_uri: postLogoutRedirectUri
    });

    return `${this.authority}/oauth2/v2.0/logout?${params.toString()}`;
  }
}

module.exports = new AzureADB2CService();
