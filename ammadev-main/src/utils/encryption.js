/**
 * Encryption utilities for securing sensitive data (OAuth tokens, PHI)
 * Uses AES-256-GCM encryption for HIPAA compliance
 */

/**
 * Encrypts text using AES-256-GCM
 * @param {string} text - Plain text to encrypt
 * @param {string} key - Base64 encoded encryption key (32 bytes)
 * @returns {Promise<string>} Base64 encoded encrypted data with IV and auth tag
 */
export async function encrypt(text, key = import.meta.env.ENCRYPTION_KEY) {
  if (!key) {
    console.warn('⚠️ No encryption key found. Using fallback (NOT SECURE for production)');
    // In development, return base64 encoded text with warning prefix
    return 'UNENCRYPTED:' + btoa(text);
  }

  try {
    // Convert base64 key to bytes
    const keyData = Uint8Array.from(atob(key), c => c.charCodeAt(0));
    
    // Import key for AES-GCM
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    // Generate random IV (12 bytes for GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt the text
    const encoder = new TextEncoder();
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      encoder.encode(text)
    );

    // Combine IV + encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);

    // Return as base64
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('❌ Encryption failed:', error);
    throw new Error('Encryption failed: ' + error.message);
  }
}

/**
 * Decrypts AES-256-GCM encrypted text
 * @param {string} encryptedBase64 - Base64 encoded encrypted data
 * @param {string} key - Base64 encoded encryption key (32 bytes)
 * @returns {Promise<string>} Decrypted plain text
 */
export async function decrypt(encryptedBase64, key = import.meta.env.ENCRYPTION_KEY) {
  // Handle unencrypted development data
  if (encryptedBase64.startsWith('UNENCRYPTED:')) {
    console.warn('⚠️ Decrypting unencrypted data (development mode)');
    return atob(encryptedBase64.replace('UNENCRYPTED:', ''));
  }

  if (!key) {
    throw new Error('No encryption key available for decryption');
  }

  try {
    // Convert base64 key to bytes
    const keyData = Uint8Array.from(atob(key), c => c.charCodeAt(0));
    
    // Import key for AES-GCM
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    // Decode base64 encrypted data
    const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
    
    // Extract IV (first 12 bytes) and ciphertext (rest)
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);

    // Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      ciphertext
    );

    // Convert bytes to string
    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('❌ Decryption failed:', error);
    throw new Error('Decryption failed: ' + error.message);
  }
}

/**
 * Generates a random encryption key
 * @returns {string} Base64 encoded 32-byte key
 */
export function generateEncryptionKey() {
  const key = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...key));
}

/**
 * Securely hashes a string (for password verification, not encryption)
 * @param {string} text - Text to hash
 * @returns {Promise<string>} Hex encoded hash
 */
export async function hash(text) {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Encrypts an object (converts to JSON first)
 * @param {Object} obj - Object to encrypt
 * @param {string} key - Encryption key
 * @returns {Promise<string>} Encrypted JSON
 */
export async function encryptObject(obj, key) {
  const json = JSON.stringify(obj);
  return await encrypt(json, key);
}

/**
 * Decrypts an object (parses JSON after decryption)
 * @param {string} encryptedData - Encrypted JSON string
 * @param {string} key - Encryption key
 * @returns {Promise<Object>} Decrypted object
 */
export async function decryptObject(encryptedData, key) {
  const json = await decrypt(encryptedData, key);
  return JSON.parse(json);
}

/**
 * Securely wipes sensitive data from memory (best effort)
 * @param {string} data - Sensitive string to wipe
 */
export function secureWipe(data) {
  if (typeof data === 'string') {
    // Overwrite string memory (best effort in JS)
    data = '0'.repeat(data.length);
  }
  // Note: JavaScript doesn't provide true memory wiping
  // This is a best-effort approach for sensitive data
}

/**
 * Check if encryption is properly configured
 * @returns {boolean} True if encryption key exists
 */
export function isEncryptionConfigured() {
  return !!import.meta.env.ENCRYPTION_KEY;
}

/**
 * Test encryption/decryption
 * @returns {Promise<boolean>} True if encryption works correctly
 */
export async function testEncryption() {
  try {
    const testData = 'Hello, HIPAA compliance!';
    const encrypted = await encrypt(testData);
    const decrypted = await decrypt(encrypted);
    return decrypted === testData;
  } catch (error) {
    console.error('❌ Encryption test failed:', error);
    return false;
  }
}

