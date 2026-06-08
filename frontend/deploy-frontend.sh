#!/bin/bash

# 信奥成长计划前端部署脚本
# 支持通过环境变量或配置文件自定义服务器和API地址

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数（需要先定义）
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# 加载配置文件（如果存在）
if [ -f ".deploy-config" ]; then
    log_info "加载部署配置文件..."
    source .deploy-config
fi

# 服务器配置（必须通过 .deploy-config 或环境变量配置）
SERVER_IP="${DEPLOY_SERVER_IP:-}"
SERVER_USER="${DEPLOY_SERVER_USER:-root}"
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/gesp-frontend}"
NGINX_CONFIG_PATH="${NGINX_CONFIG_PATH:-/etc/nginx/conf.d/gesp-frontend.conf}"
# 动画上传目录（独立于部署目录，避免 rm -rf 清空时删除教师上传的动画）
ANIMATIONS_UPLOAD_PATH="${ANIMATIONS_UPLOAD_PATH:-/var/www/gesp-uploads/html}"
FORCE_LOCAL_DEPLOY="${FORCE_LOCAL_DEPLOY:-false}"
FORCE_REBUILD="${FORCE_REBUILD:-false}"

# HTTPS/SSL配置（可选，如果配置了SSL证书路径，则启用HTTPS）
DOMAIN_NAME="${DOMAIN_NAME:-}"
SSL_CERT_PATH="${SSL_CERT_PATH:-}"
SSL_KEY_PATH="${SSL_KEY_PATH:-}"
ENABLE_HTTPS="${ENABLE_HTTPS:-false}"

# API配置（必须通过 .deploy-config 或环境变量配置）
API_BASE_URL="${API_BASE_URL:-}"
AI_API_BASE_URL="${AI_API_BASE_URL:-}"
OJ_API_CONFIGS="${OJ_API_CONFIGS:-}"

