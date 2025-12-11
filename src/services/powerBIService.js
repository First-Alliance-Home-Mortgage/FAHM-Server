const axios = require('axios');
const logger = require('../utils/logger');

const POWERBI_API_URL = 'https://api.powerbi.com/v1.0/myorg';
const POWERBI_TENANT_ID = process.env.POWERBI_TENANT_ID;
const POWERBI_CLIENT_ID = process.env.POWERBI_CLIENT_ID;
const POWERBI_CLIENT_SECRET = process.env.POWERBI_CLIENT_SECRET;
const POWERBI_WORKSPACE_ID = process.env.POWERBI_WORKSPACE_ID;

let cachedToken = null;
let tokenExpiresAt = null;

/**
 * Get Azure AD access token for Power BI REST API
 */
async function getAccessToken() {
  // Return cached token if valid for at least 5 more minutes
  if (cachedToken && tokenExpiresAt && Date.now() < tokenExpiresAt - 5 * 60 * 1000) {
    return cachedToken;
  }

  try {
    const tokenEndpoint = `https://login.microsoftonline.com/${POWERBI_TENANT_ID}/oauth2/v2.0/token`;
    
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', POWERBI_CLIENT_ID);
    params.append('client_secret', POWERBI_CLIENT_SECRET);
    params.append('scope', 'https://analysis.windows.net/powerbi/api/.default');

    const response = await axios.post(tokenEndpoint, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    cachedToken = response.data.access_token;
    const expiresIn = response.data.expires_in || 3600;
    tokenExpiresAt = Date.now() + expiresIn * 1000;

    logger.info('Power BI access token obtained');
    return cachedToken;
  } catch (error) {
    logger.error('Failed to obtain Power BI access token:', error.response?.data || error.message);
    throw new Error('Power BI authentication failed');
  }
}

/**
 * Make authenticated API request to Power BI
 */
async function makeRequest(method, endpoint, data = null) {
  const token = await getAccessToken();
  const config = {
    method,
    url: `${POWERBI_API_URL}${endpoint}`,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };

  if (data) {
    config.data = data;
  }

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    logger.error(`Power BI API error (${method} ${endpoint}):`, error.response?.data || error.message);
    throw error;
  }
}

/**
 * Get embed token for report
 */
async function getEmbedToken(reportId, datasetIds = []) {
  logger.info('Generating Power BI embed token', { reportId });

  try {
    const requestBody = {
      reports: [
        {
          id: reportId
        }
      ],
      datasets: datasetIds.map(id => ({ id }))
    };

    const data = await makeRequest('POST', '/GenerateToken', requestBody);

    return {
      token: data.token,
      tokenId: data.tokenId,
      expiration: data.expiration
    };
  } catch (error) {
    logger.error('Failed to generate embed token:', error);
    throw error;
  }
}

/**
 * Get report details from Power BI workspace
 */
async function getReport(reportId) {
  logger.info('Fetching Power BI report details', { reportId });

  try {
    const data = await makeRequest('GET', `/groups/${POWERBI_WORKSPACE_ID}/reports/${reportId}`);

    return {
      id: data.id,
      name: data.name,
      webUrl: data.webUrl,
      embedUrl: data.embedUrl,
      datasetId: data.datasetId,
      description: data.description
    };
  } catch (error) {
    logger.error('Failed to fetch report details:', error);
    throw error;
  }
}

/**
 * Get all reports in workspace
 */
async function getReports() {
  logger.info('Fetching all Power BI reports from workspace');

  try {
    const data = await makeRequest('GET', `/groups/${POWERBI_WORKSPACE_ID}/reports`);

    return data.value.map(report => ({
      id: report.id,
      name: report.name,
      webUrl: report.webUrl,
      embedUrl: report.embedUrl,
      datasetId: report.datasetId
    }));
  } catch (error) {
    logger.error('Failed to fetch reports:', error);
    throw error;
  }
}

