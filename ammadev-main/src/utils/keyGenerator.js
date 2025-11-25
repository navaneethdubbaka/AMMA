// Utility functions for patient key generation and validation

/**
 * Generates a random 9-digit patient key
 * Format: 123456789 (exactly 9 digits)
 */
export function generatePatientKey() {
  // Generate a random number between 100000000 and 999999999
  const min = 100000000;
  const max = 999999999;
  const key = Math.floor(Math.random() * (max - min + 1)) + min;
  return key.toString();
}

/**
 * Validates a patient key format
 * Must be exactly 9 digits
 */
export function isValidPatientKey(key) {
  if (!key) return false;
  const keyStr = key.toString().trim();
  return /^\d{9}$/.test(keyStr);
}

/**
 * Formats patient key for display (e.g., 123-456-789)
 */
export function formatPatientKey(key) {
  if (!key) return '';
  const keyStr = key.toString().trim();
  if (keyStr.length !== 9) return keyStr;
  return `${keyStr.slice(0, 3)}-${keyStr.slice(3, 6)}-${keyStr.slice(6, 9)}`;
}

/**
 * Removes formatting from patient key
 */
export function unformatPatientKey(key) {
  if (!key) return '';
  return key.toString().replace(/\D/g, '');
}

/**
 * Copies text to clipboard
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    } catch (err2) {
      document.body.removeChild(textArea);
      return false;
    }
  }
}