# 检测是否为本地部署模式
detect_local_deploy() {
    LOCAL_DEPLOY=false

    if [ "${FORCE_LOCAL_DEPLOY}" = "true" ]; then
        LOCAL_DEPLOY=true
        log_info "使用本地部署模式（FORCE_LOCAL_DEPLOY=true）"
        return
    fi
    
    # 获取当前服务器的IP地址（可能包含多个内网IP）
    local current_internal_ips=""
    if command -v hostname >/dev/null 2>&1; then
        current_internal_ips=$(hostname -I 2>/dev/null || echo "")
    fi
    
    # 获取当前服务器的公网IP。服务器上直连查询，避免代理环境影响判断。
    local current_public_ip=""
    if command -v curl >/dev/null 2>&1; then
        current_public_ip=$(curl -s --noproxy '*' --connect-timeout 2 https://ifconfig.me 2>/dev/null || curl -s --noproxy '*' --connect-timeout 2 https://ipinfo.io/ip 2>/dev/null || echo "")
    fi

    # 阿里云等云服务器的元数据服务可作为公网IP判断兜底。
    local current_metadata_ip=""
    if command -v curl >/dev/null 2>&1; then
        current_metadata_ip=$(curl -s --noproxy '*' --connect-timeout 1 http://100.100.100.200/latest/meta-data/eipv4 2>/dev/null || curl -s --noproxy '*' --connect-timeout 1 http://100.100.100.200/latest/meta-data/public-ipv4 2>/dev/null || echo "")
    fi
    
    # 检查是否为本地部署
    if [ "${SERVER_IP}" = "localhost" ] || [ "${SERVER_IP}" = "127.0.0.1" ]; then
        LOCAL_DEPLOY=true
        log_info "检测到本地部署模式（localhost）"
    elif [ -n "${current_internal_ips}" ] && echo " ${current_internal_ips} " | grep -q " ${SERVER_IP} "; then
        LOCAL_DEPLOY=true
        log_info "检测到本地部署模式（内网IP匹配: ${SERVER_IP}）"
    elif [ -n "${current_public_ip}" ] && [ "${SERVER_IP}" = "${current_public_ip}" ]; then
        LOCAL_DEPLOY=true
        log_info "检测到本地部署模式（公网IP匹配: ${current_public_ip}）"
    elif [ -n "${current_metadata_ip}" ] && [ "${SERVER_IP}" = "${current_metadata_ip}" ]; then
        LOCAL_DEPLOY=true
        log_info "检测到本地部署模式（云元数据公网IP匹配: ${current_metadata_ip}）"
    elif [ "${SERVER_IP}" = "$(hostname -f 2>/dev/null || hostname 2>/dev/null || echo '')" ]; then
        LOCAL_DEPLOY=true
        log_info "检测到本地部署模式（主机名匹配）"
    else
        LOCAL_DEPLOY=false
        log_info "使用远程部署模式（目标服务器: ${SERVER_IP}）"
    fi
}

# 验证必需配置
validate_config() {
    local has_error=false
    
    if [ -z "${SERVER_IP}" ]; then
        log_error "DEPLOY_SERVER_IP 未设置！请在 .deploy-config 文件中配置 DEPLOY_SERVER_IP"
        has_error=true
    fi
    
    if [ -z "${API_BASE_URL}" ]; then
        log_error "API_BASE_URL 未设置！请在 .deploy-config 文件中配置 API_BASE_URL"
        has_error=true
    fi
    
    if [ -z "${AI_API_BASE_URL}" ]; then
        log_error "AI_API_BASE_URL 未设置！请在 .deploy-config 文件中配置 AI_API_BASE_URL"
        has_error=true
    fi
    
    if [ "$has_error" = true ]; then
        echo ""
        log_error "配置验证失败！请检查 .deploy-config 文件或环境变量"
        echo ""
        log_info "配置示例（.deploy-config 文件）："
        echo "  DEPLOY_SERVER_IP=your-server-ip"
        echo "  API_BASE_URL=http://your-server-ip:3000/api"
        echo "  AI_API_BASE_URL=http://your-server-ip:8000/api"
        echo ""
        exit 1
    fi
    
    # 如果 DOMAIN_NAME 未配置，使用 SERVER_IP
    if [ -z "${DOMAIN_NAME}" ]; then
        DOMAIN_NAME="${SERVER_IP}"
    fi
    
    # 检测部署模式
    detect_local_deploy
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查并安装依赖
check_dependencies() {
    log_info "检查项目依赖..."
    
    if [ ! -d "node_modules" ] || [ ! -f "node_modules/.bin/vite" ]; then
        log_warning "依赖未安装，正在安装..."
        npm install
        if [ $? -ne 0 ]; then
            log_error "依赖安装失败！请检查网络连接和npm配置"
            exit 1
        fi
        log_success "依赖安装完成"
    else
        log_success "依赖检查通过"
    fi
}

# 构建前端（带环境变量）
build_frontend() {
    log_info "开始构建前端应用..."
    log_info "API地址: ${API_BASE_URL}"
    log_info "AI API地址: ${AI_API_BASE_URL}"
    
    if [ -n "${OJ_API_CONFIGS}" ]; then
        log_info "判题机配置: ${OJ_API_CONFIGS}"
    else
        log_info "判题机配置: 未设置（将使用默认配置）"
    fi
    
    # 检查并安装依赖
    check_dependencies
    
    # 设置环境变量并构建
    export VITE_API_BASE_URL="${API_BASE_URL}"
    export VITE_AI_API_BASE_URL="${AI_API_BASE_URL}"
    
    # 如果配置了判题机列表，设置环境变量
    if [ -n "${OJ_API_CONFIGS}" ]; then
        export VITE_OJ_API_CONFIGS="${OJ_API_CONFIGS}"
    fi
    
    npm run build
    
    log_success "前端构建完成"
}

# 检查构建文件是否存在
check_build_files() {
    log_info "检查构建文件..."

    if [ "${FORCE_REBUILD}" = "true" ]; then
        log_info "FORCE_REBUILD=true，重新构建前端..."
        build_frontend
        return
    fi
    
    if [ ! -d "dist" ]; then
        log_warning "dist目录不存在，将自动构建..."
        build_frontend
        return
    fi
    
    if [ ! -f "dist/index.html" ]; then
        log_warning "dist/index.html不存在，将重新构建..."
        build_frontend
        return
    fi
    
    log_success "构建文件检查通过"
}

# 创建部署目录
create_deploy_directory() {
    log_info "创建部署目录..."
    
    if [ "$LOCAL_DEPLOY" = true ]; then
        mkdir -p ${DEPLOY_PATH}
    else
        ssh ${SERVER_USER}@${SERVER_IP} "mkdir -p ${DEPLOY_PATH}"
    fi
    
    log_success "部署目录创建完成"
}

# 上传文件到服务器
upload_files() {
    if [ "$LOCAL_DEPLOY" = true ]; then
        log_info "复制文件到部署目录..."
        
        # 先清空部署目录
        rm -rf ${DEPLOY_PATH}/*
        
        # 复制文件
        cp -r dist/* ${DEPLOY_PATH}/
        
        # 同步内置动画到独立上传目录（保留教师已上传的 animation-*.html）
        mkdir -p ${ANIMATIONS_UPLOAD_PATH}
        if [ -d "dist/html" ]; then
            cp -n dist/html/* ${ANIMATIONS_UPLOAD_PATH}/ 2>/dev/null || cp dist/html/* ${ANIMATIONS_UPLOAD_PATH}/ 2>/dev/null || true
        fi
        
        log_success "文件复制完成"
    else
        log_info "上传文件到服务器..."
        
        # 先清空服务器上的目录
        ssh ${SERVER_USER}@${SERVER_IP} "rm -rf ${DEPLOY_PATH}/*"
        
        # 使用scp上传文件
        scp -r dist/* ${SERVER_USER}@${SERVER_IP}:${DEPLOY_PATH}/
        
        # 同步内置动画到独立上传目录（保留教师已上传的 animation-*.html，不被部署清空）
        ssh ${SERVER_USER}@${SERVER_IP} "mkdir -p ${ANIMATIONS_UPLOAD_PATH} && [ -d ${DEPLOY_PATH}/html ] && cp -n ${DEPLOY_PATH}/html/* ${ANIMATIONS_UPLOAD_PATH}/ 2>/dev/null || cp ${DEPLOY_PATH}/html/* ${ANIMATIONS_UPLOAD_PATH}/ 2>/dev/null || true"
        
        log_success "文件上传完成"
    fi
}

# 配置Nginx
configure_nginx() {
    log_info "配置Nginx..."
    
    # 检查是否启用HTTPS
    local enable_https_check=false
    if [ "$ENABLE_HTTPS" = "true" ] || [ -n "$SSL_CERT_PATH" ] || [ -n "$SSL_KEY_PATH" ]; then
        enable_https_check=true
    fi
    
    # 如果配置了SSL证书路径，验证证书文件是否存在
    if [ "$enable_https_check" = "true" ] && [ -n "$SSL_CERT_PATH" ] && [ -n "$SSL_KEY_PATH" ]; then
        log_info "检测到SSL证书配置，启用HTTPS..."
        
        # 检查服务器上的证书文件是否存在
        if [ "$LOCAL_DEPLOY" = true ]; then
            if [ ! -f "${SSL_CERT_PATH}" ]; then
                log_error "SSL证书文件不存在: ${SSL_CERT_PATH}"
                log_warning "HTTPS配置将被跳过，使用HTTP模式"
                enable_https_check=false
            elif [ ! -f "${SSL_KEY_PATH}" ]; then
                log_error "SSL密钥文件不存在: ${SSL_KEY_PATH}"
                log_warning "HTTPS配置将被跳过，使用HTTP模式"
                enable_https_check=false
            else
                log_success "SSL证书文件验证通过"
            fi
        else
            if ! ssh ${SERVER_USER}@${SERVER_IP} "test -f ${SSL_CERT_PATH}" 2>/dev/null; then
                log_error "SSL证书文件不存在: ${SSL_CERT_PATH}"
                log_warning "HTTPS配置将被跳过，使用HTTP模式"
                enable_https_check=false
            elif ! ssh ${SERVER_USER}@${SERVER_IP} "test -f ${SSL_KEY_PATH}" 2>/dev/null; then
                log_error "SSL密钥文件不存在: ${SSL_KEY_PATH}"
                log_warning "HTTPS配置将被跳过，使用HTTP模式"
                enable_https_check=false
            else
                log_success "SSL证书文件验证通过"
            fi
        fi
    fi
    
    # 创建Nginx配置文件
    if [ "$enable_https_check" = "true" ] && [ -n "$SSL_CERT_PATH" ] && [ -n "$SSL_KEY_PATH" ]; then
        # HTTPS配置（包含HTTP到HTTPS重定向）
        cat > /tmp/gesp-frontend.conf << EOF
# HTTP服务器 - 重定向到HTTPS
server {
    listen 80;
    server_name ${DOMAIN_NAME};
    
    # 重定向所有HTTP请求到HTTPS
    return 301 https://\$server_name\$request_uri;
}

# HTTPS服务器
server {
    listen 443 ssl;
    server_name ${DOMAIN_NAME};
    root ${DEPLOY_PATH};
    index index.html;

    # SSL证书配置
    ssl_certificate ${SSL_CERT_PATH};
    ssl_certificate_key ${SSL_KEY_PATH};
    
    # SSL协议和加密套件配置（兼容更多浏览器，特别是Safari）
    ssl_protocols TLSv1.2 TLSv1.3;
    # 使用更兼容的加密套件配置（包含更多选项以支持不同客户端）
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA384';
    ssl_prefer_server_ciphers off;
    
    # SSL会话配置
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    ssl_session_tickets on;
    
    # 提高兼容性的额外 SSL 配置
    ssl_buffer_size 8k;
    ssl_early_data off;
    
    # OCSP Stapling配置（已禁用，因为Let's Encrypt R12证书不包含OCSP responder URL）
    # 如果证书包含OCSP信息，可以取消注释以下行：
    # ssl_stapling on;
    # ssl_stapling_verify on;
    # ssl_trusted_certificate ${SSL_CERT_PATH};
    # resolver 8.8.8.8 8.8.4.4 valid=300s ipv6=off;
    # resolver_timeout 3s;
    
    # 超时设置（解决低版本Chrome连接超时问题）
    client_body_timeout 60s;
    client_header_timeout 60s;
    keepalive_timeout 75s;
    send_timeout 60s;
    
    # HTTP/1.1 优化（兼容低版本浏览器）
    keepalive_requests 100;
    
    # 缓冲区设置
    client_body_buffer_size 128k;
    client_max_body_size 10m;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 16k;

    # 启用gzip压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    gzip_comp_level 6;
    gzip_disable "msie6";

    # API反向代理（仅本机后端 127.0.0.1:3000）
    location /api {
        proxy_pass http://127.0.0.1:3000/api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # AI 服务反向代理（仅本机 127.0.0.1:8000，不对外暴露 8000 端口）
    location /ai-api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        client_max_body_size 50m;
    }

    # 上传文件代理（^~ 优先于静态资源正则，避免 /uploads/xxx.png 被误匹配）
    location ^~ /uploads/ {
        proxy_pass http://127.0.0.1:3000/uploads/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }

    # 动画HTML文件（独立于部署目录，避免前端部署清空时删除教师上传的动画）
    location ^~ /html/ {
        alias ${ANIMATIONS_UPLOAD_PATH}/;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # 处理Vue Router的history模式
    location / {
        try_files \$uri \$uri/ /index.html;
        
        # 为HTML文件禁用缓存
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # 安全头
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
EOF
    else
        # HTTP配置（原始配置，保持向后兼容）
        cat > /tmp/gesp-frontend.conf << EOF
server {
    listen 80;
    server_name ${DOMAIN_NAME};
    root ${DEPLOY_PATH};
    index index.html;

    # 超时设置（解决低版本Chrome连接超时问题）
    client_body_timeout 60s;
    client_header_timeout 60s;
    keepalive_timeout 75s;
    send_timeout 60s;
    
    # HTTP/1.1 优化（兼容低版本浏览器）
    keepalive_requests 100;
    
    # 缓冲区设置
    client_body_buffer_size 128k;
    client_max_body_size 10m;
    client_header_buffer_size 1k;
    large_client_header_buffers 4 16k;

    # 启用gzip压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;
    gzip_comp_level 6;
    gzip_disable "msie6";

    # API反向代理（仅本机后端 127.0.0.1:3000）
    location /api {
        proxy_pass http://127.0.0.1:3000/api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # AI 服务反向代理（仅本机 127.0.0.1:8000）
    location /ai-api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        client_max_body_size 50m;
    }

    # 上传文件代理（^~ 优先于静态资源正则，避免 /uploads/xxx.png 被误匹配）
    location ^~ /uploads/ {
        proxy_pass http://127.0.0.1:3000/uploads/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }

    # 动画HTML文件（独立于部署目录，避免前端部署清空时删除教师上传的动画）
    location ^~ /html/ {
        alias ${ANIMATIONS_UPLOAD_PATH}/;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # 处理Vue Router的history模式
    location / {
        try_files \$uri \$uri/ /index.html;
        
        # 为HTML文件禁用缓存
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Pragma "no-cache";
        add_header Expires "0";
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
EOF
    fi

    # 上传配置文件到服务器
    if [ "$LOCAL_DEPLOY" = true ]; then
        cp /tmp/gesp-frontend.conf ${NGINX_CONFIG_PATH}
        
        # 测试配置并重载Nginx
        nginx -t && systemctl reload nginx
    else
        scp /tmp/gesp-frontend.conf ${SERVER_USER}@${SERVER_IP}:${NGINX_CONFIG_PATH}
        
        # 测试配置并重载Nginx
        ssh ${SERVER_USER}@${SERVER_IP} "
            nginx -t && systemctl reload nginx
        "
    fi
    
    # 清理临时文件
    rm /tmp/gesp-frontend.conf
    
    if [ "$enable_https_check" = "true" ] && [ -n "$SSL_CERT_PATH" ] && [ -n "$SSL_KEY_PATH" ]; then
        log_success "Nginx HTTPS配置完成"
    else
        log_success "Nginx HTTP配置完成"
        log_warning "如需启用HTTPS，请配置SSL证书路径（SSL_CERT_PATH 和 SSL_KEY_PATH）"
    fi
}

# 设置文件权限
set_permissions() {
    log_info "设置文件权限..."
    
    # 自动检测Nginx用户（支持Debian/Ubuntu的www-data和CentOS/RHEL的nginx）
    local nginx_user="www-data"
    if [ "$LOCAL_DEPLOY" = true ]; then
        if ! id -u www-data >/dev/null 2>&1; then
            if id -u nginx >/dev/null 2>&1; then
                nginx_user="nginx"
                log_info "检测到使用 nginx 用户（CentOS/RHEL系统）"
            else
                log_warning "未找到 www-data 或 nginx 用户，使用 root 用户"
                nginx_user="root"
            fi
        else
            log_info "检测到使用 www-data 用户（Debian/Ubuntu系统）"
        fi
        
        chown -R ${nginx_user}:${nginx_user} ${DEPLOY_PATH}
        chmod -R 755 ${DEPLOY_PATH}
        # 动画上传目录权限（Nginx 需能读取）
        [ -d "${ANIMATIONS_UPLOAD_PATH}" ] && chown -R ${nginx_user}:${nginx_user} $(dirname ${ANIMATIONS_UPLOAD_PATH}) 2>/dev/null || true
    else
        if ! ssh ${SERVER_USER}@${SERVER_IP} "id -u www-data >/dev/null 2>&1"; then
            if ssh ${SERVER_USER}@${SERVER_IP} "id -u nginx >/dev/null 2>&1"; then
                nginx_user="nginx"
                log_info "检测到使用 nginx 用户（CentOS/RHEL系统）"
            else
                log_warning "未找到 www-data 或 nginx 用户，使用 root 用户"
                nginx_user="root"
            fi
        else
            log_info "检测到使用 www-data 用户（Debian/Ubuntu系统）"
        fi
        
        ssh ${SERVER_USER}@${SERVER_IP} "
            chown -R ${nginx_user}:${nginx_user} ${DEPLOY_PATH}
            chmod -R 755 ${DEPLOY_PATH}
            [ -d ${ANIMATIONS_UPLOAD_PATH} ] && chown -R ${nginx_user}:${nginx_user} $(dirname ${ANIMATIONS_UPLOAD_PATH}) || true
        "
    fi
    
    log_success "文件权限设置完成（使用用户: ${nginx_user}）"
}

# 健康检查
health_check() {
    log_info "执行健康检查..."
    
    sleep 5
    
    # 根据是否启用HTTPS选择检查协议
    local check_url=""
    if [ "$ENABLE_HTTPS" = "true" ] || ([ -n "$SSL_CERT_PATH" ] && [ -n "$SSL_KEY_PATH" ]); then
        check_url="https://${DOMAIN_NAME}/"
        log_info "使用HTTPS进行健康检查..."
        
        # 先检查HTTP是否可访问（用于诊断）
        log_info "检查HTTP连接（端口80）..."
        if curl -f -s -o /dev/null -w "%{http_code}" --connect-timeout 5 "http://${DOMAIN_NAME}/" > /dev/null 2>&1; then
            log_info "HTTP连接正常"
        else
            log_warning "HTTP连接失败"
        fi
        
        # 详细检查HTTPS连接
        log_info "检查HTTPS连接（端口443）..."
        local curl_output=$(curl -v -k --connect-timeout 10 -s -o /dev/null -w "\nHTTP状态码: %{http_code}\n连接时间: %{time_connect}s\n总时间: %{time_total}s" "${check_url}" 2>&1)
        local curl_exit_code=$?
        
        if [ $curl_exit_code -eq 0 ]; then
            log_success "健康检查通过！"
            log_success "前端应用已成功部署到: ${check_url}"
            echo "$curl_output" | grep -E "(HTTP状态码|连接时间|总时间)" || true
        else
            log_error "健康检查失败！"
            log_info "HTTPS连接诊断信息："
            echo "$curl_output" | tail -20
            echo ""
            log_warning "可能的原因："
            echo "  1. Nginx未正常运行或配置有误"
            echo "  2. SSL证书配置问题（证书路径、权限等）"
            echo "  3. 防火墙/安全组未开放443端口"
            echo "  4. SSL/TLS协议版本不兼容"
            echo ""
            log_info "请执行以下命令进行诊断："
            echo "  ssh ${SERVER_USER}@${SERVER_IP} 'systemctl status nginx'"
            echo "  ssh ${SERVER_USER}@${SERVER_IP} 'nginx -t'"
            echo "  ssh ${SERVER_USER}@${SERVER_IP} 'tail -50 /var/log/nginx/error.log'"
            echo "  ssh ${SERVER_USER}@${SERVER_IP} 'netstat -tlnp | grep 443'"
            echo "  ssh ${SERVER_USER}@${SERVER_IP} 'test -f ${SSL_CERT_PATH} && echo \"证书存在\" || echo \"证书不存在\"'"
            echo "  ssh ${SERVER_USER}@${SERVER_IP} 'test -f ${SSL_KEY_PATH} && echo \"密钥存在\" || echo \"密钥不存在\"'"
        fi
    else
        check_url="http://${DOMAIN_NAME}/"
        log_info "使用HTTP进行健康检查..."
        
        local curl_output=$(curl -v -f -s -o /dev/null -w "\nHTTP状态码: %{http_code}\n连接时间: %{time_connect}s\n总时间: %{time_total}s" "${check_url}" 2>&1)
        local curl_exit_code=$?
        
        if [ $curl_exit_code -eq 0 ]; then
            log_success "健康检查通过！"
            log_success "前端应用已成功部署到: ${check_url}"
        else
            log_warning "健康检查失败，请检查服务器状态"
            log_info "尝试检查地址: ${check_url}"
            echo "$curl_output" | tail -10
        fi
    fi
}

# 显示部署信息
show_deployment_info() {
    log_success "部署完成！"
    echo ""
    echo "部署信息："
    echo "  - 服务器地址: ${SERVER_IP}"
    echo "  - 部署路径: ${DEPLOY_PATH}"
    
    if [ "$ENABLE_HTTPS" = "true" ] || ([ -n "$SSL_CERT_PATH" ] && [ -n "$SSL_KEY_PATH" ]); then
        echo "  - 访问地址: https://${DOMAIN_NAME}"
        echo "  - HTTP自动重定向到HTTPS: 已启用"
    else
        echo "  - 访问地址: http://${DOMAIN_NAME}"
        echo "  - HTTPS: 未启用"
    fi
    
    echo "  - Nginx配置: ${NGINX_CONFIG_PATH}"
    echo ""
    echo "管理命令："
    echo "  - 查看Nginx状态: ssh ${SERVER_USER}@${SERVER_IP} 'systemctl status nginx'"
    echo "  - 查看Nginx日志: ssh ${SERVER_USER}@${SERVER_IP} 'tail -f /var/log/nginx/error.log'"
    echo "  - 重新加载Nginx: ssh ${SERVER_USER}@${SERVER_IP} 'systemctl reload nginx'"
    
    if [ "$ENABLE_HTTPS" != "true" ] && [ -z "$SSL_CERT_PATH" ]; then
        echo ""
        log_warning "HTTPS未启用！如需启用HTTPS，请配置SSL证书："
        echo "  1. 获取SSL证书（推荐使用Let's Encrypt免费证书）"
        echo "  2. 在 .deploy-config 中配置 SSL_CERT_PATH 和 SSL_KEY_PATH"
        echo "  3. 重新运行部署脚本"
    fi
    echo ""
}

# 显示配置信息
show_config() {
    log_info "当前部署配置："
    echo "  - 服务器IP: ${SERVER_IP}"
    echo "  - 服务器用户: ${SERVER_USER}"
    echo "  - 部署路径: ${DEPLOY_PATH}"
    echo "  - 强制本地部署: ${FORCE_LOCAL_DEPLOY}"
    echo "  - 强制重新构建: ${FORCE_REBUILD}"
    echo "  - 域名: ${DOMAIN_NAME}"
    echo "  - API地址: ${API_BASE_URL}"
    echo "  - AI API地址: ${AI_API_BASE_URL}"
    if [ -n "${OJ_API_CONFIGS}" ]; then
        echo "  - 判题机配置: ${OJ_API_CONFIGS}"
    else
        echo "  - 判题机配置: 未设置（使用默认）"
    fi
    
    if [ "$ENABLE_HTTPS" = "true" ] || [ -n "$SSL_CERT_PATH" ] || [ -n "$SSL_KEY_PATH" ]; then
        echo "  - HTTPS: 已启用"
        if [ -n "$SSL_CERT_PATH" ]; then
            echo "  - SSL证书: ${SSL_CERT_PATH}"
        fi
        if [ -n "$SSL_KEY_PATH" ]; then
            echo "  - SSL密钥: ${SSL_KEY_PATH}"
        fi
    else
        echo "  - HTTPS: 未启用（仅HTTP）"
    fi
    
    echo ""
    log_info "提示: 可以通过以下方式自定义配置："
    echo "  1. 创建 .deploy-config 文件并设置变量"
    echo "  2. 使用环境变量: DEPLOY_SERVER_IP, API_BASE_URL 等"
    echo "  3. 在命令行中设置: DEPLOY_SERVER_IP=xxx ./deploy-frontend.sh"
    echo ""
    log_info "启用HTTPS:"
    echo "  在 .deploy-config 文件中设置："
    echo "    DOMAIN_NAME=your-domain.com"
    echo "    SSL_CERT_PATH=/etc/ssl/certs/your-cert.crt"
    echo "    SSL_KEY_PATH=/etc/ssl/private/your-key.key"
    echo "    或使用 Let's Encrypt:"
    echo "    SSL_CERT_PATH=/etc/letsencrypt/live/your-domain.com/fullchain.pem"
    echo "    SSL_KEY_PATH=/etc/letsencrypt/live/your-domain.com/privkey.pem"
    echo ""
}

# 主函数
main() {
    # 验证必需配置
    validate_config
    
    log_info "开始部署GESP前端到 ${SERVER_IP}"
    
    show_config
    
    # 如果指定了 --build 参数、强制重建或 dist 目录不存在，则先构建
    if [ "$1" == "--build" ] || [ "${FORCE_REBUILD}" = "true" ] || [ ! -d "dist" ]; then
        build_frontend
    else
        check_build_files
    fi
    
    create_deploy_directory
    upload_files
    configure_nginx
    set_permissions
    health_check
    show_deployment_info
}

# 执行主函数
main "$@"
