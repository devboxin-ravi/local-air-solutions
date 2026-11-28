-- AlterTable
ALTER TABLE `booking_items` ADD COLUMN `is_extra` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `job_notes` ADD COLUMN `kind` ENUM('NOTE', 'EXTRA_WORK', 'FINDING') NOT NULL DEFAULT 'NOTE';

