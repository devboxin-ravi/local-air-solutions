-- AlterTable
ALTER TABLE `invoice_items` ADD COLUMN `stock_item_id` INTEGER NULL;

-- CreateTable
CREATE TABLE `stock_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `branch_id` INTEGER NOT NULL,
    `code` VARCHAR(30) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `unit` VARCHAR(20) NOT NULL DEFAULT 'PCS',
    `hsn_code` VARCHAR(20) NULL,
    `sale_price` DECIMAL(12, 2) NOT NULL DEFAULT 0,
    `gst_rate` DECIMAL(5, 2) NOT NULL DEFAULT 18,
    `quantity` INTEGER NOT NULL DEFAULT 0,
    `low_stock_level` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `stock_items_branch_id_code_key`(`branch_id`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `stock_items` ADD CONSTRAINT `stock_items_branch_id_fkey` FOREIGN KEY (`branch_id`) REFERENCES `branches`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `invoice_items` ADD CONSTRAINT `invoice_items_stock_item_id_fkey` FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

