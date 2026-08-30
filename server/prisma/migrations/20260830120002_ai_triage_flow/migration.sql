-- Official classification stays empty until an agent confirms AI output.
ALTER TABLE "Ticket" ALTER COLUMN "category" DROP NOT NULL;
ALTER TABLE "Ticket" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "Ticket" ALTER COLUMN "priority" DROP NOT NULL;
ALTER TABLE "Ticket" ALTER COLUMN "priority" DROP DEFAULT;

-- Store AI output as unvalidated raw text.
ALTER TABLE "Ticket" ALTER COLUMN "aiPriority" TYPE TEXT USING "aiPriority"::text;

ALTER TABLE "Ticket" ADD COLUMN "aiFailed" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Ticket" SET "category" = 'Billing' WHERE lower("category") = 'billing';
UPDATE "Ticket" SET "category" = 'Technical' WHERE lower("category") = 'technical';
UPDATE "Ticket" SET "category" = 'Account' WHERE lower("category") = 'account';
UPDATE "Ticket" SET "category" = 'General' WHERE lower("category") IN ('general', 'shipping');
