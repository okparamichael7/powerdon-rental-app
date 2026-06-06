-- Restrict station_slots reads to staff/service; public availability uses API routes (service role).

DROP POLICY IF EXISTS "slots_select_public" ON station_slots;

DROP POLICY IF EXISTS "slots_select_staff" ON station_slots;
CREATE POLICY "slots_select_staff" ON station_slots
  FOR SELECT USING (is_staff() OR auth.role() = 'service_role');
