-- CreateTable
CREATE TABLE "AgencyLedger" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgencyLedger_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AgencyLedger" ADD CONSTRAINT "AgencyLedger_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
