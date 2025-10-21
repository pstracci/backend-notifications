# 📡 Exemplos de Chamadas à API Open-Meteo

## 🌐 Informações Gerais

- **URL Base**: `https://api.open-meteo.com/v1/forecast`
- **URL Qualidade do Ar**: `https://air-quality-api.open-meteo.com/v1/air-quality`
- **API Key**: ❌ **NÃO NECESSÁRIA** (API totalmente gratuita!)
- **Documentação Oficial**: https://open-meteo.com/en/docs

---

## 🚀 Exemplo 1: Consulta Básica de Clima Atual

### JavaScript (Fetch API)

```javascript
async function getWeatherData(latitude, longitude) {
  const url = 'https://api.open-meteo.com/v1/forecast';
  
  const params = new URLSearchParams({
    latitude: latitude,
    longitude: longitude,
    current: 'temperature_2m,precipitation,rain,weather_code,wind_speed_10m',
    timezone: 'auto'
  });

  try {
    const response = await fetch(`${url}?${params}`);
    const data = await response.json();
    
    console.log('Temperatura atual:', data.current.temperature_2m, '°C');
    console.log('Precipitação:', data.current.precipitation, 'mm');
    console.log('Velocidade do vento:', data.current.wind_speed_10m, 'km/h');
    
    return data;
  } catch (error) {
    console.error('Erro ao buscar dados:', error);
  }
}

// Exemplo de uso - São Paulo
getWeatherData(-23.55, -46.63);
```

### Axios (Node.js ou React)

```javascript
import axios from 'axios';

async function getWeatherData(latitude, longitude) {
  try {
    const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude: latitude,
        longitude: longitude,
        current: 'temperature_2m,precipitation,rain,weather_code,wind_speed_10m,wind_gusts_10m,uv_index',
        timezone: 'auto'
      }
    });

    return response.data;
  } catch (error) {
    console.error('Erro:', error.message);
    throw error;
  }
}
```

---

## 🌧️ Exemplo 2: Previsão de Chuva (Próximas 3 horas)

```javascript
async function getRainForecast(latitude, longitude) {
  const url = 'https://api.open-meteo.com/v1/forecast';
  
  const params = new URLSearchParams({
    latitude: latitude,
    longitude: longitude,
    hourly: 'precipitation,rain,weather_code',
    forecast_days: 1,
    timezone: 'auto'
  });

  try {
    const response = await fetch(`${url}?${params}`);
    const data = await response.json();
    
    // Pegar as próximas 3 horas
    const next3Hours = data.hourly.precipitation.slice(0, 3);
    const maxRain = Math.max(...next3Hours);
    
    console.log('Próximas 3 horas:', next3Hours);
    console.log('Máxima precipitação:', maxRain, 'mm');
    
    return {
      next3Hours,
      maxRain,
      willRain: maxRain > 0.5
    };
  } catch (error) {
    console.error('Erro:', error);
  }
}
```

---

## 🌡️ Exemplo 3: Dados Completos (Como no Backend)

```javascript
async function getCompleteWeatherData(latitude, longitude) {
  try {
    // Fazer duas requisições em paralelo
    const [weatherResponse, airQualityResponse] = await Promise.all([
      fetch(`https://api.open-meteo.com/v1/forecast?${new URLSearchParams({
        latitude,
        longitude,
        current: 'temperature_2m,precipitation,rain,weather_code,wind_speed_10m,wind_gusts_10m,uv_index',
        hourly: 'precipitation,rain,weather_code,wind_speed_10m,wind_gusts_10m,uv_index',
        forecast_days: 1,
        timezone: 'auto'
      })}`),
      fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${new URLSearchParams({
        latitude,
        longitude,
        current: 'european_aqi,pm10,pm2_5',
        timezone: 'auto'
      })}`)
    ]);

    const weatherData = await weatherResponse.json();
    const airQualityData = await airQualityResponse.json();

    return {
      weather: weatherData,
      airQuality: airQualityData,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Erro ao buscar dados completos:', error);
    throw error;
  }
}
```

---

## ⚛️ Exemplo 4: Hook React (useWeather)

```javascript
import { useState, useEffect } from 'react';

