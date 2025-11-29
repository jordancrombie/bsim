/**
 * Storage abstraction layer for file uploads
 * Supports both local filesystem (development) and S3 (production)
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

// Storage configuration
const STORAGE_TYPE = process.env.STORAGE_TYPE || 'local'; // 'local' or 's3'
const UPLOAD_DIR = process.env.UPLOAD_DIR || '/app/uploads';

// S3 configuration
const S3_BUCKET = process.env.S3_BUCKET || '';
const S3_REGION = process.env.S3_REGION || 'us-east-1';
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID || '';
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY || '';
const S3_ENDPOINT = process.env.S3_ENDPOINT || undefined; // Optional: for S3-compatible services
const CLOUDFRONT_URL = process.env.CLOUDFRONT_URL || ''; // Optional: CloudFront distribution URL

// Initialize S3 client (lazy initialization)
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    const config: {
      region: string;
      credentials: { accessKeyId: string; secretAccessKey: string };
      endpoint?: string;
      forcePathStyle?: boolean;
    } = {
      region: S3_REGION,
      credentials: {
        accessKeyId: S3_ACCESS_KEY_ID,
        secretAccessKey: S3_SECRET_ACCESS_KEY,
      },
    };

    // Support for S3-compatible services (MinIO, DigitalOcean Spaces, etc.)
    if (S3_ENDPOINT) {
      config.endpoint = S3_ENDPOINT;
      config.forcePathStyle = true;
    }

    s3Client = new S3Client(config);
  }
  return s3Client;
}

/**
 * Check if S3 storage is configured
 */
export function isS3Configured(): boolean {
  return STORAGE_TYPE === 's3' && !!S3_BUCKET && !!S3_ACCESS_KEY_ID && !!S3_SECRET_ACCESS_KEY;
}

/**
 * Get the storage type being used
 */
export function getStorageType(): 'local' | 's3' {
  return isS3Configured() ? 's3' : 'local';
}

interface UploadResult {
  url: string;
  key: string;
}

/**
 * Upload a file to storage (S3 or local filesystem)
 */
export async function uploadFile(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<UploadResult> {
  if (isS3Configured()) {
    return uploadToS3(buffer, filename, contentType);
  }
  return uploadToLocal(buffer, filename);
}

/**
 * Delete a file from storage (S3 or local filesystem)
 */
export async function deleteFile(urlOrKey: string): Promise<void> {
  if (isS3Configured()) {
    return deleteFromS3(urlOrKey);
  }
  return deleteFromLocal(urlOrKey);
}

/**
 * Upload file to S3
 */
async function uploadToS3(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<UploadResult> {
  const client = getS3Client();
  const key = `uploads/${filename}`;

  const command = new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    // Make the object publicly readable
    ACL: 'public-read',
    // Cache for 1 year (immutable content with unique filenames)
    CacheControl: 'public, max-age=31536000, immutable',
  });

  await client.send(command);

  // Return CloudFront URL if configured, otherwise S3 URL
  let url: string;
  if (CLOUDFRONT_URL) {
    url = `${CLOUDFRONT_URL}/${key}`;
  } else if (S3_ENDPOINT) {
    // S3-compatible service URL
    url = `${S3_ENDPOINT}/${S3_BUCKET}/${key}`;
  } else {
    // Standard S3 URL
    url = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
  }

  return { url, key };
}

/**
 * Delete file from S3
 */
async function deleteFromS3(urlOrKey: string): Promise<void> {
  const client = getS3Client();

  // Extract the key from a full URL or use as-is if it's already a key
  let key = urlOrKey;
  if (urlOrKey.startsWith('http')) {
    // Extract key from URL
    const url = new URL(urlOrKey);
    key = url.pathname.slice(1); // Remove leading slash

    // Handle CloudFront URLs
    if (CLOUDFRONT_URL && urlOrKey.startsWith(CLOUDFRONT_URL)) {
      key = urlOrKey.replace(CLOUDFRONT_URL + '/', '');
    }
  }

  const command = new DeleteObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
  });

  await client.send(command);
}

/**
 * Upload file to local filesystem
 */
async function uploadToLocal(
  buffer: Buffer,
  filename: string
): Promise<UploadResult> {
  // Ensure upload directory exists
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }

  const filepath = path.join(UPLOAD_DIR, filename);
  await writeFile(filepath, buffer);

  // Return URL path (served by backend via /uploads/)
  const url = `/uploads/${filename}`;
  return { url, key: filename };
}

/**
 * Delete file from local filesystem
 */
async function deleteFromLocal(urlOrKey: string): Promise<void> {
  // Extract filename from URL or use as-is
  let filename = urlOrKey;
  if (urlOrKey.startsWith('/uploads/')) {
    filename = urlOrKey.replace('/uploads/', '');
  }

  const filepath = path.join(UPLOAD_DIR, filename);

  try {
    if (existsSync(filepath)) {
      await unlink(filepath);
    }
  } catch (err) {
    console.error('Failed to delete local file:', err);
    throw err;
  }
}
