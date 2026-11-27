-- Simplified boundaries for importer tests: 4 districts (rectangles) and their upazilas.
--
-- BD3026 Dhaka        lng 90.30-90.50, lat 23.70-23.90   upazilas stop at lat 23.895, short of the border
-- BD3033 Gazipur      lng 90.30-90.50, lat 23.90-24.10   its upazila overlaps 550 m south into Dhaka
-- BD5010 Bogura       lng 89.30-89.50, lat 24.80-25.00
-- BD2022 Cox's Bazar  lng 91.90-92.10, lat 21.30-21.50   coastal: the sea is west of lng 91.90

INSERT INTO geo_districts (id, name_en, name_bn, geom) VALUES
  ('BD3026', 'Dhaka',       'ঢাকা',       ST_Multi(ST_MakeEnvelope(90.30, 23.70, 90.50, 23.90, 4326))),
  ('BD3033', 'Gazipur',     'গাজীপুর',    ST_Multi(ST_MakeEnvelope(90.30, 23.90, 90.50, 24.10, 4326))),
  ('BD5010', 'Bogura',      'বগুড়া',      ST_Multi(ST_MakeEnvelope(89.30, 24.80, 89.50, 25.00, 4326))),
  ('BD2022', 'Cox''s Bazar', 'কক্সবাজার', ST_Multi(ST_MakeEnvelope(91.90, 21.30, 92.10, 21.50, 4326)));

INSERT INTO geo_upazilas (id, district_id, name_en, name_bn, geom) VALUES
  ('BD30260014', 'BD3026', 'Dhanmondi',     '', ST_Multi(ST_MakeEnvelope(90.30, 23.70, 90.40, 23.895, 4326))),
  ('BD30260098', 'BD3026', 'Dhaka East',    '', ST_Multi(ST_MakeEnvelope(90.40, 23.70, 90.50, 23.895, 4326))),
  ('BD30330030', 'BD3033', 'Gazipur Sadar', '', ST_Multi(ST_MakeEnvelope(90.30, 23.895, 90.50, 24.10, 4326))),
  ('BD50100020', 'BD5010', 'Bogura Sadar',  '', ST_Multi(ST_MakeEnvelope(89.30, 24.80, 89.50, 25.00, 4326))),
  ('BD20220024', 'BD2022', 'Cox''s South',  '', ST_Multi(ST_MakeEnvelope(91.90, 21.30, 92.10, 21.40, 4326))),
  ('BD20220066', 'BD2022', 'Cox''s North',  '', ST_Multi(ST_MakeEnvelope(91.90, 21.40, 92.10, 21.50, 4326)));
