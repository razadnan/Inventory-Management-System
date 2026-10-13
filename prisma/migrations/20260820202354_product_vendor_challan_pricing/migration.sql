/*
  Warnings:

  - You are about to drop the column `unitPrice` on the `products` table. All the data in the column will be lost.
  - Added the required column `unitPrice` to the `challan_items` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vendorName` to the `products` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "challan_items" ADD COLUMN     "unitPrice" DECIMAL(12,2) NOT NULL;

-- AlterTable
ALTER TABLE "products" DROP COLUMN "unitPrice",
ADD COLUMN     "vendorName" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "products_vendorName_idx" ON "products"("vendorName");
