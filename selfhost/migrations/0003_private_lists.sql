-- No enclosing transaction: PostgreSQL must commit the enum value before using it.
ALTER TYPE list_visibility ADD VALUE IF NOT EXISTS 'private';
