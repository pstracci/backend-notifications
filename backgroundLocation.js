/**
 * Endpoint para atualização de localização em background
 * Atualiza a localização do usuário e do dispositivo
 */
const updateBackgroundLocation = async (req, res) => {
  const { uid } = req.user;
  const { latitude, longitude, deviceId, deviceToken } = req.body;

  if (!latitude || !longitude || !deviceId) {
    return res.status(400).json({ 
      success: false, 
      error: 'Campos obrigatórios: latitude, longitude e deviceId' 
    });
  }

  try {
    // Inicia uma transação
    await db.query('BEGIN');
    
    // 1. Atualiza ou cria o dispositivo
    const upsertDeviceQuery = `
      INSERT INTO devices (device_id, user_id, token, last_active_at)
      VALUES ($1, (SELECT id FROM users WHERE uid = $2), $3, NOW())
      ON CONFLICT (device_id) 
      DO UPDATE SET 
        token = EXCLUDED.token,
        last_active_at = NOW()
      RETURNING id;
    `;
    
    await db.query(upsertDeviceQuery, [deviceId, uid, deviceToken || null]);
    
    // 2. Atualiza a localização do usuário
    const updateUserLocationQuery = `
      UPDATE users 
      SET 
        latitude = $1, 
        longitude = $2, 
        location_updated_at = NOW()
      WHERE uid = $3
      RETURNING id, uid, latitude, longitude, location_updated_at;
    `;
    
    const { rows } = await db.query(updateUserLocationQuery, [latitude, longitude, uid]);
    
    if (rows.length === 0) {
      await db.query('ROLLBACK');
      return res.status(404).json({ 
        success: false, 
        error: 'Usuário não encontrado' 
      });
    }
    
    await db.query('COMMIT');
    
    res.status(200).json({ 
      success: true, 
      location_updated: true,
      user: rows[0]
    });
    
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Erro ao atualizar localização em background:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Erro ao processar atualização de localização',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = updateBackgroundLocation;
