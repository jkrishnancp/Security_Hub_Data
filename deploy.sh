#!/bin/bash

# Security Data Hub - Production Deployment Script

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="security-data-hub"
BACKUP_DIR="./backups"
DATA_DIR="./data"

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Docker and Docker Compose are installed
check_dependencies() {
    log_info "Checking dependencies..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null && ! command -v docker compose &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    log_info "Dependencies check passed."
}

# Create necessary directories
setup_directories() {
    log_info "Setting up directories..."
    
    mkdir -p $DATA_DIR/database
    mkdir -p $DATA_DIR/uploads
    mkdir -p $BACKUP_DIR
    mkdir -p ./logs
    mkdir -p ./ssl
    
    # Set proper permissions
    chmod 755 $DATA_DIR
    chmod 755 $BACKUP_DIR
    chmod 755 ./logs
    
    log_info "Directories setup completed."
}

# Backup existing data
backup_data() {
    if [ -d "$DATA_DIR" ] && [ "$(ls -A $DATA_DIR)" ]; then
        log_info "Creating backup of existing data..."
        
        TIMESTAMP=$(date +%Y%m%d_%H%M%S)
        BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.tar.gz"
        
        tar -czf $BACKUP_FILE -C $DATA_DIR . 2>/dev/null || true
        
        if [ -f "$BACKUP_FILE" ]; then
            log_info "Backup created: $BACKUP_FILE"
        else
            log_warn "Backup creation failed or no data to backup"
        fi
    fi
}

# Check environment variables
check_env() {
    log_info "Checking environment configuration..."
    
    if [ ! -f ".env" ]; then
        log_warn "No .env file found. Creating from template..."
        cp .env.production .env
        log_warn "Please edit .env file with your production values before continuing."
        read -p "Press Enter after updating .env file..."
    fi
    
    # Check for required environment variables
    if ! grep -q "NEXTAUTH_SECRET=" .env || grep -q "your-very-secure-random-secret-key-here" .env; then
        log_error "Please set NEXTAUTH_SECRET in .env file to a secure random string."
        log_info "You can generate one with: openssl rand -base64 32"
        exit 1
    fi
    
    log_info "Environment configuration check passed."
}

# Deploy application
deploy() {
    log_info "Deploying Security Data Hub..."
    
    # Pull latest images
    docker-compose pull
    
    # Build and start services
    docker-compose up --build -d
    
    # Wait for services to be healthy
    log_info "Waiting for services to start..."
    sleep 10
    
    # Check if services are running
    if docker-compose ps | grep -q "Up"; then
        log_info "✅ Deployment successful!"
        log_info "Application is running at: http://localhost:3000"
        log_info ""
        log_info "🎯 Next Steps:"
        log_info "1. Open http://localhost:3000 in your browser"
        log_info "2. Complete the onboarding wizard to set up your company and admin account"
        log_info "3. Configure your security data sources and start importing data"
        log_info ""
        log_info "📚 For help, see: ./DOCKER_README.md"
    else
        log_error "❌ Deployment failed. Check logs with: docker-compose logs"
        exit 1
    fi
}

# Deploy with PostgreSQL (production)
deploy_prod() {
    log_info "Deploying Security Data Hub with PostgreSQL..."
    
    # Check for PostgreSQL password
    if ! grep -q "POSTGRES_PASSWORD=" .env; then
        log_error "Please set POSTGRES_PASSWORD in .env file."
        exit 1
    fi
    
    # Deploy with production compose file
    docker-compose -f docker-compose.prod.yml pull
    docker-compose -f docker-compose.prod.yml up --build -d
    
    # Wait for database to be ready
    log_info "Waiting for PostgreSQL to start..."
    sleep 20
    
    # Run database migrations
    log_info "Running database migrations..."
    docker-compose -f docker-compose.prod.yml exec security-data-hub npx prisma db push || true
    
    # Check if services are running
    if docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
        log_info "✅ Production deployment successful!"
        log_info "Application is running at: http://localhost:3000"
    else
        log_error "❌ Production deployment failed. Check logs with: docker-compose -f docker-compose.prod.yml logs"
        exit 1
    fi
}

# Stop application
stop() {
    log_info "Stopping Security Data Hub..."
    docker-compose down
    docker-compose -f docker-compose.prod.yml down 2>/dev/null || true
    log_info "Application stopped."
}

# Show logs
logs() {
    docker-compose logs -f
}

# Show status
status() {
    log_info "Service Status:"
    docker-compose ps
    
    if command -v curl &> /dev/null; then
        log_info ""
        log_info "Health Check:"
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/auth/session | grep -q "200"; then
            log_info "✅ Application is healthy"
        else
            log_warn "⚠️  Application may not be responding"
        fi
    fi
}

# Main script
case "$1" in
    "deploy")
        check_dependencies
        setup_directories
        backup_data
        check_env
        deploy
        ;;
    "deploy-prod")
        check_dependencies
        setup_directories
        backup_data
        check_env
        deploy_prod
        ;;
    "stop")
        stop
        ;;
    "logs")
        logs
        ;;
    "status")
        status
        ;;
    "backup")
        backup_data
        ;;
    *)
        echo "Security Data Hub Deployment Script"
        echo ""
        echo "Usage: $0 {deploy|deploy-prod|stop|logs|status|backup}"
        echo ""
        echo "Commands:"
        echo "  deploy      - Deploy with SQLite (development/testing)"
        echo "  deploy-prod - Deploy with PostgreSQL (production)"
        echo "  stop        - Stop all services"
        echo "  logs        - Show application logs"
        echo "  status      - Show service status"
        echo "  backup      - Backup data manually"
        echo ""
        exit 1
        ;;
esac