/**
 * Refresh dataset to pull latest data
 */
async function refreshDataset(datasetId) {
  logger.info('Triggering Power BI dataset refresh', { datasetId });

  try {
    await makeRequest('POST', `/groups/${POWERBI_WORKSPACE_ID}/datasets/${datasetId}/refreshes`);

    logger.info('Dataset refresh triggered successfully', { datasetId });
    return { success: true };
  } catch (error) {
    logger.error('Failed to trigger dataset refresh:', error);
    throw error;
  }
}

/**
 * Get dataset refresh history
 */
async function getRefreshHistory(datasetId, top = 10) {
  logger.info('Fetching dataset refresh history', { datasetId, top });

  try {
    const data = await makeRequest('GET', `/groups/${POWERBI_WORKSPACE_ID}/datasets/${datasetId}/refreshes?$top=${top}`);

    return data.value.map(refresh => ({
      requestId: refresh.requestId,
      status: refresh.status,
      startTime: refresh.startTime,
      endTime: refresh.endTime,
      serviceExceptionJson: refresh.serviceExceptionJson
    }));
  } catch (error) {
    logger.error('Failed to fetch refresh history:', error);
    throw error;
  }
}

/**
 * Get embed configuration for report
 */
async function getEmbedConfig(reportId, accessLevel = 'view') {
  try {
    const report = await getReport(reportId);
    const embedToken = await getEmbedToken(reportId, [report.datasetId]);

    return {
      type: 'report',
      id: report.id,
      embedUrl: report.embedUrl,
      accessToken: embedToken.token,
      tokenExpiration: embedToken.expiration,
      permissions: accessLevel === 'edit' ? 'All' : 'View',
      settings: {
        filterPaneEnabled: true,
        navContentPaneEnabled: true,
        layoutType: 'Custom' // or 'MobilePortrait' for mobile
      }
    };
  } catch (error) {
    logger.error('Failed to get embed configuration:', error);
    throw error;
  }
}

/**
 * Create custom filter for report
 */
function createReportFilter(table, column, values, filterType = 'In') {
  return {
    $schema: 'http://powerbi.com/product/schema#basic',
    target: {
      table,
      column
    },
    operator: filterType, // 'In', 'NotIn', 'All'
    values,
    filterType: 'Basic',
    requireSingleSelection: false
  };
}

/**
 * Push data to Power BI dataset (for real-time datasets)
 */
async function pushData(datasetId, tableName, rows) {
  logger.info('Pushing data to Power BI dataset', { datasetId, tableName, rowCount: rows.length });

  try {
    await makeRequest('POST', `/groups/${POWERBI_WORKSPACE_ID}/datasets/${datasetId}/tables/${tableName}/rows`, {
      rows
    });

    logger.info('Data pushed successfully to Power BI', { datasetId, tableName });
    return { success: true, rowCount: rows.length };
  } catch (error) {
    logger.error('Failed to push data to Power BI:', error);
    throw error;
  }
}

/**
 * Get dataset information
 */
async function getDataset(datasetId) {
  logger.info('Fetching Power BI dataset details', { datasetId });

  try {
    const data = await makeRequest('GET', `/groups/${POWERBI_WORKSPACE_ID}/datasets/${datasetId}`);

    return {
      id: data.id,
      name: data.name,
      addRowsAPIEnabled: data.addRowsAPIEnabled,
      configuredBy: data.configuredBy,
      isRefreshable: data.isRefreshable,
      isEffectiveIdentityRequired: data.isEffectiveIdentityRequired,
      isEffectiveIdentityRolesRequired: data.isEffectiveIdentityRolesRequired
    };
  } catch (error) {
    logger.error('Failed to fetch dataset details:', error);
    throw error;
  }
}

module.exports = {
  getAccessToken,
  getEmbedToken,
  getReport,
  getReports,
  refreshDataset,
  getRefreshHistory,
  getEmbedConfig,
  createReportFilter,
  pushData,
  getDataset
};
