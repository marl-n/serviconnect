-- CreateTable
CREATE TABLE "Province" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "geonamesCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Province_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Town" (
    "id" TEXT NOT NULL,
    "provinceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "geonameId" INTEGER,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "population" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Town_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Suburb" (
    "id" TEXT NOT NULL,
    "townId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "geonameId" INTEGER,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Suburb_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessServiceArea" (
    "businessId" TEXT NOT NULL,
    "townId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessServiceArea_pkey" PRIMARY KEY ("businessId","townId")
);

-- AlterTable: additive only — both columns nullable, existing rows untouched.
ALTER TABLE "ServiceRequest"
ADD COLUMN "townId" TEXT,
ADD COLUMN "suburbId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Province_name_key" ON "Province"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Province_geonamesCode_key" ON "Province"("geonamesCode");

-- CreateIndex
CREATE UNIQUE INDEX "Town_geonameId_key" ON "Town"("geonameId");

-- CreateIndex
CREATE INDEX "Town_provinceId_idx" ON "Town"("provinceId");

-- CreateIndex
CREATE UNIQUE INDEX "Town_provinceId_name_key" ON "Town"("provinceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Suburb_geonameId_key" ON "Suburb"("geonameId");

-- CreateIndex
CREATE INDEX "Suburb_townId_idx" ON "Suburb"("townId");

-- CreateIndex
CREATE UNIQUE INDEX "Suburb_townId_name_key" ON "Suburb"("townId", "name");

-- CreateIndex
CREATE INDEX "BusinessServiceArea_townId_idx" ON "BusinessServiceArea"("townId");

-- CreateIndex
CREATE INDEX "ServiceRequest_townId_idx" ON "ServiceRequest"("townId");

-- AddForeignKey
ALTER TABLE "Town" ADD CONSTRAINT "Town_provinceId_fkey" FOREIGN KEY ("provinceId") REFERENCES "Province"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suburb" ADD CONSTRAINT "Suburb_townId_fkey" FOREIGN KEY ("townId") REFERENCES "Town"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessServiceArea" ADD CONSTRAINT "BusinessServiceArea_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessServiceArea" ADD CONSTRAINT "BusinessServiceArea_townId_fkey" FOREIGN KEY ("townId") REFERENCES "Town"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_townId_fkey" FOREIGN KEY ("townId") REFERENCES "Town"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceRequest" ADD CONSTRAINT "ServiceRequest_suburbId_fkey" FOREIGN KEY ("suburbId") REFERENCES "Suburb"("id") ON DELETE SET NULL ON UPDATE CASCADE;
