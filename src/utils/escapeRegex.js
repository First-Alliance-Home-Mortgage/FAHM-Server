/**
 * Escape special regex characters in a string to prevent ReDoS attacks.
 * @param {string} str - User-provided search string
 * @returns {string} Escaped string safe for use in RegExp / $regex
 */
module.exports = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