function useWeather(latitude, longitude) {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!latitude || !longitude) return;

    const fetchWeather = async () => {
      setLoading(true);
      try {
        const url = 'https://api.open-meteo.com/v1/forecast';
        const params = new URLSearchParams({
          latitude,
          longitude,
          current: 'temperature_2m,precipitation,rain,weather_code,wind_speed_10m,uv_index',
          hourly: 'precipitation,temperature_2m',
          forecast_days: 1,
          timezone: 'auto'
        });

        const response = await fetch(`${url}?${params}`);
        const data = await response.json();
        
        setWeather(data);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, [latitude, longitude]);

  return { weather, loading, error };
}

// Uso no componente
function WeatherComponent() {
  const { weather, loading, error } = useWeather(-23.55, -46.63);

  if (loading) return <div>Carregando...</div>;
  if (error) return <div>Erro: {error}</div>;
  if (!weather) return null;

  return (
    <div>
      <h2>Clima Atual</h2>
      <p>Temperatura: {weather.current.temperature_2m}°C</p>
      <p>Precipitação: {weather.current.precipitation} mm</p>
      <p>Vento: {weather.current.wind_speed_10m} km/h</p>
    </div>
  );
}
```

---

## 🎯 Exemplo 5: Verificar Alertas (Lógica do Backend)

```javascript
function getRainIntensityLevel(precipitationIntensity) {
  if (precipitationIntensity === 0 || precipitationIntensity < 0.1) {
    return 'none';
  } else if (precipitationIntensity < 2.5) {
    return 'light'; // Chuva fraca
  } else if (precipitationIntensity < 10) {
    return 'moderate'; // Chuva moderada
  } else if (precipitationIntensity < 50) {
    return 'heavy'; // Chuva forte
  } else {
    return 'extreme'; // Chuva extrema
  }
}

