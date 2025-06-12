import { Resource } from 'sst';
import { drizzle } from 'drizzle-orm/d1';

export const getDb = () => drizzle(Resource.DonegeonDB);

