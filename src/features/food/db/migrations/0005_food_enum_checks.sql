-- migrate:up
UPDATE places SET cuisines = '{other}' WHERE overlay_type = 'food' AND cardinality(cuisines) = 0;

ALTER TABLE places ADD CONSTRAINT places_food_category_chk CHECK (
  overlay_type <> 'food' OR category IN (
    'restaurant','street_food','cafe','tea_stall','sweets_bakery','fast_food','food_court','dessert','other'));

ALTER TABLE places ADD CONSTRAINT places_food_cuisines_chk CHECK (
  overlay_type <> 'food' OR (
    cardinality(cuisines) >= 1 AND
    cuisines <@ ARRAY['bangladeshi','biryani_kacchi','fish_seafood','kebab_grill','pitha',
                      'mishti','chinese_thai','indian','western','other']::text[]));

-- migrate:down
ALTER TABLE places DROP CONSTRAINT places_food_cuisines_chk;
ALTER TABLE places DROP CONSTRAINT places_food_category_chk;
