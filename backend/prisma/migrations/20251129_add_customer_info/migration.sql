-- AlterTable: Add Customer Information File (CIF) fields
ALTER TABLE "users" ADD COLUMN "phone" TEXT;
ALTER TABLE "users" ADD COLUMN "address" TEXT;
ALTER TABLE "users" ADD COLUMN "city" TEXT;
ALTER TABLE "users" ADD COLUMN "state" TEXT;
ALTER TABLE "users" ADD COLUMN "postalCode" TEXT;
ALTER TABLE "users" ADD COLUMN "country" TEXT DEFAULT 'Canada';
ALTER TABLE "users" ADD COLUMN "dateOfBirth" TIMESTAMP(3);
