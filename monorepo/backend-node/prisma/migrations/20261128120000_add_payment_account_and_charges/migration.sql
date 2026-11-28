-- AlterTable
ALTER TABLE `payments` ADD COLUMN `charge_amount` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `charge_percent` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    ADD COLUMN `receiving_account` VARCHAR(150) NULL;

