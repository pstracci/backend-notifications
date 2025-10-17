// rateLimiter.js
// Sistema de controle de rate limiting para API do Tomorrow.io
// Limites: 500 req/dia, 25 req/hora, 3 req/segundo

class RateLimiter {
  constructor() {
    // Contadores
    this.requestsPerSecond = [];
    this.requestsPerHour = [];
    this.requestsPerDay = [];
    
    // Limites da API Tomorrow.io
    this.limits = {
      perSecond: 3,
      perHour: 25,
      perDay: 500
    };
    
    // Timestamps de limpeza
    this.lastCleanup = {
      second: Date.now(),
      hour: Date.now(),
      day: Date.now()
    };
  }

  /**
   * Limpa contadores antigos
   */
  cleanup() {
    const now = Date.now();
    
    // Limpar requisições com mais de 1 segundo
    this.requestsPerSecond = this.requestsPerSecond.filter(
      timestamp => now - timestamp < 1000
    );
    
    // Limpar requisições com mais de 1 hora
    this.requestsPerHour = this.requestsPerHour.filter(
      timestamp => now - timestamp < 3600000 // 1 hora em ms
    );
    
    // Limpar requisições com mais de 24 horas
    this.requestsPerDay = this.requestsPerDay.filter(
      timestamp => now - timestamp < 86400000 // 24 horas em ms
    );
  }

  /**
   * Verifica se pode fazer uma requisição
   * @returns {Object} { allowed: boolean, reason: string, waitTime: number }
   */
  canMakeRequest() {
    this.cleanup();
    
    const now = Date.now();
    
    // Verificar limite por segundo
    if (this.requestsPerSecond.length >= this.limits.perSecond) {
      const oldestRequest = Math.min(...this.requestsPerSecond);
      const waitTime = 1000 - (now - oldestRequest);
      return {
        allowed: false,
        reason: `Limite de ${this.limits.perSecond} requisições por segundo atingido`,
        waitTime: Math.max(0, waitTime),
        currentCount: this.requestsPerSecond.length,
        limit: this.limits.perSecond,
        period: 'segundo'
      };
    }
    
    // Verificar limite por hora
    if (this.requestsPerHour.length >= this.limits.perHour) {
      const oldestRequest = Math.min(...this.requestsPerHour);
      const waitTime = 3600000 - (now - oldestRequest);
      return {
        allowed: false,
        reason: `Limite de ${this.limits.perHour} requisições por hora atingido`,
        waitTime: Math.max(0, waitTime),
        currentCount: this.requestsPerHour.length,
        limit: this.limits.perHour,
        period: 'hora'
      };
    }
    
    // Verificar limite por dia
    if (this.requestsPerDay.length >= this.limits.perDay) {
      const oldestRequest = Math.min(...this.requestsPerDay);
      const waitTime = 86400000 - (now - oldestRequest);
      return {
        allowed: false,
        reason: `Limite de ${this.limits.perDay} requisições por dia atingido`,
        waitTime: Math.max(0, waitTime),
        currentCount: this.requestsPerDay.length,
        limit: this.limits.perDay,
        period: 'dia'
      };
    }
    
    return {
      allowed: true,
      reason: 'OK',
      waitTime: 0
    };
  }

  /**
   * Registra uma requisição feita
   */
  recordRequest() {
    const now = Date.now();
    this.requestsPerSecond.push(now);
    this.requestsPerHour.push(now);
    this.requestsPerDay.push(now);
    this.cleanup();
  }

  /**
   * Aguarda até que seja possível fazer uma requisição
   * @param {number} maxWaitTime - Tempo máximo de espera em ms (padrão: 5000ms)
   * @returns {Promise<boolean>} true se conseguiu aguardar, false se excedeu tempo máximo
   */
  async waitUntilAllowed(maxWaitTime = 5000) {
    const startTime = Date.now();
    
    while (true) {
      const check = this.canMakeRequest();
      
      if (check.allowed) {
        return true;
      }
      
      // Verificar se excedeu tempo máximo de espera
      if (Date.now() - startTime > maxWaitTime) {
        console.warn(`⚠️ Tempo máximo de espera excedido (${maxWaitTime}ms)`);
        return false;
      }
      
      // Aguardar o tempo necessário (mínimo 100ms, máximo waitTime)
      const waitTime = Math.min(Math.max(check.waitTime, 100), maxWaitTime);
      console.log(`⏳ Aguardando ${waitTime}ms devido ao limite de ${check.period}...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  /**
   * Obtém estatísticas de uso
   * @returns {Object} Estatísticas atuais
   */
  getStats() {
    this.cleanup();
    
    return {
      perSecond: {
        current: this.requestsPerSecond.length,
        limit: this.limits.perSecond,
        available: this.limits.perSecond - this.requestsPerSecond.length,
        percentage: ((this.requestsPerSecond.length / this.limits.perSecond) * 100).toFixed(1)
      },
      perHour: {
        current: this.requestsPerHour.length,
        limit: this.limits.perHour,
        available: this.limits.perHour - this.requestsPerHour.length,
        percentage: ((this.requestsPerHour.length / this.limits.perHour) * 100).toFixed(1)
      },
      perDay: {
        current: this.requestsPerDay.length,
        limit: this.limits.perDay,
        available: this.limits.perDay - this.requestsPerDay.length,
        percentage: ((this.requestsPerDay.length / this.limits.perDay) * 100).toFixed(1)
      }
    };
  }

  /**
   * Reseta todos os contadores (usar apenas para testes)
   */
  reset() {
    this.requestsPerSecond = [];
    this.requestsPerHour = [];
    this.requestsPerDay = [];
    console.log('⚠️ Rate limiter resetado');
  }

  /**
   * Calcula quantas requisições podem ser feitas com segurança
   * @returns {number} Número máximo de requisições que podem ser feitas agora
   */
  getMaxAllowedRequests() {
    this.cleanup();
    
    const availablePerSecond = this.limits.perSecond - this.requestsPerSecond.length;
    const availablePerHour = this.limits.perHour - this.requestsPerHour.length;
    const availablePerDay = this.limits.perDay - this.requestsPerDay.length;
    
    // Retorna o menor valor (gargalo)
    return Math.min(availablePerSecond, availablePerHour, availablePerDay);
  }

  /**
   * Calcula delay ideal entre requisições para distribuir ao longo do tempo
   * @param {number} totalRequests - Total de requisições a fazer
   * @returns {number} Delay em ms entre cada requisição
   */
  calculateOptimalDelay(totalRequests) {
    // Garantir pelo menos 334ms entre requisições (3 req/segundo)
    const minDelay = 334;
    
    // Se temos muitas requisições, distribuir ao longo de 1 hora
    if (totalRequests > this.limits.perHour) {
      // Distribuir ao longo de 1 hora
      return Math.max(minDelay, Math.floor(3600000 / totalRequests));
    }
    
    // Caso contrário, usar delay mínimo seguro
    return minDelay;
  }
}

// Instância singleton
const rateLimiter = new RateLimiter();

module.exports = rateLimiter;
