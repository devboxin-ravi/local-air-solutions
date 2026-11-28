-- AlterTable
ALTER TABLE `customer_addresses` MODIFY `pincode` VARCHAR(6) NULL;

-- AlterTable
ALTER TABLE `customers` ADD COLUMN `source` ENUM('ADMIN', 'APP') NOT NULL DEFAULT 'ADMIN';

-- AlterTable
ALTER TABLE `staff_profiles` ADD COLUMN `company_mobile` VARCHAR(15) NULL;


-- Customers that have an app login were registered from the app.
UPDATE `customers` SET `source` = 'APP' WHERE `user_id` IS NOT NULL;
