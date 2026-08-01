-- CreateEnum
CREATE TYPE "ServerRuntime" AS ENUM ('HOST', 'SYSTEMD_NSPAWN', 'DOCKER_HOST', 'REMOTE');

-- AlterTable
ALTER TABLE "Server" ADD COLUMN     "machinePath" TEXT,
ADD COLUMN     "runtime" "ServerRuntime" NOT NULL DEFAULT 'REMOTE';
