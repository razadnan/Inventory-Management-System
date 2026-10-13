-- CreateEnum
CREATE TYPE "ProductSource" AS ENUM ('PURCHASED', 'MANUFACTURED');

-- AlterTable
ALTER TABLE "challan_items" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "source" "ProductSource" NOT NULL DEFAULT 'PURCHASED',
ALTER COLUMN "vendorName" DROP NOT NULL;

-- CreateTable
CREATE TABLE "challan_services" (
    "id" TEXT NOT NULL,
    "challanId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "challan_services_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "challan_services_challanId_idx" ON "challan_services"("challanId");

-- AddForeignKey
ALTER TABLE "challan_services" ADD CONSTRAINT "challan_services_challanId_fkey" FOREIGN KEY ("challanId") REFERENCES "challans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
