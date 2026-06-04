import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedTestStations() {
  console.log('Seeding test stations...');

  // First, check what slot_status values are allowed
  const { data: enumData } = await supabase.rpc('get_enum_values', { enum_name: 'slot_status' }).single();
  console.log('Enum values:', enumData);

  // Test stations for PowerDon
  const stations = [
    {
      device_id: 'A12',
      name: 'Central Station - Main Hall',
      location_description: 'Amsterdam Centraal, Main Hall near Platform 2',
      latitude: 52.3791,
      longitude: 4.9003,
      total_slots: 6,
      status: 'online',
      hardware_version: '2.1',
      software_version: '3.4.0',
      signal_strength: 95,
    },
    {
      device_id: 'B05',
      name: 'Schiphol Airport - Departures',
      location_description: 'Schiphol Airport, Departure Hall 2',
      latitude: 52.3105,
      longitude: 4.7683,
      total_slots: 8,
      status: 'online',
      hardware_version: '2.1',
      software_version: '3.4.0',
      signal_strength: 88,
    },
    {
      device_id: 'C01',
      name: 'Rotterdam Blaak',
      location_description: 'Rotterdam Blaak Station, East Exit',
      latitude: 51.9200,
      longitude: 4.4900,
      total_slots: 4,
      status: 'online',
      hardware_version: '2.0',
      software_version: '3.3.2',
      signal_strength: 92,
    },
    {
      device_id: 'D03',
      name: 'Utrecht Centraal',
      location_description: 'Utrecht CS, Stationshal West',
      latitude: 52.0894,
      longitude: 5.1100,
      total_slots: 6,
      status: 'online',
      hardware_version: '2.1',
      software_version: '3.4.0',
      signal_strength: 90,
    },
    {
      device_id: 'E07',
      name: 'Den Haag HS',
      location_description: 'Den Haag Hollands Spoor, Main Entrance',
      latitude: 52.0692,
      longitude: 4.3256,
      total_slots: 4,
      status: 'offline',
      hardware_version: '2.0',
      software_version: '3.3.2',
      signal_strength: 0,
    },
  ];

  // Insert stations
  const { data: insertedStations, error: stationsError } = await supabase
    .from('stations')
    .upsert(stations, { onConflict: 'device_id' })
    .select();

  if (stationsError) {
    console.error('Error inserting stations:', stationsError);
    return;
  }

  console.log(`Inserted ${insertedStations?.length} stations`);

  // Create slots for each station using raw SQL to handle enum properly
  for (const station of insertedStations || []) {
    // Delete existing slots first
    await supabase.from('slots').delete().eq('station_id', station.id);

    for (let i = 1; i <= station.total_slots; i++) {
      // Make some slots occupied, some available
      const hasBank = i <= Math.floor(station.total_slots * 0.6);
      const batteryLevel = hasBank ? Math.floor(Math.random() * 40) + 60 : null;

      const { error: slotError } = await supabase.from('slots').insert({
        station_id: station.id,
        slot_number: i,
        battery_level: batteryLevel,
        is_charging: hasBank && batteryLevel !== null && batteryLevel < 100,
      });

      if (slotError) {
        console.error(`Error inserting slot ${i} for ${station.device_id}:`, slotError.message);
      }
    }
    console.log(`Created ${station.total_slots} slots for station ${station.device_id}`);
  }

  console.log('\n=== Test QR Code URLs ===\n');
  for (const station of stations) {
    const status = station.status === 'online' ? '' : ' (OFFLINE)';
    console.log(`${station.name}${status}:`);
    console.log(`https://app.powerdon.nl?station=${station.device_id}\n`);
  }
}

seedTestStations().catch(console.error);
