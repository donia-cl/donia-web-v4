
-- Tabla para códigos OTP de seguridad
CREATE TABLE IF NOT EXISTS public.security_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    code TEXT NOT NULL,
    type TEXT NOT NULL, -- 'password_change', 'email_change', '2fa_toggle', 'login_2fa', etc.
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    used_at TIMESTAMPTZ
);

-- Añadir columna de 2FA a perfiles si no existe
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT FALSE;

-- Índice para limpiezas rápidas
CREATE INDEX IF NOT EXISTS idx_otps_user_type ON public.security_otps(user_id, type);

-- Política de seguridad (solo accesible via Service Role / API)
ALTER TABLE public.security_otps ENABLE ROW LEVEL SECURITY;
