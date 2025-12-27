const net = require('net');

function isPrivateIp(ip) {
  if (!ip) return false;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('172.')) {
    const second = Number(ip.split('.')[1]);
    if (second >= 16 && second <= 31) return true;
  }
  if (ip.startsWith('127.')) return true;
  if (ip.startsWith('169.254.')) return true;
  return false;
}

function assertSafeUrl(urlString) {
  if (!urlString) return;
  let url;
  try {
    url = new URL(urlString);
  } catch (_err) {
    throw new Error('Invalid URL');
  }

  const hostname = url.hostname.toLowerCase();
  if (hostname === 'localhost') {
    throw new Error('Localhost URLs are not allowed');
  }

  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new Error('Private network URLs are not allowed');
    }
    return;
  }

  return;
}

module.exports = {
  assertSafeUrl,
};
