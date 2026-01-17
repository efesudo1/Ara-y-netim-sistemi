/**
 * Auth Middleware
 * JWT token doğrulama katmanı
 */

const jwt = require('jsonwebtoken');

/**
 * Zorunlu kimlik doğrulama middleware'i
 * Token yoksa veya geçersizse 401 döner
 */
function authMiddleware(req, res, next) {
    try {
        // Token'ı al (cookie veya header'dan)
        let token = req.cookies?.token;

        if (!token && req.headers.authorization) {
            const authHeader = req.headers.authorization;
            if (authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            }
        }

        if (!token) {
            // API isteği mi yoksa sayfa mı?
            if (req.xhr || req.headers.accept?.includes('application/json')) {
                return res.status(401).json({
                    success: false,
                    message: 'Yetkilendirme gerekli. Lütfen giriş yapın.'
                });
            }
            return res.redirect('/login');
        }

        // Token'ı doğrula
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();

    } catch (error) {
        console.error('Auth hatası:', error.message);

        if (req.xhr || req.headers.accept?.includes('application/json')) {
            return res.status(401).json({
                success: false,
                message: 'Oturum süresi dolmuş. Lütfen tekrar giriş yapın.'
            });
        }

        res.clearCookie('token');
        res.redirect('/login');
    }
}

/**
 * Opsiyonel kimlik doğrulama
 * Token varsa kullanıcıyı ekler, yoksa devam eder
 */
function optionalAuth(req, res, next) {
    try {
        let token = req.cookies?.token;

        if (!token && req.headers.authorization) {
            const authHeader = req.headers.authorization;
            if (authHeader.startsWith('Bearer ')) {
                token = authHeader.substring(7);
            }
        }

        if (token) {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = decoded;
        }

        next();
    } catch (error) {
        // Token geçersiz, temizle ve devam et
        res.clearCookie('token');
        next();
    }
}

/**
 * Admin seed token kontrolü
 */
function seedTokenMiddleware(req, res, next) {
    const seedToken = req.headers['x-seed-token'] || req.body?.seedToken;

    if (process.env.NODE_ENV === 'development') {
        // Geliştirme ortamında token kontrolü opsiyonel
        return next();
    }

    if (!seedToken || seedToken !== process.env.ADMIN_SEED_TOKEN) {
        return res.status(403).json({
            success: false,
            message: 'Yetkisiz erişim. Geçerli seed token gerekli.'
        });
    }

    next();
}

module.exports = {
    authMiddleware,
    optionalAuth,
    seedTokenMiddleware
};
