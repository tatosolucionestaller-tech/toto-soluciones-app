ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS equipment_hours numeric(12,1);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.service_requests'::regclass
      AND conname='service_requests_equipment_hours_range'
  ) THEN
    ALTER TABLE public.service_requests
      ADD CONSTRAINT service_requests_equipment_hours_range
      CHECK (equipment_hours IS NULL OR (equipment_hours >= 0 AND equipment_hours <= 1000000));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.submit_express_request(
  p_request_key uuid, p_ip_hash text, p_contact_hash text, p_name text, p_phone text,
  p_email text, p_complaint text, p_service_type text, p_asset_type text,
  p_priority text, p_contact_method text, p_plate text, p_make text, p_model text,
  p_model_year smallint, p_odometer_km integer, p_preferred_at timestamptz,
  p_engine text, p_vin text, p_equipment_hours numeric
) RETURNS TABLE(request_id uuid, request_status text, is_duplicate boolean)
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE v_result record;
BEGIN
  IF current_user <> 'service_role' THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF p_asset_type NOT IN ('auto','motorcycle','jet_ski','boat','sailboat','generator','large_engine')
     OR length(coalesce(p_engine,'')) > 100 OR length(coalesce(p_vin,'')) > 80
     OR (p_equipment_hours IS NOT NULL AND (
       p_equipment_hours < 0 OR p_equipment_hours > 1000000
       OR p_asset_type NOT IN ('jet_ski','boat','sailboat','generator','large_engine')
     ))
  THEN RAISE EXCEPTION 'Invalid equipment details'; END IF;

  SELECT * INTO v_result FROM public.submit_express_request(
    p_request_key,p_ip_hash,p_contact_hash,p_name,p_phone,p_email,p_complaint,
    p_service_type,p_asset_type,p_priority,p_contact_method,p_plate,p_make,p_model,
    p_model_year,p_odometer_km,p_preferred_at
  );
  IF NOT v_result.is_duplicate THEN
    UPDATE public.service_requests
      SET engine=nullif(btrim(p_engine),''),
          vin=nullif(btrim(p_vin),''),
          equipment_hours=p_equipment_hours
      WHERE id=v_result.request_id;
  END IF;
  RETURN QUERY SELECT v_result.request_id,v_result.request_status,v_result.is_duplicate;
END
$function$;

REVOKE ALL ON FUNCTION public.submit_express_request(uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,smallint,integer,timestamptz,text,text,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_express_request(uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,smallint,integer,timestamptz,text,text,numeric) TO service_role;

CREATE OR REPLACE FUNCTION public.create_phone_intake(
  p_actor uuid, p_request_key uuid, p_customer_name text, p_customer_phone text,
  p_customer_email text, p_plate text, p_make text, p_model text, p_model_year smallint,
  p_complaint text, p_priority text, p_contact_method text, p_appointment_at timestamptz,
  p_appointment_end timestamptz, p_workstation_id smallint, p_asset_type text,
  p_engine text, p_vin text, p_equipment_hours numeric
) RETURNS uuid
LANGUAGE plpgsql
SET search_path TO ''
AS $function$
DECLARE v_id uuid;
BEGIN
  IF current_user <> 'service_role' THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF p_asset_type NOT IN ('auto','motorcycle','jet_ski','boat','sailboat','generator','large_engine')
     OR length(coalesce(p_engine,'')) > 100 OR length(coalesce(p_vin,'')) > 80
     OR (p_equipment_hours IS NOT NULL AND (
       p_equipment_hours < 0 OR p_equipment_hours > 1000000
       OR p_asset_type NOT IN ('jet_ski','boat','sailboat','generator','large_engine')
     ))
  THEN RAISE EXCEPTION 'Invalid equipment details'; END IF;

  v_id := public.create_phone_intake(
    p_actor,p_request_key,p_customer_name,p_customer_phone,p_customer_email,p_plate,
    p_make,p_model,p_model_year,p_complaint,p_priority,p_contact_method,
    p_appointment_at,p_appointment_end,p_workstation_id
  );
  UPDATE public.service_requests
    SET asset_type=p_asset_type,
        engine=nullif(btrim(p_engine),''),
        vin=nullif(btrim(p_vin),''),
        equipment_hours=p_equipment_hours
    WHERE id=v_id;
  RETURN v_id;
END
$function$;

REVOKE ALL ON FUNCTION public.create_phone_intake(uuid,uuid,text,text,text,text,text,text,smallint,text,text,text,timestamptz,timestamptz,smallint,text,text,text,numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_phone_intake(uuid,uuid,text,text,text,text,text,text,smallint,text,text,text,timestamptz,timestamptz,smallint,text,text,text,numeric) TO service_role;
