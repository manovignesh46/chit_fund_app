-- CreateTable
CREATE TABLE "Message" (
    "id" SERIAL NOT NULL,
    "dataOwnerId" INTEGER NOT NULL,
    "senderId" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageReadState" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "dataOwnerId" INTEGER NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageReadState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Message_dataOwnerId_createdAt_idx" ON "Message"("dataOwnerId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE INDEX "MessageReadState_dataOwnerId_idx" ON "MessageReadState"("dataOwnerId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageReadState_userId_dataOwnerId_key" ON "MessageReadState"("userId", "dataOwnerId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_dataOwnerId_fkey" FOREIGN KEY ("dataOwnerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageReadState" ADD CONSTRAINT "MessageReadState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
