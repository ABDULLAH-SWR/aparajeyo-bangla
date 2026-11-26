-- osm2pgsql Flex Lua style for Aparajeyo Food Overlay (Guide §5.2)

local food_table = osm2pgsql.define_table({
  name = 'osm_food_staging',
  ids = { type = 'any', type_column = 'osm_type', id_column = 'osm_id' },
  columns = {
    { column = 'tags', type = 'jsonb' },
    { column = 'geom', type = 'point', projection = 4326, not_null = true },
  }
})

local FOOD_AMENITIES = {
  restaurant = true,
  fast_food = true,
  cafe = true,
  food_court = true,
  ice_cream = true,
  street_vendor = true,
  vending_machine = true,
}

local FOOD_SHOPS = {
  confectionery = true,
  pastry = true,
  bakery = true,
  ice_cream = true,
  tea = true,
  kiosk = true,
}

local KEEP_PREFIXES = { 'addr:', 'diet:' }
local KEEP_KEYS = {
  name = true,
  ['name:bn'] = true,
  ['name:en'] = true,
  amenity = true,
  shop = true,
  cuisine = true,
  opening_hours = true,
  phone = true,
  ['contact:phone'] = true,
  website = true,
  ['contact:website'] = true,
  wikidata = true,
  wikimedia_commons = true,
  image = true,
  brand = true,
  takeaway = true,
  vending = true,
}

local function filter_tags(raw)
  local amenity = raw.amenity
  local shop = raw.shop
  if not (FOOD_AMENITIES[amenity] or FOOD_SHOPS[shop]) then
    return nil
  end
  if amenity == 'vending_machine' and raw.vending ~= 'food' then
    return nil
  end
  if shop == 'kiosk' and not raw.cuisine then
    return nil
  end
  if not (raw.name or raw['name:en'] or raw['name:bn']) then
    return nil
  end

  local kept = {}
  for k, v in pairs(raw) do
    if KEEP_KEYS[k] then
      kept[k] = v
    else
      for _, pfx in ipairs(KEEP_PREFIXES) do
        if k:sub(1, #pfx) == pfx then
          kept[k] = v
          break
        end
      end
    end
  end
  return kept
end

function osm2pgsql.process_node(object)
  local kept = filter_tags(object.tags)
  if not kept then return end
  food_table:insert({
    tags = kept,
    geom = object:as_point(),
  })
end

function osm2pgsql.process_way(object)
  local kept = filter_tags(object.tags)
  if not kept then return end
  local geom
  if object.is_closed then
    geom = object:as_polygon():centroid()
  else
    geom = object:as_linestring():centroid()
  end
  if geom then
    food_table:insert({
      tags = kept,
      geom = geom,
    })
  end
end
