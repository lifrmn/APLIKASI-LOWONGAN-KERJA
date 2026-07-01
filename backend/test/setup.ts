import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });
// Fallback ke .env kalau .env.test tidak ada
if (!process.env.DATABASE_URL) dotenv.config();
