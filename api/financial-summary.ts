
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { userId, type } = req.query;

  if (!userId) return res.status(400).json({ error: 'Se requiere ID de usuario' });

  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = createClient(supabaseUrl!, serviceRoleKey!);

  try {
    if (type === 'summary') {
      // Usar la VISTA para que effective_status determine la disponibilidad de fondos
      const { data: campaigns, error: cError } = await supabase
        .from('campaigns_with_status')
        .select('id, titulo, recaudado, effective_status')
        .eq('owner_id', userId); 

      if (cError) throw cError;

      const { data: withdrawals } = await supabase
        .from('withdrawals')
        .select('monto, estado, campaign_id')
        .eq('user_id', userId);

      const withdrawalData = withdrawals || [];

      let totalRecaudado = 0;
      let disponibleRetiro = 0;
      let enCursoNoDisponible = 0;

      campaigns?.forEach(c => {
        const montoRecaudado = Number(c.recaudado) || 0;
        totalRecaudado += montoRecaudado;

        // REGLA: Solo 'finalizada' es retirable.
        if (c.effective_status === 'finalizada') {
          const descontado = withdrawalData
            .filter(w => w.campaign_id === c.id && (w.estado === 'completado' || w.estado === 'pendiente'))
            .reduce((acc, w) => acc + (Number(w.monto) || 0), 0);
          
          disponibleRetiro += Math.max(0, montoRecaudado - descontado);
        } 
        // REGLA SOLICITADA: Solo activa y pausada cuentan como "recaudación en curso"
        else if (c.effective_status === 'activa' || c.effective_status === 'pausada') {
          enCursoNoDisponible += montoRecaudado;
        }
        // Las campañas 'cancelada', 'en_revision' o 'borrador' NO suman a ninguno de los dos indicadores de "flujo" 
        // aunque siguen sumando al 'totalRecaudado' histórico.
      });

      const totalRetirado = withdrawalData
        .filter(w => w.estado === 'completado')
        .reduce((acc, w) => acc + (Number(w.monto) || 0), 0);
        
      const enProceso = withdrawalData
        .filter(w => w.estado === 'pendiente')
        .reduce((acc, w) => acc + (Number(w.monto) || 0), 0);

      return res.status(200).json({ 
        success: true, 
        data: { 
          totalRecaudado, 
          disponibleRetiro, 
          enProceso, 
          totalRetirado,
          enCursoNoDisponible
        } 
      });
    }
    return res.status(400).json({ error: 'Tipo de consulta no válido' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
