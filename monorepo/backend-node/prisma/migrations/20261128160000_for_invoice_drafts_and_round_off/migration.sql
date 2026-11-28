-- AlterTable
ALTER TABLE `invoices` ADD COLUMN `round_off` DECIMAL(12, 2) NOT NULL DEFAULT 0;


-- For Invoice permissions, granted to the system admin roles (the seed does not add new codes to roles that already have permissions).
INSERT IGNORE INTO `permissions` (`code`, `module`, `action`) VALUES
  ('forInvoice.view', 'forInvoice', 'view'),
  ('forInvoice.create', 'forInvoice', 'create'),
  ('forInvoice.edit', 'forInvoice', 'edit'),
  ('forInvoice.audit', 'forInvoice', 'audit');
INSERT IGNORE INTO `role_permissions` (`role_id`, `permission_id`)
  SELECT r.`id`, p.`id` FROM `roles` r JOIN `permissions` p ON p.`module` = 'forInvoice'
  WHERE r.`code` IN ('SUPER_ADMIN', 'COMPANY_ADMIN', 'BRANCH_MANAGER');