async function checkWeatherAlerts(latitude, longitude) {
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${new URLSearchParams({
    latitude,
    longitude,
    current: 'temperature_2m,precipitation,rain,weather_code,wind_speed_10m,wind_gusts_10m,uv_index',
    hourly: 'precipitation',
    forecast_days: 1,
    timezone: 'auto'
  })}`);

  const data = await response.json();
  const alerts = [];

  // Verificar chuva atual
  if (data.current.precipitation > 0) {
    const level = getRainIntensityLevel(data.current.precipitation);
    alerts.push({
      type: 'rain_now',
      severity: level,
      value: data.current.precipitation,
      message: `Está chovendo agora (${data.current.precipitation.toFixed(1)} mm)`
    });
  }

  // Verificar previsão de chuva (próximas 3h)
  const next3h = data.hourly.precipitation.slice(0, 3);
  const maxRain = Math.max(...next3h);
  if (maxRain > 0.5) {
    const level = getRainIntensityLevel(maxRain);
    const hour = next3h.indexOf(maxRain) + 1;
    alerts.push({
      type: 'rain_forecast',
      severity: level,
      value: maxRain,
      hoursAhead: hour,
      message: `Chuva prevista em ${hour}h (${maxRain.toFixed(1)} mm)`
    });
  }

  // Verificar UV alto
  if (data.current.uv_index >= 8) {
    alerts.push({
      type: 'uv_high',
      severity: data.current.uv_index >= 11 ? 'extreme' : 'high',
      value: data.current.uv_index,
      message: `Índice UV ${data.current.uv_index >= 11 ? 'EXTREMO' : 'ALTO'}: ${data.current.uv_index.toFixed(1)}`
    });
  }

  // Verificar vento forte
  const maxWind = Math.max(data.current.wind_speed_10m, data.current.wind_gusts_10m || 0);
  if (maxWind >= 50) {
    alerts.push({
      type: 'wind',
      severity: maxWind >= 70 ? 'very_strong' : 'strong',
      value: maxWind,
      message: `Vento ${maxWind >= 70 ? 'muito forte' : 'forte'}: ${maxWind.toFixed(0)} km/h`
    });
  }

  return alerts;
}
```

---

## 📱 Exemplo 6: Chamada Simples para Teste Rápido

### URL Direta no Navegador

```
https://api.open-meteo.com/v1/forecast?latitude=-23.55&longitude=-46.63&current=temperature_2m,precipitation,wind_speed_10m&timezone=auto
```

### cURL

```bash
curl "https://api.open-meteo.com/v1/forecast?latitude=-23.55&longitude=-46.63&current=temperature_2m,precipitation,wind_speed_10m&timezone=auto"
```

---

## 📊 Parâmetros Disponíveis

### `current` (Dados Atuais)
- `temperature_2m` - Temperatura a 2m (°C)
- `precipitation` - Precipitação total (mm)
- `rain` - Chuva (mm)
- `weather_code` - Código do clima (WMO)
- `wind_speed_10m` - Velocidade do vento a 10m (km/h)
- `wind_gusts_10m` - Rajadas de vento (km/h)
- `uv_index` - Índice UV

### `hourly` (Previsão Horária)
- `precipitation` - Precipitação por hora
- `temperature_2m` - Temperatura por hora
- `weather_code` - Código do clima por hora
- `wind_speed_10m` - Vento por hora
- `uv_index` - UV por hora

### `daily` (Previsão Diária)
- `temperature_2m_max` - Temperatura máxima
- `temperature_2m_min` - Temperatura mínima
- `precipitation_sum` - Total de precipitação
- `sunrise` - Horário do nascer do sol
- `sunset` - Horário do pôr do sol

---

## ⚠️ Observações Importantes

1. **Sem API Key**: A API Open-Meteo é totalmente gratuita e não requer autenticação
2. **Rate Limiting**: Seja educado, adicione um pequeno delay entre requisições (100-200ms)
3. **Coordenadas**: Use latitude e longitude com precisão de 2 casas decimais (~1.1km)
4. **Timezone**: Use `timezone: 'auto'` para obter horários locais automaticamente
5. **CORS**: A API permite CORS, pode ser chamada diretamente do frontend

---

## 🔗 Links Úteis

- **Documentação**: https://open-meteo.com/en/docs
- **API Explorer**: https://open-meteo.com/en/docs#api-documentation
- **Weather Codes**: https://open-meteo.com/en/docs#weathercode
- **GitHub**: https://github.com/open-meteo/open-meteo

---

## 💡 Dicas para o Frontend

1. **Cache**: Considere cachear as respostas por alguns minutos para evitar requisições desnecessárias
2. **Geolocalização**: Use a API de Geolocalização do navegador para obter lat/lon do usuário
3. **Error Handling**: Sempre trate erros de rede e timeouts
4. **Loading States**: Mostre indicadores de carregamento enquanto busca os dados
5. **Fallback**: Tenha valores padrão caso a API falhe

---

## 🎨 Exemplo Completo React + TypeScript

```typescript
interface WeatherData {
  current: {
    temperature_2m: number;
    precipitation: number;
    wind_speed_10m: number;
    uv_index: number;
  };
  hourly: {
    precipitation: number[];
    temperature_2m: number[];
  };
}

const WeatherDashboard: React.FC = () => {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Obter localização do usuário
    navigator.geolocation.getCurrentPosition(async (position) => {
      const { latitude, longitude } = position.coords;
      
      try {
        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?` +
          `latitude=${latitude}&longitude=${longitude}&` +
          `current=temperature_2m,precipitation,wind_speed_10m,uv_index&` +
          `hourly=precipitation,temperature_2m&` +
          `forecast_days=1&timezone=auto`
        );
        
        const data = await response.json();
        setWeather(data);
      } catch (error) {
        console.error('Erro ao buscar clima:', error);
      } finally {
        setLoading(false);
      }
    });
  }, []);

  if (loading) return <div>Carregando clima...</div>;
  if (!weather) return <div>Não foi possível carregar o clima</div>;

  return (
    <div className="weather-dashboard">
      <h1>Clima Atual</h1>
      <div className="current-weather">
        <p>🌡️ {weather.current.temperature_2m}°C</p>
        <p>🌧️ {weather.current.precipitation} mm</p>
        <p>💨 {weather.current.wind_speed_10m} km/h</p>
        <p>☀️ UV: {weather.current.uv_index}</p>
      </div>
    </div>
  );
};
```

---

**Criado em**: 20/10/2025  
**Backend**: meu-backend-notificacoes  
**Autor**: Backend Team
