-- PRO-129a: Create EmployeeStatus enum
-- Must commit before the column referencing this type can be added.

CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'REASSESSMENT_DUE', 'IN_TRANSITION');
