import { defineConfig } from 'drizzle-kit';
import { Resource } from 'sst';

export default defineConfig({
  out: './drizzle',
  schema: 'src/db/schema.ts',
  dialect: 'sqlite',
  driver: 'd1-http',
  dbCredentials: {
    accountId: Resource.CloudflareAccountID.value,
    databaseId: Resource.MyDatabaseId.value,
    token: Resource.CloudflareApiToken.value,
  },
});

