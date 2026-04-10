const helmet = require('helmet');
const compression = require('compression');

// 安全中间件配置
const securityMiddleware = {
  // Helmet 安全头配置
  helmet: helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        // Vue开发模式需要 unsafe-eval，始终允许
        scriptSrc: ["'self'", "'unsafe-eval'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"]
      }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
  }),
  
  // 压缩中间件
  compression: compression({
    level: 6,
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) {
        return false;
      }
      return compression.filter(req, res);
    }
  }),
  
  // CORS 配置
  cors: (req, res, next) => {
    // 允许的源列表（从环境变量 ALLOWED_ORIGINS 读取，逗号分隔，如：http://localhost:3000,https://your-domain.com）
    const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
    const defaultOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173'
    ];
    const allowedOrigins = allowedOriginsEnv 
      ? allowedOriginsEnv.split(',').map(origin => origin.trim()).filter(origin => origin)
      : defaultOrigins;
    
    const origin = req.get('Origin');
    
    // 如果请求有Origin头且在允许列表中，则设置该Origin并允许credentials
    // 如果Origin不在列表中但存在，也允许访问（开发/测试环境）
    if (origin && allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    } else if (origin) {
      // 对于其他源，也允许访问（开发/测试环境）
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    } else {
      // 没有 Origin 头（同源请求），允许所有来源
      res.header('Access-Control-Allow-Origin', '*');
    }
    
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Requested-With');
    res.header('Access-Control-Max-Age', '86400'); // 24小时
    
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  },
  
  // 请求大小限制
  bodyLimit: (req, res, next) => {
    const contentLength = parseInt(req.headers['content-length'] || '0');
    const maxSize = 10 * 1024 * 1024; // 10MB
    
    if (contentLength > maxSize) {
      return res.status(413).json({
        error: '请求体过大',
        maxSize: '10MB'
      });
    }
    
    next();
  },
  
  // SQL注入防护
  sqlInjectionProtection: (req, res, next) => {
    const sqlPattern = /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT|SCRIPT>)\b)/i;
    
    const checkValue = (value) => {
      if (typeof value === 'string' && sqlPattern.test(value)) {
        return true;
      }
      if (typeof value === 'object' && value !== null) {
        return Object.values(value).some(checkValue);
      }
      return false;
    };
    
    const hasSqlInjection = checkValue(req.body) || checkValue(req.query) || checkValue(req.params);
    
    if (hasSqlInjection) {
      return res.status(400).json({
        error: '检测到潜在的SQL注入攻击',
        code: 'SQL_INJECTION_DETECTED'
      });
    }
    
    next();
  },
  
  // XSS防护
  xssProtection: (req, res, next) => {
    const xssPattern = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
    
    const sanitizeValue = (value) => {
      if (typeof value === 'string') {
        return value.replace(xssPattern, '');
      }
      if (typeof value === 'object' && value !== null) {
        Object.keys(value).forEach(key => {
          value[key] = sanitizeValue(value[key]);
        });
      }
      return value;
    };
    
    req.body = sanitizeValue(req.body);
    req.query = sanitizeValue(req.query);
    req.params = sanitizeValue(req.params);
    
    next();
  },
  
  // 请求频率限制（基于IP）
  requestThrottling: (req, res, next) => {
    const ip = req.ip;
    const now = Date.now();
    const windowMs = 60000; // 1分钟
    const maxRequests = 100; // 每分钟最多100个请求
    
    // 这里可以集成Redis来存储请求计数
    // 简化版本使用内存存储（生产环境建议使用Redis）
    if (!req.app.locals.requestCounts) {
      req.app.locals.requestCounts = new Map();
    }
    
    const counts = req.app.locals.requestCounts;
    const key = `${ip}:${Math.floor(now / windowMs)}`;
    
    const currentCount = counts.get(key) || 0;
    
    if (currentCount >= maxRequests) {
      return res.status(429).json({
        error: '请求过于频繁，请稍后再试',
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
    
    counts.set(key, currentCount + 1);
    
    // 清理过期的计数
    setTimeout(() => {
      counts.delete(key);
    }, windowMs);
    
    next();
  },
  
  // 用户代理检查
  userAgentCheck: (req, res, next) => {
    const userAgent = req.get('User-Agent');
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i
    ];
    
    const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(userAgent));
    
    if (isSuspicious) {
      // 记录可疑请求
      console.warn('可疑的User-Agent:', userAgent);
      
      // 可以选择拒绝请求或增加额外的验证
      // return res.status(403).json({ error: '访问被拒绝' });
    }
    
    next();
  },
  
  // 请求来源验证
  originValidation: (req, res, next) => {
    // 从环境变量 ALLOWED_ORIGINS 读取允许的来源，支持逗号分隔
    const allowedOriginsEnv = process.env.ALLOWED_ORIGINS;
    const defaultOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173'
    ];
    const allowedOrigins = allowedOriginsEnv 
      ? allowedOriginsEnv.split(',').map(origin => origin.trim()).filter(origin => origin)
      : defaultOrigins;
    
    const origin = req.get('Origin');
    
    if (origin && !allowedOrigins.includes(origin)) {
      console.warn('未授权的请求来源:', origin);
      // 可以选择拒绝请求
      // return res.status(403).json({ error: '未授权的请求来源' });
    }
    
    next();
  }
};

module.exports = securityMiddleware;


