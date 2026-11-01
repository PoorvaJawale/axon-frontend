CREATE OR REPLACE FUNCTION public.axon_apply_billing(p_user_id text, p_plan text, p_start timestamp with time zone, p_end timestamp with time zone, p_event_at timestamp with time zone, p_custom_limit bigint DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE a public.axon_account_quota%ROWTYPE; v_limit bigint;
BEGIN
  IF p_user_id IS NULL OR length(p_user_id)=0 OR p_plan IS NULL OR
     p_plan NOT IN ('free','pro','enterprise') OR p_event_at IS NULL THEN
    RAISE EXCEPTION 'Invalid billing input';
  END IF;
  IF p_plan<>'free' AND (p_start IS NULL OR p_end IS NULL OR p_end<=p_start) THEN
    RAISE EXCEPTION 'Paid plan requires verified billing-period boundaries';
  END IF;
  IF p_plan='enterprise' AND (p_custom_limit IS NULL OR p_custom_limit<=0) THEN
    RAISE EXCEPTION 'Enterprise requires an agreed positive limit';
  END IF;
  SELECT * INTO a FROM public.axon_account_quota WHERE user_id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Initialize account quota before billing'; END IF;
  IF p_event_at<a.billing_event_at OR
     (p_plan<>'free' AND a.period_start IS NOT NULL AND p_start<a.period_start) THEN
    RETURN jsonb_build_object('success',true,'ignored',true,'user_id',a.user_id,'plan',a.plan);
  END IF;
  v_limit:=CASE p_plan WHEN 'free' THEN 100 WHEN 'pro' THEN 5000 ELSE p_custom_limit END;
  UPDATE public.axon_account_quota SET
    plan=p_plan,
    paid_used=CASE WHEN p_plan<>'free' AND period_start IS DISTINCT FROM p_start
                   THEN 0 ELSE paid_used END,
    period_start=CASE WHEN p_plan='free' THEN period_start ELSE p_start END,
    period_end=CASE WHEN p_plan='free' THEN period_end ELSE p_end END,
    custom_limit=CASE WHEN p_plan='enterprise' THEN p_custom_limit ELSE custom_limit END,
    billing_event_at=p_event_at
  WHERE user_id=p_user_id;
  -- Compatibility fields only: authoritative counters are in axon_account_quota.
  UPDATE public.api_keys SET plan=p_plan,request_limit=v_limit,updated_at=now()
  WHERE user_id=p_user_id;
  RETURN jsonb_build_object('success',true,'ignored',false,'user_id',p_user_id,'plan',p_plan);
END;
$function$
;
CREATE OR REPLACE FUNCTION public.axon_release_validation(p_user_id text, p_request_id text)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE r public.axon_quota_reservation%ROWTYPE;
BEGIN
  -- Match the lock order used by reservation and billing.
  PERFORM 1 FROM public.axon_account_quota WHERE user_id=p_user_id FOR UPDATE;
  UPDATE public.axon_quota_reservation SET released=true
  WHERE user_id=p_user_id AND request_id=p_request_id AND released=false
  RETURNING * INTO r;
  IF NOT FOUND THEN RETURN false; END IF;
  IF r.bucket='free' THEN
    UPDATE public.axon_account_quota SET free_used=GREATEST(free_used-1,0)
    WHERE user_id=p_user_id;
  ELSE
    -- A delayed refund for an old period must not reduce this period's usage.
    UPDATE public.axon_account_quota SET paid_used=GREATEST(paid_used-1,0)
    WHERE user_id=p_user_id AND period_start=r.period_start;
  END IF;
  RETURN true;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.axon_reserve_validation(p_hash text, p_request_id text, p_skip boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  k record;
  a public.axon_account_quota%ROWTYPE;
  v_limit bigint;
  v_used bigint;
  v_base jsonb;
  v_inserted text;
BEGIN
  -- A separate account lock serializes all keys belonging to the same user.
  SELECT * INTO k FROM public.api_keys
  WHERE hashed_api_key = p_hash AND is_active = true AND expires_at > now();
  IF NOT FOUND THEN
    RETURN jsonb_build_object('authenticated',false,'quota_allowed',false,'http_status',401);
  END IF;
  SELECT * INTO a FROM public.axon_account_quota WHERE user_id=k.user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('authenticated',true,'quota_allowed',false,
      'http_status',503,'reason','Account quota has not been initialized');
  END IF;
  v_base := jsonb_build_object('authenticated',true,'id',k.id,'key_id',k.id,
    'user_id',k.user_id,'email',k.email,'webhook_secret',k.webhook_secret,
    'plan',a.plan,'reservation_id',p_request_id);
  IF p_skip THEN
    RETURN v_base || jsonb_build_object('quota_allowed',true,'reserved',false);
  END IF;
  IF p_request_id IS NULL OR length(p_request_id)=0 THEN
    RAISE EXCEPTION 'Missing server-generated request id';
  END IF;
  IF EXISTS (SELECT 1 FROM public.axon_quota_reservation WHERE request_id=p_request_id) THEN
    RETURN v_base || jsonb_build_object('quota_allowed',false,'http_status',409,
      'reason','This execution already reserved a validation');
  END IF;
  IF a.plan='free' THEN
    v_limit:=100; v_used:=a.free_used;
  ELSE
    IF a.period_start IS NULL OR a.period_end IS NULL OR
       now()<a.period_start OR now()>=a.period_end THEN
      RETURN v_base || jsonb_build_object('quota_allowed',false,'http_status',503,
        'reason','Paid billing period is not active; contact support');
    END IF;
    v_limit:=CASE WHEN a.plan='pro' THEN 5000 ELSE a.custom_limit END;
    v_used:=a.paid_used;
  END IF;
  IF v_used>=v_limit THEN
    RETURN v_base || jsonb_build_object('quota_allowed',false,'http_status',429,
      'reason',CASE WHEN a.plan='free' THEN 'Free allowance exhausted'
                    ELSE 'Monthly validation limit reached' END);
  END IF;
  INSERT INTO public.axon_quota_reservation(request_id,user_id,bucket,period_start)
  VALUES(p_request_id,a.user_id,CASE WHEN a.plan='free' THEN 'free' ELSE 'paid' END,
         CASE WHEN a.plan='free' THEN NULL ELSE a.period_start END)
  ON CONFLICT(request_id) DO NOTHING RETURNING request_id INTO v_inserted;
  IF v_inserted IS NULL THEN
    RETURN v_base || jsonb_build_object('quota_allowed',false,'http_status',409,
      'reason','Duplicate execution reservation');
  END IF;
  IF a.plan='free' THEN
    UPDATE public.axon_account_quota SET free_used=free_used+1 WHERE user_id=a.user_id;
  ELSE
    UPDATE public.axon_account_quota SET paid_used=paid_used+1 WHERE user_id=a.user_id;
  END IF;
  UPDATE public.api_keys SET last_used_at=now() WHERE id=k.id;
  RETURN v_base || jsonb_build_object('quota_allowed',true,'reserved',true,
    'request_limit',v_limit,'usage_used',v_used+1);
END;
$function$
;
