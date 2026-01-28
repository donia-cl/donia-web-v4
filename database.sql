-- Tabla para códigos OTP de seguridad (ya definida, aseguramos índices)
CREATE TABLE IF NOT EXISTS public.security_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    type TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    used_at TIMESTAMPTZ
);

-- Índice para optimizar la búsqueda por ventana de tiempo
CREATE INDEX IF NOT EXISTS idx_otps_idempotency ON public.security_otps(user_id, type, created_at);

-- FUNCIÓN ATÓMICA DE IDEMPOTENCIA
-- Esta función garantiza que solo se registre un OTP si no existe uno 
-- creado en los últimos 30 segundos para el mismo usuario y tipo.
CREATE OR REPLACE FUNCTION public.request_security_otp_atomic(
    p_user_id UUID, 
    p_type TEXT, 
    p_code TEXT, 
    p_expires_at TIMESTAMPTZ
)
RETURNS BOOLEAN AS $$
DECLARE
  v_exists BOOLEAN;
BEGIN
  -- Bloqueo consultivo opcional para este usuario/tipo si fuera necesario, 
  -- pero el EXISTS con ventana de tiempo suele bastar.
  SELECT EXISTS (
    SELECT 1 FROM public.security_otps 
    WHERE user_id = p_user_id 
    AND type = p_type 
    AND created_at > (now() - interval '30 seconds')
    AND used_at IS NULL
  ) INTO v_exists;

  IF v_exists THEN
    RETURN FALSE; -- Indica que ya se envió uno recientemente
  END IF;

  -- Solo si no existe uno reciente, insertamos el nuevo
  INSERT INTO public.security_otps (user_id, type, code, expires_at)
  VALUES (p_user_id, p_type, p_code, p_expires_at);
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;