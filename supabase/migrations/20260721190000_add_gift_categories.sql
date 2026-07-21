-- Separate music and leisure activities from the existing categories while
-- keeping every historical value intact for existing gifts.

ALTER TYPE public.gift_category
  ADD VALUE IF NOT EXISTS 'musique' BEFORE 'autre';

ALTER TYPE public.gift_category
  ADD VALUE IF NOT EXISTS 'loisirs' BEFORE 'autre';
