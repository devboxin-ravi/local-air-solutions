-- AlterTable
ALTER TABLE `users` ADD COLUMN `username` VARCHAR(30) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `users_username_key` ON `users`(`username`);

